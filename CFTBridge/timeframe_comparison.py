# timeframe_comparison.py
#
# Tests whether scanning 3m/5m candles instead of 1m would help or hurt,
# fully isolated from BOTFINAL.py and the live golden filter - doesn't
# touch either. BOTFINAL only ever generates signals from 1m data, so
# there's no existing 3m/5m signal feed to re-interpret (unlike the
# shadow tracker, which re-anchors entry/stop/tp on signals BOTFINAL
# already produced). This runs its OWN simplified sweep+retest detector
# against real candles at 1m, 3m, and 5m, independently, so the timeframe
# is the only thing that differs between the three runs - not the
# detection logic too, which would make any difference impossible to
# attribute to timeframe alone.
#
# Real tradeoff going in (discussed before building this): a slower
# timeframe should mean a wider, more durable entry zone relative to our
# ~90s execution lag - fewer signals arriving already-stale/MOVED - but
# at the cost of a lot fewer signals overall, wider stops, and zero
# relationship to BOTFINAL's actual validated 76% win rate, which was
# built entirely on 1m data. This is what generates the real numbers to
# weigh that tradeoff with, instead of guessing.
#
# Detector (deliberately simple - a real sweep+reclaim, not BOTFINAL's
# full multi-timeframe/EMA/compression pipeline): on the most recently
# CLOSED candle, did price wick below/above the recent low/high (the raw
# min/max low/high over the lookback window, not a confirmed local
# extremum - see the note on detect_sweep_retest for why) and then CLOSE
# back on the other side of it - a genuine sweep-and-reject shape, not
# just a breakout. Stop beyond the swept extreme (same buffer convention
# as shadow_offset_tracker.py's swing_structure variant), target at a
# fixed 2R (BOTFINAL's own tp1 is consistently ~2R, confirmed earlier
# this session against 8 real signals).

import csv
import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import ccxt
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("timeframe_comparison")

TIMEFRAMES = ["1m", "3m", "5m"]
BASELINE_LOOKBACK = 60  # how far back "recent" liquidity looks - the raw min/max low/high over this window
STOP_BUFFER_PCT = 0.003  # same corrected value as swing_structure - past the hunt zone, not at the line
REWARD_RATIO = 2.0  # matches BOTFINAL's own typical tp1 R, confirmed 2026-08-21 against 8 real signals
FETCH_LIMIT = BASELINE_LOOKBACK + 5
POLL_INTERVAL_SECONDS = 30

# Same tradable/excluded pairs pmt_executor.py already uses - no reason to
# scan pairs we already know aren't tradable on the real account.
PAIRS = [
    "BTC/USDT", "ETH/USDT", "SOL/USDT", "XRP/USDT", "DOGE/USDT", "AVAX/USDT",
    "LINK/USDT", "BNB/USDT", "ADA/USDT", "TRX/USDT", "ARB/USDT", "OP/USDT",
    "SUI/USDT", "NEAR/USDT", "ATOM/USDT", "DOT/USDT", "INJ/USDT", "ONDO/USDT",
    "ICP/USDT", "RENDER/USDT", "WLD/USDT", "TAO/USDT", "UNI/USDT", "AAVE/USDT",
    "JUP/USDT", "PENDLE/USDT", "CRV/USDT", "WIF/USDT", "FIL/USDT", "MINA/USDT",
    "ROSE/USDT", "GALA/USDT", "AXS/USDT", "LTC/USDT", "BCH/USDT", "ETC/USDT",
    "STX/USDT", "TIA/USDT", "JASMY/USDT",
]

LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
SEEN_PATH = LOG_DIR / "tf_comparison_seen.json"
PENDING_PATH = LOG_DIR / "tf_comparison_pending.json"
RESULTS_PATH = LOG_DIR / "tf_comparison_results.csv"

RESULT_FIELDS = [
    "resolved_at", "key", "timeframe", "pair", "direction",
    "entry", "stop", "target", "outcome", "signal_time", "resolved_time",
]

exchange = ccxt.blofin({"enableRateLimit": True, "options": {"defaultType": "swap"}})

FETCH_MAX_RETRIES = 3
FETCH_RETRY_BASE_SECONDS = 3.0


def fetch_ohlcv_safe(symbol, timeframe, limit):
    for attempt in range(FETCH_MAX_RETRIES):
        try:
            return exchange.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)
        except Exception as e:
            if attempt == FETCH_MAX_RETRIES - 1:
                log.error(f"  fetch failed for {symbol} {timeframe} after {FETCH_MAX_RETRIES} tries: {type(e).__name__}")
                return None
            time.sleep(FETCH_RETRY_BASE_SECONDS * (2**attempt))
    return None


def to_symbol(pair: str) -> str:
    base = pair.split("/")[0]
    return f"{base}/USDT:USDT"


