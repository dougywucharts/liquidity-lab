import { useEffect, useMemo, useState } from "react";
import "./styles.css";

const emptyForm = {
  pair: "",
  timeframe: "3m",
  session: "New York",
  directionBias: "Short",
  eventType: "SWEEP_DETECTED",
  sweepType: "High Sweep",
  emaContext: "EMA99 Rejection",
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

const TIMEFRAME_OPTIONS = ["1m", "3m", "5m", "15m", "1h"];
const DIRECTION_OPTIONS = ["Long", "Short"];
const SESSION_OPTIONS = ["Asia", "London", "New York"];
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
];
const EMA_CONTEXT_OPTIONS = [
  "EMA9 Reclaim",
  "EMA25 Reclaim",
  "EMA25 Rejection",
  "EMA99 Rejection",
  "EMA99 Hold",
];

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

function displayTime(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
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

function calcRiskAmount(entry, stop, riskUnit = 1) {
  const e = num(entry);
  const s = num(stop);
  if (!e || !s) return 0;
  return Math.abs(e - s) * riskUnit;
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
      notes: [],
      riskAmount: 0,
      rrToTp1: 0,
      rrToTp2: 0,
    };
  }

  const notes = [];
  const metrics = getPropMetrics(propAccount);

  const riskAmount = calcRiskAmount(event.entry, event.stop, 1);
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

  return {
    qualified: notes.length === 0,
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

function eventKey(event) {
  return (
    event?.id ||
    `${event?.pair}_${event?.timestampUtc}_${event?.eventType}_${event?.sweepType}`
  );
}

const ui = {
  shell: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top, rgba(120,0,0,0.22), transparent 30%), #050505",
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
    background: "rgba(5,5,5,0.86)",
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
    background: "linear-gradient(180deg, rgba(20,20,20,0.98), rgba(12,12,12,0.98))",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 22,
    padding: 16,
    boxShadow: "0 14px 34px rgba(0,0,0,0.28)",
  },
  savageCard: {
    background:
      "linear-gradient(180deg, rgba(34,10,10,0.92), rgba(12,12,12,0.98))",
    border: "1px solid rgba(255,26,26,0.14)",
    borderRadius: 22,
    padding: 16,
    boxShadow: "0 0 24px rgba(255,26,26,0.08), 0 14px 34px rgba(0,0,0,0.28)",
  },
  mainChartCard: {
    background:
      "linear-gradient(180deg, rgba(18,18,18,0.98), rgba(10,10,10,0.98))",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 26,
    padding: 16,
    boxShadow: "0 18px 42px rgba(0,0,0,0.34)",
    marginBottom: 14,
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
    background: "rgba(255,255,255,0.04)",
    color: "#F2F2F2",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 700,
  },
  redPill: {
    border: "1px solid rgba(255,26,26,0.28)",
    background: "rgba(255,26,26,0.12)",
    color: "#ffb0b0",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 700,
    boxShadow: "0 0 16px rgba(255,26,26,0.08)",
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
  chartFrame: {
    height: 650,
    borderRadius: 20,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "#0D0D0D",
  },
  split: {
    display: "grid",
    gridTemplateColumns: "minmax(360px, 1fr) minmax(420px, 0.95fr)",
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
  grid2: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 },
  grid3: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 },
  eventButton: {
    width: "100%",
    textAlign: "left",
    background: "linear-gradient(180deg,#171717,#111)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: 14,
    color: "#F2F2F2",
    cursor: "pointer",
    transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
  },
  eventButtonSelected: {
    width: "100%",
    textAlign: "left",
    background: "linear-gradient(180deg, rgba(255,26,26,0.18), rgba(20,20,20,1))",
    border: "1px solid rgba(255,26,26,0.34)",
    borderRadius: 18,
    padding: 14,
    color: "#F2F2F2",
    cursor: "pointer",
    transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
    boxShadow: "0 0 20px rgba(255,26,26,0.08)",
  },
  tableGrid: {
    display: "grid",
    gridTemplateColumns: "1.4fr .55fr 1fr .75fr .8fr",
    gap: 10,
    alignItems: "center",
  },
  statValue: { fontSize: 28, fontWeight: 900, marginTop: 8 },
  sectionSpacing: { marginTop: 14 },
};

