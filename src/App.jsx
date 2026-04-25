import { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import BillingPage from "./BillingPage";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

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
  confidenceSelf: 7,
  executionType: "Confirmation",
  liquidityLevel: "Range High",
  htfBias: "Aligned",
  entryTrigger: "Reclaim",
  outcome: "Partial TP",
  durationMinutes: "",
  entry: "",
  stop: "",
  exit: "",
  tp1: "",
  tp2: "",
  pnl: "",
  notes: "",
  screenshot: "",
  screenshotBase64: "",
  screenshotMimeType: "",
  sourceType: "Event Response",
  structure: "",
  linkedEventId: "",
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
const EXECUTION_TYPE_OPTIONS = ["Confirmation", "Anticipation", "Chase"];
const LIQUIDITY_LEVEL_OPTIONS = [
  "Range High",
  "Range Low",
  "Daily High",
  "Daily Low",
  "Internal",
  "Unknown",
];
const HTF_BIAS_OPTIONS = ["Aligned", "Counter", "Neutral"];
const ENTRY_TRIGGER_OPTIONS = [
  "Reclaim",
  "Breakdown Candle",
  "Wick Rejection",
  "EMA Reject",
  "Other",
];
const OUTCOME_OPTIONS = ["Full TP", "Partial TP", "Stopped", "Manual Close", "BE"];


function getLevelWeight(level) {
  if (level === "L3") return 3;
  if (level === "L2") return 2;
  return 1;
}

function getDirectionPalette(directionBias) {
  return directionBias === "Long"
    ? {
        border: "1px solid rgba(80,255,160,0.24)",
        background: "linear-gradient(180deg, rgba(24,88,52,0.26), rgba(14,14,14,0.95))",
        color: "#b8ffd1",
      }
    : {
        border: "1px solid rgba(255,26,26,0.28)",
        background: "linear-gradient(180deg, rgba(110,22,22,0.24), rgba(14,14,14,0.95))",
        color: "#ffb0b0",
      };
}


function getFeedHealth(lastSuccessfulFeedTs) {
  if (!lastSuccessfulFeedTs) return { label: "Waiting", tone: "neutral" };
  const ageMs = Date.now() - lastSuccessfulFeedTs;
  if (ageMs <= 6000) return { label: "Hot", tone: "good" };
  if (ageMs <= 15000) return { label: "Slow", tone: "warn" };
  return { label: "Stale", tone: "bad" };
}

function avg(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + Number(b || 0), 0) / values.length;
}

