# cft_tracker.py
#
# Manual trade tracker for a real Crypto Fund Trader (CFT) $5,000 2-Phase
# Evaluation, using the exact rules confirmed on their own pricing page:
#   Phase 1 target: 8%   Phase 2 target: 5%
#   Max daily loss: 5%   Max overall loss: 10%
#   Min trading days: 0 (per phase)
# No exchange connection, no automation - this is a CLI for logging real
# trades you took by hand on the real account, so you can see live
# pass/fail progress without doing the math yourself each time.
#
# ASSUMPTION (stated explicitly since CFT's page doesn't spell this out):
# each phase's profit target is measured from the balance you carried INTO
# that phase (not reset back down to $5,000), matching how FTMO's own
# 2-step evaluation works. If that's wrong, it needs correcting.
#
# CONFIRMED directly by CFT support (2026-08-15) for the 2-Phase Evaluation
# specifically (not the 1-Phase/Break tracks, which use a trailing 6% rule
# instead - not applicable here):
#   - Max overall loss is a FIXED 10% of the ORIGINAL $5,000, never reset
#     between phases - only the profit TARGET resets per phase.
#   - The daily-loss reference balance resets at 12:05 AM UTC each day,
#     not plain midnight - a trade at 00:03 UTC still belongs to the PRIOR
#     trading day.
#   - Breaches are evaluated on EQUITY (including open positions), but
#     this tracker only logs CLOSED trades after the fact - it can't see
#     floating loss on a position held open across the 12:05 AM UTC
#     boundary. Fine for trades that open and close same-session (the
#     common case here), but a real gap if you hold something open across
#     that boundary - there's no way to catch that without a live feed,
#     which is out of scope for a manual CLI tool.
#
# Usage:
#   python cft_tracker.py log <pair> <direction> <entry> <stop> <close> [timestamp]
#   python cft_tracker.py status

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

START_BALANCE = 5000.0
# CFT's daily-loss reference balance resets at 12:05 AM UTC, not midnight.
DAILY_RESET_OFFSET_MINUTES = 5
PHASE_1_TARGET_PCT = 0.08
PHASE_2_TARGET_PCT = 0.05
DAILY_LOSS_PCT = 0.05
MAX_LOSS_PCT = 0.10
MIN_TRADING_DAYS = 0
RISK_PCT = 0.01  # matches the 1% risk used everywhere else this session

STATE_PATH = Path(__file__).parent / "cft_state.json"
TRADE_LOG_PATH = Path(__file__).parent / "cft_trades.csv"
TRADE_LOG_FIELDS = [
    "logged_at", "pair", "direction", "entry", "stop", "close",
    "realized_r", "risk_amount", "pnl", "balance_after", "phase", "status", "fail_reason",
]


# ---------------- PURE LOGIC (unit-tested below) ----------------

def realized_r(entry: float, stop: float, close_price: float, direction: str) -> float | None:
    """Same formula used across the whole session (blofin_executor.py,
    server.js's realizedR)."""
    risk = abs(entry - stop)
    if risk <= 0:
        return None
    if direction == "Long":
        return (close_price - entry) / risk
    return (entry - close_price) / risk


def trading_day_string(dt: datetime) -> str:
    """CFT's daily-loss reference resets at 12:05 AM UTC, not plain
    midnight - shift back by that offset before taking the calendar date,
    so a trade at 00:03 UTC still counts toward the PRIOR trading day (the
    reset hasn't happened yet at that point)."""
    shifted = dt.astimezone(timezone.utc) - timedelta(minutes=DAILY_RESET_OFFSET_MINUTES)
    return shifted.strftime("%Y-%m-%d")


def new_state(now: datetime) -> dict:
    today = trading_day_string(now)
    return {
        "phase": "PHASE_1",
        "phaseStartedAt": now.isoformat(),
        "phaseStartBalance": START_BALANCE,
        "overallStartBalance": START_BALANCE,
        "currentBalance": START_BALANCE,
        "dayStartBalance": START_BALANCE,
        "currentDay": today,
        "tradingDaysCount": 0,
        "lastTradingDay": None,
        "failReason": None,
        "endedAt": None,
    }


