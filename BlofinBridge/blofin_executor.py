# blofin_executor.py
#
# Polls Liquidity Lab's public /events feed for "golden" signals (the same
# stacked filter shown in Signal Quality: SWEEP_CONFIRMED + Sweep + Retest +
# a prime session, excluding SAND/USDT) and auto-executes them for real on
# BloFin's official DEMO futures environment - a real matching engine, real
# order book, virtual funds. Unlike the FTMO/MetaApi attempt, no broker
# bridge is needed: BOTFINAL.py already trades on BloFin via ccxt, and ccxt
# has built-in sandbox support for it.
#
# This is a *forward-only*, complementary data source to the FTMO simulator
# already running in Server/server.js (which replays historical outcomes).
# This one captures genuinely new, live-executed R-multiples and scores
# them against a separate, self-contained $100k FTMO-rules virtual ledger -
# decoupled from BloFin's own ~5,000 USDT demo balance, which is only used
# to size the real (small) demo order, never the PF math.
#
# Setup required before this can run against real (demo) fills:
#   1. In the BloFin app, enable "Demo Trading" and generate a DEMO-specific
#      API key (key/secret/passphrase) - separate from any live key.
#   2. Copy .env.example to .env and fill in BLOFIN_API_KEY/SECRET/PASSWORD.

import asyncio
import csv
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
log = logging.getLogger("blofin_executor")

# ---------------- CONFIG ----------------

LLAB_API_BASE = os.getenv("LLAB_API_BASE", "https://liquidity-lab-api.onrender.com")
BLOFIN_API_KEY = os.getenv("BLOFIN_API_KEY", "")
BLOFIN_API_SECRET = os.getenv("BLOFIN_API_SECRET", "")
BLOFIN_API_PASSWORD = os.getenv("BLOFIN_API_PASSWORD", "")

# Real order sizing - a FIXED small dollar amount, deliberately NOT a
# percentage of the demo balance. Originally was a percentage, but the
# demo balance grew ~25x unexpectedly (from ~$4k to ~$100k) partway
# through, which silently scaled risk-per-trade from ~$40 to ~$1000 and
# produced contract counts in the millions for low-priced/tight-stop pairs
# - exceeded BloFin's own max order size limit repeatedly. A fixed dollar
# figure keeps every real order small and bounded regardless of whatever
# the demo balance happens to be - the whole point of this bridge (proving
# the pipeline + rough price realism) never needed order size to track
# balance at all; only the separate $100k PF ledger below does that.
DEMO_RISK_AMOUNT_USD = float(os.getenv("DEMO_RISK_AMOUNT_USD", "25"))

# Skip any signal whose entry/stop/tp1 levels are this stale by the time
# we'd actually place the order - if the executor was down or backlogged,
# price may have already moved past the intended take-profit, which
# BloFin's API rejects outright (confirmed live: "take profit trigger
# price should be lower/higher than the best bid/ask price").
MAX_SIGNAL_AGE_SECONDS = int(os.getenv("MAX_SIGNAL_AGE_SECONDS", "300"))

# The $100k virtual ledger's rules - matches PROP_PRESETS.ftmo_like in
# src/App.jsx and the FTMO simulator in Server/server.js exactly. Run as
# SEVERAL parallel ledgers, one per risk-per-trade level, all fed the same
# real executed R-multiple from a single BloFin trade - lets us directly
# compare pass/fail speed across risk levels on an identical trade sequence,
# not a re-run with different luck.
PF_ACCOUNT_SIZE = float(os.getenv("PF_ACCOUNT_SIZE", "100000"))
PF_RISK_LEVELS_BPS = [
    int(x.strip()) for x in os.getenv("PF_RISK_LEVELS_BPS", "50,100,150,250").split(",") if x.strip()
]
PF_RISK_LEVELS = [bps / 10000 for bps in PF_RISK_LEVELS_BPS]  # e.g. 50bps -> 0.005
PF_PROFIT_TARGET_PCT = float(os.getenv("PF_PROFIT_TARGET_PCT", "0.10"))
PF_DAILY_LOSS_PCT = float(os.getenv("PF_DAILY_LOSS_PCT", "0.05"))
PF_MAX_DRAWDOWN_PCT = float(os.getenv("PF_MAX_DRAWDOWN_PCT", "0.10"))
PF_MIN_TRADING_DAYS = int(os.getenv("PF_MIN_TRADING_DAYS", "4"))

