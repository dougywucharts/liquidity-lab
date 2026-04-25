# =========================================================
# Pro-Level Sweep Hunter v41.2 RADAR BRIDGE + TUNED RULES
#  - Multi-timeframe sweep model
#  - 5m liquidity map
#  - 3m setup / sweep detection
#  - 1m trigger / reclaim / acceptance / confirm
#  - RR calculator
#  - Double sweep tagging
#  - Equal High / Equal Low liquidity pool labeling
#  - Expanded CSV logging
#  - Debug heartbeat / cycle timing
#  - Radar bridge POST integration
# =========================================================

import os
import time
import json
import traceback
from datetime import datetime

import ccxt
import mplfinance as mpf
import pandas as pd
import requests

pd.set_option("mode.chained_assignment", None)

# =========================================================
# SETTINGS
# =========================================================

WEBHOOK_URL = "https://discord.com/api/webhooks/1416258389570490408/PFfLIAmMlFK-Pxscs3fKyJYeLHMBcvXmtU1IuQMwiy9a6cy7A_A_TVi2mkH8UF28ZkZ9"

BRIDGE_URL = "http://localhost:5000/sweep"
ENABLE_RADAR_POST = True
BRIDGE_TIMEOUT = 8

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
MAP_EQ_MIN_TOUCHES = 2

# Detection thresholds (tuned)
VOL_MULT_DETECT = 1.10
VOL_MULT_CONFIRM = 1.05
RANGE_MULT_DETECT = 0.55
RANGE_MULT_CONFIRM = 0.50
WICK_PCT_MIN = 0.28
REJECT_WICK_PCT_MIN = 0.22
WICK_PRICE_MIN = 0.0035
SFP_PENETRATION_MIN = 0.0005
CONFIRM_MAX_BARS = 2

# RR settings
STOP_BUFFER_PCT = 0.0015
TP1_BUFFER_PCT = 0.0005
TP2_BUFFER_PCT = 0.0010
MIN_RR_TO_ALERT = 1.00

# Cooldowns (tuned)
DETECTED_COOLDOWN = 90
RECLAIM_COOLDOWN = 90
ACCEPTED_COOLDOWN = 90
CONFIRMED_COOLDOWN = 90
DOUBLE_SWEEP_COOLDOWN = 240

# Double sweep
DOUBLE_SWEEP_MAX_BARS = 12
DOUBLE_SWEEP_LEVEL_TOL = 0.0015
DOUBLE_SWEEP_DIR_REQUIRED = True

CHART_WINDOW = 36

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
    "ICP/USDT:USDT", "KAS/USDT:USDT", "JASMY/USDT:USDT",
    "ONDO/USDT:USDT", "FET/USDT:USDT", "FIL/USDT:USDT",
    "SUI/USDT:USDT", "SEI/USDT:USDT", "OP/USDT:USDT",
    "ARB/USDT:USDT", "SOL/USDT:USDT", "NEAR/USDT:USDT",
    "APT/USDT:USDT", "ROSE/USDT:USDT", "MINA/USDT:USDT",
    "DOGE/USDT:USDT", "XRP/USDT:USDT", "LINK/USDT:USDT",
    "AVAX/USDT:USDT", "BTC/USDT:USDT", "ETH/USDT:USDT"
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

def classify_time_window(ts_utc: pd.Timestamp) -> str:
    hour = ts_utc.hour
    if hour in [0, 1, 7, 8, 13, 14]:
        return "Session Open"
    elif hour in [4, 5, 10, 11, 16, 17]:
        return "Midday"
    elif hour in [6, 12, 18, 19, 20]:
        return "Session Close"
    return "Off-Hours"

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
    exchange = ccxt.blofin({
        "enableRateLimit": True,
        "options": {"defaultType": "swap"}
    })
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
        msg = str(e)
        print(f"[WARN] OHLCV error {symbol} {timeframe}: {msg}")

        if "cloudflare" in msg.lower() or "just a moment" in msg.lower() or "429" in msg or "1015" in msg:
            print("[BACKOFF] Cloudflare/rate limit hit. Sleeping 8s...")
            time.sleep(8)
        else:
            time.sleep(2)

        return None

    if not data:
        return None

    df = pd.DataFrame(data, columns=[
        "timestamp", "open", "high", "low", "close", "volume"
    ])
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
    tr = pd.concat([
        df["high"] - df["low"],
        (df["high"] - prev_close).abs(),
        (df["low"] - prev_close).abs(),
    ], axis=1).max(axis=1)
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
# LIQUIDITY POOLS
# =========================================================

