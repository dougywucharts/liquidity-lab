import { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import { createChart, CandlestickSeries, LineSeries } from "lightweight-charts";
import BillingPage from "./BillingPage.jsx";
import MembersVault from "./MembersVault.jsx";

// ─── Mobile responsive styles injected globally ──────────────────────────────
const mobileCSS = `
  @media (max-width: 768px) {
    /* Main 3-col grid → single column stack */
    .llab-main-grid {
      grid-template-columns: 1fr !important;
      height: auto !important;
    }
    /* Radar panel height cap on mobile */
    .llab-radar-panel {
      height: 280px !important;
      min-height: 280px !important;
    }
    /* Stats bar → 2x2 */
    .llab-stats-bar {
      grid-template-columns: repeat(2, minmax(0,1fr)) !important;
    }
    /* Session clocks → horizontal scroll */
    .llab-session-clocks {
      grid-template-columns: repeat(3, minmax(200px,1fr)) !important;
      overflow-x: auto !important;
      -webkit-overflow-scrolling: touch !important;
      padding-bottom: 6px !important;
    }
    /* Signal insight bar → 2 rows of 4 */
    .llab-signal-bar {
      grid-template-columns: repeat(4, minmax(0,1fr)) !important;
    }
    /* Journal form grids → 2 col max */
    .llab-form-4col {
      grid-template-columns: repeat(2, minmax(0,1fr)) !important;
    }
    .llab-form-3col {
      grid-template-columns: repeat(2, minmax(0,1fr)) !important;
    }
    .llab-price-levels {
      grid-template-columns: repeat(2, minmax(0,1fr)) !important;
    }
    /* Top card row → 2x2 */
    .llab-top-card-row {
      grid-template-columns: repeat(2, minmax(0,1fr)) !important;
    }
    /* Top bar buttons wrap */
    .llab-topbar-buttons {
      gap: 6px !important;
    }
    .llab-topbar-buttons button {
      padding: 7px 10px !important;
      font-size: 12px !important;
    }
    /* Brand text smaller */
    .llab-brand-title {
      font-size: 18px !important;
    }
    /* Chart min height on mobile */
    .llab-chart-frame {
      min-height: 280px !important;
    }
    /* QuickClose grid → stack */
    .llab-quick-close {
      grid-template-columns: 1fr 1fr !important;
    }
    /* Shell padding tighter */
    .llab-shell {
      padding: 8px 10px !important;
      gap: 8px !important;
    }
    /* Hide right panel (Decision Context) on mobile — show below chart instead */
    .llab-right-panel {
      display: none !important;
    }
    /* Mobile-only decision context summary */
    .llab-mobile-context {
      display: flex !important;
    }
  }
  @media (min-width: 769px) {
    .llab-mobile-context { display: none !important; }
    .llab-right-panel { display: flex !important; }
  }
`;

function MobileStyles() {
  return <style>{mobileCSS}</style>;
}

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

const BETA_ACCESS_CODE =
  import.meta.env.VITE_BETA_ACCESS_CODE || "redoctoberbeta";

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
  borderRadius: 10,
  padding: "9px 11px",
  background: "rgba(255,255,255,0.04)",
  color: palette.text,
  border: `1px solid ${palette.border}`,
  outline: "none",
  fontSize: 13,
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

function minutesAgo(ts) {
  const d = parseEventDate(ts);
  if (!d) return "—";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function num(v, digits = 3) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

function money(v) {
  const n = Number(v);
  return Number.isFinite(n) ? `$${n.toLocaleString()}` : "—";
}

function calcRR(entry, stop, target) {
  const e = Number(entry),
    s = Number(stop),
    t = Number(target);
  if (![e, s, t].every(Number.isFinite)) return null;
  const risk = Math.abs(e - s);
  if (!Number.isFinite(risk) || risk <= 0) return null;
  const reward = Math.abs(t - e);
  if (!Number.isFinite(reward) || reward <= 0) return null;
  return reward / risk;
}

function calcPlannedRR(entry, stop, tp1, tp2, rr1, rr2) {
  const parsedRr1 = Number(rr1),
    parsedRr2 = Number(rr2);
  return {
    rr1: Number.isFinite(parsedRr1) ? parsedRr1 : calcRR(entry, stop, tp1),
    rr2: Number.isFinite(parsedRr2) ? parsedRr2 : calcRR(entry, stop, tp2),
  };
}

function sanitizePrice(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return "";
  const str = n.toFixed(10);
  const trimmed = str.replace(/(\.\d*?)0{4,}\d*$/, "$1").replace(/\.$/, "");
  const result = parseFloat(trimmed);
  return Number.isFinite(result)
    ? result.toString()
    : n.toFixed(8).replace(/\.?0+$/, "");
}

function calcRealizedRR(directionBias, entry, stop, exit) {
  if (exit === "" || exit == null || exit === 0 || exit === "0") return null;
  const e = Number(entry),
    s = Number(stop),
    x = Number(exit);
  if (![e, s, x].every(Number.isFinite) || x === 0) return null;
  const risk = Math.abs(e - s);
  if (!Number.isFinite(risk) || risk <= 0) return null;
  const tone = directionTone(directionBias);
  const pnlMove = tone === "short" ? e - x : x - e;
  return pnlMove / risk;
}

function calcRiskAmount(entry, stop) {
  const e = Number(entry),
    s = Number(stop);
  if (![e, s].every(Number.isFinite)) return null;
  const risk = Math.abs(e - s);
  return Number.isFinite(risk) && risk > 0 ? risk : null;
}

function rrText(rr, maxPlausible = 50) {
  const n = Number(rr);
  if (rr == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) > maxPlausible) return "—";
  return `${n.toFixed(2)}R`;
}

function directionTone(value) {
  const v = String(value || "").toLowerCase();
  if (v.includes("long") || v.includes("bull")) return "long";
  if (v.includes("short") || v.includes("bear")) return "short";
  return "neutral";
}

function gradeTone(grade) {
  const g = String(grade || "").toUpperCase();
  if (g === "A" || g === "DISCIPLINED") return "long";
  if (g === "B" || g === "MIXED") return "gold";
  if (g === "C" || g === "RULE BREAK") return "short";
  return "neutral";
}

function getToneBorder(tone) {
  if (tone === "long") return "rgba(74, 222, 128, 0.28)";
  if (tone === "short") return "rgba(251, 113, 133, 0.28)";
  if (tone === "gold") return "rgba(246,196,83,0.24)";
  return palette.border;
}

function outcomeTone(outcome) {
  const o = String(outcome || "").toLowerCase();
  if (o === "win") return "long";
  if (o === "loss") return "short";
  if (o === "scratch") return "gold";
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
          (parseEventDate(a?.timestampUtc)?.getTime() || 0),
      );
      const newest = sortedEvents[0] || {};
      const newestTime = parseEventDate(newest?.timestampUtc)?.getTime() || 0;
      const avgConfidence =
        sortedEvents.reduce(
          (sum, item) => sum + (Number(item?.botConfidence) || 0),
          0,
        ) / Math.max(sortedEvents.length, 1);
      const recentMinutes =
        newestTime > 0 ? Math.floor((Date.now() - newestTime) / 60000) : 999;
      const hotScore =
        (recentMinutes <= 2
          ? 120
          : recentMinutes <= 5
            ? 80
            : recentMinutes <= 10
              ? 40
              : 0) +
        (sortedEvents.length >= 5 ? 60 : sortedEvents.length >= 3 ? 30 : 0) +
        Math.round(avgConfidence * 15);
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
        recentMinutes,
        hotScore,
        events: sortedEvents,
      };
    })
    .sort((a, b) => {
      if ((b.hotScore || 0) !== (a.hotScore || 0))
        return (b.hotScore || 0) - (a.hotScore || 0);
      return (b.latestTimeMs || 0) - (a.latestTimeMs || 0);
    });
}

function bestTickerItems(waves, limit = 10) {
  if (!Array.isArray(waves)) return [];
  return [...waves]
    .filter((wave) => {
      const conf = Number(wave?.avgConfidence) || 0;
      const count = Number(wave?.events?.length || 0);
      const recentMinutes =
        wave?.latestTimeMs > 0
          ? Math.floor((Date.now() - wave.latestTimeMs) / 60000)
          : 999;
      return recentMinutes <= 30 && (conf >= 0.6 || count >= 2);
    })
    .sort((a, b) => {
      if ((b.hotScore || 0) !== (a.hotScore || 0))
        return (b.hotScore || 0) - (a.hotScore || 0);
      return (b.latestTimeMs || 0) - (a.latestTimeMs || 0);
    })
    .slice(0, limit)
    .map((wave) => ({
      id: wave.key,
      pair: wave.pair,
      timeframe: wave.timeframe,
      directionBias: wave.directionBias,
      sweepType: wave.sweepType,
      eventType: wave.eventType,
      timestampUtc: wave.timestampUtc,
      botConfidence: wave.avgConfidence,
      waveCount: wave.events?.length || 1,
      hotScore: wave.hotScore || 0,
      _wave: wave,
    }));
}

function getSignalAgeMinutes(timestampUtc) {
  const d = parseEventDate(timestampUtc);
  if (!d) return 999;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
}

function getSignalState(timestampUtc, tradeState) {
  // Price already ran past the entry/TP zone — dead on arrival regardless
  // of how fresh the timestamp is.
  if (tradeState === "MOVED") return "EXPIRED";
  const age = getSignalAgeMinutes(timestampUtc);
  if (age <= 3) return "LIVE";
  if (age <= 10) return "AGING";
  return "EXPIRED";
}

function getSignalCountdown(timestampUtc) {
  const d = parseEventDate(timestampUtc);
  if (!d) return "—";
  const ageMs = Date.now() - d.getTime();
  const remainingMs = Math.max(0, 3 * 60 * 1000 - ageMs);
  const min = Math.floor(remainingMs / 60000);
  const sec = Math.floor((remainingMs % 60000) / 1000);
  return `${min}:${String(sec).padStart(2, "0")}`;
}

// ─── atoms ───────────────────────────────────────────────────────────────────

function Pill({ children, tone = "neutral" }) {
  const styleMap = {
    neutral: {
      color: palette.textSoft,
      background: "rgba(255,255,255,0.05)",
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
        padding: "4px 9px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 0.2,
        ...styleMap[tone],
      }}
    >
      {children}
    </span>
  );
}

function MiniBox({ label, value, subtext, tone = null }) {
  const isLong = tone === "long";
  const isShort = tone === "short";
  return (
    <div
      style={{
        border: `1px solid ${isLong ? "rgba(34,197,94,0.3)" : isShort ? "rgba(239,68,68,0.3)" : palette.border}`,
        background: palette.card,
        borderRadius: 14,
        padding: "11px 13px",
        display: "grid",
        gap: 4,
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: palette.textDim,
          textTransform: "uppercase",
          letterSpacing: 0.9,
          fontWeight: 800,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "clamp(11px,0.85vw,16px)",
          fontWeight: 900,
          color: isLong ? "#4ade80" : isShort ? "#f87171" : palette.text,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: "100%",
        }}
      >
        {value}
      </div>
      {subtext ? (
        <div
          style={{
            fontSize: 11,
            color: palette.textSoft,
            lineHeight: 1.35,
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          {subtext}
        </div>
      ) : null}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: 2,
        textTransform: "uppercase",
        color: palette.textDim,
        padding: "2px 0 6px",
      }}
    >
      {children}
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{ height: 1, background: palette.borderSoft, margin: "4px 0" }}
    />
  );
}