POLL_INTERVAL_SECONDS = int(os.getenv("POLL_INTERVAL_SECONDS", "20"))
POSITION_POLL_INTERVAL_SECONDS = int(os.getenv("POSITION_POLL_INTERVAL_SECONDS", "60"))

LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
TRADE_LOG_PATH = LOG_DIR / "blofin_trades.csv"
SEEN_EVENTS_PATH = LOG_DIR / "seen_events.json"
OPEN_POSITIONS_PATH = LOG_DIR / "open_positions.json"
PF_LEDGERS_PATH = LOG_DIR / "pf_ledgers.json"
PF_LEDGER_TRADES_PATH = LOG_DIR / "pf_ledger_trades.csv"

TRADE_LOG_FIELDS = [
    "logged_at", "event_id", "pair", "blofin_symbol", "direction",
    "entry", "stop", "tp1", "contracts", "risk_amount_demo", "order_id",
    "status", "close_price", "realized_r", "closed_at",
]

# One row per (trade, risk-level) - the real executed R-multiple applied
# to each parallel PF ledger separately.
PF_LEDGER_TRADE_FIELDS = [
    "closed_at", "event_id", "pair", "realized_r", "risk_bps",
    "pf_attempt", "pf_pnl", "pf_balance_after", "pf_status",
]

# ---------------- GOLDEN FILTER ----------------
# Mirrors server.js's `golden` stats filter and App.jsx's confirmed-stage
# gating exactly - keep these in sync if either side changes.

GOLDEN_EVENT_TYPE = "SWEEP_CONFIRMED"
GOLDEN_PATTERN = "Sweep + Retest"
GOLDEN_SESSIONS = {"London Open", "Asia", "NY Open"}
GOLDEN_EXCLUDE_PAIRS = {"SAND/USDT", "SEI/USDT", "APT/USDT"}

# Pairs excluded here for demo EXECUTION quality, not signal quality - kept
# separate from GOLDEN_EXCLUDE_PAIRS/is_golden on purpose, since these are
# fine signals that just aren't safe to trade on BloFin's thin demo
# liquidity. CRV/STX confirmed earlier to have spreads 2-10x wider in demo
# than live. KAS confirmed directly: its sub-cent price means even a small
# $25 risk needs ~300k contracts, and dumping that into a thin demo order
# book produced a visible self-inflicted wick on the chart (order execution
# markers landing right at the spike) - on top of being the pair where the
# SL/TP silent-attach-failure incident happened.
THIN_DEMO_LIQUIDITY_PAIRS = {"KAS/USDT", "CRV/USDT", "STX/USDT"}


def is_golden(event: dict) -> bool:
    """Same criteria as the dashboard's "golden" stacked filter."""
    return (
        event.get("eventType") == GOLDEN_EVENT_TYPE
        and event.get("pattern") == GOLDEN_PATTERN
        and event.get("session") in GOLDEN_SESSIONS
        and event.get("pair") not in GOLDEN_EXCLUDE_PAIRS
    )


# ---------------- PURE LOGIC (testable without a live exchange connection) ----------------

def map_symbol(pair: str) -> str:
    """BloFin/ccxt swap symbol for a pair, e.g. "BTC/USDT" -> "BTC/USDT:USDT"."""
    return f"{pair}:USDT"