function avgNumber(items, selector) {
  const values = items.map(selector).map((v) => Number(v)).filter((v) => Number.isFinite(v));
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
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

function parseAppTime(ts) {
  if (ts === null || ts === undefined || ts === "") return null;

  try {
    if (ts instanceof Date) {
      return Number.isNaN(ts.getTime()) ? null : ts;
    }

    if (typeof ts === "number") {
      const d = new Date(ts);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const value = String(ts).trim();
    if (!value) return null;

    if (/^\d{13}$/.test(value)) {
      const d = new Date(Number(value));
      return Number.isNaN(d.getTime()) ? null : d;
    }

    if (/^\d{10}$/.test(value)) {
      const d = new Date(Number(value) * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const hasExplicitTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
    const looksIsoWithoutTimezone = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value);

    const normalized = looksIsoWithoutTimezone
      ? `${value.replace(" ", "T")}Z`
      : value.replace(" ", "T");

    const d = new Date(hasExplicitTimezone ? value : normalized);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function displayTime(ts) {
  if (!ts) return "—";
  try {
    const d = parseAppTime(ts);
    if (!d) return "—";
    return d.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/New_York",
    });
  } catch {
    return "—";
  }
}

function displayLogTimestamp(ts) {
  if (!ts) return "—";
  try {
    const d = parseAppTime(ts);
    if (!d) return "—";
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/New_York",
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
  const compact = (pair || "BTC/USDT").replace("/", "").replace(":USDT", "");
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
  const maxDrawdownUsed = Math.max(0, propAccount.startingBalance - propAccount.currentBalance);
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
    return { qualified: true, status: "PASS", notes: [], riskAmount: 0, rrToTp1: 0, rrToTp2: 0 };
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
  if (propAccount.lossesToday >= propAccount.maxLossesPerDay) notes.push("Max losses for the day reached");
  if (metrics.dailyLossUsed >= metrics.dailyLossLimit) notes.push("Daily drawdown limit reached");
  if (metrics.maxDrawdownUsed >= metrics.maxDrawdownLimit) notes.push("Max overall drawdown reached");
  if (propAccount.dailyProfitLock && propAccount.dailyRealizedPnl >= propAccount.dailyProfitLock) notes.push("Daily profit lock reached");
  let status = "PASS";
  if (notes.some((note) => note.includes("Risk exceeds") || note.includes("drawdown"))) status = "DO NOT TAKE";
  else if (notes.length) status = "BORDERLINE";
  return { qualified: notes.length === 0, status, notes, riskAmount, rrToTp1, rrToTp2 };
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

function eventKey(event) {
  return event?.id || `${event?.pair}_${event?.timestampUtc}_${event?.eventType}_${event?.sweepType}`;
}

function getSignalLevel(event) {
  if (event?.signalLevel) return event.signalLevel;
  const confidence = Number(event?.botConfidence || 0);
  const confirmed = !!event?.reclaimConfirmed;
  const hasSweep = !!event?.sweepType;
  const hasBias = !!event?.directionBias;
  const strongEvent = event?.eventType === "SWEEP_CONFIRMED" || event?.eventType === "DOUBLE_SWEEP" || event?.eventType === "SWEEP_RECLAIM";
  let score = 0;
  if (hasSweep) score += 1;
  if (hasBias) score += 1;
  if (confirmed) score += 1;
  if (strongEvent) score += 1;
  if (confidence >= 0.7) score += 1;
  if (confidence >= 0.85) score += 1;
  if (event?.attemptTag === "Second Attempt" || event?.attemptTag === "Confirmed Re-entry") score += 1;
  if (score >= 6) return "L3";
  if (score >= 4) return "L2";
  return "L1";
}

function getTradeGrade(item) {
  if (!item) return "—";
  if (item.action === "Taken" && item.timing === "On Confirmation" && item.planFollowed === "Yes" && item.ruleBreak === "None") return "DISCIPLINED";
  if (item.timing === "Early" || item.timing === "Chase Entry" || item.planFollowed === "No" || item.ruleBreak !== "None") return "RULE BREAK";
  return "MIXED";
}

function prettyEventType(eventType) {
  const map = {
    SWEEP_DETECTED: "Sweep Detected",
    SWEEP_RECLAIM: "Sweep Reclaim",
    SWEEP_ACCEPTED: "Sweep Accepted",
    SWEEP_CONFIRMED: "Sweep Confirmed",
    DOUBLE_SWEEP: "Double Sweep",
  };
  return map[eventType] || eventType || "Event";
}

async function apiFetch(path, options = {}, token = "") {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.details || `HTTP ${res.status}`);
  return data;
}

function groupRadarEventsIntoWaves(events, windowMs = 120000) {
  const sorted = [...events].sort((a, b) => (parseAppTime(b.timestampUtc)?.getTime() || 0) - (parseAppTime(a.timestampUtc)?.getTime() || 0));
  const groups = [];
  for (const event of sorted) {
    const ts = parseAppTime(event.timestampUtc)?.getTime() || 0;
    const key = `${event.pair || "?"}__${event.directionBias || "?"}__${event.sweepType || "?"}`;
    const existing = groups.find((group) => group.key === key && Math.abs(group.latestTs - ts) <= windowMs);
    if (existing) {
      existing.events.push(event);
      existing.count += 1;
      existing.latestTs = Math.max(existing.latestTs, ts);
      existing.maxConfidence = Math.max(existing.maxConfidence, Number(event.botConfidence || 0));
      if (Number(event.botConfidence || 0) >= Number(existing.primary?.botConfidence || 0)) existing.primary = event;
    } else {
      groups.push({ key, count: 1, latestTs: ts, maxConfidence: Number(event.botConfidence || 0), primary: event, events: [event] });
    }
  }
  groups.sort((a, b) => {
    const levelDiff = getLevelWeight(b.primary?.signalLevel || getSignalLevel(b.primary)) - getLevelWeight(a.primary?.signalLevel || getSignalLevel(a.primary));
    if (levelDiff) return levelDiff;
    const confidenceDiff = (b.maxConfidence || 0) - (a.maxConfidence || 0);
    if (confidenceDiff) return confidenceDiff;
    return b.latestTs - a.latestTs;
  });
  return groups;
}

const ui = {
  shell: {
    minHeight: "100vh",
    background: "radial-gradient(circle at top, rgba(255,0,0,0.08), transparent 18%), #050505",
    color: "#F2F2F2",
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  container: { maxWidth: 1540, margin: "0 auto", padding: "0 16px 28px" },
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
  tickerWrap: {
    width: "100%",
    overflow: "hidden",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    background: "linear-gradient(180deg, rgba(12,12,12,0.96), rgba(8,8,8,0.96))",
  },
  tickerInner: {
    maxWidth: 1540,
    margin: "0 auto",
    padding: "0 16px",
  },
  tickerViewport: {
    position: "relative",
    width: "100%",
    overflow: "hidden",
    whiteSpace: "nowrap",
  },
  tickerTrack: {
    display: "inline-flex",
    gap: 10,
    padding: "10px 0",
    minWidth: "max-content",
    animation: "llTickerScroll 34s linear infinite",
  },
  tickerItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.02em",
    textTransform: "uppercase",
    boxShadow: "0 10px 24px rgba(0,0,0,0.22)",
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
  radarIcon: { width: 22, height: 22, borderRadius: "50%", border: "2px solid rgba(255,26,26,0.9)", position: "relative" },
  topCardRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 14, marginBottom: 14 },
  card: { background: "linear-gradient(180deg, rgba(20,20,20,0.98), rgba(12,12,12,0.98))", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 22, padding: 16, boxShadow: "0 14px 34px rgba(0,0,0,0.28)" },
  chartCard: { background: "linear-gradient(180deg, rgba(18,18,18,0.98), rgba(10,10,10,0.98))", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 26, padding: 16, boxShadow: "0 18px 42px rgba(0,0,0,0.34)", marginBottom: 14 },
  radarCardShell: { background: "linear-gradient(180deg, rgba(13,13,13,0.98), rgba(9,9,9,0.98))", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 22, padding: 16, boxShadow: "0 14px 34px rgba(0,0,0,0.28)" },
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 },
  pillRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  pill: { border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "#F2F2F2", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 700 },
  redPill: { border: "1px solid rgba(255,26,26,0.28)", background: "rgba(255,26,26,0.12)", color: "#ffb0b0", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 700 },
  greenPill: { border: "1px solid rgba(80,255,160,0.24)", background: "rgba(40,120,70,0.14)", color: "#b8ffd1", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 700 },
  amberPill: { border: "1px solid rgba(255,190,70,0.26)", background: "rgba(140,90,20,0.18)", color: "#ffd38b", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 800 },
  l1Pill: { border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.06)", color: "#f3f3f3", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 800 },
  l2Pill: { border: "1px solid rgba(255,190,70,0.3)", background: "rgba(140,90,20,0.18)", color: "#ffd38b", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 800 },
  l3Pill: { border: "1px solid rgba(255,26,26,0.35)", background: "rgba(255,26,26,0.16)", color: "#ffb0b0", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 900, boxShadow: "0 0 14px rgba(255,26,26,0.12)" },
  chartFrame: { height: 620, borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#0D0D0D" },
  split: { display: "grid", gridTemplateColumns: "minmax(380px, 1fr) minmax(420px, 0.95fr)", gap: 14 },
  blockTitle: { fontSize: 12, letterSpacing: "0.26em", color: "rgba(255,255,255,0.42)", textTransform: "uppercase", marginBottom: 6 },
  title: { fontSize: 20, fontWeight: 900, margin: 0 },
  subtext: { fontSize: 13, color: "rgba(255,255,255,0.56)", marginTop: 4 },
  button: { border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#F2F2F2", padding: "10px 14px", borderRadius: 14, fontWeight: 700, cursor: "pointer" },
  primaryButton: { border: "1px solid rgba(255,26,26,0.28)", background: "linear-gradient(180deg,#ff2929,#d81919)", color: "#fff", padding: "10px 14px", borderRadius: 14, fontWeight: 800, cursor: "pointer", boxShadow: "0 0 22px rgba(255,26,26,0.16)" },
  input: { width: "100%", boxSizing: "border-box", background: "#181818", color: "#F2F2F2", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "12px 14px", outline: "none" },
  grid2: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 },
  grid3: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 },
  grid4: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10 },
  radarItemBase: { width: "100%", textAlign: "left", borderRadius: 18, padding: 10, color: "#F2F2F2", cursor: "pointer", transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease" },
  selectedRing: { boxShadow: "0 0 0 1px rgba(255,255,255,0.14), 0 0 24px rgba(255,26,26,0.10)" },
  tableGrid: { display: "grid", gridTemplateColumns: "1.2fr .7fr .7fr .8fr .8fr .9fr", gap: 10, alignItems: "center" },
  statValue: { fontSize: 28, fontWeight: 900, marginTop: 8 },
  sectionSpacing: { marginTop: 14 },
  collapsedLogCard: { border: "1px solid rgba(255,255,255,0.08)", background: "#141414", borderRadius: 18, padding: 14 },
};

function levelPillStyle(level) {
  if (level === "L3") return ui.l3Pill;
  if (level === "L2") return ui.l2Pill;
  return ui.l1Pill;
}

function radarCardStyle(level) {
  if (level === "L3") {
    return { ...ui.radarItemBase, background: "linear-gradient(180deg, rgba(85,10,10,0.35), rgba(18,18,18,0.98))", border: "1px solid rgba(255,26,26,0.32)", boxShadow: "0 0 16px rgba(255,26,26,0.10)" };
  }
  if (level === "L2") {
    return { ...ui.radarItemBase, background: "linear-gradient(180deg, rgba(82,58,12,0.22), rgba(18,18,18,0.98))", border: "1px solid rgba(255,190,70,0.22)" };
  }
  return { ...ui.radarItemBase, background: "linear-gradient(180deg, rgba(22,22,22,0.98), rgba(14,14,14,0.98))", border: "1px solid rgba(255,255,255,0.08)" };
}

function filterButtonStyle(active) {
  return active ? ui.primaryButton : ui.button;
}

function StatCard({ title, value, subtitle, level = null }) {
  let extra = {};
  if (level === "L3") extra = { border: "1px solid rgba(255,26,26,0.25)", boxShadow: "0 0 24px rgba(255,26,26,0.14), 0 14px 34px rgba(0,0,0,0.28)", background: "linear-gradient(180deg, rgba(55,12,12,0.96), rgba(12,12,12,0.98))" };
  else if (level === "L2") extra = { border: "1px solid rgba(255,190,70,0.22)", background: "linear-gradient(180deg, rgba(50,35,8,0.9), rgba(12,12,12,0.98))" };
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
      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function MiniBox({ label, value }) {
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.08)", background: "#191919", borderRadius: 14, padding: 10, minWidth: 0 }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.42)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
      <strong style={{ wordBreak: "break-word", overflowWrap: "anywhere", display: "block", marginTop: 6 }}>{value}</strong>
    </div>
  );
}

function buildTickerItems(events, limit = 12) {
  const now = Date.now();

  const fresh = events.filter((event) => {
    const ts = parseAppTime(event.timestampUtc)?.getTime() || 0;
    const ageMs = now - ts;
    return ageMs >= 0 && ageMs <= 8 * 60 * 1000;
  });

  const scored = fresh.map((event) => {
    const level = event.signalLevel || getSignalLevel(event);
    const ts = parseAppTime(event.timestampUtc)?.getTime() || 0;
    const confidence = Number(event.botConfidence || 0);
    const ageMs = Math.max(0, now - ts);

    const levelWeight = level === "L3" ? 3000 : level === "L2" ? 2000 : 1000;
    const confidenceWeight = Math.round(confidence * 100) * 10;
    const freshnessWeight = Math.max(0, 480000 - ageMs) / 1000;

    return {
      ...event,
      signalLevel: level,
      _tickerTs: ts,
      _tickerScore: levelWeight + confidenceWeight + freshnessWeight,
    };
  });

  scored.sort((a, b) => {
    if (b._tickerScore !== a._tickerScore) return b._tickerScore - a._tickerScore;
    return b._tickerTs - a._tickerTs;
  });

  const bestByPair = new Map();

  for (const item of scored) {
    const pairKey = item.pair || item.id;
    const existing = bestByPair.get(pairKey);

    if (!existing) {
      bestByPair.set(pairKey, { ...item, _waveCount: 1 });
      continue;
    }

    const stronger = item._tickerScore > existing._tickerScore ? item : existing;
    bestByPair.set(pairKey, {
      ...stronger,
      _waveCount: (existing._waveCount || 1) + 1,
    });
  }

  return Array.from(bestByPair.values())
    .sort((a, b) => {
      if ((b._waveCount || 1) !== (a._waveCount || 1)) return (b._waveCount || 1) - (a._waveCount || 1);
      if (b._tickerScore !== a._tickerScore) return b._tickerScore - a._tickerScore;
      return b._tickerTs - a._tickerTs;
    })
    .slice(0, limit)
    .map((item) => ({
      ...item,
      _pulse: (item._waveCount || 1) >= 2 || item.signalLevel === "L3",
    }));
}

function inferLiquidityLevelFromSweep(sweepType = "") {
  const value = String(sweepType || "").toLowerCase();
  if (value.includes("high")) return "Range High";
  if (value.includes("low")) return "Range Low";
  if (value.includes("daily")) return value.includes("high") ? "Daily High" : "Daily Low";
  return "Unknown";
}

function inferEntryTriggerFromEvent(eventType = "", emaContext = "") {
  const evt = String(eventType || "").toUpperCase();
  const ema = String(emaContext || "").toLowerCase();

  if (evt === "SWEEP_RECLAIM") return "Reclaim";
  if (evt === "SWEEP_CONFIRMED") return "Breakdown Candle";
  if (ema.includes("reject")) return "EMA Reject";
  return "Wick Rejection";
}

function inferExecutionTypeFromEvent(eventType = "") {
  const evt = String(eventType || "").toUpperCase();
  if (evt === "SWEEP_CONFIRMED") return "Confirmation";
  if (evt === "SWEEP_RECLAIM") return "Confirmation";
  return "Anticipation";
}

export default function App() {
  const fileInputRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [logMode, setLogMode] = useState("event");
  const [activeTab, setActiveTab] = useState("trading");
  const [showPropPanel, setShowPropPanel] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [decisionForm, setDecisionForm] = useState({ ...emptyForm });
  const [expandedLogs, setExpandedLogs] = useState({});
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [waveWindowMs, setWaveWindowMs] = useState(120000);
  const [expandedWaves, setExpandedWaves] = useState({});
  const [lastSuccessfulFeedTs, setLastSuccessfulFeedTs] = useState(0);

  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  const [loggedDecisions, setLoggedDecisions] = useState(() => safeReadStorage(STORAGE_KEYS.loggedDecisions, []));
  const [pairFilter, setPairFilter] = useState("All");
  const [sweepFilter, setSweepFilter] = useState("All");
  const [levelFilter, setLevelFilter] = useState("All");
  const [feedStatus, setFeedStatus] = useState("Connecting...");
  const [hideLoggedRadar, setHideLoggedRadar] = useState(true);
  const [visibleCount, setVisibleCount] = useState(() => {
    const stored = safeReadStorage(STORAGE_KEYS.radarVisibleCount, 8);
    return stored > 0 ? stored : 8;
  });
  const [propAccount, setPropAccount] = useState(() => safeReadStorage(STORAGE_KEYS.propAccount, {
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
  }));

  useEffect(() => { localStorage.setItem(STORAGE_KEYS.loggedDecisions, JSON.stringify(loggedDecisions)); }, [loggedDecisions]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.propAccount, JSON.stringify(propAccount)); }, [propAccount]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.radarVisibleCount, JSON.stringify(visibleCount)); }, [visibleCount]);

  useEffect(() => {
    if (!token) {
      setCurrentUser(null);
      return;
    }
    apiFetch("/logs", {}, token)
      .then((data) => {
        const logs = Array.isArray(data.logs) ? data.logs : [];
        const mapped = logs.map((item) => ({
          ...item,
          tradeGrade: item.tradeGrade || getTradeGrade(item),
          screenshot: item.screenshotUrl || item.screenshot || "",
        }));
        setLoggedDecisions(mapped);
        setCurrentUser({ email: "Logged In" });
      })
      .catch((err) => console.error("Initial logs fetch failed:", err));
  }, [token]);

  useEffect(() => {
    let mounted = true;
    async function loadEvents() {
      try {
        const data = await apiFetch("/events");
        if (!mounted) return;
        const list = Array.isArray(data.events) ? data.events : [];
        setLastSuccessfulFeedTs(Date.now());
        setFeedStatus(`Live Feed (${list.length})`);
        const enriched = list.map((event) => ({ ...event, signalLevel: getSignalLevel(event) }));
        setEvents((prev) => {
          const merged = [...enriched, ...prev];
          const seen = new Set();
          const unique = merged
            .map((item) => ({ ...item, _ts: parseAppTime(item.timestampUtc)?.getTime() || 0 }))
            .filter((item) => {
              const key = eventKey(item);
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          unique.sort((a, b) => (b._ts || 0) - (a._ts || 0));
          return unique.slice(0, 300);
        });
        setSelectedEvent((prev) => {
          if (prev) {
            const existing = enriched.find((e) => eventKey(e) === eventKey(prev));
            return existing || prev;
          }
          return enriched[0] || null;
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

  const loggedEventIds = useMemo(() => new Set(loggedDecisions.map((item) => item.linkedEventId).filter(Boolean)), [loggedDecisions]);
  const pairOptions = useMemo(() => ["All", ...new Set(events.map((e) => e.pair).filter(Boolean))], [events]);
  const sweepOptions = useMemo(() => ["All", ...new Set(events.map((e) => e.sweepType).filter(Boolean))], [events]);

  const filteredEvents = useMemo(() => {
    const results = events.filter((e) => {
      const pairOk = pairFilter === "All" || e.pair === pairFilter;
      const sweepOk = sweepFilter === "All" || e.sweepType === sweepFilter;
      const loggedOk = !hideLoggedRadar || !loggedEventIds.has(e.id);
      const levelOk = levelFilter === "All" || e.signalLevel === levelFilter;
      return pairOk && sweepOk && loggedOk && levelOk;
    });
    results.sort((a, b) => (parseAppTime(b.timestampUtc)?.getTime() || 0) - (parseAppTime(a.timestampUtc)?.getTime() || 0));
    return results;
  }, [events, pairFilter, sweepFilter, levelFilter, hideLoggedRadar, loggedEventIds]);

  const groupedWaves = useMemo(() => groupRadarEventsIntoWaves(filteredEvents, waveWindowMs), [filteredEvents, waveWindowMs]);
  const visibleWaves = useMemo(() => groupedWaves.slice(0, visibleCount), [groupedWaves, visibleCount]);
  const visibleLoggedDecisions = useMemo(() => (showAllLogs ? loggedDecisions : loggedDecisions.slice(0, 8)), [loggedDecisions, showAllLogs]);
  const tickerItems = useMemo(() => buildTickerItems(events), [events]);
  const feedHealth = useMemo(() => getFeedHealth(lastSuccessfulFeedTs), [lastSuccessfulFeedTs, events.length]);
  const newestEventAgeSeconds = useMemo(() => {
    if (!events.length) return null;
    const newestTs = parseAppTime(events[0]?.timestampUtc)?.getTime?.() || 0;
    if (!newestTs) return null;
    return Math.max(0, Math.round((Date.now() - newestTs) / 1000));
  }, [events, lastSuccessfulFeedTs]);

  const stats = useMemo(() => {
    const levelCounts = events.reduce((acc, event) => {
      const level = event.signalLevel || "L1";
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, { L1: 0, L2: 0, L3: 0 });
    const takenTrades = loggedDecisions.filter((d) => d.action === "Taken").length;
    const avgLeverage = avg(loggedDecisions.map((d) => d.leverage || 1));
    const biggestMistake = Object.entries(loggedDecisions.reduce((acc, item) => {
      const tags = Array.isArray(item.mistakeTags) ? item.mistakeTags : [];
      if (tags.length) tags.forEach((tag) => { acc[tag] = (acc[tag] || 0) + 1; });
      else if (item.ruleBreak && item.ruleBreak !== "None") acc[item.ruleBreak] = (acc[item.ruleBreak] || 0) + 1;
      return acc;
    }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] || "None";
    return { l1Count: levelCounts.L1 || 0, l2Count: levelCounts.L2 || 0, l3Count: levelCounts.L3 || 0, takenTrades, biggestMistake, avgLeverage };
  }, [events, loggedDecisions]);

  const advancedStats = useMemo(() => {
    const taken = loggedDecisions.filter((item) => item.action === "Taken");
    const outcomeCounts = {};
    const executionCounts = {};
    const liquidityCounts = {};
    const triggerCounts = {};
    const htfCounts = {};
    for (const item of loggedDecisions) {
      if (item.outcome) outcomeCounts[item.outcome] = (outcomeCounts[item.outcome] || 0) + 1;
      if (item.executionType) executionCounts[item.executionType] = (executionCounts[item.executionType] || 0) + 1;
      if (item.liquidityLevel) liquidityCounts[item.liquidityLevel] = (liquidityCounts[item.liquidityLevel] || 0) + 1;
      if (item.entryTrigger) triggerCounts[item.entryTrigger] = (triggerCounts[item.entryTrigger] || 0) + 1;
      if (item.htfBias) htfCounts[item.htfBias] = (htfCounts[item.htfBias] || 0) + 1;
    }
    const topOutcome = Object.entries(outcomeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
    const topExecution = Object.entries(executionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
    const topLiquidity = Object.entries(liquidityCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
    const topTrigger = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
    const topHtf = Object.entries(htfCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
    return {
      avgConfidenceSelf: avgNumber(loggedDecisions, (item) => item.confidenceSelf),
      avgDurationMinutes: avgNumber(taken, (item) => item.durationMinutes),
      topOutcome,
      topExecution,
      topLiquidity,
      topTrigger,
      topHtf,
    };
  }, [loggedDecisions]);

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
  const selectedCompliance = useMemo(() => evaluatePropCompliance(effectiveComplianceTarget, propAccount), [effectiveComplianceTarget, propAccount]);

  const chartPair = logMode === "manual" ? decisionForm.pair || "BTC/USDT" : selectedEvent?.pair || "BTC/USDT";
  const activeTimeframe = logMode === "manual" ? decisionForm.timeframe || "3m" : selectedEvent?.timeframe || decisionForm.timeframe || "3m";
  const chartSymbol = getTradingViewSymbol(chartPair);
  const chartInterval = getTradingViewInterval(activeTimeframe);
  const blofinUrl = getBlofinUrl(chartPair);

  function updateDecision(field, value) {
    setDecisionForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateProp(field, value) {
    setPropAccount((prev) => ({ ...prev, [field]: typeof prev[field] === "number" ? Number(value) || 0 : value }));
  }

  async function registerUser() {
    if (!authEmail.trim() || !authPassword.trim()) return alert("Enter email and password.");
    try {
      const data = await apiFetch("/register", {
        method: "POST",
        body: JSON.stringify({ email: authEmail.trim(), password: authPassword }),
      });
      setToken(data.token);
      localStorage.setItem("token", data.token);
      setCurrentUser(data.user || { email: authEmail.trim() });
      alert("Registered and logged in.");
    } catch (err) {
      console.error(err);
      alert(err.message || "Register failed");
    }
  }

  async function loginUser() {
    if (!authEmail.trim() || !authPassword.trim()) return alert("Enter email and password.");
    try {
      const data = await apiFetch("/login", {
        method: "POST",
        body: JSON.stringify({ email: authEmail.trim(), password: authPassword }),
      });
      setToken(data.token);
      localStorage.setItem("token", data.token);
      setCurrentUser(data.user || { email: authEmail.trim() });
      alert("Logged in.");
    } catch (err) {
      console.error(err);
      alert(err.message || "Login failed");
    }
  }

  function logoutUser() {
    setToken("");
    setCurrentUser(null);
    localStorage.removeItem("token");
  }

  function loadEvent(event) {
    setSelectedEvent(event);
    setLogMode("event");

    const inferredLiquidity = inferLiquidityLevelFromSweep(event.sweepType);
    const inferredTrigger = inferEntryTriggerFromEvent(event.eventType, event.emaContext);
    const inferredExecution = inferExecutionTypeFromEvent(event.eventType);

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
      executionType: inferredExecution,
      liquidityLevel: inferredLiquidity,
      htfBias: "Aligned",
      entryTrigger: inferredTrigger,
      outcome: "Partial TP",
      entry: event.entry ?? "",
      stop: event.stop ?? "",
      tp1: event.tp1 ?? "",
      tp2: event.tp2 ?? "",
      structure: event.structure || "",
      linkedEventId: event.id || "",
      sourceType: "Event Response",
      notes: event.structure
        ? `Loaded from radar: ${prettyEventType(event.eventType)} | ${event.structure}`
        : `Loaded from radar: ${prettyEventType(event.eventType)}`,
    });
  }

  function switchToManualLog() {
    setLogMode("manual");
    setDecisionForm({ ...emptyForm, pair: chartPair, timeframe: activeTimeframe });
  }

  function resetPropDay() {
    setPropAccount((prev) => ({ ...prev, dailyRealizedPnl: 0, lossesToday: 0, tradesToday: 0 }));
  }

  function resetPropAccount() {
    setPropAccount((prev) => ({ ...prev, currentBalance: prev.startingBalance, dailyRealizedPnl: 0, totalRealizedPnl: 0, lossesToday: 0, tradesToday: 0 }));
  }

  function toggleLogCard(id) {
    setExpandedLogs((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleWave(key) {
    setExpandedWaves((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleScreenshotUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const commaIndex = result.indexOf(",");
      const base64 = commaIndex >= 0 ? result.slice(commaIndex + 1) : "";
      setDecisionForm((prev) => ({ ...prev, screenshot: result, screenshotBase64: base64, screenshotMimeType: file.type || "image/png" }));
    };
    reader.readAsDataURL(file);
  }

  function clearScreenshot() {
    setDecisionForm((prev) => ({ ...prev, screenshot: "", screenshotBase64: "", screenshotMimeType: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }


  function applyQuickEventAction(actionType) {
    if (logMode !== "event" || !selectedEvent) return;

    setDecisionForm((prev) => ({
      ...prev,
      action: actionType,
      timing:
        actionType === "Taken"
          ? "On Confirmation"
          : actionType === "Missed"
            ? "Late"
            : prev.timing || "On Confirmation",
      planFollowed:
        actionType === "Taken"
          ? (prev.planFollowed || "Yes")
          : prev.planFollowed,
      outcome:
        actionType === "Taken"
          ? (prev.outcome || "Partial TP")
          : actionType === "Skipped"
            ? "Manual Close"
            : prev.outcome,
      notes:
        prev.notes && prev.notes.trim()
          ? prev.notes
          : `Quick marked from radar as ${actionType}.`,
    }));
  }

  async function saveDecision() {
    if (!token) return alert("Please log in first.");
    const pair = (decisionForm.pair || "").trim();
    if (!pair) return alert("Please enter a pair.");
    const leverage = Math.max(1, num(decisionForm.leverage) || 1);
    const baseLevel = logMode === "event" && selectedEvent ? getSignalLevel({ ...selectedEvent, attemptTag: decisionForm.attemptTag || selectedEvent.attemptTag }) : getSignalLevel({ ...decisionForm, botConfidence: 0.75, reclaimConfirmed: decisionForm.action === "Taken" });

    const effectiveEvent = logMode === "event" && selectedEvent ? {
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
    } : {
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
    const linkedRadarEvent = logMode === "event" && selectedEvent ? { ...selectedEvent } : null;
    const payload = {
      pair,
      timeframe: decisionForm.timeframe,
      session: decisionForm.session,
      directionBias: decisionForm.directionBias,
      eventType: decisionForm.eventType,
      sweepType: decisionForm.sweepType,
      emaContext: decisionForm.emaContext,
      leverage,
      action: decisionForm.action,
      planFollowed: decisionForm.planFollowed,
      ruleBreak: decisionForm.ruleBreak,
      disciplineScore: Number(decisionForm.disciplineScore),
      setupQuality: Number(decisionForm.setupQuality),
      emotionalPressure: Number(decisionForm.emotionalPressure),
      confidenceSelf: Number(decisionForm.confidenceSelf),
      executionType: decisionForm.executionType,
      liquidityLevel: decisionForm.liquidityLevel,
      htfBias: decisionForm.htfBias,
      entryTrigger: decisionForm.entryTrigger,
      outcome: decisionForm.outcome,
      durationMinutes: num(decisionForm.durationMinutes),
      entry: num(decisionForm.entry),
      stop: num(decisionForm.stop),
      tp1: num(decisionForm.tp1),
      tp2: num(decisionForm.tp2),
      pnl: num(decisionForm.pnl),
      notes: decisionForm.notes,
      screenshotUrl: decisionForm.screenshot,
      screenshotBase64: decisionForm.screenshotBase64,
      screenshotMimeType: decisionForm.screenshotMimeType,
      linkedEventId: logMode === "event" ? selectedEvent?.id || null : null,
      linkedRadarEvent,
      reclaimConfirmed: Boolean(selectedEvent?.reclaimConfirmed),
    };

    try {
      const data = await apiFetch("/logs", { method: "POST", body: JSON.stringify(payload) }, token);
      const serverLog = data.log || {};
      const aiAnalysis = data.aiAnalysis || {};
      const nowIso = new Date().toISOString();
      const entry = {
        id: serverLog.id || `log_${Date.now()}`,
        linkedEventId: logMode === "event" ? selectedEvent?.id || null : null,
        timestampUtc: serverLog.createdAt ? new Date(serverLog.createdAt).toISOString() : nowIso,
        displayTime: displayLogTimestamp(serverLog.createdAt ? new Date(serverLog.createdAt).toISOString() : nowIso),
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
        confidenceSelf: Number(decisionForm.confidenceSelf),
        executionType: decisionForm.executionType,
        liquidityLevel: decisionForm.liquidityLevel,
        htfBias: decisionForm.htfBias,
        entryTrigger: decisionForm.entryTrigger,
        outcome: decisionForm.outcome,
        durationMinutes: num(decisionForm.durationMinutes),
        entry: num(decisionForm.entry),
        stop: num(decisionForm.stop),
        exit: num(decisionForm.exit),
        tp1: num(decisionForm.tp1),
        tp2: num(decisionForm.tp2),
        pnl: num(decisionForm.pnl),
        notes: decisionForm.notes,
        screenshot: decisionForm.screenshot,
        structure: decisionForm.structure,
        sourceType: logMode === "event" ? "Event Response" : "Manual Log",
        riskAmount: compliance.riskAmount,
        propQualified: compliance.qualified,
        propStatus: compliance.status,
        complianceNotes: compliance.notes,
        signalLevel: baseLevel,
        tradeGrade: getTradeGrade(decisionForm),
        aiStatus: data.aiStatus || serverLog.aiStatus,
        aiScore: serverLog.aiScore ?? aiAnalysis.overallScore,
        aiGrade: serverLog.aiGrade ?? aiAnalysis.overallGrade,
        aiSummary: serverLog.aiSummary ?? aiAnalysis.summary,
        aiCoachingNote: serverLog.aiCoachingNote ?? aiAnalysis.coachingTip,
        setupScore: serverLog.setupScore ?? aiAnalysis.setupScore,
        executionScore: serverLog.executionScore ?? aiAnalysis.executionScore,
        managementScore: serverLog.managementScore ?? aiAnalysis.managementScore,
        chartRead: serverLog.chartRead ?? aiAnalysis.chartRead,
        setupAssessment: serverLog.setupAssessment ?? aiAnalysis.setupAssessment,
        executionAssessment: serverLog.executionAssessment ?? aiAnalysis.executionAssessment,
        riskAssessment: serverLog.riskAssessment ?? aiAnalysis.riskAssessment,
        biasAlignment: serverLog.biasAlignment ?? aiAnalysis.biasAlignment,
        mistakeTags: serverLog.mistakeTags ?? aiAnalysis.mistakeTags ?? [],
        whatWasGood: serverLog.whatWasGood ?? aiAnalysis.whatWasGood ?? [],
        whatNeedsWork: serverLog.whatNeedsWork ?? aiAnalysis.whatNeedsWork ?? [],
        usedScreenshot: serverLog.usedScreenshot ?? aiAnalysis.usedScreenshot ?? Boolean(decisionForm.screenshot),
      };
      setLoggedDecisions((prev) => [entry, ...prev].slice(0, 100));
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
      setDecisionForm((prev) => ({ ...emptyForm, pair: logMode === "event" ? prev.pair : "", timeframe: prev.timeframe || "3m" }));
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error("DB save failed:", err);
      alert(err.message || "Save failed");
    }
  }

  const selectedSignalLevel = logMode === "event" && selectedEvent ? getSignalLevel({ ...selectedEvent, attemptTag: decisionForm.attemptTag || selectedEvent.attemptTag }) : getSignalLevel({ ...decisionForm, botConfidence: 0.75, reclaimConfirmed: decisionForm.action === "Taken" });
  const selectedConfidence = logMode === "event" ? Number(selectedEvent?.botConfidence || 0) : 0.75;

  return (
    <div style={ui.shell}>
      <header style={ui.header}>
        <div style={ui.headerInner}>
          <div style={ui.brandWrap}>
            <div style={ui.radarIconBox}>
              <div style={ui.radarIcon}>
                <div style={{ position: "absolute", inset: 4, border: "1px solid rgba(255,26,26,0.5)", borderRadius: "50%" }} />
                <div style={{ position: "absolute", left: "50%", top: "50%", width: 12, height: 1, background: "#FF1A1A", transform: "translate(-50%,-50%)" }} />
                <div style={{ position: "absolute", left: "50%", top: "50%", width: 1, height: 12, background: "#FF1A1A", transform: "translate(-50%,-50%)" }} />
              </div>
            </div>
            <div>
              <div style={ui.blockTitle}>Red October Systems</div>
              <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "0.05em", textTransform: "uppercase" }}>Liquidity Lab</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>{feedStatus}</span>
            <span style={feedHealth.tone === "good" ? ui.greenPill : feedHealth.tone === "warn" ? ui.amberPill : feedHealth.tone === "bad" ? ui.redPill : ui.pill}>
              Feed {feedHealth.label}
            </span>
            <span style={ui.pill}>
              Freshest {newestEventAgeSeconds === null ? "—" : `${newestEventAgeSeconds}s`}
            </span>
            <button style={activeTab === "trading" && logMode === "event" ? ui.primaryButton : ui.button} onClick={() => { setActiveTab("trading"); selectedEvent && loadEvent(selectedEvent); }} type="button">Event Mode</button>
            <button style={activeTab === "trading" && logMode === "manual" ? ui.primaryButton : ui.button} onClick={() => { setActiveTab("trading"); switchToManualLog(); }} type="button">Manual Mode</button>
            <button style={activeTab === "billing" ? ui.primaryButton : ui.button} onClick={() => setActiveTab("billing")} type="button">Billing</button>
            {token ? (
              <>
                <span style={ui.pill}>{currentUser?.email || "Logged In"}</span>
                <button style={ui.button} onClick={logoutUser} type="button">Logout</button>
              </>
            ) : (
              <>
                <input style={{ ...ui.input, width: 180, padding: "10px 12px" }} type="email" placeholder="Email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
                <input style={{ ...ui.input, width: 160, padding: "10px 12px" }} type="password" placeholder="Password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} />
                <button style={ui.button} onClick={registerUser} type="button">Register</button>
                <button style={ui.primaryButton} onClick={loginUser} type="button">Login</button>
              </>
            )}
          </div>
        </div>
        <div style={ui.tickerWrap}>
          <div style={ui.tickerInner}>
            <div className="ll-ticker-viewport" style={ui.tickerViewport}>
              {tickerItems.length ? (
                <div className="ll-ticker-track" style={ui.tickerTrack}>
                  {[...tickerItems, ...tickerItems].map((item, idx) => {
                    const palette = getDirectionPalette(item.directionBias);
                    return (
                      <button
                        key={`${eventKey(item)}_${idx}`}
                        type="button"
                        onClick={() => loadEvent(item)}
                        style={{
                          ...ui.tickerItem,
                          ...palette,
                          cursor: "pointer",
                          position: "relative",
                          boxShadow: item._pulse
                            ? "0 0 0 1px rgba(255,255,255,0.08), 0 0 18px rgba(255,255,255,0.08), 0 0 28px rgba(255,26,26,0.14)"
                            : ui.tickerItem.boxShadow,
                          animation: item._pulse ? "llTickerPulse 1.8s ease-in-out infinite" : "none",
                        }}
                        title={`${item.pair} • ${item.sweepType || prettyEventType(item.eventType)} • ${item.directionBias} • ${item.emaContext || "Liquidity Sweep"} • ${displayTime(item.timestampUtc)}`}
                      >
                        <span>{item.pair}</span>
                        <span style={levelPillStyle(item.signalLevel || "L1")}>{item.signalLevel || "L1"}</span>
                        <span>{item.directionBias}</span>
                        <span>{item.sweepType || prettyEventType(item.eventType)}</span>
                        {item._waveCount > 1 ? <span>x{item._waveCount} wave</span> : null}
                        <span>{Math.round(Number(item.botConfidence || 0) * 100)}%</span>
                        <span>{displayTime(item.timestampUtc)}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: "10px 0", color: "rgba(255,255,255,0.58)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Waiting for live sweeps...
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <style>{`
        @keyframes llTickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes llTickerPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.03); }
          100% { transform: scale(1); }
        }
        .ll-ticker-viewport:hover .ll-ticker-track {
          animation-play-state: paused;
        }
      `}</style>



      <div style={ui.container}>
        {activeTab === "billing" ? (
          <BillingPage token={token} />
        ) : (
          <>

        <div style={ui.topCardRow}>
          <StatCard title="L3 Active" value={stats.l3Count} subtitle="Elite setups" level="L3" />
          <StatCard title="L2 Active" value={stats.l2Count} subtitle="Strong setups" level="L2" />
          <StatCard title="L1 Active" value={stats.l1Count} subtitle="Watchlist setups" level="L1" />
          <StatCard title="Trades Taken" value={stats.takenTrades} subtitle="Logged decisions" />
          <StatCard title="Avg Leverage" value={stats.avgLeverage ? `${stats.avgLeverage.toFixed(1)}x` : "1.0x"} subtitle="Logged average" />
          <StatCard title="Top Mistake" value={stats.biggestMistake} subtitle="Most common issue" />
        </div>

        <section style={{ ...ui.card, marginBottom: 14, padding: showInsights ? 16 : 14 }}>
          <div style={ui.toolbar}>
            <div>
              <div style={ui.blockTitle}>Advanced Logging Snapshot</div>
              <h2 style={ui.title}>What your data says</h2>
              <div style={ui.subtext}>Compressed by default so radar, chart, and journal stay primary.</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={ui.pill}>Execution {advancedStats.topExecution}</span>
              <span style={ui.pill}>Trigger {advancedStats.topTrigger}</span>
              <span style={ui.pill}>Outcome {advancedStats.topOutcome}</span>
              <button style={showInsights ? ui.primaryButton : ui.button} onClick={() => setShowInsights((prev) => !prev)} type="button">
                {showInsights ? "Collapse Insights" : "Expand Insights"}
              </button>
            </div>
          </div>

          {showInsights ? (
            <>
              <div style={ui.topCardRow}>
                <StatCard title="Top Execution" value={advancedStats.topExecution} subtitle="Most used style" />
                <StatCard title="Top Liquidity" value={advancedStats.topLiquidity} subtitle="Most used location" />
                <StatCard title="Top Trigger" value={advancedStats.topTrigger} subtitle="Most used entry trigger" />
                <StatCard title="Top Outcome" value={advancedStats.topOutcome} subtitle="Most common result" />
                <StatCard title="Top HTF Bias" value={advancedStats.topHtf} subtitle="Most common alignment" />
                <StatCard title="Avg Self-Confidence" value={advancedStats.avgConfidenceSelf ? advancedStats.avgConfidenceSelf.toFixed(1) : "—"} subtitle="1 to 10 scale" />
              </div>
              <div style={{ ...ui.topCardRow, marginTop: 0, marginBottom: 0 }}>
                <StatCard title="Avg Duration" value={advancedStats.avgDurationMinutes ? `${advancedStats.avgDurationMinutes.toFixed(1)}m` : "—"} subtitle="Taken trades only" />
              </div>
            </>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
              <MiniBox label="Top Execution" value={advancedStats.topExecution} />
              <MiniBox label="Top Liquidity" value={advancedStats.topLiquidity} />
              <MiniBox label="Top Trigger" value={advancedStats.topTrigger} />
              <MiniBox label="Top Outcome" value={advancedStats.topOutcome} />
              <MiniBox label="Top HTF Bias" value={advancedStats.topHtf} />
              <MiniBox label="Avg Confidence" value={advancedStats.avgConfidenceSelf ? advancedStats.avgConfidenceSelf.toFixed(1) : "—"} />
            </div>
          )}
        </section>
        <section style={{ ...ui.card, marginBottom: 14 }}>
          <div style={ui.toolbar}>
            <div>
              <div style={ui.blockTitle}>Prop Panel</div>
              <h2 style={ui.title}>Compact Account Status</h2>
              <div style={ui.subtext}>Open only when needed so the chart and journal stay primary.</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={ui.pill}>{propAccount.mode === "prop" ? "Prop Mode" : "Personal Mode"}</span>
              <span style={ui.pill}>Acct {propAccount.accountSize.toLocaleString()}</span>
              <span style={ui.pill}>DD Left {propMetrics.remainingDailyLoss.toFixed(0)}</span>
              <span style={ui.pill}>Losses {propAccount.lossesToday}/{propAccount.maxLossesPerDay}</span>
              <button style={showPropPanel ? ui.primaryButton : ui.button} onClick={() => setShowPropPanel((prev) => !prev)} type="button">
                {showPropPanel ? "Hide Prop Panel" : "Open Prop Panel"}
              </button>
            </div>
          </div>
          {showPropPanel ? (
            <>
              <div style={ui.grid3}>
                <Field label="Mode">
                  <select style={ui.input} value={propAccount.mode} onChange={(e) => updateProp("mode", e.target.value)}>
                    <option value="personal">Personal</option>
                    <option value="prop">Prop</option>
                  </select>
                </Field>
                <Field label="Account Size">
                  <input style={ui.input} type="number" value={propAccount.accountSize} onChange={(e) => updateProp("accountSize", e.target.value)} />
                </Field>
                <Field label="Max Risk / Trade">
                  <input style={ui.input} type="number" value={propAccount.maxRiskPerTrade} onChange={(e) => updateProp("maxRiskPerTrade", e.target.value)} />
                </Field>
              </div>
              <div style={{ ...ui.topCardRow, marginTop: 12, marginBottom: 0 }}>
                <StatCard title="Daily DD Used" value={propMetrics.dailyLossUsed.toFixed(0)} subtitle={`/ ${propMetrics.dailyLossLimit.toFixed(0)}`} />
                <StatCard title="Remaining Daily" value={propMetrics.remainingDailyLoss.toFixed(0)} subtitle="Loss room left" />
                <StatCard title="Losses Today" value={propAccount.lossesToday} subtitle={`/ ${propAccount.maxLossesPerDay}`} />
                <StatCard title="Profit Target" value={propMetrics.profitTarget.toFixed(0)} subtitle="Target dollars" />
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                <button style={ui.button} onClick={resetPropDay} type="button">Reset Day</button>
                <button style={ui.button} onClick={resetPropAccount} type="button">Reset Account</button>
              </div>
            </>
          ) : null}
        </section>

        <section style={ui.chartCard}>
          <div style={ui.toolbar}>
            <div>
              <div style={ui.blockTitle}>Live Pattern Chart</div>
              <h2 style={ui.title}>{chartPair} • {activeTimeframe}</h2>
              <div style={ui.subtext}>Chart first, decisions second, logs below.</div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={ui.pill}>{logMode === "event" ? `${selectedEvent?.sweepType || "Sweep"} → ${selectedEvent?.eventType || "Event"}` : `${decisionForm.sweepType} → ${decisionForm.eventType}`}</span>
                <span style={levelPillStyle(selectedSignalLevel)}>{selectedSignalLevel}</span>
                <span style={ui.amberPill}>{decisionForm.attemptTag || selectedEvent?.attemptTag || "First Sweep"}</span>
                <span style={decisionForm.directionBias === "Long" || selectedEvent?.directionBias === "Long" ? ui.greenPill : ui.redPill}>
                  {logMode === "event" ? selectedEvent?.directionBias || "Bias" : decisionForm.directionBias}
                </span>
                <span style={ui.pill}>Confidence {pct(selectedConfidence)}</span>
              </div>
            </div>
            <div style={ui.pillRow}>
              <span style={ui.redPill}>SYSTEM: SCANNING</span>
              <span style={ui.pill}>Liquidity Area Active</span>
              <a href={blofinUrl} target="_blank" rel="noreferrer" style={{ ...ui.button, textDecoration: "none" }}>Open BloFin</a>
            </div>
          </div>
          <div style={ui.chartFrame}>
            <iframe
              key={`${chartSymbol}_${chartInterval}`}
              title={`Chart for ${chartPair}`}
              src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=${encodeURIComponent(chartSymbol)}&interval=${encodeURIComponent(chartInterval)}&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=0f172a&studies=[]&theme=dark&style=1&timezone=America%2FNew_York&withdateranges=1&hideideas=1`}
              width="100%"
              height="100%"
              frameBorder="0"
              allowTransparency="true"
              scrolling="no"
            />
          </div>
        </section>

        <section style={ui.split}>
          <div style={ui.radarCardShell}>
            <div style={ui.toolbar}>
              <div>
                <div style={ui.blockTitle}>Live Radar</div>
                <h2 style={ui.title}>L-System Priority Feed</h2>
                <div style={ui.subtext}>{visibleWaves.length} / {groupedWaves.length} wave groups · {filteredEvents.length} raw events</div>
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={feedHealth.tone === "good" ? ui.greenPill : feedHealth.tone === "warn" ? ui.amberPill : feedHealth.tone === "bad" ? ui.redPill : ui.pill}>
                    Feed {feedHealth.label}
                  </span>
                  <span style={ui.pill}>Newest {newestEventAgeSeconds === null ? "—" : `${newestEventAgeSeconds}s ago`}</span>
                  <span style={ui.pill}>Ticker {tickerItems.length}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {LEVEL_FILTERS.map((level) => (
                  <button key={level} style={filterButtonStyle(levelFilter === level)} onClick={() => setLevelFilter(level)} type="button">{level}</button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
              <select style={ui.input} value={pairFilter} onChange={(e) => setPairFilter(e.target.value)}>
                {pairOptions.map((pair) => <option key={pair} value={pair}>{pair}</option>)}
              </select>
              <select style={ui.input} value={sweepFilter} onChange={(e) => setSweepFilter(e.target.value)}>
                {sweepOptions.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={filterButtonStyle(waveWindowMs === 60000)} onClick={() => setWaveWindowMs(60000)} type="button">60s Waves</button>
                <button style={filterButtonStyle(waveWindowMs === 120000)} onClick={() => setWaveWindowMs(120000)} type="button">120s Waves</button>
                <button style={filterButtonStyle(waveWindowMs === 180000)} onClick={() => setWaveWindowMs(180000)} type="button">180s Waves</button>
              </div>
              <button style={hideLoggedRadar ? ui.primaryButton : ui.button} onClick={() => setHideLoggedRadar((prev) => !prev)} type="button">
                {hideLoggedRadar ? "Hiding Logged" : "Showing Logged"}
              </button>
            </div>

            {visibleWaves.length === 0 ? (
              <div style={{ ...ui.card, background: "#141414", padding: 20 }}>No live events coming in yet. Feed status: {feedStatus}. If the bot is only sending test sweeps, the frontend will stay live but cannot create real alerts on its own.</div>
            ) : (
              <div style={{ display: "grid", gap: 10, maxHeight: "60vh", overflowY: "auto", paddingRight: 4 }}>
                {visibleWaves.map((wave) => {
                  const event = wave.primary;
                  const level = event.signalLevel || getSignalLevel(event);
                  const isSelected = selectedEvent?.id === event.id && logMode === "event";
                  const isExpanded = !!expandedWaves[wave.key];
                  const baseStyle = radarCardStyle(level);
                  const finalStyle = isSelected ? { ...baseStyle, ...ui.selectedRing, padding: 10 } : { ...baseStyle, padding: 10 };
                  return (
                    <div key={wave.key} style={finalStyle}>
                      <button style={{ background: "transparent", border: 0, color: "inherit", width: "100%", textAlign: "left", padding: 0, cursor: "pointer" }} onClick={() => { loadEvent(event); if (wave.count > 1) toggleWave(wave.key); }} type="button">
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start", flexWrap: "wrap" }}>
                          <div style={{ display: "grid", gap: 5, flex: 1 }}>
                            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                              <strong style={{ fontSize: 16 }}>{event.pair}</strong>
                              <span style={levelPillStyle(level)}>{level}</span>
                              <span style={event.directionBias === "Long" ? ui.greenPill : ui.redPill}>{event.directionBias}</span>
                              <span style={ui.pill}>{event.timeframe}</span>
                              {wave.count > 1 ? <span style={ui.amberPill}>x{wave.count} wave</span> : null}
                            </div>
                            <div style={{ fontWeight: 800, fontSize: 15, color: level === "L3" ? "#ffb0b0" : level === "L2" ? "#ffd38b" : "#f3f3f3" }}>{event.sweepType}</div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <span style={ui.pill}>{prettyEventType(event.eventType)}</span>
                              <span style={ui.pill}>{event.emaContext || "Liquidity Sweep"}</span>
                              <span style={ui.pill}>{Math.round((wave.maxConfidence || 0) * 100)}%</span>
                            </div>
                          </div>
                          <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                            <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>{displayTime(event.timestampUtc)}</div>
                            {wave.count > 1 ? <button style={ui.button} type="button" onClick={(e) => { e.stopPropagation(); toggleWave(wave.key); }}>{isExpanded ? "Hide wave" : "Show wave"}</button> : null}
                          </div>
                        </div>
                      </button>
                      {isExpanded && wave.events.length > 1 ? (
                        <div style={{ display: "grid", gap: 6, marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                          {wave.events.map((evt) => (
                            <button key={evt.id || `${evt.pair}_${evt.timestampUtc}`} type="button" onClick={() => loadEvent(evt)} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 8, color: "inherit", textAlign: "left", cursor: "pointer" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                                  <span style={ui.pill}>{prettyEventType(evt.eventType)}</span>
                                  <span style={ui.pill}>{evt.sweepType}</span>
                                  <span style={ui.pill}>{evt.emaContext || "—"}</span>
                                </div>
                                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{displayTime(evt.timestampUtc)}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            {groupedWaves.length > visibleCount ? (
              <div style={{ marginTop: 12 }}>
                <button style={ui.button} type="button" onClick={() => setVisibleCount((prev) => prev + 8)}>Show More</button>
              </div>
            ) : null}
          </div>

          <div style={ui.card}>
            <div style={ui.toolbar}>
              <div>
                <div style={ui.blockTitle}>{logMode === "event" ? "Trade Journal" : "Manual Journal"}</div>
                <h2 style={ui.title}>{logMode === "event" ? "Respond to Selected Event" : "Log Without Radar Card"}</h2>
                <div style={ui.subtext}>{logMode === "event" ? selectedEvent?.pair || "No event selected" : decisionForm.pair || "Manual entry"}</div>
              </div>
              <div style={ui.pillRow}>
                <span style={levelPillStyle(selectedSignalLevel)}>{selectedSignalLevel}</span>
                <span style={ui.amberPill}>{decisionForm.attemptTag}</span>
                <span style={ui.pill}>{decisionForm.leverage || 1}x</span>
              </div>
            </div>

            <div style={{ border: `1px solid ${selectedCompliance.status === "PASS" ? "rgba(110,255,170,0.25)" : selectedCompliance.status === "BORDERLINE" ? "rgba(255,190,70,0.25)" : "rgba(255,80,80,0.25)"}`, background: selectedCompliance.status === "PASS" ? "rgba(20,80,40,0.18)" : selectedCompliance.status === "BORDERLINE" ? "rgba(90,60,10,0.18)" : "rgba(80,20,20,0.18)", borderRadius: 18, padding: 14, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <strong>{selectedCompliance.status === "PASS" ? "PASS – TAKE THIS" : selectedCompliance.status === "BORDERLINE" ? "BORDERLINE" : "DO NOT TAKE"}</strong>
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
                <select style={ui.input} value={decisionForm.attemptTag} onChange={(e) => updateDecision("attemptTag", e.target.value)}>
                  {ATTEMPT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Leverage">
                <input style={ui.input} type="number" min="1" step="0.1" value={decisionForm.leverage} onChange={(e) => updateDecision("leverage", e.target.value)} />
              </Field>
            </div>

            <div style={ui.grid4}>
              <Field label="Execution Type">
                <select style={ui.input} value={decisionForm.executionType} onChange={(e) => updateDecision("executionType", e.target.value)}>
                  {EXECUTION_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Liquidity Level">
                <select style={ui.input} value={decisionForm.liquidityLevel} onChange={(e) => updateDecision("liquidityLevel", e.target.value)}>
                  {LIQUIDITY_LEVEL_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="HTF Bias">
                <select style={ui.input} value={decisionForm.htfBias} onChange={(e) => updateDecision("htfBias", e.target.value)}>
                  {HTF_BIAS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Entry Trigger">
                <select style={ui.input} value={decisionForm.entryTrigger} onChange={(e) => updateDecision("entryTrigger", e.target.value)}>
                  {ENTRY_TRIGGER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
            </div>

            <div style={ui.grid3}>
              <Field label="Outcome">
                <select style={ui.input} value={decisionForm.outcome} onChange={(e) => updateDecision("outcome", e.target.value)}>
                  {OUTCOME_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Self Confidence">
                <input style={ui.input} type="number" min="1" max="10" value={decisionForm.confidenceSelf} onChange={(e) => updateDecision("confidenceSelf", e.target.value)} />
              </Field>
              <Field label="Duration Minutes">
                <input style={ui.input} type="number" min="0" step="1" value={decisionForm.durationMinutes} onChange={(e) => updateDecision("durationMinutes", e.target.value)} />
              </Field>
            </div>

            {logMode === "manual" ? (
              <>
                <div style={{ ...ui.grid2, marginTop: 10 }}>
                  <Field label="Pair">
                    <input style={ui.input} type="text" placeholder="SUI/USDT" value={decisionForm.pair} onChange={(e) => updateDecision("pair", e.target.value)} />
                  </Field>
                  <Field label="Timeframe">
                    <select style={ui.input} value={decisionForm.timeframe || "3m"} onChange={(e) => updateDecision("timeframe", e.target.value)}>
                      {TIMEFRAME_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </Field>
                </div>
                <div style={{ ...ui.grid2, marginTop: 10 }}>
                  <Field label="Direction Bias">
                    <select style={ui.input} value={decisionForm.directionBias || "Short"} onChange={(e) => updateDecision("directionBias", e.target.value)}>
                      {DIRECTION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </Field>
                  <Field label="Session">
                    <select style={ui.input} value={decisionForm.session || "New York"} onChange={(e) => updateDecision("session", e.target.value)}>
                      {SESSION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </Field>
                </div>
                <div style={{ ...ui.grid2, marginTop: 10 }}>
                  <Field label="Event Type">
                    <select style={ui.input} value={decisionForm.eventType || "SWEEP_DETECTED"} onChange={(e) => updateDecision("eventType", e.target.value)}>
                      {EVENT_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </Field>
                  <Field label="Sweep Type">
                    <select style={ui.input} value={decisionForm.sweepType || "High Sweep"} onChange={(e) => updateDecision("sweepType", e.target.value)}>
                      {SWEEP_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </Field>
                </div>
                <div style={{ ...ui.grid2, marginTop: 10 }}>
                  <Field label="EMA Context">
                    <select style={ui.input} value={decisionForm.emaContext || "EMA99 Rejection"} onChange={(e) => updateDecision("emaContext", e.target.value)}>
                      {EMA_CONTEXT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </Field>
                  <Field label="Structure">
                    <input style={ui.input} type="text" placeholder="Range high liquidity clear" value={decisionForm.structure || ""} onChange={(e) => updateDecision("structure", e.target.value)} />
                  </Field>
                </div>
              </>
            ) : null}

            <div style={{ ...ui.grid2, marginTop: 10 }}>
              <Field label="Action Taken">
                <select style={ui.input} value={decisionForm.action || "Taken"} onChange={(e) => updateDecision("action", e.target.value)}>
                  {ACTION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Entry Timing">
                <select style={ui.input} value={decisionForm.timing || "On Confirmation"} onChange={(e) => updateDecision("timing", e.target.value)}>
                  {TIMING_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
            </div>

            <div style={{ ...ui.grid2, marginTop: 10 }}>
              <Field label="Plan Adherence">
                <select style={ui.input} value={decisionForm.planFollowed || "Yes"} onChange={(e) => updateDecision("planFollowed", e.target.value)}>
                  {PLAN_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Execution Mistake">
                <select style={ui.input} value={decisionForm.ruleBreak || "None"} onChange={(e) => updateDecision("ruleBreak", e.target.value)}>
                  {RULE_BREAK_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
            </div>

            <div style={{ ...ui.grid3, marginTop: 10 }}>
              <Field label="Discipline Score">
                <input style={ui.input} type="number" min="1" max="10" value={decisionForm.disciplineScore} onChange={(e) => updateDecision("disciplineScore", e.target.value)} />
              </Field>
              <Field label="Setup Quality">
                <input style={ui.input} type="number" min="1" max="10" value={decisionForm.setupQuality} onChange={(e) => updateDecision("setupQuality", e.target.value)} />
              </Field>
              <Field label="Emotional Pressure">
                <input style={ui.input} type="number" min="1" max="10" value={decisionForm.emotionalPressure} onChange={(e) => updateDecision("emotionalPressure", e.target.value)} />
              </Field>
            </div>

            <div style={{ ...ui.grid2, marginTop: 10 }}>
              <Field label="Entry">
                <input style={ui.input} type="number" step="any" value={decisionForm.entry} onChange={(e) => updateDecision("entry", e.target.value)} />
              </Field>
              <Field label="Stop">
                <input style={ui.input} type="number" step="any" value={decisionForm.stop} onChange={(e) => updateDecision("stop", e.target.value)} />
              </Field>
            </div>

            <div style={{ ...ui.grid3, marginTop: 10 }}>
              <Field label="TP1">
                <input style={ui.input} type="number" step="any" value={decisionForm.tp1} onChange={(e) => updateDecision("tp1", e.target.value)} />
              </Field>
              <Field label="TP2">
                <input style={ui.input} type="number" step="any" value={decisionForm.tp2} onChange={(e) => updateDecision("tp2", e.target.value)} />
              </Field>
              <Field label="Exit">
                <input style={ui.input} type="number" step="any" value={decisionForm.exit} onChange={(e) => updateDecision("exit", e.target.value)} />
              </Field>
            </div>

            <div style={{ ...ui.grid2, marginTop: 10 }}>
              <Field label="PnL">
                <input style={ui.input} type="number" step="any" value={decisionForm.pnl} onChange={(e) => updateDecision("pnl", e.target.value)} />
              </Field>
              <Field label="Decision Notes">
                <textarea style={{ ...ui.input, minHeight: 100, resize: "vertical" }} rows="4" value={decisionForm.notes} onChange={(e) => updateDecision("notes", e.target.value)} />
              </Field>
            </div>

            <div style={{ marginTop: 10 }}>
              <Field label="Screenshot">
                <input ref={fileInputRef} style={ui.input} type="file" accept="image/*" onChange={handleScreenshotUpload} />
              </Field>
              {decisionForm.screenshot ? (
                <div style={{ marginTop: 12 }}>
                  <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <img src={decisionForm.screenshot} alt="Screenshot preview" style={{ width: "100%", display: "block", maxHeight: 220, objectFit: "cover" }} />
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <button style={ui.button} type="button" onClick={clearScreenshot}>Clear Screenshot</button>
                  </div>
                </div>
              ) : null}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              <button style={ui.primaryButton} onClick={saveDecision} type="button">Log Trade / Apply Result</button>
              <a href={blofinUrl} target="_blank" rel="noreferrer" style={{ ...ui.button, textDecoration: "none" }}>Open on BloFin</a>
            </div>
          </div>
        </section>

        <section style={{ ...ui.card, ...ui.sectionSpacing }}>
          <div style={ui.toolbar}>
            <div>
              <div style={ui.blockTitle}>Recent Trade Logs</div>
              <h2 style={ui.title}>Compressed Review Stack</h2>
              <div style={ui.subtext}>Collapsed by default so this section does not take over the page.</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={ui.pill}>{loggedDecisions.length} total</span>
              <button style={showAllLogs ? ui.primaryButton : ui.button} onClick={() => setShowAllLogs((prev) => !prev)} type="button">{showAllLogs ? "Show Fewer" : "Show More"}</button>
            </div>
          </div>

          {loggedDecisions.length === 0 ? (
            <div style={{ ...ui.card, background: "#141414", padding: 20 }}>No logs yet. Select a radar event or switch to manual mode.</div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {visibleLoggedDecisions.map((item) => {
                const expanded = !!expandedLogs[item.id];
                const tags = Array.isArray(item.mistakeTags) ? item.mistakeTags : [];
                const good = Array.isArray(item.whatWasGood) ? item.whatWasGood : [];
                const work = Array.isArray(item.whatNeedsWork) ? item.whatNeedsWork : [];
                return (
                  <div key={item.id} style={ui.collapsedLogCard}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <strong style={{ fontSize: 18 }}>{item.pair}</strong>
                        <span style={levelPillStyle(item.signalLevel || "L1")}>{item.signalLevel || "L1"}</span>
                        <span style={ui.amberPill}>{item.attemptTag || "First Sweep"}</span>
                        <span style={ui.pill}>{item.leverage || 1}x</span>
                        <span style={ui.pill}>{item.tradeGrade || "—"}</span>
                        {item.aiGrade ? <span style={ui.redPill}>AI {item.aiGrade}</span> : null}
                        {item.aiScore !== undefined && item.aiScore !== null ? <span style={ui.pill}>Score {item.aiScore}</span> : null}
                        <span style={item.sourceType === "Manual Log" ? ui.greenPill : ui.redPill}>{item.sourceType === "Manual Log" ? "Manual Log" : "Event Response"}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ color: "rgba(255,255,255,0.56)", fontSize: 12 }}>{displayLogTimestamp(item.timestampUtc)}</span>
                        <button style={ui.button} type="button" onClick={() => toggleLogCard(item.id)}>{expanded ? "Collapse" : "Expand"}</button>
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
                        <div style={{ ...ui.grid4, marginTop: 10 }}>
                          <MiniBox label="Exec Type" value={item.executionType || "—"} />
                          <MiniBox label="Liquidity" value={item.liquidityLevel || "—"} />
                          <MiniBox label="HTF Bias" value={item.htfBias || "—"} />
                          <MiniBox label="Trigger" value={item.entryTrigger || "—"} />
                        </div>
                        <div style={{ ...ui.grid3, marginTop: 10 }}>
                          <MiniBox label="Outcome" value={item.outcome || "—"} />
                          <MiniBox label="Self Confidence" value={item.confidenceSelf ?? "—"} />
                          <MiniBox label="Duration" value={item.durationMinutes ? `${item.durationMinutes}m` : "—"} />
                        </div>
                        {(item.entry || item.stop || item.tp1 || item.tp2) ? (
                          <div style={{ ...ui.tableGrid, marginTop: 10 }}>
                            <MiniBox label="Entry" value={fmt(item.entry)} />
                            <MiniBox label="Stop" value={fmt(item.stop)} />
                            <MiniBox label="TP1" value={fmt(item.tp1)} />
                            <MiniBox label="TP2" value={fmt(item.tp2)} />
                            <MiniBox label="Discipline" value={item.disciplineScore} />
                            <MiniBox label="Quality" value={item.setupQuality} />
                          </div>
                        ) : null}
                        {(item.setupScore || item.executionScore || item.managementScore || item.disciplineScore) ? (
                          <div style={{ ...ui.tableGrid, marginTop: 10 }}>
                            <MiniBox label="Setup AI" value={item.setupScore ?? "—"} />
                            <MiniBox label="Execution AI" value={item.executionScore ?? "—"} />
                            <MiniBox label="Management AI" value={item.managementScore ?? "—"} />
                            <MiniBox label="Discipline AI" value={item.disciplineScore ?? "—"} />
                            <MiniBox label="Bias" value={item.biasAlignment || "—"} />
                            <MiniBox label="AI Status" value={item.aiStatus || "—"} />
                          </div>
                        ) : null}
                        {item.aiSummary ? <div style={{ marginTop: 10, color: "rgba(255,255,255,0.88)", lineHeight: 1.45 }}><strong style={{ display: "block", marginBottom: 6 }}>AI Summary</strong>{item.aiSummary}</div> : null}
                        {item.chartRead ? <div style={{ marginTop: 10, color: "rgba(255,255,255,0.72)", lineHeight: 1.45 }}><strong style={{ display: "block", marginBottom: 6 }}>Chart Read</strong>{item.chartRead}</div> : null}
                        {item.setupAssessment ? <div style={{ marginTop: 10, color: "rgba(255,255,255,0.72)", lineHeight: 1.45 }}><strong style={{ display: "block", marginBottom: 6 }}>Setup Assessment</strong>{item.setupAssessment}</div> : null}
                        {item.executionAssessment ? <div style={{ marginTop: 10, color: "rgba(255,255,255,0.72)", lineHeight: 1.45 }}><strong style={{ display: "block", marginBottom: 6 }}>Execution Assessment</strong>{item.executionAssessment}</div> : null}
                        {item.riskAssessment ? <div style={{ marginTop: 10, color: "rgba(255,255,255,0.72)", lineHeight: 1.45 }}><strong style={{ display: "block", marginBottom: 6 }}>Risk Assessment</strong>{item.riskAssessment}</div> : null}
                        {tags.length ? <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>{tags.map((tag, idx) => <span key={`${tag}-${idx}`} style={ui.amberPill}>{tag}</span>)}</div> : null}
                        {good.length ? <div style={{ marginTop: 10, color: "rgba(255,255,255,0.72)", lineHeight: 1.45 }}><strong style={{ display: "block", marginBottom: 6 }}>What Was Good</strong>{good.map((line, idx) => <div key={idx}>• {line}</div>)}</div> : null}
                        {work.length ? <div style={{ marginTop: 10, color: "rgba(255,255,255,0.72)", lineHeight: 1.45 }}><strong style={{ display: "block", marginBottom: 6 }}>What Needs Work</strong>{work.map((line, idx) => <div key={idx}>• {line}</div>)}</div> : null}
                        {item.aiCoachingNote ? <div style={{ marginTop: 10, color: "rgba(255,255,255,0.72)", lineHeight: 1.45 }}><strong style={{ display: "block", marginBottom: 6 }}>Coaching Note</strong>{item.aiCoachingNote}</div> : null}
                        {item.notes ? <div style={{ marginTop: 10, color: "rgba(255,255,255,0.72)", lineHeight: 1.45 }}>{item.notes}</div> : null}
                        {item.screenshot ? <div style={{ marginTop: 12, borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}><img src={item.screenshot} alt={`${item.pair} screenshot`} style={{ width: "100%", display: "block" }} /></div> : null}
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
          </>
        )}
      </div>
    </div>
  );
}