def detect_equal_highs_lows(map_df, level, direction, price):
    if map_df is None or len(map_df) < 3 or level is None:
        return "Low Sweep" if direction == "bullish" else "High Sweep"

    look = map_df.tail(MAP_EQ_LOOKBACK)
    tol = price * MAP_EQ_TOL_PCT

    if direction == "bearish":
        touches = (look["high"] - level).abs() <= tol
        return "Equal Highs" if touches.sum() >= MAP_EQ_MIN_TOUCHES else "High Sweep"

    if direction == "bullish":
        touches = (look["low"] - level).abs() <= tol
        return "Equal Lows" if touches.sum() >= MAP_EQ_MIN_TOUCHES else "Low Sweep"

    return "Swing Level"

def get_map_liquidity_levels(map_df):
    if map_df is None or len(map_df) < 30:
        return None

    look = map_df.iloc[-40:-2].copy()
    if look.empty:
        return None

    high_level = look["high"].max()
    low_level = look["low"].min()

    return {
        "high": high_level,
        "low": low_level,
    }

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
    px = last["close"]

    if direction == "bullish":
        entry = reclaim_level if reclaim_level is not None else px
        stop = min(sweep_level, last["low"]) - max(px * STOP_BUFFER_PCT, atr * 0.15)
        tp1 = (map_levels["high"] * (1 - TP1_BUFFER_PCT)) if map_levels else entry + (entry - stop) * 1.5
        tp2 = (map_levels["high"] * (1 + TP2_BUFFER_PCT)) if map_levels else entry + (entry - stop) * 2.5
    else:
        entry = reclaim_level if reclaim_level is not None else px
        stop = max(sweep_level, last["high"]) + max(px * STOP_BUFFER_PCT, atr * 0.15)
        tp1 = (map_levels["low"] * (1 + TP1_BUFFER_PCT)) if map_levels else entry - (stop - entry) * 1.5
        tp2 = (map_levels["low"] * (1 - TP2_BUFFER_PCT)) if map_levels else entry - (stop - entry) * 2.5

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
    same_dir = (prev_dir == current_dir)

    if same_level and bars_apart <= DOUBLE_SWEEP_MAX_BARS:
        if (not DOUBLE_SWEEP_DIR_REQUIRED) or same_dir:
            return "double_sweep"

    if (prev_dir != current_dir) and same_level and level_diff < 0.003:
        return "sweep_of_sweep"

    return variant

# =========================================================
# DETECT SETUP SWEEP (3m)
# =========================================================

def detect_setup_sweep(setup_df, map_df):
    needed = SETUP_LOOKBACK + SETUP_SWING_BACK + 10
    if len(setup_df) < needed:
        return False, None, 0, None, None, "normal", None

    struct = setup_df.iloc[-(SETUP_LOOKBACK + SETUP_SWING_BACK):-SETUP_SWING_BACK]
    c = setup_df.iloc[-1]

    range_high = struct["high"].max()
    range_low = struct["low"].min()

    avg_range = setup_df["atr14"].iloc[-2]
    c_range = c["high"] - c["low"]

    if pd.isna(avg_range) or c_range <= 0:
        return False, None, 0, None, None, "normal", None

    if c_range < avg_range * RANGE_MULT_DETECT:
        return False, None, 0, None, None, "normal", None

    vol_avg10 = setup_df["volume"].rolling(10).mean().iloc[-2]
    if pd.isna(vol_avg10) or c["volume"] < vol_avg10 * VOL_MULT_DETECT:
        return False, None, 0, None, None, "normal", None

    mid = (c["high"] + c["low"]) / 2

    bullish = (
        c["low"] < range_low and
        c["close"] > mid and
        c["close"] > setup_df.iloc[-2]["close"]
    )
    bearish = (
        c["high"] > range_high and
        c["close"] < mid and
        c["close"] < setup_df.iloc[-2]["close"]
    )

    if not bullish and not bearish:
        return False, None, 0, None, None, "normal", None

    direction = "bullish" if bullish else "bearish"
    price = c["close"]
    strength = 0

    v_mult = c["volume"] / (struct["volume"].mean() + 1e-9)
    strength += min(35, max(0, (v_mult - 1) * 18))

    wick_up = c["high"] - max(c["open"], c["close"])
    wick_dn = min(c["open"], c["close"]) - c["low"]
    body = abs(c["close"] - c["open"])

    if bullish and wick_dn > wick_up:
        strength += 20
    elif bearish and wick_up > wick_dn:
        strength += 20

    if body > c_range * 0.25:
        strength += 10

    if bullish:
        depth = (range_low - c["low"]) / (price + 1e-9)
        setup_level = range_low
    else:
        depth = (c["high"] - range_high) / (price + 1e-9)
        setup_level = range_high

    strength += int(depth * 9000)

    map_levels = get_map_liquidity_levels(map_df)
    map_level = None
    liquidity_type = "Swing Level"

    if bullish:
        map_level = map_levels["low"] if map_levels else setup_level
        liquidity_type = detect_equal_highs_lows(map_df, map_level, direction, price)
    else:
        map_level = map_levels["high"] if map_levels else setup_level
        liquidity_type = detect_equal_highs_lows(map_df, map_level, direction, price)

    strength = int(min(max(strength, 0), 100))

    if strength < 30:
        return False, None, 0, None, None, "normal", None

    return True, direction, strength, map_level, setup_level, "swing_liquidity", liquidity_type

