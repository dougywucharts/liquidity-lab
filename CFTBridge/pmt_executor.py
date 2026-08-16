# pmt_executor.py
#
# Polls Liquidity Lab's public /events feed for "golden" signals (same
# stacked filter as everywhere else: SWEEP_CONFIRMED + Sweep + Retest + a
# prime session, excluding SAND/SEI/APT) and forwards them to PickMyTrade's
# webhook, which executes them on the real Crypto Fund Trader (CFT)
# Match-Trader evaluation account (400251).
#
# Why PickMyTrade and not a direct Match-Trader API integration: CFT's own
# Match-Trader deployment (trading.cryptofundtrader.com) sits behind an
# aggressive Cloudflare managed challenge that blocks non-browser access
# even with fully valid, real auth headers/cookies (confirmed directly by
# replaying a genuine browser request via curl - it still got challenged).
# PickMyTrade has a working, first-party-supported connection to this exact
# account (confirmed live: the Matchtrader Connection indicator went green
# after entering real credentials), so it's the actual sanctioned path
# rather than something we'd have to build bypass tooling for ourselves.
#
# Position sizing: PickMyTrade's `quantity` field for Match-Trader is a
# fixed number of LOTS, not base-asset units or a dollar notional (confirmed
# directly by PickMyTrade support). Crucially, "1 lot" is NOT a universal
# constant - it varies per instrument. Confirmed via CFT's own Symbol Info
# panel for every tradable pair: e.g. 1 lot of BTC = 1 BTC, but 1 lot of
# JASMY = 10,000 JASMY. The ratio is derivable as (Point Value of 1 Lot) /
# (Point Size) - verified self-consistent against CFT's own TradingView-
# compatible resolve_symbol endpoint's `pointvalue` field for BTC. See
# UNITS_PER_LOT below for the full table, gathered by hand from CFT's own
# terminal since there's no API we can reach to fetch it live (same
# Cloudflare wall).
#
# Special case: PEPE, BONK, and FLOKI are only listed on CFT under a
# "1000X" naming convention (e.g. "1000PEPEUSDT.cft") - the quoted price is
# for 1000 tokens, not 1. Entry/stop/tp prices for these three must be
# multiplied by 1000 before sending. See THOUSAND_X_PAIRS below.
#
# Setup required before this can run for real:
#   1. Set up a PickMyTrade "Generate Alert" for MATCHTRADER / STRATEGY /
#      CFD / "Attach SL/TP to Orders" / PRICE (From TradingView) mode - the
#      PRICE mode's `sl`/`tp` fields accept literal numbers directly
#      (confirmed by PickMyTrade support), no real TradingView chart needed
#      since we're POSTing to the webhook ourselves, not going through
#      TradingView's alert engine.
#   2. Copy .env.example to .env and fill in PICKMYTRADE_WEBHOOK_URL and
#      PICKMYTRADE_TOKEN from that generated alert - never commit these.

import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger("pmt_executor")

# ---------------- CONFIG ----------------

LLAB_API_BASE = os.getenv("LLAB_API_BASE", "https://liquidity-lab-api.onrender.com")
PICKMYTRADE_WEBHOOK_URL = os.getenv("PICKMYTRADE_WEBHOOK_URL", "")
PICKMYTRADE_TOKEN = os.getenv("PICKMYTRADE_TOKEN", "")
MATCHTRADER_CONNECTION_NAME = os.getenv("MATCHTRADER_CONNECTION_NAME", "MATCHTRADER1")
MATCHTRADER_ACCOUNT_ID = os.getenv("MATCHTRADER_ACCOUNT_ID", "400251")

# Fixed dollar amount risked per real order - same reasoning as
# BlofinBridge: keeps every order small and bounded regardless of account
# balance, since the point here is proving the pipeline + comparing real
# execution against the simulator, not simulating balance growth.
RISK_AMOUNT_USD = float(os.getenv("RISK_AMOUNT_USD", "25"))

# Skip signals this stale by the time we'd place the order - same
# reasoning as BlofinBridge: an old entry/stop/tp1 may no longer reflect a
# valid trade.
MAX_SIGNAL_AGE_SECONDS = int(os.getenv("MAX_SIGNAL_AGE_SECONDS", "300"))

POLL_INTERVAL_SECONDS = int(os.getenv("POLL_INTERVAL_SECONDS", "20"))

LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
TRADE_LOG_PATH = LOG_DIR / "pmt_trades.csv"
SEEN_EVENTS_PATH = LOG_DIR / "seen_events.json"

TRADE_LOG_FIELDS = [
    "logged_at", "event_id", "pair", "cft_symbol", "direction",
    "entry", "stop", "tp1", "lots", "risk_amount_usd", "status", "response",
]

# ---------------- GOLDEN FILTER (mirrors server.js exactly) ----------------

GOLDEN_EVENT_TYPE = "SWEEP_CONFIRMED"
GOLDEN_PATTERN = "Sweep + Retest"
GOLDEN_SESSIONS = {"London Open", "Asia", "NY Open"}
GOLDEN_EXCLUDE_PAIRS = {"SAND/USDT", "SEI/USDT", "APT/USDT"}


def is_golden(event: dict) -> bool:
    """Same criteria as the dashboard's "golden" stacked filter."""
    return (
        event.get("eventType") == GOLDEN_EVENT_TYPE
        and event.get("pattern") == GOLDEN_PATTERN
        and event.get("session") in GOLDEN_SESSIONS
        and event.get("pair") not in GOLDEN_EXCLUDE_PAIRS
    )


# ---------------- CFT/MATCH-TRADER INSTRUMENT DATA ----------------
# Gathered by hand from CFT's own Symbol Info panel (trading.cryptofundtrader.com)
# on 2026-08-16 - no reachable API for this given the Cloudflare wall.
# Pairs not listed on CFT at all get skipped entirely (NOT_LISTED_ON_CFT).

NOT_LISTED_ON_CFT = {"FTM/USDT", "FET/USDT"}

# Pairs only listed under a "1000X" naming convention - price is quoted per
# 1000 tokens, so entry/stop/tp must be multiplied by 1000 before sending.
THOUSAND_X_PAIRS = {
    "PEPE/USDT": "1000PEPEUSDT.cft",
    "BONK/USDT": "1000BONKUSDT.cft",
    "FLOKI/USDT": "1000FLOKIUSDT.cft",
}

# units_per_lot = (Point Value of 1 Lot) / (Point Size), per-instrument -
# NOT a universal constant. Verified self-consistent against CFT's own
# resolve_symbol API `pointvalue` field for BTC (both gave 1).
UNITS_PER_LOT = {
    "BTC/USDT": 1, "ETH/USDT": 1, "SOL/USDT": 1, "XRP/USDT": 100,
    "DOGE/USDT": 1000, "AVAX/USDT": 10, "LINK/USDT": 10, "BNB/USDT": 1,
    "ADA/USDT": 100, "TRX/USDT": 1000, "ARB/USDT": 100, "OP/USDT": 100,
    "SUI/USDT": 100, "NEAR/USDT": 10, "ATOM/USDT": 10, "DOT/USDT": 100,
    "INJ/USDT": 10, "ONDO/USDT": 100, "ICP/USDT": 10, "RENDER/USDT": 10,
    "WLD/USDT": 100, "TAO/USDT": 1, "AIOZ/USDT": 100, "UNI/USDT": 10,
    "AAVE/USDT": 1, "JUP/USDT": 100, "PENDLE/USDT": 100, "CRV/USDT": 100,
    "PEPE/USDT": 10000, "WIF/USDT": 100, "BONK/USDT": 10000,
    "FLOKI/USDT": 1000, "FIL/USDT": 10, "KAS/USDT": 1000, "MINA/USDT": 100,
    "ROSE/USDT": 1000, "IMX/USDT": 100, "GALA/USDT": 10000, "AXS/USDT": 10,
    "LTC/USDT": 1, "BCH/USDT": 1, "ETC/USDT": 10, "STX/USDT": 100,
    "TIA/USDT": 10, "JASMY/USDT": 10000,
}

