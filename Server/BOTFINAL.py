# =========================================================
# Pro-Level Sweep Hunter v42.0 — NOISE FILTERED
# =========================================================
#  Changelog from v41.3:
#  [FILTER 1] VOL_MULT_DETECT: 0.30 → 0.80 (hard volume floor)
#  [FILTER 2] VOL_MULT_CONFIRM: 0.70 → 1.10 (above-avg required)
#  [FILTER 3] MIN_SETUP_STRENGTH: 5 → 38
#  [FILTER 4] WICK_PCT_MIN: 0.10 → 0.25
#  [FILTER 5] REJECT_WICK_PCT_MIN: 0.12 → 0.20
#  [FILTER 6] MAP_EQ_MIN_TOUCHES: 2 → 3 + clustering check
#  [FILTER 7] DETECTED_COOLDOWN: 30 → 240s + level-reset guard
#  [FILTER 8] Bias alignment gate (counter-trend needs strength ≥ 65)
#  [FILTER 9] Off-hours gate (DETECTED skipped unless strength ≥ 60)
#  [FILTER 10] Reclaim staleness check (max 15 min after sweep)
#  [FILTER 11] Accepted requires 2 consecutive closes beyond level
#  [FILTER 12] Confirmed requires 0.5× ATR clearance past entry
#  [FILTER 13] classify_time_window fully rebuilt (Asia/London/NY)
#  [FILTER 14] compute_institutional_score: session + pool bonuses
#  [FILTER 15] sweep_ts tracked in last_sweep_meta for reclaim gate
# =========================================================

import os
import time
import json
import traceback
from datetime import datetime, UTC

import ccxt
import mplfinance as mpf
import pandas as pd
import requests

from dotenv import load_dotenv

load_dotenv()

pd.set_option("mode.chained_assignment", None)

# =========================================================
# SETTINGS
# =========================================================

WEBHOOK_URL = ""  # Discord disabled; radar bridge only

USE_PROD_RADAR = True

# Secret key for authenticating with the radar endpoint
# Must match SWEEP_SECRET_KEY in server .env
SWEEP_SECRET_KEY = os.getenv("SWEEP_SECRET_KEY", "")

# Comma-separated list of radar endpoints, env-driven so the same code
# runs locally (localhost + prod) and on Render (prod only)
BRIDGE_URLS = [
    u.strip()
    for u in os.getenv(
        "BRIDGE_URLS",
        "http://localhost:5000/sweep,https://liquidity-lab-api.onrender.com/sweep",
    ).split(",")
    if u.strip()
]

ENABLE_RADAR_POST = True
BRIDGE_TIMEOUT = 8
ENABLE_KEEPALIVE_PINGS = False
PING_EVENT_TYPE = "SCAN_PING"
PING_EVERY_N_CYCLES = 0

MAP_TIMEFRAME = "5m"
SETUP_TIMEFRAME = "3m"
TRIGGER_TIMEFRAME = "1m"

LIMIT_MAP = 180
LIMIT_SETUP = 180
LIMIT_TRIGGER = 220

LOOP_SLEEP = 0.40
MIN_SLEEP = 0.05

# Sweep / structure
SETUP_LOOKBACK = 8
SETUP_SWING_BACK = 3
MAP_EQ_LOOKBACK = 18
MAP_EQ_TOL_PCT = 0.0015
MAP_EQ_MIN_TOUCHES = 3  # [FILTER 6] was 2

# Detection thresholds — tightened for quality signals
VOL_MULT_DETECT = 0.80  # [FILTER 1] was 0.30
VOL_MULT_CONFIRM = 1.10  # [FILTER 2] was 0.70
RANGE_MULT_DETECT = 0.18  # was 0.10
RANGE_MULT_CONFIRM = 0.25  # was 0.20
WICK_PCT_MIN = 0.25  # [FILTER 4] was 0.10
REJECT_WICK_PCT_MIN = 0.20  # [FILTER 5] was 0.12
WICK_PRICE_MIN = 0.0025
SFP_PENETRATION_MIN = 0.0005
CONFIRM_MAX_BARS = 3
MIN_SETUP_STRENGTH = 38  # [FILTER 3] was 5

# Bias alignment gate
COUNTER_TREND_MIN_STRENGTH = 50  # [FILTER 8] counter-trend sweeps need this
# Reclaim staleness
RECLAIM_MAX_AGE_MINUTES = 15  # [FILTER 10] reclaims older than this are stale

# Off-hours gate
OFF_HOURS_MIN_STRENGTH = 60  # [FILTER 9] DETECTED skipped below this off-hours

# RR settings
STOP_BUFFER_PCT = 0.0015
TP1_BUFFER_PCT = 0.0005
TP2_BUFFER_PCT = 0.0010
MIN_RR_TO_ALERT = 1.5  # TP2 must be >= 1.5R to fire any alert

# MOVED policy: "suppress" = don't post entry-type signals born past the
# progress threshold; "tag" = post everything, tagged (frontend demotes)
MOVED_POLICY = os.getenv("MOVED_POLICY", "suppress")


def moved_should_skip(plan, event_type):
    """
    True if this signal should NOT be posted because price already ran.
    Only entry-type events are suppressed; RECLAIM/CONFIRMED/ACCEPTED are
    validation events and always post (tagged with planState).
    """
    if MOVED_POLICY != "suppress":
        return False
    if event_type not in ("SWEEP_DETECTED", "DOUBLE_SWEEP"):
        return False
    return plan.get("state") == "MOVED"


# Cooldowns
DETECTED_COOLDOWN = 240  # [FILTER 7] was 30
RECLAIM_COOLDOWN = 45  # was 30
ACCEPTED_COOLDOWN = 45  # was 30
CONFIRMED_COOLDOWN = 45  # was 30
CONFIRMED_REQUIRES_RECLAIM_WINDOW = (
    900  # CONFIRMED only fires if RECLAIM happened within 15 min
)
DOUBLE_SWEEP_COOLDOWN = 240
PING_COOLDOWN = 120

# Double sweep
DOUBLE_SWEEP_MAX_BARS = 12
DOUBLE_SWEEP_LEVEL_TOL = 0.0015
DOUBLE_SWEEP_DIR_REQUIRED = True

# Disabled pending a rework of double-sweep detection/RR logic — Signal
# Quality data (n=76) showed negative expectancy (avgR -0.13R), not just
# weak. Re-enable once the underlying logic changes, not before.
DOUBLE_SWEEP_ENABLED = False

# Confidence floor for posting a signal at all. Signal Quality data
# (~250 resolved signals) showed a real cliff: 70-100% confidence carries
# +0.5R to +0.8R average expectancy, 60-69% is barely positive (+0.08R),
# and 50-59%/below is clearly negative (-0.16R to -0.59R). 65 splits the
# difference — keeps the roughly-breakeven 60-69% tier, cuts the losers.
MIN_CONFIDENCE_TO_POST = 65

# Patterns with negative expectancy in Signal Quality data (853 resolved
# signals): Hook (n=9, -0.17R) and Sweep Watch (n=2, -1R, the "no clear
# structure" catch-all by definition). Double Tap (n=770, +0.32R) and
# Sweep + Retest (n=72, +1.19R) both carry positive expectancy and post
# normally. Shadow-tracked like everything else suppressed, so this can
# be revisited once more Hook/Sweep Watch samples accumulate.
WEAK_PATTERNS = {"Hook", "Sweep Watch"}

CHART_WINDOW = (
    300  # 5 hours on 1m — matches trigger lookback so sweep origin is always visible
)

# Outcome tracking — how long a signal stays "pending" before it's marked
# EXPIRED with no resolution. These are 1m-timeframe signals with modest R
# multiples; if neither stop nor TP1 landed in this window it's stale data.
OUTCOME_TRACK_MAX_HOURS = 8
# =========================================================
# DEBUG / MONITORING
# =========================================================

DEBUG_MODE = True
PRINT_EVERY_SYMBOL = True
PRINT_CYCLE_SUMMARY = True
HEARTBEAT_EVERY_N_SYMBOLS = 3

USE_SMALL_TEST_BASKET = False
TEST_SYMBOLS = [
    "ICP/USDT:USDT",
    "SUI/USDT:USDT",
    "SEI/USDT:USDT",
    "BTC/USDT:USDT",
    "ETH/USDT:USDT",
    "SOL/USDT:USDT",
    "DOGE/USDT:USDT",
    "XRP/USDT:USDT",
    "LINK/USDT:USDT",
    "AVAX/USDT:USDT",
]

# =========================================================
# PATHS
# =========================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FOLDER = os.path.join(BASE_DIR, "logs")
CHARTS_FOLDER = os.path.join(BASE_DIR, "charts")
LOG_FILE = os.path.join(LOG_FOLDER, "sweep_log.csv")

# =========================================================
# SYMBOLS
# =========================================================

SWEEP_HUNTER_SYMBOLS = [
    # Majors
    "BTC/USDT:USDT",
    "ETH/USDT:USDT",
    "SOL/USDT:USDT",
    "XRP/USDT:USDT",
    "DOGE/USDT:USDT",
    "AVAX/USDT:USDT",
    "LINK/USDT:USDT",
    "BNB/USDT:USDT",
    "ADA/USDT:USDT",
    "TRX/USDT:USDT",
    # L2 / Alt L1
    "ARB/USDT:USDT",
    "OP/USDT:USDT",
    "SUI/USDT:USDT",
    "APT/USDT:USDT",
    "SEI/USDT:USDT",
    "NEAR/USDT:USDT",
    "FTM/USDT:USDT",
    "ATOM/USDT:USDT",
    "DOT/USDT:USDT",
    "INJ/USDT:USDT",
    # AI / DePIN
    "FET/USDT:USDT",
    "ONDO/USDT:USDT",
    "ICP/USDT:USDT",
    "RENDER/USDT:USDT",
    "WLD/USDT:USDT",
    "TAO/USDT:USDT",
    "AIOZ/USDT:USDT",
    # DeFi
    "UNI/USDT:USDT",
    "AAVE/USDT:USDT",
    "JUP/USDT:USDT",
    "PENDLE/USDT:USDT",
    "CRV/USDT:USDT",
    # Meme / High vol
    "PEPE/USDT:USDT",
    "WIF/USDT:USDT",
    "BONK/USDT:USDT",
    "FLOKI/USDT:USDT",
    # Storage / Infra
    "FIL/USDT:USDT",
    "KAS/USDT:USDT",
    "MINA/USDT:USDT",
    "ROSE/USDT:USDT",
    "JASMY/USDT:USDT",
    # Gaming / NFT
    "IMX/USDT:USDT",
    "GALA/USDT:USDT",
    "SAND/USDT:USDT",
    "AXS/USDT:USDT",
    # Other liquid
    "LTC/USDT:USDT",
    "BCH/USDT:USDT",
    "ETC/USDT:USDT",
    "STX/USDT:USDT",
    "TIA/USDT:USDT",
]

# =========================================================
# LOGGING
# =========================================================

