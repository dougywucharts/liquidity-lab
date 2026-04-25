import { useEffect, useMemo, useState } from "react";
import "./styles.css";

const API_BASE = "http://localhost:3001";

const emptyForm = {
  pair: "",
  timeframe: "3m",
  session: "New York",
  directionBias: "Short",
  eventType: "SWEEP_DETECTED",
  sweepType: "High Sweep",
  emaContext: "EMA99 Rejection",
  attemptTag: "First Sweep",
  leverage: 1,
  action: "Taken",
  timing: "On Confirmation",
  planFollowed: "Yes",
  ruleBreak: "None",
  disciplineScore: 8,
  setupQuality: 8,
  emotionalPressure: 3,
  entry: "",
  stop: "",
  exit: "",
  tp1: "",
  tp2: "",
  pnl: "",
  notes: "",
  screenshot: "",
  sourceType: "Event Response",
  structure: "",
};

const STORAGE_KEYS = {
  loggedDecisions: "liquidity_radar_logged_decisions",
  propAccount: "liquidity_radar_prop_account",
  radarVisibleCount: "liquidity_radar_visible_count",
};

const ACTION_OPTIONS = ["Taken", "Skipped", "Missed", "Watched Only"];
const TIMING_OPTIONS = ["On Confirmation", "Early", "Late", "Chase Entry"];
const PLAN_OPTIONS = ["Yes", "Mostly", "No"];
const RULE_BREAK_OPTIONS = [
  "None",
  "Entered before confirmation",
  "Chased move",
  "Forced trade",
  "Ignored invalidation",
  "Moved stop",
  "Closed early",
  "Over leveraged",
  "Revenge trade",
];
const ATTEMPT_OPTIONS = [
  "First Sweep",
  "Second Attempt",
  "Confirmed Re-entry",
  "Range Retest",
];
const LEVEL_FILTERS = ["All", "L3", "L2", "L1"];
const TIMEFRAME_OPTIONS = ["1m", "3m", "5m", "15m", "1h"];
const DIRECTION_OPTIONS = ["Long", "Short"];
const SESSION_OPTIONS = ["Asia", "London", "New York", "Off-Hours"];
const EVENT_TYPE_OPTIONS = [
  "SWEEP_DETECTED",
  "SWEEP_RECLAIM",
  "SWEEP_ACCEPTED",
  "SWEEP_CONFIRMED",
  "DOUBLE_SWEEP",
];
const SWEEP_TYPE_OPTIONS = [
  "High Sweep",
  "Low Sweep",
  "Double Tap High",
  "Double Tap Low",
  "Equal Highs",
  "Equal Lows",
];
const EMA_CONTEXT_OPTIONS = [
  "EMA9 Reclaim",
  "EMA25 Reclaim",
  "EMA25 Rejection",
  "EMA99 Rejection",
  "EMA99 Hold",
];

const EVENT_PRIORITY = {
  DOUBLE_SWEEP: 5,
  SWEEP_CONFIRMED: 4,
  SWEEP_RECLAIM: 3,
  SWEEP_ACCEPTED: 2,
  SWEEP_DETECTED: 1,
  SCAN_PING: 0,
};

function avg(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + Number(b || 0), 0) / values.length;
}

function num(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function fmt(value, digits = 4) {
  if (value === "" || value === null || value === undefined) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toFixed(digits);
}

function pct(value) {
  const n = Number(value || 0);
  return `${Math.round(n * 100)}%`;
}

function displayLogTimestamp(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function displayClockTime(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function getBlofinUrl(pair) {
  if (!pair) return "https://blofin.com";
  return `https://blofin.com/futures/en/${pair.replace("/", "-")}`;
}

function getTradingViewSymbol(pair) {
  const compact = (pair || "BTC/USDT").replace("/", "");
  return `BLOFIN:${compact}`;
}

function getTradingViewInterval(timeframe) {
  const map = {
    "1m": "1",
    "3m": "3",
    "5m": "5",
    "15m": "15",
    "1h": "60",
    "4h": "240",
    "1d": "D",
  };
  return map[timeframe] || "3";
}

function calcRiskAmount(entry, stop, leverage = 1, riskUnit = 1) {
  const e = num(entry);
  const s = num(stop);
  const l = Math.max(1, num(leverage) || 1);
  if (!e || !s) return 0;
  return Math.abs(e - s) * riskUnit * l;
}

function calcRR(entry, stop, target) {
  const e = num(entry);
  const s = num(stop);
  const t = num(target);
  const risk = Math.abs(e - s);
  const reward = Math.abs(t - e);
  if (!risk || !reward) return 0;
  return reward / risk;
}

function getPropMetrics(propAccount) {
  const dailyLossLimit = propAccount.accountSize * propAccount.dailyDrawdownPct;
  const maxDrawdownLimit = propAccount.accountSize * propAccount.maxDrawdownPct;
  const profitTarget = propAccount.accountSize * propAccount.profitTargetPct;

  const dailyLossUsed = Math.max(0, -propAccount.dailyRealizedPnl);
  const maxDrawdownUsed = Math.max(
    0,
    propAccount.startingBalance - propAccount.currentBalance
  );

  return {
    dailyLossLimit,
    maxDrawdownLimit,
    profitTarget,
    dailyLossUsed,
    maxDrawdownUsed,
    remainingDailyLoss: Math.max(0, dailyLossLimit - dailyLossUsed),
    remainingMaxDrawdown: Math.max(0, maxDrawdownLimit - maxDrawdownUsed),
  };
}

function evaluatePropCompliance(event, propAccount) {
  if (!event || propAccount.mode !== "prop") {
    return {
      qualified: true,
      status: "PASS",
      notes: [],
      riskAmount: 0,
      rrToTp1: 0,
      rrToTp2: 0,
    };
  }

  const notes = [];
  const metrics = getPropMetrics(propAccount);

  const riskAmount = calcRiskAmount(event.entry, event.stop, event.leverage || 1, 1);
  const rrToTp1 = calcRR(event.entry, event.stop, event.tp1);
  const rrToTp2 = calcRR(event.entry, event.stop, event.tp2);

  if (!event.entry || !event.stop) notes.push("Missing entry/stop data");
  if (riskAmount > propAccount.maxRiskPerTrade) notes.push("Risk exceeds max per trade");

  const bestRR = Math.max(rrToTp1 || 0, rrToTp2 || 0);
  if (bestRR && bestRR < propAccount.minRR) notes.push("RR below minimum");

  if (propAccount.lossesToday >= propAccount.maxLossesPerDay) {
    notes.push("Max losses for the day reached");
  }

  if (metrics.dailyLossUsed >= metrics.dailyLossLimit) {
    notes.push("Daily drawdown limit reached");
  }

  if (metrics.maxDrawdownUsed >= metrics.maxDrawdownLimit) {
    notes.push("Max overall drawdown reached");
  }

  if (
    propAccount.dailyProfitLock &&
    propAccount.dailyRealizedPnl >= propAccount.dailyProfitLock
  ) {
    notes.push("Daily profit lock reached");
  }

  let status = "PASS";
  if (notes.some((note) => note.includes("Risk exceeds") || note.includes("drawdown"))) {
    status = "DO NOT TAKE";
  } else if (notes.length) {
    status = "BORDERLINE";
  }

  return {
    qualified: notes.length === 0,
    status,
    notes,
    riskAmount,
    rrToTp1,
    rrToTp2,
  };
}

function safeReadStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function buildEventKey(event, fallbackIndex = 0) {
  if (!event) return `event_missing_${fallbackIndex}`;
  if (event.id) return String(event.id);

  const pair = event.pair || "unknown_pair";
  const ts = event.timestampUtc || event.timestamp || "no_ts";
  const eventType = event.eventType || "event";
  const sweepType = event.sweepType || "sweep";
  const timeframe = event.timeframe || "tf";
  const bias = event.directionBias || "bias";

  return `${pair}__${ts}__${eventType}__${sweepType}__${timeframe}__${bias}__${fallbackIndex}`;
}

function eventKey(event) {
  return buildEventKey(event, 0);
}

function getSignalLevel(event) {
  if (event?.signalLevel) return event.signalLevel;

  const confidence = Number(event?.botConfidence || 0);
  const confirmed = !!event?.reclaimConfirmed;
  const hasSweep = !!event?.sweepType;
  const hasBias = !!event?.directionBias;
  const strongEvent =
    event?.eventType === "SWEEP_CONFIRMED" ||
    event?.eventType === "DOUBLE_SWEEP" ||
    event?.eventType === "SWEEP_RECLAIM";

  let score = 0;
  if (hasSweep) score += 1;
  if (hasBias) score += 1;
  if (confirmed) score += 1;
  if (strongEvent) score += 1;
  if (confidence >= 0.7) score += 1;
  if (confidence >= 0.85) score += 1;
  if (
    event?.attemptTag === "Second Attempt" ||
    event?.attemptTag === "Confirmed Re-entry"
  ) {
    score += 1;
  }

  if (score >= 6) return "L3";
  if (score >= 4) return "L2";
  return "L1";
}

function isHotSignal(event) {
  const confidence = Number(event?.botConfidence || 0);
  return (
    confidence >= 0.85 ||
    event?.eventType === "SWEEP_CONFIRMED" ||
    event?.eventType === "DOUBLE_SWEEP"
  );
}

function getTradeGrade(item) {
  if (!item) return "—";
  if (
    item.action === "Taken" &&
    item.timing === "On Confirmation" &&
    item.planFollowed === "Yes" &&
    item.ruleBreak === "None"
  ) {
    return "DISCIPLINED";
  }
  if (
    item.timing === "Early" ||
    item.timing === "Chase Entry" ||
    item.planFollowed === "No" ||
    item.ruleBreak !== "None"
  ) {
    return "RULE BREAK";
  }
  return "MIXED";
}

function prettyEventType(eventType) {
  const map = {
    SWEEP_DETECTED: "Sweep Detected",
    SWEEP_RECLAIM: "Sweep Reclaim",
    SWEEP_ACCEPTED: "Sweep Accepted",
    SWEEP_CONFIRMED: "Sweep Confirmed",
    DOUBLE_SWEEP: "Double Sweep",
    SCAN_PING: "Scan Ping",
  };
  return map[eventType] || eventType || "Event";
}

function aiGradeStyle(grade) {
  if (grade === "A") {
    return {
      border: "1px solid rgba(80,255,160,0.30)",
      background: "rgba(40,120,70,0.16)",
      color: "#b8ffd1",
    };
  }
  if (grade === "B") {
    return {
      border: "1px solid rgba(255,190,70,0.30)",
      background: "rgba(140,90,20,0.18)",
      color: "#ffd38b",
    };
  }
  return {
    border: "1px solid rgba(255,80,80,0.30)",
    background: "rgba(120,30,30,0.20)",
    color: "#ffb0b0",
  };
}

function getEventPriority(eventType) {
  return EVENT_PRIORITY[eventType] ?? 0;
}

function getWaveBucket(timestampUtc, minutes = 3) {
  const ts = new Date(timestampUtc || 0).getTime();
  if (!ts) return "no_time";
  const bucket = Math.floor(ts / (minutes * 60 * 1000));
  return String(bucket);
}

function buildRadarGroupKey(event) {
  const pair = event?.pair || "UNKNOWN";
  const timeframe = event?.timeframe || "3m";
  const direction = event?.directionBias || "Unknown";
  const bucket = getWaveBucket(event?.timestampUtc, 3);
  return `${pair}__${timeframe}__${direction}__${bucket}`;
}

function groupRadarEvents(events = []) {
  const grouped = new Map();
  const seen = new Set();

  for (const event of events) {
    const uniqueKey = `${event.pair}_${event.eventType}_${event.timestampUtc}`;
    if (seen.has(uniqueKey)) continue;
    seen.add(uniqueKey);

    const key = buildRadarGroupKey(event);
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        ...event,
        groupedCount: 1,
        groupedTypes: [event.eventType],
      });
      continue;
    }

    const currentPriority = getEventPriority(event.eventType);
    const existingPriority = getEventPriority(existing.eventType);

    const shouldReplace =
      currentPriority > existingPriority ||
      (currentPriority === existingPriority &&
        new Date(event.timestampUtc || 0).getTime() >
          new Date(existing.timestampUtc || 0).getTime());

    if (shouldReplace) {
      grouped.set(key, {
        ...event,
        groupedCount: existing.groupedCount + 1,
        groupedTypes: Array.from(
          new Set([...(existing.groupedTypes || []), event.eventType])
        ),
      });
    } else {
      existing.groupedCount += 1;
      existing.groupedTypes = Array.from(
        new Set([...(existing.groupedTypes || []), event.eventType])
      );
      grouped.set(key, existing);
    }
  }

  return Array.from(grouped.values()).sort(
    (a, b) =>
      (new Date(b.timestampUtc || 0).getTime() || 0) -
      (new Date(a.timestampUtc || 0).getTime() || 0)
  );
}