export default function App() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [logMode, setLogMode] = useState("event");
  const [showPropAdvanced, setShowPropAdvanced] = useState(false);
  const [decisionForm, setDecisionForm] = useState({ ...emptyForm });

  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  const [loggedDecisions, setLoggedDecisions] = useState(() =>
    safeReadStorage(STORAGE_KEYS.loggedDecisions, [])
  );
  const [pairFilter, setPairFilter] = useState("All");
  const [sweepFilter, setSweepFilter] = useState("All");
  const [feedStatus, setFeedStatus] = useState("Connecting...");
  const [hideLoggedRadar, setHideLoggedRadar] = useState(true);
  const [visibleCount, setVisibleCount] = useState(() => {
    const stored = safeReadStorage(STORAGE_KEYS.radarVisibleCount, 12);
    return stored > 0 ? stored : 12;
  });
  const [visibleLogsCount, setVisibleLogsCount] = useState(12);

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

  async function registerUser() {
    if (!authEmail.trim() || !authPassword.trim()) {
      alert("Enter email and password.");
      return;
    }

    try {
      const res = await fetch("http://localhost:4000/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authEmail.trim(),
          password: authPassword,
        }),
      });

      const data = await res.json();

      if (data.token) {
        setToken(data.token);
        localStorage.setItem("token", data.token);
        alert("Registered + logged in");
        return;
      }

      alert(data.error || "Register failed");
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
      const res = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authEmail.trim(),
          password: authPassword,
        }),
      });

      const data = await res.json();

      if (data.token) {
        setToken(data.token);
        localStorage.setItem("token", data.token);
        alert("Logged in");
        return;
      }

      alert(data.error || "Login failed");
    } catch (err) {
      console.error(err);
      alert("Login failed");
    }
  }

  function logoutUser() {
    setToken("");
    localStorage.removeItem("token");
  }

  useEffect(() => {
    let mounted = true;

    async function loadEvents() {
      try {
        const res = await fetch("http://localhost:3001/events");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        if (!mounted) return;
        if (!Array.isArray(data)) throw new Error("Feed did not return an array");

        if (data.length === 0) {
          setFeedStatus("Live Feed (0 events)");
          return;
        }

        setFeedStatus(`Live Feed (${data.length})`);

        setEvents((prev) => {
          const merged = [...data, ...prev];
          const seen = new Set();

          const unique = merged.filter((item) => {
            const key = eventKey(item);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          unique.sort(
            (a, b) => new Date(b.timestampUtc || 0) - new Date(a.timestampUtc || 0)
          );

          return unique.slice(0, 200);
        });

        setSelectedEvent((prev) => {
          if (prev) {
            const existing = [...data].find((e) => eventKey(e) === eventKey(prev));
            return existing || prev;
          }
          return data[0] || null;
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

  const loggedEventIds = useMemo(() => {
    return new Set(loggedDecisions.map((item) => item.linkedEventId).filter(Boolean));
  }, [loggedDecisions]);

  const pairOptions = useMemo(
    () => ["All", ...new Set(events.map((e) => e.pair).filter(Boolean))],
    [events]
  );

  const sweepOptions = useMemo(
    () => ["All", ...new Set(events.map((e) => e.sweepType).filter(Boolean))],
    [events]
  );

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const pairOk = pairFilter === "All" || e.pair === pairFilter;
      const sweepOk = sweepFilter === "All" || e.sweepType === sweepFilter;
      const loggedOk = !hideLoggedRadar || !loggedEventIds.has(e.id);
      return pairOk && sweepOk && loggedOk;
    });
  }, [events, pairFilter, sweepFilter, hideLoggedRadar, loggedEventIds]);

  const visibleEvents = useMemo(() => {
    return filteredEvents.slice(0, visibleCount);
  }, [filteredEvents, visibleCount]);

  const visibleLoggedDecisions = useMemo(() => {
    return loggedDecisions.slice(0, visibleLogsCount);
  }, [loggedDecisions, visibleLogsCount]);

  const stats = useMemo(() => {
    const totalEvents = events.length;
    const validSetups = events.filter((e) => e.reclaimConfirmed).length;
    const takenTrades = loggedDecisions.filter((d) => d.action === "Taken").length;
    const avgDiscipline = avg(loggedDecisions.map((d) => d.disciplineScore));
    const avgSetup = avg(loggedDecisions.map((d) => d.setupQuality));

    const biggestMistake =
      Object.entries(
        loggedDecisions.reduce((acc, item) => {
          if (item.ruleBreak && item.ruleBreak !== "None") {
            acc[item.ruleBreak] = (acc[item.ruleBreak] || 0) + 1;
          }
          return acc;
        }, {})
      ).sort((a, b) => b[1] - a[1])[0]?.[0] || "None";

    return {
      totalEvents,
      validSetups,
      takenTrades,
      avgDiscipline,
      avgSetup,
      biggestMistake,
    };
  }, [events, loggedDecisions]);

  const propMetrics = useMemo(() => getPropMetrics(propAccount), [propAccount]);

  const effectiveComplianceTarget = useMemo(() => {
    if (logMode === "manual") {
      return {
        pair: decisionForm.pair,
        timeframe: decisionForm.timeframe,
        session: decisionForm.session,
        directionBias: decisionForm.directionBias,
        eventType: decisionForm.eventType,
        sweepType: decisionForm.sweepType,
        emaContext: decisionForm.emaContext,
        entry: decisionForm.entry,
        stop: decisionForm.stop,
        tp1: decisionForm.tp1,
        tp2: decisionForm.tp2,
      };
    }

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
    };
  }, [logMode, selectedEvent, decisionForm]);

  const selectedCompliance = useMemo(() => {
    return evaluatePropCompliance(effectiveComplianceTarget, propAccount);
  }, [effectiveComplianceTarget, propAccount]);

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

  function loadEvent(event) {
    setSelectedEvent(event);
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
      entry: event.entry ?? "",
      stop: event.stop ?? "",
      tp1: event.tp1 ?? "",
      tp2: event.tp2 ?? "",
      structure: event.structure || "",
    });
  }

  function switchToManualLog() {
    setLogMode("manual");
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

  function saveDecision() {
    const pair = (decisionForm.pair || "").trim();
    if (!pair) {
      alert("Please enter a pair.");
      return;
    }

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
            entry: decisionForm.entry,
            stop: decisionForm.stop,
            tp1: decisionForm.tp1,
            tp2: decisionForm.tp2,
          };

    const compliance = evaluatePropCompliance(effectiveEvent, propAccount);

    const entry = {
      id: `log_${Date.now()}`,
      linkedEventId: logMode === "event" ? selectedEvent?.id || null : null,
      timestampUtc: new Date().toISOString(),
      displayTime:
        logMode === "event" ? displayTime(selectedEvent?.timestampUtc) : "Manual",
      pair,
      timeframe: decisionForm.timeframe,
      session: decisionForm.session,
      directionBias: decisionForm.directionBias,
      eventType: decisionForm.eventType,
      sweepType: decisionForm.sweepType,
      emaContext: decisionForm.emaContext,
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
      screenshot: decisionForm.screenshot,
      structure: decisionForm.structure,
      sourceType: logMode === "event" ? "Event Response" : "Manual Log",
      riskAmount: compliance.riskAmount,
      propQualified: compliance.qualified,
      complianceNotes: compliance.notes,
    };

    setLoggedDecisions((prev) => [entry, ...prev].slice(0, 100));

    if (token) {
      fetch("http://localhost:4000/logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pair: entry.pair,
          timeframe: entry.timeframe,
          action: entry.action,
          pnl: entry.pnl,
          notes: entry.notes,
        }),
      }).catch((err) => {
        console.error("DB save failed", err);
      });
    }

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

    if (logMode === "event" && selectedEvent) {
      setDecisionForm({
        ...emptyForm,
        pair: selectedEvent.pair || "",
        timeframe: selectedEvent.timeframe || "3m",
        session: selectedEvent.session || "New York",
        directionBias: selectedEvent.directionBias || "Short",
        eventType: selectedEvent.eventType || "SWEEP_DETECTED",
        sweepType: selectedEvent.sweepType || "High Sweep",
        emaContext: selectedEvent.emaContext || "EMA99 Rejection",
        entry: selectedEvent.entry ?? "",
        stop: selectedEvent.stop ?? "",
        tp1: selectedEvent.tp1 ?? "",
        tp2: selectedEvent.tp2 ?? "",
        structure: selectedEvent.structure || "",
      });
    } else {
      setDecisionForm({ ...emptyForm });
    }
  }

  function exportJson() {
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      propAccount,
      stats,
      events,
      loggedDecisions,
    };

    const dataStr = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "liquidity_radar_export.json";
    a.click();

    URL.revokeObjectURL(url);
  }

  const selectedFlowText =
    logMode === "event"
      ? `${selectedEvent?.sweepType || "Sweep"} → ${selectedEvent?.eventType || "Response"} → ${selectedEvent?.directionBias || "Bias"}`
      : `${decisionForm.sweepType} → ${decisionForm.eventType} → ${decisionForm.directionBias}`;

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
              <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Liquidity Lab
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>{feedStatus}</span>
            <button style={logMode === "event" ? ui.primaryButton : ui.button} onClick={() => selectedEvent && loadEvent(selectedEvent)} type="button">
              Event Mode
            </button>
            <button style={logMode === "manual" ? ui.primaryButton : ui.button} onClick={switchToManualLog} type="button">
              Manual Mode
            </button>
            <button style={ui.button} onClick={exportJson} type="button">Export JSON</button>
            {token ? (
              <button style={ui.button} onClick={logoutUser} type="button">Logout</button>
            ) : (
              <>
                <input style={{ ...ui.input, width: 140, padding: "10px 12px" }} type="email" placeholder="Email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
                <input style={{ ...ui.input, width: 140, padding: "10px 12px" }} type="password" placeholder="Password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} />
                <button style={ui.button} onClick={registerUser} type="button">Register</button>
                <button style={ui.primaryButton} onClick={loginUser} type="button">Login</button>
              </>
            )}
          </div>
        </div>
      </header>

      <div style={ui.container}>
        <div style={ui.topCardRow}>
          <StatCard title="Sweep Events" value={stats.totalEvents} subtitle="Stored feed history" />
          <StatCard title="Valid Setups" value={stats.validSetups} subtitle="Reclaim confirmed" />
          <StatCard title="Trades Taken" value={stats.takenTrades} subtitle="Logged decisions" savage />
          <StatCard title="Discipline" value={stats.avgDiscipline ? stats.avgDiscipline.toFixed(1) : "0.0"} subtitle="Average score" />
          <StatCard title="Setup Quality" value={stats.avgSetup ? stats.avgSetup.toFixed(1) : "0.0"} subtitle="Average score" />
          <StatCard title="Top Mistake" value={stats.biggestMistake} subtitle="Most common issue" />
        </div>

        <section style={ui.mainChartCard}>
          <div style={ui.toolbar}>
            <div>
              <div style={ui.blockTitle}>Live Pattern Chart</div>
              <h2 style={ui.title}>{chartPair} • {activeTimeframe}</h2>
              <div style={ui.subtext}>Chart first, decisions second, logs below.</div>
              <div style={{ marginTop: 8, color: "#ffb0b0", fontWeight: 800 }}>
                {selectedFlowText}
              </div>
            </div>

            <div style={ui.pillRow}>
              <span style={ui.pill}>{logMode === "event" ? selectedEvent?.sweepType || "No Event" : decisionForm.sweepType}</span>
              <span style={ui.pill}>{logMode === "event" ? selectedEvent?.emaContext || "Waiting" : decisionForm.emaContext}</span>
              <span style={ui.redPill}>{logMode === "event" ? selectedEvent?.session || "Waiting" : decisionForm.session}</span>
              <a href={blofinUrl} target="_blank" rel="noreferrer" style={{ ...ui.button, textDecoration: "none" }}>Open BloFin</a>
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
          <div style={ui.savageCard}>
            <div style={ui.toolbar}>
              <div>
                <div style={ui.blockTitle}>Live Radar</div>
                <h2 style={ui.title}>Recent Actionable Sweep Flow</h2>
                <div style={ui.subtext}>{visibleEvents.length} / {filteredEvents.length} visible</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select style={ui.input} value={pairFilter} onChange={(e) => setPairFilter(e.target.value)}>
                  {pairOptions.map((pair) => <option key={pair} value={pair}>{pair}</option>)}
                </select>
                <select style={ui.input} value={sweepFilter} onChange={(e) => setSweepFilter(e.target.value)}>
                  {sweepOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <button style={hideLoggedRadar ? ui.primaryButton : ui.button} onClick={() => setHideLoggedRadar((prev) => !prev)} type="button">
                  {hideLoggedRadar ? "Hiding Logged" : "Showing Logged"}
                </button>
              </div>
            </div>

            {visibleEvents.length === 0 ? (
              <div style={{ ...ui.card, background: "#141414", padding: 20 }}>
                No live events coming in yet. Feed status: {feedStatus}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {visibleEvents.map((event) => (
                  <button
                    key={eventKey(event)}
                    style={selectedEvent?.id === event.id && logMode === "event" ? ui.eventButtonSelected : ui.eventButton}
                    onClick={() => loadEvent(event)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 10px 24px rgba(0,0,0,0.26)";
                      e.currentTarget.style.borderColor = "rgba(255,26,26,0.22)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow =
                        selectedEvent?.id === event.id && logMode === "event"
                          ? "0 0 20px rgba(255,26,26,0.08)"
                          : "none";
                      e.currentTarget.style.borderColor =
                        selectedEvent?.id === event.id && logMode === "event"
                          ? "rgba(255,26,26,0.34)"
                          : "rgba(255,255,255,0.08)";
                    }}
                    type="button"
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <strong style={{ fontSize: 18 }}>{event.pair}</strong>
                        <span style={event.directionBias === "Long" ? ui.greenPill : ui.redPill}>
                          {event.directionBias}
                        </span>
                        <span style={ui.pill}>{event.timeframe}</span>
                      </div>
                      <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>{displayTime(event.timestampUtc)}</span>
                    </div>
                    <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                      <div style={{ fontWeight: 800, color: "#ffb0b0" }}>{event.sweepType}</div>
                      <div style={{ color: "rgba(255,255,255,0.72)" }}>{event.emaContext}</div>
                      <div style={{ color: "rgba(255,255,255,0.48)", fontSize: 13 }}>
                        {event.session} • {Math.round((event.botConfidence || 0) * 100)}% confidence
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.14)" }} />
                        <div style={{ color: "#ff7676", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                          liquidity line
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {filteredEvents.length > visibleCount ? (
              <div style={{ marginTop: 12 }}>
                <button style={ui.button} type="button" onClick={() => setVisibleCount((prev) => prev + 8)}>
                  Show More
                </button>
              </div>
            ) : null}
          </div>

          <div style={ui.card}>
            <div style={ui.toolbar}>
              <div>
                <div style={ui.blockTitle}>{logMode === "event" ? "Trade Journal" : "Manual Journal"}</div>
                <h2 style={ui.title}>
                  {logMode === "event" ? "Respond to Selected Event" : "Log Without Radar Card"}
                </h2>
                <div style={ui.subtext}>
                  {logMode === "event"
                    ? selectedEvent?.pair || "No event selected"
                    : decisionForm.pair || "Manual entry"}
                </div>
              </div>
              <div style={ui.pillRow}>
                <span style={ui.pill}>{logMode === "event" ? selectedEvent?.sweepType || "—" : decisionForm.sweepType}</span>
                <span style={ui.pill}>{logMode === "event" ? selectedEvent?.emaContext || "—" : decisionForm.emaContext}</span>
              </div>
            </div>

            {propAccount.mode === "prop" ? (
              <div style={{
                border: `1px solid ${selectedCompliance.qualified ? "rgba(110,255,170,0.25)" : "rgba(255,80,80,0.25)"}`,
                background: selectedCompliance.qualified ? "rgba(20,80,40,0.18)" : "rgba(80,20,20,0.18)",
                borderRadius: 18,
                padding: 14,
                marginBottom: 12,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <strong>{selectedCompliance.qualified ? "Prop-Compliant Setup" : "Not Prop-Compliant"}</strong>
                  <span style={ui.pill}>Risk {selectedCompliance.riskAmount.toFixed(2)}</span>
                </div>
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={ui.pill}>RR1 {selectedCompliance.rrToTp1.toFixed(2)}</span>
                  <span style={ui.pill}>RR2 {selectedCompliance.rrToTp2.toFixed(2)}</span>
                </div>
                {selectedCompliance.notes.length ? (
                  <ul style={{ marginTop: 10, paddingLeft: 18, color: "rgba(255,255,255,0.8)" }}>
                    {selectedCompliance.notes.map((note) => <li key={note}>{note}</li>)}
                  </ul>
                ) : (
                  <div style={{ marginTop: 10, color: "rgba(255,255,255,0.72)" }}>Setup passes current prop rules.</div>
                )}
              </div>
            ) : null}

            {logMode === "manual" && (
              <>
                <div style={ui.grid2}>
                  <Field label="Pair"><input style={ui.input} type="text" placeholder="SUI/USDT" value={decisionForm.pair} onChange={(e) => updateDecision("pair", e.target.value)} /></Field>
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
                  <Field label="Structure"><input style={ui.input} type="text" placeholder="Range high liquidity clear" value={decisionForm.structure || ""} onChange={(e) => updateDecision("structure", e.target.value)} /></Field>
                </div>
              </>
            )}

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
              <Field label="Discipline Score"><input style={ui.input} type="number" min="1" max="10" value={decisionForm.disciplineScore} onChange={(e) => updateDecision("disciplineScore", e.target.value)} /></Field>
              <Field label="Setup Quality"><input style={ui.input} type="number" min="1" max="10" value={decisionForm.setupQuality} onChange={(e) => updateDecision("setupQuality", e.target.value)} /></Field>
              <Field label="Emotional Pressure"><input style={ui.input} type="number" min="1" max="10" value={decisionForm.emotionalPressure} onChange={(e) => updateDecision("emotionalPressure", e.target.value)} /></Field>
            </div>

            <div style={{ ...ui.grid2, marginTop: 10 }}>
              <Field label="Entry"><input style={ui.input} type="number" step="any" value={decisionForm.entry} onChange={(e) => updateDecision("entry", e.target.value)} /></Field>
              <Field label="Stop"><input style={ui.input} type="number" step="any" value={decisionForm.stop} onChange={(e) => updateDecision("stop", e.target.value)} /></Field>
            </div>

            <div style={{ ...ui.grid3, marginTop: 10 }}>
              <Field label="TP1"><input style={ui.input} type="number" step="any" value={decisionForm.tp1} onChange={(e) => updateDecision("tp1", e.target.value)} /></Field>
              <Field label="TP2"><input style={ui.input} type="number" step="any" value={decisionForm.tp2} onChange={(e) => updateDecision("tp2", e.target.value)} /></Field>
              <Field label="Exit"><input style={ui.input} type="number" step="any" value={decisionForm.exit} onChange={(e) => updateDecision("exit", e.target.value)} /></Field>
            </div>

            <div style={{ ...ui.grid2, marginTop: 10 }}>
              <Field label="PnL"><input style={ui.input} type="number" step="any" value={decisionForm.pnl} onChange={(e) => updateDecision("pnl", e.target.value)} /></Field>
              <Field label="Screenshot">
                <input
                  style={ui.input}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => updateDecision("screenshot", reader.result);
                    reader.readAsDataURL(file);
                  }}
                />
              </Field>
            </div>

            <Field label="Decision Notes">
              <textarea
                style={{ ...ui.input, minHeight: 108, resize: "vertical" }}
                rows="5"
                placeholder="Why did you take or skip it? What made it valid or invalid?"
                value={decisionForm.notes}
                onChange={(e) => updateDecision("notes", e.target.value)}
              />
            </Field>

            {decisionForm.screenshot ? (
              <div style={{ marginTop: 12, borderRadius: 18, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                <img src={decisionForm.screenshot} alt="Decision screenshot preview" style={{ width: "100%", display: "block" }} />
              </div>
            ) : null}

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
              <h2 style={ui.title}>Saved Event Responses and Manual Journal Entries</h2>
            </div>
          </div>

          {loggedDecisions.length === 0 ? (
            <div style={{ ...ui.card, background: "#141414", padding: 20 }}>
              No logs yet. Select a radar event or switch to manual mode.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {visibleLoggedDecisions.map((item) => (
                <div key={item.id} style={{ ...ui.card, background: "#141414", padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 18 }}>{item.pair}</strong>
                      <span style={ui.pill}>{item.sweepType}</span>
                      <span style={ui.pill}>{item.emaContext}</span>
                      <span style={ui.redPill}>{item.sourceType}</span>
                    </div>
                    <span style={{ color: "rgba(255,255,255,0.52)", fontSize: 12 }}>{item.displayTime}</span>
                  </div>

                  <div style={{ ...ui.tableGrid, marginTop: 12 }}>
                    <MiniBox label="Action" value={item.action} />
                    <MiniBox label="Timing" value={item.timing} />
                    <MiniBox label="Plan" value={item.planFollowed} />
                    <MiniBox label="Mistake" value={item.ruleBreak} />
                    <MiniBox label="Discipline" value={item.disciplineScore} />
                  </div>

                  {(item.entry || item.stop || item.tp1 || item.tp2) ? (
                    <div style={{ ...ui.tableGrid, marginTop: 10 }}>
                      <MiniBox label="Entry" value={fmt(item.entry)} />
                      <MiniBox label="Stop" value={fmt(item.stop)} />
                      <MiniBox label="TP1" value={fmt(item.tp1)} />
                      <MiniBox label="TP2" value={fmt(item.tp2)} />
                      <MiniBox label="PnL" value={fmt(item.pnl, 2)} />
                    </div>
                  ) : null}

                  {item.notes ? (
                    <div style={{ marginTop: 10, color: "rgba(255,255,255,0.72)", lineHeight: 1.45 }}>{item.notes}</div>
                  ) : null}

                  {item.screenshot ? (
                    <div style={{ marginTop: 12, borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <img src={item.screenshot} alt={`${item.pair} screenshot`} style={{ width: "100%", display: "block" }} />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {loggedDecisions.length > visibleLogsCount ? (
            <div style={{ marginTop: 12 }}>
              <button style={ui.button} type="button" onClick={() => setVisibleLogsCount((prev) => prev + 6)}>
                Show More Logs
              </button>
            </div>
          ) : null}
        </section>

        <section style={{ ...ui.card, ...ui.sectionSpacing }}>
          <div style={ui.toolbar}>
            <div>
              <div style={ui.blockTitle}>Prop Rules</div>
              <h2 style={ui.title}>Lower Priority, Still Visible</h2>
              <div style={ui.subtext}>Kept below the live workflow so the chart and journal stay primary.</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={ui.button} onClick={() => setShowPropAdvanced((prev) => !prev)} type="button">
                {showPropAdvanced ? "Hide Advanced" : "Show Advanced"}
              </button>
              <button style={ui.button} onClick={resetPropDay} type="button">Reset Day</button>
              <button style={ui.button} onClick={resetPropAccount} type="button">Reset Account</button>
            </div>
          </div>

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

          {showPropAdvanced ? (
            <div style={{ marginTop: 12 }}>
              <div style={ui.grid2}>
                <Field label="Firm">
                  <select style={ui.input} value={propAccount.firmName} onChange={(e) => updateProp("firmName", e.target.value)}>
                    <option value="Custom">Custom</option>
                    <option value="FTMO">FTMO</option>
                    <option value="FundedNext">FundedNext</option>
                    <option value="The5ers">The5ers</option>
                  </select>
                </Field>
                <Field label="Daily Profit Lock">
                  <input style={ui.input} type="number" value={propAccount.dailyProfitLock} onChange={(e) => updateProp("dailyProfitLock", e.target.value)} />
                </Field>
              </div>

              <div style={{ ...ui.grid3, marginTop: 10 }}>
                <Field label="Profit Target %"><input style={ui.input} type="number" step="0.01" value={propAccount.profitTargetPct} onChange={(e) => updateProp("profitTargetPct", e.target.value)} /></Field>
                <Field label="Daily DD %"><input style={ui.input} type="number" step="0.01" value={propAccount.dailyDrawdownPct} onChange={(e) => updateProp("dailyDrawdownPct", e.target.value)} /></Field>
                <Field label="Max DD %"><input style={ui.input} type="number" step="0.01" value={propAccount.maxDrawdownPct} onChange={(e) => updateProp("maxDrawdownPct", e.target.value)} /></Field>
              </div>

              <div style={{ ...ui.grid3, marginTop: 10 }}>
                <Field label="Max Losses / Day"><input style={ui.input} type="number" value={propAccount.maxLossesPerDay} onChange={(e) => updateProp("maxLossesPerDay", e.target.value)} /></Field>
                <Field label="Starting Balance"><input style={ui.input} type="number" value={propAccount.startingBalance} onChange={(e) => updateProp("startingBalance", e.target.value)} /></Field>
                <Field label="Current Balance"><input style={ui.input} type="number" value={propAccount.currentBalance} onChange={(e) => updateProp("currentBalance", e.target.value)} /></Field>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, savage = false }) {
  return (
    <div
      style={
        savage
          ? {
              ...ui.savageCard,
              padding: 16,
            }
          : ui.card
      }
    >
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
    <div style={{
      border: "1px solid rgba(255,255,255,0.08)",
      background: "#191919",
      borderRadius: 14,
      padding: 10,
      minWidth: 0,
    }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.42)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
        {label}
      </div>
      <strong style={{ wordBreak: "break-word", overflowWrap: "anywhere", display: "block", marginTop: 6 }}>
        {value}
      </strong>
    </div>
  );
}
