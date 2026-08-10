# ftmo_executor.py
#
# Polls Liquidity Lab's public /events feed for "golden" signals (the same
# stacked filter shown in Signal Quality: SWEEP_CONFIRMED + Sweep + Retest +
# a prime session, excluding SAND/USDT) and auto-executes them on an FTMO
# demo account via MetaApi, so the backtested edge can be tested under real
# execution conditions instead of just shadow-tracked outcome data.
#
# Only the pairs FTMO's crypto CFD list actually overlaps with this bot's
# scan list get traded (PAIR_TO_FTMO_SYMBOL below) - everything else is
# skipped, not executed.
#
# Setup required before this can run against a live account:
#   1. Open an FTMO demo challenge account ($100k, standard rules).
#   2. Sign up for MetaApi (metaapi.cloud) and connect the FTMO demo
#      account's MT4/MT5 login to it.
#   3. Confirm the exact symbol strings your account's Market Watch shows
#      for each pair below - broker feeds sometimes add suffixes (e.g.
#      "BTCUSD.f") that differ from the plain name assumed here.
#   4. Copy .env.example to .env and fill in METAAPI_TOKEN / METAAPI_ACCOUNT_ID.

import asyncio
import csv
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger("ftmo_executor")

# ---------------- CONFIG ----------------

LLAB_API_BASE = os.getenv("LLAB_API_BASE", "https://liquidity-lab-api.onrender.com")
METAAPI_TOKEN = os.getenv("METAAPI_TOKEN", "")
METAAPI_ACCOUNT_ID = os.getenv("METAAPI_ACCOUNT_ID", "")

ACCOUNT_SIZE = float(os.getenv("ACCOUNT_SIZE", "100000"))
MAX_RISK_PCT = float(os.getenv("MAX_RISK_PCT", "0.01"))  # matches FTMO-style preset in App.jsx
DAILY_LOSS_LIMIT_PCT = float(os.getenv("DAILY_LOSS_LIMIT_PCT", "0.05"))
MAX_DRAWDOWN_PCT = float(os.getenv("MAX_DRAWDOWN_PCT", "0.10"))
# Stop taking new trades once this fraction of a limit is used, not just at
# 100% of it - a buffer so the bridge itself doesn't cause the breach.
CIRCUIT_BREAKER_BUFFER = float(os.getenv("CIRCUIT_BREAKER_BUFFER", "0.8"))

POLL_INTERVAL_SECONDS = int(os.getenv("POLL_INTERVAL_SECONDS", "20"))
POSITION_POLL_INTERVAL_SECONDS = int(os.getenv("POSITION_POLL_INTERVAL_SECONDS", "60"))

LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
TRADE_LOG_PATH = LOG_DIR / "ftmo_trades.csv"
SEEN_EVENTS_PATH = LOG_DIR / "seen_events.json"
OPEN_POSITIONS_PATH = LOG_DIR / "open_positions.json"

TRADE_LOG_FIELDS = [
    "logged_at", "event_id", "pair", "ftmo_symbol", "direction",
    "entry", "stop", "tp1", "lot_size", "risk_amount", "order_id",
    "status", "close_price", "realized_r", "closed_at",
]

# ---------------- GOLDEN FILTER ----------------
# Mirrors server.js's `golden` stats filter and App.jsx's confirmed-stage
# gating exactly - keep these in sync if either side changes.

GOLDEN_EVENT_TYPE = "SWEEP_CONFIRMED"
GOLDEN_PATTERN = "Sweep + Retest"
GOLDEN_SESSIONS = {"London Open", "Asia", "NY Open"}
GOLDEN_EXCLUDE_PAIRS = {"SAND/USDT"}

# Only pairs confirmed on FTMO's crypto CFD list. VERIFY the exact symbol
# strings against your own demo account's Market Watch before trusting
# this mapping - see setup note at the top of this file.
PAIR_TO_FTMO_SYMBOL = {
    "BTC/USDT": "BTCUSD",
    "ETH/USDT": "ETHUSD",
    "ADA/USDT": "ADAUSD",
    "DOT/USDT": "DOTUSD",
    "LTC/USDT": "LTCUSD",
    "XRP/USDT": "XRPUSD",
    "DOGE/USDT": "DOGEUSD",
    "SOL/USDT": "SOLUSD",
    "BNB/USDT": "BNBUSD",
    "AAVE/USDT": "AAVEUSD",
    "LINK/USDT": "LINKUSD",
}


# ---------------- PURE LOGIC (testable without a live MetaApi connection) ----------------

def is_golden(event: dict) -> bool:
    """Same criteria as the dashboard's "golden" stacked filter."""
    return (
        event.get("eventType") == GOLDEN_EVENT_TYPE
        and event.get("pattern") == GOLDEN_PATTERN
        and event.get("session") in GOLDEN_SESSIONS
        and event.get("pair") not in GOLDEN_EXCLUDE_PAIRS
    )


def map_symbol(pair: str) -> str | None:
    """FTMO symbol for a pair, or None if it isn't tradable there."""
    return PAIR_TO_FTMO_SYMBOL.get(pair)