function BriefingPanel() {
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [open, setOpen] = useState(false);

  async function fetchBriefing() {
    try {
      setLoading(true);
      const data = await apiFetch("/briefing", { method: "POST" });
      setBriefing(data.briefing);
      setSession(data.session);
      setGeneratedAt(data.generatedAt);
      setOpen(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        borderRadius: 20,
        border: `1px solid ${palette.border}`,
        background: palette.panel,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          borderBottom: open ? `1px solid ${palette.borderSoft}` : "none",
        }}
      >
        <div>
          <div style={{ fontWeight: 900, fontSize: 14 }}>
            🌅 Pre-Session Briefing
          </div>
          <div style={{ fontSize: 11, color: palette.textDim, marginTop: 2 }}>
            {generatedAt
              ? `Generated ${new Date(generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : "AI-powered session prep"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {session && <Pill tone="gold">{session}</Pill>}
          <button
            style={styles.primaryButton}
            onClick={fetchBriefing}
            type="button"
            disabled={loading}
          >
            {loading
              ? "Generating…"
              : briefing
                ? "Refresh"
                : "Generate Briefing"}
          </button>
          {briefing && (
            <button
              style={styles.button}
              onClick={() => setOpen((p) => !p)}
              type="button"
            >
              {open ? "Hide" : "Show"}
            </button>
          )}
        </div>
      </div>
      {open && briefing && (
        <div style={{ padding: 14, display: "grid", gap: 10 }}>
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 14,
              background: "rgba(239,68,68,0.07)",
              border: "1px solid rgba(239,68,68,0.2)",
              fontSize: 15,
              fontWeight: 900,
            }}
          >
            {briefing.headline}
          </div>
          <div
            style={{
              padding: "10px 13px",
              borderRadius: 12,
              background: palette.card,
              border: `1px solid ${palette.border}`,
              fontSize: 13,
              color: palette.textSoft,
              lineHeight: 1.55,
            }}
          >
            {briefing.sessionContext}
          </div>
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: palette.textDim,
                marginBottom: 8,
              }}
            >
              Watchlist
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {(briefing.topWatchlist || []).map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: palette.card,
                    border: `1px solid ${palette.border}`,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        gap: 7,
                        alignItems: "center",
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ fontWeight: 900, fontSize: 13 }}>
                        {item.pair}
                      </span>
                      <Pill tone={directionTone(item.direction)}>
                        {item.direction}
                      </Pill>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: palette.textSoft,
                        lineHeight: 1.45,
                      }}
                    >
                      {item.reason}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            <div
              style={{
                padding: "10px 13px",
                borderRadius: 12,
                background: "rgba(251,113,133,0.06)",
                border: "1px solid rgba(251,113,133,0.2)",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: palette.short,
                  marginBottom: 6,
                }}
              >
                ⚠ Avoid Today
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: palette.textSoft,
                  lineHeight: 1.5,
                }}
              >
                {briefing.dnaWarning}
              </div>
            </div>
            <div
              style={{
                padding: "10px 13px",
                borderRadius: 12,
                background: "rgba(74,222,128,0.06)",
                border: "1px solid rgba(74,222,128,0.2)",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: palette.long,
                  marginBottom: 6,
                }}
              >
                ✓ Lean Into
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: palette.textSoft,
                  lineHeight: 1.5,
                }}
              >
                {briefing.dnaTip}
              </div>
            </div>
          </div>
          <div
            style={{
              padding: "11px 14px",
              borderRadius: 12,
              background: "rgba(246,196,83,0.06)",
              border: "1px solid rgba(246,196,83,0.2)",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: palette.gold,
                marginBottom: 6,
              }}
            >
              🎯 Session Focus
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: palette.text,
                lineHeight: 1.5,
              }}
            >
              {briefing.focusForSession}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldLabel({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: 0.9,
          color: palette.textDim,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

// ─── SmartTicker ─────────────────────────────────────────────────────────────

function SmartTicker({ items, onSelect }) {
  const doubled = [...items, ...items];
  if (!items?.length) {
    return (
      <div style={styles.tickerWrap}>
        <div
          style={{
            padding: "10px 16px",
            fontSize: 12,
            color: palette.textSoft,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "rgba(74,222,128,0.5)",
              display: "inline-block",
            }}
          />
          Radar Active — Scanning markets for high-confidence sweeps
        </div>
      </div>
    );
  }
  return (
    <div style={styles.tickerWrap}>
      <style>{`
        @keyframes tickerScroll { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        .smart-ticker-track:hover { animation-play-state:paused !important; }
      `}</style>
      <div style={styles.tickerViewport}>
        <div className="smart-ticker-track" style={styles.tickerTrack}>
          {doubled.map((evt, index) => {
            const tone = directionTone(evt?.directionBias);
            const confidence = Number(evt?.botConfidence || 0);
            const count = evt?.waveCount || 1;
            const minsAgo = evt?.timestampUtc
              ? Math.max(
                  0,
                  Math.floor(
                    (Date.now() - parseEventDate(evt.timestampUtc).getTime()) /
                      60000,
                  ),
                )
              : 999;
            const toneColor =
              tone === "long"
                ? "#22c55e"
                : tone === "short"
                  ? "#ef4444"
                  : "#eab308";
            const bg =
              tone === "long"
                ? "rgba(34,197,94,0.1)"
                : tone === "short"
                  ? "rgba(239,68,68,0.1)"
                  : "rgba(234,179,8,0.07)";
            const countColor =
              count >= 10
                ? "#22c55e"
                : count >= 5
                  ? "#f6c453"
                  : "rgba(255,255,255,0.6)";
            const recencyColor =
              minsAgo <= 2
                ? "#22c55e"
                : minsAgo <= 5
                  ? "#f6c453"
                  : "rgba(255,255,255,0.45)";
            const isHot =
              (count >= 8 && confidence >= 0.8) ||
              confidence >= 0.92 ||
              minsAgo <= 2;
            return (
              <button
                key={`${eventKey(evt)}_${index}`}
                onClick={() => onSelect?.(evt)}
                style={{
                  ...cardButtonReset,
                  width: "auto",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "5px 11px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: bg,
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: isHot ? 900 : 700,
                  letterSpacing: 0.3,
                  boxShadow: isHot ? "0 0 10px rgba(246,196,83,0.25)" : "none",
                  transform: isHot ? "scale(1.03)" : "scale(1)",
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{ color: "#fff", fontWeight: 900 }}>
                  {evt?.pair}
                </span>
                <span style={{ opacity: 0.55 }}>{evt?.timeframe}</span>
                <span style={{ color: toneColor }}>
                  {String(evt?.directionBias || "Neutral").toUpperCase()}
                </span>
                <span style={{ opacity: 0.45, fontSize: 11 }}>
                  {evt?.sweepType || evt?.eventType}
                </span>
                {count > 1 ? (
                  <span
                    style={{ color: countColor, fontWeight: 900, fontSize: 12 }}
                  >
                    {count}x
                  </span>
                ) : null}
                <span style={{ color: toneColor }}>
                  {(confidence * 100).toFixed(0)}%
                </span>
                <span style={{ color: recencyColor }}>
                  {minsAgo < 1 ? "now" : `${minsAgo}m`}
                </span>
                <span style={{ opacity: 0.12 }}>|</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── SessionClockWidget ───────────────────────────────────────────────────────

function SessionClockWidget() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const sessions = [
    {
      key: "ny",
      label: "New York",
      tzLabel: "NY",
      utcLabel: "UTC-4/5",
      timeZone: "America/New_York",
      localPrimeStart: 8,
      localPrimeEnd: 12,
    },
    {
      key: "london",
      label: "London",
      tzLabel: "LDN",
      utcLabel: "UTC+0/1",
      timeZone: "Europe/London",
      localPrimeStart: 3,
      localPrimeEnd: 6,
    },
    {
      key: "asia",
      label: "Asia / Tokyo",
      tzLabel: "TKY",
      utcLabel: "UTC+9",
      timeZone: "Asia/Tokyo",
      localPrimeStart: 9,
      localPrimeEnd: 12,
    },
  ];

  function formatMilitary(date, timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
    return `${parts.find((p) => p.type === "hour")?.value || "00"}:${parts.find((p) => p.type === "minute")?.value || "00"}`;
  }

  function isPrime(hour, openHour, closeHour) {
    if (openHour <= closeHour) return hour >= openHour && hour < closeHour;
    return hour >= openHour || hour < closeHour;
  }

  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}
      className="llab-session-clocks"
    >
      {sessions.map((session) => {
        const display = formatMilitary(new Date(now), session.timeZone);
        const localHour = Number(
          new Intl.DateTimeFormat("en-US", {
            timeZone: session.timeZone,
            hour: "numeric",
            hour12: false,
          }).format(now),
        );
        const active = isPrime(
          localHour,
          session.localPrimeStart,
          session.localPrimeEnd,
        );
        return (
          <div
            key={session.key}
            style={{
              borderRadius: 18,
              padding: "14px 16px",
              display: "grid",
              gap: 7,
              border: active
                ? "1px solid rgba(74,222,128,0.32)"
                : `1px solid ${palette.border}`,
              boxShadow: active ? "0 0 20px rgba(34,197,94,0.18)" : "none",
              background: active
                ? "linear-gradient(180deg,rgba(12,24,18,0.96),rgba(8,14,12,0.96))"
                : palette.card,
              transition: "all 0.22s ease",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: palette.textDim,
                  textTransform: "uppercase",
                  letterSpacing: 1.2,
                  fontWeight: 800,
                }}
              >
                {session.label}
              </div>
              <Pill tone={active ? "long" : "neutral"}>
                {active ? "PRIME" : "IDLE"}
              </Pill>
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 900,
                letterSpacing: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {display}
              <span
                style={{
                  fontSize: 11,
                  color: palette.textDim,
                  marginLeft: 8,
                  letterSpacing: 1,
                }}
              >
                {session.tzLabel}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: palette.textDim,
                  marginLeft: 6,
                  opacity: 0.7,
                }}
              >
                {session.utcLabel}
              </span>
            </div>
            <div style={{ fontSize: 11, color: palette.textSoft }}>
              Prime: {session.localPrimeStart}:00–{session.localPrimeEnd}:00{" "}
              {session.tzLabel}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── SignalInsightBar ─────────────────────────────────────────────────────────

function InsightBox({ label, value, subtext, accent }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${palette.borderSoft}`,
        borderRadius: 12,
        padding: "8px 10px",
        minWidth: 0,
        display: "grid",
        gap: 3,
      }}
    >
      <div
        style={{
          fontSize: 9,
          color: palette.textDim,
          textTransform: "uppercase",
          letterSpacing: 1,
          fontWeight: 800,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 900,
          color: accent || palette.text,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value ?? "—"}
      </div>
      {subtext ? (
        <div
          style={{
            fontSize: 11,
            color: palette.textSoft,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {subtext}
        </div>
      ) : null}
    </div>
  );
}

function SignalInsightBar({ event, rr, risk }) {
  if (!event) return null;
  const state = getSignalState(event.timestampUtc, event.tradeState);
  const countdown = getSignalCountdown(event.timestampUtc);
  const stateColor =
    state === "LIVE"
      ? palette.long
      : state === "AGING"
        ? palette.gold
        : palette.short;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(7,minmax(0,1fr))",
        gap: 6,
      }}
      className="llab-signal-bar"
    >
      <InsightBox
        label="ENTRY"
        value={num(event.entry)}
        subtext="retest zone"
        accent="#60a5fa"
      />
      <InsightBox
        label="STOP"
        value={num(event.stop)}
        subtext="invalidation"
        accent="#ef4444"
      />
      <InsightBox
        label="TP1"
        value={num(event.tp1)}
        subtext={rrText(rr?.rr1)}
        accent="#4ade80"
      />
      <InsightBox
        label="TP2"
        value={num(event.tp2)}
        subtext={rrText(rr?.rr2)}
        accent="#86efac"
      />
      <InsightBox label="STATE" value={state} accent={stateColor} />
      <InsightBox label="LIVE TTL" value={countdown} />
      <InsightBox
        label="SESSION"
        value={
          event.session && event.session !== "Off-Hours" ? event.session : "—"
        }
      />
    </div>
  );
}

// ─── AiReviewPanel ───────────────────────────────────────────────────────────

function AiReviewPanel({ entry, liveReview, loading, locked }) {
  const score = liveReview?.score ?? entry?.aiScore ?? null;
  const grade =
    entry?.aiGrade ||
    (score != null ? (score >= 88 ? "A" : score >= 76 ? "B" : "C") : null);
  const verdict =
    liveReview?.verdict ||
    entry?.aiVerdict ||
    entry?.executionAssessment ||
    "No verdict yet.";
  const coaching =
    liveReview?.coaching || entry?.aiCoachingNote || "No coaching yet.";
  const comparison = liveReview?.comparison || entry?.aiComparison || null;
  const strengths =
    liveReview?.strengths || entry?.whatWasGood || entry?.aiStrengths || [];
  const mistakes =
    liveReview?.mistakes || entry?.whatNeedsWork || entry?.aiMistakes || [];
  const tone = gradeTone(grade);
  const toneColor =
    tone === "long"
      ? palette.long
      : tone === "short"
        ? palette.short
        : tone === "gold"
          ? palette.gold
          : palette.textSoft;
  const toneBg =
    tone === "long"
      ? palette.longSoft
      : tone === "short"
        ? palette.shortSoft
        : tone === "gold"
          ? palette.goldSoft
          : "rgba(255,255,255,0.04)";

  if (locked) {
    return (
      <div style={styles.aiPanel}>
        <div style={styles.aiHeader}>
          <div>
            <div style={styles.aiEyebrow}>AI Review</div>
            <div style={styles.aiTitle}>Locked</div>
          </div>
          <Pill tone="gold">Upgrade</Pill>
        </div>
        <div style={styles.aiBody}>
          <div style={styles.aiSummaryCard}>
            AI coaching is locked on this plan. Upgrade to unlock graded trade
            review, strengths, mistakes, and coaching notes.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.aiPanel}>
      <div style={styles.aiHeader}>
        <div>
          <div style={styles.aiEyebrow}>AI Review</div>
          <div style={styles.aiTitle}>Execution Panel</div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {grade ? (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 12,
                background: toneBg,
                color: toneColor,
                border: `1px solid ${getToneBorder(tone)}`,
                fontWeight: 900,
                minWidth: 52,
                textAlign: "center",
                fontSize: 15,
              }}
            >
              {grade}
            </div>
          ) : null}
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${palette.border}`,
              fontWeight: 900,
              minWidth: 70,
              textAlign: "center",
            }}
          >
            {score != null ? `${score}/100` : "—"}
          </div>
        </div>
      </div>
      <div style={styles.aiBody}>
        {loading ? (
          <div style={styles.aiSummaryCard}>Running AI review…</div>
        ) : (
          <>
            <div style={styles.aiSummaryCard}>
              <div style={styles.aiLabel}>Verdict</div>
              <div style={{ fontWeight: 800, marginTop: 4 }}>{verdict}</div>
              <div
                style={{
                  marginTop: 10,
                  color: palette.textSoft,
                  lineHeight: 1.55,
                }}
              >
                {coaching}
              </div>
            </div>
            {comparison ? (
              <div style={styles.aiSummaryCard}>
                <div style={styles.aiLabel}>You vs Group</div>
                <div
                  style={{
                    marginTop: 8,
                    color: palette.textSoft,
                    lineHeight: 1.55,
                    fontWeight: 700,
                  }}
                >
                  {comparison}
                </div>
              </div>
            ) : null}
            <div style={styles.aiBreakdownGrid}>
              <MiniBox
                label="Setup"
                value={entry?.setupScore ?? "—"}
                subtext={entry?.setupAssessment || "No setup assessment"}
              />
              <MiniBox
                label="Execution"
                value={entry?.executionScore ?? "—"}
                subtext={
                  entry?.executionAssessment || "No execution assessment"
                }
              />
              <MiniBox
                label="Management"
                value={entry?.managementScore ?? "—"}
                subtext={entry?.riskAssessment || "No risk assessment"}
              />
            </div>
            <div style={styles.aiTwoCol}>
              <div style={styles.aiListCard}>
                <div style={{ ...styles.aiLabel, color: palette.long }}>
                  What was good
                </div>
                {strengths?.length ? (
                  <div style={styles.aiList}>
                    {strengths.map((item, i) => (
                      <div key={`${item}_${i}`} style={styles.aiListItem}>
                        <span style={styles.aiBulletGood}>●</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={styles.aiEmpty}>No strengths logged yet.</div>
                )}
              </div>
              <div style={styles.aiListCard}>
                <div style={{ ...styles.aiLabel, color: palette.short }}>
                  Needs work
                </div>
                {mistakes?.length ? (
                  <div style={styles.aiList}>
                    {mistakes.map((item, i) => (
                      <div key={`${item}_${i}`} style={styles.aiListItem}>
                        <span style={styles.aiBulletBad}>●</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={styles.aiEmpty}>No mistakes flagged.</div>
                )}
              </div>
            </div>
            {entry?.biasAlignment || entry?.chartRead ? (
              <div style={styles.aiMetaRow}>
                <Pill>{entry?.biasAlignment || "Bias unknown"}</Pill>
                <Pill>{entry?.chartRead || "No chart read"}</Pill>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

// Dynamic price precision — small caps need more decimals than BTC
function getPricePrecision(price) {
  const p = Math.abs(Number(price));
  if (!Number.isFinite(p) || p === 0) return 2;
  if (p >= 1000) return 2; // BTC, ETH
  if (p >= 10) return 3; // SOL, LINK, AVAX
  if (p >= 1) return 4; // ADA, XRP
  if (p >= 0.01) return 5; // FET, DOGE
  return 6; // PEPE-tier
}

function LightweightExecutionChart({ pair, timeframe, entry, stop, tp1, tp2 }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const extraSeriesRef = useRef([]);
  const priceLinesRef = useRef([]); // tracked so redraw can remove them
  const [error, setError] = useState(null);
  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";
    const chart = createChart(ref.current, {
      layout: { background: { color: "#070a0f" }, textColor: "#cbd5e1" },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
        scaleMargins: { top: 0.08, bottom: 0.08 },
        minimumWidth: 60,
      },
      timeScale: { borderColor: "rgba(255,255,255,0.08)", timeVisible: true },
      width: ref.current.clientWidth,
      height: ref.current.clientHeight,
      devicePixelRatio: window.devicePixelRatio,
    });
    chartRef.current = chart;
    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });
    const resize = () => {
      if (ref.current && chartRef.current)
        chartRef.current.applyOptions({
          width: ref.current.clientWidth,
          height: ref.current.clientHeight,
        });
    };
    window.addEventListener("resize", resize);
    setChartReady(true);
    return () => {
      setChartReady(false);
      window.removeEventListener("resize", resize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      extraSeriesRef.current = [];
      priceLinesRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!pair || !chartReady || !chartRef.current || !candleSeriesRef.current)
      return;
    let cancelled = false;
    async function fetchAndDraw() {
      try {
        const res = await fetch(
          `${API_BASE}/candles?pair=${encodeURIComponent(pair)}&timeframe=${timeframe || "1m"}&limit=300`,
        );
        const data = await res.json();
        if (cancelled || !data?.candles?.length) return;
        const chart = chartRef.current;
        const candles = candleSeriesRef.current;
        if (!chart || !candles) return; // chart torn down mid-fetch

        // Remove old EMA series
        extraSeriesRef.current.forEach((s) => {
          try {
            chart.removeSeries(s);
          } catch (e) {}
        });
        extraSeriesRef.current = [];

        // Remove old price lines (prevents stacked duplicates)
        priceLinesRef.current.forEach((line) => {
          try {
            candles.removePriceLine(line);
          } catch (e) {}
        });
        priceLinesRef.current = [];

        // PRECISION FIX: scale decimals to the pair's price magnitude
        // (FET at $0.18 needs 5 decimals; BTC at $60k needs 2)
        const lastClose = data.candles[data.candles.length - 1]?.close;
        const precision = getPricePrecision(lastClose);
        candles.applyOptions({
          priceFormat: {
            type: "price",
            precision,
            minMove: Math.pow(10, -precision),
          },
        });

        candles.setData(data.candles);

        // Signal level lines — each tracked for cleanup on next redraw
        [
          ["E", entry, "#f6c453"],
          ["S", stop, "#fb7185"],
          ["T1", tp1, "#4ade80"],
          ["T2", tp2, "#4ade80"],
        ].forEach(([title, value, color]) => {
          if (Number.isFinite(Number(value))) {
            const line = candles.createPriceLine({
              price: Number(value),
              color,
              lineWidth: title === "E" ? 2 : 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title,
            });
            priceLinesRef.current.push(line);
          }
        });

        function calcEma(candles, period) {
          if (candles.length < period) return [];
          const k = 2 / (period + 1);
          let ema = candles[0].close;
          return candles.map((d, i) => {
            if (i === 0) return { time: d.time, value: ema };
            ema = d.close * k + ema * (1 - k);
            return { time: d.time, value: ema };
          });
        }
        function addTracked(options) {
          const s = chart.addSeries(LineSeries, options);
          extraSeriesRef.current.push(s);
          return s;
        }
        [
          [9, "#a78bfa"],
          [55, "#f6c453"],
          [99, "#fb7185"],
        ].forEach(([period, color]) => {
          const s = addTracked({
            color,
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
            priceScaleId: "right",
          });
          const emaData = calcEma(data.candles, period);
          if (emaData.length) s.setData(emaData);
        });

        // Ensure ALL signal levels are inside the visible price range
        // (fitContent only fits candles, so TP2 could sit off-screen)
        const levelVals = [entry, stop, tp1, tp2]
          .map(Number)
          .filter(Number.isFinite);
        if (levelVals.length) {
          const t0 = data.candles[0].time;
          const t1 = data.candles[data.candles.length - 1].time;
          const rangeSeries = addTracked({
            color: "transparent",
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
            priceScaleId: "right",
          });
          rangeSeries.setData([
            { time: t0, value: Math.min(...levelVals) },
            { time: t1, value: Math.max(...levelVals) },
          ]);
        }

        chart.timeScale().fitContent();
        setError(null);
      } catch (err) {
        if (!cancelled) setError("Failed to load candles");
      }
    }
    fetchAndDraw();
    return () => {
      cancelled = true;
    };
  }, [pair, timeframe, entry, stop, tp1, tp2, chartReady]);

  if (error)
    return (
      <div style={{ color: palette.textSoft, fontSize: 13, padding: 16 }}>
        {error}
      </div>
    );
  return <div ref={ref} style={{ width: "100%", height: "100%" }} />;
}

// ─── PnlSparkline ────────────────────────────────────────────────────────────

function PnlSparkline({ decisions }) {
  const points = useMemo(() => {
    let running = 0;
    return decisions
      .slice()
      .reverse()
      .map((d) => {
        running += Number(d.pnl) || 0;
        return running;
      });
  }, [decisions]);

  if (points.length < 2) return null;
  const min = Math.min(...points, 0),
    max = Math.max(...points, 0);
  const range = max - min || 1;
  const w = 120,
    h = 32;
  const toX = (i) => (i / (points.length - 1)) * w;
  const toY = (v) => h - ((v - min) / range) * h;
  const pathD = points
    .map(
      (v, i) =>
        `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`,
    )
    .join(" ");
  const color = points[points.length - 1] >= 0 ? "#4ade80" : "#fb7185";
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${pathD} L${w},${h} L0,${h} Z`} fill="url(#sparkGrad)" />
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle
        cx={toX(points.length - 1)}
        cy={toY(points[points.length - 1])}
        r="3"
        fill={color}
      />
    </svg>
  );
}