# =========================================================
# TRIGGER LOGIC (1m)
# =========================================================

def detect_reclaim_or_acceptance(trigger_df, direction, sweep_level):
    if len(trigger_df) < 4 or sweep_level is None:
        return None

    c1 = trigger_df.iloc[-1]
    c2 = trigger_df.iloc[-2]
    rng1 = c1["high"] - c1["low"]

    if rng1 <= 0:
        return None

    avg_range20 = trigger_df["atr14"].iloc[-2]
    avg_vol10 = trigger_df["volume"].rolling(10).mean().iloc[-2]

    if pd.isna(avg_range20) or pd.isna(avg_vol10):
        return None

    if rng1 < avg_range20 * RANGE_MULT_CONFIRM:
        return None

    price = c1["close"]
    wick_floor = price * WICK_PRICE_MIN
    upper_wick = c1["high"] - max(c1["open"], c1["close"])
    lower_wick = min(c1["open"], c1["close"]) - c1["low"]
    mid = (c1["high"] + c1["low"]) / 2

    if direction == "bullish":
        reclaim = (
            c1["low"] <= sweep_level and
            c1["close"] > sweep_level and
            c1["close"] > c1["open"] and
            c1["close"] > mid and
            lower_wick >= max(REJECT_WICK_PCT_MIN * rng1, wick_floor) and
            c1["volume"] >= avg_vol10 * VOL_MULT_CONFIRM
        )
        accepted = (
            c1["close"] < sweep_level and
            c1["low"] < sweep_level and
            c1["close"] < c2["close"]
        )
        if reclaim:
            return "reclaim"
        if accepted:
            return "accepted"

    if direction == "bearish":
        reclaim = (
            c1["high"] >= sweep_level and
            c1["close"] < sweep_level and
            c1["close"] < c1["open"] and
            c1["close"] < mid and
            upper_wick >= max(REJECT_WICK_PCT_MIN * rng1, wick_floor) and
            c1["volume"] >= avg_vol10 * VOL_MULT_CONFIRM
        )
        accepted = (
            c1["close"] > sweep_level and
            c1["high"] > sweep_level and
            c1["close"] > c2["close"]
        )
        if reclaim:
            return "reclaim"
        if accepted:
            return "accepted"

    return None

def detect_confirmed_displacement(trigger_df, direction, entry_level):
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

    if direction == "bullish":
        return c1["close"] > entry_level and c1["close"] > c1["open"]
    else:
        return c1["close"] < entry_level and c1["close"] < c1["open"]

# =========================================================
# SCORE
# =========================================================

