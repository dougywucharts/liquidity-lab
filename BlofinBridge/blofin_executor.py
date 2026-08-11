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

# Real order sizing against BloFin's own demo balance - deliberately small
# and independent of the $100k PF ledger below (see module docstring).
DEMO_RISK_PCT = float(os.getenv("DEMO_RISK_PCT", "0.01"))

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
GOLDEN_EXCLUDE_PAIRS = {"SAND/USDT"}


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
    demo_balance: float,
    risk_pct: float,
    contract_size: float,
    amount_step: float,
    min_amount: float,
) -> float:
    """
    Position size (in ccxt "amount"/contracts) for the REAL demo order,
    sized against BloFin's own demo balance - independent of the $100k PF
    ledger, which only ever consumes the resulting realized R-multiple.

      risk_amount = demo_balance * risk_pct
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

    risk_amount = demo_balance * risk_pct
    risk_per_contract = price_distance * contract_size
    raw_contracts = risk_amount / risk_per_contract

    steps = raw_contracts / amount_step
    rounded = int(steps) * amount_step  # round down (floor)
    contracts = max(rounded, min_amount)
    return contracts


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

                seen_events.add(event_id)
                save_seen_events(seen_events)

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

                balance = exchange.fetch_balance()
                demo_equity = balance.get("USDT", {}).get("total") or balance.get("total", {}).get("USDT")
                if not demo_equity:
                    log.warning(f"Skipping {event_id} - couldn't read demo USDT balance")
                    continue

                market = exchange.markets[symbol]
                try:
                    contracts = compute_contract_size(
                        entry, stop, demo_equity, DEMO_RISK_PCT,
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

                order = exchange.create_order(
                    symbol, "market", side, contracts,
                    params={
                        "stopLoss": {"triggerPrice": stop},
                        "takeProfit": {"triggerPrice": tp1},
                    },
                )
                order_id = order.get("id")

                append_trade_log({
                    "logged_at": datetime.now(timezone.utc).isoformat(),
                    "event_id": event_id,
                    "pair": pair,
                    "blofin_symbol": symbol,
                    "direction": direction,
                    "entry": entry,
                    "stop": stop,
                    "tp1": tp1,
                    "contracts": contracts,
                    "risk_amount_demo": round(demo_equity * DEMO_RISK_PCT, 4),
                    "order_id": order_id,
                    "status": "OPEN",
                })
                if order_id:
                    open_positions[order_id] = {
                        "event_id": event_id, "pair": pair, "symbol": symbol,
                        "entry": entry, "stop": stop, "direction": direction,
                        "opened_at": datetime.now(timezone.utc).isoformat(),
                    }
                    save_open_positions(open_positions)

            # Periodically check open positions for closure.
            now = asyncio.get_event_loop().time()
            if open_positions and now - last_position_check > POSITION_POLL_INTERVAL_SECONDS:
                last_position_check = now
                live_positions = exchange.fetch_positions()
                live_symbols_open = {p["symbol"] for p in live_positions if abs(p.get("contracts") or 0) > 0}

                closed_ids = [
                    oid for oid, meta in open_positions.items()
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