def apply_trade(state: dict, trade_time: datetime, realized_r_value: float) -> tuple[dict, dict]:
    """
    Pure function: applies one real, achieved R-multiple to the CFT
    evaluation state. Returns (new_state, trade_summary). Does not mutate
    the input. No-ops (returns state unchanged, trade_summary marked
    inactive) if the evaluation has already ended (PASSED-to-LIVE or
    FAILED) - a real account doesn't auto-restart like the simulators do;
    a failed/passed evaluation just... is what it is until you buy another.
    """
    if state["phase"] in ("LIVE", "FAILED"):
        return state, {"applied": False, "reason": f"evaluation already {state['phase']}"}

    event_day = trading_day_string(trade_time)

    current_balance = state["currentBalance"]
    day_start_balance = state["dayStartBalance"]
    current_day = state["currentDay"]
    trading_days_count = state["tradingDaysCount"]
    last_trading_day = state["lastTradingDay"]
    phase_start_balance = state["phaseStartBalance"]
    overall_start_balance = state["overallStartBalance"]
    phase = state["phase"]

    if event_day != current_day:
        current_day = event_day
        day_start_balance = current_balance
    if event_day != last_trading_day:
        last_trading_day = event_day
        trading_days_count += 1

    risk_amount = current_balance * RISK_PCT
    pnl = risk_amount * realized_r_value
    new_balance = current_balance + pnl

    fail_reason = None
    ended_at = None

    daily_loss = day_start_balance - new_balance
    daily_loss_limit = day_start_balance * DAILY_LOSS_PCT
    total_loss = overall_start_balance - new_balance
    max_loss_limit = overall_start_balance * MAX_LOSS_PCT

    if daily_loss_limit > 0 and daily_loss >= daily_loss_limit:
        phase = "FAILED"
        fail_reason = f"Daily loss {daily_loss:.2f} breached limit {daily_loss_limit:.2f}"
        ended_at = trade_time.isoformat()
    elif max_loss_limit > 0 and total_loss >= max_loss_limit:
        phase = "FAILED"
        fail_reason = f"Max loss {total_loss:.2f} breached limit {max_loss_limit:.2f}"
        ended_at = trade_time.isoformat()
    else:
        target_pct = PHASE_1_TARGET_PCT if phase == "PHASE_1" else PHASE_2_TARGET_PCT
        target_balance = phase_start_balance * (1 + target_pct)
        if new_balance >= target_balance and trading_days_count >= MIN_TRADING_DAYS:
            if phase == "PHASE_1":
                phase = "PHASE_2"
                phase_start_balance = new_balance
                trading_days_count = 0
                last_trading_day = None
            else:
                phase = "LIVE"
                ended_at = trade_time.isoformat()

    new_state_dict = {
        "phase": phase,
        "phaseStartedAt": state["phaseStartedAt"] if phase == state["phase"] else trade_time.isoformat(),
        "phaseStartBalance": phase_start_balance,
        "overallStartBalance": overall_start_balance,
        "currentBalance": new_balance,
        "dayStartBalance": day_start_balance,
        "currentDay": current_day,
        "tradingDaysCount": trading_days_count,
        "lastTradingDay": last_trading_day,
        "failReason": fail_reason,
        "endedAt": ended_at,
    }
    trade_summary = {
        "applied": True,
        "realizedR": realized_r_value,
        "riskAmount": risk_amount,
        "pnl": pnl,
        "balanceAfter": new_balance,
        "phaseAfter": phase,
    }
    return new_state_dict, trade_summary


# ---------------- I/O ----------------

def load_state() -> dict:
    if not STATE_PATH.exists():
        state = new_state(datetime.now(timezone.utc))
        save_state(state)
        return state
    return json.loads(STATE_PATH.read_text())


def save_state(state: dict) -> None:
    STATE_PATH.write_text(json.dumps(state, indent=2, default=str))


def append_trade_log(row: dict) -> None:
    import csv
    is_new = not TRADE_LOG_PATH.exists()
    with open(TRADE_LOG_PATH, "a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=TRADE_LOG_FIELDS)
        if is_new:
            writer.writeheader()
        writer.writerow({k: row.get(k, "") for k in TRADE_LOG_FIELDS})


def print_status(state: dict) -> None:
    print(f"Phase: {state['phase']}")
    if state["phase"] in ("LIVE", "FAILED"):
        print(f"  Ended at: {state['endedAt']}")
        if state["failReason"]:
            print(f"  Fail reason: {state['failReason']}")
    print(f"Current balance: ${state['currentBalance']:,.2f}")
    if state["phase"] in ("PHASE_1", "PHASE_2"):
        target_pct = PHASE_1_TARGET_PCT if state["phase"] == "PHASE_1" else PHASE_2_TARGET_PCT
        target_balance = state["phaseStartBalance"] * (1 + target_pct)
        print(f"  Phase target: ${target_balance:,.2f} ({target_pct:.0%} from ${state['phaseStartBalance']:,.2f})")
        print(f"  Daily loss floor: ${state['dayStartBalance'] * (1 - DAILY_LOSS_PCT):,.2f}")
        print(f"  Max loss floor: ${state['overallStartBalance'] * (1 - MAX_LOSS_PCT):,.2f}")
        print(f"  Trading days this phase: {state['tradingDaysCount']} (min {MIN_TRADING_DAYS})")


# ---------------- CLI ----------------

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]

    if command == "status":
        state = load_state()
        print_status(state)
        return

    if command == "log":
        if len(sys.argv) < 7:
            print("Usage: python cft_tracker.py log <pair> <direction> <entry> <stop> <close> [timestamp]")
            sys.exit(1)
        pair, direction, entry_s, stop_s, close_s = sys.argv[2:7]
        entry, stop, close_price = float(entry_s), float(stop_s), float(close_s)
        trade_time = (
            datetime.fromisoformat(sys.argv[7]) if len(sys.argv) > 7
            else datetime.now(timezone.utc)
        )
        if trade_time.tzinfo is None:
            trade_time = trade_time.replace(tzinfo=timezone.utc)

        r_value = realized_r(entry, stop, close_price, direction)
        if r_value is None:
            print("ERROR: entry and stop cannot be equal (zero risk)")
            sys.exit(1)

        state = load_state()
        new_state_dict, summary = apply_trade(state, trade_time, r_value)

        if not summary["applied"]:
            print(f"Not logged - {summary['reason']}")
            print_status(state)
            return

        save_state(new_state_dict)
        append_trade_log({
            "logged_at": datetime.now(timezone.utc).isoformat(),
            "pair": pair, "direction": direction,
            "entry": entry, "stop": stop, "close": close_price,
            "realized_r": round(r_value, 4),
            "risk_amount": round(summary["riskAmount"], 2),
            "pnl": round(summary["pnl"], 2),
            "balance_after": round(summary["balanceAfter"], 2),
            "phase": summary["phaseAfter"],
            "status": "FAILED" if summary["phaseAfter"] == "FAILED" else "OK",
            "fail_reason": new_state_dict.get("failReason") or "",
        })

        print(f"Logged {pair} {direction}: R={r_value:.2f}, pnl=${summary['pnl']:,.2f}")
        print()
        print_status(new_state_dict)
        return

    print(f"Unknown command: {command}")
    print(__doc__)
    sys.exit(1)


if __name__ == "__main__":
    main()