def compute_institutional_score(strength, event_type, rr2=None, bias=None):
    score = max(0, min(100, int(strength)))

    if event_type == "RECLAIM":
        score += 10
    elif event_type == "CONFIRMED":
        score += 18
    elif event_type == "DOUBLE_SWEEP":
        score += 12
    elif event_type == "ACCEPTED":
        score -= 8

    if rr2 is not None:
        if rr2 >= 2.5:
            score += 12
        elif rr2 >= 1.8:
            score += 8
        elif rr2 < 1.1:
            score -= 10

    if bias == "Bullish" and event_type in ["RECLAIM", "CONFIRMED"]:
        score += 4
    if bias == "Bearish" and event_type in ["RECLAIM", "CONFIRMED"]:
        score += 4

    return max(0, min(100, score))

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
            volume="in"
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
            }
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
            savefig=path
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
    liquidity_type=None
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
        "footer": {"text": "Sweep Hunter v41.2 RADAR — DougyWu Signals"},
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
        liquidity_type=liquidity_type
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
    json=payload,
    timeout=5
)

        if resp.status_code >= 300:
            print(f"[WARN] Discord error {resp.status_code}: {resp.text}")
        else:
            print("[INFO] Discord alert sent.")

    except Exception as e:
        print(f"[ERROR] Discord send fail: {e}")

# =========================================================
# RADAR BRIDGE
# =========================================================

def clean_symbol_for_radar(symbol: str) -> str:
    return symbol.replace(":USDT", "")

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
        confidence = max(0.0, min(1.0, float(strength) / 100.0))

        if direction == "bullish":
            default_sweep_type = "Low Sweep"
            direction_bias = "Long"
        else:
            default_sweep_type = "High Sweep"
            direction_bias = "Short"

        payload = {
            "id": f"{event_type.lower()}_{symbol.replace('/', '_')}_{int(time.time() * 1000)}",
            "timestampUtc": datetime.utcnow().isoformat(),
            "pair": symbol.replace(":USDT", ""),
            "timeframe": TRIGGER_TIMEFRAME,
            "session": classify_time_window(df.index[-1]),
            "directionBias": direction_bias,
            "eventType": event_type,
            "sweepType": liquidity_type if liquidity_type else default_sweep_type,
            "emaContext": ema_context or variant or "Liquidity Sweep",
            "structure": f"{regime} | {bias} | {variant}",
            "reclaimConfirmed": event_type in ["SWEEP_RECLAIM", "SWEEP_CONFIRMED"],
            "botConfidence": round(confidence, 4),
            "entry": plan["entry"],
            "stop": plan["stop"],
            "tp1": plan["tp1"],
            "tp2": plan["tp2"],
        }

        print(f"[POSTING EVENT] {payload['pair']} {event_type}")

        resp = requests.post(BRIDGE_URL, json=payload, timeout=5)

        if resp.status_code >= 300:
            print(f"[RADAR ERROR] {resp.status_code} {resp.text}")
        else:
            print(f"[RADAR OK] {payload['pair']} {event_type}")

    except Exception as e:
        print(f"[RADAR EXCEPTION] {e}")

# =========================================================
# ALERT HELPERS
# =========================================================

def plan_fields(plan):
    return [
        ("Trade Math",
         f"Entry `{plan['entry']:.4f}`\n"
         f"Stop `{plan['stop']:.4f}`\n"
         f"TP1 `{plan['tp1']:.4f}` | RR `{rr_text(plan['rr_tp1'])}`\n"
         f"TP2 `{plan['tp2']:.4f}` | RR `{rr_text(plan['rr_tp2'])}`")
    ]

def send_detected_alert(symbol, df, direction, strength, variant, regime, bias, map_level, setup_level, liquidity_type, plan):
    title = "🟡⚠️ SWEEP DETECTED ⚠️🟡"
    desc = (
        f"Liquidity pool hit on setup timeframe.\n"
        f"Direction: **{direction.upper()}**\n"
        f"Strength: `{strength}/100 ({strength_label(strength)})`"
    )
    extra = [
        ("Variant", f"`{variant}`"),
        ("Liquidity Pool", f"`{liquidity_type}` | map `{map_level:.4f}` | setup `{setup_level:.4f}`"),
        ("Regime / Bias", f"`{regime}` / `{bias}`"),
        ("Time Window", f"`{classify_time_window(df.index[-1])}`"),
    ] + plan_fields(plan)

    embed, chart = build_embed(
        symbol, title, desc, 0xF1C40F, df,
        extra_fields=extra, level=setup_level, direction=direction, liquidity_type=liquidity_type
    )
    send_discord_alert(embed, chart)

