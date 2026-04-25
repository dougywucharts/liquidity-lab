import { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";

const cardButtonReset = {
  appearance: "none",
  WebkitAppearance: "none",
  border: "none",
  background: "transparent",
  color: "inherit",
  font: "inherit",
  lineHeight: "normal",
  textAlign: "left",
  padding: 0,
  margin: 0,
  width: "100%",
  minHeight: "unset",
  height: "auto",
  display: "block",
  cursor: "pointer",
  overflow: "visible",
  whiteSpace: "normal",
};

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

const DEFAULT_FEATURE_FLAGS = {
  manualJournal: true,
  aiReview: false,
  screenshotReview: false,
  export: false,
  deeperStats: false,
};

const BETA_ACCESS_CODE = import.meta.env.VITE_BETA_ACCESS_CODE || "redoctoberbeta";

const PROP_PRESETS = [
  {
    id: "none",
    label: "No Prop Challenge",
    firm: "Off",
    accountSizes: [0],
    phases: ["Off"],
    rules: {
      profitTargetPct: 0,
      dailyLossPct: 0,
      maxDrawdownPct: 0,
      minTradingDays: 0,
      maxRiskPerTradePct: 0,
      weekendHolding: true,
      consistencyHint: "No rules loaded.",
    },
  },
  {
    id: "ftmo_like",
    label: "FTMO-Style",
    firm: "FTMO-Style",
    accountSizes: [10000, 25000, 50000, 100000],
    phases: ["Phase 1", "Phase 2"],
    rules: {
      profitTargetPct: 0.1,
      dailyLossPct: 0.05,
      maxDrawdownPct: 0.1,
      minTradingDays: 4,
      maxRiskPerTradePct: 0.01,
      weekendHolding: true,
      consistencyHint: "Avoid oversized wins and losses. Keep sizing stable.",
    },
  },
  {
    id: "fundednext_like",
    label: "FundedNext-Style",
    firm: "FundedNext-Style",
    accountSizes: [15000, 25000, 50000, 100000],
    phases: ["Phase 1", "Phase 2"],
    rules: {
      profitTargetPct: 0.1,
      dailyLossPct: 0.05,
      maxDrawdownPct: 0.1,
      minTradingDays: 5,
      maxRiskPerTradePct: 0.01,
      weekendHolding: false,
      consistencyHint: "Good setups still fail if risk clusters too hard.",
    },
  },
  {
    id: "five_percenters_like",
    label: "5%ers-Style",
    firm: "5%ers-Style",
    accountSizes: [10000, 20000, 40000, 60000, 100000],
    phases: ["Bootcamp", "Funded"],
    rules: {
      profitTargetPct: 0.08,
      dailyLossPct: 0.04,
      maxDrawdownPct: 0.06,
      minTradingDays: 3,
      maxRiskPerTradePct: 0.0075,
      weekendHolding: true,
      consistencyHint: "Respect total drawdown tightly. Lower aggression wins.",
    },
  },
  {
    id: "e8_like",
    label: "E8-Style",
    firm: "E8-Style",
    accountSizes: [25000, 50000, 100000],
    phases: ["Evaluation", "Verified"],
    rules: {
      profitTargetPct: 0.08,
      dailyLossPct: 0.05,
      maxDrawdownPct: 0.08,
      minTradingDays: 3,
      maxRiskPerTradePct: 0.01,
      weekendHolding: false,
      consistencyHint: "Smooth equity curve matters more than random spikes.",
    },
  },
];

const palette = {
  bg: "#03060b",
  bg2: "#060a12",
  panel: "linear-gradient(180deg, rgba(8,12,20,0.98), rgba(5,8,14,0.98))",
  card: "linear-gradient(180deg, rgba(15,20,32,0.96), rgba(10,14,24,0.96))",
  border: "rgba(255,255,255,0.08)",
  borderSoft: "rgba(255,255,255,0.05)",
  text: "#f4f7fb",
  textSoft: "rgba(244,247,251,0.66)",
  textDim: "rgba(244,247,251,0.46)",
  long: "#4ade80",
  longSoft: "rgba(74, 222, 128, 0.16)",
  short: "#fb7185",
  shortSoft: "rgba(251, 113, 133, 0.16)",
  gold: "#f6c453",
  goldSoft: "rgba(246,196,83,0.14)",
  accent: "#ef4444",
};

const fieldStyle = {
  width: "100%",
  borderRadius: 12,
  padding: "10px 12px",
  background: "rgba(255,255,255,0.04)",
  color: palette.text,
  border: `1px solid ${palette.border}`,
  outline: "none",
};

function parseEventDate(ts) {
  if (!ts) return null;
  const raw = String(ts).trim();
  if (!raw) return null;
  const hasTimezone = /[zZ]$|[+\-]\d{2}:\d{2}$/.test(raw);
  const normalized = hasTimezone ? raw : `${raw}Z`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateTime(ts) {
  const d = parseEventDate(ts);
  if (!d) return "—";
  return d.toLocaleString([], {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatTimeOnly(ts) {
  const d = parseEventDate(ts);
  if (!d) return "—";
  return d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function num(v, digits = 3) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

function money(v) {
  const n = Number(v);
  return Number.isFinite(n) ? `$${n.toLocaleString()}` : "—";
}

function pct(v, digits = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? `${(n * 100).toFixed(digits)}%` : "—";
}

function calcRR(entry, stop, target) {
  const e = Number(entry);
  const s = Number(stop);
  const t = Number(target);
  if (![e, s, t].every(Number.isFinite)) return null;
  const risk = Math.abs(e - s);
  if (!Number.isFinite(risk) || risk <= 0) return null;
  const reward = Math.abs(t - e);
  if (!Number.isFinite(reward) || reward <= 0) return null;
  return reward / risk;
}

function calcPlannedRR(entry, stop, tp1, tp2, rr1, rr2) {
  const parsedRr1 = Number(rr1);
  const parsedRr2 = Number(rr2);
  return {
    rr1: Number.isFinite(parsedRr1) ? parsedRr1 : calcRR(entry, stop, tp1),
    rr2: Number.isFinite(parsedRr2) ? parsedRr2 : calcRR(entry, stop, tp2),
  };
}

function calcRealizedRR(directionBias, entry, stop, exit) {
  const e = Number(entry);
  const s = Number(stop);
  const x = Number(exit);
  if (![e, s, x].every(Number.isFinite)) return null;
  const risk = Math.abs(e - s);
  if (!Number.isFinite(risk) || risk <= 0) return null;
  const tone = directionTone(directionBias);
  const pnlMove = tone === "short" ? e - x : x - e;
  return pnlMove / risk;
}

function rr_text_js(rr) {
  return rr == null || !Number.isFinite(Number(rr)) ? "—" : `${Number(rr).toFixed(2)}R`;
}

function directionTone(value) {
  const v = String(value || "").toLowerCase();
  if (v.includes("long") || v.includes("bull")) return "long";
  if (v.includes("short") || v.includes("bear")) return "short";
  return "neutral";
}

function eventKey(evt) {
  return [
    evt?.id || "",
    evt?.pair || "",
    evt?.timeframe || "",
    evt?.timestampUtc || "",
    evt?.eventType || "",
    evt?.sweepType || "",
  ].join("|");
}

function buildWaveKey(evt) {
  return [
    evt?.pair || "UNKNOWN",
    evt?.timeframe || "NA",
    evt?.directionBias || "Neutral",
    evt?.sweepType || "Sweep",
  ].join("|");
}

function normalizeEventsResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.events)) return data.events;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function groupWaves(events) {
  if (!Array.isArray(events)) return [];
  const map = new Map();

  for (const evt of events) {
    const key = buildWaveKey(evt);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(evt);
  }

  return Array.from(map.entries())
    .map(([key, list]) => {
      const sortedEvents = [...list].sort(
        (a, b) =>
          (parseEventDate(b?.timestampUtc)?.getTime() || 0) -
          (parseEventDate(a?.timestampUtc)?.getTime() || 0)
      );

      const newest = sortedEvents[0] || {};
      const newestTime = parseEventDate(newest?.timestampUtc)?.getTime() || 0;

      const avgConfidence =
        sortedEvents.reduce((sum, item) => sum + (Number(item?.botConfidence) || 0), 0) /
        Math.max(sortedEvents.length, 1);

      return {
        key,
        pair: newest?.pair || "—",
        timeframe: newest?.timeframe || "—",
        directionBias: newest?.directionBias || "Neutral",
        sweepType: newest?.sweepType || newest?.eventType || "Sweep",
        eventType: newest?.eventType || "—",
        session: newest?.session || "—",
        timestampUtc: newest?.timestampUtc || null,
        latestTimeMs: newestTime,
        avgConfidence,
        count: sortedEvents.length,
        events: sortedEvents,
      };
    })
    .sort((a, b) => (b.latestTimeMs || 0) - (a.latestTimeMs || 0));
}

function bestTickerItems(events, limit = 12) {
  if (!Array.isArray(events)) return [];
  return [...events]
    .sort((a, b) => {
      const confA = Number(a?.botConfidence) || 0;
      const confB = Number(b?.botConfidence) || 0;
      const timeA = parseEventDate(a?.timestampUtc)?.getTime() || 0;
      const timeB = parseEventDate(b?.timestampUtc)?.getTime() || 0;
      if (confB !== confA) return confB - confA;
      return timeB - timeA;
    })
    .slice(0, limit);
}

function getTvInterval(tf) {
  const value = String(tf || "").trim().toLowerCase();
  const map = {
    "1m": "1",
    "3m": "3",
    "5m": "5",
    "15m": "15",
    "30m": "30",
    "45m": "45",
    "1h": "60",
    "2h": "120",
    "4h": "240",
    "6h": "360",
    "12h": "720",
    "1d": "D",
    d: "D",
    "1w": "W",
    w: "W",
  };
  return map[value] || "15";
}

function getChartInfo(pair) {
  const raw = String(pair || "").trim();
  const normalized = raw
    .replace(":USDT", "")
    .replace("/USDT", "USDT")
    .replace("/", "")
    .trim();

  const symbol = normalized || "BTCUSDT";

  return {
    tvSymbol: `BINANCE:${symbol}`,
    blofinUrl: raw
      ? `https://blofin.com/futures/${raw.replace(":USDT", "").replace("/", "-")}`
      : "https://blofin.com/",
    tradingViewUrl: `https://www.tradingview.com/chart/?symbol=BINANCE:${symbol}`,
  };
}

function Pill({ children, tone = "neutral" }) {
  const styleMap = {
    neutral: {
      color: palette.textSoft,
      background: "rgba(255,255,255,0.04)",
      border: `1px solid ${palette.border}`,
    },
    long: {
      color: palette.long,
      background: palette.longSoft,
      border: "1px solid rgba(74, 222, 128, 0.26)",
    },
    short: {
      color: palette.short,
      background: palette.shortSoft,
      border: "1px solid rgba(251, 113, 133, 0.26)",
    },
    gold: {
      color: palette.gold,
      background: palette.goldSoft,
      border: "1px solid rgba(246,196,83,0.24)",
    },
  };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        ...styleMap[tone],
      }}
    >
      {children}
    </span>
  );
}

function MiniBox({ label, value, subtext }) {
  return (
    <div
      style={{
        border: `1px solid ${palette.border}`,
        background: palette.card,
        borderRadius: 16,
        padding: 12,
        display: "grid",
        gap: 5,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: palette.textDim,
          textTransform: "uppercase",
          letterSpacing: 0.8,
        }}
      >
        {label}
      </div>
      <strong style={{ fontSize: 17 }}>{value}</strong>
      {subtext ? <div style={{ fontSize: 12, color: palette.textSoft }}>{subtext}</div> : null}
    </div>
  );
}

function StatCard({ title, value, subtitle }) {
  return (
    <div
      style={{
        border: `1px solid ${palette.border}`,
        background: palette.card,
        borderRadius: 18,
        padding: 14,
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ fontSize: 11, color: palette.textDim, textTransform: "uppercase" }}>
        {title}
      </div>
      <div style={{ fontWeight: 900, fontSize: 20 }}>{value}</div>
      <div style={{ fontSize: 12, color: palette.textSoft }}>{subtitle}</div>
    </div>
  );
}

function apiFetch(path, options = {}, token = "") {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(`${API_BASE}${path}`, { ...options, headers }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  });
}