def compute_lot_size(
    entry: float,
    stop: float,
    account_size: float,
    risk_pct: float,
    tick_size: float,
    tick_value: float,
) -> float:
    """
    Standard broker-agnostic lot-sizing formula:
      risk_amount = account_size * risk_pct
      price_distance = |entry - stop|
      ticks_at_risk = price_distance / tick_size
      dollars_at_risk_per_lot = ticks_at_risk * tick_value
      lots = risk_amount / dollars_at_risk_per_lot

    tick_size/tick_value must come from MetaApi's live symbol specification
    for the instrument (get_symbol_specification) - crypto CFD contract
    conventions vary by broker and aren't safe to hardcode.
    """
    if tick_size <= 0 or tick_value <= 0:
        raise ValueError("tick_size and tick_value must be positive")
    price_distance = abs(entry - stop)
    if price_distance <= 0:
        raise ValueError("entry and stop cannot be equal")
    risk_amount = account_size * risk_pct
    ticks_at_risk = price_distance / tick_size
    dollars_at_risk_per_lot = ticks_at_risk * tick_value
    return risk_amount / dollars_at_risk_per_lot


def realized_r(entry: float, stop: float, close_price: float, direction: str) -> float | None:
    """R-multiple realized on a closed trade, matching server.js's realizedR."""
    risk = abs(entry - stop)
    if risk <= 0:
        return None
    if direction == "Long":
        return (close_price - entry) / risk
    return (entry - close_price) / risk


# ---------------- STATE (seen events, open positions) ----------------

def load_seen_events() -> set:
    if not SEEN_EVENTS_PATH.exists():
        return set()
    try:
        return set(json.loads(SEEN_EVENTS_PATH.read_text()))
    except Exception:
        return set()


def save_seen_events(seen: set) -> None:
    # Cap growth - only need recent history to avoid re-firing on restart.
    trimmed = list(seen)[-2000:]
    SEEN_EVENTS_PATH.write_text(json.dumps(trimmed))


def load_open_positions() -> dict:
    if not OPEN_POSITIONS_PATH.exists():
        return {}
    try:
        return json.loads(OPEN_POSITIONS_PATH.read_text())
    except Exception:
        return {}


def save_open_positions(positions: dict) -> None:
    OPEN_POSITIONS_PATH.write_text(json.dumps(positions))