LOG_COLUMNS = [
    "timestamp_utc",
    "symbol",
    "event",
    "direction",
    "strength_score",
    "strength_label",
    "price",
    "map_level",
    "setup_level",
    "liquidity_type",
    "time_window",
    "regime",
    "bias",
    "map_tf",
    "setup_tf",
    "trigger_tf",
    "volume",
    "vol_avg10",
    "range_abs",
    "range_pct",
    "atr14",
    "variant",
    "entry",
    "stop",
    "tp1",
    "tp2",
    "rr_tp1",
    "rr_tp2",
]


def init_sweep_log():
    os.makedirs(LOG_FOLDER, exist_ok=True)
    if not os.path.exists(LOG_FILE):
        with open(LOG_FILE, "w", encoding="utf-8") as f:
            f.write(",".join(LOG_COLUMNS) + "\n")


def csv_safe(value):
    if value is None:
        return ""
    if isinstance(value, float):
        return f"{value:.8f}"
    return str(value).replace(",", ";")


def strength_label(score: int) -> str:
    if score >= 75:
        return "Strong"
    if score >= 45:
        return "Moderate"
    return "Light"


# =========================================================
# SESSION / TIME WINDOW  [FILTER 13]
# =========================================================

# Properly covers Asia, London, NY with named opens
SESSION_WINDOWS = [
    ("Asia Open", 22, 24),
    ("Asia", 0, 2),
    ("London Open", 7, 9),
    ("London", 9, 12),
    ("NY Open", 13, 15),
    ("NY", 15, 17),
    ("NY Close", 20, 22),
]

PRIME_SESSIONS = {"Asia Open", "London Open", "NY Open"}


def classify_time_window(ts_utc: pd.Timestamp) -> str:
    hour = ts_utc.hour
    for name, start, end in SESSION_WINDOWS:
        if start <= hour < end:
            return name
    return "Off-Hours"


def is_off_hours(ts_utc: pd.Timestamp) -> bool:
    return classify_time_window(ts_utc) == "Off-Hours"


def is_prime_session(ts_utc: pd.Timestamp) -> bool:
    return classify_time_window(ts_utc) in PRIME_SESSIONS


def log_sweep_event(
    symbol,
    event,
    direction,
    strength,
    price,
    map_level,
    setup_level,
    liquidity_type,
    regime,
    bias,
    volume,
    vol_avg10,
    range_abs,
    range_pct,
    atr14,
    variant,
    entry,
    stop,
    tp1,
    tp2,
    rr_tp1,
    rr_tp2,
    ts_utc=None,
):
    if ts_utc is None:
        ts_utc = pd.Timestamp.utcnow()

    row = {
        "timestamp_utc": ts_utc.strftime("%Y-%m-%d %H:%M:%S"),
        "symbol": symbol,
        "event": event,
        "direction": direction,
        "strength_score": strength,
        "strength_label": strength_label(int(strength)),
        "price": price,
        "map_level": map_level,
        "setup_level": setup_level,
        "liquidity_type": liquidity_type,
        "time_window": classify_time_window(ts_utc),
        "regime": regime,
        "bias": bias,
        "map_tf": MAP_TIMEFRAME,
        "setup_tf": SETUP_TIMEFRAME,
        "trigger_tf": TRIGGER_TIMEFRAME,
        "volume": volume,
        "vol_avg10": vol_avg10,
        "range_abs": range_abs,
        "range_pct": range_pct,
        "atr14": atr14,
        "variant": variant,
        "entry": entry,
        "stop": stop,
        "tp1": tp1,
        "tp2": tp2,
        "rr_tp1": rr_tp1,
        "rr_tp2": rr_tp2,
    }

    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(",".join(csv_safe(row[col]) for col in LOG_COLUMNS) + "\n")


init_sweep_log()

# =========================================================
# HELPERS
# =========================================================


def dbg(msg):
    if DEBUG_MODE:
        print(msg)


def rr_text(rr):
    return "—" if rr is None else f"{rr:.2f}"


# =========================================================
# EXCHANGE
# =========================================================


def init_exchange():
    exchange = ccxt.blofin(
        {"enableRateLimit": True, "options": {"defaultType": "swap"}}
    )
    exchange.load_markets()
    print("[INIT] Connected to Blofin.")
    print(f"[LOG FILE] {LOG_FILE}")
    return exchange


def get_sweep_hunter_symbols(exchange):
    markets = exchange.load_markets()
    wanted = TEST_SYMBOLS if USE_SMALL_TEST_BASKET else SWEEP_HUNTER_SYMBOLS

    final = []
    for s in wanted:
        if s in markets:
            final.append(s)
        else:
            print(f"[WARN] Symbol not found on Blofin: {s}")

    if not final:
        final = ["BTC/USDT:USDT", "ETH/USDT:USDT"]
        print("[WARN] Fallback to BTC/ETH only")

    return final


# =========================================================
# FETCH
# =========================================================


def fetch_ohlcv_df(exchange, symbol, timeframe, limit):
    try:
        data = exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
    except Exception as e:
        print(f"[WARN] OHLCV error {symbol} {timeframe}: {e}")
        return None

    if not data:
        return None

    df = pd.DataFrame(
        data, columns=["timestamp", "open", "high", "low", "close", "volume"]
    )
    df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms", utc=True)
    df.set_index("timestamp", inplace=True)
    return df


# =========================================================
# INDICATORS
# =========================================================