function BillingPlaceholder({
  currentUser,
  featureFlags,
  onBack,
  onSyncBilling,
  onOpenPortal,
  syncingBilling,
}) {
  const isPro = ["active", "trialing"].includes(currentUser?.stripeStatus || "");

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          border: `1px solid ${palette.border}`,
          borderRadius: 24,
          background: palette.panel,
          padding: 18,
          display: "grid",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 10, color: palette.textDim, letterSpacing: 3, textTransform: "uppercase" }}>
              Red October Systems
            </div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>Liquidity Lab Billing</div>
            <div style={{ fontSize: 13, color: palette.textSoft }}>
              Manage your plan, portal access, and locked features.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={styles.button} onClick={onBack} type="button">
              Dashboard
            </button>
            <button style={styles.button} onClick={() => window.location.reload()} type="button">
              Refresh
            </button>
            <button style={styles.primaryButton} onClick={onSyncBilling} type="button">
              {syncingBilling ? "Syncing..." : "Sync Billing"}
            </button>
            {currentUser?.stripeCustomerId ? (
              <button style={styles.button} onClick={onOpenPortal} type="button">
                Manage Subscription
              </button>
            ) : null}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Pill tone={isPro ? "long" : "gold"}>
            {isPro ? "PRO ACTIVE" : "FREE PLAN"}
          </Pill>
          <Pill>{currentUser?.billingPlan || "starter"}</Pill>
          <Pill>{currentUser?.stripeStatus || "inactive"}</Pill>
        </div>

        {!isPro ? (
          <div
            style={{
              marginTop: 4,
              padding: 16,
              borderRadius: 18,
              border: "1px solid rgba(255,26,26,0.24)",
              background: "rgba(80,20,20,0.18)",
            }}
          >
            <strong>Upgrade to unlock the full system</strong>
            <div style={{ marginTop: 8, fontSize: 13, color: palette.textSoft }}>
              AI review, screenshot breakdowns, exports, deeper analytics, and advanced prop controls.
            </div>
          </div>
        ) : null}
      </div>

      <div
        style={{
          border: `1px solid ${palette.border}`,
          borderRadius: 22,
          background: palette.panel,
          padding: 16,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 18 }}>Feature Access</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          <MiniBox label="AI Review" value={featureFlags.aiReview ? "Unlocked" : "Locked"} />
          <MiniBox label="Screenshot Review" value={featureFlags.screenshotReview ? "Unlocked" : "Locked"} />
          <MiniBox label="Export" value={featureFlags.export ? "Unlocked" : "Locked"} />
          <MiniBox label="Advanced Stats" value={featureFlags.deeperStats ? "Unlocked" : "Locked"} />
        </div>
      </div>

      <div
        style={{
          border: `1px solid ${palette.border}`,
          borderRadius: 22,
          background: palette.panel,
          padding: 16,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 18 }}>Plans</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <div style={styles.planCard}>
            <div style={styles.planTitle}>Free</div>
            <div style={styles.planPrice}>$0</div>
            <div style={styles.planSub}>Manual journaling and core radar workflow.</div>
          </div>
          <div style={styles.planCard}>
            <div style={styles.planTitle}>Pro Monthly</div>
            <div style={styles.planPrice}>$29/mo</div>
            <div style={styles.planSub}>AI review, screenshots, exports, deeper analytics.</div>
          </div>
          <div style={styles.planCard}>
            <div style={styles.planTitle}>Pro Yearly</div>
            <div style={styles.planPrice}>$290/yr</div>
            <div style={styles.planSub}>Best value for active traders using the full system.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  app: {
    minHeight: "100vh",
    color: palette.text,
    background: `
      radial-gradient(circle at 10% 0%, rgba(239,68,68,0.07), transparent 26%),
      radial-gradient(circle at 88% 8%, rgba(255,255,255,0.03), transparent 22%),
      linear-gradient(180deg, ${palette.bg2} 0%, ${palette.bg} 50%, #020409 100%)
    `,
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  shell: {
    maxWidth: 1700,
    margin: "0 auto",
    padding: 16,
    display: "grid",
    gap: 12,
  },
  button: {
    border: `1px solid ${palette.border}`,
    cursor: "pointer",
    borderRadius: 14,
    padding: "10px 14px",
    fontWeight: 800,
    background: "linear-gradient(180deg, rgba(20,27,42,0.96), rgba(12,17,28,0.96))",
    color: palette.text,
  },
  primaryButton: {
    border: "none",
    cursor: "pointer",
    borderRadius: 14,
    padding: "10px 14px",
    fontWeight: 900,
    background: "linear-gradient(135deg, #ff2f2f 0%, #c71f1f 100%)",
    color: "#fff",
    boxShadow: "0 12px 26px rgba(239,68,68,0.28)",
  },
  topbar: {
    display: "grid",
    gap: 10,
    padding: "13px 16px",
    borderRadius: 22,
    border: `1px solid ${palette.border}`,
    background: palette.panel,
    boxShadow: "0 16px 50px rgba(0,0,0,0.42)",
  },
  topbarRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  brandWrap: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  brandIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    border: "1px solid rgba(239,68,68,0.35)",
    background: "rgba(239,68,68,0.08)",
    color: palette.accent,
    fontWeight: 900,
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "380px minmax(480px, 1fr) 340px",
    gap: 12,
    alignItems: "start",
  },
  panel: {
    borderRadius: 22,
    border: `1px solid ${palette.border}`,
    background: palette.panel,
    boxShadow: "0 16px 42px rgba(0,0,0,0.4)",
    overflow: "hidden",
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "13px 14px",
    borderBottom: `1px solid ${palette.borderSoft}`,
  },
  panelBody: {
    padding: 12,
    display: "grid",
    gap: 10,
  },
  subtext: {
    fontSize: 12,
    color: palette.textSoft,
  },
  radarList: {
    display: "grid",
    gap: 12,
    maxHeight: 720,
    overflowY: "auto",
    overflowX: "visible",
    paddingRight: 6,
    paddingBottom: 20,
  },
  waveCard: {
    borderRadius: 20,
    border: `1px solid ${palette.border}`,
    background: "linear-gradient(180deg, rgba(14,20,32,0.98), rgba(9,13,23,0.98))",
    overflow: "visible",
    display: "grid",
    alignContent: "start",
    minHeight: 220,
    position: "relative",
    boxShadow: "0 10px 24px rgba(0,0,0,0.22)",
  },
  expandedList: {
    display: "grid",
    gap: 8,
    padding: "12px 12px 14px 12px",
    borderTop: `1px solid ${palette.borderSoft}`,
    background: "linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.012))",
  },
  chartFrame: {
    height: 420,
    background: "#03060b",
    position: "relative",
  },
  journalShell: {
    borderRadius: 22,
    border: `1px solid ${palette.border}`,
    background: palette.panel,
    overflow: "hidden",
  },
  journalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "13px 14px",
    borderBottom: `1px solid ${palette.borderSoft}`,
    flexWrap: "wrap",
  },
  topCardRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
  },
  planCard: {
    border: `1px solid ${palette.border}`,
    background: palette.card,
    borderRadius: 18,
    padding: 16,
    display: "grid",
    gap: 8,
  },
  planTitle: {
    fontWeight: 900,
    fontSize: 18,
  },
  planPrice: {
    fontWeight: 900,
    fontSize: 22,
  },
  planSub: {
    color: palette.textSoft,
    fontSize: 13,
    lineHeight: 1.45,
  },
};