const ui = {
  shell: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top, rgba(255,0,0,0.08), transparent 18%), #050505",
    color: "#F2F2F2",
    fontFamily:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  container: {
    maxWidth: 1540,
    margin: "0 auto",
    padding: "0 16px 28px",
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    backdropFilter: "blur(10px)",
    background: "rgba(5,5,5,0.88)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.32)",
  },
  headerInner: {
    maxWidth: 1540,
    margin: "0 auto",
    padding: "14px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  brandWrap: { display: "flex", alignItems: "center", gap: 12 },
  radarIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    border: "1px solid rgba(255,26,26,0.36)",
    background: "linear-gradient(180deg,#111,#0a0a0a)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 0 28px rgba(255,26,26,0.16)",
    flexShrink: 0,
  },
  radarIcon: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: "2px solid rgba(255,26,26,0.9)",
    position: "relative",
  },
  topCardRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
    marginTop: 14,
    marginBottom: 14,
  },
  card: {
    background:
      "linear-gradient(180deg, rgba(22,22,22,0.98), rgba(10,10,10,0.98))",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 24,
    padding: 16,
    boxShadow: "0 16px 38px rgba(0,0,0,0.30)",
  },
  chartCard: {
    background:
      "linear-gradient(180deg, rgba(18,18,18,0.98), rgba(8,8,8,0.98))",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 28,
    padding: 16,
    boxShadow: "0 22px 50px rgba(0,0,0,0.36)",
    marginBottom: 14,
  },
  radarCardShell: {
    background:
      "linear-gradient(180deg, rgba(13,13,13,0.98), rgba(9,9,9,0.98))",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 22,
    padding: 16,
    boxShadow: "0 14px 34px rgba(0,0,0,0.28)",
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  pillRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  pill: {
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "#F2F2F2",
    borderRadius: 999,
    padding: "6px 11px",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.04em",
  },
  redPill: {
    border: "1px solid rgba(255,26,26,0.28)",
    background: "rgba(255,26,26,0.12)",
    color: "#ffb0b0",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 700,
  },
  greenPill: {
    border: "1px solid rgba(80,255,160,0.24)",
    background: "rgba(40,120,70,0.14)",
    color: "#b8ffd1",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 700,
  },
  amberPill: {
    border: "1px solid rgba(255,190,70,0.26)",
    background: "rgba(140,90,20,0.18)",
    color: "#ffd38b",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 800,
  },
  l1Pill: {
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    color: "#f3f3f3",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 800,
  },
  l2Pill: {
    border: "1px solid rgba(255,190,70,0.3)",
    background: "rgba(140,90,20,0.18)",
    color: "#ffd38b",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 800,
  },
  l3Pill: {
    border: "1px solid rgba(255,26,26,0.35)",
    background: "rgba(255,26,26,0.16)",
    color: "#ffb0b0",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 900,
    boxShadow: "0 0 14px rgba(255,26,26,0.12)",
  },
  chartFrame: {
    height: 620,
    borderRadius: 22,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "#0D0D0D",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.02)",
  },
  split: {
    display: "grid",
    gridTemplateColumns: "minmax(360px, 0.92fr) minmax(460px, 1.08fr)",
    gap: 14,
  },
  blockTitle: {
    fontSize: 12,
    letterSpacing: "0.26em",
    color: "rgba(255,255,255,0.42)",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: 900,
    margin: 0,
  },
  subtext: {
    fontSize: 13,
    color: "rgba(255,255,255,0.56)",
    marginTop: 4,
  },
  button: {
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
    color: "#F2F2F2",
    padding: "10px 14px",
    borderRadius: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  primaryButton: {
    border: "1px solid rgba(255,26,26,0.28)",
    background: "linear-gradient(180deg,#ff2929,#d81919)",
    color: "#fff",
    padding: "10px 14px",
    borderRadius: 14,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 0 22px rgba(255,26,26,0.16)",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    background: "#181818",
    color: "#F2F2F2",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: "12px 14px",
    outline: "none",
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0,1fr))",
    gap: 10,
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0,1fr))",
    gap: 10,
  },
  radarItemBase: {
    width: "100%",
    textAlign: "left",
    borderRadius: 18,
    padding: 14,
    color: "#F2F2F2",
    cursor: "pointer",
    transition:
      "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease",
  },
  selectedRing: {
    boxShadow:
      "0 0 0 1px rgba(255,255,255,0.16), 0 0 28px rgba(255,26,26,0.14), 0 18px 36px rgba(0,0,0,0.34)",
  },
  tableGrid: {
    display: "grid",
    gridTemplateColumns: "1.2fr .7fr .7fr .8fr .8fr .9fr",
    gap: 10,
    alignItems: "center",
  },
  statValue: {
    fontSize: 30,
    fontWeight: 900,
    marginTop: 8,
    letterSpacing: "-0.03em",
  },
  sectionSpacing: { marginTop: 14 },
  collapsedLogCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, #171717, #111111)",
    borderRadius: 20,
    padding: 14,
    boxShadow: "0 12px 28px rgba(0,0,0,0.24)",
    transition: "transform 0.18s ease, box-shadow 0.18s ease",
  },
  panelMatchHeight: {
    height: "calc(100vh - 260px)",
    minHeight: 680,
    maxHeight: 920,
  },
  scrollArea: {
    overflowY: "auto",
    paddingRight: 6,
    minHeight: 0,
  },
};