// ─── StatsBar ─────────────────────────────────────────────────────────────────

function StatsBar({ decisions }) {
  const stats = useMemo(() => {
    if (!decisions.length)
      return {
        totalTrades: 0,
        winRate: "—",
        avgRR: "—",
        totalPnl: null,
        winCount: 0,
        lossCount: 0,
        streak: 0,
        streakType: "",
      };
    const closed = decisions.filter(
      (d) =>
        d.outcome === "Win" || d.outcome === "Loss" || d.outcome === "Scratch",
    );
    const wins = decisions.filter((d) => d.outcome === "Win").length;
    const losses = decisions.filter((d) => d.outcome === "Loss").length;
    const winRate = closed.length
      ? `${Math.round((wins / closed.length) * 100)}%`
      : "—";
    const rrVals = decisions
      .filter(
        (d) =>
          d.exit &&
          Number(d.exit) !== 0 &&
          (d.outcome === "Win" ||
            d.outcome === "Loss" ||
            d.outcome === "Scratch"),
      )
      .map((d) => Number(d.realizedRR))
      .filter((n) => Number.isFinite(n) && Math.abs(n) <= 20);
    const avgRR = rrVals.length
      ? `${(rrVals.reduce((a, b) => a + b, 0) / rrVals.length).toFixed(2)}R`
      : "—";
    const pnlVals = decisions.map((d) => Number(d.pnl)).filter(Number.isFinite);
    const totalPnl = pnlVals.length ? pnlVals.reduce((a, b) => a + b, 0) : null;
    let streak = 0,
      streakType = "";
    for (const d of decisions) {
      if (d.outcome !== "Win" && d.outcome !== "Loss") break;
      if (!streakType) streakType = d.outcome;
      if (d.outcome !== streakType) break;
      streak++;
    }
    return {
      totalTrades: decisions.length,
      winRate,
      avgRR,
      totalPnl,
      winCount: wins,
      lossCount: losses,
      streak,
      streakType,
    };
  }, [decisions]);

  const pnlPositive = stats.totalPnl != null && stats.totalPnl > 0;
  const pnlNegative = stats.totalPnl != null && stats.totalPnl < 0;
  const streakColor =
    stats.streakType === "Win"
      ? palette.long
      : stats.streakType === "Loss"
        ? palette.short
        : palette.textDim;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5,minmax(0,1fr))",
        gap: 10,
      }}
      className="llab-stats-bar"
    >
      <div style={styles.statCard}>
        <div style={styles.statLabel}>Total Trades</div>
        <div style={styles.statValue}>{stats.totalTrades}</div>
        <div style={styles.statSub}>
          {stats.winCount}W · {stats.lossCount}L
        </div>
      </div>
      <div style={styles.statCard}>
        <div style={styles.statLabel}>Win Rate</div>
        <div style={{ ...styles.statValue, color: palette.long }}>
          {stats.winRate}
        </div>
        <div style={styles.statSub}>closed trades</div>
      </div>
      <div style={styles.statCard}>
        <div style={styles.statLabel}>Avg Realized RR</div>
        <div style={styles.statValue}>{stats.avgRR}</div>
        <div style={styles.statSub}>closed with exit</div>
      </div>
      <div style={styles.statCard}>
        <div style={styles.statLabel}>Total PnL</div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              ...styles.statValue,
              color: pnlPositive
                ? palette.long
                : pnlNegative
                  ? palette.short
                  : palette.text,
            }}
          >
            {stats.totalPnl != null ? money(stats.totalPnl) : "—"}
          </div>
          <PnlSparkline decisions={decisions} />
        </div>
        <div style={styles.statSub}>logged pnl only</div>
      </div>
      <div style={styles.statCard}>
        <div style={styles.statLabel}>Current Streak</div>
        <div style={{ ...styles.statValue, color: streakColor }}>
          {stats.streak > 0
            ? `${stats.streak}${stats.streakType === "Win" ? " 🔥" : " 📉"}`
            : "—"}
        </div>
        <div style={styles.statSub}>
          {stats.streakType || "no closed trades"}
        </div>
      </div>
    </div>
  );
}

// ─── QuickClose ───────────────────────────────────────────────────────────────

function QuickClose({ logId, onClose }) {
  const [exit, setExit] = useState("");
  const [pnl, setPnl] = useState("");
  const [outcome, setOutcome] = useState("Win");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        type="button"
        style={{
          ...cardButtonReset,
          width: "auto",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          borderRadius: 10,
          border: "1px solid rgba(74,222,128,0.3)",
          background: "rgba(74,222,128,0.07)",
          color: palette.long,
          fontSize: 12,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        ✓ Close Trade
      </button>
    );
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr auto auto",
        gap: 8,
        alignItems: "end",
        padding: "10px 12px",
        borderRadius: 12,
        border: `1px solid ${palette.border}`,
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <FieldLabel label="Exit Price">
        <input
          style={{ ...fieldStyle, fontSize: 13 }}
          value={exit}
          onChange={(e) => setExit(e.target.value)}
          placeholder="e.g. 1638.50"
        />
      </FieldLabel>
      <FieldLabel label="PnL ($)">
        <input
          style={{ ...fieldStyle, fontSize: 13 }}
          value={pnl}
          onChange={(e) => setPnl(e.target.value)}
          placeholder="e.g. 142.50"
        />
      </FieldLabel>
      <FieldLabel label="Outcome">
        <select
          style={{ ...fieldStyle, fontSize: 13 }}
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
        >
          {["Win", "Loss", "Scratch"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </FieldLabel>
      <div style={{ display: "flex", gap: 6, paddingBottom: 1 }}>
        <button
          type="button"
          onClick={() => {
            if (exit || pnl)
              onClose(
                logId,
                Number(exit) || null,
                outcome,
                Number(pnl) || null,
              );
            setOpen(false);
          }}
          style={{
            border: "none",
            borderRadius: 10,
            padding: "9px 14px",
            background: "linear-gradient(135deg,#22c55e,#16a34a)",
            color: "#fff",
            fontWeight: 900,
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            border: `1px solid ${palette.border}`,
            borderRadius: 10,
            padding: "9px 12px",
            background: "rgba(255,255,255,0.04)",
            color: palette.textSoft,
            fontWeight: 800,
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = {
  app: {
    minHeight: "100vh",
    color: palette.text,
    background: `radial-gradient(circle at 15% 20%, rgba(239,68,68,0.10), transparent 40%), radial-gradient(circle at 85% 15%, rgba(239,68,68,0.06), transparent 35%), linear-gradient(180deg, ${palette.bg2} 0%, ${palette.bg} 60%, #020409 100%)`,
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  shell: {
    width: "100%",
    maxWidth: "100%",
    margin: 0,
    padding: "14px 16px",
    display: "grid",
    gap: 10,
  },
  button: {
    border: `1px solid ${palette.border}`,
    cursor: "pointer",
    borderRadius: 12,
    padding: "9px 14px",
    fontWeight: 800,
    background:
      "linear-gradient(180deg,rgba(20,27,42,0.96),rgba(12,17,28,0.96))",
    color: palette.text,
    fontSize: 13,
    transition: "opacity 0.15s ease",
  },
  smallButton: {
    padding: "4px 9px",
    fontSize: 11,
    borderRadius: 8,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#cbd5f5",
    textDecoration: "none",
    whiteSpace: "nowrap",
  },
  primaryButton: {
    border: "none",
    cursor: "pointer",
    borderRadius: 12,
    padding: "9px 16px",
    fontWeight: 900,
    background: "linear-gradient(135deg,#ff2f2f 0%,#c71f1f 100%)",
    color: "#fff",
    boxShadow: "0 10px 24px rgba(239,68,68,0.25)",
    fontSize: 13,
  },
  topbar: {
    display: "grid",
    gap: 10,
    padding: "12px 16px",
    borderRadius: 22,
    border: `1px solid ${palette.border}`,
    background: palette.panel,
    boxShadow: "0 14px 44px rgba(0,0,0,0.38)",
  },
  topbarRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  brandWrap: { display: "flex", alignItems: "center", gap: 14 },
  brandIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    display: "grid",
    placeItems: "center",
    border: "1px solid rgba(239,68,68,0.35)",
    background: "rgba(239,68,68,0.08)",
    color: palette.accent,
    fontWeight: 900,
    fontSize: 14,
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "260px 1fr 290px",
    gap: 12,
    width: "100%",
    alignItems: "stretch",
    height: "clamp(600px,73vh,800px)",
  },
  panel: {
    borderRadius: 20,
    border: `1px solid ${palette.border}`,
    background:
      "linear-gradient(180deg,rgba(14,20,32,0.97),rgba(9,13,23,0.97))",
    boxShadow: "0 0 0 1px rgba(255,255,255,0.03),0 12px 28px rgba(0,0,0,0.3)",
    padding: 0,
    display: "grid",
    minWidth: 0,
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "12px 14px",
    borderBottom: `1px solid ${palette.borderSoft}`,
  },
  panelBody: { padding: 12, display: "grid", gap: 10 },
  subtext: { fontSize: 12, color: palette.textSoft, marginTop: 2 },
  radarList: {
    display: "grid",
    gap: 8,
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
    alignContent: "start",
    minHeight: 0,
    paddingRight: 4,
    paddingBottom: 12,
  },
  exchangeBar: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    padding: "7px 8px",
    borderRadius: 12,
    border: `1px solid ${palette.borderSoft}`,
    background: "rgba(0,0,0,0.2)",
  },
  exchangeLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    fontWeight: 800,
    letterSpacing: 0.5,
  },
  waveCard: {
    borderRadius: 14,
    padding: "10px 12px",
    background: "rgba(10,14,22,0.92)",
    border: `1px solid ${palette.border}`,
    transition: "all 0.15s ease",
    cursor: "pointer",
  },
  chartFrame: {
    borderRadius: 18,
    border: `1px solid ${palette.border}`,
    overflow: "hidden",
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
    padding: "12px 14px",
    borderBottom: `1px solid ${palette.borderSoft}`,
    flexWrap: "wrap",
  },
  topCardRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4,minmax(0,1fr))",
    gap: 10,
  },
  tickerWrap: {
    borderRadius: 14,
    border: `1px solid ${palette.border}`,
    background: "rgba(0,0,0,0.45)",
    overflow: "hidden",
  },
  tickerViewport: { overflow: "hidden", width: "100%" },
  tickerTrack: {
    display: "flex",
    gap: 12,
    width: "max-content",
    padding: "9px 14px",
    animation: "tickerScroll 32s linear infinite",
  },
  aiPanel: {
    borderRadius: 22,
    border: `1px solid ${palette.border}`,
    background: palette.panel,
    overflow: "hidden",
  },
  aiHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    borderBottom: `1px solid ${palette.borderSoft}`,
    flexWrap: "wrap",
  },
  aiEyebrow: {
    fontSize: 10,
    color: palette.textDim,
    letterSpacing: 2.5,
    textTransform: "uppercase",
  },
  aiTitle: { fontSize: 17, fontWeight: 900, marginTop: 4 },
  aiBody: { padding: 12, display: "grid", gap: 12 },
  aiSummaryCard: {
    border: `1px solid ${palette.border}`,
    background: palette.card,
    borderRadius: 14,
    padding: 13,
    fontSize: 13,
    lineHeight: 1.6,
  },
  aiLabel: {
    fontSize: 10,
    color: palette.textDim,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: 800,
  },
  aiBreakdownGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3,minmax(0,1fr))",
    gap: 10,
  },
  aiTwoCol: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
    gap: 10,
  },
  aiListCard: {
    border: `1px solid ${palette.border}`,
    background: palette.card,
    borderRadius: 14,
    padding: 13,
    display: "grid",
    gap: 10,
  },
  aiList: { display: "grid", gap: 8 },
  aiListItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    fontSize: 13,
    color: palette.textSoft,
    lineHeight: 1.45,
  },
  aiBulletGood: { color: palette.long, fontSize: 12, marginTop: 2 },
  aiBulletBad: { color: palette.short, fontSize: 12, marginTop: 2 },
  aiEmpty: { fontSize: 12, color: palette.textDim },
  aiMetaRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  statCard: {
    border: `1px solid ${palette.border}`,
    background: palette.card,
    borderRadius: 16,
    padding: "12px 14px",
    display: "grid",
    gap: 5,
  },
  statLabel: {
    fontSize: 10,
    color: palette.textDim,
    textTransform: "uppercase",
    letterSpacing: 0.9,
    fontWeight: 800,
  },
  statValue: { fontSize: 22, fontWeight: 900 },
  statSub: { fontSize: 11, color: palette.textSoft },
};