def add_indicators(df):
    df["ema20"] = df["close"].ewm(span=20, adjust=False).mean()
    df["ema50"] = df["close"].ewm(span=50, adjust=False).mean()
    df["ema20_slope"] = df["ema20"].diff()

    delta = df["close"].diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    rs = gain.rolling(14).mean() / (loss.rolling(14).mean() + 1e-9)
    df["rsi"] = 100 - (100 / (1 + rs))

    prev_close = df["close"].shift(1)
    tr = pd.concat(
        [
            df["high"] - df["low"],
            (df["high"] - prev_close).abs(),
            (df["low"] - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    df["atr14"] = tr.rolling(14).mean()

    df["vol_sma10"] = df["volume"].rolling(10).mean()
    df["vol_sma20"] = df["volume"].rolling(20).mean()
    df["range_abs"] = df["high"] - df["low"]
    df["range_pct"] = df["range_abs"] / (df["close"] + 1e-9)
    return df


# =========================================================
# REGIME / BIAS
# =========================================================


def compute_regime_and_bias(df):
    if len(df) < 30:
        return "Unknown", "Neutral"

    last = df.iloc[-1]
    vol20 = df["range_pct"].rolling(20).mean().iloc[-1]
    trend_spread = abs(last["ema20"] - last["ema50"]) / (last["close"] + 1e-9)

    if last["ema20"] > last["ema50"] and last["close"] >= last["ema20"]:
        bias = "Bullish"
    elif last["ema20"] < last["ema50"] and last["close"] <= last["ema20"]:
        bias = "Bearish"
    else:
        bias = "Neutral"

    if trend_spread > 0.015:
        regime = "Expansion" if vol20 > 0.03 else "Trend"
    elif vol20 > 0.035:
        regime = "Volatile"
    elif vol20 < 0.015:
        regime = "Compression"
    else:
        regime = "Range"

    return regime, bias


# =========================================================
# LIQUIDITY POOLS  [FILTER 6]
# =========================================================


def detect_equal_highs_lows(map_df, level, direction, price):
    """
    Upgraded: requires MAP_EQ_MIN_TOUCHES=3 AND at least two of those
    touches must be within 10 bars of each other (clustering check).
    """
    if map_df is None or len(map_df) < 3 or level is None:
        return "Low Sweep" if direction == "bullish" else "High Sweep"

    look = map_df.tail(MAP_EQ_LOOKBACK)
    tol = price * MAP_EQ_TOL_PCT

    if direction == "bearish":
        touch_idx = [
            i for i, h in enumerate(look["high"].values) if abs(float(h) - level) <= tol
        ]
        if len(touch_idx) >= MAP_EQ_MIN_TOUCHES:
            # Clustering: at least two touches within 10 bars
            for j in range(len(touch_idx) - 1):
                if touch_idx[j + 1] - touch_idx[j] <= 10:
                    return "Equal Highs"
        return "High Sweep"

    if direction == "bullish":
        touch_idx = [
            i for i, l in enumerate(look["low"].values) if abs(float(l) - level) <= tol
        ]
        if len(touch_idx) >= MAP_EQ_MIN_TOUCHES:
            for j in range(len(touch_idx) - 1):
                if touch_idx[j + 1] - touch_idx[j] <= 10:
                    return "Equal Lows"
        return "Low Sweep"

    return "Swing Level"


def get_map_liquidity_levels(map_df):
    if map_df is None or len(map_df) < 30:
        return None

    look = map_df.iloc[-40:-2].copy()
    if look.empty:
        return None

    return {
        "high": look["high"].max(),
        "low": look["low"].min(),
    }


# =========================================================
# BIAS ALIGNMENT HELPER  [FILTER 8]
# =========================================================


def is_aligned_with_bias(sweep_dir: str, bias: str) -> bool:
    """
    Aligned = sweep direction agrees with HTF EMA structure.
    Neutral bias = no penalty (ranging market, both directions valid).
    """
    if bias == "Neutral":
        return True
    if sweep_dir == "bearish" and bias == "Bearish":
        return True
    if sweep_dir == "bullish" and bias == "Bullish":
        return True
    return False


# =========================================================
# RR CALCULATOR
# =========================================================


def calc_rr(direction, entry, stop, tp1, tp2):
    try:
        if direction == "bullish":
            risk = entry - stop
            reward1 = tp1 - entry
            reward2 = tp2 - entry
        else:
            risk = stop - entry
            reward1 = entry - tp1
            reward2 = entry - tp2

        if risk <= 0:
            return None, None

        rr1 = reward1 / risk if reward1 > 0 else None
        rr2 = reward2 / risk if reward2 > 0 else None
        return rr1, rr2
    except Exception:
        return None, None


# =========================================================
# RR PLAN v2 — entry zone, structural stop, moved-guard
# (constants below can be moved to your config block later)
# =========================================================

ENTRY_ZONE_ATR_FRAC = 0.25  # zone depth as fraction of ATR
SWING_PIVOT_WINDOW = 2  # bars each side for a pivot to count as a swing
SWING_LOOKBACK_BARS = 60  # how far back to hunt for swing points (1m bars)
# Nudged 0.20 -> 0.30: real resolved-signal data showed stops sitting only
# ~0.16-0.26% of price away, tight enough that ordinary 1m noise was tagging
# them before the setup got a fair chance. This is a small bump, not a
# redesign - re-check Signal Quality's stop-vs-target mix after it accumulates.
STOP_ATR_PAD = 0.30  # ATR pad beyond the structural anchor
MOVED_PROGRESS_MAX = 0.35  # >35% of the way to TP1 at creation = MOVED
STOP_MAX_ATR_MULT = 3.0  # sanity cap: stop can't exceed 3x ATR from entry


def find_swing_points(df, window=SWING_PIVOT_WINDOW, lookback=SWING_LOOKBACK_BARS):
    """
    Return (swing_lows, swing_highs) as lists of floats, most recent LAST.
    A swing low is a bar whose low is strictly the minimum of the `window`
    bars on each side; swing high is the mirror. Excludes the last `window`
    bars (they can't be confirmed pivots yet).
    """
    tail = df.tail(lookback)
    lows = tail["low"].values
    highs = tail["high"].values
    n = len(tail)

    swing_lows, swing_highs = [], []
    for i in range(window, n - window):
        lo, hi = lows[i], highs[i]
        if (
            lo == min(lows[i - window : i + window + 1])
            and lo
            < min(min(lows[i - window : i]), min(lows[i + 1 : i + window + 1])) + 1e-12
        ):
            swing_lows.append(float(lo))
        if (
            hi == max(highs[i - window : i + window + 1])
            and hi
            > max(max(highs[i - window : i]), max(highs[i + 1 : i + window + 1]))
            - 1e-12
        ):
            swing_highs.append(float(hi))
    return swing_lows, swing_highs


def find_stop_level(direction, trigger_df, entry_ref, atr):
    """
    Anchor the stop to structure: beyond the extreme of the LAST TWO swing
    lows (bullish) or swing highs (bearish), padded by STOP_ATR_PAD * ATR.
    Falls back to a plain ATR stop when structure is missing or absurd.
    Returns (stop_price, anchor_label).
    """
    swing_lows, swing_highs = find_swing_points(trigger_df)
    px = float(trigger_df.iloc[-1]["close"])
    pad = atr * STOP_ATR_PAD
    max_dist = atr * STOP_MAX_ATR_MULT

    if direction == "bullish":
        candidates = [lo for lo in swing_lows if lo < entry_ref]
        if len(candidates) >= 2:
            anchor = min(candidates[-2:])  # lower of last two swing lows
            stop = anchor - pad
            label = "structure_2_lows"
        elif len(candidates) == 1:
            anchor = candidates[-1]
            stop = anchor - pad
            label = "structure_1_low"
        else:
            stop = entry_ref - max(px * STOP_BUFFER_PCT, atr * 0.75)
            label = "atr_fallback"
        if entry_ref - stop > max_dist:
            stop = entry_ref - max_dist
            label += "_capped"
        if stop >= entry_ref:
            stop = entry_ref - max(px * STOP_BUFFER_PCT, atr * 0.75)
            label = "atr_fallback"
        return stop, label

    else:  # bearish
        candidates = [hi for hi in swing_highs if hi > entry_ref]
        if len(candidates) >= 2:
            anchor = max(candidates[-2:])  # higher of last two swing highs
            stop = anchor + pad
            label = "structure_2_highs"
        elif len(candidates) == 1:
            anchor = candidates[-1]
            stop = anchor + pad
            label = "structure_1_high"
        else:
            stop = entry_ref + max(px * STOP_BUFFER_PCT, atr * 0.75)
            label = "atr_fallback"
        if stop - entry_ref > max_dist:
            stop = entry_ref + max_dist
            label += "_capped"
        if stop <= entry_ref:
            stop = entry_ref + max(px * STOP_BUFFER_PCT, atr * 0.75)
            label = "atr_fallback"
        return stop, label


def build_rr_plan(direction, trigger_df, map_levels, sweep_level, reclaim_level=None):
    last = trigger_df.iloc[-1]
    atr = last["atr14"] if not pd.isna(last["atr14"]) else 0
    px = float(last["close"])

    base_level = float(sweep_level) if sweep_level is not None else px
    zone_depth = max(px * 0.0005, atr * ENTRY_ZONE_ATR_FRAC)

    recent = trigger_df.tail(36).copy()
    local_high = float(recent["high"].max())
    local_low = float(recent["low"].min())

    atr_tp1_buffer = atr * 0.50
    atr_tp2_buffer = atr * 0.25

    if direction == "bullish":
        # ── ENTRY ZONE ────────────────────────────────────────────
        # Bottom: the swept level (deepest acceptable retest).
        # Top: reclaim close if available, else swept level + zone_depth.
        entry_min = base_level
        if reclaim_level is not None and float(reclaim_level) > base_level:
            entry_max = min(float(reclaim_level), base_level + zone_depth * 2)
        else:
            entry_max = base_level + zone_depth
        # canonical single "entry" = worst fill (top of zone for longs)
        entry = entry_max

        # ── STOP: structural anchor below last 2 swing lows ──────
        stop, stop_anchor = find_stop_level("bullish", trigger_df, entry_min, atr)
        risk = entry - stop  # risk measured from worst fill

        # ── TARGETS (from worst-fill entry) ───────────────────────
        tp1 = local_high - atr_tp1_buffer
        tp2 = local_high + atr_tp2_buffer
        if tp1 <= entry:
            tp1 = entry + risk * 1.5
        if tp2 <= tp1:
            tp2 = entry + risk * 2.5
        if (tp1 - entry) < risk * 2.0:
            tp1 = entry + risk * 2.0
        if (tp2 - tp1) < risk * 1.5:
            tp2 = tp1 + risk * 1.5

        # ── MOVED GUARD at creation ───────────────────────────────
        denom = tp1 - entry_max
        progress = (px - entry_max) / denom if denom > 0 else 1.0

    else:
        # ── ENTRY ZONE (bearish mirror) ───────────────────────────
        entry_max = base_level
        if reclaim_level is not None and float(reclaim_level) < base_level:
            entry_min = max(float(reclaim_level), base_level - zone_depth * 2)
        else:
            entry_min = base_level - zone_depth
        # worst fill for shorts = bottom of zone
        entry = entry_min

        # ── STOP: structural anchor above last 2 swing highs ─────
        stop, stop_anchor = find_stop_level("bearish", trigger_df, entry_max, atr)
        risk = stop - entry

        # ── TARGETS (from worst-fill entry) ───────────────────────
        tp1 = local_low + atr_tp1_buffer
        tp2 = local_low - atr_tp2_buffer
        if tp1 >= entry:
            tp1 = entry - risk * 2.0
        if tp2 >= tp1:
            tp2 = entry - risk * 3.5
        if (entry - tp1) < risk * 2.0:
            tp1 = entry - risk * 2.0
        if (tp1 - tp2) < risk * 1.5:
            tp2 = tp1 - risk * 1.5

        denom = entry_min - tp1
        progress = (entry_min - px) / denom if denom > 0 else 1.0

    # progress < 0 means price is still inside/behind the zone → clamp to 0
    progress = max(0.0, float(progress))
    state = "MOVED" if progress > MOVED_PROGRESS_MAX else "OK"

    rr1, rr2 = calc_rr(direction, entry, stop, tp1, tp2)

    return {
        # legacy fields (entry = worst-fill edge of zone)
        "entry": entry,
        "stop": stop,
        "tp1": tp1,
        "tp2": tp2,
        "rr_tp1": rr1,
        "rr_tp2": rr2,
        # new fields
        "entry_min": entry_min,
        "entry_max": entry_max,
        "state": state,  # "OK" | "MOVED"
        "progress_to_tp1": round(progress, 3),
        "stop_anchor": stop_anchor,  # how the stop was derived
    }


# =========================================================
# DOUBLE SWEEP
# =========================================================


def classify_variant(current_dir, current_level, current_ts, prev_meta):
    variant = "swing_liquidity"

    if not prev_meta:
        return variant

    prev_level = prev_meta.get("level")
    prev_dir = prev_meta.get("dir")
    prev_ts = prev_meta.get("ts")

    if prev_level is None or prev_ts is None or current_level is None:
        return variant

    bars_apart = 999999
    try:
        bars_apart = int((current_ts - prev_ts).total_seconds() // 60)
    except Exception:
        pass

    level_diff = abs(prev_level - current_level) / (prev_level + 1e-9)
    same_level = level_diff <= DOUBLE_SWEEP_LEVEL_TOL
    same_dir = prev_dir == current_dir

    if same_level and bars_apart <= DOUBLE_SWEEP_MAX_BARS:
        if (not DOUBLE_SWEEP_DIR_REQUIRED) or same_dir:
            return "double_sweep"

    if (prev_dir != current_dir) and same_level and level_diff < 0.003:
        return "sweep_of_sweep"

    return variant


# =========================================================
# DETECT SETUP SWEEP (3m)  [FILTERS 1-9]
# =========================================================


def detect_setup_sweep(setup_df, map_df):
    """
    Fully filtered sweep detection.
    Gates applied in order:
      1. Candle range >= RANGE_MULT_DETECT × ATR
      2. Volume >= VOL_MULT_DETECT × 10-bar avg  (hard gate, no exceptions)
      3. Directional close required
      4. Strength scoring with raised wick threshold
      5. Minimum strength = 38
      6. Bias alignment: counter-trend needs strength >= 65, then penalised
      7. Off-hours: skipped unless strength >= OFF_HOURS_MIN_STRENGTH
    """
    FAIL = (False, None, 0, None, None, "normal", None)

    needed = SETUP_LOOKBACK + SETUP_SWING_BACK + 10
    if len(setup_df) < needed:
        return FAIL

    struct = setup_df.iloc[-(SETUP_LOOKBACK + SETUP_SWING_BACK) : -SETUP_SWING_BACK]
    c = setup_df.iloc[-1]

    range_high = struct["high"].max()
    range_low = struct["low"].min()

    avg_range = setup_df["atr14"].iloc[-2]
    c_range = c["high"] - c["low"]

    if pd.isna(avg_range) or c_range <= 0:
        return FAIL

    # Gate 1: Candle range
    if c_range < avg_range * RANGE_MULT_DETECT:
        return FAIL

    # Gate 2: Volume — hard floor, no exceptions
    vol_avg10 = setup_df["volume"].rolling(10).mean().iloc[-2]
    if pd.isna(vol_avg10) or vol_avg10 <= 0:
        return FAIL

    vol_mult = c["volume"] / vol_avg10
    if vol_mult < VOL_MULT_DETECT:
        return FAIL

    # Gate 3: Directional close
    bullish = c["low"] < range_low and c["close"] > c["open"]
    bearish = c["high"] > range_high and c["close"] < c["open"]

    if not bullish and not bearish:
        return FAIL

    direction = "bullish" if bullish else "bearish"
    price = c["close"]

    # Strength scoring
    strength = 28  # base (higher than before since volume already gated)

    # Volume bonus — meaningful now that floor is at 0.80
    strength += min(22, max(0, (vol_mult - VOL_MULT_DETECT) * 18))

    # Depth bonus
    if bullish:
        depth = (range_low - c["low"]) / (price + 1e-9)
        setup_level = range_low
    else:
        depth = (c["high"] - range_high) / (price + 1e-9)
        setup_level = range_high

    strength += int(depth * 5000)

    # Wick dominance — raised threshold [FILTER 4]
    wick_up = c["high"] - max(c["open"], c["close"])
    wick_dn = min(c["open"], c["close"]) - c["low"]
    wick_dom = max(wick_up, wick_dn) / (c_range + 1e-9)

    if bullish and wick_dn > wick_up:
        strength += 10
    elif bearish and wick_up > wick_dn:
        strength += 10

    if wick_dom >= WICK_PCT_MIN:  # 0.25 — meaningful only
        strength += 8

    # Range bonus
    if c_range >= avg_range * RANGE_MULT_CONFIRM:
        strength += 6

    # Liquidity pool classification
    map_levels = get_map_liquidity_levels(map_df)
    liquidity_type = "Swing Level"

    if bullish:
        map_level = map_levels["low"] if map_levels else setup_level
        liquidity_type = detect_equal_highs_lows(map_df, map_level, direction, price)
    else:
        map_level = map_levels["high"] if map_levels else setup_level
        liquidity_type = detect_equal_highs_lows(map_df, map_level, direction, price)

    # Named pool bonus — more reliable targets
    if liquidity_type in ("Equal Highs", "Equal Lows"):
        strength += 10

    # EXHAUSTION SWEEP — sweeping while price is stretched >= 2 ATR beyond
    # EMA99 in the sweep direction = mean-reversion fade with confluence.
    # These are counter-trend BY DESIGN and get a bonus, not a penalty.
    exhaustion = False
    try:
        if "ema99" in setup_df.columns:
            ema99_val = float(setup_df["ema99"].iloc[-1])
        else:
            ema99_val = float(
                setup_df["close"].ewm(span=99, adjust=False).mean().iloc[-1]
            )
        atr_val = setup_df["atr14"].iloc[-2]
        if pd.notna(atr_val) and atr_val > 0:
            # bearish sweep of highs: exhaustion = price stretched ABOVE ema99
            # bullish sweep of lows:  exhaustion = price stretched BELOW ema99
            ext_atr = (
                (price - ema99_val) / atr_val
                if bearish
                else (ema99_val - price) / atr_val
            )
            if ext_atr >= 2.0:
                exhaustion = True
                strength += int(min(18, 10 + (ext_atr - 2.0) * 6))
                liquidity_type = f"Exhaustion · {liquidity_type}"
    except Exception:
        pass

    strength = int(min(max(strength, 0), 100))

    # Gate 4: Minimum strength [FILTER 3]
    if strength < MIN_SETUP_STRENGTH:
        return FAIL

    # Gate 5: Bias alignment [FILTER 8]
    _, bias = compute_regime_and_bias(setup_df)

    if not is_aligned_with_bias(direction, bias):
        if exhaustion:
            # extension fades are counter-trend by design — no gate, no penalty
            pass
        elif strength < COUNTER_TREND_MIN_STRENGTH:
            return FAIL
        else:
            # Counter-trend that passes: apply confidence penalty
            strength = int(strength * 0.85)

    # Gate 6: Off-hours filter [FILTER 9]
    ts = setup_df.index[-1]
    if is_off_hours(ts) and strength < OFF_HOURS_MIN_STRENGTH:
        return FAIL

    return (
        True,
        direction,
        strength,
        map_level,
        setup_level,
        "swing_liquidity",
        liquidity_type,
    )


# =========================================================
# TRIGGER LOGIC (1m)  [FILTERS 10, 11]
# =========================================================


def detect_reclaim_or_acceptance(
    trigger_df, direction, sweep_level, sweep_timestamp=None
):
    """
    Upgraded:
      - Staleness gate: reclaim ignored > RECLAIM_MAX_AGE_MINUTES after sweep
      - Volume raised to VOL_MULT_CONFIRM = 1.10
      - Acceptance requires TWO consecutive closes beyond level
    """
    if len(trigger_df) < 4 or sweep_level is None:
        return None

    # Gate 1: Staleness [FILTER 10]
    if sweep_timestamp is not None:
        try:
            age_minutes = (trigger_df.index[-1] - sweep_timestamp).total_seconds() / 60
            if age_minutes > RECLAIM_MAX_AGE_MINUTES:
                return None
        except Exception:
            pass

    c1 = trigger_df.iloc[-1]
    c2 = trigger_df.iloc[-2]
    rng1 = c1["high"] - c1["low"]

    if rng1 <= 0:
        return None

    avg_range20 = trigger_df["atr14"].iloc[-2]
    avg_vol10 = trigger_df["volume"].rolling(10).mean().iloc[-2]

    if pd.isna(avg_range20) or pd.isna(avg_vol10):
        return None

    # Gate 2: Range
    if rng1 < avg_range20 * RANGE_MULT_CONFIRM:
        return None

    # Gate 3: Volume [FILTER 2]
    if c1["volume"] < avg_vol10 * VOL_MULT_CONFIRM:
        return None

    price = c1["close"]
    wick_floor = price * WICK_PRICE_MIN
    upper_wick = c1["high"] - max(c1["open"], c1["close"])
    lower_wick = min(c1["open"], c1["close"]) - c1["low"]
    mid = (c1["high"] + c1["low"]) / 2

    if direction == "bullish":
        reclaim = (
            c1["low"] <= sweep_level
            and c1["close"] > sweep_level
            and c1["close"] > c1["open"]
            and c1["close"] > mid
            and lower_wick >= max(REJECT_WICK_PCT_MIN * rng1, wick_floor)
        )
        # [FILTER 11] Two consecutive closes beyond level
        accepted = (
            c1["close"] < sweep_level
            and c2["close"] < sweep_level
            and c1["low"] < sweep_level
            and c1["close"] < c2["close"]
        )
        if reclaim:
            return "reclaim"
        if accepted:
            return "accepted"

    if direction == "bearish":
        reclaim = (
            c1["high"] >= sweep_level
            and c1["close"] < sweep_level
            and c1["close"] < c1["open"]
            and c1["close"] < mid
            and upper_wick >= max(REJECT_WICK_PCT_MIN * rng1, wick_floor)
        )
        # [FILTER 11] Two consecutive closes beyond level
        accepted = (
            c1["close"] > sweep_level
            and c2["close"] > sweep_level
            and c1["high"] > sweep_level
            and c1["close"] > c2["close"]
        )
        if reclaim:
            return "reclaim"
        if accepted:
            return "accepted"

    return None


def detect_confirmed_displacement(trigger_df, direction, entry_level):
    """
    Upgraded: requires close beyond entry by 0.5 × ATR minimum.  [FILTER 12]
    Prevents micro-displacement noise from triggering CONFIRMED.
    """
    if len(trigger_df) < 4 or entry_level is None:
        return False

    c1 = trigger_df.iloc[-1]
    rng1 = c1["high"] - c1["low"]
    avg_range20 = trigger_df["atr14"].iloc[-2]
    avg_vol10 = trigger_df["volume"].rolling(10).mean().iloc[-2]

    if pd.isna(avg_range20) or pd.isna(avg_vol10) or rng1 <= 0:
        return False

    if rng1 < avg_range20 * RANGE_MULT_CONFIRM:
        return False
    if c1["volume"] < avg_vol10 * VOL_MULT_CONFIRM:
        return False

    # ATR clearance gate
    clearance = avg_range20 * 0.50

    if direction == "bullish":
        return c1["close"] > c1["open"] and c1["close"] > entry_level + clearance
    else:
        return c1["close"] < c1["open"] and c1["close"] < entry_level - clearance


# =========================================================
# SCORE  [FILTER 14]
# =========================================================


def compute_institutional_score(
    strength,
    event_type,
    rr2=None,
    bias=None,
    session=None,
    liquidity_type=None,
    progress=None,
):
    """
    Session, liquidity pool type, and price progress factor into score.
    A signal that already ran toward TP1 cannot wear a high score.
    """
    score = float(max(0, min(100, int(strength))))

    # Event tier
    event_bonus = {
        "CONFIRMED": 20,
        "RECLAIM": 12,
        "DOUBLE_SWEEP": 14,
        "DETECTED": 0,
        "ACCEPTED": -10,
    }
    score += event_bonus.get(event_type, 0)

    # RR quality
    if rr2 is not None:
        if rr2 >= 3.0:
            score += 14
        elif rr2 >= 2.5:
            score += 10
        elif rr2 >= 1.8:
            score += 6
        elif rr2 < 1.1:
            score -= 12

    # Bias alignment bonus
    if bias in ("Bullish", "Bearish") and event_type in ("RECLAIM", "CONFIRMED"):
        score += 5

    # Session quality bonus
    if session in PRIME_SESSIONS:
        score += 6
    elif session == "Off-Hours":
        score -= 8

    # Named liquidity pool bonus
    if liquidity_type in ("Equal Highs", "Equal Lows"):
        score += 5

    # PROGRESS PENALTY — price already moved toward TP1 = less edge remaining.
    # <=15% progress: free. 95% progress: ~-48, capped at -40.
    if progress is not None:
        try:
            p = float(progress)
            score -= min(40.0, max(0.0, (p - 0.15) * 60.0))
        except (TypeError, ValueError):
            pass

    return max(0, min(100, int(score)))


# =========================================================
# CHARTING
# =========================================================


def save_chart(df, symbol, filename, level=None, direction=None, liquidity_type=None):
    try:
        os.makedirs(CHARTS_FOLDER, exist_ok=True)
        filename = filename.replace("/", "-").replace(":", "-")
        path = os.path.join(CHARTS_FOLDER, filename)

        last_window = df.tail(CHART_WINDOW).copy()

        mc = mpf.make_marketcolors(
            up="#26a69a",
            down="#ef5350",
            wick={"up": "#cbd5e1", "down": "#cbd5e1"},
            edge={"up": "#26a69a", "down": "#ef5350"},
            volume="in",
        )

        style = mpf.make_mpf_style(
            marketcolors=mc,
            facecolor="#0f172a",
            figcolor="#0f172a",
            edgecolor="#334155",
            gridcolor="#334155",
            gridstyle="--",
            y_on_right=True,
            rc={
                "axes.labelcolor": "#cbd5e1",
                "xtick.color": "#cbd5e1",
                "ytick.color": "#cbd5e1",
                "text.color": "#f8fafc",
                "axes.titlecolor": "#f8fafc",
            },
        )

        clean_symbol = symbol.replace(":USDT", "")
        title = clean_symbol
        if direction:
            title += f" | {direction.upper()}"
        if liquidity_type:
            title += f" | {liquidity_type}"

        plot_kwargs = dict(
            data=last_window,
            type="candle",
            volume=True,
            style=style,
            figsize=(10, 6),
            figscale=1.08,
            tight_layout=True,
            title=title,
            savefig=path,
        )

        if level is not None:
            plot_kwargs["hlines"] = dict(
                hlines=[level],
                colors=["#f59e0b"],
                linestyle="--",
                linewidths=[1.3],
            )

        mpf.plot(**plot_kwargs)
        return path

    except Exception as e:
        print(f"[WARN] Chart error {symbol}: {e}")
        return ""


# =========================================================
# DISCORD
# =========================================================


def make_blofin_chart_url(symbol):
    base = symbol.split(":")[0].replace("/", "-")
    return f"https://blofin.com/futures/{base}"


def build_embed(
    symbol,
    title_text,
    desc,
    color,
    df,
    extra_fields=None,
    level=None,
    direction=None,
    liquidity_type=None,
):
    last = df.iloc[-1]
    price = last["close"]
    ts = df.index[-1].strftime("%Y-%m-%d %H:%M:%S UTC")
    url = make_blofin_chart_url(symbol)
    clean = symbol.replace(":USDT", "")

    title = f"{title_text} — {clean}  ${price:.4f}"
    body = (
        f"{desc}\n\n"
        f"━━━━━━━━━━━━━━━━━━━━━━\n"
        f"**Price:** `{price:.4f}`\n"
        f"**Time:** `{ts}`\n"
        f"━━━━━━━━━━━━━━━━━━━━━━\n"
        f"[🌐 View on Blofin]({url})"
    )

    embed = {
        "title": title,
        "url": url,
        "description": body,
        "color": color,
        "fields": [],
        "footer": {"text": "Sweep Hunter v42.0 — DougyWu Signals"},
    }

    if extra_fields:
        for name, value in extra_fields:
            embed["fields"].append({"name": name, "value": value, "inline": False})

    symbol_file = symbol.replace("/", "-").replace(":", "-")
    fname = f"SWEEP_{symbol_file}_{int(time.time())}.png"
    chart_path = save_chart(
        df=df,
        symbol=symbol_file,
        filename=fname,
        level=level,
        direction=direction,
        liquidity_type=liquidity_type,
    )

    return embed, chart_path


def send_discord_alert(embed, chart_path=None):
    if not WEBHOOK_URL or WEBHOOK_URL == "YOUR_DISCORD_WEBHOOK":
        print("[WARN] Missing webhook. Preview only.")
        print(json.dumps(embed, indent=2))
        return

    try:
        payload = {"embeds": [embed]}
        files = None

        if chart_path and os.path.exists(chart_path):
            with open(chart_path, "rb") as f:
                files = {"file": ("chart.png", f.read(), "image/png")}
            payload["embeds"][0]["image"] = {"url": "attachment://chart.png"}

        resp = requests.post(
            WEBHOOK_URL,
            files=files,
            data={"payload_json": json.dumps(payload)},
            timeout=20,
        )

        if resp.status_code >= 300:
            print(f"[WARN] Discord error {resp.status_code}: {resp.text}")
        else:
            print("[INFO] Discord alert sent.")

    except Exception as e:
        print(f"[ERROR] Discord send fail: {e}")


# =========================================================
# PATTERN DETECTION
# =========================================================


def detect_pattern(direction, df, sweep_level):
    if df is None or len(df) < 6 or sweep_level is None:
        return "Unknown"

    recent = df.tail(8)
    highs = recent["high"].values
    lows = recent["low"].values
    closes = recent["close"].values
    opens = recent["open"].values

    sweep_level = float(sweep_level)
    tolerance = max(abs(sweep_level) * 0.0015, 1e-12)

    if direction == "bearish":
        touches = sum(1 for h in highs if abs(float(h) - sweep_level) <= tolerance)
        rejected_now = closes[-1] < opens[-1] and closes[-1] < sweep_level
        failed_reclaim = closes[-1] > sweep_level
        moved_away = any(float(c) < sweep_level - tolerance for c in closes[:-1])
    elif direction == "bullish":
        touches = sum(1 for l in lows if abs(float(l) - sweep_level) <= tolerance)
        rejected_now = closes[-1] > opens[-1] and closes[-1] > sweep_level
        failed_reclaim = closes[-1] < sweep_level
        moved_away = any(float(c) > sweep_level + tolerance for c in closes[:-1])
    else:
        return "Scanner Ping"

    if failed_reclaim:
        return "Failed Reclaim"
    if touches >= 2:
        return "Double Tap"
    if moved_away:
        return "Sweep + Retest"
    if rejected_now:
        return "Hook"
    return "Sweep Watch"


def trade_viability(direction, current_price, entry, threshold_pct=0.25):
    if current_price is None or entry is None:
        return "UNKNOWN", None
    try:
        current_price = float(current_price)
        entry = float(entry)
        distance_pct = abs((current_price - entry) / entry) * 100 if entry else None
    except Exception:
        return "UNKNOWN", None

    if distance_pct is None:
        return "UNKNOWN", None
    if distance_pct <= threshold_pct:
        return "ACTIONABLE", distance_pct
    return "MOVED", distance_pct


# =========================================================
# RADAR BRIDGE
# =========================================================


def clean_symbol_for_radar(symbol: str) -> str:
    return symbol.replace(":USDT", "")


def _build_chart_candles(df, window=None):
    """
    Convert the last N rows of a trigger_df into lightweight-charts candle format.
    Each candle: { time (Unix seconds int), open, high, low, close }
    Volume is excluded — lightweight-charts CandlestickSeries doesn't use it.
    """
    if window is None:
        window = CHART_WINDOW
    try:
        recent = df.tail(window).copy()
        candles = []
        for ts, row in recent.iterrows():
            try:
                # lightweight-charts wants Unix timestamp in seconds (integer)
                unix_ts = int(ts.timestamp())
                candles.append(
                    {
                        "time": unix_ts,
                        "open": round(float(row["open"]), 8),
                        "high": round(float(row["high"]), 8),
                        "low": round(float(row["low"]), 8),
                        "close": round(float(row["close"]), 8),
                    }
                )
            except Exception:
                continue
        return candles if candles else None
    except Exception:
        return None


def pattern_contradicts_direction(pattern, direction):
    """
    Returns True if the detected pattern contradicts the sweep direction.
    A contradiction means the pattern is a stronger signal AGAINST the trade
    than the sweep is FOR it — block the alert.

    Bearish-only patterns (should never fire on a bullish sweep):
      Failed Reclaim, Hook (bearish), Sweep Watch (no follow-through)

    Bullish-only patterns (should never fire on a bearish sweep):
      (Hook and Sweep Watch can go either way — only block on Failed Reclaim)
    """
    if pattern is None:
        return False

    p = pattern.strip().lower()

    if direction == "bullish":
        # A Failed Reclaim on a bullish sweep means price swept the low
        # but then FAILED to close back above it — the move is bearish
        # Block it entirely
        if "failed reclaim" in p:
            return True

    if direction == "bearish":
        # A Failed Reclaim on a bearish sweep means price swept the high
        # but then FAILED to close back below it — the move is bullish
        if "failed reclaim" in p:
            return True

    return False


def post_sweep_to_radar(
    symbol,
    event_type,
    direction,
    strength,
    regime,
    bias,
    map_level,
    setup_level,
    liquidity_type,
    variant,
    plan,
    df,
    ema_context=None,
    shadow=False,
):
    if not ENABLE_RADAR_POST:
        return

    try:
        last = df.iloc[-1]
        current_price = (
            None if pd.isna(last.get("close", None)) else float(last.get("close", 0))
        )
        confidence = max(0.0, min(1.0, float(strength) / 100.0))

        if direction == "bullish":
            default_sweep_type = "Low Sweep"
            direction_bias = "Long"
        elif direction == "bearish":
            default_sweep_type = "High Sweep"
            direction_bias = "Short"
        else:
            default_sweep_type = "Scanner Ping"
            direction_bias = "Neutral"

        pattern = detect_pattern(direction, df, setup_level)

        # Block alerts where the detected pattern contradicts the sweep direction
        # e.g. a Failed Reclaim on a bullish sweep = price didn't actually reclaim
        if pattern_contradicts_direction(pattern, direction):
            print(
                f"[CONTRADICTION BLOCK] {symbol} {direction} blocked — "
                f"pattern '{pattern}' contradicts direction"
            )
            return

        trade_state, distance_from_entry_pct = trade_viability(
            direction,
            current_price,
            plan.get("entry"),
            threshold_pct=0.25 if TRIGGER_TIMEFRAME == "1m" else 0.50,
        )

        session = classify_time_window(df.index[-1])

        payload = {
            "id": f"{event_type.lower()}_{clean_symbol_for_radar(symbol).replace('/', '_')}_{int(time.time() * 1000)}",
            "timestampUtc": (
                last.name.isoformat()
                if hasattr(last.name, "isoformat")
                else datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
            ),
            "pair": clean_symbol_for_radar(symbol),
            "timeframe": TRIGGER_TIMEFRAME,
            "session": session,
            "directionBias": direction_bias,
            "eventType": event_type,
            "sweepType": liquidity_type if liquidity_type else default_sweep_type,
            "emaContext": ema_context or variant or "Liquidity Sweep",
            "structure": f"{regime} | {bias} | {variant}",
            "pattern": pattern,
            "tradeState": trade_state,
            "distanceFromEntryPct": (
                None
                if distance_from_entry_pct is None
                else round(float(distance_from_entry_pct), 4)
            ),
            "currentPrice": current_price,
            "price": current_price,
            "high": (
                None if pd.isna(last.get("high", None)) else float(last.get("high", 0))
            ),
            "low": (
                None if pd.isna(last.get("low", None)) else float(last.get("low", 0))
            ),
            "reclaimConfirmed": event_type in ["SWEEP_RECLAIM", "SWEEP_CONFIRMED"],
            "botConfidence": round(confidence, 4),
            "strengthScore": int(strength),
            "volumeSpike": (
                None
                if pd.isna(last.get("volume", None))
                else float(last.get("volume", 0))
            ),
            "entry": None if plan["entry"] is None else float(plan["entry"]),
            "stop": None if plan["stop"] is None else float(plan["stop"]),
            "tp1": None if plan["tp1"] is None else float(plan["tp1"]),
            "tp2": None if plan["tp2"] is None else float(plan["tp2"]),
            "rr1": None if plan["rr_tp1"] is None else float(plan["rr_tp1"]),
            "rr2": None if plan["rr_tp2"] is None else float(plan["rr_tp2"]),
            "entry_min": plan.get("entry_min"),
            "entry_max": plan.get("entry_max"),
            "state": plan.get("state"),
            "progress_to_tp1": plan.get("progress_to_tp1"),
            "stop_anchor": plan.get("stop_anchor"),
            "shadow": shadow,
            "chartCandles": _build_chart_candles(df),
        }

        sweep_headers = {
            "Content-Type": "application/json",
            "X-Sweep-Key": SWEEP_SECRET_KEY,
        }

        posted_ok = False
        for url in BRIDGE_URLS:
            try:
                resp = requests.post(
                    url, json=payload, headers=sweep_headers, timeout=BRIDGE_TIMEOUT
                )
                if resp.status_code == 401:
                    print(
                        f"[RADAR AUTH ERROR] {url} -> Invalid X-Sweep-Key. Check SWEEP_SECRET_KEY env var."
                    )
                elif resp.status_code >= 300:
                    print(f"[RADAR WARN] {url} -> {resp.status_code} {resp.text}")
                else:
                    shadow_tag = " (shadow)" if shadow else ""
                    print(f"[RADAR OK] {url} -> {payload['pair']} {event_type}{shadow_tag}")
                    posted_ok = True
            except Exception as e:
                print(f"[RADAR ERROR] {url}: {e}")

        if not posted_ok or plan.get("entry") is None or plan.get("stop") is None:
            return None

        return {
            "id": payload["id"],
            "direction": direction,
            "entry": float(plan["entry"]),
            "stop": float(plan["stop"]),
            "tp1": None if plan.get("tp1") is None else float(plan["tp1"]),
            "tp2": None if plan.get("tp2") is None else float(plan["tp2"]),
            "created_at": df.index[-1],
        }

    except Exception as e:
        print(f"[RADAR ERROR] {symbol} {event_type}: {e}")
        return None


# =========================================================
# OUTCOME TRACKING
# =========================================================


def post_outcome_update(event_id, outcome, price):
    headers = {
        "Content-Type": "application/json",
        "X-Sweep-Key": SWEEP_SECRET_KEY,
    }
    body = {"outcome": outcome, "outcomePrice": None if price is None else float(price)}
    for url in BRIDGE_URLS:
        outcome_url = url.rsplit("/sweep", 1)[0] + f"/sweep/{event_id}/outcome"
        try:
            resp = requests.patch(
                outcome_url, json=body, headers=headers, timeout=BRIDGE_TIMEOUT
            )
        except Exception as e:
            print(f"[OUTCOME ERROR] {outcome_url}: {e}")
            continue
        if resp.status_code >= 300:
            print(f"[OUTCOME WARN] {outcome_url} -> {resp.status_code} {resp.text}")
        else:
            print(f"[OUTCOME OK] {event_id} -> {outcome}")


def check_pending_outcomes(pending_outcomes, symbol, trigger_df):
    """
    For every signal still pending on this symbol, check whether price has
    since hit stop, TP1, or TP2 — whichever comes first, chronologically.
    If both a TP and the stop are touched within the same candle, the stop
    is assumed to have hit first (standard conservative backtesting
    convention — OHLC data can't tell us the true intrabar order).
    Anything unresolved past OUTCOME_TRACK_MAX_HOURS is marked EXPIRED.
    """
    symbol_pending = pending_outcomes.get(symbol)
    if not symbol_pending:
        return

    now_ts = trigger_df.index[-1]
    resolved_ids = []

    for event_id, sig in symbol_pending.items():
        candles = trigger_df[trigger_df.index > sig["created_at"]]
        outcome = None
        price = None

        for _, c in candles.iterrows():
            if sig["direction"] == "bullish":
                stop_hit = c["low"] <= sig["stop"]
                tp1_hit = sig["tp1"] is not None and c["high"] >= sig["tp1"]
                tp2_hit = sig["tp2"] is not None and c["high"] >= sig["tp2"]
            else:
                stop_hit = c["high"] >= sig["stop"]
                tp1_hit = sig["tp1"] is not None and c["low"] <= sig["tp1"]
                tp2_hit = sig["tp2"] is not None and c["low"] <= sig["tp2"]

            if stop_hit:
                outcome, price = "STOPPED", sig["stop"]
                break
            elif tp2_hit:
                outcome, price = "TP2_HIT", sig["tp2"]
                break
            elif tp1_hit:
                outcome, price = "TP1_HIT", sig["tp1"]
                break

        if outcome is None:
            age_hours = (now_ts - sig["created_at"]).total_seconds() / 3600
            if age_hours >= OUTCOME_TRACK_MAX_HOURS:
                outcome, price = "EXPIRED", None

        if outcome is not None:
            post_outcome_update(event_id, outcome, price)
            resolved_ids.append(event_id)

    for event_id in resolved_ids:
        del symbol_pending[event_id]
    if not symbol_pending:
        pending_outcomes.pop(symbol, None)


def register_pending_outcome(pending_outcomes, symbol, tracked):
    if not tracked:
        return
    pending_outcomes.setdefault(symbol, {})[tracked["id"]] = tracked


def post_keepalive_ping(symbol, df, regime, bias):
    if not ENABLE_RADAR_POST or not ENABLE_KEEPALIVE_PINGS:
        return

    plan = {
        "entry": None,
        "stop": None,
        "tp1": None,
        "tp2": None,
        "rr_tp1": None,
        "rr_tp2": None,
    }

    post_sweep_to_radar(
        symbol=symbol,
        event_type=PING_EVENT_TYPE,
        direction="neutral",
        strength=12,
        regime=regime,
        bias=bias,
        map_level=None,
        setup_level=None,
        liquidity_type="Scanner Ping",
        variant="keepalive",
        plan=plan,
        df=df,
        ema_context="Scanner Keepalive",
    )


# =========================================================
# ALERT HELPERS
# =========================================================


def plan_fields(plan):
    return [
        (
            "Trade Math",
            f"Entry `{plan['entry']:.4f}`\n"
            f"Stop `{plan['stop']:.4f}`\n"
            f"TP1 `{plan['tp1']:.4f}` | RR `{rr_text(plan['rr_tp1'])}`\n"
            f"TP2 `{plan['tp2']:.4f}` | RR `{rr_text(plan['rr_tp2'])}`",
        )
    ]


def send_detected_alert(
    symbol,
    df,
    direction,
    strength,
    variant,
    regime,
    bias,
    map_level,
    setup_level,
    liquidity_type,
    plan,
):
    title = "🟡⚠️ SWEEP DETECTED ⚠️🟡"
    desc = (
        f"Liquidity pool hit on setup timeframe.\n"
        f"Direction: **{direction.upper()}**\n"
        f"Strength: `{strength}/100 ({strength_label(strength)})`"
    )
    extra = [
        ("Variant", f"`{variant}`"),
        (
            "Liquidity Pool",
            f"`{liquidity_type}` | map `{map_level:.4f}` | setup `{setup_level:.4f}`",
        ),
        ("Regime / Bias", f"`{regime}` / `{bias}`"),
        ("Time Window", f"`{classify_time_window(df.index[-1])}`"),
    ] + plan_fields(plan)
    embed, chart = build_embed(
        symbol,
        title,
        desc,
        0xF1C40F,
        df,
        extra_fields=extra,
        level=setup_level,
        direction=direction,
        liquidity_type=liquidity_type,
    )
    send_discord_alert(embed, chart)


def send_reclaim_alert(
    symbol,
    df,
    direction,
    strength,
    variant,
    regime,
    bias,
    map_level,
    setup_level,
    liquidity_type,
    plan,
):
    title = "🟢♻️ SWEEP RECLAIM ♻️🟢"
    desc = (
        f"Swept level reclaimed on trigger timeframe.\n"
        f"Direction: **{direction.upper()}**\n"
        f"Strength: `{strength}/100 ({strength_label(strength)})`"
    )
    extra = [
        ("Variant", f"`{variant}`"),
        (
            "Liquidity Pool",
            f"`{liquidity_type}` | map `{map_level:.4f}` | setup `{setup_level:.4f}`",
        ),
        ("Regime / Bias", f"`{regime}` / `{bias}`"),
        ("Time Window", f"`{classify_time_window(df.index[-1])}`"),
    ] + plan_fields(plan)
    embed, chart = build_embed(
        symbol,
        title,
        desc,
        0x2ECC71,
        df,
        extra_fields=extra,
        level=setup_level,
        direction=direction,
        liquidity_type=liquidity_type,
    )
    send_discord_alert(embed, chart)


def send_accepted_alert(
    symbol,
    df,
    direction,
    strength,
    variant,
    regime,
    bias,
    map_level,
    setup_level,
    liquidity_type,
    plan,
):
    title = "🟠📉 SWEEP ACCEPTED 📉🟠"
    desc = (
        f"Price accepted beyond swept level.\n"
        f"Direction: **{direction.upper()}**\n"
        f"Strength: `{strength}/100 ({strength_label(strength)})`"
    )
    extra = [
        ("Variant", f"`{variant}`"),
        (
            "Liquidity Pool",
            f"`{liquidity_type}` | map `{map_level:.4f}` | setup `{setup_level:.4f}`",
        ),
        ("Regime / Bias", f"`{regime}` / `{bias}`"),
        ("Time Window", f"`{classify_time_window(df.index[-1])}`"),
    ] + plan_fields(plan)
    embed, chart = build_embed(
        symbol,
        title,
        desc,
        0xE67E22,
        df,
        extra_fields=extra,
        level=setup_level,
        direction=direction,
        liquidity_type=liquidity_type,
    )
    send_discord_alert(embed, chart)


def send_confirmed_alert(
    symbol,
    df,
    direction,
    strength,
    variant,
    regime,
    bias,
    map_level,
    setup_level,
    liquidity_type,
    plan,
):
    title = "🟥🧨 SWEEP CONFIRMED 🧨🟥"
    desc = (
        f"Displacement confirmed away from the reclaimed level.\n"
        f"Direction: **{direction.upper()}**\n"
        f"Strength: `{strength}/100 ({strength_label(strength)})`"
    )
    extra = [
        ("Variant", f"`{variant}`"),
        (
            "Liquidity Pool",
            f"`{liquidity_type}` | map `{map_level:.4f}` | setup `{setup_level:.4f}`",
        ),
        ("Regime / Bias", f"`{regime}` / `{bias}`"),
        ("Time Window", f"`{classify_time_window(df.index[-1])}`"),
    ] + plan_fields(plan)
    embed, chart = build_embed(
        symbol,
        title,
        desc,
        0xE74C3C,
        df,
        extra_fields=extra,
        level=setup_level,
        direction=direction,
        liquidity_type=liquidity_type,
    )
    send_discord_alert(embed, chart)


def send_double_sweep_alert(
    symbol,
    df,
    direction,
    strength,
    regime,
    bias,
    map_level,
    setup_level,
    liquidity_type,
    plan,
):
    title = "🟣🪤 DOUBLE SWEEP 🪤🟣"
    desc = (
        f"Repeated attack into same liquidity pool.\n"
        f"Direction: **{direction.upper()}**\n"
        f"Strength: `{strength}/100 ({strength_label(strength)})`"
    )
    extra = [
        ("Variant", "`double_sweep`"),
        (
            "Liquidity Pool",
            f"`{liquidity_type}` | map `{map_level:.4f}` | setup `{setup_level:.4f}`",
        ),
        ("Regime / Bias", f"`{regime}` / `{bias}`"),
        ("Time Window", f"`{classify_time_window(df.index[-1])}`"),
    ] + plan_fields(plan)
    embed, chart = build_embed(
        symbol,
        title,
        desc,
        0x9B59B6,
        df,
        extra_fields=extra,
        level=setup_level,
        direction=direction,
        liquidity_type=liquidity_type,
    )
    send_discord_alert(embed, chart)


# =========================================================
# MAIN LOOP
# =========================================================


def main_loop():
    exchange = init_exchange()
    symbols = get_sweep_hunter_symbols(exchange)

    print("[RUN] Sweep Hunter v42.0 NOISE FILTERED started.\n")
    for s in symbols:
        print("  ", s)
    print()
    print(f"[INFO] Total symbols: {len(symbols)}")
    print(f"[INFO] Approx requests per cycle: {len(symbols) * 3}")
    print()

    last_detected = {}
    last_detected_level = {}  # [FILTER 7] level-reset guard
    last_reclaim = {}
    last_accepted = {}
    last_confirmed = {}
    last_confirmed_level = {}  # one CONFIRMED per sweep, not per cooldown window
    last_double = {}
    last_ping = {}

    last_sweep_meta = {}
    trigger_bar_state = {}
    pending_outcomes = {}  # {symbol: {event_id: {direction, entry, stop, tp1, tp2, created_at}}}
    cycle_num = 0

    while True:
        cycle_num += 1
        cycle_start = time.time()

        det_count = 0
        reclaim_count = 0
        accepted_count = 0
        confirmed_count = 0
        double_count = 0
        err_count = 0

        dbg(f"\n{'='*60}")
        dbg(f"[CYCLE {cycle_num}] START {datetime.now(UTC).strftime('%H:%M:%S')} UTC")
        dbg(f"{'='*60}")

        for i, symbol in enumerate(symbols, 1):
            sym_start = time.time()

            try:
                if PRINT_EVERY_SYMBOL:
                    print(f"[SCAN {i}/{len(symbols)}] {symbol}")

                fetch_start = time.time()
                map_df = fetch_ohlcv_df(exchange, symbol, MAP_TIMEFRAME, LIMIT_MAP)
                setup_df = fetch_ohlcv_df(
                    exchange, symbol, SETUP_TIMEFRAME, LIMIT_SETUP
                )
                trigger_df = fetch_ohlcv_df(
                    exchange, symbol, TRIGGER_TIMEFRAME, LIMIT_TRIGGER
                )
                fetch_elapsed = time.time() - fetch_start

                dbg(f"   [FETCH] {symbol} took {fetch_elapsed:.2f}s")

                if map_df is None or setup_df is None or trigger_df is None:
                    dbg("   [SKIP] Missing dataframe(s)")
                    continue

                if len(map_df) < 50 or len(setup_df) < 50 or len(trigger_df) < 80:
                    dbg(
                        f"   [SKIP] Not enough candles "
                        f"(5m={len(map_df)}, 3m={len(setup_df)}, 1m={len(trigger_df)})"
                    )
                    continue

                map_df = add_indicators(map_df)
                setup_df = add_indicators(setup_df)
                trigger_df = add_indicators(trigger_df)

                check_pending_outcomes(pending_outcomes, symbol, trigger_df)

                regime, bias = compute_regime_and_bias(setup_df)

                trigger_ts = trigger_df.index[-1]
                prev_state = trigger_bar_state.get(symbol)
                if prev_state is None or prev_state["ts"] != trigger_ts:
                    trigger_bar_state[symbol] = {"ts": trigger_ts, "seen": 1}
                else:
                    prev_state["seen"] += 1
                    if prev_state["seen"] > 1:
                        dbg(
                            f"   [SKIP] {symbol} — same bar already processed, skipping"
                        )
                        continue

                (
                    sweep_flag,
                    sweep_dir,
                    strength,
                    map_level,
                    setup_level,
                    base_variant,
                    liquidity_type,
                ) = detect_setup_sweep(setup_df, map_df)

                if "SUI" in symbol:
                    print(
                        f"   [SUI DEBUG] flag={sweep_flag} dir={sweep_dir} strength={strength} liq={liquidity_type}"
                    )

                dbg(
                    f"   [SETUP CHECK] flag={sweep_flag} dir={sweep_dir} "
                    f"strength={strength} liq={liquidity_type}"
                )

                now = time.time()

                # Keepalive ping
                if (
                    (not sweep_flag)
                    and ENABLE_KEEPALIVE_PINGS
                    and PING_EVERY_N_CYCLES > 0
                    and cycle_num % PING_EVERY_N_CYCLES == 0
                ):
                    if now - last_ping.get(symbol, 0) > PING_COOLDOWN:
                        post_keepalive_ping(symbol, trigger_df, regime, bias)
                        last_ping[symbol] = now

                if sweep_flag and sweep_dir:
                    prev_meta = last_sweep_meta.get(symbol)
                    variant = classify_variant(
                        current_dir=sweep_dir,
                        current_level=setup_level,
                        current_ts=setup_df.index[-1],
                        prev_meta=prev_meta,
                    )

                    _anchor = (
                        map_level
                        if (
                            map_level is not None
                            and liquidity_type in ("Equal Highs", "Equal Lows")
                        )
                        else setup_level
                    )
                    plan = build_rr_plan(
                        direction=sweep_dir,
                        trigger_df=trigger_df,
                        map_levels=get_map_liquidity_levels(map_df),
                        sweep_level=_anchor,
                        reclaim_level=trigger_df.iloc[-1]["close"],
                    )
                    dbg(
                        f"   [SETUP SWEEP] dir={sweep_dir} strength={strength} "
                        f"variant={variant} rr1={rr_text(plan['rr_tp1'])} "
                        f"rr2={rr_text(plan['rr_tp2'])}"
                    )

                    # [FILTER 15] Store sweep_ts for reclaim staleness check
                    last_sweep_meta[symbol] = {
                        "dir": sweep_dir,
                        "level": setup_level,
                        "map_level": map_level,
                        "ts": setup_df.index[-1],
                        "sweep_ts": setup_df.index[-1],  # used by reclaim gate
                        "strength": strength,
                        "variant": variant,
                        "liquidity_type": liquidity_type,
                        "regime": regime,
                        "bias": bias,
                    }

                    # Double sweep
                    if variant == "double_sweep" and (
                        now - last_double.get(symbol, 0) > DOUBLE_SWEEP_COOLDOWN
                    ):
                        if (
                            plan["rr_tp2"] is not None
                            and plan["rr_tp2"] >= MIN_RR_TO_ALERT
                        ):
                            if moved_should_skip(plan, "DOUBLE_SWEEP"):
                                print(
                                    f"[MOVED SKIP] {symbol} DOUBLE_SWEEP "
                                    f"progress={plan.get('progress_to_tp1')}"
                                )
                                last_double[symbol] = now
                            else:
                                is_shadow = (
                                    not DOUBLE_SWEEP_ENABLED
                                    or strength < MIN_CONFIDENCE_TO_POST
                                )
                                if is_shadow:
                                    dbg(
                                        f"   [SHADOW] {symbol} DOUBLE_SWEEP "
                                        f"strength={strength} enabled={DOUBLE_SWEEP_ENABLED}"
                                    )
                                else:
                                    print(
                                        f"[DOUBLE SWEEP] {symbol} {sweep_dir} strength={strength}"
                                    )
                                    send_double_sweep_alert(
                                        symbol,
                                        trigger_df,
                                        sweep_dir,
                                        strength,
                                        regime,
                                        bias,
                                        map_level,
                                        setup_level,
                                        liquidity_type,
                                        plan,
                                    )
                                tracked = post_sweep_to_radar(
                                    symbol=symbol,
                                    event_type="DOUBLE_SWEEP",
                                    direction=sweep_dir,
                                    strength=strength,
                                    regime=regime,
                                    bias=bias,
                                    map_level=map_level,
                                    setup_level=setup_level,
                                    liquidity_type=liquidity_type,
                                    variant="double_sweep",
                                    plan=plan,
                                    df=trigger_df,
                                    ema_context="Double Sweep",
                                    shadow=is_shadow,
                                )
                                register_pending_outcome(
                                    pending_outcomes, symbol, tracked
                                )
                                last_double[symbol] = now
                                if not is_shadow:
                                    double_count += 1
                    # [FILTER 7] DETECTED: cooldown + level-reset guard
                    level_moved = (
                        symbol not in last_detected_level
                        or abs(setup_level - last_detected_level[symbol])
                        / (setup_level + 1e-9)
                        > 0.002
                    )
                    cooldown_ok = now - last_detected.get(symbol, 0) > DETECTED_COOLDOWN

                    if cooldown_ok and level_moved:
                        if (
                            plan["rr_tp2"] is not None
                            and plan["rr_tp2"] >= MIN_RR_TO_ALERT
                        ):
                            if moved_should_skip(plan, "SWEEP_DETECTED"):
                                print(
                                    f"[MOVED SKIP] {symbol} DETECTED "
                                    f"progress={plan.get('progress_to_tp1')}"
                                )
                                last_detected[symbol] = now
                                last_detected_level[symbol] = setup_level
                            else:
                                weak_pattern = (
                                    detect_pattern(sweep_dir, trigger_df, setup_level)
                                    in WEAK_PATTERNS
                                )
                                is_shadow = (
                                    strength < MIN_CONFIDENCE_TO_POST or weak_pattern
                                )
                                if is_shadow:
                                    dbg(
                                        f"   [SHADOW] {symbol} DETECTED strength={strength}"
                                    )
                                else:
                                    print(
                                        f"[DETECTED] {symbol} {sweep_dir} "
                                        f"strength={strength} variant={variant}"
                                    )
                                    send_detected_alert(
                                        symbol,
                                        trigger_df,
                                        sweep_dir,
                                        strength,
                                        variant,
                                        regime,
                                        bias,
                                        map_level,
                                        setup_level,
                                        liquidity_type,
                                        plan,
                                    )
                                tracked = post_sweep_to_radar(
                                    symbol=symbol,
                                    event_type="SWEEP_DETECTED",
                                    direction=sweep_dir,
                                    strength=strength,
                                    regime=regime,
                                    bias=bias,
                                    map_level=map_level,
                                    setup_level=setup_level,
                                    liquidity_type=liquidity_type,
                                    variant=variant,
                                    plan=plan,
                                    df=trigger_df,
                                    ema_context="Setup Sweep Detected",
                                    shadow=is_shadow,
                                )
                                register_pending_outcome(
                                    pending_outcomes, symbol, tracked
                                )

                                if not is_shadow:
                                    c = trigger_df.iloc[-1]
                                    vol_avg10 = (
                                        trigger_df["volume"].rolling(10).mean().iloc[-2]
                                    )
                                    log_sweep_event(
                                        symbol=symbol,
                                        event="DETECTED",
                                        direction=sweep_dir,
                                        strength=strength,
                                        price=c["close"],
                                        map_level=map_level,
                                        setup_level=setup_level,
                                        liquidity_type=liquidity_type,
                                        regime=regime,
                                        bias=bias,
                                        volume=c["volume"],
                                        vol_avg10=vol_avg10,
                                        range_abs=c["range_abs"],
                                        range_pct=c["range_pct"],
                                        atr14=c["atr14"],
                                        variant=variant,
                                        entry=plan["entry"],
                                        stop=plan["stop"],
                                        tp1=plan["tp1"],
                                        tp2=plan["tp2"],
                                        rr_tp1=plan["rr_tp1"],
                                        rr_tp2=plan["rr_tp2"],
                                        ts_utc=trigger_df.index[-1],
                                    )
                                    det_count += 1
                                last_detected[symbol] = now
                                last_detected_level[symbol] = setup_level

                # Trigger-level checks (reclaim / accepted / confirmed)
                if symbol in last_sweep_meta:
                    sm = last_sweep_meta[symbol]
                    direction = sm["dir"]
                    setup_level = sm["level"]
                    map_level = sm["map_level"]
                    strength = sm["strength"]
                    variant = sm["variant"]
                    liquidity_type = sm["liquidity_type"]
                    sweep_ts = sm.get("sweep_ts")  # [FILTER 15]

                    # [FILTER 10] Pass sweep_ts for staleness check
                    _reclaim_level = (
                        map_level
                        if (
                            map_level is not None
                            and liquidity_type in ("Equal Highs", "Equal Lows")
                        )
                        else setup_level
                    )
                    trigger_state = detect_reclaim_or_acceptance(
                        trigger_df,
                        direction,
                        _reclaim_level,
                        sweep_timestamp=sweep_ts,
                    )
                    dbg(f"   [TRIGGER STATE] {trigger_state}")

                    _anchor = (
                        map_level
                        if (
                            map_level is not None
                            and liquidity_type in ("Equal Highs", "Equal Lows")
                        )
                        else setup_level
                    )
                    plan = build_rr_plan(
                        direction=direction,
                        trigger_df=trigger_df,
                        map_levels=get_map_liquidity_levels(map_df),
                        sweep_level=_anchor,
                        reclaim_level=trigger_df.iloc[-1]["close"],
                    )

                    session = classify_time_window(trigger_df.index[-1])

                    if trigger_state == "reclaim" and (
                        now - last_reclaim.get(symbol, 0) > RECLAIM_COOLDOWN
                    ):
                        if (
                            plan["rr_tp2"] is not None
                            and plan["rr_tp2"] >= MIN_RR_TO_ALERT
                        ):
                            scored = compute_institutional_score(
                                strength,
                                "RECLAIM",
                                plan["rr_tp2"],
                                bias,
                                session=session,
                                liquidity_type=liquidity_type,
                                progress=plan.get("progress_to_tp1"),
                            )
                            weak_pattern = (
                                detect_pattern(direction, trigger_df, setup_level)
                                in WEAK_PATTERNS
                            )
                            is_shadow = (
                                scored < MIN_CONFIDENCE_TO_POST or weak_pattern
                            )
                            if is_shadow:
                                dbg(f"   [SHADOW] {symbol} RECLAIM score={scored}")
                            else:
                                print(
                                    f"[RECLAIM] {symbol} {direction} "
                                    f"strength={strength} score={scored} "
                                    f"rr2={rr_text(plan['rr_tp2'])}"
                                )
                                send_reclaim_alert(
                                    symbol,
                                    trigger_df,
                                    direction,
                                    strength,
                                    variant,
                                    regime,
                                    bias,
                                    map_level,
                                    setup_level,
                                    liquidity_type,
                                    plan,
                                )
                            tracked = post_sweep_to_radar(
                                symbol=symbol,
                                event_type="SWEEP_RECLAIM",
                                direction=direction,
                                strength=scored,
                                regime=regime,
                                bias=bias,
                                map_level=map_level,
                                setup_level=setup_level,
                                liquidity_type=liquidity_type,
                                variant=variant,
                                plan=plan,
                                df=trigger_df,
                                ema_context="Sweep Reclaim",
                                shadow=is_shadow,
                            )
                            register_pending_outcome(pending_outcomes, symbol, tracked)

                            if not is_shadow:
                                c = trigger_df.iloc[-1]
                                vol_avg10 = trigger_df["volume"].rolling(10).mean().iloc[-2]
                                log_sweep_event(
                                    symbol=symbol,
                                    event="RECLAIM",
                                    direction=direction,
                                    strength=scored,
                                    price=c["close"],
                                    map_level=map_level,
                                    setup_level=setup_level,
                                    liquidity_type=liquidity_type,
                                    regime=regime,
                                    bias=bias,
                                    volume=c["volume"],
                                    vol_avg10=vol_avg10,
                                    range_abs=c["range_abs"],
                                    range_pct=c["range_pct"],
                                    atr14=c["atr14"],
                                    variant=variant,
                                    entry=plan["entry"],
                                    stop=plan["stop"],
                                    tp1=plan["tp1"],
                                    tp2=plan["tp2"],
                                    rr_tp1=plan["rr_tp1"],
                                    rr_tp2=plan["rr_tp2"],
                                    ts_utc=trigger_df.index[-1],
                                )
                                reclaim_count += 1
                            last_reclaim[symbol] = now

                    if trigger_state == "accepted" and (
                        now - last_accepted.get(symbol, 0) > ACCEPTED_COOLDOWN
                    ):
                        scored = compute_institutional_score(
                            strength,
                            "ACCEPTED",
                            plan["rr_tp2"],
                            bias,
                            session=session,
                            liquidity_type=liquidity_type,
                            progress=plan.get("progress_to_tp1"),
                        )
                        weak_pattern = (
                            detect_pattern(direction, trigger_df, setup_level)
                            in WEAK_PATTERNS
                        )
                        is_shadow = scored < MIN_CONFIDENCE_TO_POST or weak_pattern
                        if is_shadow:
                            dbg(f"   [SHADOW] {symbol} ACCEPTED score={scored}")
                        else:
                            print(f"[ACCEPTED] {symbol} {direction} strength={strength}")
                            send_accepted_alert(
                                symbol,
                                trigger_df,
                                direction,
                                strength,
                                variant,
                                regime,
                                bias,
                                map_level,
                                setup_level,
                                liquidity_type,
                                plan,
                            )
                        tracked = post_sweep_to_radar(
                            symbol=symbol,
                            event_type="SWEEP_ACCEPTED",
                            direction=direction,
                            strength=scored,
                            regime=regime,
                            bias=bias,
                            map_level=map_level,
                            setup_level=setup_level,
                            liquidity_type=liquidity_type,
                            variant=variant,
                            plan=plan,
                            df=trigger_df,
                            ema_context="Sweep Accepted",
                            shadow=is_shadow,
                        )
                        register_pending_outcome(pending_outcomes, symbol, tracked)

                        if not is_shadow:
                            c = trigger_df.iloc[-1]
                            vol_avg10 = trigger_df["volume"].rolling(10).mean().iloc[-2]
                            log_sweep_event(
                                symbol=symbol,
                                event="ACCEPTED",
                                direction=direction,
                                strength=scored,
                                price=c["close"],
                                map_level=map_level,
                                setup_level=setup_level,
                                liquidity_type=liquidity_type,
                                regime=regime,
                                bias=bias,
                                volume=c["volume"],
                                vol_avg10=vol_avg10,
                                range_abs=c["range_abs"],
                                range_pct=c["range_pct"],
                                atr14=c["atr14"],
                                variant=variant,
                                entry=plan["entry"],
                                stop=plan["stop"],
                                tp1=plan["tp1"],
                                tp2=plan["tp2"],
                                rr_tp1=plan["rr_tp1"],
                                rr_tp2=plan["rr_tp2"],
                                ts_utc=trigger_df.index[-1],
                            )
                            accepted_count += 1
                        last_accepted[symbol] = now

                    if detect_confirmed_displacement(
                        trigger_df, direction, plan["entry"]
                    ):
                        dbg("   [CONFIRM CHECK] True")
                        # One CONFIRMED per sweep: once fired for this setup_level,
                        # displacement staying true every cycle shouldn't keep
                        # re-posting the same (increasingly stale) entry/stop/tp.
                        confirmed_level_is_new = (
                            symbol not in last_confirmed_level
                            or abs(setup_level - last_confirmed_level[symbol])
                            / (setup_level + 1e-9)
                            > 0.002
                        )
                        if (
                            confirmed_level_is_new
                            and now - last_confirmed.get(symbol, 0) > CONFIRMED_COOLDOWN
                        ):
                            if (
                                plan["rr_tp2"] is not None
                                and plan["rr_tp2"] >= MIN_RR_TO_ALERT
                            ):
                                scored = compute_institutional_score(
                                    strength,
                                    "CONFIRMED",
                                    plan["rr_tp2"],
                                    bias,
                                    session=session,
                                    liquidity_type=liquidity_type,
                                    progress=plan.get("progress_to_tp1"),
                                )
                                weak_pattern = (
                                    detect_pattern(direction, trigger_df, setup_level)
                                    in WEAK_PATTERNS
                                )
                                is_shadow = (
                                    scored < MIN_CONFIDENCE_TO_POST or weak_pattern
                                )
                                if is_shadow:
                                    dbg(f"   [SHADOW] {symbol} CONFIRMED score={scored}")
                                else:
                                    print(
                                        f"[CONFIRMED] {symbol} {direction} "
                                        f"strength={strength} score={scored}"
                                    )
                                    send_confirmed_alert(
                                        symbol,
                                        trigger_df,
                                        direction,
                                        strength,
                                        variant,
                                        regime,
                                        bias,
                                        map_level,
                                        setup_level,
                                        liquidity_type,
                                        plan,
                                    )
                                tracked = post_sweep_to_radar(
                                    symbol=symbol,
                                    event_type="SWEEP_CONFIRMED",
                                    direction=direction,
                                    strength=scored,
                                    regime=regime,
                                    bias=bias,
                                    map_level=map_level,
                                    setup_level=setup_level,
                                    liquidity_type=liquidity_type,
                                    variant=variant,
                                    plan=plan,
                                    df=trigger_df,
                                    ema_context="Sweep Confirmed",
                                    shadow=is_shadow,
                                )
                                register_pending_outcome(
                                    pending_outcomes, symbol, tracked
                                )

                                if not is_shadow:
                                    c = trigger_df.iloc[-1]
                                    vol_avg10 = (
                                        trigger_df["volume"].rolling(10).mean().iloc[-2]
                                    )
                                    log_sweep_event(
                                        symbol=symbol,
                                        event="CONFIRMED",
                                        direction=direction,
                                        strength=scored,
                                        price=c["close"],
                                        map_level=map_level,
                                        setup_level=setup_level,
                                        liquidity_type=liquidity_type,
                                        regime=regime,
                                        bias=bias,
                                        volume=c["volume"],
                                        vol_avg10=vol_avg10,
                                        range_abs=c["range_abs"],
                                        range_pct=c["range_pct"],
                                        atr14=c["atr14"],
                                        variant=variant,
                                        entry=plan["entry"],
                                        stop=plan["stop"],
                                        tp1=plan["tp1"],
                                        tp2=plan["tp2"],
                                        rr_tp1=plan["rr_tp1"],
                                        rr_tp2=plan["rr_tp2"],
                                        ts_utc=trigger_df.index[-1],
                                    )
                                    confirmed_count += 1
                                last_confirmed[symbol] = now
                                last_confirmed_level[symbol] = setup_level
                    else:
                        dbg("   [CONFIRM CHECK] False")

                sym_elapsed = time.time() - sym_start
                dbg(f"   [DONE] {symbol} in {sym_elapsed:.2f}s")

                if (
                    DEBUG_MODE
                    and not PRINT_EVERY_SYMBOL
                    and i % HEARTBEAT_EVERY_N_SYMBOLS == 0
                ):
                    print(f"[HEARTBEAT] scanned {i}/{len(symbols)} symbols this cycle")

            except Exception as e:
                err_count += 1
                print(f"[WARN] Loop error {symbol}: {e}")
                traceback.print_exc()

        elapsed = time.time() - cycle_start

        if PRINT_CYCLE_SUMMARY:
            print(
                f"[CYCLE {cycle_num} DONE] "
                f"{elapsed:.2f}s | detected={det_count} reclaim={reclaim_count} "
                f"accepted={accepted_count} confirmed={confirmed_count} "
                f"double={double_count} errors={err_count}"
            )

        time.sleep(max(MIN_SLEEP, LOOP_SLEEP - elapsed))


# =========================================================
# ENTRYPOINT
# =========================================================

if __name__ == "__main__":
    main_loop()
