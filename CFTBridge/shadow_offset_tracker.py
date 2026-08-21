# shadow_offset_tracker.py
#
# Shadow-tests a "wait for a worse entry, use a wider stop" variant of the
# golden filter against REAL forward price action. No real orders, no
# CFT/PickMyTrade involvement at all - this only reads the same public
# /events feed pmt_executor.py polls and watches BloFin's public market
# data to see what the offset version of each golden signal would have
# done, logging the result for later comparison against the real trades.
#
# Why forward-tracking instead of a backtest: a historical backtest (built
# 2026-08-20, re-fetching BloFin's public candles for already-resolved
# signals) turned out to be untrustworthy - even with clean, fully-returned
# candle data (no rate-limit truncation), re-simulating known-resolved
# signals disagreed with BOTFINAL.py's own recorded outcome on 40% of a
# 20-signal sample. Root cause unconfirmed (most likely candle
# revision/backfill differences between what BOTFINAL.py captured in real
# time and what a later historical re-query returns), but the disagreement
# rate was too high to trust any backtest number built on it - same
# "verify before trust" reasoning that caught the earlier units_per_lot and
# SL/TP-anchoring bugs. Tracking NEW signals forward in real time sidesteps
# the whole question, since the price action is observed live, not
# re-queried after the fact.
#
# Offset design (relative to each signal's own risk distance, not a fixed
# price amount, so it scales across pairs with very different price
# scales):
#   ENTRY_OFFSET_PCT = 0.25 -> require price to move 25% of the original
#     risk distance FURTHER against the trade before counting as "filled"
#     (a deeper retest, not the first touch)
#   STOP_OFFSET_PCT  = 0.50 -> stop placed 50% of the original risk
#     distance further away than the signal's own stop
#   tp1 target is left UNCHANGED - isolates the effect of entry/stop
#   placement on win rate and realized R, same target either way.

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
log = logging.getLogger("shadow_offset_tracker")

LLAB_API_BASE = os.getenv("LLAB_API_BASE", "https://liquidity-lab-api.onrender.com")
POLL_INTERVAL_SECONDS = 30
MAX_SIGNAL_AGE_SECONDS = 300  # same staleness bar as pmt_executor.py
TRACK_MAX_HOURS = 8  # matches BOTFINAL.py's OUTCOME_TRACK_MAX_HOURS

ENTRY_OFFSET_PCT = 0.25
STOP_OFFSET_PCT = 0.50

GOLDEN_EVENT_TYPE = "SWEEP_CONFIRMED"
GOLDEN_PATTERN = "Sweep + Retest"
GOLDEN_SESSIONS = {"London Open", "London", "Asia", "Asia Open", "NY Open", "NY"}
GOLDEN_EXCLUDE_PAIRS = {"SAND/USDT", "SEI/USDT", "APT/USDT"}

LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
SEEN_PATH = LOG_DIR / "shadow_seen_events.json"
PENDING_PATH = LOG_DIR / "shadow_pending.json"
RESULTS_PATH = LOG_DIR / "shadow_results.csv"

RESULT_FIELDS = [
    "resolved_at", "event_id", "pair", "session", "direction",
    "entry", "stop", "tp1", "adj_entry", "adj_stop",
    "outcome", "fill_time", "resolved_time",
]

exchange = ccxt.blofin({"enableRateLimit": True, "options": {"defaultType": "swap"}})


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


def compute_adjusted(direction, entry, stop):
    risk = abs(entry - stop)
    entry_buf = ENTRY_OFFSET_PCT * risk
    stop_buf = STOP_OFFSET_PCT * risk
    if direction == "Short":
        return entry + entry_buf, stop + stop_buf
    return entry - entry_buf, stop - stop_buf


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


