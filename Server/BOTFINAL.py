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

BRIDGE_URLS = [
    "http://localhost:5000/sweep",
    "https://liquidity-lab-api.onrender.com/sweep",
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
COUNTER_TREND_MIN_STRENGTH = 65  # [FILTER 8] counter-trend sweeps need this

# Reclaim staleness
RECLAIM_MAX_AGE_MINUTES = 15  # [FILTER 10] reclaims older than this are stale

# Off-hours gate
OFF_HOURS_MIN_STRENGTH = 60  # [FILTER 9] DETECTED skipped below this off-hours

# RR settings
STOP_BUFFER_PCT = 0.0015
TP1_BUFFER_PCT = 0.0005
TP2_BUFFER_PCT = 0.0010
MIN_RR_TO_ALERT = 1.5  # TP2 must be >= 1.5R to fire any alert

# Cooldowns
DETECTED_COOLDOWN = 240  # [FILTER 7] was 30
RECLAIM_COOLDOWN = 45  # was 30
ACCEPTED_COOLDOWN = 45  # was 30
CONFIRMED_COOLDOWN = 45  # was 30
DOUBLE_SWEEP_COOLDOWN = 240
PING_COOLDOWN = 120

# Double sweep
DOUBLE_SWEEP_MAX_BARS = 12
DOUBLE_SWEEP_LEVEL_TOL = 0.0015
DOUBLE_SWEEP_DIR_REQUIRED = True

CHART_WINDOW = (
    300  # 5 hours on 1m — matches trigger lookback so sweep origin is always visible
)
# =========================================================
# DEBUG / MONITORING
# =========================================================

DEBUG_MODE = True
PRINT_EVERY_SYMBOL = True
PRINT_CYCLE_SUMMARY = True
HEARTBEAT_EVERY_N_SYMBOLS = 3

USE_SMALL_TEST_BASKET = True
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
    "ICP/USDT:USDT",
    "KAS/USDT:USDT",
    "JASMY/USDT:USDT",
    "ONDO/USDT:USDT",
    "FET/USDT:USDT",
    "FIL/USDT:USDT",
    "SUI/USDT:USDT",
    "SEI/USDT:USDT",
    "OP/USDT:USDT",
    "ARB/USDT:USDT",
    "SOL/USDT:USDT",
    "NEAR/USDT:USDT",
    "APT/USDT:USDT",
    "ROSE/USDT:USDT",
    "MINA/USDT:USDT",
    "DOGE/USDT:USDT",
    "XRP/USDT:USDT",
    "LINK/USDT:USDT",
    "AVAX/USDT:USDT",
    "BTC/USDT:USDT",
    "ETH/USDT:USDT",
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


def build_rr_plan(direction, trigger_df, map_levels, sweep_level, reclaim_level=None):
    last = trigger_df.iloc[-1]
    atr = last["atr14"] if not pd.isna(last["atr14"]) else 0
    px = float(last["close"])

    base_level = float(sweep_level) if sweep_level is not None else px
    buffer = max(px * STOP_BUFFER_PCT, atr * 0.15)
    retest_offset = max(px * 0.0005, atr * 0.08)

    recent = trigger_df.tail(36).copy()
    local_high = float(recent["high"].max())
    local_low = float(recent["low"].min())

    # ATR-scaled TP buffer — replaces fixed TP1_BUFFER_PCT/TP2_BUFFER_PCT
    # Ensures meaningful separation between entry and TP levels on all price ranges
    # Small coins (DOGE $0.08): ATR ~0.0003, buffer = 0.00015 — visible on chart
    # Large coins (BTC $60k): ATR ~200, buffer = 100 — meaningful dollar distance
    atr_tp1_buffer = atr * 0.50  # TP1 pulls back from local extreme by 0.5x ATR
    atr_tp2_buffer = atr * 0.25  # TP2 extends beyond local extreme by 0.25x ATR

    if direction == "bullish":
        entry = base_level + retest_offset
        stop = base_level - buffer
        risk = entry - stop

        # TP1 = local high minus ATR buffer (conservative, high probability)
        tp1 = local_high - atr_tp1_buffer
        # TP2 = local high plus ATR buffer (extension target)
        tp2 = local_high + atr_tp2_buffer

        # Fallback: if local high is too close, use RR-based targets
        if tp1 <= entry:
            tp1 = entry + risk * 1.5
        if tp2 <= tp1:
            tp2 = entry + risk * 2.5
        # Minimum separation — aggressive for small coins
        # TP1 must be at least 2R from entry, TP2 at least 1.5R beyond TP1
        if (tp1 - entry) < risk * 2.0:
            tp1 = entry + risk * 2.0
        if (tp2 - tp1) < risk * 1.5:
            tp2 = tp1 + risk * 1.5

    else:
        entry = base_level - retest_offset
        stop = base_level + buffer
        risk = stop - entry

        # TP1 = local low plus ATR buffer (conservative, high probability)
        tp1 = local_low + atr_tp1_buffer
        # TP2 = local low minus ATR buffer (extension target)
        tp2 = local_low - atr_tp2_buffer

        # Fallback: if local low is too close, use RR-based targets
        if tp1 >= entry:
            tp1 = entry - risk * 2.0
        if tp2 >= tp1:
            tp2 = entry - risk * 3.5
        # Minimum separation — aggressive for small coins
        if (entry - tp1) < risk * 2.0:
            tp1 = entry - risk * 2.0
        if (tp1 - tp2) < risk * 1.5:
            tp2 = tp1 - risk * 1.5

    rr1, rr2 = calc_rr(direction, entry, stop, tp1, tp2)

    return {
        "entry": entry,
        "stop": stop,
        "tp1": tp1,
        "tp2": tp2,
        "rr_tp1": rr1,
        "rr_tp2": rr2,
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

    strength = int(min(max(strength, 0), 100))

    # Gate 4: Minimum strength [FILTER 3]
    if strength < MIN_SETUP_STRENGTH:
        return FAIL

    # Gate 5: Bias alignment [FILTER 8]
    _, bias = compute_regime_and_bias(setup_df)

    if not is_aligned_with_bias(direction, bias):
        if strength < COUNTER_TREND_MIN_STRENGTH:
            return FAIL
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
    strength, event_type, rr2=None, bias=None, session=None, liquidity_type=None
):
    """
    Upgraded: session timing and liquidity pool type now factor into score.
    Uses a float internally then clamps at the end to preserve differentiation.
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
            logger.info(
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
            "chartCandles": _build_chart_candles(df),
        }

        sweep_headers = {
            "Content-Type": "application/json",
            "X-Sweep-Key": SWEEP_SECRET_KEY,
        }

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
                    print(f"[RADAR OK] {url} -> {payload['pair']} {event_type}")
            except Exception as e:
                print(f"[RADAR ERROR] {url}: {e}")

    except Exception as e:
        print(f"[RADAR ERROR] {symbol} {event_type}: {e}")


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
    last_double = {}
    last_ping = {}

    last_sweep_meta = {}
    trigger_bar_state = {}
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

                regime, bias = compute_regime_and_bias(setup_df)

                trigger_ts = trigger_df.index[-1]
                prev_state = trigger_bar_state.get(symbol)
                if prev_state is None or prev_state["ts"] != trigger_ts:
                    trigger_bar_state[symbol] = {"ts": trigger_ts, "seen": 1}
                else:
                    prev_state["seen"] += 1

                (
                    sweep_flag,
                    sweep_dir,
                    strength,
                    map_level,
                    setup_level,
                    base_variant,
                    liquidity_type,
                ) = detect_setup_sweep(setup_df, map_df)

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

                    plan = build_rr_plan(
                        direction=sweep_dir,
                        trigger_df=trigger_df,
                        map_levels=get_map_liquidity_levels(map_df),
                        sweep_level=setup_level,
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
                            post_sweep_to_radar(
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
                            )
                            last_double[symbol] = now
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
                            post_sweep_to_radar(
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
                            )

                            c = trigger_df.iloc[-1]
                            vol_avg10 = trigger_df["volume"].rolling(10).mean().iloc[-2]
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
                            last_detected[symbol] = now
                            last_detected_level[symbol] = setup_level
                            det_count += 1

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
                    trigger_state = detect_reclaim_or_acceptance(
                        trigger_df,
                        direction,
                        setup_level,
                        sweep_timestamp=sweep_ts,
                    )
                    dbg(f"   [TRIGGER STATE] {trigger_state}")

                    plan = build_rr_plan(
                        direction=direction,
                        trigger_df=trigger_df,
                        map_levels=get_map_liquidity_levels(map_df),
                        sweep_level=setup_level,
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
                            )
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
                            post_sweep_to_radar(
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
                            )

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
                            last_reclaim[symbol] = now
                            reclaim_count += 1

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
                        )
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
                        post_sweep_to_radar(
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
                        )

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
                        last_accepted[symbol] = now
                        accepted_count += 1

                    if detect_confirmed_displacement(
                        trigger_df, direction, plan["entry"]
                    ):
                        dbg("   [CONFIRM CHECK] True")
                        if now - last_confirmed.get(symbol, 0) > CONFIRMED_COOLDOWN:
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
                                )
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
                                post_sweep_to_radar(
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
                                )

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
                                last_confirmed[symbol] = now
                                confirmed_count += 1
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