# Min. Position Size (lots) per instrument, from the same Symbol Info panel -
# the floor a computed lot size gets clamped to.
MIN_LOTS = {
    "BTC/USDT": 0.001, "ETH/USDT": 0.01, "SOL/USDT": 0.1, "XRP/USDT": 0.1,
    "DOGE/USDT": 1, "AVAX/USDT": 0.1, "LINK/USDT": 0.1, "BNB/USDT": 0.01,
    "ADA/USDT": 1, "TRX/USDT": 1, "ARB/USDT": 0.1, "OP/USDT": 0.1,
    "SUI/USDT": 10, "NEAR/USDT": 0.1, "ATOM/USDT": 0.1, "DOT/USDT": 0.1,
    "INJ/USDT": 0.1, "ONDO/USDT": 1, "ICP/USDT": 0.1, "RENDER/USDT": 0.1,
    "WLD/USDT": 0.1, "TAO/USDT": 0.001, "AIOZ/USDT": 1, "UNI/USDT": 0.1,
    "AAVE/USDT": 0.01, "JUP/USDT": 1, "PENDLE/USDT": 1, "CRV/USDT": 0.1,
    "PEPE/USDT": 100, "WIF/USDT": 1, "BONK/USDT": 100, "FLOKI/USDT": 1,
    "FIL/USDT": 0.1, "KAS/USDT": 10, "MINA/USDT": 0.1, "ROSE/USDT": 1,
    "IMX/USDT": 0.1, "GALA/USDT": 1, "AXS/USDT": 0.1, "LTC/USDT": 0.1,
    "BCH/USDT": 0.01, "ETC/USDT": 0.1, "STX/USDT": 0.1, "TIA/USDT": 0.1,
    "JASMY/USDT": 1,
}


# ---------------- PURE LOGIC (testable without network access) ----------------

def map_symbol(pair: str) -> str | None:
    """Liquidity Lab pair (e.g. "BTC/USDT") -> CFT Match-Trader symbol
    (e.g. "BTCUSDT.cft"), or None if not tradable on CFT at all."""
    if pair in NOT_LISTED_ON_CFT:
        return None
    if pair in THOUSAND_X_PAIRS:
        return THOUSAND_X_PAIRS[pair]
    base = pair.split("/")[0]
    return f"{base}USDT.cft"


def price_multiplier(pair: str) -> int:
    """1000 for the THOUSAND_X_PAIRS (quoted per 1000 tokens), else 1."""
    return 1000 if pair in THOUSAND_X_PAIRS else 1


def compute_lots(entry: float, stop: float, risk_amount_usd: float, units_per_lot: float, min_lots: float) -> float:
    """
    lots = risk_amount / (price_distance * units_per_lot)
    Same shape as BlofinBridge's compute_contract_size, just with CFT's
    per-instrument units-per-lot instead of ccxt's contractSize. Floors at
    the instrument's minimum lot size rather than rounding to zero.
    """
    price_distance = abs(entry - stop)
    if price_distance <= 0:
        raise ValueError("entry and stop cannot be equal (zero risk)")
    raw_lots = risk_amount_usd / (price_distance * units_per_lot)
    return max(raw_lots, min_lots)


def build_alert_payload(pair: str, direction: str, entry: float, stop: float, tp1: float, lots: float) -> dict:
    """Builds the PickMyTrade alert JSON, matching exactly the schema
    generated by their "Generate Alert" UI for this MATCHTRADER/STRATEGY/
    CFD/PRICE-mode alert - only the per-signal fields (symbol, data,
    quantity, price, tp, sl) are substituted; everything else matches the
    generated template's defaults."""
    symbol = map_symbol(pair)
    mult = price_multiplier(pair)
    return {
        "strategy_name": "liquidity-lab-sweep-retest",
        "symbol": symbol,
        "date": datetime.now(timezone.utc).isoformat(),
        "data": "long" if direction == "Long" else "short",
        "quantity": round(lots, 8),
        "price": entry * mult,
        "tp": tp1 * mult,
        "percentage_tp": 0,
        "dollar_tp": 0,
        "sl": stop * mult,
        "dollar_sl": 0,
        "percentage_sl": 0,
        "token": PICKMYTRADE_TOKEN,
        "duplicate_position_allow": False,
        "platform": "MATCHTRADER",
        "order_type": "MARKET",
        "inst_type": "CFD",
        "place_order_at": "away_strike",
        "pyramid": False,
        "reverse_order_close": True,
        "trail": 0,
        "trail_trigger": 0,
        "multiple_accounts": [
            {
                "token": PICKMYTRADE_TOKEN,
                "connection_name": MATCHTRADER_CONNECTION_NAME,
                "account_id": MATCHTRADER_ACCOUNT_ID,
                "risk_percentage": 0,
                "quantity_multiplier": 1,
            }
        ],
    }


# ---------------- I/O ----------------