export default function App() {
  const [events, setEvents] = useState([]);
  const [expandedWaves, setExpandedWaves] = useState({});
  const [selectedEvent, setSelectedEvent] = useState(null);

  const [activeTab, setActiveTab] = useState("dashboard");
  const [logMode, setLogMode] = useState("event");
  const [showInsights, setShowInsights] = useState(false);
  const [journalExpanded, setJournalExpanded] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [betaUnlocked, setBetaUnlocked] = useState(() => {
    return localStorage.getItem("beta_access") === "granted";
  });

  const [betaInput, setBetaInput] = useState("");

  function toggleLogCard(id) {
    setExpandedLogId((prev) => (prev === id ? null : id));
  }

  const [currentUser, setCurrentUser] = useState({
    email: "dougywucharts@gmail.com",
    billingPlan: "starter",
    stripeStatus: "",
    stripeCustomerId: "",
  });

  const [featureFlags, setFeatureFlags] = useState(DEFAULT_FEATURE_FLAGS);
  const [syncingBilling, setSyncingBilling] = useState(false);

  const [chartLoading, setChartLoading] = useState(true);
  const [chartFailed, setChartFailed] = useState(false);
  const [chartReloadKey, setChartReloadKey] = useState(0);
  const chartTimeoutRef = useRef(null);

  const [decisionForm, setDecisionForm] = useState({
    timeframe: "1m",
    session: "New York",
    directionBias: "Short",
    eventType: "SWEEP_CONFIRMED",
    sweepType: "High Sweep",
    emaContext: "EMA99 Rejection",
    leverage: "2x",
    action: "Taken",
    timing: "On Confirmation",
    planFollowed: "Yes",
    ruleBreak: "None",
    disciplineScore: "8",
    setupQuality: "8",
    emotionalPressure: "3",
    confidenceSelf: "7",
    executionType: "Limit Retest",
    liquidityLevel: "Range High",
    htfBias: "Bearish",
    entryTrigger: "Reclaim Failure",
    outcome: "Open",
    durationMinutes: "",
    entry: "",
    stop: "",
    tp1: "",
    tp2: "",
    exit: "",
    pnl: "",
    notes: "",
    screenshot: "",
    screenshotBase64: "",
    screenshotMimeType: "",
  });

  const [loggedDecisions, setLoggedDecisions] = useState([]);
  const [toasts, setToasts] = useState([]);

  const [propAccount, setPropAccount] = useState({
    presetId: "ftmo_like",
    accountSize: 50000,
    phase: "Phase 1",
  });

  const isMountedRef = useRef(true);

  function getToneBorder(tone) {
    if (tone === "long") return "rgba(74, 222, 128, 0.28)";
    if (tone === "short") return "rgba(251, 113, 133, 0.28)";
    return palette.border;
  }

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (chartTimeoutRef.current) clearTimeout(chartTimeoutRef.current);
      for (const entry of loggedDecisions) {
        if (entry?.screenshot && entry.screenshot.startsWith("blob:")) {
          URL.revokeObjectURL(entry.screenshot);
        }
      }
      if (decisionForm?.screenshot && decisionForm.screenshot.startsWith("blob:")) {
        URL.revokeObjectURL(decisionForm.screenshot);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toast(message, type = "info") {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      if (!isMountedRef.current) return;
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2600);
  }

  function isProUser() {
    return ["active", "trialing"].includes(currentUser?.stripeStatus || "");
  }

  function requireFeature(featureKey, message = "Upgrade required.") {
    if (featureFlags?.[featureKey]) return true;
    toast(message, "warn");
    setActiveTab("billing");
    return false;
  }

  useEffect(() => {
    async function loadProfile() {
      try {
        const me = await apiFetch("/me").catch(() => null);
        if (!me) return;

        const profile = me.user || me.profile || me;
        setCurrentUser((prev) => ({
          ...prev,
          email: profile?.email || prev.email,
          billingPlan: profile?.billingPlan || prev.billingPlan,
          stripeStatus: profile?.stripeStatus || prev.stripeStatus,
          stripeCustomerId: profile?.stripeCustomerId || prev.stripeCustomerId,
        }));

        setFeatureFlags({
          manualJournal: true,
          aiReview: Boolean(profile?.featureFlags?.aiReview),
          screenshotReview: Boolean(profile?.featureFlags?.screenshotReview),
          export: Boolean(profile?.featureFlags?.export),
          deeperStats: Boolean(profile?.featureFlags?.deeperStats),
        });
      } catch { }
    }

    loadProfile();
  }, []);

  useEffect(() => {
    async function loadEvents() {
      try {
        const data = await apiFetch("/events").catch(() => []);
        const normalized = normalizeEventsResponse(data);

        setEvents(normalized);
        setSelectedEvent((prev) => {
          if (!prev) return normalized[0] || null;
          const match = normalized.find((evt) => eventKey(evt) === eventKey(prev));
          return match || prev;
        });
      } catch {
        setEvents([]);
      }
    }

    loadEvents();
    const interval = setInterval(loadEvents, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      setDecisionForm((prev) => ({
        ...prev,
        timeframe: selectedEvent?.timeframe || prev.timeframe,
        session: selectedEvent?.session || prev.session,
        directionBias: selectedEvent?.directionBias || prev.directionBias,
        eventType: selectedEvent?.eventType || prev.eventType,
        sweepType: selectedEvent?.sweepType || prev.sweepType,
        emaContext: selectedEvent?.emaContext || prev.emaContext,
        entry: selectedEvent?.entry != null ? String(selectedEvent.entry) : prev.entry,
        stop: selectedEvent?.stop != null ? String(selectedEvent.stop) : prev.stop,
        tp1: selectedEvent?.tp1 != null ? String(selectedEvent.tp1) : prev.tp1,
        tp2: selectedEvent?.tp2 != null ? String(selectedEvent.tp2) : prev.tp2,
      }));
    }
  }, [selectedEvent]);

  useEffect(() => {
    if (chartTimeoutRef.current) clearTimeout(chartTimeoutRef.current);

    setChartLoading(true);
    setChartFailed(false);
    setChartReloadKey((k) => k + 1);

    chartTimeoutRef.current = setTimeout(() => {
      setChartLoading(false);
      setChartFailed(true);
    }, 7000);

    return () => {
      if (chartTimeoutRef.current) clearTimeout(chartTimeoutRef.current);
    };
  }, [selectedEvent?.pair, selectedEvent?.timeframe]);

  const waves = useMemo(() => groupWaves(events), [events]);
  const tickerItems = useMemo(() => bestTickerItems(events, 12), [events]);

  const activePreset = useMemo(() => {
    return PROP_PRESETS.find((p) => p.id === propAccount.presetId) || PROP_PRESETS[0];
  }, [propAccount.presetId]);

  useEffect(() => {
    setPropAccount((prev) => {
      const accountSize = activePreset.accountSizes.includes(prev.accountSize)
        ? prev.accountSize
        : activePreset.accountSizes[0];
      const phase = activePreset.phases.includes(prev.phase)
        ? prev.phase
        : activePreset.phases[0];
      return { ...prev, accountSize, phase };
    });
  }, [activePreset]);

  const advancedStats = useMemo(() => {
    const entries = loggedDecisions;
    if (!entries.length) {
      return {
        topExecution: "—",
        topLiquidity: "—",
        topTrigger: "—",
        topOutcome: "—",
        topHtf: "—",
        avgConfidenceSelf: 0,
      };
    }

    function mostCommon(key) {
      const counts = new Map();
      for (const item of entries) {
        const value = item?.[key];
        if (!value) continue;
        counts.set(value, (counts.get(value) || 0) + 1);
      }
      let winner = "—";
      let max = 0;
      for (const [k, v] of counts.entries()) {
        if (v > max) {
          max = v;
          winner = k;
        }
      }
      return winner;
    }

    const avgConfidenceSelf =
      entries.reduce((sum, item) => sum + (Number(item.confidenceSelf) || 0), 0) /
      Math.max(entries.length, 1);

    return {
      topExecution: mostCommon("executionType"),
      topLiquidity: mostCommon("liquidityLevel"),
      topTrigger: mostCommon("entryTrigger"),
      topOutcome: mostCommon("outcome"),
      topHtf: mostCommon("htfBias"),
      avgConfidenceSelf,
    };
  }, [loggedDecisions]);

  const propStatus = useMemo(() => {
    if (!propAccount.accountSize || activePreset.id === "none") {
      return {
        enabled: false,
        status: "OFF",
        tone: "neutral",
        dailyLoss: 0,
        maxDrawdown: 0,
        target: 0,
        estimatedRisk: 0,
        notes: ["No preset selected."],
      };
    }

    const rules = activePreset.rules;
    const size = Number(propAccount.accountSize) || 0;
    const dailyLoss = size * rules.dailyLossPct;
    const maxDrawdown = size * rules.maxDrawdownPct;
    const target = size * rules.profitTargetPct;

    const entry = Number(decisionForm.entry);
    const stop = Number(decisionForm.stop);
    let estimatedRisk = Math.abs(entry - stop);

    if (!Number.isFinite(estimatedRisk) || estimatedRisk <= 0) {
      estimatedRisk = size * 0.0025;
    }

    const notes = [];
    const dailyUsage = dailyLoss ? estimatedRisk / dailyLoss : 0;
    const totalUsage = maxDrawdown ? estimatedRisk / maxDrawdown : 0;

    let status = "PASS";
    let tone = "long";

    if (dailyUsage > 0.75 || totalUsage > 0.4) {
      status = "FAIL RISK";
      tone = "short";
    } else if (dailyUsage > 0.35 || totalUsage > 0.2) {
      status = "WARNING";
      tone = "gold";
    }

    if (dailyUsage > 0.35) notes.push("Trade uses a large part of daily loss allowance.");
    if (totalUsage > 0.2) notes.push("Trade risk is heavy relative to max drawdown.");
    if (!rules.weekendHolding) notes.push("This preset should avoid weekend holds.");
    if (!notes.length) notes.push("Risk profile looks workable if execution stays disciplined.");

    return {
      enabled: true,
      status,
      tone,
      dailyLoss,
      maxDrawdown,
      target,
      estimatedRisk,
      notes,
    };
  }, [activePreset, propAccount.accountSize, decisionForm.entry, decisionForm.stop]);

  const chartInfo = getChartInfo(selectedEvent?.pair);
  const chartSrc = `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(
    chartInfo.tvSymbol
  )}&interval=${getTvInterval(selectedEvent?.timeframe)}&hidesidetoolbar=1&symboledit=1&saveimage=1&toolbarbg=0a0f18&theme=dark&style=1&withdateranges=1&hideideas=1`;

  const selectedEventRR = useMemo(() => {
    return calcPlannedRR(
      selectedEvent?.entry,
      selectedEvent?.stop,
      selectedEvent?.tp1,
      selectedEvent?.tp2,
      selectedEvent?.rr1,
      selectedEvent?.rr2
    );
  }, [selectedEvent]);

  const decisionRealizedRR = useMemo(() => {
    return calcRealizedRR(
      decisionForm.directionBias,
      decisionForm.entry,
      decisionForm.stop,
      decisionForm.exit
    );
  }, [decisionForm.directionBias, decisionForm.entry, decisionForm.stop, decisionForm.exit]);

  function updateDecision(field, value) {
    setDecisionForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleScreenshotUpload(event) {
    if (!requireFeature("screenshotReview", "Upgrade required for screenshot review.")) {
      if (event?.target) event.target.value = "";
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    if (decisionForm.screenshot && decisionForm.screenshot.startsWith("blob:")) {
      URL.revokeObjectURL(decisionForm.screenshot);
    }

    const objectUrl = URL.createObjectURL(file);
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const commaIndex = result.indexOf(",");
      const base64 = commaIndex >= 0 ? result.slice(commaIndex + 1) : "";

      setDecisionForm((prev) => ({
        ...prev,
        screenshot: objectUrl,
        screenshotBase64: base64,
        screenshotMimeType: file.type || "image/png",
      }));
    };
    reader.readAsDataURL(file);
  }

  function retryChart() {
    if (chartTimeoutRef.current) clearTimeout(chartTimeoutRef.current);
    setChartLoading(true);
    setChartFailed(false);
    setChartReloadKey((k) => k + 1);
    chartTimeoutRef.current = setTimeout(() => {
      setChartLoading(false);
      setChartFailed(true);
    }, 7000);
  }

  function selectWaveHead(wave) {
    const head = wave?.events?.[0];
    if (head) setSelectedEvent(head);
  }

  async function syncBilling() {
    try {
      setSyncingBilling(true);
      const data = await apiFetch("/billing/status");
      const billing = data?.billing || data || {};
      setCurrentUser((prev) => ({
        ...prev,
        billingPlan: billing?.billingPlan || prev.billingPlan,
        stripeStatus: billing?.billingStatus || prev.stripeStatus,
        stripeCustomerId: billing?.stripeCustomerId || prev.stripeCustomerId,
      }));
      if (billing?.featureFlags) {
        setFeatureFlags({
          manualJournal: true,
          aiReview: Boolean(billing.featureFlags.aiReview),
          screenshotReview: Boolean(billing.featureFlags.screenshotReview),
          export: Boolean(billing.featureFlags.export),
          deeperStats: Boolean(billing.featureFlags.deeperStats),
        });
      }
      toast("Billing synced", "success");
    } catch (err) {
      toast(err.message || "Billing sync failed", "warn");
    } finally {
      setSyncingBilling(false);
    }
  }

  async function openPortal() {
    try {
      const data = await apiFetch("/billing/create-portal-session", { method: "POST" });
      if (data?.url) window.location.href = data.url;
    } catch (err) {
      toast(err.message || "Unable to open portal", "warn");
    }
  }

  function handleExportLogs() {
    if (!requireFeature("export", "Upgrade required for exporting logs.")) return;
    const payload = JSON.stringify(loggedDecisions, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "liquidity-lab-logs.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function saveDecision() {
    const aiEnabled = Boolean(featureFlags.aiReview);

    const payload = {
      pair: selectedEvent?.pair || "Manual",
      timeframe: decisionForm.timeframe,
      session: decisionForm.session,
      directionBias: decisionForm.directionBias,
      eventType: decisionForm.eventType,
      sweepType: decisionForm.sweepType,
      emaContext: decisionForm.emaContext,
      leverage: decisionForm.leverage,
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
      durationMinutes: Number(decisionForm.durationMinutes) || 0,
      entry: Number(decisionForm.entry) || null,
      stop: Number(decisionForm.stop) || null,
      tp1: Number(decisionForm.tp1) || null,
      tp2: Number(decisionForm.tp2) || null,
      exit: Number(decisionForm.exit) || null,
      pnl: Number(decisionForm.pnl) || null,
      notes: decisionForm.notes,
      screenshotUrl: decisionForm.screenshot,
      screenshotBase64: decisionForm.screenshotBase64,
      screenshotMimeType: decisionForm.screenshotMimeType,
      linkedEventId: logMode === "event" ? selectedEvent?.id || null : null,
      linkedRadarEvent: logMode === "event" && selectedEvent ? { ...selectedEvent } : null,
      reclaimConfirmed: Boolean(selectedEvent?.reclaimConfirmed),
      aiRequested: aiEnabled,
    };

    let serverAi = {};
    try {
      const response = await apiFetch("/logs", {
        method: "POST",
        body: JSON.stringify(payload),
      }).catch(() => null);

      serverAi = response?.analysis || response?.ai || {};
    } catch {
      serverAi = {};
    }

    const baseEntry = {
      id: `${Date.now()}_${Math.random()}`,
      timestamp: new Date().toISOString(),
      pair: payload.pair,
      timeframe: payload.timeframe,
      session: payload.session,
      directionBias: payload.directionBias,
      eventType: payload.eventType,
      sweepType: payload.sweepType,
      emaContext: payload.emaContext,
      action: payload.action,
      timing: payload.timing,
      planFollowed: payload.planFollowed,
      ruleBreak: payload.ruleBreak,
      disciplineScore: payload.disciplineScore,
      setupQuality: payload.setupQuality,
      emotionalPressure: payload.emotionalPressure,
      confidenceSelf: payload.confidenceSelf,
      executionType: payload.executionType,
      liquidityLevel: payload.liquidityLevel,
      htfBias: payload.htfBias,
      entryTrigger: payload.entryTrigger,
      outcome: payload.outcome,
      durationMinutes: payload.durationMinutes,
      entry: payload.entry,
      stop: payload.stop,
      tp1: payload.tp1,
      tp2: payload.tp2,
      rr1: calcPlannedRR(payload.entry, payload.stop, payload.tp1, payload.tp2, selectedEvent?.rr1, selectedEvent?.rr2).rr1,
      rr2: calcPlannedRR(payload.entry, payload.stop, payload.tp1, payload.tp2, selectedEvent?.rr1, selectedEvent?.rr2).rr2,
      exit: payload.exit,
      realizedRR: calcRealizedRR(payload.directionBias, payload.entry, payload.stop, payload.exit),
      pnl: payload.pnl,
      notes: payload.notes,
      screenshot: payload.screenshotUrl,
      aiStatus: "complete",
      aiScore: serverAi?.score ?? null,
      aiGrade: serverAi?.grade ?? null,
      aiSummary: serverAi?.summary || "Trade logged.",
      aiCoachingNote:
        serverAi?.coachingNote || "Continue following your rules and review recurring patterns.",
      setupScore: serverAi?.setupScore ?? null,
      executionScore: serverAi?.executionScore ?? null,
      managementScore: serverAi?.managementScore ?? null,
      chartRead: serverAi?.chartRead || "",
      setupAssessment: serverAi?.setupAssessment || "",
      executionAssessment: serverAi?.executionAssessment || "",
      riskAssessment: serverAi?.riskAssessment || "",
      biasAlignment: serverAi?.biasAlignment || "",
      mistakeTags: serverAi?.mistakeTags || [],
      whatWasGood: serverAi?.whatWasGood || [],
      whatNeedsWork: serverAi?.whatNeedsWork || [],
      usedScreenshot: Boolean(payload.screenshotUrl),
    };

    const finalEntry = aiEnabled
      ? baseEntry
      : {
        ...baseEntry,
        aiStatus: "locked",
        aiScore: null,
        aiGrade: null,
        aiSummary: "AI Review is locked on the current plan.",
        aiCoachingNote: "Upgrade in Billing to unlock AI trade review and coaching.",
        setupScore: null,
        executionScore: null,
        managementScore: null,
        chartRead: "",
        setupAssessment: "",
        executionAssessment: "",
        riskAssessment: "",
        biasAlignment: "",
        mistakeTags: [],
        whatWasGood: [],
        whatNeedsWork: [],
        usedScreenshot: false,
      };

    setLoggedDecisions((prev) => [finalEntry, ...prev].slice(0, 60));
    toast("Decision logged", "success");
  }

  function updateProp(field, value) {
    if (!featureFlags.deeperStats) {
      toast("Upgrade required for Prop Challenge Mode controls.", "warn");
      setActiveTab("billing");
      return;
    }
    setPropAccount((prev) => ({
      ...prev,
      [field]: typeof prev[field] === "number" ? Number(value) || 0 : value,
    }));
  }

  const displayDecisions = showInsights ? loggedDecisions : loggedDecisions.slice(0, 3);

  if (!betaUnlocked) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#03060b",
          color: "#fff",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div
          style={{
            width: 340,
            maxWidth: "calc(100vw - 32px)",
            padding: 20,
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(10,14,24,0.95)",
            boxShadow: "0 18px 42px rgba(0,0,0,0.45)",
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 20 }}>
            Private Beta Access
          </div>

          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.72)" }}>
            Enter your beta code to unlock Liquidity Lab
          </div>

          <input
            value={betaInput}
            onChange={(e) => setBetaInput(e.target.value)}
            placeholder="Enter beta code"
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px solid #333",
              background: "#0b0f1a",
              color: "#fff",
              outline: "none",
            }}
          />

          <button
            onClick={() => {
              if (betaInput.trim() === BETA_ACCESS_CODE) {
                localStorage.setItem("beta_access", "granted");
                setBetaUnlocked(true);
              } else {
                alert("Invalid beta code");
              }
            }}
            style={{
              padding: 12,
              borderRadius: 12,
              background: "#ef4444",
              color: "#fff",
              border: "none",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Enter Beta
          </button>
        </div>
      </div>
    );
  }


  if (activeTab === "billing") {
    return (
      <div style={styles.app}>
        <div style={styles.shell}>
          <BillingPlaceholder
            currentUser={currentUser}
            featureFlags={featureFlags}
            syncingBilling={syncingBilling}
            onSyncBilling={syncBilling}
            onOpenPortal={openPortal}
            onBack={() => setActiveTab("dashboard")}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <style>{`
        @keyframes scrollTicker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .radar-wave-card {
          transition: transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease, background 140ms ease;
          will-change: transform;
        }

        .radar-wave-card:hover {
          transform: translateY(-3px) scale(1.013);
          box-shadow: 0 22px 38px rgba(0,0,0,0.38);
          border-color: rgba(255,255,255,0.18) !important;
        }

        .radar-wave-head {
          transition: background 140ms ease;
        }

        .radar-wave-card:hover .radar-wave-head {
          background: linear-gradient(180deg, rgba(21,28,43,0.82), rgba(14,19,31,0.82));
        }

        .radar-incident-card {
          transition: transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
        }

        .radar-incident-card:hover {
          transform: translateY(-1px);
          border-color: rgba(255,255,255,0.16) !important;
          box-shadow: 0 10px 24px rgba(0,0,0,0.22);
        }
        .radar-wave-actions button {
          transition: transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease;
        }

        .radar-wave-actions button:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 22px rgba(0,0,0,0.26);
          border-color: rgba(255,255,255,0.16);
        }

        @media (max-width: 1400px) {
          .app-main-grid { grid-template-columns: 360px minmax(420px, 1fr) 320px !important; }
        }
        @media (max-width: 1160px) {
          .app-stats-row { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .app-main-grid { grid-template-columns: 1fr !important; }
          .app-journal-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 860px) {
          .app-journal-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 640px) {
          .app-stats-row { grid-template-columns: 1fr !important; }
          .app-journal-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={styles.shell}>
        <section style={styles.topbar}>
          <div style={styles.topbarRow}>
            <div style={styles.brandWrap}>
              <div style={styles.brandIcon}>⦿</div>
              <div style={{ display: "grid", gap: 2 }}>
                <div
                  style={{
                    fontSize: 10,
                    color: palette.textDim,
                    letterSpacing: 3,
                    textTransform: "uppercase",
                  }}
                >
                  Red October Systems
                </div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>LIQUIDITY LAB</div>
                <div style={{ fontSize: 12, color: palette.textSoft }}>
                  Institutional sweep intelligence and behavior engine
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button
                style={logMode === "event" ? styles.primaryButton : styles.button}
                onClick={() => setLogMode("event")}
                type="button"
              >
                Event Mode
              </button>
              <button
                style={logMode === "manual" ? styles.primaryButton : styles.button}
                onClick={() => setLogMode("manual")}
                type="button"
              >
                Manual Mode
              </button>

              <button
                style={
                  activeTab === "billing"
                    ? styles.primaryButton
                    : isProUser()
                      ? styles.button
                      : {
                        ...styles.button,
                        border: "1px solid rgba(255,26,26,0.25)",
                        boxShadow: "0 0 18px rgba(255,26,26,0.10)",
                      }
                }
                onClick={() => setActiveTab("billing")}
                type="button"
              >
                {isProUser() ? "PRO" : "Upgrade"}
              </button>

              <Pill tone={isProUser() ? "long" : "gold"}>
                {currentUser?.billingPlan || "starter"}
              </Pill>
              <div style={{ fontSize: 13, color: palette.textSoft }}>{currentUser.email}</div>
            </div>
          </div>

          <div
            style={{
              overflow: "hidden",
              borderRadius: 16,
              border: `1px solid ${palette.border}`,
              background: "linear-gradient(180deg, rgba(8,12,20,0.96), rgba(6,9,16,0.98))",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 10,
                width: "max-content",
                padding: "9px 12px",
                animation: "scrollTicker 34s linear infinite",
              }}
            >
              {[...tickerItems, ...tickerItems].map((item, i) => (
                <div
                  key={`${eventKey(item)}_${i}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    whiteSpace: "nowrap",
                    padding: "7px 11px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 800,
                    color:
                      directionTone(item.directionBias) === "long"
                        ? palette.long
                        : directionTone(item.directionBias) === "short"
                          ? palette.short
                          : palette.textSoft,
                    background:
                      directionTone(item.directionBias) === "long"
                        ? palette.longSoft
                        : directionTone(item.directionBias) === "short"
                          ? palette.shortSoft
                          : "rgba(255,255,255,0.04)",
                    border: `1px solid ${palette.border}`,
                  }}
                >
                  <span>{item.pair}</span>
                  <span style={{ opacity: 0.45 }}>•</span>
                  <span>{item.eventType}</span>
                  <span style={{ opacity: 0.45 }}>•</span>
                  <span>{item.timeframe}</span>
                  <span style={{ opacity: 0.45 }}>•</span>
                  <span>{pct(item.botConfidence || 0, 0)}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={styles.statsRow} className="app-stats-row">
            <MiniBox label="Live Events" value={events.length} />
            <MiniBox label="Wave Clusters" value={waves.length} />
            <MiniBox
              label="Long Bias"
              value={events.filter((e) => directionTone(e.directionBias) === "long").length}
            />
            <MiniBox
              label="Short Bias"
              value={events.filter((e) => directionTone(e.directionBias) === "short").length}
            />
          </div>
        </section>

        <section style={styles.mainGrid} className="app-main-grid">
          <aside style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 15 }}>Radar Feed</div>
                <div style={styles.subtext}>Strategy engine and wave flow</div>
              </div>
              <Pill>{waves.length} groups</Pill>
            </div>

            <div style={styles.panelBody}>
              <div style={styles.radarList}>
                {waves.length === 0 ? (
                  <div style={{ ...styles.panel, boxShadow: "none" }}>
                    <div style={styles.panelBody}>Waiting for sweeps.</div>
                  </div>
                ) : (
                  waves.map((wave) => {
                    const tone = directionTone(wave.directionBias);
                    const selectedWave = selectedEvent && buildWaveKey(selectedEvent) === wave.key;
                    const isExpanded = !!expandedWaves[wave.key];
                    const borderColor = getToneBorder(tone);
                    const headEvent = wave?.events?.[0] || {};
                    const waveRr1 = Number(headEvent?.rr1);
                    const waveRr2 = Number(headEvent?.rr2);
                    const latestTs = parseEventDate(wave.timestampUtc)?.getTime() || 0;
                    const minutesAgo = latestTs ? Math.max(0, Math.round((Date.now() - latestTs) / 60000)) : null;
                    const isFresh = minutesAgo != null && minutesAgo <= 5;
                    const glowShadow =
                      tone === "long"
                        ? "0 0 0 1px rgba(74,222,128,0.08) inset, 0 10px 24px rgba(0,0,0,0.22)"
                        : tone === "short"
                          ? "0 0 0 1px rgba(251,113,133,0.08) inset, 0 10px 24px rgba(0,0,0,0.22)"
                          : "0 10px 24px rgba(0,0,0,0.22)";

                    return (
                      <div
                        key={wave.key}
                        className="radar-wave-card"
                        style={{
                          ...styles.waveCard,
                          border:
                            selectedWave || isExpanded
                              ? `1px solid ${borderColor}`
                              : styles.waveCard.border,
                          boxShadow: selectedWave
                            ? `0 0 0 1px ${borderColor} inset, ${glowShadow}`
                            : glowShadow,
                        }}
                      >
                        <div
                          className="radar-wave-head"
                          style={{
                            padding: 12,
                            display: "grid",
                            gap: 8,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 8,
                              alignItems: "start",
                            }}
                          >
                            <div style={{ display: "grid", gap: 4 }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  flexWrap: "wrap",
                                }}
                              >
                                <div style={{ fontWeight: 900, fontSize: 15 }}>{wave.pair}</div>
                                <Pill tone="gold">{wave.count > 1 ? `x${wave.count}` : "L1"}</Pill>
                                <Pill tone={tone === "neutral" ? "gold" : tone}>
                                  {wave.directionBias}
                                </Pill>
                              </div>

                              <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.1 }}>
                                {wave.sweepType}
                              </div>

                              <div style={{ fontSize: 13, color: palette.textSoft, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                                <span>{wave.eventType}</span>
                                {isFresh ? <Pill tone={tone === "neutral" ? "gold" : tone}>fresh</Pill> : null}
                              </div>
                            </div>

                            <div style={{ fontSize: 11, color: palette.textDim, whiteSpace: "nowrap", display: "grid", justifyItems: "end", gap: 4 }}>
                              <div>{formatTimeOnly(wave.timestampUtc)}</div>
                              <div style={{ color: palette.textDim }}>{minutesAgo == null ? "—" : `${minutesAgo}m ago`}</div>
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <Pill>{wave.timeframe}</Pill>
                            <Pill>{wave.session}</Pill>
                            <Pill tone={tone === "neutral" ? "gold" : tone}>
                              {pct(wave.avgConfidence, 0)}
                            </Pill>
                            {Number.isFinite(waveRr1) ? <Pill tone="gold">RR1 {waveRr1.toFixed(2)}</Pill> : null}
                            {Number.isFinite(waveRr2) ? <Pill tone="gold">RR2 {waveRr2.toFixed(2)}</Pill> : null}
                          </div>

                          <div
                            style={{
                              height: 6,
                              borderRadius: 999,
                              background: "rgba(255,255,255,0.06)",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${Math.max(
                                  8,
                                  Math.min(100, Math.round(wave.avgConfidence * 100))
                                )}%`,
                                borderRadius: 999,
                                background:
                                  tone === "long"
                                    ? "linear-gradient(90deg, #22c55e, #86efac)"
                                    : tone === "short"
                                      ? "linear-gradient(90deg, #ef4444, #fda4af)"
                                      : "linear-gradient(90deg, #64748b, #cbd5e1)",
                              }}
                            />
                          </div>

                          <div style={{ fontSize: 11, color: palette.textDim }}>
                            Latest incident: {formatDateTime(wave.timestampUtc)}
                          </div>

                          <div
                            className="radar-wave-actions"
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 8,
                              paddingTop: 10,
                              marginTop: 4,
                              position: "relative",
                              zIndex: 3,
                            }}
                          >
                            <button
                              type="button"
                              style={{
                                ...styles.button,
                                padding: "6px 10px",
                                borderRadius: 10,
                                fontSize: 11,
                              }}
                              onClick={() => selectWaveHead(wave)}
                            >
                              Load setup
                            </button>

                            <button
                              type="button"
                              style={{
                                ...styles.button,
                                padding: "6px 10px",
                                borderRadius: 10,
                                fontSize: 11,
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedWaves((prev) => ({
                                  ...prev,
                                  [wave.key]: !prev[wave.key],
                                }));
                              }}
                            >
                              {isExpanded ? "Hide incidents" : "Show incidents"}
                            </button>
                          </div>
                        </div>

                        {isExpanded ? (
                          <div style={styles.expandedList}>
                            {wave.events.map((evt, idx) => {
                              const evtTone = directionTone(evt?.directionBias);
                              const isSelected = eventKey(selectedEvent) === eventKey(evt);

                              return (
                                <button
                                  key={evt?.id || `${wave.key}_${idx}`}
                                  type="button"
                                  className="radar-incident-card"
                                  style={{
                                    ...cardButtonReset,
                                    borderRadius: 14,
                                    border: isSelected
                                      ? `1px solid ${getToneBorder(evtTone)}`
                                      : `1px solid ${palette.border}`,
                                    background: "linear-gradient(180deg, rgba(16,22,35,0.94), rgba(11,16,27,0.94))",
                                    color: palette.text,
                                    padding: 10,
                                    display: "grid",
                                    gap: 8,
                                  }}
                                  onClick={() => setSelectedEvent(evt)}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      gap: 8,
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <div style={{ fontWeight: 800 }}>
                                      {evt?.eventType || "Sweep event"}
                                    </div>
                                    <Pill tone={evtTone === "neutral" ? "gold" : evtTone}>
                                      {evt?.directionBias || "Neutral"}
                                    </Pill>
                                  </div>

                                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                    <Pill>{evt?.timeframe || "—"}</Pill>
                                    <Pill>{evt?.sweepType || "Sweep"}</Pill>
                                    <Pill>{evt?.session || "—"}</Pill>
                                    <Pill tone={evtTone === "neutral" ? "gold" : evtTone}>
                                      {pct(evt?.botConfidence || 0, 0)}
                                    </Pill>
                                    <Pill>RR1 {rr_text_js(calcPlannedRR(evt?.entry, evt?.stop, evt?.tp1, evt?.tp2, evt?.rr1, evt?.rr2).rr1)}</Pill>
                                    <Pill>RR2 {rr_text_js(calcPlannedRR(evt?.entry, evt?.stop, evt?.tp1, evt?.tp2, evt?.rr1, evt?.rr2).rr2)}</Pill>
                                  </div>

                                  <div
                                    style={{
                                      display: "grid",
                                      gap: 4,
                                      fontSize: 12,
                                      color: palette.textSoft,
                                    }}
                                  >
                                    <div>
                                      <strong style={{ color: palette.text }}>EMA Context:</strong>{" "}
                                      {evt?.emaContext || "—"}
                                    </div>
                                    <div>
                                      <strong style={{ color: palette.text }}>
                                        Reclaim Confirmed:
                                      </strong>{" "}
                                      {evt?.reclaimConfirmed ? "Yes" : "No"}
                                    </div>
                                    <div>
                                      <strong style={{ color: palette.text }}>Entry:</strong>{" "}
                                      {num(evt?.entry)}
                                    </div>
                                    <div>
                                      <strong style={{ color: palette.text }}>Stop:</strong>{" "}
                                      {num(evt?.stop)}
                                    </div>
                                    <div>
                                      <strong style={{ color: palette.text }}>TP1:</strong>{" "}
                                      {num(evt?.tp1)}
                                    </div>
                                    <div>
                                      <strong style={{ color: palette.text }}>TP2:</strong>{" "}
                                      {num(evt?.tp2)}
                                    </div>
                                  </div>

                                  <div style={{ fontSize: 11, color: palette.textDim }}>
                                    {formatDateTime(evt?.timestampUtc)}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </aside>

          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 15 }}>
                  {selectedEvent?.pair || "Select event"}
                </div>
                <div style={styles.subtext}>
                  {selectedEvent
                    ? `${selectedEvent?.sweepType || selectedEvent?.eventType || "Sweep"} • ${selectedEvent?.timeframe || "—"
                    } • ${selectedEvent?.directionBias || "Neutral"} • ${formatDateTime(
                      selectedEvent?.timestampUtc
                    )}`
                    : "Choose an event from the radar feed."}
                </div>
              </div>
              {selectedEvent ? (
                <Pill
                  tone={
                    directionTone(selectedEvent.directionBias) === "neutral"
                      ? "gold"
                      : directionTone(selectedEvent.directionBias)
                  }
                >
                  {selectedEvent.directionBias || "Neutral"}
                </Pill>
              ) : null}
            </div>

            <div style={styles.chartFrame}>
              {selectedEvent ? (
                <>
                  <iframe
                    key={chartReloadKey}
                    title="TradingView Chart"
                    src={chartSrc}
                    width="100%"
                    height="100%"
                    style={{ border: "none" }}
                    onLoad={() => {
                      if (chartTimeoutRef.current) clearTimeout(chartTimeoutRef.current);
                      setChartLoading(false);
                      setChartFailed(false);
                    }}
                    onError={() => {
                      if (chartTimeoutRef.current) clearTimeout(chartTimeoutRef.current);
                      setChartLoading(false);
                      setChartFailed(true);
                    }}
                  />

                  {chartLoading ? (
                    <div
                      style={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        zIndex: 2,
                        padding: "8px 10px",
                        borderRadius: 12,
                        border: `1px solid ${palette.border}`,
                        background: "rgba(7,10,18,0.88)",
                        fontSize: 11,
                        color: palette.textSoft,
                      }}
                    >
                      Loading chart...
                    </div>
                  ) : null}

                  {chartFailed ? (
                    <>
                      <div
                        style={{
                          position: "absolute",
                          top: 10,
                          right: 10,
                          zIndex: 2,
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          padding: "8px 10px",
                          borderRadius: 12,
                          border: `1px solid ${palette.border}`,
                          background: "rgba(7,10,18,0.88)",
                        }}
                      >
                        <button
                          type="button"
                          style={{ ...styles.button, padding: "7px 10px" }}
                          onClick={retryChart}
                        >
                          Retry
                        </button>
                        <a
                          href={chartInfo.tradingViewUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ textDecoration: "none" }}
                        >
                          <button type="button" style={{ ...styles.button, padding: "7px 10px" }}>
                            TradingView
                          </button>
                        </a>
                        <a
                          href={chartInfo.blofinUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ textDecoration: "none" }}
                        >
                          <button type="button" style={{ ...styles.button, padding: "7px 10px" }}>
                            BloFin
                          </button>
                        </a>
                      </div>

                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "grid",
                          placeItems: "center",
                          padding: 24,
                          background:
                            "linear-gradient(180deg, rgba(3,6,11,0.58), rgba(3,6,11,0.78))",
                        }}
                      >
                        <div
                          style={{
                            width: "min(420px, 100%)",
                            padding: 18,
                            borderRadius: 18,
                            border: `1px solid ${palette.border}`,
                            background:
                              "linear-gradient(180deg, rgba(17,22,34,0.98), rgba(10,14,24,0.98))",
                            boxShadow: "0 14px 32px rgba(0,0,0,0.38)",
                            display: "grid",
                            gap: 10,
                            textAlign: "center",
                          }}
                        >
                          <div style={{ fontSize: 18, fontWeight: 900 }}>
                            Chart temporarily unavailable
                          </div>
                          <div style={styles.subtext}>
                            Setup context is still live. Open the market directly while the embed is unstable.
                          </div>
                        </div>
                      </div>
                    </>
                  ) : null}
                </>
              ) : (
                <div
                  style={{
                    height: "100%",
                    display: "grid",
                    placeItems: "center",
                    color: palette.textSoft,
                  }}
                >
                  Waiting for chart selection
                </div>
              )}
            </div>

            <div
              style={{
                padding: 12,
                borderTop: `1px solid ${palette.borderSoft}`,
                display: "grid",
                gap: 10,
              }}
            >
              {!featureFlags.screenshotReview ? (
                <div
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    border: `1px solid ${palette.border}`,
                    background: "rgba(255,255,255,0.02)",
                    color: palette.textSoft,
                    fontSize: 12,
                  }}
                >
                  Screenshot Review is a Pro feature. Upgrade in Billing to attach and review screenshots.
                </div>
              ) : null}

              <div
                style={{
                  borderRadius: 14,
                  border: `1px solid ${palette.border}`,
                  background: "rgba(255,255,255,0.03)",
                  padding: 10,
                }}
              >
                <input type="file" accept="image/*" onChange={handleScreenshotUpload} />
                <div style={{ marginTop: 8, fontSize: 12, color: palette.textSoft }}>
                  Screenshot: {decisionForm.screenshot ? "Attached" : "None"}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" style={styles.primaryButton} onClick={saveDecision}>
                  Log Trade / Apply Result
                </button>
                <a
                  href={chartInfo.blofinUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ textDecoration: "none" }}
                >
                  <button type="button" style={styles.button}>
                    Open on BloFin
                  </button>
                </a>
                <button
                  type="button"
                  style={styles.button}
                  onClick={() => {
                    if (!requireFeature("aiReview", "Upgrade required for AI review.")) return;
                    toast("AI review will run on saved logs.", "success");
                  }}
                >
                  Run AI Review
                </button>
              </div>
            </div>
          </section>

          <aside style={{ display: "grid", gap: 12 }}>
            <section style={styles.panel}>
              <div style={styles.panelHeader}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 15 }}>Prop Challenge Mode</div>
                  <div style={styles.subtext}>Optional training overlay</div>
                </div>
                <Pill>{activePreset.firm}</Pill>
              </div>

              <div style={styles.panelBody}>
                <div style={{ display: "grid", gap: 10 }}>
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        color: palette.textDim,
                        marginBottom: 6,
                        textTransform: "uppercase",
                      }}
                    >
                      Preset
                    </div>
                    <select
                      style={fieldStyle}
                      value={propAccount.presetId}
                      onChange={(e) => updateProp("presetId", e.target.value)}
                    >
                      {PROP_PRESETS.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: 8,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          color: palette.textDim,
                          marginBottom: 6,
                          textTransform: "uppercase",
                        }}
                      >
                        Account Size
                      </div>
                      <select
                        style={fieldStyle}
                        value={propAccount.accountSize}
                        onChange={(e) => updateProp("accountSize", Number(e.target.value))}
                      >
                        {activePreset.accountSizes.map((size) => (
                          <option key={size} value={size}>
                            {size === 0 ? "Off" : `$${size.toLocaleString()}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          color: palette.textDim,
                          marginBottom: 6,
                          textTransform: "uppercase",
                        }}
                      >
                        Phase
                      </div>
                      <select
                        style={fieldStyle}
                        value={propAccount.phase}
                        onChange={(e) => updateProp("phase", e.target.value)}
                      >
                        {activePreset.phases.map((phase) => (
                          <option key={phase} value={phase}>
                            {phase}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: 12,
                    borderRadius: 16,
                    border: `1px solid ${palette.border}`,
                    background: palette.card,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: 14 }}>Challenge Status</div>
                  <Pill tone={propStatus.tone}>{propStatus.status}</Pill>
                  <div style={styles.subtext}>
                    <strong>Profit Target:</strong> {money(propStatus.target)}
                  </div>
                  <div style={styles.subtext}>
                    <strong>Daily Loss Limit:</strong> {money(propStatus.dailyLoss)}
                  </div>
                  <div style={styles.subtext}>
                    <strong>Max Drawdown:</strong> {money(propStatus.maxDrawdown)}
                  </div>
                  <div style={styles.subtext}>
                    <strong>Est. Trade Risk:</strong> {money(propStatus.estimatedRisk)}
                  </div>
                </div>

                {!featureFlags.deeperStats ? (
                  <div
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      border: `1px solid ${palette.border}`,
                      background: "rgba(255,255,255,0.02)",
                      color: palette.textSoft,
                      fontSize: 12,
                    }}
                  >
                    Advanced Prop controls are available on Pro.
                  </div>
                ) : null}
              </div>
            </section>

            <section style={styles.panel}>
              <div style={styles.panelHeader}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 15 }}>Active Setup Snapshot</div>
                  <div style={styles.subtext}>Current context, not full journal</div>
                </div>
                <Pill>{selectedEvent ? "loaded" : "idle"}</Pill>
              </div>

              <div style={styles.panelBody}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 8,
                  }}
                >
                  <MiniBox label="Pair" value={selectedEvent?.pair || "—"} />
                  <MiniBox label="Timeframe" value={selectedEvent?.timeframe || "—"} />
                  <MiniBox label="Direction" value={selectedEvent?.directionBias || "Neutral"} />
                  <MiniBox label="Confidence" value={pct(selectedEvent?.botConfidence || 0, 0)} />
                  <MiniBox label="Entry" value={num(selectedEvent?.entry)} />
                  <MiniBox label="Stop" value={num(selectedEvent?.stop)} />
                </div>
              </div>
            </section>
          </aside>
        </section>

        <section style={styles.journalShell}>
          <div style={styles.journalHeader}>
            <div style={{ display: "grid", gap: 3 }}>
              <div style={{ fontSize: 17, fontWeight: 900 }}>Behavior Engine Journal</div>
              <div style={styles.subtext}>
                This is the core product surface: execution review, screenshots, AI breakdown, and repeat-pattern tracking.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <Pill>{loggedDecisions.length} logs</Pill>
              <button
                style={styles.button}
                onClick={() => setJournalExpanded((v) => !v)}
                type="button"
              >
                {journalExpanded ? "Compress Journal" : "Expand Journal"}
              </button>
              <button style={styles.button} onClick={handleExportLogs} type="button">
                Export Logs
              </button>
            </div>
          </div>

          <div style={{ padding: 12, display: "grid", gap: 12 }}>
            {!featureFlags.aiReview ? (
              <div
                style={{
                  padding: 10,
                  borderRadius: 12,
                  border: `1px solid ${palette.border}`,
                  background: "rgba(255,255,255,0.02)",
                  color: palette.textSoft,
                  fontSize: 12,
                }}
              >
                AI Review is a Pro feature. Upgrade in Billing to unlock grading, coaching, and screenshot-based review.
              </div>
            ) : null}

            {journalExpanded ? (
              <div
                style={{
                  border: `1px solid ${palette.border}`,
                  background: palette.card,
                  borderRadius: 18,
                  padding: 14,
                  display: "grid",
                  gap: 12,
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 16 }}>Journal Entry Form</div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 10,
                  }}
                  className="app-journal-grid"
                >
                  <div>
                    <div style={{ fontSize: 11, color: palette.textDim, marginBottom: 6 }}>
                      Action
                    </div>
                    <select
                      value={decisionForm.action}
                      onChange={(e) => updateDecision("action", e.target.value)}
                      style={fieldStyle}
                    >
                      <option>Taken</option>
                      <option>Skipped</option>
                      <option>Missed</option>
                    </select>
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: palette.textDim, marginBottom: 6 }}>
                      Timing
                    </div>
                    <select
                      value={decisionForm.timing}
                      onChange={(e) => updateDecision("timing", e.target.value)}
                      style={fieldStyle}
                    >
                      <option>On Confirmation</option>
                      <option>Early</option>
                      <option>Late</option>
                    </select>
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: palette.textDim, marginBottom: 6 }}>
                      Plan Followed
                    </div>
                    <select
                      value={decisionForm.planFollowed}
                      onChange={(e) => updateDecision("planFollowed", e.target.value)}
                      style={fieldStyle}
                    >
                      <option>Yes</option>
                      <option>No</option>
                      <option>Partial</option>
                    </select>
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: palette.textDim, marginBottom: 6 }}>
                      Rule Break
                    </div>
                    <input
                      value={decisionForm.ruleBreak}
                      onChange={(e) => updateDecision("ruleBreak", e.target.value)}
                      style={fieldStyle}
                      placeholder="None"
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: palette.textDim, marginBottom: 6 }}>
                      Outcome
                    </div>
                    <select
                      value={decisionForm.outcome}
                      onChange={(e) => updateDecision("outcome", e.target.value)}
                      style={fieldStyle}
                    >
                      <option>Open</option>
                      <option>Win</option>
                      <option>Loss</option>
                      <option>Breakeven</option>
                    </select>
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: palette.textDim, marginBottom: 6 }}>
                      PnL
                    </div>
                    <input
                      value={decisionForm.pnl}
                      onChange={(e) => updateDecision("pnl", e.target.value)}
                      style={fieldStyle}
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: palette.textDim, marginBottom: 6 }}>
                      Discipline Score
                    </div>
                    <input
                      value={decisionForm.disciplineScore}
                      onChange={(e) => updateDecision("disciplineScore", e.target.value)}
                      style={fieldStyle}
                      placeholder="1-10"
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: palette.textDim, marginBottom: 6 }}>
                      Setup Quality
                    </div>
                    <input
                      value={decisionForm.setupQuality}
                      onChange={(e) => updateDecision("setupQuality", e.target.value)}
                      style={fieldStyle}
                      placeholder="1-10"
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: palette.textDim, marginBottom: 6 }}>
                      Confidence
                    </div>
                    <input
                      value={decisionForm.confidenceSelf}
                      onChange={(e) => updateDecision("confidenceSelf", e.target.value)}
                      style={fieldStyle}
                      placeholder="1-10"
                    />
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, color: palette.textDim, marginBottom: 6 }}>
                    Notes
                  </div>
                  <textarea
                    value={decisionForm.notes}
                    onChange={(e) => updateDecision("notes", e.target.value)}
                    style={{
                      ...fieldStyle,
                      minHeight: 100,
                      resize: "vertical",
                    }}
                    placeholder="Execution notes, emotional state, mistake review..."
                  />
                </div>
              </div>
            ) : null}

            <div>
              <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 6 }}>
                Advanced Logging Snapshot
              </div>
              <div style={styles.subtext}>
                Compressed by default so radar, chart, and journal stay primary.
              </div>
            </div>

            {featureFlags.deeperStats ? (
              showInsights ? (
                <div style={styles.topCardRow}>
                  <StatCard
                    title="Top Execution"
                    value={advancedStats.topExecution}
                    subtitle="Most used style"
                  />
                  <StatCard
                    title="Top Liquidity"
                    value={advancedStats.topLiquidity}
                    subtitle="Most used location"
                  />
                  <StatCard
                    title="Top Trigger"
                    value={advancedStats.topTrigger}
                    subtitle="Most used entry trigger"
                  />
                  <StatCard
                    title="Top Outcome"
                    value={advancedStats.topOutcome}
                    subtitle="Most common result"
                  />
                  <StatCard
                    title="Top HTF Bias"
                    value={advancedStats.topHtf}
                    subtitle="Most common alignment"
                  />
                  <StatCard
                    title="Avg Self-Confidence"
                    value={
                      advancedStats.avgConfidenceSelf
                        ? advancedStats.avgConfidenceSelf.toFixed(1)
                        : "—"
                    }
                    subtitle="1 to 10 scale"
                  />
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                    gap: 10,
                  }}
                >
                  <MiniBox label="Top Execution" value={advancedStats.topExecution} />
                  <MiniBox label="Top Liquidity" value={advancedStats.topLiquidity} />
                  <MiniBox label="Top Trigger" value={advancedStats.topTrigger} />
                  <MiniBox label="Top Outcome" value={advancedStats.topOutcome} />
                  <MiniBox label="Top HTF Bias" value={advancedStats.topHtf} />
                  <MiniBox
                    label="Avg Confidence"
                    value={
                      advancedStats.avgConfidenceSelf
                        ? advancedStats.avgConfidenceSelf.toFixed(1)
                        : "—"
                    }
                  />
                </div>
              )
            ) : (
              <div
                style={{
                  marginTop: 2,
                  padding: 14,
                  borderRadius: 16,
                  border: `1px solid ${palette.border}`,
                  background: "rgba(255,255,255,0.02)",
                  display: "grid",
                  gap: 10,
                }}
              >
                <div style={{ fontWeight: 800 }}>Advanced Stats are available on Pro.</div>
                <div style={{ fontSize: 13, color: palette.textSoft }}>
                  Unlock deeper execution patterns, trigger analysis, liquidity breakdowns, and confidence tracking.
                </div>
                <div>
                  <button
                    style={styles.primaryButton}
                    onClick={() => setActiveTab("billing")}
                    type="button"
                  >
                    Unlock Advanced Stats
                  </button>
                </div>
              </div>
            )}

            {displayDecisions.length === 0 ? (
              <div
                style={{
                  border: `1px solid ${palette.border}`,
                  background: palette.card,
                  borderRadius: 18,
                  padding: 16,
                  color: palette.textSoft,
                }}
              >
                No journal entries yet. Select an event and log it to start building your review history.
              </div>
            ) : (
              displayDecisions.map((log) => {
                const tone = directionTone(log.directionBias);
                const isExpanded = expandedLogId === log.id;

                return (
                  <div
                    key={log.id}
                    style={{
                      borderRadius: 18,
                      border: `1px solid ${palette.border}`,
                      background: palette.card,
                      overflow: "hidden",
                      transition: "transform 140ms ease, box-shadow 140ms ease",
                      boxShadow: isExpanded ? "0 14px 28px rgba(0,0,0,0.24)" : "none",
                    }}
                    onMouseEnter={(e) => {
                      if (!isExpanded) {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.18)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isExpanded) {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "none";
                      }
                    }}
                  >
                    <div
                      onClick={() => toggleLogCard(log.id)}
                      style={{
                        padding: 12,
                        display: "grid",
                        gap: 10,
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <div style={{ fontSize: 15, fontWeight: 900 }}>{log.pair}</div>
                          <Pill>{log.timeframe || "—"}</Pill>
                          <Pill tone={tone === "neutral" ? "gold" : tone}>
                            {log.directionBias || "Neutral"}
                          </Pill>
                          <Pill tone="gold">{log.outcome || "Open"}</Pill>
                        </div>

                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <div style={{ fontSize: 12, color: palette.textSoft }}>
                            {formatDateTime(log.timestamp)}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLogCard(log.id);
                            }}
                            style={{
                              ...styles.button,
                              padding: "6px 10px",
                              borderRadius: 10,
                              fontSize: 11,
                            }}
                          >
                            {isExpanded ? "Hide Details" : "Show Details"}
                          </button>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                          gap: 8,
                        }}
                        className="app-journal-grid"
                      >
                        <MiniBox label="Action" value={log.action || "—"} />
                        <MiniBox label="Timing" value={log.timing || "—"} />
                        <MiniBox label="Plan" value={log.planFollowed || "—"} />
                        <MiniBox label="PnL" value={log.pnl ?? "—"} />
                        <MiniBox
                          label="Risk"
                          value={
                            log.stop && log.entry ? num(Math.abs(log.entry - log.stop)) : "—"
                          }
                        />
                      </div>
                    </div>

                    {isExpanded ? (
                      <div style={{ padding: "0 12px 12px", display: "grid", gap: 12 }}>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                            gap: 8,
                          }}
                          className="app-journal-grid"
                        >
                          <MiniBox label="Rule Break" value={log.ruleBreak || "None"} />
                          <MiniBox label="Entry" value={num(log.entry)} />
                          <MiniBox label="Stop" value={num(log.stop)} />
                          <MiniBox label="TP1" value={num(log.tp1)} />
                          <MiniBox label="TP2" value={num(log.tp2)} />
                          <MiniBox label="Setup Quality" value={log.setupQuality ?? "—"} />
                          <MiniBox label="Discipline" value={log.disciplineScore ?? "—"} />
                          <MiniBox label="Confidence" value={log.confidenceSelf ?? "—"} />
                          <MiniBox label="Session" value={log.session || "—"} />
                          <MiniBox label="EMA Context" value={log.emaContext || "—"} />
                        </div>

                        <div style={{ padding: 12, borderRadius: 14, border: `1px solid ${palette.border}` }}>
                          <div style={{ fontWeight: 900 }}>Notes</div>
                          <div style={{ fontSize: 13 }}>{log.notes || "No notes"}</div>
                        </div>

                        <div style={{ padding: 12, borderRadius: 14, border: `1px solid ${palette.border}` }}>
                          <div style={{ fontWeight: 900 }}>AI Breakdown</div>
                          <div>{log.aiSummary}</div>
                          <div style={{ fontSize: 12 }}>{log.aiCoachingNote}</div>
                        </div>

                        <div style={{ borderRadius: 14, overflow: "hidden" }}>
                          {log.screenshot ? (
                            <img
                              src={log.screenshot}
                              alt="Trade screenshot"
                              style={{ width: "100%", display: "block" }}
                            />
                          ) : (
                            <div style={{ padding: 16 }}>No screenshot</div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </section>

        <div
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            display: "grid",
            gap: 10,
            zIndex: 9999,
            pointerEvents: "none",
          }}
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                color: "#fff",
                background:
                  t.type === "success"
                    ? "rgba(24,80,42,0.94)"
                    : t.type === "warn"
                      ? "rgba(98,52,10,0.94)"
                      : "rgba(20,27,42,0.96)",
                border: `1px solid ${palette.border}`,
                minWidth: 220,
                boxShadow: "0 10px 24px rgba(0,0,0,0.28)",
              }}
            >
              {t.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