def compute_contract_size(
    entry: float,
    stop: float,
    risk_amount: float,
    contract_size: float,
    amount_step: float,
    min_amount: float,
) -> float:
    """
    Position size (in ccxt "amount"/contracts) for the REAL demo order,
    sized against a FIXED dollar risk amount - deliberately NOT a function
    of the demo account's balance (see DEMO_RISK_AMOUNT_USD's comment for
    why: balance-relative sizing silently produced million-contract orders
    once the demo balance grew unexpectedly). Independent either way of the
    $100k PF ledger, which only ever consumes the resulting realized
    R-multiple, never this position's actual dollar size.

      price_distance = |entry - stop|
      risk_per_contract = price_distance * contract_size
      raw_contracts = risk_amount / risk_per_contract

    Rounded down to amount_step, floored at min_amount. Raises if even the
    minimum size would risk unreasonably more than intended (caller should
    skip the trade rather than oversize it).
    """
    if contract_size <= 0 or amount_step <= 0:
        raise ValueError("contract_size and amount_step must be positive")
    price_distance = abs(entry - stop)
    if price_distance <= 0:
        raise ValueError("entry and stop cannot be equal")

    risk_per_contract = price_distance * contract_size
    raw_contracts = risk_amount / risk_per_contract

    steps = raw_contracts / amount_step
    rounded = int(steps) * amount_step  # round down (floor)
    contracts = max(rounded, min_amount)
    return contracts


def compute_adjusted_sl_tp(
    real_entry: float,
    intended_entry: float,
    intended_stop: float,
    intended_tp: float,
    direction: str,
) -> tuple[float, float]:
    """
    Re-anchors SL/TP to the REAL fill price instead of the signal's
    intended entry, preserving the exact original risk distance and R:R
    ratio regardless of market-order slippage.

    Found live (2026-08-12) that placing SL/TP at the signal's fixed
    absolute price levels (the original approach) silently distorts the
    real risk/reward whenever the market-order fill differs from the
    intended entry - confirmed on a real STX/USDT trade where slippage
    turned an intended ~2:1 R:R into an actual ~0.67:1 R:R, because the
    stop/tp stayed pinned to fixed prices while the entry point moved.

    Fix: keep the same PRICE DISTANCE to stop and to tp as the signal
    intended (which is what compute_contract_size's sizing was already
    based on, so the dollar risk stays correct too), just measured from
    where the order actually filled instead of where it was expected to.
    """
    stop_distance = abs(intended_entry - intended_stop)
    tp_distance = abs(intended_tp - intended_entry)
    if direction == "Long":
        new_stop = real_entry - stop_distance
        new_tp = real_entry + tp_distance
    else:
        new_stop = real_entry + stop_distance
        new_tp = real_entry - tp_distance
    return new_stop, new_tp


def realized_r(entry: float, stop: float, close_price: float, direction: str) -> float | None:
    """R-multiple actually achieved on a closed position, matching
    server.js's realizedR/ftmo_executor.py's realized_r formula."""
    risk = abs(entry - stop)
    if risk <= 0:
        return None
    if direction == "Long":
        return (close_price - entry) / risk
    return (entry - close_price) / risk