def send_reclaim_alert(symbol, df, direction, strength, variant, regime, bias, map_level, setup_level, liquidity_type, plan):
    title = "🟢♻️ SWEEP RECLAIM ♻️🟢"
    desc = (
        f"Swept level reclaimed on trigger timeframe.\n"
        f"Direction: **{direction.upper()}**\n"
        f"Strength: `{strength}/100 ({strength_label(strength)})`"
    )
    extra = [
        ("Variant", f"`{variant}`"),
        ("Liquidity Pool", f"`{liquidity_type}` | map `{map_level:.4f}` | setup `{setup_level:.4f}`"),
        ("Regime / Bias", f"`{regime}` / `{bias}`"),
        ("Time Window", f"`{classify_time_window(df.index[-1])}`"),
    ] + plan_fields(plan)

    embed, chart = build_embed(
        symbol, title, desc, 0x2ECC71, df,
        extra_fields=extra, level=setup_level, direction=direction, liquidity_type=liquidity_type
    )
    send_discord_alert(embed, chart)

def send_accepted_alert(symbol, df, direction, strength, variant, regime, bias, map_level, setup_level, liquidity_type, plan):
    title = "🟠📉 SWEEP ACCEPTED 📉🟠"
    desc = (
        f"Price accepted beyond swept level.\n"
        f"Direction: **{direction.upper()}**\n"
        f"Strength: `{strength}/100 ({strength_label(strength)})`"
    )
    extra = [
        ("Variant", f"`{variant}`"),
        ("Liquidity Pool", f"`{liquidity_type}` | map `{map_level:.4f}` | setup `{setup_level:.4f}`"),
        ("Regime / Bias", f"`{regime}` / `{bias}`"),
        ("Time Window", f"`{classify_time_window(df.index[-1])}`"),
    ] + plan_fields(plan)

    embed, chart = build_embed(
        symbol, title, desc, 0xE67E22, df,
        extra_fields=extra, level=setup_level, direction=direction, liquidity_type=liquidity_type
    )
    send_discord_alert(embed, chart)

def send_confirmed_alert(symbol, df, direction, strength, variant, regime, bias, map_level, setup_level, liquidity_type, plan):
    title = "🟥🧨 SWEEP CONFIRMED 🧨🟥"
    desc = (
        f"Displacement confirmed away from the reclaimed level.\n"
        f"Direction: **{direction.upper()}**\n"
        f"Strength: `{strength}/100 ({strength_label(strength)})`"
    )
    extra = [
        ("Variant", f"`{variant}`"),
        ("Liquidity Pool", f"`{liquidity_type}` | map `{map_level:.4f}` | setup `{setup_level:.4f}`"),
        ("Regime / Bias", f"`{regime}` / `{bias}`"),
        ("Time Window", f"`{classify_time_window(df.index[-1])}`"),
    ] + plan_fields(plan)

    embed, chart = build_embed(
        symbol, title, desc, 0xE74C3C, df,
        extra_fields=extra, level=setup_level, direction=direction, liquidity_type=liquidity_type
    )
    send_discord_alert(embed, chart)

def send_double_sweep_alert(symbol, df, direction, strength, regime, bias, map_level, setup_level, liquidity_type, plan):
    title = "🟣🪤 DOUBLE SWEEP 🪤🟣"
    desc = (
        f"Repeated attack into same liquidity pool.\n"
        f"Direction: **{direction.upper()}**\n"
        f"Strength: `{strength}/100 ({strength_label(strength)})`"
    )
    extra = [
        ("Variant", "`double_sweep`"),
        ("Liquidity Pool", f"`{liquidity_type}` | map `{map_level:.4f}` | setup `{setup_level:.4f}`"),
        ("Regime / Bias", f"`{regime}` / `{bias}`"),
        ("Time Window", f"`{classify_time_window(df.index[-1])}`"),
    ] + plan_fields(plan)

    embed, chart = build_embed(
        symbol, title, desc, 0x9B59B6, df,
        extra_fields=extra, level=setup_level, direction=direction, liquidity_type=liquidity_type
    )
    send_discord_alert(embed, chart)

# =========================================================
# MAIN LOOP
# =========================================================

