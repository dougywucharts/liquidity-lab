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
# directly by PickMyTrade support).
#
# CORRECTED 2026-08-17: originally assumed units-per-lot varied per
# instrument, derived as (Point Value of 1 Lot) / (Point Size) read off
# CFT's Symbol Info panel. That formula was WRONG - confirmed by
# back-calculating real units-per-lot from 5 actually-executed closed
# trades (UNI, XRP, NEAR, PENDLE, WLD), spanning old table values of both
# 10 and 100. Every single one converged on ~1, not the table's value -
# actual realized risk was running at roughly 2-15% of the intended $25,
# not dangerously oversized (unlike the earlier BlofinBridge/KAS incident),
# but wrong. PickMyTrade's own pre-existing Settings entries also showed
# "Lot Size: 1" uniformly for every symbol checked, which I should have
# trusted over my own derivation. units_per_lot is now a flat constant (1)
# instead of a per-pair table - see UNITS_PER_LOT below.
#
# This is NOT verified for the THOUSAND_X_PAIRS (PEPE/BONK/FLOKI) or other
# very-low-unit-price pairs, where a wrong assumption would produce a huge
# lot count - MAX_LOTS below is a hard safety cap that skips (rather than
# sends) any computed size large enough to suggest the sizing assumption
# doesn't hold for that pair, instead of trusting an unverified formula.
#
# Special case: PEPE, BONK, and FLOKI are only listed on CFT under a
# "1000X" naming convention (e.g. "1000PEPEUSDT.cft") - the quoted price is
# for 1000 tokens, not 1. Entry/stop/tp prices for these three must be
# multiplied by 1000 before sending. See THOUSAND_X_PAIRS below.
#
# Setup required before this can run for real:
#   1. Set up a PickMyTrade "Generate Alert" for MATCHTRADER / STRATEGY /
#      "Attach SL/TP to Orders" / PRICE (From TradingView) mode - the
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

# Preflight bounds on the ACTUAL predicted dollar loss at stop, not just
# the raw lot count - catches both an undersizing bug (like the real one
# found 2026-08-17: true risk running at 2-15% of intended) and an
# oversizing one (like MAX_LOTS alone would miss if units_per_lot were
# wrong in the other direction). Deliberately wide (+/-40%) since this is
# a sanity check against a broken assumption, not a precision target.
RISK_MIN_USD = float(os.getenv("RISK_MIN_USD", "15"))
RISK_MAX_USD = float(os.getenv("RISK_MAX_USD", "35"))

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
GOLDEN_SESSIONS = {"London Open", "Asia", "NY Open", "NY"}
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

# Flat constant, not a per-pair table - see the correction note above.
# Confirmed empirically (not assumed) for UNI/XRP/NEAR/PENDLE/WLD via real
# closed-trade P&L; unverified for everything else, which is exactly what
# MAX_LOTS below guards against.
UNITS_PER_LOT = 1.0

# Hard safety cap: if computing a $25-risk position would require more
# lots than this, refuse to send the alert rather than trust an unverified
# sizing assumption for that pair. Real confirmed values topped out around
# 815 (NEAR) - 5000 leaves generous headroom for legitimate variance while
# still catching a wildly-wrong computation (e.g. a cheap/thin pair where
# units-per-lot genuinely isn't 1) before it reaches a real order.
MAX_LOTS = 5000.0

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


def compute_lots(
    entry: float, stop: float, risk_amount_usd: float, min_lots: float,
    units_per_lot: float = UNITS_PER_LOT, max_lots: float = MAX_LOTS,
    risk_min_usd: float = RISK_MIN_USD, risk_max_usd: float = RISK_MAX_USD,
) -> float:
    """
    Preflight sequence: target risk -> raw lots -> floor at min_lots ->
    predicted dollar loss at stop -> confirm it's actually near the
    target -> confirm the lot count itself is sane -> return.

    Worth being precise about what the risk-band check does and doesn't
    catch: it's self-consistent by construction, so it can't catch
    units_per_lot itself being wrong (the actual 2026-08-17 bug - that
    used the same wrong constant on both sides of this exact check and
    would have passed it). What it DOES catch: the min_lots floor forcing
    real risk far above target (a genuine, separate failure mode - a
    pair's minimum tradeable size can itself represent way more than the
    intended risk), a misconfigured RISK_AMOUNT_USD outside its own
    band, and future code changes that decouple the sizing step from the
    sending step. MAX_LOTS remains the backstop against a wrong
    units_per_lot producing an absurd lot count in the first place.
    """
    price_distance = abs(entry - stop)
    if price_distance <= 0:
        raise ValueError("entry and stop cannot be equal (zero risk)")

    raw_lots = risk_amount_usd / (price_distance * units_per_lot)
    lots = max(raw_lots, min_lots)

    if lots > max_lots:
        raise ValueError(
            f"computed {lots:.1f} lots exceeds MAX_LOTS ({max_lots}) - "
            f"sizing assumption likely wrong for this pair, refusing to trade it"
        )

    predicted_loss_usd = price_distance * lots * units_per_lot
    if not (risk_min_usd <= predicted_loss_usd <= risk_max_usd):
        raise ValueError(
            f"predicted loss at stop (${predicted_loss_usd:.2f}) is outside "
            f"the intended risk band (${risk_min_usd}-${risk_max_usd}) - "
            f"refusing to trade it"
        )

    return lots


def build_alert_payload(pair: str, direction: str, entry: float, stop: float, tp1: float, lots: float) -> dict:
    """Builds the PickMyTrade alert JSON. Uses dollar_tp/dollar_sl (a raw
    PRICE DISTANCE from wherever the real fill lands - NOT a total-position
    or per-lot dollar amount, confirmed directly via a real live test order:
    dollar_tp=2/dollar_sl=1 produced TP/SL at exactly open+2/open-1) instead
    of absolute tp/sl prices. This is the fix for real, observed R:R
    distortion (BlofinBridge had the same bug months ago, fixed there by
    polling for the real fill then recomputing SL/TP - Match-Trader can just
    do this natively via dollar_tp/dollar_sl, no polling needed). tp/sl
    stay 0 (unset) - confirmed live that mixing them with dollar_tp/dollar_sl
    set doesn't conflict."""
    symbol = map_symbol(pair)
    mult = price_multiplier(pair)
    return {
        "strategy_name": "liquidity-lab-sweep-retest",
        "symbol": symbol,
        "date": datetime.now(timezone.utc).isoformat(),
        "data": "long" if direction == "Long" else "short",
        "quantity": round(lots, 8),
        "price": entry * mult,
        "tp": 0,
        "percentage_tp": 0,
        "dollar_tp": abs(tp1 - entry) * mult,
        "sl": 0,
        "dollar_sl": abs(entry - stop) * mult,
        "percentage_sl": 0,
        "token": PICKMYTRADE_TOKEN,
        "duplicate_position_allow": False,
        "platform": "MATCHTRADER",
        "order_type": "MARKET",
        # NOT "CFD" - PickMyTrade's own pre-existing symbol registry files
        # every CFT Match-Trader crypto pair (confirmed for ETH/ADA/SAND/STX
        # via their Settings page) under FOREXCFD specifically. Sending
        # "CFD" caused every alert to fail with "Symbol Mapping Not Found"
        # even though the symbol was already registered - the instrument
        # type is part of the lookup key.
        "inst_type": "FOREXCFD",
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
                    lots = compute_lots(entry, stop, RISK_AMOUNT_USD, MIN_LOTS[pair])
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