function levelPillStyle(level) {
  if (level === "L3") return ui.l3Pill;
  if (level === "L2") return ui.l2Pill;
  return ui.l1Pill;
}

function radarCardStyle(level) {
  if (level === "L3") {
    return {
      ...ui.radarItemBase,
      background:
        "linear-gradient(180deg, rgba(90,14,14,0.42), rgba(18,18,18,0.98))",
      border: "1px solid rgba(255,40,40,0.34)",
      boxShadow:
        "0 0 24px rgba(255,40,40,0.14), 0 14px 30px rgba(0,0,0,0.34)",
    };
  }
  if (level === "L2") {
    return {
      ...ui.radarItemBase,
      background:
        "linear-gradient(180deg, rgba(92,62,10,0.24), rgba(18,18,18,0.98))",
      border: "1px solid rgba(255,190,70,0.26)",
      boxShadow:
        "0 0 18px rgba(255,190,70,0.08), 0 14px 30px rgba(0,0,0,0.28)",
    };
  }
  return {
    ...ui.radarItemBase,
    background:
      "linear-gradient(180deg, rgba(24,24,24,0.98), rgba(14,14,14,0.98))",
    border: "1px solid rgba(255,255,255,0.09)",
    boxShadow: "0 10px 24px rgba(0,0,0,0.24)",
  };
}

function filterButtonStyle(active) {
  return active ? ui.primaryButton : ui.button;
}