def fetch_events() -> list[dict]:
    try:
        resp = requests.get(f"{LLAB_API_BASE}/events", timeout=10)
        resp.raise_for_status()
        data = resp.json()
        return data.get("events", data if isinstance(data, list) else [])
    except Exception as e:
        log.error(f"Failed to fetch /events: {e}")
        return []


def load_seen_events() -> set:
    if SEEN_EVENTS_PATH.exists():
        return set(json.loads(SEEN_EVENTS_PATH.read_text()))
    return set()


def save_seen_events(seen: set) -> None:
    SEEN_EVENTS_PATH.write_text(json.dumps(list(seen)))


def append_trade_log(row: dict) -> None:
    import csv
    is_new = not TRADE_LOG_PATH.exists()
    with open(TRADE_LOG_PATH, "a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=TRADE_LOG_FIELDS)
        if is_new:
            writer.writeheader()
        writer.writerow({k: row.get(k, "") for k in TRADE_LOG_FIELDS})


def send_alert(payload: dict) -> tuple[bool, str]:
    try:
        resp = requests.post(PICKMYTRADE_WEBHOOK_URL, json=payload, timeout=15)
        return resp.ok, resp.text[:500]
    except Exception as e:
        return False, str(e)


# ---------------- MAIN LOOP ----------------

def run():
    if not PICKMYTRADE_WEBHOOK_URL or not PICKMYTRADE_TOKEN:
        log.error(
            "PICKMYTRADE_WEBHOOK_URL / PICKMYTRADE_TOKEN not set - generate "
            "a MATCHTRADER alert in PickMyTrade, copy .env.example to .env, "
            "fill these in. Exiting rather than crash-looping."
        )
        return

    seen_events = load_seen_events()
    log.info("pmt_executor started - polling for golden signals.")

    while True:
        try:
            events = fetch_events()
            for event in events:
                event_id = event.get("id")
                if not event_id or event_id in seen_events:
                    continue

                if not is_golden(event):
                    continue

                pair = event.get("pair")
                symbol = map_symbol(pair)
                if symbol is None:
                    log.info(f"Skipping {event_id} - {pair} not listed on CFT")
                    seen_events.add(event_id)
                    save_seen_events(seen_events)
                    continue

                seen_events.add(event_id)
                save_seen_events(seen_events)

                timestamp_utc = event.get("timestampUtc")
                if timestamp_utc:
                    event_time = datetime.fromisoformat(timestamp_utc.replace("Z", "+00:00"))
                    age_seconds = (datetime.now(timezone.utc) - event_time).total_seconds()
                    if age_seconds > MAX_SIGNAL_AGE_SECONDS:
                        log.info(f"Skipping {event_id} - stale ({age_seconds:.0f}s old)")
                        continue

                direction = event.get("directionBias")
                entry = event.get("entry")
                stop = event.get("stop")
                tp1 = event.get("tp1")
                if entry is None or stop is None or tp1 is None:
                    log.warning(f"Skipping {event_id} - missing entry/stop/tp1")
                    continue

                try:
                    lots = compute_lots(
                        entry, stop, RISK_AMOUNT_USD,
                        UNITS_PER_LOT[pair], MIN_LOTS[pair],
                    )
                except (ValueError, KeyError) as e:
                    log.warning(f"Skipping {event_id} - {e}")
                    continue

                log.info(
                    f"GOLDEN SIGNAL: {pair} -> {symbol} {direction} "
                    f"entry={entry} stop={stop} tp1={tp1} lots={lots}"
                )

                payload = build_alert_payload(pair, direction, entry, stop, tp1, lots)
                ok, response_text = send_alert(payload)

                if ok:
                    log.info(f"{event_id} sent to PickMyTrade successfully.")
                else:
                    log.error(f"{event_id} FAILED to send to PickMyTrade: {response_text}")

                append_trade_log({
                    "logged_at": datetime.now(timezone.utc).isoformat(),
                    "event_id": event_id,
                    "pair": pair,
                    "cft_symbol": symbol,
                    "direction": direction,
                    "entry": entry,
                    "stop": stop,
                    "tp1": tp1,
                    "lots": lots,
                    "risk_amount_usd": RISK_AMOUNT_USD,
                    "status": "SENT" if ok else "FAILED",
                    "response": response_text,
                })

        except Exception as e:
            log.error(f"Loop error: {e}")

        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    run()