def main_loop():
    exchange = init_exchange()
    symbols = get_sweep_hunter_symbols(exchange)

    print("[RUN] Sweep Hunter v41.3 RADAR started.\n")
    for s in symbols:
        print("  ", s)
    print()
    print(f"[INFO] Total symbols: {len(symbols)}")
    print(f"[INFO] Approx requests per cycle: {len(symbols) * 3}")
    print()

    last_detected = {}
    last_reclaim = {}
    last_accepted = {}
    last_confirmed = {}
    last_double = {}
    last_ping = {}

    double_count = 0
    ping_count = 0
    err_count = 0

    last_sweep_meta = {}
    trigger_bar_state = {}
    cycle_num = 0

    while True:
        # ============ TEST EVENT (REMOVE AFTER TEST) ============
        if cycle_num == 0:
            test_payload = {
                "pair": "SUI/USDT",
                "timeframe": "3m",
                "eventType": "SWEEP_CONFIRMED",
                "directionBias": "Short",
                "botConfidence": 0.99,
                "timestampUtc": datetime.utcnow().isoformat(),
            }

            try:
                print("[TEST EVENT] Sending manual test to UI...")
                resp = requests.post(
                    "http://localhost:5000/sweep",
                    json=test_payload,
                    timeout=5
                )
                print("[TEST EVENT RESPONSE]", resp.status_code, resp.text)
            except Exception as e:
                print("[TEST EVENT ERROR]", e)

        # =======================================================

        cycle_num += 1
        cycle_start = time.time()

        det_count = 0
        reclaim_count = 0
        accepted_count = 0
        confirmed_count = 0
        double_count = 0
        err_count = 0
        dbg(f"\n{'='*60}")
        dbg(f"[CYCLE {cycle_num}] START {datetime.utcnow().strftime('%H:%M:%S')} UTC")
        dbg(f"{'='*60}")

        for i, symbol in enumerate(symbols, 1):
            sym_start = time.time()

            try:
                if PRINT_EVERY_SYMBOL:
                    print(f"[SCAN {i}/{len(symbols)}] {symbol}")

                fetch_start = time.time()
                map_df = fetch_ohlcv_df(exchange, symbol, MAP_TIMEFRAME, LIMIT_MAP)
                setup_df = fetch_ohlcv_df(exchange, symbol, SETUP_TIMEFRAME, LIMIT_SETUP)
                trigger_df = fetch_ohlcv_df(exchange, symbol, TRIGGER_TIMEFRAME, LIMIT_TRIGGER)
                fetch_elapsed = time.time() - fetch_start

                dbg(f"   [FETCH] {symbol} took {fetch_elapsed:.2f}s")

                if map_df is None or setup_df is None or trigger_df is None:
                    dbg(f"   [SKIP] Missing dataframe(s)")
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

                sweep_flag, sweep_dir, strength, map_level, setup_level, base_variant, liquidity_type = detect_setup_sweep(setup_df, map_df)

                now = time.time()

                if sweep_flag and sweep_dir:
                    prev_meta = last_sweep_meta.get(symbol)
                    variant = classify_variant(
                        current_dir=sweep_dir,
                        current_level=setup_level,
                        current_ts=setup_df.index[-1],
                        prev_meta=prev_meta
                    )

                    plan = build_rr_plan(
                        direction=sweep_dir,
                        trigger_df=trigger_df,
                        map_levels=get_map_liquidity_levels(map_df),
                        sweep_level=setup_level,
                        reclaim_level=trigger_df.iloc[-1]["close"]
                    )

                    dbg(
                        f"   [SETUP SWEEP] dir={sweep_dir} strength={strength} "
                        f"variant={variant} rr1={rr_text(plan['rr_tp1'])} rr2={rr_text(plan['rr_tp2'])}"
                    )

                    last_sweep_meta[symbol] = {
                        "dir": sweep_dir,
                        "level": setup_level,
                        "map_level": map_level,
                        "ts": setup_df.index[-1],
                        "strength": strength,
                        "variant": variant,
                        "liquidity_type": liquidity_type,
                        "regime": regime,
                        "bias": bias,
                    }

                    if variant == "double_sweep" and (now - last_double.get(symbol, 0) > DOUBLE_SWEEP_COOLDOWN):
                        if plan["rr_tp1"] is None or plan["rr_tp1"] >= MIN_RR_TO_ALERT:
                            print(f"[DOUBLE SWEEP] {symbol} {sweep_dir} strength={strength}")
                            send_double_sweep_alert(
                                symbol, trigger_df, sweep_dir, strength, regime, bias,
                                map_level, setup_level, liquidity_type, plan
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

                    if now - last_detected.get(symbol, 0) > DETECTED_COOLDOWN:
                        if plan["rr_tp1"] is None or plan["rr_tp1"] >= MIN_RR_TO_ALERT:
                            print(f"[DETECTED] {symbol} {sweep_dir} strength={strength} variant={variant}")
                            send_detected_alert(
                                symbol, trigger_df, sweep_dir, strength, variant, regime, bias,
                                map_level, setup_level, liquidity_type, plan
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
                            det_count += 1

                if symbol in last_sweep_meta:
                    sm = last_sweep_meta[symbol]
                    direction = sm["dir"]
                    setup_level = sm["level"]
                    map_level = sm["map_level"]
                    strength = sm["strength"]
                    variant = sm["variant"]
                    liquidity_type = sm["liquidity_type"]

                    trigger_state = detect_reclaim_or_acceptance(trigger_df, direction, setup_level)
                    dbg(f"   [TRIGGER STATE] {trigger_state}")

                    plan = build_rr_plan(
                        direction=direction,
                        trigger_df=trigger_df,
                        map_levels=get_map_liquidity_levels(map_df),
                        sweep_level=setup_level,
                        reclaim_level=trigger_df.iloc[-1]["close"]
                    )

                    if trigger_state == "reclaim" and (now - last_reclaim.get(symbol, 0) > RECLAIM_COOLDOWN):
                        if plan["rr_tp1"] is None or plan["rr_tp1"] >= MIN_RR_TO_ALERT:
                            print(f"[RECLAIM] {symbol} {direction} strength={strength} rr2={rr_text(plan['rr_tp2'])}")
                            send_reclaim_alert(
                                symbol, trigger_df, direction, strength, variant, regime, bias,
                                map_level, setup_level, liquidity_type, plan
                            )
                            post_sweep_to_radar(
                                symbol=symbol,
                                event_type="SWEEP_RECLAIM",
                                direction=direction,
                                strength=compute_institutional_score(strength, "RECLAIM", plan["rr_tp2"], bias),
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
                                strength=compute_institutional_score(strength, "RECLAIM", plan["rr_tp2"], bias),
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

                    if trigger_state == "accepted" and (now - last_accepted.get(symbol, 0) > ACCEPTED_COOLDOWN):
                        print(f"[ACCEPTED] {symbol} {direction} strength={strength}")
                        send_accepted_alert(
                            symbol, trigger_df, direction, strength, variant, regime, bias,
                            map_level, setup_level, liquidity_type, plan
                        )
                        post_sweep_to_radar(
                            symbol=symbol,
                            event_type="SWEEP_ACCEPTED",
                            direction=direction,
                            strength=compute_institutional_score(strength, "ACCEPTED", plan["rr_tp2"], bias),
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
                            strength=compute_institutional_score(strength, "ACCEPTED", plan["rr_tp2"], bias),
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

                    if detect_confirmed_displacement(trigger_df, direction, plan["entry"]):
                        dbg("   [CONFIRM CHECK] True")
                        if now - last_confirmed.get(symbol, 0) > CONFIRMED_COOLDOWN:
                            if plan["rr_tp1"] is None or plan["rr_tp1"] >= MIN_RR_TO_ALERT:
                                print(f"[CONFIRMED] {symbol} {direction} strength={strength}")
                                send_confirmed_alert(
                                    symbol, trigger_df, direction, strength, variant, regime, bias,
                                    map_level, setup_level, liquidity_type, plan
                                )
                                post_sweep_to_radar(
                                    symbol=symbol,
                                    event_type="SWEEP_CONFIRMED",
                                    direction=direction,
                                    strength=compute_institutional_score(strength, "CONFIRMED", plan["rr_tp2"], bias),
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
                                vol_avg10 = trigger_df["volume"].rolling(10).mean().iloc[-2]
                                log_sweep_event(
                                    symbol=symbol,
                                    event="CONFIRMED",
                                    direction=direction,
                                    strength=compute_institutional_score(strength, "CONFIRMED", plan["rr_tp2"], bias),
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

                if DEBUG_MODE and not PRINT_EVERY_SYMBOL and i % HEARTBEAT_EVERY_N_SYMBOLS == 0:
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