def utc_date_string(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%d")


def new_pf_account(attempt_number: int, now: datetime, risk_pct: float) -> dict:
    """Fresh $100k virtual ledger attempt at a given risk-per-trade level -
    same shape/semantics as FtmoSimAccount in Server/prisma/schema.prisma."""
    today = utc_date_string(now)
    return {
        "attemptNumber": attempt_number,
        "startedAt": now.isoformat(),
        "endedAt": None,
        "status": "ACTIVE",
        "startBalance": PF_ACCOUNT_SIZE,
        "currentBalance": PF_ACCOUNT_SIZE,
        "dayStartBalance": PF_ACCOUNT_SIZE,
        "currentDay": today,
        "tradingDaysCount": 0,
        "lastTradingDay": None,
        "profitTargetPct": PF_PROFIT_TARGET_PCT,
        "dailyLossPct": PF_DAILY_LOSS_PCT,
        "maxDrawdownPct": PF_MAX_DRAWDOWN_PCT,
        "minTradingDays": PF_MIN_TRADING_DAYS,
        "riskPct": risk_pct,
        "failReason": None,
    }


def apply_trade_to_pf_account(account: dict, trade_time: datetime, realized_r_value: float) -> dict:
    """
    Pure function: applies one real, achieved R-multiple to the $100k
    virtual ledger. Mirrors applyGoldenRowToAccount in Server/server.js
    exactly (day-roll, daily-loss/max-drawdown/profit-target checks) so
    the two ledgers stay comparable. Returns a NEW account dict (does not
    mutate the input) plus the trade's pnl/balanceAfter for logging.
    """
    event_day = utc_date_string(trade_time)

    current_balance = account["currentBalance"]
    day_start_balance = account["dayStartBalance"]
    current_day = account["currentDay"]
    trading_days_count = account["tradingDaysCount"]
    last_trading_day = account["lastTradingDay"]

    if event_day != current_day:
        current_day = event_day
        day_start_balance = current_balance
    if event_day != last_trading_day:
        last_trading_day = event_day
        trading_days_count += 1

    risk_amount = current_balance * account["riskPct"]
    pnl = risk_amount * realized_r_value
    new_balance = current_balance + pnl

    status = "ACTIVE"
    fail_reason = None

    daily_loss = day_start_balance - new_balance
    daily_loss_limit = day_start_balance * account["dailyLossPct"]
    total_drawdown = account["startBalance"] - new_balance
    max_drawdown_limit = account["startBalance"] * account["maxDrawdownPct"]

    if daily_loss_limit > 0 and daily_loss >= daily_loss_limit:
        status = "FAILED"
        fail_reason = f"Daily loss {daily_loss:.2f} breached limit {daily_loss_limit:.2f}"
    elif max_drawdown_limit > 0 and total_drawdown >= max_drawdown_limit:
        status = "FAILED"
        fail_reason = f"Max drawdown {total_drawdown:.2f} breached limit {max_drawdown_limit:.2f}"
    elif (
        new_balance >= account["startBalance"] * (1 + account["profitTargetPct"])
        and trading_days_count >= account["minTradingDays"]
    ):
        status = "PASSED"

    updated = {
        **account,
        "currentBalance": new_balance,
        "dayStartBalance": day_start_balance,
        "currentDay": current_day,
        "tradingDaysCount": trading_days_count,
        "lastTradingDay": last_trading_day,
        "status": status,
        "failReason": fail_reason,
        "endedAt": trade_time.isoformat() if status != "ACTIVE" else None,
    }
    return updated, {"pnl": pnl, "riskAmount": risk_amount, "balanceAfter": new_balance}


# ---------------- STATE I/O ----------------

def load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text())
    except Exception:
        return default


def save_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, indent=2, default=str))


def load_seen_events() -> set:
    return set(load_json(SEEN_EVENTS_PATH, []))


def save_seen_events(seen: set) -> None:
    save_json(SEEN_EVENTS_PATH, list(seen)[-2000:])


def load_open_positions() -> dict:
    return load_json(OPEN_POSITIONS_PATH, {})


def save_open_positions(positions: dict) -> None:
    save_json(OPEN_POSITIONS_PATH, positions)


def risk_key(risk_pct: float) -> str:
    """Stable dict key for a risk level, e.g. 0.01 -> "100bps"."""
    return f"{round(risk_pct * 10000)}bps"


def load_pf_ledgers() -> dict:
    return load_json(PF_LEDGERS_PATH, {})


def save_pf_ledgers(ledgers: dict) -> None:
    save_json(PF_LEDGERS_PATH, ledgers)


