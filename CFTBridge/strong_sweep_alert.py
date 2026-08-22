# strong_sweep_alert.py
#
# Standalone detector for "strong, fast/vertical sweeps" among golden
# signals - the user's own read on what makes a setup worth trading
# ("needs to be a strong sweep and fast into liq with wick"). Polls the
# same public /events feed as pmt_executor.py and the shadow tracker,
# tags each golden signal as strong-sweep or not, and logs the result.
# Deliberately isolated: doesn't touch BOTFINAL.py, the live dashboard,
# or pmt_executor.py - same "build it standalone first, prove it out,
# then decide whether it belongs in the real pipeline" approach as the
# shadow tracker.
#
# Sweep strength definition: how much of the sweep's price range is
# concentrated in the last few candles right before the signal, relative
# to how that SAME pair has been moving over a longer recent baseline.
# A genuinely strong/vertical sweep should stand out against the pair's
# own normal noise, not against a fixed price-independent threshold
# (which wouldn't scale sensibly across pairs at wildly different price
# scales, same reasoning as every other offset in this project being
# relative rather than fixed).
#
#   SWEEP_WINDOW_CANDLES = 3   -> the sweep itself: the last 3 candles
#     right before signal time, whose combined high-low range gets
#     measured as "the move."
#   BASELINE_LOOKBACK_CANDLES = 60 -> a longer window further back, used
#     to compute this pair's normal rolling 3-candle range (the median,
#     not the mean, so a handful of other big moves in the lookback
#     don't drag the baseline up and mask genuinely calm norms).
#   STRONG_SWEEP_MULTIPLIER = 2.0 -> the sweep window's range must be at
#     least this many times the baseline median to count as "strong."

import csv
import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import ccxt
import requests
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("strong_sweep_alert")

LLAB_API_BASE = os.getenv("LLAB_API_BASE", "https://liquidity-lab-api.onrender.com")
POLL_INTERVAL_SECONDS = 15
MAX_SIGNAL_AGE_SECONDS = 300  # same staleness bar as pmt_executor.py

GOLDEN_EVENT_TYPE = "SWEEP_CONFIRMED"
GOLDEN_PATTERN = "Sweep + Retest"
GOLDEN_SESSIONS = {"London Open", "London", "Asia", "Asia Open", "NY Open", "NY"}
GOLDEN_EXCLUDE_PAIRS = {"SAND/USDT", "SEI/USDT", "APT/USDT"}

SWEEP_WINDOW_CANDLES = 3
BASELINE_LOOKBACK_CANDLES = 60
STRONG_SWEEP_MULTIPLIER = 2.0
FETCH_LIMIT = BASELINE_LOOKBACK_CANDLES + SWEEP_WINDOW_CANDLES + 10  # a little slack

LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
SEEN_PATH = LOG_DIR / "strong_sweep_seen_events.json"
RESULTS_PATH = LOG_DIR / "strong_sweep_results.csv"

RESULT_FIELDS = [
    "logged_at", "event_id", "pair", "session", "direction",
    "entry", "stop", "tp1", "sweep_range", "baseline_median_range",
    "strength_ratio", "is_strong",
]

exchange = ccxt.blofin({"enableRateLimit": True, "options": {"defaultType": "swap"}})

FETCH_MAX_RETRIES = 3
FETCH_RETRY_BASE_SECONDS = 3.0


def fetch_ohlcv_safe(symbol, limit):
    for attempt in range(FETCH_MAX_RETRIES):
        try:
            return exchange.fetch_ohlcv(symbol, timeframe="1m", limit=limit)
        except Exception as e:
            if attempt == FETCH_MAX_RETRIES - 1:
                log.error(f"  fetch failed for {symbol} after {FETCH_MAX_RETRIES} tries: {type(e).__name__}")
                return None
            time.sleep(FETCH_RETRY_BASE_SECONDS * (2**attempt))
    return None


def is_golden(event: dict) -> bool:
    return (
        event.get("eventType") == GOLDEN_EVENT_TYPE
        and event.get("pattern") == GOLDEN_PATTERN
        and event.get("session") in GOLDEN_SESSIONS
        and event.get("pair") not in GOLDEN_EXCLUDE_PAIRS
    )