function StatCard({ title, value, subtitle, level = null }) {
  let extra = {};
  if (level === "L3") {
    extra = {
      border: "1px solid rgba(255,26,26,0.25)",
      boxShadow:
        "0 0 24px rgba(255,26,26,0.14), 0 14px 34px rgba(0,0,0,0.28)",
      background:
        "linear-gradient(180deg, rgba(55,12,12,0.96), rgba(12,12,12,0.98))",
    };
  } else if (level === "L2") {
    extra = {
      border: "1px solid rgba(255,190,70,0.22)",
      background:
        "linear-gradient(180deg, rgba(50,35,8,0.9), rgba(12,12,12,0.98))",
    };
  }

  return (
    <div style={{ ...ui.card, ...extra }}>
      <div style={ui.blockTitle}>{title}</div>
      <div style={ui.statValue}>{value}</div>
      <div style={ui.subtext}>{subtitle}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "grid", gap: 6, marginTop: 10 }}>
      <span
        style={{
          fontSize: 12,
          color: "rgba(255,255,255,0.55)",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function MiniBox({ label, value }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        background: "#191919",
        borderRadius: 14,
        padding: 10,
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "rgba(255,255,255,0.42)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {label}
      </div>
      <strong
        style={{
          wordBreak: "break-word",
          overflowWrap: "anywhere",
          display: "block",
          marginTop: 6,
        }}
      >
        {value}
      </strong>
    </div>
  );
}

export default function App() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [logMode, setLogMode] = useState("event");
  const [showPropPanel, setShowPropPanel] = useState(false);
  const [decisionForm, setDecisionForm] = useState({ ...emptyForm });
  const [expandedLogs, setExpandedLogs] = useState({});
  const [showAllLogs, setShowAllLogs] = useState(false);

  const [screenshotData, setScreenshotData] = useState("");
  const [isReadingScreenshot, setIsReadingScreenshot] = useState(false);

  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  const [loggedDecisions, setLoggedDecisions] = useState(() =>
    safeReadStorage(STORAGE_KEYS.loggedDecisions, [])
  );
  const [pairFilter, setPairFilter] = useState("All");
  const [sweepFilter, setSweepFilter] = useState("All");
  const [levelFilter, setLevelFilter] = useState("All");
  const [feedStatus, setFeedStatus] = useState("Connecting...");
  const [hideLoggedRadar, setHideLoggedRadar] = useState(true);
  const [visibleCount, setVisibleCount] = useState(() => {
    const stored = safeReadStorage(STORAGE_KEYS.radarVisibleCount, 6);
    return stored > 0 ? stored : 6;
  });

  const [propAccount, setPropAccount] = useState(() =>
    safeReadStorage(STORAGE_KEYS.propAccount, {
      mode: "personal",
      firmName: "Custom",
      accountSize: 50000,
      profitTargetPct: 0.08,
      dailyDrawdownPct: 0.05,
      maxDrawdownPct: 0.1,
      maxRiskPerTrade: 75,
      maxLossesPerDay: 2,
      minRR: 1.5,
      dailyProfitLock: 300,
      startingBalance: 50000,
      currentBalance: 50000,
      dailyRealizedPnl: 0,
      totalRealizedPnl: 0,
      lossesToday: 0,
      tradesToday: 0,
    })
  );

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.loggedDecisions,
      JSON.stringify(loggedDecisions)
    );
  }, [loggedDecisions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.propAccount, JSON.stringify(propAccount));
  }, [propAccount]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.radarVisibleCount,
      JSON.stringify(visibleCount)
    );
  }, [visibleCount]);

  useEffect(() => {
    if (!token) {
      setCurrentUser(null);
      return;
    }

    fetch(`${API_BASE}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        return data;
      })
      .then((data) => {
        if (!data?.error) setCurrentUser(data);
      })
      .catch((err) => {
        console.error("Auth me failed:", err);
        setCurrentUser(null);
      });
  }, [token]);

  useEffect(() => {
    let mounted = true;

    async function loadEvents() {
      try {
        const res = await fetch(`${API_BASE}/events`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const raw = await res.json();
        if (!mounted) return;

        const data = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.events)
          ? raw.events
          : null;

        if (!Array.isArray(data)) {
          throw new Error("Feed did not return an array");
        }

        const enriched = data.map((event, idx) => {
          const stableId = buildEventKey(event, idx);
          return {
            ...event,
            id: stableId,
            signalLevel: getSignalLevel(event),
            _ts: new Date(event.timestampUtc || event.timestamp || 0).getTime() || 0,
          };
        });

        setFeedStatus(`Live Feed (${enriched.length})`);

        setEvents((prev) => {
          const merged = [...enriched, ...prev];
          const seen = new Set();

          const unique = merged.filter((item) => {
            const key = item.id || eventKey(item);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          unique.sort((a, b) => (b._ts || 0) - (a._ts || 0));
          return unique.slice(0, 300);
        });

        setSelectedEvent((prev) => {
          if (prev) {
            const prevKey = prev.id || eventKey(prev);
            const existing = enriched.find((e) => (e.id || eventKey(e)) === prevKey);
            return existing || prev;
          }
          const hot = enriched.find((e) => isHotSignal(e));
          return hot || enriched[0] || null;
        });
      } catch (err) {
        console.error("EVENT FEED FAILED:", err);
        if (!mounted) return;
        setFeedStatus(`Feed Error: ${err.message}`);
      }
    }

    loadEvents();
    const timer = setInterval(loadEvents, 3000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const groupedRadarEvents = useMemo(() => groupRadarEvents(events), [events]);

  const loggedEventIds = useMemo(
    () => new Set(loggedDecisions.map((item) => item.linkedEventId).filter(Boolean)),
    [loggedDecisions]
  );

  const pairOptions = useMemo(
    () => ["All", ...new Set(groupedRadarEvents.map((e) => e.pair).filter(Boolean))],
    [groupedRadarEvents]
  );

  const sweepOptions = useMemo(
    () => ["All", ...new Set(groupedRadarEvents.map((e) => e.sweepType).filter(Boolean))],
    [groupedRadarEvents]
  );

  const filteredEvents = useMemo(() => {
    const results = groupedRadarEvents.filter((e) => {
      const pairOk = pairFilter === "All" || e.pair === pairFilter;
      const sweepOk = sweepFilter === "All" || e.sweepType === sweepFilter;
      const eventStableId = e.id || eventKey(e);
      const loggedOk = !hideLoggedRadar || !loggedEventIds.has(eventStableId);
      const levelOk = levelFilter === "All" || e.signalLevel === levelFilter;
      return pairOk && sweepOk && loggedOk && levelOk;
    });

    results.sort(
      (a, b) =>
        (new Date(b.timestampUtc || b.timestamp || 0).getTime() || 0) -
        (new Date(a.timestampUtc || a.timestamp || 0).getTime() || 0)
    );

    return results;
  }, [
    groupedRadarEvents,
    pairFilter,
    sweepFilter,
    levelFilter,
    hideLoggedRadar,
    loggedEventIds,
  ]);

  const visibleEvents = useMemo(
    () => filteredEvents.slice(0, visibleCount),
    [filteredEvents, visibleCount]
  );

  const finalVisibleEvents = useMemo(
    () =>
      [...visibleEvents].sort(
        (a, b) =>
          (new Date(b.timestampUtc || b.timestamp || 0).getTime() || 0) -
          (new Date(a.timestampUtc || a.timestamp || 0).getTime() || 0)
      ),
    [visibleEvents]
  );

  const visibleLoggedDecisions = useMemo(
    () => (showAllLogs ? loggedDecisions : loggedDecisions.slice(0, 8)),
    [loggedDecisions, showAllLogs]
  );

  const stats = useMemo(() => {
    const levelCounts = events.reduce(
      (acc, event) => {
        const level = event.signalLevel || "L1";
        acc[level] = (acc[level] || 0) + 1;
        return acc;
      },
      { L1: 0, L2: 0, L3: 0 }
    );

    const takenTrades = loggedDecisions.filter((d) => d.action === "Taken").length;
    const avgLeverage = avg(loggedDecisions.map((d) => d.leverage || 1));

    const biggestMistake =
      Object.entries(
        loggedDecisions.reduce((acc, item) => {
          if (item.ruleBreak && item.ruleBreak !== "None") {
            acc[item.ruleBreak] = (acc[item.ruleBreak] || 0) + 1;
          }
          return acc;
        }, {})
      ).sort((a, b) => b[1] - a[1])[0]?.[0] || "None";

    const avgAiScore = avg(loggedDecisions.map((d) => d.aiScore || 0));
    const avgDiscipline = avg(loggedDecisions.map((d) => d.disciplineScore || 0));
    const avgRr = avg(loggedDecisions.map((d) => calcRR(d.entry, d.stop, d.tp1) || 0));
    const winRate = loggedDecisions.length
      ? Math.round(
          (loggedDecisions.filter((d) => Number(d.pnl || 0) > 0).length /
            loggedDecisions.length) *
            100
        )
      : 0;

    return {
      l1Count: levelCounts.L1 || 0,
      l2Count: levelCounts.L2 || 0,
      l3Count: levelCounts.L3 || 0,
      takenTrades,
      biggestMistake,
      avgLeverage,
      avgAiScore,
      avgDiscipline,
      avgRr,
      winRate,
      activeWaveCount: groupedRadarEvents.length,
    };
  }, [events, groupedRadarEvents, loggedDecisions]);

  const propMetrics = useMemo(() => getPropMetrics(propAccount), [propAccount]);

  const effectiveComplianceTarget = useMemo(() => {
    if (logMode === "manual") return { ...decisionForm };
    if (!selectedEvent) return null;
    return {
      ...selectedEvent,
      entry: decisionForm.entry || selectedEvent.entry,
      stop: decisionForm.stop || selectedEvent.stop,
      tp1: decisionForm.tp1 || selectedEvent.tp1,
      tp2: decisionForm.tp2 || selectedEvent.tp2,
      timeframe: decisionForm.timeframe || selectedEvent.timeframe,
      directionBias: decisionForm.directionBias || selectedEvent.directionBias,
      sweepType: decisionForm.sweepType || selectedEvent.sweepType,
      emaContext: decisionForm.emaContext || selectedEvent.emaContext,
      leverage: decisionForm.leverage || 1,
      attemptTag: decisionForm.attemptTag || selectedEvent.attemptTag || "First Sweep",
    };
  }, [logMode, selectedEvent, decisionForm]);

  const selectedCompliance = useMemo(
    () => evaluatePropCompliance(effectiveComplianceTarget, propAccount),
    [effectiveComplianceTarget, propAccount]
  );

  const chartPair =
    logMode === "manual"
      ? decisionForm.pair || "BTC/USDT"
      : selectedEvent?.pair || "BTC/USDT";

  const activeTimeframe =
    logMode === "manual"
      ? decisionForm.timeframe || "3m"
      : selectedEvent?.timeframe || decisionForm.timeframe || "3m";

  const chartSymbol = getTradingViewSymbol(chartPair);
  const chartInterval = getTradingViewInterval(activeTimeframe);
  const blofinUrl = getBlofinUrl(chartPair);

  function updateDecision(field, value) {
    setDecisionForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateProp(field, value) {
    setPropAccount((prev) => ({
      ...prev,
      [field]: typeof prev[field] === "number" ? Number(value) || 0 : value,
    }));
  }

  async function registerUser() {
    if (!authEmail.trim() || !authPassword.trim()) {
      alert("Enter email and password.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: authEmail.trim(),
          password: authPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Register failed");
        return;
      }

      setToken(data.token);
      localStorage.setItem("token", data.token);
      setCurrentUser(data.user || null);
      alert("Registered and logged in.");
    } catch (err) {
      console.error(err);
      alert("Register failed");
    }
  }

  async function loginUser() {
    if (!authEmail.trim() || !authPassword.trim()) {
      alert("Enter email and password.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: authEmail.trim(),
          password: authPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Login failed");
        return;
      }

      setToken(data.token);
      localStorage.setItem("token", data.token);
      setCurrentUser(data.user || null);
      alert("Logged in.");
    } catch (err) {
      console.error(err);
      alert("Login failed");
    }
  }

  function logoutUser() {
    setToken("");
    setCurrentUser(null);
    localStorage.removeItem("token");
  }

  function loadEvent(event) {
    setSelectedEvent(event);
    setScreenshotData("");
    setIsReadingScreenshot(false);
    setLogMode("event");
    setDecisionForm({
      ...emptyForm,
      pair: event.pair || "",
      timeframe: event.timeframe || "3m",
      session: event.session || "New York",
      directionBias: event.directionBias || "Short",
      eventType: event.eventType || "SWEEP_DETECTED",
      sweepType: event.sweepType || "High Sweep",
      emaContext: event.emaContext || "EMA99 Rejection",
      attemptTag: event.attemptTag || "First Sweep",
      leverage: 1,
      entry: event.entry ?? "",
      stop: event.stop ?? "",
      tp1: event.tp1 ?? "",
      tp2: event.tp2 ?? "",
      structure: event.structure || "",
    });
  }

  function switchToManualLog() {
    setLogMode("manual");
    setScreenshotData("");
    setIsReadingScreenshot(false);
    setDecisionForm({
      ...emptyForm,
      pair: chartPair,
      timeframe: activeTimeframe,
    });
  }

  function resetPropDay() {
    setPropAccount((prev) => ({
      ...prev,
      dailyRealizedPnl: 0,
      lossesToday: 0,
      tradesToday: 0,
    }));
  }

  function resetPropAccount() {
    setPropAccount((prev) => ({
      ...prev,
      currentBalance: prev.startingBalance,
      dailyRealizedPnl: 0,
      totalRealizedPnl: 0,
      lossesToday: 0,
      tradesToday: 0,
    }));
  }

  function toggleLogCard(id) {
    setExpandedLogs((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  async function saveDecision() {
    if (!token) {
      alert("Please log in first.");
      return;
    }

    if (isReadingScreenshot) {
      alert("Screenshot is still loading. Wait a second and try again.");
      return;
    }

    const pair = (decisionForm.pair || "").trim();
    if (!pair) {
      alert("Please enter a pair.");
      return;
    }

    const leverage = Math.max(1, num(decisionForm.leverage) || 1);
    const baseLevel =
      logMode === "event" && selectedEvent
        ? getSignalLevel({
            ...selectedEvent,
            attemptTag: decisionForm.attemptTag || selectedEvent.attemptTag,
          })
        : getSignalLevel({
            ...decisionForm,
            botConfidence: 0.75,
            reclaimConfirmed: decisionForm.action === "Taken",
          });

    const effectiveEvent =
      logMode === "event" && selectedEvent
        ? {
            ...selectedEvent,
            pair,
            timeframe: decisionForm.timeframe,
            session: decisionForm.session || selectedEvent.session,
            directionBias: decisionForm.directionBias,
            eventType: decisionForm.eventType || selectedEvent.eventType,
            sweepType: decisionForm.sweepType,
            emaContext: decisionForm.emaContext,
            attemptTag: decisionForm.attemptTag,
            leverage,
            entry: decisionForm.entry || selectedEvent.entry,
            stop: decisionForm.stop || selectedEvent.stop,
            tp1: decisionForm.tp1 || selectedEvent.tp1,
            tp2: decisionForm.tp2 || selectedEvent.tp2,
          }
        : {
            pair,
            timeframe: decisionForm.timeframe,
            session: decisionForm.session,
            directionBias: decisionForm.directionBias,
            eventType: decisionForm.eventType,
            sweepType: decisionForm.sweepType,
            emaContext: decisionForm.emaContext,
            attemptTag: decisionForm.attemptTag,
            leverage,
            entry: decisionForm.entry,
            stop: decisionForm.stop,
            tp1: decisionForm.tp1,
            tp2: decisionForm.tp2,
          };

    const compliance = evaluatePropCompliance(effectiveEvent, propAccount);

    const linkedEventId =
      logMode === "event" && selectedEvent ? selectedEvent.id || eventKey(selectedEvent) : null;

    const entry = {
      id: `log_${Date.now()}`,
      linkedEventId,
      timestampUtc: new Date().toISOString(),
      displayTime: displayLogTimestamp(new Date().toISOString()),
      pair,
      timeframe: decisionForm.timeframe,
      session: decisionForm.session,
      directionBias: decisionForm.directionBias,
      eventType: decisionForm.eventType,
      sweepType: decisionForm.sweepType,
      emaContext: decisionForm.emaContext,
      attemptTag: decisionForm.attemptTag,
      leverage,
      action: decisionForm.action,
      timing: decisionForm.timing,
      planFollowed: decisionForm.planFollowed,
      ruleBreak: decisionForm.ruleBreak,
      disciplineScore: Number(decisionForm.disciplineScore),
      setupQuality: Number(decisionForm.setupQuality),
      emotionalPressure: Number(decisionForm.emotionalPressure),
      entry: num(decisionForm.entry),
      stop: num(decisionForm.stop),
      exit: num(decisionForm.exit),
      tp1: num(decisionForm.tp1),
      tp2: num(decisionForm.tp2),
      pnl: num(decisionForm.pnl),
      notes: decisionForm.notes,
      screenshot: screenshotData,
      structure: decisionForm.structure,
      sourceType: logMode === "event" ? "Event Response" : "Manual Log",
      riskAmount: compliance.riskAmount,
      propQualified: compliance.qualified,
      propStatus: compliance.status,
      complianceNotes: compliance.notes,
      signalLevel: baseLevel,
      tradeGrade: getTradeGrade(decisionForm),
    };

    console.log(
      "SCREENSHOT BEFORE SAVE:",
      entry.screenshot ? entry.screenshot.slice(0, 60) : "EMPTY"
    );

    try {
      const res = await fetch(`${API_BASE}/logs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(entry),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("DB save failed:", data);
        alert(data?.error || "Failed to save log");
        return;
      }

      const saved = data?.log || {};

      const mergedEntry = {
        ...entry,
        aiScore: saved.aiScore,
        aiGrade: saved.aiGrade,
        aiClassification: saved.aiClassification,
        aiSummary: saved.aiSummary,
        aiCoachingNote: saved.aiCoachingNote,
      };

      setLoggedDecisions((prev) => [mergedEntry, ...prev].slice(0, 100));
      setScreenshotData("");
      setIsReadingScreenshot(false);

      if (entry.action === "Taken") {
        setPropAccount((prev) => {
          const pnl = num(entry.pnl);
          return {
            ...prev,
            tradesToday: prev.tradesToday + 1,
            lossesToday: pnl < 0 ? prev.lossesToday + 1 : prev.lossesToday,
            dailyRealizedPnl: prev.dailyRealizedPnl + pnl,
            totalRealizedPnl: prev.totalRealizedPnl + pnl,
            currentBalance: prev.currentBalance + pnl,
          };
        });
      }

      setDecisionForm((prev) => ({
        ...emptyForm,
        pair: logMode === "event" ? prev.pair : "",
        timeframe: prev.timeframe || "3m",
      }));
    } catch (err) {
      console.error("DB save failed:", err);
      alert("Failed to save log");
    }
  }

  const selectedSignalLevel =
    logMode === "event" && selectedEvent
      ? getSignalLevel({
          ...selectedEvent,
          attemptTag: decisionForm.attemptTag || selectedEvent.attemptTag,
        })
      : getSignalLevel({
          ...decisionForm,
          botConfidence: 0.75,
          reclaimConfirmed: decisionForm.action === "Taken",
        });

  const selectedConfidence =
    logMode === "event" ? Number(selectedEvent?.botConfidence || 0) : 0.75;

  const selectedStableId = selectedEvent?.id || eventKey(selectedEvent);

  return (
    <div style={ui.shell}>
      <header style={ui.header}>
        <div style={ui.headerInner}>
          <div style={ui.brandWrap}>
            <div style={ui.radarIconBox}>
              <div style={ui.radarIcon}>
                <div
                  style={{
                    position: "absolute",
                    inset: 4,
                    border: "1px solid rgba(255,26,26,0.5)",
                    borderRadius: "50%",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: 12,
                    height: 1,
                    background: "#FF1A1A",
                    transform: "translate(-50%,-50%)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: 1,
                    height: 12,
                    background: "#FF1A1A",
                    transform: "translate(-50%,-50%)",
                  }}
                />
              </div>
            </div>

            <div>
              <div style={ui.blockTitle}>Red October Systems</div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 900,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                Liquidity Lab
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>
              {feedStatus}
            </span>

            <button
              style={logMode === "event" ? ui.primaryButton : ui.button}
              onClick={() => selectedEvent && loadEvent(selectedEvent)}
              type="button"
            >
              Event Mode
            </button>

            <button
              style={logMode === "manual" ? ui.primaryButton : ui.button}
              onClick={switchToManualLog}
              type="button"
            >
              Manual Mode
            </button>

            {token ? (
              <>
                <span style={ui.pill}>
                  {currentUser?.email || "Logged In"}
                  {currentUser?.isAdmin ? " • Admin" : ""}
                </span>
                <button style={ui.button} onClick={logoutUser} type="button">
                  Logout
                </button>
              </>
            ) : (
              <>
                <input
                  style={{ ...ui.input, width: 180, padding: "10px 12px" }}
                  type="email"
                  placeholder="Email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                />
                <input
                  style={{ ...ui.input, width: 160, padding: "10px 12px" }}
                  type="password"
                  placeholder="Password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                />
                <button style={ui.button} onClick={registerUser} type="button">
                  Register
                </button>
                <button style={ui.primaryButton} onClick={loginUser} type="button">
                  Login
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div style={ui.container}>
        <div style={ui.topCardRow}>
          <StatCard title="L3 Active" value={stats.l3Count} subtitle="Elite setups" level="L3" />
          <StatCard title="L2 Active" value={stats.l2Count} subtitle="Strong setups" level="L2" />
          <StatCard title="L1 Active" value={stats.l1Count} subtitle="Watchlist setups" level="L1" />
          <StatCard title="Active Waves" value={stats.activeWaveCount} subtitle="Grouped radar ideas" />
          <StatCard
            title="Avg Leverage"
            value={stats.avgLeverage ? `${stats.avgLeverage.toFixed(1)}x` : "1.0x"}
            subtitle="Logged average"
          />
          <StatCard title="Top Mistake" value={stats.biggestMistake} subtitle="Most common issue" />
        </div>

        <section style={{ ...ui.card, marginBottom: 14 }}>
          <div style={ui.blockTitle}>Performance</div>
          <h2 style={ui.title}>Trade Intelligence</h2>

          <div style={ui.topCardRow}>
            <StatCard title="Win Rate" value={`${stats.winRate}%`} subtitle="Positive trades" />
            <StatCard title="Avg RR" value={stats.avgRr ? stats.avgRr.toFixed(2) : "0.00"} subtitle="To TP1" />
            <StatCard title="Discipline" value={stats.avgDiscipline ? stats.avgDiscipline.toFixed(1) : "0.0"} subtitle="Score avg" />
            <StatCard title="AI Score" value={stats.avgAiScore ? stats.avgAiScore.toFixed(1) : "0.0"} subtitle="System grade" />
          </div>
        </section>

        <section style={{ ...ui.card, marginBottom: 14 }}>
          <div style={ui.toolbar}>
            <div>
              <div style={ui.blockTitle}>Prop Panel</div>
              <h2 style={ui.title}>Compact Account Status</h2>
              <div style={ui.subtext}>
                Open only when needed so the chart and journal stay primary.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={ui.pill}>
                {propAccount.mode === "prop" ? "Prop Mode" : "Personal Mode"}
              </span>
              <span style={ui.pill}>Acct {propAccount.accountSize.toLocaleString()}</span>
              <span style={ui.pill}>DD Left {propMetrics.remainingDailyLoss.toFixed(0)}</span>
              <span style={ui.pill}>
                Losses {propAccount.lossesToday}/{propAccount.maxLossesPerDay}
              </span>
              <button
                style={showPropPanel ? ui.primaryButton : ui.button}
                onClick={() => setShowPropPanel((prev) => !prev)}
                type="button"
              >
                {showPropPanel ? "Hide Prop Panel" : "Open Prop Panel"}
              </button>
            </div>
          </div>

          {showPropPanel ? (
            <>
              <div style={ui.grid3}>
                <Field label="Mode">
                  <select
                    style={ui.input}
                    value={propAccount.mode}
                    onChange={(e) => updateProp("mode", e.target.value)}
                  >
                    <option value="personal">Personal</option>
                    <option value="prop">Prop</option>
                  </select>
                </Field>
                <Field label="Account Size">
                  <input
                    style={ui.input}
                    type="number"
                    value={propAccount.accountSize}
                    onChange={(e) => updateProp("accountSize", e.target.value)}
                  />
                </Field>
                <Field label="Max Risk / Trade">
                  <input
                    style={ui.input}
                    type="number"
                    value={propAccount.maxRiskPerTrade}
                    onChange={(e) => updateProp("maxRiskPerTrade", e.target.value)}
                  />
                </Field>
              </div>

              <div style={{ ...ui.topCardRow, marginTop: 12, marginBottom: 0 }}>
                <StatCard
                  title="Daily DD Used"
                  value={propMetrics.dailyLossUsed.toFixed(0)}
                  subtitle={`/ ${propMetrics.dailyLossLimit.toFixed(0)}`}
                />
                <StatCard
                  title="Remaining Daily"
                  value={propMetrics.remainingDailyLoss.toFixed(0)}
                  subtitle="Loss room left"
                />
                <StatCard
                  title="Losses Today"
                  value={propAccount.lossesToday}
                  subtitle={`/ ${propAccount.maxLossesPerDay}`}
                />
                <StatCard
                  title="Profit Target"
                  value={propMetrics.profitTarget.toFixed(0)}
                  subtitle="Target dollars"
                />
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                <button style={ui.button} onClick={resetPropDay} type="button">
                  Reset Day
                </button>
                <button style={ui.button} onClick={resetPropAccount} type="button">
                  Reset Account
                </button>
              </div>
            </>
          ) : null}
        </section>

        <section style={ui.chartCard}>
          <div style={ui.toolbar}>
            <div>
              <div style={ui.blockTitle}>Live Pattern Chart</div>
              <h2 style={ui.title}>
                {chartPair} • {activeTimeframe}
              </h2>
              <div style={ui.subtext}>Chart first, decisions second, logs below.</div>

              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <span style={ui.pill}>
                  {logMode === "event"
                    ? `${selectedEvent?.sweepType || "Sweep"} → ${selectedEvent?.eventType || "Event"}`
                    : `${decisionForm.sweepType} → ${decisionForm.eventType}`}
                </span>
                <span style={levelPillStyle(selectedSignalLevel)}>{selectedSignalLevel}</span>
                <span style={ui.amberPill}>
                  {decisionForm.attemptTag || selectedEvent?.attemptTag || "First Sweep"}
                </span>
                <span
                  style={
                    decisionForm.directionBias === "Long" || selectedEvent?.directionBias === "Long"
                      ? ui.greenPill
                      : ui.redPill
                  }
                >
                  {logMode === "event"
                    ? selectedEvent?.directionBias || "Bias"
                    : decisionForm.directionBias}
                </span>
                <span style={ui.pill}>Confidence {pct(selectedConfidence)}</span>
              </div>
            </div>

            <div style={ui.pillRow}>
              <span style={ui.redPill}>SYSTEM: SCANNING</span>
              <span style={ui.pill}>Liquidity Area Active</span>
              <a
                href={blofinUrl}
                target="_blank"
                rel="noreferrer"
                style={{ ...ui.button, textDecoration: "none" }}
              >
                Open BloFin
              </a>
            </div>
          </div>

          <div style={ui.chartFrame}>
            <iframe
              key={`${chartSymbol}_${chartInterval}`}
              title={`Chart for ${chartPair}`}
              src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=${encodeURIComponent(
                chartSymbol
              )}&interval=${encodeURIComponent(
                chartInterval
              )}&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=0f172a&studies=[]&theme=dark&style=1&timezone=America%2FNew_York&withdateranges=1&hideideas=1`}
              width="100%"
              height="100%"
              frameBorder="0"
              allowTransparency="true"
              scrolling="no"
            />
          </div>
        </section>

        <section style={ui.split}>
          <div
            style={{
              ...ui.radarCardShell,
              ...ui.panelMatchHeight,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={ui.toolbar}>
              <div>
                <div style={ui.blockTitle}>Live Radar</div>
                <h2 style={ui.title}>L-System Priority Feed</h2>
                <div style={ui.subtext}>
                  {visibleEvents.length} / {filteredEvents.length} visible
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {LEVEL_FILTERS.map((level) => (
                  <button
                    key={level}
                    style={filterButtonStyle(levelFilter === level)}
                    onClick={() => setLevelFilter(level)}
                    type="button"
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
              <select
                style={ui.input}
                value={pairFilter}
                onChange={(e) => setPairFilter(e.target.value)}
              >
                {pairOptions.map((pair) => (
                  <option key={pair} value={pair}>
                    {pair}
                  </option>
                ))}
              </select>

              <select
                style={ui.input}
                value={sweepFilter}
                onChange={(e) => setSweepFilter(e.target.value)}
              >
                {sweepOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>

              <button
                style={hideLoggedRadar ? ui.primaryButton : ui.button}
                onClick={() => setHideLoggedRadar((prev) => !prev)}
                type="button"
              >
                {hideLoggedRadar ? "Hiding Logged" : "Showing Logged"}
              </button>
            </div>

            <div style={{ ...ui.scrollArea, flex: 1 }}>
              {visibleEvents.length === 0 ? (
                <div style={{ ...ui.card, background: "#141414", padding: 20 }}>
                  No live events coming in yet. Feed status: {feedStatus}
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {finalVisibleEvents.map((event) => {
                    const level = event.signalLevel || getSignalLevel(event);
                    const stableId = event.id || eventKey(event);
                    const isSelected = selectedStableId === stableId && logMode === "event";
                    const baseStyle = radarCardStyle(level);
                    const finalStyle = isSelected
                      ? { ...baseStyle, ...ui.selectedRing }
                      : baseStyle;

                    return (
                      <button
                        key={stableId}
                        style={finalStyle}
                        onClick={() => loadEvent(event)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "translateY(-3px)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                        }}
                        type="button"
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            alignItems: "start",
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ display: "grid", gap: 8, flex: 1 }}>
                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                alignItems: "center",
                                flexWrap: "wrap",
                              }}
                            >
                              <strong style={{ fontSize: 18 }}>{event.pair}</strong>
                              <span style={levelPillStyle(level)}>{level}</span>
                              <span
                                style={
                                  event.directionBias === "Long" ? ui.greenPill : ui.redPill
                                }
                              >
                                {event.directionBias}
                              </span>
                              <span style={ui.pill}>{event.timeframe}</span>
                              {isHotSignal(event) ? <span style={ui.redPill}>HOT</span> : null}
                            </div>

                            <div
                              style={{
                                fontWeight: 900,
                                fontSize: 18,
                                color:
                                  level === "L3"
                                    ? "#ffb0b0"
                                    : level === "L2"
                                    ? "#ffd38b"
                                    : "#f3f3f3",
                              }}
                            >
                              {event.sweepType}
                            </div>

                            <div style={{ color: "rgba(255,255,255,0.85)", fontWeight: 700 }}>
                              {prettyEventType(event.eventType)}
                            </div>

                            {event.groupedTypes?.length > 1 ? (
                              <div
                                style={{
                                  color: "rgba(255,255,255,0.48)",
                                  fontSize: 12,
                                  marginTop: 4,
                                }}
                              >
                                Wave: {event.groupedTypes.map(prettyEventType).join(" • ")}
                              </div>
                            ) : null}

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <span style={ui.amberPill}>{event.attemptTag || "First Sweep"}</span>
                              <span style={ui.pill}>{event.session}</span>
                              <span style={ui.pill}>{pct(event.botConfidence || 0)}</span>
                              {event.groupedCount > 1 ? (
                                <span style={ui.pill}>Wave x{event.groupedCount}</span>
                              ) : null}
                            </div>

                            <div style={{ color: "rgba(255,255,255,0.56)", fontSize: 13 }}>
                              {event.emaContext}
                            </div>

                            {event.structure ? (
                              <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 12 }}>
                                {event.structure}
                              </div>
                            ) : null}
                          </div>

                          <div
                            style={{
                              color: "rgba(255,255,255,0.55)",
                              fontSize: 12,
                              minWidth: 90,
                              textAlign: "right",
                              display: "grid",
                              gap: 4,
                            }}
                          >
                            <div>{displayLogTimestamp(event.timestampUtc)}</div>
                            <div>{displayClockTime(event.timestampUtc)}</div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                          <div
                            style={{
                              flex: 1,
                              height: 1,
                              background: "rgba(255,255,255,0.14)",
                            }}
                          />
                          <div
                            style={{
                              color:
                                level === "L3"
                                  ? "#ff7676"
                                  : level === "L2"
                                  ? "#ffcc7a"
                                  : "rgba(255,255,255,0.45)",
                              fontSize: 11,
                              letterSpacing: "0.12em",
                              textTransform: "uppercase",
                            }}
                          >
                            liquidity line
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {filteredEvents.length > visibleCount ? (
              <div style={{ marginTop: 12 }}>
                <button
                  style={ui.button}
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + 6)}
                >
                  Show More
                </button>
              </div>
            ) : null}
          </div>

          <div
            style={{
              ...ui.card,
              ...ui.panelMatchHeight,
              overflowY: "auto",
            }}
          >
            <div style={ui.toolbar}>
              <div>
                <div style={ui.blockTitle}>
                  {logMode === "event" ? "Trade Journal" : "Manual Journal"}
                </div>
                <h2 style={ui.title}>
                  {logMode === "event"
                    ? "Respond to Selected Event"
                    : "Log Without Radar Card"}
                </h2>
                <div style={ui.subtext}>
                  {logMode === "event"
                    ? selectedEvent?.pair || "No event selected"
                    : decisionForm.pair || "Manual entry"}
                </div>
              </div>

              <div style={ui.pillRow}>
                <span style={levelPillStyle(selectedSignalLevel)}>{selectedSignalLevel}</span>
                <span style={ui.amberPill}>{decisionForm.attemptTag}</span>
                <span style={ui.pill}>{decisionForm.leverage || 1}x</span>
              </div>
            </div>

            <div
              style={{
                border: `1px solid ${
                  selectedCompliance.status === "PASS"
                    ? "rgba(110,255,170,0.25)"
                    : selectedCompliance.status === "BORDERLINE"
                    ? "rgba(255,190,70,0.25)"
                    : "rgba(255,80,80,0.25)"
                }`,
                background:
                  selectedCompliance.status === "PASS"
                    ? "rgba(20,80,40,0.18)"
                    : selectedCompliance.status === "BORDERLINE"
                    ? "rgba(90,60,10,0.18)"
                    : "rgba(80,20,20,0.18)",
                borderRadius: 18,
                padding: 14,
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <strong>
                  {selectedCompliance.status === "PASS"
                    ? "PASS – TAKE THIS"
                    : selectedCompliance.status === "BORDERLINE"
                    ? "BORDERLINE"
                    : "DO NOT TAKE"}
                </strong>
                <span style={ui.pill}>Risk {selectedCompliance.riskAmount.toFixed(2)}</span>
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={ui.pill}>RR1 {selectedCompliance.rrToTp1.toFixed(2)}</span>
                <span style={ui.pill}>RR2 {selectedCompliance.rrToTp2.toFixed(2)}</span>
                <span style={ui.pill}>Lev {decisionForm.leverage || 1}x</span>
              </div>
            </div>

            <div style={ui.grid2}>
              <Field label="Attempt Tag">
                <select
                  style={ui.input}
                  value={decisionForm.attemptTag}
                  onChange={(e) => updateDecision("attemptTag", e.target.value)}
                >
                  {ATTEMPT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Leverage">
                <input
                  style={ui.input}
                  type="number"
                  min="1"
                  step="0.1"
                  value={decisionForm.leverage}
                  onChange={(e) => updateDecision("leverage", e.target.value)}
                />
              </Field>
            </div>

            {logMode === "manual" && (
              <>
                <div style={{ ...ui.grid2, marginTop: 10 }}>
                  <Field label="Pair">
                    <input
                      style={ui.input}
                      type="text"
                      placeholder="SUI/USDT"
                      value={decisionForm.pair}
                      onChange={(e) => updateDecision("pair", e.target.value)}
                    />
                  </Field>
                  <Field label="Timeframe">
                    <select
                      style={ui.input}
                      value={decisionForm.timeframe || "3m"}
                      onChange={(e) => updateDecision("timeframe", e.target.value)}
                    >
                      {TIMEFRAME_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div style={{ ...ui.grid2, marginTop: 10 }}>
                  <Field label="Direction Bias">
                    <select
                      style={ui.input}
                      value={decisionForm.directionBias || "Short"}
                      onChange={(e) => updateDecision("directionBias", e.target.value)}
                    >
                      {DIRECTION_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Session">
                    <select
                      style={ui.input}
                      value={decisionForm.session || "New York"}
                      onChange={(e) => updateDecision("session", e.target.value)}
                    >
                      {SESSION_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div style={{ ...ui.grid2, marginTop: 10 }}>
                  <Field label="Event Type">
                    <select
                      style={ui.input}
                      value={decisionForm.eventType || "SWEEP_DETECTED"}
                      onChange={(e) => updateDecision("eventType", e.target.value)}
                    >
                      {EVENT_TYPE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Sweep Type">
                    <select
                      style={ui.input}
                      value={decisionForm.sweepType || "High Sweep"}
                      onChange={(e) => updateDecision("sweepType", e.target.value)}
                    >
                      {SWEEP_TYPE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div style={{ ...ui.grid2, marginTop: 10 }}>
                  <Field label="EMA Context">
                    <select
                      style={ui.input}
                      value={decisionForm.emaContext || "EMA99 Rejection"}
                      onChange={(e) => updateDecision("emaContext", e.target.value)}
                    >
                      {EMA_CONTEXT_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Structure">
                    <input
                      style={ui.input}
                      type="text"
                      placeholder="Range high liquidity clear"
                      value={decisionForm.structure || ""}
                      onChange={(e) => updateDecision("structure", e.target.value)}
                    />
                  </Field>
                </div>
              </>
            )}

            <div style={{ ...ui.grid2, marginTop: 10 }}>
              <Field label="Action Taken">
                <select
                  style={ui.input}
                  value={decisionForm.action || "Taken"}
                  onChange={(e) => updateDecision("action", e.target.value)}
                >
                  {ACTION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Entry Timing">
                <select
                  style={ui.input}
                  value={decisionForm.timing || "On Confirmation"}
                  onChange={(e) => updateDecision("timing", e.target.value)}
                >
                  {TIMING_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div style={{ ...ui.grid2, marginTop: 10 }}>
              <Field label="Plan Adherence">
                <select
                  style={ui.input}
                  value={decisionForm.planFollowed || "Yes"}
                  onChange={(e) => updateDecision("planFollowed", e.target.value)}
                >
                  {PLAN_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Execution Mistake">
                <select
                  style={ui.input}
                  value={decisionForm.ruleBreak || "None"}
                  onChange={(e) => updateDecision("ruleBreak", e.target.value)}
                >
                  {RULE_BREAK_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div style={{ ...ui.grid3, marginTop: 10 }}>
              <Field label="Discipline Score">
                <input
                  style={ui.input}
                  type="number"
                  min="1"
                  max="10"
                  value={decisionForm.disciplineScore}
                  onChange={(e) => updateDecision("disciplineScore", e.target.value)}
                />
              </Field>
              <Field label="Setup Quality">
                <input
                  style={ui.input}
                  type="number"
                  min="1"
                  max="10"
                  value={decisionForm.setupQuality}
                  onChange={(e) => updateDecision("setupQuality", e.target.value)}
                />
              </Field>
              <Field label="Emotional Pressure">
                <input
                  style={ui.input}
                  type="number"
                  min="1"
                  max="10"
                  value={decisionForm.emotionalPressure}
                  onChange={(e) => updateDecision("emotionalPressure", e.target.value)}
                />
              </Field>
            </div>

            <div style={{ ...ui.grid2, marginTop: 10 }}>
              <Field label="Entry">
                <input
                  style={ui.input}
                  type="number"
                  step="any"
                  value={decisionForm.entry}
                  onChange={(e) => updateDecision("entry", e.target.value)}
                />
              </Field>
              <Field label="Stop">
                <input
                  style={ui.input}
                  type="number"
                  step="any"
                  value={decisionForm.stop}
                  onChange={(e) => updateDecision("stop", e.target.value)}
                />
              </Field>
            </div>

            <div style={{ ...ui.grid3, marginTop: 10 }}>
              <Field label="TP1">
                <input
                  style={ui.input}
                  type="number"
                  step="any"
                  value={decisionForm.tp1}
                  onChange={(e) => updateDecision("tp1", e.target.value)}
                />
              </Field>
              <Field label="TP2">
                <input
                  style={ui.input}
                  type="number"
                  step="any"
                  value={decisionForm.tp2}
                  onChange={(e) => updateDecision("tp2", e.target.value)}
                />
              </Field>
              <Field label="Exit">
                <input
                  style={ui.input}
                  type="number"
                  step="any"
                  value={decisionForm.exit}
                  onChange={(e) => updateDecision("exit", e.target.value)}
                />
              </Field>
            </div>

            <div style={{ ...ui.grid2, marginTop: 10 }}>
              <Field label="PnL">
                <input
                  style={ui.input}
                  type="number"
                  step="any"
                  value={decisionForm.pnl}
                  onChange={(e) => updateDecision("pnl", e.target.value)}
                />
              </Field>
              <Field label="Decision Notes">
                <textarea
                  style={{ ...ui.input, minHeight: 100, resize: "vertical" }}
                  rows="4"
                  value={decisionForm.notes}
                  onChange={(e) => updateDecision("notes", e.target.value)}
                />
              </Field>
            </div>

            <Field label="Screenshot">
              <input
                type="file"
                accept="image/*"
                style={ui.input}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) {
                    setScreenshotData("");
                    return;
                  }

                  setIsReadingScreenshot(true);

                  const reader = new FileReader();

                  reader.onload = () => {
                    const result = typeof reader.result === "string" ? reader.result : "";
                    console.log("SCREENSHOT READY:", result ? result.slice(0, 60) : "BLANK");
                    setScreenshotData(result);
                    setIsReadingScreenshot(false);
                  };

                  reader.onerror = () => {
                    console.error("Screenshot read failed");
                    setScreenshotData("");
                    setIsReadingScreenshot(false);
                  };

                  reader.readAsDataURL(file);
                }}
              />

              {isReadingScreenshot ? (
                <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>
                  Reading screenshot...
                </div>
              ) : null}

              {screenshotData ? (
                <div
                  style={{
                    marginTop: 10,
                    borderRadius: 14,
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <img
                    src={screenshotData}
                    alt="Screenshot preview"
                    style={{
                      width: "100%",
                      display: "block",
                      maxHeight: 220,
                      objectFit: "cover",
                    }}
                  />
                </div>
              ) : null}
            </Field>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              <button
                style={ui.primaryButton}
                onClick={saveDecision}
                type="button"
                disabled={isReadingScreenshot}
              >
                {isReadingScreenshot ? "Reading Screenshot..." : "Log Trade / Apply Result"}
              </button>

              <a
                href={blofinUrl}
                target="_blank"
                rel="noreferrer"
                style={{ ...ui.button, textDecoration: "none" }}
              >
                Open on BloFin
              </a>
            </div>
          </div>
        </section>

        <section style={{ ...ui.card, ...ui.sectionSpacing }}>
          <div style={ui.toolbar}>
            <div>
              <div style={ui.blockTitle}>Recent Trade Logs</div>
              <h2 style={ui.title}>Compressed Review Stack</h2>
              <div style={ui.subtext}>
                Collapsed by default so this section does not take over the page.
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={ui.pill}>{loggedDecisions.length} total</span>
              <button
                style={showAllLogs ? ui.primaryButton : ui.button}
                onClick={() => setShowAllLogs((prev) => !prev)}
                type="button"
              >
                {showAllLogs ? "Show Fewer" : "Show More"}
              </button>
            </div>
          </div>

          {loggedDecisions.length === 0 ? (
            <div style={{ ...ui.card, background: "#141414", padding: 20 }}>
              No logs yet. Select a radar event or switch to manual mode.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {visibleLoggedDecisions.map((item) => {
                const expanded = !!expandedLogs[item.id];

                return (
                  <div
                    key={item.id}
                    style={{
                      ...ui.collapsedLogCard,
                      padding: expanded ? 14 : 10,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <strong style={{ fontSize: 18 }}>{item.pair}</strong>
                        <span style={levelPillStyle(item.signalLevel || "L1")}>
                          {item.signalLevel || "L1"}
                        </span>
                        <span style={ui.amberPill}>{item.attemptTag || "First Sweep"}</span>
                        <span style={ui.pill}>{item.leverage || 1}x</span>
                        <span style={ui.pill}>{item.tradeGrade || "—"}</span>
                        <span style={{ ...ui.pill, ...aiGradeStyle(item.aiGrade) }}>
                          {item.aiGrade || "—"}
                        </span>
                        <span style={item.sourceType === "Manual Log" ? ui.greenPill : ui.redPill}>
                          {item.sourceType === "Manual Log" ? "Manual Log" : "Event Response"}
                        </span>
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ color: "rgba(255,255,255,0.56)", fontSize: 12 }}>
                          {displayLogTimestamp(item.timestampUtc)}
                        </span>
                        <button
                          style={ui.button}
                          type="button"
                          onClick={() => toggleLogCard(item.id)}
                        >
                          {expanded ? "Collapse" : "Expand"}
                        </button>
                      </div>
                    </div>

                    <div style={{ ...ui.tableGrid, marginTop: 12 }}>
                      <MiniBox label="Action" value={item.action} />
                      <MiniBox label="Timing" value={item.timing} />
                      <MiniBox label="Plan" value={item.planFollowed} />
                      <MiniBox label="Mistake" value={item.ruleBreak} />
                      <MiniBox label="PnL" value={fmt(item.pnl, 2)} />
                      <MiniBox label="Risk" value={fmt(item.riskAmount, 2)} />
                    </div>

                    {expanded ? (
                      <>
                        {item.entry || item.stop || item.tp1 || item.tp2 ? (
                          <div style={{ ...ui.tableGrid, marginTop: 10 }}>
                            <MiniBox label="Entry" value={fmt(item.entry)} />
                            <MiniBox label="Stop" value={fmt(item.stop)} />
                            <MiniBox label="TP1" value={fmt(item.tp1)} />
                            <MiniBox label="TP2" value={fmt(item.tp2)} />
                            <MiniBox label="Discipline" value={item.disciplineScore} />
                            <MiniBox label="Quality" value={item.setupQuality} />
                          </div>
                        ) : null}

                        {(item.aiClassification || item.aiSummary || item.aiCoachingNote) ? (
                          <div
                            style={{
                              marginTop: 12,
                              border: "1px solid rgba(255,255,255,0.08)",
                              background: "#151515",
                              borderRadius: 16,
                              padding: 12,
                            }}
                          >
                            <div style={{ fontWeight: 800, marginBottom: 8 }}>
                              AI Breakdown
                            </div>

                            <div style={{ display: "grid", gap: 6 }}>
                              {item.aiClassification && (
                                <div><strong>Type:</strong> {item.aiClassification}</div>
                              )}

                              {item.aiSummary && (
                                <div><strong>Summary:</strong> {item.aiSummary}</div>
                              )}

                              {item.aiCoachingNote && (
                                <div><strong>Fix:</strong> {item.aiCoachingNote}</div>
                              )}

                              {item.ruleBreak !== "None" && (
                                <div style={{ color: "#ff9c9c" }}>
                                  ⚠ Mistake: {item.ruleBreak}
                                </div>
                              )}

                              {Number(item.disciplineScore || 0) < 7 && (
                                <div style={{ color: "#ffd38b" }}>
                                  ⚠ Discipline below optimal
                                </div>
                              )}
                            </div>
                          </div>
                        ) : null}

                        {item.notes ? (
                          <div
                            style={{
                              marginTop: 10,
                              color: "rgba(255,255,255,0.72)",
                              lineHeight: 1.45,
                            }}
                          >
                            {item.notes}
                          </div>
                        ) : null}

                        {item.screenshot ? (
                          <div
                            style={{
                              marginTop: 12,
                              borderRadius: 16,
                              overflow: "hidden",
                              border: "1px solid rgba(255,255,255,0.08)",
                            }}
                          >
                            <img
                              src={item.screenshot}
                              alt={`${item.pair} screenshot`}
                              style={{ width: "100%", display: "block" }}
                            />
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}