def check_pending(pending: dict):
    """One pass over all pending shadow trades - fetch a small recent
    candle window per symbol and advance each trade's state. Mutates
    `pending` in place; resolved trades are logged and removed."""
    resolved_ids = []

    for event_id, trade in pending.items():
        symbol = trade["symbol"]
        try:
            # Small window is enough - we poll every 30s, only new candles
            # since the last check matter. 15 candles of slack covers any
            # gap from a slow cycle or a brief restart.
            candles = exchange.fetch_ohlcv(symbol, timeframe="1m", limit=15)
            time.sleep(0.5)
        except Exception as e:
            log.error(f"  fetch failed for {symbol}: {e}")
            continue

        last_checked = trade.get("last_checked_ts", 0)
        new_candles = [c for c in candles if c[0] > last_checked]
        if not new_candles:
            continue

        direction = trade["direction"]
        for c in new_candles:
            ts, o, h, l, close, v = c
            trade["last_checked_ts"] = ts

            if trade["status"] == "WAITING_FILL":
                touched = h >= trade["adj_entry"] if direction == "Short" else l <= trade["adj_entry"]
                if touched:
                    trade["status"] = "FILLED"
                    trade["fill_time"] = datetime.fromtimestamp(ts / 1000, tz=timezone.utc).isoformat()
                else:
                    continue  # still waiting, check next candle

            if trade["status"] == "FILLED":
                stop_hit = h >= trade["adj_stop"] if direction == "Short" else l <= trade["adj_stop"]
                tp1_hit = l <= trade["tp1"] if direction == "Short" else h >= trade["tp1"]
                outcome = None
                if stop_hit:
                    outcome = "STOPPED"
                elif tp1_hit:
                    outcome = "TP1_HIT"
                if outcome:
                    log.info(f"RESOLVED {trade['pair']} {direction} -> {outcome}")
                    append_result({
                        "resolved_at": datetime.now(timezone.utc).isoformat(),
                        "event_id": event_id,
                        "pair": trade["pair"],
                        "session": trade["session"],
                        "direction": direction,
                        "entry": trade["entry"],
                        "stop": trade["stop"],
                        "tp1": trade["tp1"],
                        "adj_entry": trade["adj_entry"],
                        "adj_stop": trade["adj_stop"],
                        "outcome": outcome,
                        "fill_time": trade.get("fill_time", ""),
                        "resolved_time": datetime.fromtimestamp(ts / 1000, tz=timezone.utc).isoformat(),
                    })
                    resolved_ids.append(event_id)
                    break

        age_hours = (time.time() * 1000 - trade["created_ms"]) / 3_600_000
        if event_id not in resolved_ids and age_hours >= TRACK_MAX_HOURS:
            outcome = "NO_FILL" if trade["status"] == "WAITING_FILL" else "EXPIRED"
            log.info(f"RESOLVED {trade['pair']} {direction} -> {outcome} (timed out)")
            append_result({
                "resolved_at": datetime.now(timezone.utc).isoformat(),
                "event_id": event_id,
                "pair": trade["pair"],
                "session": trade["session"],
                "direction": direction,
                "entry": trade["entry"],
                "stop": trade["stop"],
                "tp1": trade["tp1"],
                "adj_entry": trade["adj_entry"],
                "adj_stop": trade["adj_stop"],
                "outcome": outcome,
                "fill_time": trade.get("fill_time", ""),
                "resolved_time": datetime.now(timezone.utc).isoformat(),
            })
            resolved_ids.append(event_id)

    for event_id in resolved_ids:
        pending.pop(event_id, None)


def run():
    seen = set(load_json(SEEN_PATH, []))
    pending = load_json(PENDING_PATH, {})
    log.info(f"shadow_offset_tracker started - {len(pending)} trades already pending.")

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
                if entry is None or stop is None or tp1 is None:
                    continue

                adj_entry, adj_stop = compute_adjusted(direction, entry, stop)
                pending[event_id] = {
                    "pair": pair,
                    "symbol": to_symbol(pair),
                    "session": event.get("session"),
                    "direction": direction,
                    "entry": entry,
                    "stop": stop,
                    "tp1": tp1,
                    "adj_entry": adj_entry,
                    "adj_stop": adj_stop,
                    "status": "WAITING_FILL",
                    "created_ms": int(datetime.now(timezone.utc).timestamp() * 1000),
                    "last_checked_ts": 0,
                }
                log.info(
                    f"TRACKING {pair} {direction} entry={entry} adj_entry={adj_entry:.6g} "
                    f"stop={stop} adj_stop={adj_stop:.6g} tp1={tp1}"
                )

            if pending:
                check_pending(pending)

            save_json(SEEN_PATH, list(seen))
            save_json(PENDING_PATH, pending)

        except Exception as e:
            log.error(f"Loop error: {e}")

        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    run()