def to_symbol(pair: str) -> str:
    base = pair.split("/")[0]
    return f"{base}/USDT:USDT"


def rolling_ranges(candles: list, window: int) -> list:
    """High-low range of every `window`-sized consecutive chunk."""
    ranges = []
    for i in range(len(candles) - window + 1):
        chunk = candles[i:i + window]
        r = max(c[2] for c in chunk) - min(c[3] for c in chunk)
        ranges.append(r)
    return ranges


def compute_sweep_strength(candles: list) -> dict | None:
    """candles: chronological, ending at/near signal time. Returns None if
    there isn't enough real history to judge a baseline against yet."""
    if len(candles) < BASELINE_LOOKBACK_CANDLES + SWEEP_WINDOW_CANDLES:
        return None

    sweep_candles = candles[-SWEEP_WINDOW_CANDLES:]
    baseline_candles = candles[:-SWEEP_WINDOW_CANDLES]

    sweep_range = max(c[2] for c in sweep_candles) - min(c[3] for c in sweep_candles)

    baseline_ranges = sorted(rolling_ranges(baseline_candles, SWEEP_WINDOW_CANDLES))
    if not baseline_ranges:
        return None
    median_baseline = baseline_ranges[len(baseline_ranges) // 2]
    if median_baseline <= 0:
        return None

    ratio = sweep_range / median_baseline
    return {
        "sweep_range": sweep_range,
        "baseline_median_range": median_baseline,
        "strength_ratio": ratio,
        "is_strong": ratio >= STRONG_SWEEP_MULTIPLIER,
    }


def fetch_events():
    try:
        resp = requests.get(f"{LLAB_API_BASE}/events", timeout=10)
        resp.raise_for_status()
        data = resp.json()
        return data.get("events", data if isinstance(data, list) else [])
    except Exception as e:
        log.error(f"Failed to fetch /events: {e}")
        return []


def load_json(path, default):
    if path.exists():
        try:
            return json.loads(path.read_text())
        except Exception:
            return default
    return default


def save_json(path, data):
    path.write_text(json.dumps(data))


def append_result(row: dict):
    is_new = not RESULTS_PATH.exists()
    with open(RESULTS_PATH, "a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=RESULT_FIELDS)
        if is_new:
            writer.writeheader()
        writer.writerow({k: row.get(k, "") for k in RESULT_FIELDS})


def run():
    seen = set(load_json(SEEN_PATH, []))
    log.info(f"strong_sweep_alert started - {len(seen)} events already seen.")

    while True:
        try:
            events = fetch_events()
            for event in events:
                event_id = event.get("id")
                if not event_id or event_id in seen:
                    continue
                if not is_golden(event):
                    continue

                seen.add(event_id)

                timestamp_utc = event.get("timestampUtc")
                if timestamp_utc:
                    event_time = datetime.fromisoformat(timestamp_utc.replace("Z", "+00:00"))
                    age_seconds = (datetime.now(timezone.utc) - event_time).total_seconds()
                    if age_seconds > MAX_SIGNAL_AGE_SECONDS:
                        continue

                pair = event.get("pair")
                direction = event.get("directionBias")
                entry = event.get("entry")
                stop = event.get("stop")
                tp1 = event.get("tp1")

                candles = fetch_ohlcv_safe(to_symbol(pair), limit=FETCH_LIMIT)
                time.sleep(0.5)
                if not candles:
                    continue

                strength = compute_sweep_strength(candles)
                if strength is None:
                    continue

                tag = "STRONG SWEEP" if strength["is_strong"] else "normal"
                log.info(
                    f"{tag}: {pair} {direction} ratio={strength['strength_ratio']:.2f}x "
                    f"(sweep={strength['sweep_range']:.6g} vs baseline={strength['baseline_median_range']:.6g})"
                )

                append_result({
                    "logged_at": datetime.now(timezone.utc).isoformat(),
                    "event_id": event_id,
                    "pair": pair,
                    "session": event.get("session"),
                    "direction": direction,
                    "entry": entry,
                    "stop": stop,
                    "tp1": tp1,
                    **strength,
                })

            save_json(SEEN_PATH, list(seen))

        except Exception as e:
            log.error(f"Loop error: {e}")

        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    run()