def get_or_create_all_pf_ledgers() -> dict:
    """Returns {risk_key: account} for every configured risk level,
    creating a fresh $100k attempt for any level that's missing or whose
    prior attempt already closed."""
    ledgers = load_pf_ledgers()
    changed = False
    for risk_pct in PF_RISK_LEVELS:
        key = risk_key(risk_pct)
        account = ledgers.get(key)
        if account is None or account["status"] != "ACTIVE":
            next_attempt = (account["attemptNumber"] + 1) if account else 1
            account = new_pf_account(next_attempt, datetime.now(timezone.utc), risk_pct)
            ledgers[key] = account
            changed = True
            log.info(
                f"[PF {key}] Started attempt #{account['attemptNumber']} at ${account['startBalance']:,.2f}"
            )
    if changed:
        save_pf_ledgers(ledgers)
    return ledgers


def append_pf_ledger_trade(row: dict) -> None:
    is_new = not PF_LEDGER_TRADES_PATH.exists()
    with open(PF_LEDGER_TRADES_PATH, "a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=PF_LEDGER_TRADE_FIELDS)
        if is_new:
            writer.writeheader()
        writer.writerow({k: row.get(k, "") for k in PF_LEDGER_TRADE_FIELDS})


def append_trade_log(row: dict) -> None:
    is_new = not TRADE_LOG_PATH.exists()
    with open(TRADE_LOG_PATH, "a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=TRADE_LOG_FIELDS)
        if is_new:
            writer.writeheader()
        writer.writerow({k: row.get(k, "") for k in TRADE_LOG_FIELDS})


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


# ---------------- EXCHANGE I/O (not pure - needs a live connection) ----------------

def get_real_entry_price(exchange, symbol: str, retries: int = 6, delay: float = 1.0):
    """
    Poll for the actual average entry price of a just-placed market order's
    resulting position. Necessary because fetch_positions can briefly lag
    right after a fill - the same propagation delay that caused the
    close-detection race condition found earlier. Returns None (caller
    should fall back to the intended entry) if it never shows up.
    """
    for _ in range(retries):
        positions = exchange.fetch_positions([symbol])
        for p in positions:
            if abs(p.get("contracts") or 0) > 0 and p.get("entryPrice"):
                return p["entryPrice"]
        time.sleep(delay)
    return None


def attach_sl_tp(exchange, symbol: str, market: dict, direction: str, contracts: float, stop: float, tp: float) -> None:
    """
    Attaches BOTH stop-loss and take-profit to an existing position via
    BloFin's dedicated TPSL endpoint, called directly (bypassing ccxt's
    createTpslOrder convenience wrapper) because that wrapper only accepts
    ONE of stopLossPrice/takeProfitPrice per call (an `elif`, not both) -
    confirmed by reading its source - even though BloFin's actual API
    accepts both together in one record (confirmed via the raw
    orders-tpsl-pending response). This request shape mirrors exactly what
    a successful atomic order-creation call sends, verified live earlier.
    """
    closing_side = "sell" if direction == "Long" else "buy"
    exchange.privatePostTradeOrderTpsl({
        "instId": market["id"],
        "side": closing_side,
        "positionSide": "net",
        "marginMode": "cross",
        "size": exchange.amount_to_precision(symbol, contracts),
        "slTriggerPrice": exchange.price_to_precision(symbol, stop),
        "slOrderPrice": "-1",
        "tpTriggerPrice": exchange.price_to_precision(symbol, tp),
        "tpOrderPrice": "-1",
        "reduceOnly": "true",
    })


def sl_tp_is_live(exchange, market: dict) -> bool:
    """
    Confirms a TPSL order actually exists server-side for this instrument,
    rather than trusting attach_sl_tp's absence of a thrown exception.
    Necessary because a real incident showed BloFin can return a
    200/no-exception response from the TPSL endpoint without the order
    actually being created - the KAS/USDT position on 2026-08-15 sat fully
    unprotected for over a day (confirmed via this exact endpoint returning
    an empty list) and ran to -55R before being manually closed, wrecking
    every PF ledger in the process. "No exception" is not sufficient
    evidence of protection.
    """
    resp = exchange.privateGetTradeOrdersTpslPending()
    orders = resp.get("data", [])
    return any(o.get("instId") == market["id"] for o in orders)


# ---------------- MAIN LOOP ----------------

async def run():
    if not BLOFIN_API_KEY or not BLOFIN_API_SECRET or not BLOFIN_API_PASSWORD:
        log.error(
            "BLOFIN_API_KEY / BLOFIN_API_SECRET / BLOFIN_API_PASSWORD not set - "
            "generate a DEMO API key in BloFin's Demo Trading section, copy "
            ".env.example to .env, and fill these in. Exiting rather than "
            "crash-looping."
        )
        return

    # Imported here so the pure-logic functions above stay importable/
    # testable without ccxt installed, mirroring ftmo_executor.py's
    # lazy-import-of-the-SDK pattern.
    import ccxt

    exchange = ccxt.blofin({
        "apiKey": BLOFIN_API_KEY,
        "secret": BLOFIN_API_SECRET,
        "password": BLOFIN_API_PASSWORD,
        "enableRateLimit": True,
        "options": {"defaultType": "swap"},
    })
    exchange.set_sandbox_mode(True)
    exchange.load_markets()
    log.info("Connected to BloFin DEMO trading environment.")

    seen_events = load_seen_events()
    open_positions = load_open_positions()
    ledgers = get_or_create_all_pf_ledgers()
    log.info(f"[PF] Running {len(PF_RISK_LEVELS)} parallel ledgers: {list(ledgers.keys())}")

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

                if event.get("pair") in THIN_DEMO_LIQUIDITY_PAIRS:
                    log.info(f"Skipping {event_id} - {event.get('pair')} excluded for thin demo liquidity")
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
                        log.info(f"Skipping {event_id} - stale ({age_seconds:.0f}s old, entry/tp1 may no longer be valid)")
                        continue

                pair = event.get("pair")
                symbol = map_symbol(pair)
                if symbol not in exchange.markets:
                    log.info(f"Skipping {pair} - {symbol} not listed on BloFin")
                    continue

                entry = event.get("entry")
                stop = event.get("stop")
                tp1 = event.get("tp1")
                direction = event.get("directionBias")
                if entry is None or stop is None or tp1 is None:
                    log.warning(f"Skipping {event_id} - missing entry/stop/tp1")
                    continue

                market = exchange.markets[symbol]
                try:
                    contracts = compute_contract_size(
                        entry, stop, DEMO_RISK_AMOUNT_USD,
                        market["contractSize"], market["precision"]["amount"],
                        market["limits"]["amount"]["min"],
                    )
                except ValueError as e:
                    log.warning(f"Skipping {event_id} - bad size inputs: {e}")
                    continue

                side = "buy" if direction == "Long" else "sell"
                log.info(
                    f"GOLDEN SIGNAL: {pair} -> {symbol} {direction} "
                    f"entry={entry} stop={stop} tp1={tp1} contracts={contracts}"
                )

                # Placed WITHOUT SL/TP attached - market orders can slip
                # from the intended entry, and if SL/TP were pinned to the
                # signal's fixed absolute prices (the original approach),
                # that slippage silently distorts the real risk/reward.
                # Confirmed live on a real trade: an intended ~2:1 R:R
                # became ~0.67:1 purely from entry slippage. Instead: fill
                # first, read the REAL average entry, then attach SL/TP
                # re-anchored to it (see compute_adjusted_sl_tp).
                order = exchange.create_order(symbol, "market", side, contracts)
                order_id = order.get("id")

                real_entry = get_real_entry_price(exchange, symbol)
                if real_entry is None:
                    log.warning(
                        f"{event_id} - couldn't confirm real fill price after retries, "
                        f"falling back to intended SL/TP (may not reflect actual entry)"
                    )
                    real_entry, actual_stop, actual_tp = entry, stop, tp1
                else:
                    actual_stop, actual_tp = compute_adjusted_sl_tp(real_entry, entry, stop, tp1, direction)
                    log.info(
                        f"Real fill: {real_entry} (intended {entry}) -> "
                        f"adjusted SL={actual_stop:.8f} TP={actual_tp:.8f}"
                    )

                protected = False
                for attempt in range(2):
                    try:
                        attach_sl_tp(exchange, symbol, market, direction, contracts, actual_stop, actual_tp)
                    except Exception as e:
                        log.error(
                            f"attach_sl_tp call raised on attempt {attempt + 1} for "
                            f"{event_id} ({order_id}): {e}"
                        )
                    time.sleep(1.0)
                    if sl_tp_is_live(exchange, market):
                        protected = True
                        break
                    log.error(
                        f"SL/TP attach did not verify on attempt {attempt + 1} for "
                        f"{event_id} ({order_id}) - no thrown exception, but no TPSL "
                        f"order actually exists server-side."
                    )

                if not protected:
                    log.error(
                        f"{event_id} ({order_id}) still UNPROTECTED after retry - "
                        f"closing the position immediately rather than leaving it "
                        f"naked (real incident: KAS/USDT 2026-08-15 ran to -55R "
                        f"unprotected before being caught)."
                    )
                    try:
                        close_side = "sell" if direction == "Long" else "buy"
                        exchange.create_order(
                            symbol, "market", close_side, contracts,
                            params={"reduceOnly": True},
                        )
                        log.error(f"{event_id} ({order_id}) closed as unprotected-safety fallback.")
                    except Exception as e:
                        log.error(
                            f"FAILED to close unprotected position for {event_id} "
                            f"({order_id}) - manual intervention required: {e}"
                        )

                append_trade_log({
                    "logged_at": datetime.now(timezone.utc).isoformat(),
                    "event_id": event_id,
                    "pair": pair,
                    "blofin_symbol": symbol,
                    "direction": direction,
                    "entry": real_entry,
                    "stop": actual_stop,
                    "tp1": actual_tp,
                    "contracts": contracts,
                    "risk_amount_demo": DEMO_RISK_AMOUNT_USD,
                    "order_id": order_id,
                    "status": "OPEN",
                })
                if order_id:
                    open_positions[order_id] = {
                        "event_id": event_id, "pair": pair, "symbol": symbol,
                        "entry": real_entry, "stop": actual_stop, "direction": direction,
                        "opened_at": datetime.now(timezone.utc).isoformat(),
                    }
                    save_open_positions(open_positions)

            # Periodically check open positions for closure.
            #
            # BUG FOUND LIVE (2026-08-12): this used to gate on
            # `asyncio.get_event_loop().time() - last_position_check`, where
            # `now` is monotonic time since the event loop started and
            # `last_position_check` started at 0.0 - so the first check
            # after ANY position opened fired almost immediately (the loop
            # had already been running >60s), not after a real 60s wait.
            # That alone wouldn't be fatal, but combined with BloFin's own
            # API having a brief propagation delay before a JUST-placed
            # order shows up in fetch_positions(), it produced a false
            # "not in the live list = must be closed" verdict on a position
            # that had only existed for 0.45 seconds - it was never
            # actually closed, the script just lost track of a real open
            # position and silently dropped its eventual outcome. Confirmed
            # via BloFin's raw trade history after the fact.
            #
            # Fix: only ever consider a position eligible for closure
            # detection once it's been open for a minimum buffer - a
            # position that young genuinely cannot have both opened AND had
            # its SL/TP trigger in that window, so there's no legitimate
            # reason to check it yet.
            MIN_POSITION_AGE_SECONDS = 30
            now_utc = datetime.now(timezone.utc)
            eligible = {
                oid: meta for oid, meta in open_positions.items()
                if (now_utc - datetime.fromisoformat(meta["opened_at"])).total_seconds() >= MIN_POSITION_AGE_SECONDS
            }
            now = asyncio.get_event_loop().time()
            if eligible and now - last_position_check > POSITION_POLL_INTERVAL_SECONDS:
                last_position_check = now
                live_positions = exchange.fetch_positions()
                live_symbols_open = {p["symbol"] for p in live_positions if abs(p.get("contracts") or 0) > 0}

                closed_ids = [
                    oid for oid, meta in eligible.items()
                    if meta["symbol"] not in live_symbols_open
                ]
                for oid in closed_ids:
                    meta = open_positions.pop(oid)
                    close_price = None
                    try:
                        # The closing fill has a DIFFERENT order id than the
                        # opening one we keyed this dict by - can't match on
                        # `oid`. Instead: fetch trades since this position
                        # opened and take the most recent fill on the
                        # OPPOSITE side from entry (the closing side, since
                        # this bridge only ever opens then fully closes via
                        # SL/TP, never scales in/out).
                        entry_side = "buy" if meta["direction"] == "Long" else "sell"
                        closing_side = "sell" if entry_side == "buy" else "buy"
                        since_ms = int(datetime.fromisoformat(meta["opened_at"]).timestamp() * 1000)
                        trades = exchange.fetch_my_trades(meta["symbol"], since=since_ms, limit=20)
                        closing = [t for t in trades if t.get("side") == closing_side]
                        if closing:
                            close_price = closing[-1]["price"]
                    except Exception as e:
                        log.warning(f"Couldn't fetch close price for {oid}: {e}")

                    if close_price is None:
                        log.warning(f"Position {oid} ({meta['pair']}) closed but no close price found - not applying to PF ledger")
                        append_trade_log({
                            "logged_at": datetime.now(timezone.utc).isoformat(),
                            "event_id": meta["event_id"], "pair": meta["pair"],
                            "order_id": oid, "status": "CLOSED_UNKNOWN_PRICE",
                            "closed_at": datetime.now(timezone.utc).isoformat(),
                        })
                        save_open_positions(open_positions)
                        continue

                    r_value = realized_r(meta["entry"], meta["stop"], close_price, meta["direction"])
                    closed_at = datetime.now(timezone.utc)

                    if r_value is not None:
                        # Apply this ONE real trade's R-multiple to every
                        # parallel risk-level ledger - same trade sequence,
                        # different sizing, directly comparable outcomes.
                        ledgers = get_or_create_all_pf_ledgers()
                        for risk_pct in PF_RISK_LEVELS:
                            key = risk_key(risk_pct)
                            account = ledgers[key]
                            account, applied = apply_trade_to_pf_account(account, closed_at, r_value)
                            ledgers[key] = account
                            log.info(
                                f"[PF {key}] {meta['pair']} R={r_value:.2f} -> attempt #{account['attemptNumber']} "
                                f"balance ${applied['balanceAfter']:,.2f} ({account['status']})"
                            )
                            append_pf_ledger_trade({
                                "closed_at": closed_at.isoformat(),
                                "event_id": meta["event_id"], "pair": meta["pair"],
                                "realized_r": round(r_value, 4), "risk_bps": round(risk_pct * 10000),
                                "pf_attempt": account["attemptNumber"],
                                "pf_pnl": round(applied["pnl"], 2),
                                "pf_balance_after": round(applied["balanceAfter"], 2),
                                "pf_status": account["status"],
                            })
                        save_pf_ledgers(ledgers)

                    append_trade_log({
                        "logged_at": datetime.now(timezone.utc).isoformat(),
                        "event_id": meta["event_id"], "pair": meta["pair"],
                        "order_id": oid, "status": "CLOSED",
                        "close_price": close_price, "realized_r": r_value,
                        "closed_at": closed_at.isoformat(),
                    })
                save_open_positions(open_positions)

        except Exception as e:
            log.error(f"Loop error: {e}")

        await asyncio.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    asyncio.run(run())