def append_trade_log(row: dict) -> None:
    is_new = not TRADE_LOG_PATH.exists()
    with open(TRADE_LOG_PATH, "a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=TRADE_LOG_FIELDS)
        if is_new:
            writer.writeheader()
        writer.writerow({k: row.get(k, "") for k in TRADE_LOG_FIELDS})


# ---------------- CIRCUIT BREAKER ----------------

class CircuitBreaker:
    """
    Local safety net on top of (not instead of) FTMO's own platform-level
    daily-loss/max-drawdown enforcement. Tracks day-start and initial
    balance to decide whether new entries should be blocked.
    """

    def __init__(self, initial_balance: float):
        self.initial_balance = initial_balance
        self.day_start_balance = initial_balance
        self.current_day = datetime.now(timezone.utc).date()

    def _roll_day_if_needed(self, now_balance: float) -> None:
        today = datetime.now(timezone.utc).date()
        if today != self.current_day:
            self.current_day = today
            self.day_start_balance = now_balance

    def allows_new_trade(self, current_balance: float) -> tuple[bool, str]:
        self._roll_day_if_needed(current_balance)

        daily_loss = self.day_start_balance - current_balance
        daily_loss_limit = self.day_start_balance * DAILY_LOSS_LIMIT_PCT
        if daily_loss_limit > 0 and daily_loss >= daily_loss_limit * CIRCUIT_BREAKER_BUFFER:
            return False, (
                f"daily loss {daily_loss:.2f} is within {CIRCUIT_BREAKER_BUFFER:.0%} "
                f"of the {daily_loss_limit:.2f} daily limit"
            )

        total_drawdown = self.initial_balance - current_balance
        max_drawdown_limit = self.initial_balance * MAX_DRAWDOWN_PCT
        if max_drawdown_limit > 0 and total_drawdown >= max_drawdown_limit * CIRCUIT_BREAKER_BUFFER:
            return False, (
                f"total drawdown {total_drawdown:.2f} is within {CIRCUIT_BREAKER_BUFFER:.0%} "
                f"of the {max_drawdown_limit:.2f} max drawdown limit"
            )

        return True, ""


# ---------------- SIGNAL FETCHING ----------------

def fetch_events() -> list[dict]:
    try:
        resp = requests.get(f"{LLAB_API_BASE}/events", timeout=10)
        resp.raise_for_status()
        data = resp.json()
        return data.get("events", data if isinstance(data, list) else [])
    except Exception as e:
        log.error(f"Failed to fetch /events: {e}")
        return []


# ---------------- MAIN LOOP ----------------

async def run():
    if not METAAPI_TOKEN or not METAAPI_ACCOUNT_ID:
        log.error(
            "METAAPI_TOKEN / METAAPI_ACCOUNT_ID not set - copy .env.example to "
            ".env and fill these in once your FTMO demo account is connected "
            "to MetaApi. Exiting rather than crash-looping."
        )
        return

    # Imported here so the pure-logic functions above can be tested/imported
    # without the metaapi-cloud-sdk package installed.
    from metaapi_cloud_sdk import MetaApi

    api = MetaApi(METAAPI_TOKEN)
    account = await api.metatrader_account_api.get_account(METAAPI_ACCOUNT_ID)
    log.info(f"Connecting to MetaApi account {METAAPI_ACCOUNT_ID}...")
    await account.wait_connected()
    connection = account.get_rpc_connection()
    await connection.connect()
    await connection.wait_synchronized()
    log.info("Connected and synchronized.")

    account_info = await connection.get_account_information()
    breaker = CircuitBreaker(initial_balance=account_info["balance"])

    seen_events = load_seen_events()
    open_positions = load_open_positions()

    last_position_check = 0.0

    while True:
        try:
            events = fetch_events()
            for event in events:
                event_id = event.get("id")
                if not event_id or event_id in seen_events:
                    continue

                if not is_golden(event):
                    continue

                seen_events.add(event_id)
                save_seen_events(seen_events)

                pair = event.get("pair")
                ftmo_symbol = map_symbol(pair)
                if not ftmo_symbol:
                    log.info(f"Skipping {pair} - not tradable at FTMO")
                    continue

                entry = event.get("entry")
                stop = event.get("stop")
                tp1 = event.get("tp1")
                direction = event.get("directionBias")
                if entry is None or stop is None or tp1 is None:
                    log.warning(f"Skipping {event_id} - missing entry/stop/tp1")
                    continue

                account_info = await connection.get_account_information()
                current_balance = account_info["balance"]
                allowed, reason = breaker.allows_new_trade(current_balance)
                if not allowed:
                    log.warning(f"Circuit breaker blocked {pair}: {reason}")
                    continue

                spec = await connection.get_symbol_specification(ftmo_symbol)
                tick_size = spec.get("tickSize")
                tick_value = spec.get("tickValue")

                try:
                    lot_size = compute_lot_size(
                        entry, stop, ACCOUNT_SIZE, MAX_RISK_PCT, tick_size, tick_value
                    )
                except ValueError as e:
                    log.warning(f"Skipping {event_id} - bad lot size inputs: {e}")
                    continue

                is_long = direction == "Long"
                log.info(
                    f"GOLDEN SIGNAL: {pair} -> {ftmo_symbol} {direction} "
                    f"entry={entry} stop={stop} tp1={tp1} lots={lot_size:.2f}"
                )

                if is_long:
                    result = await connection.create_market_buy_order(
                        ftmo_symbol, lot_size, stop, tp1,
                        {"comment": f"LLAB-golden-{event_id[:16]}"},
                    )
                else:
                    result = await connection.create_market_sell_order(
                        ftmo_symbol, lot_size, stop, tp1,
                        {"comment": f"LLAB-golden-{event_id[:16]}"},
                    )

                order_id = result.get("orderId") or result.get("positionId")
                append_trade_log({
                    "logged_at": datetime.now(timezone.utc).isoformat(),
                    "event_id": event_id,
                    "pair": pair,
                    "ftmo_symbol": ftmo_symbol,
                    "direction": direction,
                    "entry": entry,
                    "stop": stop,
                    "tp1": tp1,
                    "lot_size": round(lot_size, 4),
                    "risk_amount": round(ACCOUNT_SIZE * MAX_RISK_PCT, 2),
                    "order_id": order_id,
                    "status": "OPEN",
                })
                if order_id:
                    open_positions[order_id] = {
                        "event_id": event_id, "pair": pair, "entry": entry,
                        "stop": stop, "direction": direction,
                    }
                    save_open_positions(open_positions)

            # Periodically check open positions for closure and log outcomes.
            now = asyncio.get_event_loop().time()
            if open_positions and now - last_position_check > POSITION_POLL_INTERVAL_SECONDS:
                last_position_check = now
                live_positions = await connection.get_positions()
                live_ids = {p["id"] for p in live_positions}
                closed_ids = [oid for oid in open_positions if oid not in live_ids]
                for oid in closed_ids:
                    meta = open_positions.pop(oid)
                    log.info(f"Position {oid} ({meta['pair']}) closed - check MT5 history for close price")
                    # MetaApi's history API can supply the exact close price/
                    # time via connection.get_deals_by_time_range - left as a
                    # follow-up once the basic loop is proven correct, so the
                    # CSV's "status" column is at minimum flipped to CLOSED
                    # promptly and can be reconciled against MT5 history.
                    append_trade_log({
                        "logged_at": datetime.now(timezone.utc).isoformat(),
                        "event_id": meta["event_id"],
                        "pair": meta["pair"],
                        "order_id": oid,
                        "status": "CLOSED",
                        "closed_at": datetime.now(timezone.utc).isoformat(),
                    })
                save_open_positions(open_positions)

        except Exception as e:
            log.error(f"Loop error: {e}")

        await asyncio.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    asyncio.run(run())