// ─── auth helpers ─────────────────────────────────────────────────────────────

function getStoredToken() {
  try {
    return localStorage.getItem("token") || "";
  } catch {
    return "";
  }
}

function apiFetch(path, options = {}, token = "") {
  const resolvedToken = token || getStoredToken();
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };
  if (resolvedToken) headers.Authorization = `Bearer ${resolvedToken}`;
  return fetch(`${API_BASE}${path}`, { ...options, headers }).then(
    async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("liquidity_lab_token");
          throw new Error("AUTH_EXPIRED");
        }
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      return data;
    },
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function AppPreBeta() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [logMode, setLogMode] = useState("event");
  const [showAdvancedForm, setShowAdvancedForm] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(
    Boolean(getStoredToken()),
  );
  const [hoveredWave, setHoveredWave] = useState(null);
  const [hoveredLogId, setHoveredLogId] = useState(null);
  const [currentUser, setCurrentUser] = useState({
    email: "",
    billingPlan: "starter",
    stripeStatus: "",
    stripeCustomerId: "",
    screenshotRemaining: 5,
  });
  const [featureFlags, setFeatureFlags] = useState(DEFAULT_FEATURE_FLAGS);
  const [chartReloadKey, setChartReloadKey] = useState(0);
  const chartTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);

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
    pair: "",
    manualStructure: "",
    manualConfidence: "",
  });

  const isEventLocked = logMode === "event";
  const lockedFieldStyle = {
    ...fieldStyle,
    opacity: 0.65,
    cursor: "not-allowed",
    background: "rgba(255,255,255,0.02)",
  };

  const [loggedDecisions, setLoggedDecisions] = useState([]);
  const [toasts, setToasts] = useState([]);
  const toastTimersRef = useRef({});
  const [aiReviewResult, setAiReviewResult] = useState(null);
  const [aiRemaining, setAiRemaining] = useState(null);
  const [aiReviewLoading, setAiReviewLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    email: "",
    password: "",
    confirm: "",
  });

  const [filterOffHours, setFilterOffHours] = useState(() => {
    try {
      return localStorage.getItem("filterOffHours") === "true";
    } catch {
      return false;
    }
  });

  function isOffHours() {
    const hour = new Date().getUTCHours();
    return !(hour >= 7 && hour < 22);
  }

  const MAJOR_PAIRS = [
    "BTC/USDT",
    "ETH/USDT",
    "SOL/USDT",
    "XRP/USDT",
    "DOGE/USDT",
    "LINK/USDT",
    "AVAX/USDT",
    "BNB/USDT",
    "ADA/USDT",
  ];

  const [authTab, setAuthTab] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("register")
        ? "register"
        : "login";
    } catch {
      return "login";
    }
  });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [propAccount, setPropAccount] = useState({
    presetId: "ftmo_like",
    accountSize: 50000,
    phase: "Phase 1",
  });
  const betaUnlocked = true;

  function toggleLogCard(id) {
    setExpandedLogId((prev) => (prev === id ? null : id));
  }

  useEffect(() => {
    if (!getStoredToken()) {
      setIsAuthenticated(false);
      setActiveTab("login");
    }
  }, []);

  useEffect(() => {
    async function loadLogs() {
      if (!getStoredToken()) return;
      try {
        const data = await apiFetch("/logs");
        setLoggedDecisions(data?.logs || []);
      } catch {}
    }
    loadLogs();
  }, [isAuthenticated]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (chartTimeoutRef.current) clearTimeout(chartTimeoutRef.current);
      Object.values(toastTimersRef.current).forEach(clearTimeout);
    };
  }, []);

  function toast(message, type = "info") {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      3200,
    );
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
        if (!getStoredToken()) return;
        const me = await apiFetch("/me").catch((err) => {
          if (err.message === "AUTH_EXPIRED") {
            setIsAuthenticated(false);
            setCurrentUser(null);
            setActiveTab("login");
          }
          return null;
        });
        if (!me) return;
        const profile = me.user || me.profile || me;
        setIsAuthenticated(true);
        if (profile?.aiRemaining !== undefined)
          setAiRemaining(profile.aiRemaining);
        setCurrentUser({
          email: profile.email || "",
          billingPlan: profile.billingPlan || "starter",
          stripeStatus: profile.stripeStatus || "inactive",
          stripeCustomerId: profile.stripeCustomerId || "",
          screenshotRemaining:
            typeof profile.screenshotRemaining === "number"
              ? profile.screenshotRemaining
              : 5,
        });
        setFeatureFlags({
          manualJournal: true,
          aiReview: Boolean(profile?.featureFlags?.aiReview),
          screenshotReview: Boolean(profile?.featureFlags?.screenshotReview),
          export: Boolean(profile?.featureFlags?.export),
          deeperStats: Boolean(profile?.featureFlags?.deeperStats),
        });
      } catch {}
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
          if (!normalized.length) return prev;
          if (!prev) return normalized[0];
          const match = normalized.find(
            (evt) => eventKey(evt) === eventKey(prev),
          );
          return match || normalized[0] || prev;
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
    if (selectedEvent && logMode === "event") {
      setDecisionForm((prev) => ({
        ...prev,
        pair: selectedEvent?.pair || prev.pair,
        timeframe: selectedEvent?.timeframe || prev.timeframe,
        session: selectedEvent?.session || prev.session,
        directionBias: selectedEvent?.directionBias || prev.directionBias,
        eventType: selectedEvent?.eventType || prev.eventType,
        sweepType: selectedEvent?.sweepType || prev.sweepType,
        emaContext: selectedEvent?.emaContext || prev.emaContext,
        entry:
          selectedEvent?.entry != null
            ? sanitizePrice(selectedEvent.entry)
            : prev.entry,
        stop:
          selectedEvent?.stop != null
            ? sanitizePrice(selectedEvent.stop)
            : prev.stop,
        tp1:
          selectedEvent?.tp1 != null
            ? sanitizePrice(selectedEvent.tp1)
            : prev.tp1,
        tp2:
          selectedEvent?.tp2 != null
            ? sanitizePrice(selectedEvent.tp2)
            : prev.tp2,
      }));
    }
  }, [selectedEvent, logMode]);

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

  // Use selectedEvent directly — no stale chartEvent state (BUG FIX)
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
  const basePair = chartPair.replace(":USDT", "").replace("/", "");
  const dashPair = chartPair.replace(":USDT", "").replace("/", "-");

  const exchangeLinks = {
    blofin: `https://blofin.com/futures/${dashPair}`,
    binance: `https://www.binance.com/en/futures/${basePair}`,
    bybit: `https://www.bybit.com/trade/usdt/${basePair}`,
    okx: `https://www.okx.com/trade-swap/${dashPair.toLowerCase()}-swap`,
    tradingView: `https://www.tradingview.com/chart/?symbol=BINANCE:${basePair}`,
  };

  // chartSrc memo now depends on chartSymbol + chartInterval so it rebuilds on pair change (BUG FIX)
  const chartSrc = useMemo(
    () =>
      "https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart" +
      `&symbol=${encodeURIComponent(chartSymbol)}` +
      `&interval=${encodeURIComponent(chartInterval)}` +
      "&hidesidetoolbar=1&symboledit=1&saveimage=0&toolbarbg=F1F3F6&studies=[]&theme=dark&style=1&timezone=Etc%2FUTC&withdateranges=1",
    [chartSymbol, chartInterval, chartReloadKey],
  );

  const waves = useMemo(() => groupWaves(events), [events]);

  const activeWaves = useMemo(() => {
    return waves
      .map((wave) => {
        const freshEvents = (wave.events || []).filter(
          (evt) => getSignalState(evt.timestampUtc, evt.tradeState) !== "EXPIRED",
        );
        if (!freshEvents.length) return null;
        return {
          ...wave,
          events: freshEvents,
          state: getSignalState(
            freshEvents[0]?.timestampUtc,
            freshEvents[0]?.tradeState,
          ),
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const rank = { LIVE: 0, AGING: 1, EXPIRED: 2 };
        const aR = rank[a.state] ?? 9,
          bR = rank[b.state] ?? 9;
        if (aR !== bR) return aR - bR;
        return (
          parseEventDate(b.events?.[0]?.timestampUtc).getTime() -
          parseEventDate(a.events?.[0]?.timestampUtc).getTime()
        );
      });
  }, [waves]);

  const visibleWaves = useMemo(() => {
    const byPair = new Map();
    activeWaves.forEach((wave) => {
      const key = `${wave.pair}|${wave.directionBias}`;
      const existing = byPair.get(key);
      if (!existing) {
        byPair.set(key, wave);
        return;
      }
      const wt = parseEventDate(wave.events?.[0]?.timestampUtc).getTime();
      const et = parseEventDate(existing.events?.[0]?.timestampUtc).getTime();
      if (wt > et) byPair.set(key, wave);
    });
    let result = Array.from(byPair.values());
    if (filterOffHours && isOffHours()) {
      result = result.filter((w) => MAJOR_PAIRS.includes(w.pair));
    }
    return result.slice(0, 10);
  }, [activeWaves, filterOffHours]);

  const tickerItems = useMemo(() => bestTickerItems(waves, 10), [waves]);

  const activePreset = useMemo(
    () =>
      PROP_PRESETS.find((p) => p.id === propAccount.presetId) ||
      PROP_PRESETS[0],
    [propAccount.presetId],
  );

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

  const propStatus = useMemo(() => {
    if (!propAccount.accountSize || activePreset.id === "none")
      return {
        enabled: false,
        status: "OFF",
        tone: "neutral",
        dailyLoss: 0,
        maxDrawdown: 0,
        target: 0,
      };
    const rules = activePreset.rules;
    const size = Number(propAccount.accountSize) || 0;
    const dailyLoss = size * rules.dailyLossPct,
      maxDrawdown = size * rules.maxDrawdownPct,
      target = size * rules.profitTargetPct;
    const riskPerTrade = Math.abs(
      (Number(decisionForm.entry) || 0) - (Number(decisionForm.stop) || 0),
    );
    const dailyUsage = dailyLoss ? riskPerTrade / dailyLoss : 0;
    const totalUsage = maxDrawdown ? riskPerTrade / maxDrawdown : 0;
    let status = "PASS",
      tone = "long";
    if (dailyUsage > 0.75 || totalUsage > 0.4) {
      status = "FAIL RISK";
      tone = "short";
    } else if (dailyUsage > 0.35 || totalUsage > 0.2) {
      status = "WARNING";
      tone = "gold";
    }
    return { enabled: true, status, tone, dailyLoss, maxDrawdown, target };
  }, [
    activePreset,
    propAccount.accountSize,
    decisionForm.entry,
    decisionForm.stop,
  ]);

  const selectedEventRR = useMemo(
    () =>
      calcPlannedRR(
        selectedEvent?.entry,
        selectedEvent?.stop,
        selectedEvent?.tp1,
        selectedEvent?.tp2,
        selectedEvent?.rr1,
        selectedEvent?.rr2,
      ),
    [selectedEvent],
  );
  const decisionRealizedRR = useMemo(
    () =>
      calcRealizedRR(
        decisionForm.directionBias,
        decisionForm.entry,
        decisionForm.stop,
        decisionForm.exit,
      ),
    [
      decisionForm.directionBias,
      decisionForm.entry,
      decisionForm.stop,
      decisionForm.exit,
    ],
  );
  // BUG FIX: use selectedEvent RR values as fallback when form values don't calc cleanly
  const decisionPlannedRR = useMemo(
    () =>
      calcPlannedRR(
        Number(decisionForm.entry) || null,
        Number(decisionForm.stop) || null,
        Number(decisionForm.tp1) || null,
        Number(decisionForm.tp2) || null,
        selectedEvent?.rr1,
        selectedEvent?.rr2,
      ),
    [
      decisionForm.entry,
      decisionForm.stop,
      decisionForm.tp1,
      decisionForm.tp2,
      selectedEvent,
    ],
  );
  const decisionRiskAmount = useMemo(
    () => calcRiskAmount(decisionForm.entry, decisionForm.stop),
    [decisionForm.entry, decisionForm.stop],
  );

  function updateDecision(field, value) {
    setDecisionForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleScreenshotUpload(event) {
    const allowed =
      betaUnlocked ||
      featureFlags?.screenshotReview ||
      currentUser?.stripeStatus === "beta";
    if (!allowed) {
      toast("Upgrade required for screenshot review.", "warn");
      if (event?.target) event.target.value = "";
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;
    if (decisionForm.screenshot && decisionForm.screenshot.startsWith("blob:"))
      URL.revokeObjectURL(decisionForm.screenshot);
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

  // BUG FIX: selectWaveHead bumps chartReloadKey to force iframe remount with correct symbol
  function selectWaveHead(wave) {
    const head = wave?.events?.[0];
    if (head) {
      setSelectedEvent(head);
      setChartReloadKey((k) => k + 1);
    }
  }

  async function registerUser() {
    if (!registerForm.email || !registerForm.password) {
      setAuthError("Email and password are required.");
      return;
    }
    if (registerForm.password !== registerForm.confirm) {
      setAuthError("Passwords don't match.");
      return;
    }
    if (registerForm.password.length < 8) {
      setAuthError("Password must be at least 8 characters.");
      return;
    }
    try {
      setAuthLoading(true);
      setAuthError("");
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: registerForm.email.trim(),
          password: registerForm.password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Registration failed");
      try {
        localStorage.setItem("token", data.token || "");
        localStorage.setItem("user", JSON.stringify(data.user || {}));
      } catch {}
      setIsAuthenticated(true);
      setActiveTab("dashboard");
      toast("Welcome to Liquidity Lab!", "success");
    } catch (err) {
      setAuthError(err.message || "Registration failed");
    } finally {
      setAuthLoading(false);
    }
  }

  async function reportIssue() {
    try {
      const payload = {
        timestamp: new Date().toISOString(),
        page: window.location.href,
        selectedPair: selectedEvent?.pair || decisionForm?.pair || "",
        userEmail: currentUser?.email || "",
        notes: "User clicked quick issue report",
      };
      const res = await fetch(`${API_BASE}/bug-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      toast("Issue report sent. Thank you.", "success");
    } catch (err) {
      toast(err.message || "Issue report failed", "warn");
    }
  }

  async function loginUser() {
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginForm.email.trim(),
          password: loginForm.password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Login failed");
      try {
        localStorage.setItem("token", data.token || "");
        localStorage.setItem("user", JSON.stringify(data.user || {}));
      } catch {}
      setIsAuthenticated(true);
      setActiveTab("dashboard");
      toast("Welcome back!", "success");
    } catch (err) {
      setAuthError(err.message || "Login failed");
    }
  }

  async function runAiReviewNow() {
    try {
      const token = getStoredToken();
      if (!token) {
        toast("Please log in first", "warn");
        return;
      }
      setAiReviewLoading(true);
      const payload = {
        pair: decisionForm?.pair || selectedEvent?.pair || "",
        timeframe: decisionForm?.timeframe || selectedEvent?.timeframe || "",
        directionBias:
          decisionForm?.directionBias || selectedEvent?.directionBias || "",
        screenshotBase64: decisionForm?.screenshotBase64 || "",
        screenshotMimeType: decisionForm?.screenshotMimeType || "image/png",
        screenshotUrl: decisionForm?.screenshot || "",
        entry: decisionForm?.entry ?? selectedEvent?.entry ?? "",
        stop: decisionForm?.stop ?? selectedEvent?.stop ?? "",
        exit: decisionForm?.exit ?? "",
        tp1: decisionForm?.tp1 ?? selectedEvent?.tp1 ?? "",
        tp2: decisionForm?.tp2 ?? selectedEvent?.tp2 ?? "",
        action: decisionForm?.action || "Taken",
        timing: decisionForm?.timing || "On Confirmation",
        planFollowed: decisionForm?.planFollowed || "Yes",
        ruleBreak: decisionForm?.ruleBreak || "None",
        setupQuality: decisionForm?.setupQuality ?? "",
        disciplineScore: decisionForm?.disciplineScore ?? "",
        emotionalPressure: decisionForm?.emotionalPressure ?? "",
        notes: decisionForm?.notes || "",
        session: decisionForm?.session || selectedEvent?.session || "",
        sweepType: decisionForm?.sweepType || selectedEvent?.sweepType || "",
        eventType: decisionForm?.eventType || selectedEvent?.eventType || "",
        emaContext: decisionForm?.emaContext || selectedEvent?.emaContext || "",
        botConfidence: selectedEvent?.botConfidence ?? "",
        confidenceSelf: decisionForm?.confidenceSelf ?? "",
        outcome: decisionForm?.outcome || "",
        pnl: decisionForm?.pnl || "",
      };
      const res = await fetch(`${API_BASE}/ai-review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ trade: payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "AI review failed");
      setAiReviewResult(data.ai || data.review || null);
      if (data.aiRemaining !== undefined) setAiRemaining(data.aiRemaining);
      toast("AI review complete", "success");
    } catch (err) {
      toast(err.message || "AI review failed", "warn");
    } finally {
      setAiReviewLoading(false);
    }
  }

  function handleExportLogs() {
    if (!requireFeature("export", "Upgrade required for exporting logs."))
      return;
    const blob = new Blob([JSON.stringify(loggedDecisions, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "liquidity-lab-logs.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function saveDecision() {
    if (!getStoredToken()) {
      toast("Login required to save logs.", "warn");
      return;
    }
    const payload = {
      pair:
        logMode === "manual"
          ? (decisionForm.pair || "").trim() || "Manual"
          : selectedEvent?.pair || (decisionForm.pair || "").trim() || "Manual",
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
      confidenceSelf:
        logMode === "manual"
          ? Number(decisionForm.manualConfidence || decisionForm.confidenceSelf)
          : Number(decisionForm.confidenceSelf),
      executionType: decisionForm.executionType,
      liquidityLevel:
        logMode === "manual"
          ? decisionForm.manualStructure || decisionForm.liquidityLevel
          : decisionForm.liquidityLevel,
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
      linkedRadarEvent:
        logMode === "event" && selectedEvent
          ? {
              pair: selectedEvent.pair,
              timeframe: selectedEvent.timeframe,
              eventType: selectedEvent.eventType,
              directionBias: selectedEvent.directionBias,
              botConfidence: selectedEvent.botConfidence,
              timestampUtc: selectedEvent.timestampUtc,
            }
          : null,
      reclaimConfirmed: Boolean(selectedEvent?.reclaimConfirmed),
      aiRequested: Boolean(featureFlags.aiReview),
    };

    let serverAi = {};
    let serverLog = null;
    try {
      const response = await apiFetch("/logs", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      serverLog = response?.log || null;
      serverAi =
        response?.aiAnalysis || response?.analysis || response?.ai || {};
      setCurrentUser((prev) => ({
        ...prev,
        screenshotRemaining:
          typeof response?.screenshotRemaining === "number"
            ? response.screenshotRemaining
            : prev.screenshotRemaining,
      }));
    } catch (err) {
      const msg = String(err?.message || "");
      if (msg.toLowerCase().includes("daily screenshot limit")) {
        toast("Daily screenshot limit reached", "warn");
      } else if (msg.toLowerCase().includes("log limit reached")) {
        toast("Log limit reached. Upgrade to log more trades.", "warn");
        setActiveTab("billing");
      } else {
        toast(`Log save failed: ${msg}`, "warn");
      }
      return;
    }

    const rr = calcPlannedRR(
      payload.entry,
      payload.stop,
      payload.tp1,
      payload.tp2,
      selectedEvent?.rr1,
      selectedEvent?.rr2,
    );
    const baseEntry = {
      id: serverLog?.id || `${Date.now()}_${Math.random()}`,
      timestamp: serverLog?.createdAt || new Date().toISOString(),
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
      rr1: rr.rr1,
      rr2: rr.rr2,
      exit: payload.exit,
      realizedRR: calcRealizedRR(
        payload.directionBias,
        payload.entry,
        payload.stop,
        payload.exit,
      ),
      pnl: payload.pnl,
      notes: payload.notes,
      screenshot: payload.screenshotUrl,
      aiStatus: "complete",
      aiScore: serverAi?.overallScore ?? serverAi?.score ?? null,
      aiGrade: serverAi?.overallGrade ?? serverAi?.grade ?? null,
      aiSummary: serverAi?.summary || "Trade logged.",
      aiVerdict:
        serverAi?.verdict ||
        serverAi?.tradeVerdict ||
        serverAi?.executionAssessment ||
        "",
      aiCoachingNote:
        serverAi?.coachingTip ||
        serverAi?.coachingNote ||
        "Continue following your rules.",
      aiStrengths: serverAi?.strengths || serverAi?.whatWasGood || [],
      aiMistakes: serverAi?.mistakes || serverAi?.whatNeedsWork || [],
      setupScore: serverAi?.setupScore ?? null,
      executionScore: serverAi?.executionScore ?? null,
      managementScore: serverAi?.managementScore ?? null,
      chartRead: serverAi?.chartRead || "",
      setupAssessment: serverAi?.setupAssessment || "",
      executionAssessment: serverAi?.executionAssessment || "",
      riskAssessment: serverAi?.riskAssessment || "",
      biasAlignment: serverAi?.biasAlignment || "",
      whatWasGood: serverAi?.whatWasGood || [],
      whatNeedsWork: serverAi?.whatNeedsWork || [],
      usedScreenshot: Boolean(payload.screenshotUrl),
    };

    const finalEntry = featureFlags.aiReview
      ? baseEntry
      : {
          ...baseEntry,
          aiStatus: "locked",
          aiScore: null,
          aiGrade: null,
          aiSummary: "AI Review is locked.",
          aiVerdict: "",
          aiCoachingNote: "Upgrade to unlock AI coaching.",
          aiStrengths: [],
          aiMistakes: [],
          setupScore: null,
          executionScore: null,
          managementScore: null,
          usedScreenshot: false,
        };
    setLoggedDecisions((prev) => [finalEntry, ...prev].slice(0, 60));
    setExpandedLogId(finalEntry.id);
    toast(
      finalEntry.aiGrade
        ? `Decision logged · Grade ${finalEntry.aiGrade}`
        : "Decision logged",
      "success",
    );

    // Reset volatile fields, keep context
    setDecisionForm((prev) => ({
      ...prev,
      entry: logMode === "event" ? prev.entry : "",
      stop: logMode === "event" ? prev.stop : "",
      tp1: logMode === "event" ? prev.tp1 : "",
      tp2: logMode === "event" ? prev.tp2 : "",
      exit: "",
      pnl: "",
      notes: "",
      screenshot: "",
      screenshotBase64: "",
      screenshotMimeType: "",
      outcome: "Open",
      ruleBreak: "None",
      disciplineScore: "8",
      setupQuality: "8",
      emotionalPressure: "3",
      confidenceSelf: "7",
    }));
    setAiReviewResult(null);
  }

  const displayDecisions = showInsights
    ? loggedDecisions
    : loggedDecisions.slice(0, 5);

  if (!isAuthenticated) {
    return (
      <div
        style={{
          ...styles.app,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: "fixed",
            inset: 0,
            background:
              "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(239,68,68,0.12), transparent)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{ width: "min(420px,100%)", position: "relative", zIndex: 1 }}
        >
          {/* Brand */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  ...styles.brandIcon,
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  fontSize: 15,
                }}
              >
                ROS
              </div>
              <div style={{ textAlign: "left" }}>
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
                <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.1 }}>
                  Liquidity Lab
                </div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: palette.textSoft }}>
              {authTab === "login"
                ? "Sign in to your account"
                : "Create your free account — no card required"}
            </div>
          </div>

          {/* Card */}
          <div
            style={{
              border: `1px solid ${palette.border}`,
              borderRadius: 22,
              background: palette.panel,
              overflow: "hidden",
              boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
            }}
          >
            {/* Tabs */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                borderBottom: `1px solid ${palette.border}`,
              }}
            >
              {["login", "register"].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setAuthTab(tab);
                    setAuthError("");
                  }}
                  style={{
                    appearance: "none",
                    border: "none",
                    padding: "14px",
                    background: "none",
                    color: authTab === tab ? palette.text : palette.textDim,
                    fontWeight: authTab === tab ? 800 : 600,
                    fontSize: 13,
                    cursor: "pointer",
                    borderBottom:
                      authTab === tab
                        ? `2px solid ${palette.accent}`
                        : "2px solid transparent",
                    transition: "all 0.15s",
                  }}
                >
                  {tab === "login" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>

            <div style={{ padding: 24, display: "grid", gap: 14 }}>
              {authError && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    color: "#f87171",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {authError}
                </div>
              )}

              {authTab === "login" ? (
                <>
                  <div style={{ display: "grid", gap: 10 }}>
                    <FieldLabel label="Email">
                      <input
                        style={fieldStyle}
                        placeholder="you@example.com"
                        type="email"
                        value={loginForm.email}
                        onChange={(e) => {
                          setLoginForm((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }));
                          setAuthError("");
                        }}
                      />
                    </FieldLabel>
                    <FieldLabel label="Password">
                      <input
                        style={fieldStyle}
                        placeholder="Your password"
                        type="password"
                        value={loginForm.password}
                        onChange={(e) => {
                          setLoginForm((prev) => ({
                            ...prev,
                            password: e.target.value,
                          }));
                          setAuthError("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") loginUser();
                        }}
                      />
                    </FieldLabel>
                  </div>
                  <button
                    style={{
                      ...styles.primaryButton,
                      opacity: authLoading ? 0.7 : 1,
                    }}
                    type="button"
                    onClick={async () => {
                      setAuthLoading(true);
                      setAuthError("");
                      try {
                        await loginUser();
                      } catch (e) {
                        setAuthError(e.message);
                      } finally {
                        setAuthLoading(false);
                      }
                    }}
                  >
                    {authLoading ? "Signing in…" : "Sign In →"}
                  </button>
                  <div
                    style={{
                      textAlign: "center",
                      fontSize: 12,
                      color: palette.textDim,
                    }}
                  >
                    No account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthTab("register");
                        setAuthError("");
                      }}
                      style={{
                        appearance: "none",
                        border: "none",
                        background: "none",
                        color: palette.accent,
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Create one free
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: "grid", gap: 10 }}>
                    <FieldLabel label="Email">
                      <input
                        style={fieldStyle}
                        placeholder="you@example.com"
                        type="email"
                        value={registerForm.email}
                        onChange={(e) => {
                          setRegisterForm((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }));
                          setAuthError("");
                        }}
                      />
                    </FieldLabel>
                    <FieldLabel label="Password">
                      <input
                        style={fieldStyle}
                        placeholder="At least 8 characters"
                        type="password"
                        value={registerForm.password}
                        onChange={(e) => {
                          setRegisterForm((prev) => ({
                            ...prev,
                            password: e.target.value,
                          }));
                          setAuthError("");
                        }}
                      />
                    </FieldLabel>
                    <FieldLabel label="Confirm Password">
                      <input
                        style={fieldStyle}
                        placeholder="Repeat password"
                        type="password"
                        value={registerForm.confirm}
                        onChange={(e) => {
                          setRegisterForm((prev) => ({
                            ...prev,
                            confirm: e.target.value,
                          }));
                          setAuthError("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") registerUser();
                        }}
                      />
                    </FieldLabel>
                  </div>
                  <button
                    style={{
                      ...styles.primaryButton,
                      background: "linear-gradient(135deg,#22c55e,#16a34a)",
                      boxShadow: "0 10px 24px rgba(34,197,94,0.25)",
                      opacity: authLoading ? 0.7 : 1,
                    }}
                    type="button"
                    onClick={registerUser}
                  >
                    {authLoading
                      ? "Creating account…"
                      : "Create Free Account →"}
                  </button>
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: 12,
                      background: "rgba(74,222,128,0.06)",
                      border: "1px solid rgba(74,222,128,0.15)",
                      fontSize: 12,
                      color: palette.textSoft,
                      lineHeight: 1.5,
                    }}
                  >
                    ✓ Free forever · No card required · Live radar + journal
                    included
                  </div>
                  <div
                    style={{
                      textAlign: "center",
                      fontSize: 12,
                      color: palette.textDim,
                    }}
                  >
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthTab("login");
                        setAuthError("");
                      }}
                      style={{
                        appearance: "none",
                        border: "none",
                        background: "none",
                        color: palette.accent,
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Sign in
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div
            style={{
              textAlign: "center",
              marginTop: 20,
              fontSize: 11,
              color: palette.textDim,
            }}
          >
            By creating an account you agree to our terms of service.{" "}
            <a
              href="https://www.redoctobersystems.com"
              style={{ color: palette.textDim }}
            >
              ← Back to site
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === "vault") {
    return (
      <div style={styles.app}>
        <MembersVault
          onBack={() => setActiveTab("dashboard")}
          currentUser={currentUser}
          featureFlags={featureFlags}
        />
      </div>
    );
  }

  if (activeTab === "billing") {
    return (
      <div style={styles.app}>
        <BillingPage
          token={getStoredToken()}
          compact={false}
          onBack={() => setActiveTab("dashboard")}
        />
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <MobileStyles />
      <div style={styles.shell} className="llab-shell">
        {/* TOP BAR — slim sticky nav matching vault style */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 100,
            borderBottom: `1px solid ${palette.border}`,
            background: "rgba(3,6,11,0.92)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            height: 52,
            gap: 0,
            margin: "-14px -16px 0",
            padding: "0 16px",
          }}
        >
          {/* Brand */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              paddingRight: 20,
              borderRight: `1px solid ${palette.border}`,
              height: "100%",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                ...styles.brandIcon,
                width: 32,
                height: 32,
                borderRadius: 10,
                fontSize: 12,
              }}
            >
              ROS
            </div>
            <div>
              <div
                style={{
                  fontSize: 9,
                  color: palette.textDim,
                  letterSpacing: 2.5,
                  textTransform: "uppercase",
                }}
              >
                Red October Systems
              </div>
              <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.1 }}>
                Liquidity Lab
              </div>
            </div>
          </div>

          {/* Status pills */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "0 16px",
              borderRight: `1px solid ${palette.border}`,
              height: "100%",
              flexShrink: 0,
            }}
          >
            <Pill tone={propStatus.tone}>{propStatus.status}</Pill>
            <Pill tone="neutral">
              {(currentUser?.billingPlan || "starter").toUpperCase()}
            </Pill>
            {aiRemaining != null && <Pill tone="gold">{aiRemaining} AI</Pill>}
          </div>

          {/* Nav links */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flex: 1,
              height: "100%",
              padding: "0 8px",
            }}
          >
            {[
              {
                label: "Dashboard",
                action: () => setActiveTab("dashboard"),
                active: activeTab === "dashboard",
              },
              {
                label: "Members Vault",
                action: () => setActiveTab("vault"),
                active: activeTab === "vault",
                gold: true,
              },
              {
                label: "Billing",
                action: () => setActiveTab("billing"),
                active: activeTab === "billing",
              },
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                type="button"
                style={{
                  appearance: "none",
                  border: "none",
                  background: "none",
                  color: item.gold
                    ? "#f6c453"
                    : item.active
                      ? palette.text
                      : palette.textDim,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: item.active ? 800 : 600,
                  padding: "0 14px",
                  height: "100%",
                  borderBottom: item.active
                    ? `2px solid ${item.gold ? "#f6c453" : palette.accent}`
                    : "2px solid transparent",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Right actions */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              paddingLeft: 12,
              borderLeft: `1px solid ${palette.border}`,
              height: "100%",
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => window.location.reload()}
              type="button"
              style={{
                appearance: "none",
                border: "none",
                background: "none",
                color: palette.textDim,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
                padding: "0 10px",
                height: "100%",
                transition: "color 0.15s",
              }}
            >
              Refresh
            </button>
            <button
              onClick={reportIssue}
              type="button"
              style={{
                appearance: "none",
                border: "none",
                background: "none",
                color: "#f87171",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
                padding: "0 10px",
                height: "100%",
                transition: "color 0.15s",
              }}
            >
              Report Issue
            </button>
            <button
              onClick={() => {
                localStorage.removeItem("token");
                localStorage.removeItem("liquidity_lab_token");
                setIsAuthenticated(false);
                setCurrentUser(null);
                setActiveTab("login");
              }}
              type="button"
              style={{
                appearance: "none",
                border: "none",
                background: "none",
                color: palette.textDim,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
                padding: "0 10px",
                height: "100%",
                transition: "color 0.15s",
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* TICKER — bumps chartReloadKey on select (BUG FIX) */}
        <SmartTicker
          items={tickerItems}
          onSelect={(item) => {
            if (item?._wave) selectWaveHead(item._wave);
            else {
              setSelectedEvent(item);
              setChartReloadKey((k) => k + 1);
            }
          }}
        />

        <SessionClockWidget />
        <StatsBar decisions={loggedDecisions} />

        {/* TRADER DNA™ TEASER — upsell for non-pro or pro hook to vault */}
        <div
          onClick={() => setActiveTab("vault")}
          style={{
            borderRadius: 16,
            border: "1px solid rgba(246,196,83,0.25)",
            background:
              "linear-gradient(135deg,rgba(246,196,83,0.06),rgba(5,8,14,0.95))",
            padding: "12px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 22 }}>🧬</span>
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 900,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                Trader DNA
                <sup style={{ fontSize: 9, color: "#f6c453", fontWeight: 900 }}>
                  ™
                </sup>
                <span
                  style={{
                    fontSize: 10,
                    padding: "2px 7px",
                    borderRadius: 999,
                    background: "rgba(96,165,250,0.12)",
                    border: "1px solid rgba(96,165,250,0.24)",
                    color: "#60a5fa",
                    fontWeight: 800,
                  }}
                >
                  Claude-Reviewed™
                </span>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(244,247,251,0.46)",
                  marginTop: 2,
                }}
              >
                AI builds your personal trading profile from every logged trade
              </div>
            </div>
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#f6c453",
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            Generate Profile →
          </div>
        </div>

        <BriefingPanel />

        {/* MAIN GRID */}
        <div style={styles.mainGrid} className="llab-main-grid">
          {/* LEFT: RADAR */}
          <div
            style={{
              ...styles.panel,
              height: "100%",
              alignSelf: "stretch",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            className="llab-radar-panel"
          >
            <div style={styles.panelHeader}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 14 }}>Radar Feed</div>
                <div style={styles.subtext}>Waves · most recent first</div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => {
                    setFilterOffHours((p) => {
                      const next = !p;
                      try {
                        localStorage.setItem("filterOffHours", String(next));
                      } catch {}
                      return next;
                    });
                  }}
                  title="During off-hours (UTC 22–07), show only major pairs"
                  style={{
                    ...cardButtonReset,
                    width: "auto",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: 0.5,
                    padding: "4px 9px",
                    borderRadius: 8,
                    border: `1px solid ${filterOffHours ? "rgba(246,196,83,0.4)" : palette.border}`,
                    color: filterOffHours ? palette.gold : palette.textDim,
                    background: filterOffHours
                      ? "rgba(246,196,83,0.08)"
                      : "transparent",
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                  }}
                >
                  {filterOffHours ? "★ MAJORS" : "ALL PAIRS"}
                </button>
                <Pill>{visibleWaves.length} active</Pill>
              </div>
            </div>
            <div
              style={{
                ...styles.radarList,
                padding: "10px 10px 14px",
                flex: 1,
              }}
            >
              {visibleWaves.length > 0 ? (
                visibleWaves.map((wave) => {
                  const tone = directionTone(wave.directionBias);
                  const conf = Math.round((wave.avgConfidence || 0) * 100);
                  const state = getSignalState(
                    wave.events?.[0]?.timestampUtc,
                    wave.events?.[0]?.tradeState,
                  );
                  const stateColor =
                    state === "LIVE"
                      ? palette.long
                      : state === "AGING"
                        ? palette.gold
                        : palette.short;
                  const isSelected =
                    selectedEvent &&
                    wave.events?.some(
                      (e) =>
                        e.pair === selectedEvent.pair &&
                        e.directionBias === selectedEvent.directionBias,
                    );
                  return (
                    <div
                      key={wave.key}
                      onClick={() => selectWaveHead(wave)}
                      onMouseEnter={() => setHoveredWave(wave.key)}
                      onMouseLeave={() => setHoveredWave(null)}
                      style={{
                        ...styles.waveCard,
                        borderLeft: `3px solid ${tone === "long" ? palette.long : palette.short}`,
                        background: isSelected
                          ? tone === "long"
                            ? "rgba(74,222,128,0.1)"
                            : "rgba(251,113,133,0.1)"
                          : hoveredWave === wave.key
                            ? tone === "long"
                              ? "rgba(74,222,128,0.06)"
                              : "rgba(251,113,133,0.06)"
                            : "rgba(10,14,22,0.92)",
                        transform:
                          hoveredWave === wave.key
                            ? "translateX(2px)"
                            : "translateX(0)",
                        boxShadow: isSelected
                          ? tone === "long"
                            ? "inset 0 0 0 1px rgba(74,222,128,0.3)"
                            : "inset 0 0 0 1px rgba(251,113,133,0.3)"
                          : "none",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          gap: 6,
                          alignItems: "start",
                        }}
                      >
                        <div style={{ display: "grid", gap: 5, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 900,
                                fontSize: 13,
                                color:
                                  tone === "long"
                                    ? palette.long
                                    : palette.short,
                              }}
                            >
                              {wave.pair}
                            </span>
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 900,
                                padding: "2px 5px",
                                borderRadius: 999,
                                background:
                                  tone === "long"
                                    ? "rgba(74,222,128,0.1)"
                                    : "rgba(251,113,133,0.1)",
                                color:
                                  tone === "long"
                                    ? palette.long
                                    : palette.short,
                              }}
                            >
                              {wave.directionBias}
                            </span>
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 900,
                                color: stateColor,
                              }}
                            >
                              {state}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: palette.textSoft,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {wave.timeframe} · {wave.sweepType}
                          </div>
                          <div style={{ fontSize: 9, color: palette.textDim }}>
                            {wave.events?.length || 1}× ·{" "}
                            {minutesAgo(wave.events?.[0]?.timestampUtc)}
                          </div>
                          <div
                            style={{
                              height: 4,
                              borderRadius: 999,
                              background: "rgba(255,255,255,0.08)",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${conf}%`,
                                background:
                                  tone === "long"
                                    ? palette.long
                                    : palette.short,
                                borderRadius: 999,
                              }}
                            />
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 900,
                            color:
                              tone === "long" ? palette.long : palette.short,
                          }}
                        >
                          {conf}%
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div
                  style={{
                    display: "grid",
                    placeItems: "center",
                    height: 120,
                    gap: 8,
                    opacity: 0.5,
                  }}
                >
                  <div style={{ fontSize: 24 }}>📡</div>
                  <div
                    style={{
                      fontSize: 12,
                      color: palette.textSoft,
                      textAlign: "center",
                    }}
                  >
                    No live signals
                    <br />
                    <span style={{ fontSize: 11, color: palette.textDim }}>
                      Bot scanning markets…
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CENTER */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              minHeight: 0,
              alignSelf: "stretch",
            }}
          >
            <div
              style={{
                ...styles.chartFrame,
                flex: 1,
                minHeight: 380,
                position: "relative",
              }}
              className="llab-chart-frame"
            >
              {selectedEvent ? (
                <LightweightExecutionChart
                  pair={selectedEvent?.pair || chartPair}
                  timeframe={selectedEvent?.timeframe || activeTimeframe}
                  entry={selectedEvent?.entry}
                  stop={selectedEvent?.stop}
                  tp1={selectedEvent?.tp1}
                  tp2={selectedEvent?.tp2}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "grid",
                    placeItems: "center",
                    background: "rgba(5,8,14,0.95)",
                  }}
                >
                  <div
                    style={{ textAlign: "center", display: "grid", gap: 12 }}
                  >
                    <div style={{ fontSize: 32, opacity: 0.3 }}>📡</div>
                    <div
                      style={{
                        fontSize: 13,
                        color: palette.textDim,
                        fontWeight: 700,
                      }}
                    >
                      No signal selected
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: palette.textDim,
                        opacity: 0.6,
                      }}
                    >
                      Click a radar card to load the chart
                    </div>
                  </div>
                </div>
              )}
              {/* ── Exchange + Prop Firm Quick Links ── */}
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: "8px 10px",
                  background:
                    "linear-gradient(0deg,rgba(3,6,11,0.92) 0%,transparent 100%)",
                  zIndex: 5,
                  display: "grid",
                  gap: 5,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 9,
                      color: "rgba(255,255,255,0.3)",
                      fontWeight: 800,
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                      marginRight: 2,
                    }}
                  >
                    Trade on
                  </span>
                  {[
                    {
                      label: "Blofin",
                      href: `https://blofin.com/futures/${dashPair}?ref=redoctober`,
                      color: "#3b82f6",
                      bg: "rgba(59,130,246,0.12)",
                    },
                    {
                      label: "Bybit",
                      href: `https://www.bybit.com/trade/usdt/${basePair}?affiliate_id=redoctober`,
                      color: "#f59e0b",
                      bg: "rgba(245,158,11,0.12)",
                    },
                    {
                      label: "Binance",
                      href: `https://www.binance.com/en/futures/${basePair}?ref=redoctober`,
                      color: "#f0b90b",
                      bg: "rgba(240,185,11,0.12)",
                    },
                    {
                      label: "OKX",
                      href: `https://www.okx.com/trade-swap/${dashPair.toLowerCase()}-swap?channelid=redoctober`,
                      color: "#60a5fa",
                      bg: "rgba(96,165,250,0.1)",
                    },
                    {
                      label: "Kraken",
                      href: "https://www.kraken.com/sign-up?referral=redoctober",
                      color: "#7c3aed",
                      bg: "rgba(124,58,237,0.12)",
                    },
                    {
                      label: "TradingView",
                      href: `https://www.tradingview.com/chart/?symbol=BINANCE:${basePair}&offer_id=10&aff_id=redoctober`,
                      color: "#2962ff",
                      bg: "rgba(41,98,255,0.1)",
                    },
                  ].map(({ label, href, color, bg }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "4px 10px",
                        borderRadius: 8,
                        background: bg,
                        border: `1px solid ${color}33`,
                        color,
                        fontSize: 11,
                        fontWeight: 800,
                        textDecoration: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {label}
                    </a>
                  ))}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 9,
                      color: "rgba(255,255,255,0.3)",
                      fontWeight: 800,
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                      marginRight: 2,
                    }}
                  >
                    Prop firms
                  </span>
                  {[
                    {
                      label: "FTMO",
                      href: "https://ftmo.com/?affiliates=redoctober",
                      color: "#ef4444",
                      bg: "rgba(239,68,68,0.1)",
                    },
                    {
                      label: "MyFundedFX",
                      href: "https://myfundedfx.tech/registration/?ref=redoctober",
                      color: "#10b981",
                      bg: "rgba(16,185,129,0.1)",
                    },
                    {
                      label: "The5ers",
                      href: "https://the5ers.com/?utm_source=redoctober",
                      color: "#8b5cf6",
                      bg: "rgba(139,92,246,0.1)",
                    },
                    {
                      label: "Topstep",
                      href: "https://www.topstep.com/?ref=redoctober",
                      color: "#f97316",
                      bg: "rgba(249,115,22,0.1)",
                    },
                    {
                      label: "Apex",
                      href: "https://apextraderfunding.com/?ref=redoctober",
                      color: "#06b6d4",
                      bg: "rgba(6,182,212,0.1)",
                    },
                  ].map(({ label, href, color, bg }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "4px 10px",
                        borderRadius: 8,
                        background: bg,
                        border: `1px solid ${color}33`,
                        color,
                        fontSize: 11,
                        fontWeight: 800,
                        textDecoration: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {label}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Signal bar — only shows when event selected */}
            {selectedEvent && (
              <SignalInsightBar
                event={selectedEvent}
                rr={selectedEventRR}
                risk={decisionRiskAmount}
              />
            )}
          </div>

          {/* RIGHT: Decision Context */}
          <div
            style={{
              ...styles.panel,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            className="llab-right-panel"
          >
            <div style={styles.panelHeader}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 14 }}>
                  Decision Context
                </div>
                <div style={styles.subtext}>Live event · prop rules</div>
              </div>
              {selectedEvent && (
                <Pill tone={directionTone(selectedEvent.directionBias)}>
                  {selectedEvent.directionBias || "—"}
                </Pill>
              )}
            </div>
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "10px 10px 12px",
                display: "grid",
                gap: 8,
                alignContent: "start",
              }}
            >
              {selectedEvent ? (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                    }}
                  >
                    <MiniBox label="Pair" value={selectedEvent.pair || "—"} />
                    <MiniBox
                      label="Confidence"
                      value={`${Math.round((selectedEvent.botConfidence || 0) * 100)}%`}
                      subtext={selectedEvent.sweepType || "—"}
                    />
                  </div>
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: 14,
                      background: "rgba(255,255,255,0.025)",
                      border: `1px solid ${palette.borderSoft}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 10,
                        color: palette.textDim,
                        marginBottom: 7,
                        textTransform: "uppercase",
                        letterSpacing: 0.8,
                        fontWeight: 800,
                      }}
                    >
                      <span>Setup Strength</span>
                      <span>
                        {Math.round((selectedEvent.botConfidence || 0) * 100)}%
                      </span>
                    </div>
                    <div
                      style={{
                        height: 6,
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.08)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.max(4, Math.round((selectedEvent.botConfidence || 0) * 100))}%`,
                          height: "100%",
                          borderRadius: 999,
                          background:
                            (selectedEvent.botConfidence || 0) >= 0.7
                              ? "linear-gradient(90deg,#22c55e,#86efac)"
                              : (selectedEvent.botConfidence || 0) >= 0.45
                                ? "linear-gradient(90deg,#f59e0b,#fde68a)"
                                : "linear-gradient(90deg,#fb7185,#fecdd3)",
                        }}
                      />
                    </div>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                    }}
                  >
                    <MiniBox
                      label="Pattern"
                      value={
                        selectedEvent.pattern || selectedEvent.sweepType || "—"
                      }
                      subtext={selectedEvent.structure || ""}
                    />
                    <MiniBox
                      label="State"
                      value={
                        selectedEvent.tradeState ||
                        getSignalState(selectedEvent.timestampUtc) ||
                        "—"
                      }
                    />
                  </div>
                </>
              ) : (
                <div
                  style={{
                    display: "grid",
                    placeItems: "center",
                    height: 120,
                    gap: 8,
                    opacity: 0.4,
                  }}
                >
                  <div style={{ fontSize: 28 }}>📡</div>
                  <div
                    style={{
                      fontSize: 12,
                      color: palette.textSoft,
                      textAlign: "center",
                    }}
                  >
                    Select a signal
                    <br />
                    from the radar
                  </div>
                </div>
              )}
              <Divider />
              <SectionLabel>Prop Challenge</SectionLabel>
              <div style={{ display: "grid", gap: 6 }}>
                <FieldLabel label="Firm / Preset">
                  <select
                    style={{ ...fieldStyle, fontSize: 12, padding: "6px 10px" }}
                    value={propAccount.presetId}
                    onChange={(e) =>
                      setPropAccount((prev) => ({
                        ...prev,
                        presetId: e.target.value,
                      }))
                    }
                  >
                    {PROP_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </FieldLabel>
                {activePreset.id !== "none" && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 6,
                    }}
                  >
                    <FieldLabel label="Account Size">
                      <select
                        style={{
                          ...fieldStyle,
                          fontSize: 12,
                          padding: "6px 8px",
                        }}
                        value={propAccount.accountSize}
                        onChange={(e) =>
                          setPropAccount((prev) => ({
                            ...prev,
                            accountSize: Number(e.target.value),
                          }))
                        }
                      >
                        {activePreset.accountSizes.map((s) => (
                          <option key={s} value={s}>
                            {s === 0 ? "Off" : `$${s.toLocaleString()}`}
                          </option>
                        ))}
                      </select>
                    </FieldLabel>
                    <FieldLabel label="Phase">
                      <select
                        style={{
                          ...fieldStyle,
                          fontSize: 12,
                          padding: "6px 8px",
                        }}
                        value={propAccount.phase}
                        onChange={(e) =>
                          setPropAccount((prev) => ({
                            ...prev,
                            phase: e.target.value,
                          }))
                        }
                      >
                        {activePreset.phases.map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                    </FieldLabel>
                  </div>
                )}
              </div>
              {activePreset.id !== "none" && (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3,minmax(0,1fr))",
                      gap: 6,
                    }}
                  >
                    {[
                      [
                        "Daily Limit",
                        money(propStatus.dailyLoss),
                        propStatus.tone === "short"
                          ? palette.short
                          : propStatus.tone === "gold"
                            ? palette.gold
                            : palette.text,
                      ],
                      ["Drawdown", money(propStatus.maxDrawdown), palette.text],
                      ["Target", money(propStatus.target), palette.long],
                    ].map(([label, val, color]) => (
                      <div
                        key={label}
                        style={{
                          border: `1px solid ${palette.borderSoft}`,
                          borderRadius: 10,
                          padding: "8px 10px",
                          display: "grid",
                          gap: 3,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 9,
                            color: palette.textDim,
                            textTransform: "uppercase",
                            letterSpacing: 0.8,
                            fontWeight: 800,
                          }}
                        >
                          {label}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 900, color }}>
                          {val}
                        </div>
                      </div>
                    ))}
                  </div>
                  {decisionRiskAmount &&
                    propStatus.dailyLoss > 0 &&
                    (() => {
                      const usagePct = Math.min(
                        100,
                        Math.round(
                          (decisionRiskAmount / propStatus.dailyLoss) * 100,
                        ),
                      );
                      const barColor =
                        usagePct >= 75
                          ? palette.short
                          : usagePct >= 35
                            ? palette.gold
                            : palette.long;
                      return (
                        <div
                          style={{
                            padding: "10px 12px",
                            borderRadius: 12,
                            background: "rgba(255,255,255,0.025)",
                            border: `1px solid ${palette.borderSoft}`,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 10,
                              color: palette.textDim,
                              marginBottom: 7,
                              textTransform: "uppercase",
                              letterSpacing: 0.8,
                              fontWeight: 800,
                            }}
                          >
                            <span>Daily Limit Used</span>
                            <span style={{ color: barColor }}>{usagePct}%</span>
                          </div>
                          <div
                            style={{
                              height: 6,
                              borderRadius: 999,
                              background: "rgba(255,255,255,0.08)",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${usagePct}%`,
                                height: "100%",
                                borderRadius: 999,
                                background: barColor,
                                transition: "width 0.3s ease",
                              }}
                            />
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: palette.textSoft,
                              marginTop: 6,
                            }}
                          >
                            {money(decisionRiskAmount)} risk ·{" "}
                            {money(propStatus.dailyLoss - decisionRiskAmount)}{" "}
                            remaining
                          </div>
                        </div>
                      );
                    })()}
                </>
              )}
              <Divider />
              <SectionLabel>Execution Note</SectionLabel>
              <div
                style={{
                  padding: "9px 11px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.025)",
                  border: `1px solid ${palette.borderSoft}`,
                  fontSize: 12,
                  color: palette.textSoft,
                  lineHeight: 1.5,
                }}
              >
                {selectedEvent?.directionBias || "—"} ·{" "}
                {selectedEvent?.session || "—"} ·{" "}
                {selectedEvent?.emaContext || "No EMA context"}
              </div>
              {selectedEvent?.currentPrice && (
                <MiniBox
                  label="Current Price"
                  value={num(selectedEvent.currentPrice)}
                  subtext={selectedEvent.eventType || ""}
                />
              )}
            </div>
          </div>
        </div>

        {/* JOURNAL */}
        <div style={{ ...styles.journalShell }}>
          <div style={styles.journalHeader}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 15 }}>
                Behavior Engine Journal
              </div>
              <div style={styles.subtext}>
                Log event-linked or manual decisions
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                style={{
                  ...styles.button,
                  background:
                    logMode === "event"
                      ? "rgba(74,222,128,0.1)"
                      : "rgba(59,130,246,0.1)",
                  border:
                    logMode === "event"
                      ? "1px solid rgba(74,222,128,0.3)"
                      : "1px solid rgba(59,130,246,0.3)",
                  fontSize: 12,
                }}
                onClick={() =>
                  setLogMode((prev) => (prev === "event" ? "manual" : "event"))
                }
                type="button"
              >
                {logMode === "event" ? "⬤ EVENT MODE" : "◯ MANUAL MODE"}
              </button>
              <button
                style={{ ...styles.button, fontSize: 12 }}
                onClick={handleExportLogs}
                type="button"
              >
                Export Logs
              </button>
            </div>
          </div>

          <div
            style={{
              padding: "12px 14px",
              borderBottom: `1px solid ${palette.borderSoft}`,
            }}
          >
            <div style={styles.topCardRow} className="llab-top-card-row">
              <MiniBox
                label="Planned RR1"
                value={rrText(decisionPlannedRR.rr1)}
                subtext={`Risk Δ ${num(decisionRiskAmount, 4)}`}
              />
              <MiniBox
                label="Planned RR2"
                value={rrText(decisionPlannedRR.rr2)}
                subtext={
                  decisionForm.session && decisionForm.session !== "Off-Hours"
                    ? `Session · ${decisionForm.session}`
                    : "Session · —"
                }
              />
              <MiniBox
                label="Realized RR"
                value={rrText(decisionRealizedRR)}
                subtext={`Outcome · ${decisionForm.outcome}`}
              />
              <MiniBox
                label="Prop Status"
                value={propStatus.status}
                subtext={`${money(propStatus.dailyLoss)} daily limit`}
                tone={
                  propStatus.tone === "short"
                    ? "short"
                    : propStatus.tone === "gold"
                      ? "gold"
                      : null
                }
              />
            </div>
          </div>

          <div style={{ padding: "14px 14px 18px" }}>
            <SectionLabel>Event Context</SectionLabel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,minmax(0,1fr))",
                gap: 10,
                marginBottom: 16,
              }}
              className="llab-form-4col"
            >
              <FieldLabel label="Pair">
                <input
                  style={isEventLocked ? lockedFieldStyle : fieldStyle}
                  value={decisionForm.pair}
                  onChange={(e) => updateDecision("pair", e.target.value)}
                  placeholder="e.g. BTC/USDT"
                  disabled={isEventLocked}
                />
              </FieldLabel>
              <FieldLabel label="Timeframe">
                <select
                  style={isEventLocked ? lockedFieldStyle : fieldStyle}
                  value={decisionForm.timeframe}
                  onChange={(e) => updateDecision("timeframe", e.target.value)}
                  disabled={isEventLocked}
                >
                  {["1m", "3m", "5m", "15m", "1h"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </FieldLabel>
              <FieldLabel label="Direction">
                <select
                  style={isEventLocked ? lockedFieldStyle : fieldStyle}
                  value={decisionForm.directionBias}
                  onChange={(e) =>
                    updateDecision("directionBias", e.target.value)
                  }
                  disabled={isEventLocked}
                >
                  {["Short", "Long", "Neutral"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </FieldLabel>
              <FieldLabel label="Event Type">
                <select
                  style={fieldStyle}
                  value={decisionForm.eventType}
                  onChange={(e) => updateDecision("eventType", e.target.value)}
                >
                  {["SWEEP_DETECTED", "SWEEP_CONFIRMED", "SWEEP_RECLAIM"].map(
                    (v) => (
                      <option key={v}>{v}</option>
                    ),
                  )}
                </select>
              </FieldLabel>
            </div>

            {/* Execution Details — collapsible advanced section */}
            <button
              type="button"
              onClick={() => setShowAdvancedForm((p) => !p)}
              style={{
                appearance: "none",
                border: `1px solid ${palette.borderSoft}`,
                borderRadius: 10,
                padding: "7px 14px",
                background: "rgba(255,255,255,0.03)",
                color: palette.textDim,
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 0.8,
                textTransform: "uppercase",
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 10 }}>
                {showAdvancedForm ? "▼" : "▶"}
              </span>
              {showAdvancedForm ? "Hide" : "Show"} Execution Details
            </button>
            {showAdvancedForm && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4,minmax(0,1fr))",
                  gap: 10,
                  marginBottom: 16,
                }}
                className="llab-form-4col"
              >
                <FieldLabel label="Sweep Type">
                  <select
                    style={fieldStyle}
                    value={decisionForm.sweepType}
                    onChange={(e) =>
                      updateDecision("sweepType", e.target.value)
                    }
                  >
                    {[
                      "High Sweep",
                      "Low Sweep",
                      "Equal Highs",
                      "Equal Lows",
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </FieldLabel>
                <FieldLabel label="EMA Context">
                  <select
                    style={fieldStyle}
                    value={decisionForm.emaContext}
                    onChange={(e) =>
                      updateDecision("emaContext", e.target.value)
                    }
                  >
                    {[
                      "EMA99 Rejection",
                      "EMA99 Support",
                      "EMA25 Reclaim",
                      "None",
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </FieldLabel>
                <FieldLabel label="Action">
                  <select
                    style={fieldStyle}
                    value={decisionForm.action}
                    onChange={(e) => updateDecision("action", e.target.value)}
                  >
                    {["Taken", "Passed"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </FieldLabel>
                <FieldLabel label="Timing">
                  <select
                    style={fieldStyle}
                    value={decisionForm.timing}
                    onChange={(e) => updateDecision("timing", e.target.value)}
                  >
                    {["On Confirmation", "Early", "Chase Entry"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </FieldLabel>
                <FieldLabel label="Execution Type">
                  <select
                    style={fieldStyle}
                    value={decisionForm.executionType}
                    onChange={(e) =>
                      updateDecision("executionType", e.target.value)
                    }
                  >
                    {[
                      "Limit Retest",
                      "Market Confirmation",
                      "Breakdown Entry",
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </FieldLabel>
                <FieldLabel label="HTF Bias">
                  <select
                    style={fieldStyle}
                    value={decisionForm.htfBias}
                    onChange={(e) => updateDecision("htfBias", e.target.value)}
                  >
                    {["Bearish", "Bullish", "Neutral"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </FieldLabel>
                <FieldLabel label="Entry Trigger">
                  <select
                    style={fieldStyle}
                    value={decisionForm.entryTrigger}
                    onChange={(e) =>
                      updateDecision("entryTrigger", e.target.value)
                    }
                  >
                    {["Reclaim Failure", "Breakdown", "Wick Rejection"].map(
                      (v) => (
                        <option key={v}>{v}</option>
                      ),
                    )}
                  </select>
                </FieldLabel>
                <FieldLabel label="Liquidity Level">
                  <select
                    style={fieldStyle}
                    value={decisionForm.liquidityLevel}
                    onChange={(e) =>
                      updateDecision("liquidityLevel", e.target.value)
                    }
                  >
                    {[
                      "Range High",
                      "Range Low",
                      "Session High",
                      "Session Low",
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </FieldLabel>
              </div>
            )}

            <SectionLabel>Price Levels</SectionLabel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,minmax(0,1fr))",
                gap: 10,
                marginBottom: 8,
              }}
              className="llab-form-4col"
            >
              <FieldLabel label="Entry">
                <input
                  style={{
                    ...fieldStyle,
                    borderColor: "rgba(96,165,250,0.4)",
                    color: "#60a5fa",
                  }}
                  value={decisionForm.entry}
                  onChange={(e) => updateDecision("entry", e.target.value)}
                />
              </FieldLabel>
              <FieldLabel label="Stop">
                <input
                  style={{
                    ...fieldStyle,
                    borderColor: "rgba(239,68,68,0.4)",
                    color: "#ef4444",
                  }}
                  value={decisionForm.stop}
                  onChange={(e) => updateDecision("stop", e.target.value)}
                />
              </FieldLabel>
              <FieldLabel label="TP1">
                <input
                  style={{
                    ...fieldStyle,
                    borderColor: "rgba(74,222,128,0.4)",
                    color: "#4ade80",
                  }}
                  value={decisionForm.tp1}
                  onChange={(e) => updateDecision("tp1", e.target.value)}
                />
              </FieldLabel>
              <FieldLabel label="TP2">
                <input
                  style={{
                    ...fieldStyle,
                    borderColor: "rgba(134,239,172,0.4)",
                    color: "#86efac",
                  }}
                  value={decisionForm.tp2}
                  onChange={(e) => updateDecision("tp2", e.target.value)}
                />
              </FieldLabel>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 16,
              }}
              className="llab-price-levels"
            >
              <FieldLabel label="Exit Price">
                <input
                  style={fieldStyle}
                  value={decisionForm.exit}
                  onChange={(e) => updateDecision("exit", e.target.value)}
                />
              </FieldLabel>
              <FieldLabel label="PnL ($)">
                <input
                  style={fieldStyle}
                  value={decisionForm.pnl}
                  onChange={(e) => updateDecision("pnl", e.target.value)}
                  placeholder="e.g. 142.50 or -80"
                />
              </FieldLabel>
            </div>

            <SectionLabel>Discipline &amp; Outcome</SectionLabel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,minmax(0,1fr))",
                gap: 10,
                marginBottom: 8,
              }}
              className="llab-form-4col"
            >
              <FieldLabel label="Outcome">
                <select
                  style={fieldStyle}
                  value={decisionForm.outcome}
                  onChange={(e) => updateDecision("outcome", e.target.value)}
                >
                  {["Open", "Win", "Loss", "Scratch"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </FieldLabel>
              <FieldLabel label="Plan Followed">
                <select
                  style={fieldStyle}
                  value={decisionForm.planFollowed}
                  onChange={(e) =>
                    updateDecision("planFollowed", e.target.value)
                  }
                >
                  {["Yes", "No"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </FieldLabel>
              <FieldLabel label="Rule Break">
                <select
                  style={fieldStyle}
                  value={decisionForm.ruleBreak}
                  onChange={(e) => updateDecision("ruleBreak", e.target.value)}
                >
                  {[
                    "None",
                    "Entered Early",
                    "Chased Move",
                    "Ignored Structure",
                    "Oversized Risk",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </FieldLabel>
              <FieldLabel label="Discipline (1–10)">
                <input
                  style={fieldStyle}
                  value={decisionForm.disciplineScore}
                  onChange={(e) =>
                    updateDecision("disciplineScore", e.target.value)
                  }
                />
              </FieldLabel>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,minmax(0,1fr))",
                gap: 10,
                marginBottom: 16,
              }}
              className="llab-form-3col"
            >
              <FieldLabel label="Setup Quality (1–10)">
                <input
                  style={fieldStyle}
                  value={decisionForm.setupQuality}
                  onChange={(e) =>
                    updateDecision("setupQuality", e.target.value)
                  }
                />
              </FieldLabel>
              <FieldLabel label="Emotional Pressure (1–10)">
                <input
                  style={fieldStyle}
                  value={decisionForm.emotionalPressure}
                  onChange={(e) =>
                    updateDecision("emotionalPressure", e.target.value)
                  }
                />
              </FieldLabel>
              <FieldLabel label="Confidence (1–10)">
                <input
                  style={fieldStyle}
                  value={decisionForm.confidenceSelf}
                  onChange={(e) =>
                    updateDecision("confidenceSelf", e.target.value)
                  }
                />
              </FieldLabel>
            </div>

            <FieldLabel label="Trade Notes">
              <textarea
                style={{
                  ...fieldStyle,
                  minHeight: 140,
                  resize: "vertical",
                  lineHeight: 1.6,
                }}
                value={decisionForm.notes}
                onChange={(e) => updateDecision("notes", e.target.value)}
                placeholder="Describe your reasoning, what you saw, how you felt. What was the structure? Did price sweep cleanly? Any hesitation on entry?"
              />
            </FieldLabel>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
                marginTop: 16,
              }}
            >
              <button
                style={{
                  ...styles.primaryButton,
                  fontSize: 15,
                  padding: "12px 28px",
                  letterSpacing: 0.3,
                }}
                type="button"
                onClick={saveDecision}
              >
                Log Trade / Apply Result
              </button>
              <button
                style={{ ...styles.button, fontSize: 12 }}
                type="button"
                onClick={runAiReviewNow}
              >
                {aiReviewLoading ? "Running AI…" : "🤖 Run AI Review"}
              </button>
              <label
                style={{
                  ...styles.button,
                  fontSize: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                📎 Screenshot
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleScreenshotUpload}
                  style={{ display: "none" }}
                />
              </label>
              {decisionForm.screenshot && (
                <Pill tone="long">Screenshot ready</Pill>
              )}
            </div>
          </div>
        </div>

        {/* RECENT ENTRIES */}
        <div style={{ ...styles.journalShell }}>
          <div style={styles.journalHeader}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 15 }}>
                Recent Entries
              </div>
              <div style={styles.subtext}>
                Click any card to expand · AI grade · Quick close open trades
              </div>
            </div>
            <button
              style={{ ...styles.button, fontSize: 12 }}
              onClick={() => setShowInsights((prev) => !prev)}
              type="button"
            >
              {showInsights ? "Show Less" : "Show All"}
            </button>
          </div>
          <div style={{ padding: 12, display: "grid", gap: 8 }}>
            {displayDecisions.length ? (
              displayDecisions.map((log) => {
                const isExpanded = expandedLogId === log.id;
                const tone = gradeTone(log.aiGrade || log.executionAssessment);
                const oTone = outcomeTone(log.outcome);
                return (
                  <button
                    key={log.id}
                    type="button"
                    onClick={() => toggleLogCard(log.id)}
                    onMouseEnter={() => setHoveredLogId(log.id)}
                    onMouseLeave={() => setHoveredLogId(null)}
                    style={{
                      ...cardButtonReset,
                      padding: "13px 14px",
                      borderRadius: 16,
                      border: `1px solid ${isExpanded ? getToneBorder(tone) : hoveredLogId === log.id ? "rgba(255,255,255,0.14)" : palette.border}`,
                      background: isExpanded
                        ? "rgba(255,255,255,0.025)"
                        : hoveredLogId === log.id
                          ? "rgba(255,255,255,0.04)"
                          : palette.card,
                      display: "grid",
                      gap: 10,
                      transition: "all 0.15s ease",
                      transform:
                        hoveredLogId === log.id && !isExpanded
                          ? "translateY(-1px)"
                          : "translateY(0)",
                    }}
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
                      <div style={{ display: "grid", gap: 7, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            gap: 7,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <span style={{ fontWeight: 900, fontSize: 15 }}>
                            {log.pair}
                          </span>
                          <Pill tone={directionTone(log.directionBias)}>
                            {log.directionBias}
                          </Pill>
                          <Pill>{log.timeframe}</Pill>
                          <Pill tone={oTone}>{log.outcome || "—"}</Pill>
                          {log.aiGrade && (
                            <Pill tone={tone}>
                              Grade {log.aiGrade} ·{" "}
                              {log.aiScore ?? log.tradeScore ?? "—"}
                            </Pill>
                          )}
                        </div>
                        <div
                          style={{
                            color: palette.textSoft,
                            fontSize: 12,
                            display: "flex",
                            gap: 6,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{
                              padding: "2px 7px",
                              borderRadius: 6,
                              background: "rgba(255,255,255,0.05)",
                              border: `1px solid ${palette.borderSoft}`,
                              fontSize: 11,
                              fontWeight: 700,
                              color: palette.textDim,
                            }}
                          >
                            {log.eventType}
                          </span>
                          <span style={{ opacity: 0.5 }}>·</span>
                          <span>{log.sweepType}</span>
                          <span style={{ opacity: 0.5 }}>·</span>
                          <span>{formatDateTime(log.timestamp)}</span>
                        </div>
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gap: 4,
                          justifyItems: "end",
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 900,
                            color:
                              Number(log.pnl) > 0
                                ? palette.long
                                : Number(log.pnl) < 0
                                  ? palette.short
                                  : palette.text,
                          }}
                        >
                          {money(log.pnl)}
                        </div>
                        {log.exit && Number(log.exit) !== 0 && (
                          <div
                            style={{ fontSize: 11, color: palette.textSoft }}
                          >
                            {rrText(log.realizedRR)} realized
                          </div>
                        )}
                      </div>
                    </div>
                    {isExpanded && (
                      <div
                        style={{
                          display: "grid",
                          gap: 10,
                          paddingTop: 10,
                          borderTop: `1px solid ${palette.borderSoft}`,
                        }}
                      >
                        <div
                          style={styles.topCardRow}
                          className="llab-top-card-row"
                        >
                          <MiniBox
                            label="Entry / Stop"
                            value={`${num(log.entry)} / ${num(log.stop)}`}
                            subtext={
                              log.exit && Number(log.exit) !== 0
                                ? `Realized ${rrText(log.realizedRR)}`
                                : "No exit logged"
                            }
                          />
                          <MiniBox
                            label="RR Plan"
                            value={`${rrText(log.rr1)} / ${rrText(log.rr2)}`}
                            subtext={log.executionType || "—"}
                          />
                          <MiniBox
                            label="Discipline"
                            value={log.disciplineScore ?? "—"}
                            subtext={log.ruleBreak || "None"}
                          />
                          <MiniBox
                            label="AI Score"
                            value={`${log.aiScore ?? log.tradeScore ?? "—"}`}
                            subtext={
                              log.aiGrade
                                ? `Grade ${log.aiGrade}`
                                : "Not reviewed"
                            }
                          />
                        </div>
                        {(log.aiVerdict || log.aiGrade) && (
                          <AiReviewPanel
                            entry={log}
                            liveReview={null}
                            loading={false}
                            locked={!featureFlags.aiReview}
                          />
                        )}
                        {log.notes && (
                          <div
                            style={{
                              color: palette.textSoft,
                              fontSize: 13,
                              lineHeight: 1.5,
                            }}
                          >
                            {log.notes}
                          </div>
                        )}
                        {(log.outcome === "Open" || !log.outcome) && (
                          <QuickClose
                            logId={log.id}
                            onClose={async (id, exit, outcome, pnl) => {
                              try {
                                const data = await apiFetch(`/logs/${id}`, {
                                  method: "PATCH",
                                  body: JSON.stringify({ exit, outcome, pnl }),
                                });
                                const updated = data?.log;
                                setLoggedDecisions((prev) =>
                                  prev.map((d) =>
                                    d.id === id
                                      ? {
                                          ...d,
                                          exit: updated?.exit ?? exit,
                                          outcome: updated?.outcome ?? outcome,
                                          pnl: updated?.pnl ?? pnl,
                                          realizedRR:
                                            updated?.realizedRR ??
                                            calcRealizedRR(
                                              d.directionBias,
                                              d.entry,
                                              d.stop,
                                              exit,
                                            ),
                                        }
                                      : d,
                                  ),
                                );
                                toast(
                                  `${log.pair} closed as ${outcome}`,
                                  "success",
                                );
                              } catch (err) {
                                toast(`Close failed: ${err.message}`, "warn");
                              }
                            }}
                          />
                        )}
                      </div>
                    )}
                  </button>
                );
              })
            ) : (
              <div
                style={{
                  color: palette.textSoft,
                  fontSize: 13,
                  padding: "8px 4px",
                }}
              >
                No journal entries yet. Log your first trade above.
              </div>
            )}
          </div>
        </div>

        {/* TOASTS */}
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
                padding: "11px 14px",
                borderRadius: 14,
                color: "#fff",
                background:
                  t.type === "success"
                    ? "rgba(20,70,38,0.96)"
                    : t.type === "warn"
                      ? "rgba(90,45,8,0.96)"
                      : "rgba(18,24,38,0.96)",
                border: `1px solid ${palette.border}`,
                minWidth: 220,
                boxShadow: "0 8px 22px rgba(0,0,0,0.3)",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {t.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