def detect_sweep_retest(candles: list) -> dict | None:
    """Checks whether the most recently CLOSED candle is a genuine
    sweep-and-reject: wicks past the recent low/high, then closes back on
    the other side of it. `candles` must be chronological, ending at the
    candle to evaluate.

    CORRECTED before shipping: originally used a symmetric +/-3-candle
    "confirmed local extremum" definition (same as shadow_offset_tracker's
    swing_structure), but that can never detect a level less than 3
    candles old, since it needs confirming candles on BOTH sides - and a
    sweep typically happens shortly after the low forms, before 3 more
    candles have had a chance to confirm it as a "real" swing point. That
    fit swing_structure's use case (anchoring a stop to durable structure)
    but not this one (catching a level right after it forms). Uses the
    raw min/max low/high over the recent lookback instead - simpler, and
    actually matches what "recent liquidity" means for a fresh sweep."""
    if len(candles) < BASELINE_LOOKBACK + 1:
        return None

    history, last = candles[:-1], candles[-1]
    _, o, h, l, c, v = last
    lookback = history[-BASELINE_LOOKBACK:]
    recent_low = min(x[3] for x in lookback)
    recent_high = max(x[2] for x in lookback)

    if l < recent_low and c > recent_low:
        stop = l * (1 - STOP_BUFFER_PCT)
        risk = c - stop
        return {"direction": "Long", "entry": c, "stop": stop, "target": c + risk * REWARD_RATIO}

    if h > recent_high and c < recent_high:
        stop = h * (1 + STOP_BUFFER_PCT)
        risk = stop - c
        return {"direction": "Short", "entry": c, "stop": stop, "target": c - risk * REWARD_RATIO}

    return None


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


def check_pending(pending: dict):
    resolved_keys = []
    for key, trade in pending.items():
        candles = fetch_ohlcv_safe(to_symbol(trade["pair"]), trade["timeframe"], limit=15)
        time.sleep(0.5)
        if not candles:
            continue

        last_checked = trade.get("last_checked_ts", 0)
        new_candles = [c for c in candles if c[0] > last_checked]
        if not new_candles:
            continue

        direction = trade["direction"]
        for c in new_candles:
            ts, o, h, l, close, v = c
            trade["last_checked_ts"] = ts
            stop_hit = h >= trade["stop"] if direction == "Short" else l <= trade["stop"]
            target_hit = l <= trade["target"] if direction == "Short" else h >= trade["target"]
            outcome = "STOPPED" if stop_hit else ("TP1_HIT" if target_hit else None)
            if outcome:
                log.info(f"RESOLVED [{trade['timeframe']}] {trade['pair']} {direction} -> {outcome}")
                append_result({
                    "resolved_at": datetime.now(timezone.utc).isoformat(),
                    "key": key, "timeframe": trade["timeframe"], "pair": trade["pair"],
                    "direction": direction, "entry": trade["entry"], "stop": trade["stop"],
                    "target": trade["target"], "outcome": outcome,
                    "signal_time": trade["signal_time"],
                    "resolved_time": datetime.fromtimestamp(ts / 1000, tz=timezone.utc).isoformat(),
                })
                resolved_keys.append(key)
                break

    for key in resolved_keys:
        pending.pop(key, None)


def run():
    seen = set(load_json(SEEN_PATH, []))
    pending = load_json(PENDING_PATH, {})
    log.info(f"timeframe_comparison started - {len(pending)} trades already pending.")

    while True:
        try:
            for pair in PAIRS:
                symbol = to_symbol(pair)
                for timeframe in TIMEFRAMES:
                    candles = fetch_ohlcv_safe(symbol, timeframe, limit=FETCH_LIMIT)
                    time.sleep(0.3)
                    if not candles or len(candles) < 2:
                        continue
                    closed = candles[:-1]  # drop the still-forming candle
                    if len(closed) < BASELINE_LOOKBACK + 1:
                        continue

                    last_ts = closed[-1][0]
                    key = f"{pair}::{timeframe}::{last_ts}"
                    if key in seen:
                        continue
                    seen.add(key)

                    signal = detect_sweep_retest(closed)
                    if not signal:
                        continue

                    log.info(
                        f"SIGNAL [{timeframe}] {pair} {signal['direction']} "
                        f"entry={signal['entry']:.6g} stop={signal['stop']:.6g} target={signal['target']:.6g}"
                    )
                    pending[key] = {
                        "pair": pair, "timeframe": timeframe, "direction": signal["direction"],
                        "entry": signal["entry"], "stop": signal["stop"], "target": signal["target"],
                        "signal_time": datetime.fromtimestamp(last_ts / 1000, tz=timezone.utc).isoformat(),
                        "last_checked_ts": last_ts,
                    }

            if pending:
                check_pending(pending)

            save_json(SEEN_PATH, list(seen))
            save_json(PENDING_PATH, pending)

        except Exception as e:
            log.error(f"Loop error: {e}")

        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    run()
