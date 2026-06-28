import { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import { createChart, CandlestickSeries, LineSeries } from "lightweight-charts";
import BillingPage from "./BillingPage.jsx";

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

// ─── helpers ────────────────────────────────────────────────────────────────

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
  return parseFloat(n.toPrecision(8)).toString();
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
  if (Math.abs(n) > maxPlausible) return "—"; // guard against exit=0 artifacts
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

function getTvInterval(tf) {
  const map = {
    "1m": "1",
    "3m": "3",
    "5m": "5",
    "15m": "15",
    "30m": "30",
    "1h": "60",
    "4h": "240",
    "1d": "D",
    d: "D",
  };
  return (
    map[
      String(tf || "")
        .trim()
        .toLowerCase()
    ] || "15"
  );
}

function getSignalAgeMinutes(timestampUtc) {
  const d = parseEventDate(timestampUtc);
  if (!d) return 999;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
}

function getSignalState(timestampUtc) {
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
          fontSize: "clamp(13px,0.9vw,17px)",
          fontWeight: 900,
          color: isLong ? "#4ade80" : isShort ? "#f87171" : palette.text,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
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
          }}
        >
          Waiting for high-confidence sweeps…
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
      timeZone: "America/New_York",
      localPrimeStart: 8,
      localPrimeEnd: 12,
    },
    {
      key: "london",
      label: "London",
      tzLabel: "LDN",
      timeZone: "Europe/London",
      localPrimeStart: 3,
      localPrimeEnd: 6,
    },
    {
      key: "asia",
      label: "Asia / Tokyo",
      tzLabel: "TKY",
      timeZone: "Asia/Tokyo",
      localPrimeStart: 20,
      localPrimeEnd: 23,
    },
  ];

  function formatMilitary(date, timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const hh = parts.find((p) => p.type === "hour")?.value || "00";
    const mm = parts.find((p) => p.type === "minute")?.value || "00";
    return `${hh}:${mm}`;
  }

  function isPrime(hour, openHour, closeHour) {
    if (openHour <= closeHour) return hour >= openHour && hour < closeHour;
    return hour >= openHour || hour < closeHour;
  }

  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}
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
            </div>
            <div style={{ fontSize: 11, color: palette.textSoft }}>
              Prime window: {session.localPrimeStart}:00–{session.localPrimeEnd}
              :00
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
  const state = getSignalState(event.timestampUtc);
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
    >
      <InsightBox
        label="ENTRY"
        value={num(event.entry)}
        subtext="retest zone"
      />
      <InsightBox
        label="TP1"
        value={num(event.tp1)}
        subtext={rrText(rr?.rr1)}
      />
      <InsightBox
        label="TP2"
        value={num(event.tp2)}
        subtext={rrText(rr?.rr2)}
      />
      <InsightBox label="RISK Δ" value={risk ? num(risk, 4) : "—"} />
      <InsightBox label="STATE" value={state} accent={stateColor} />
      <InsightBox label="LIVE TTL" value={countdown} />
      <InsightBox label="SESSION" value={event.session || "—"} />
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

function LightweightExecutionChart({ pair, timeframe, entry, stop, tp1, tp2 }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const extraSeriesRef = useRef([]);
  const [error, setError] = useState(null);

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
    return () => {
      window.removeEventListener("resize", resize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!pair || !chartRef.current || !candleSeriesRef.current) return;
    let cancelled = false;

    async function fetchAndDraw() {
      try {
        const data = await apiFetch(
          `/candles?pair=${encodeURIComponent(pair)}&timeframe=${timeframe || "1m"}&limit=300`,
        );
        if (cancelled || !data?.candles?.length) return;

        const chart = chartRef.current;
        const candles = candleSeriesRef.current;

        extraSeriesRef.current.forEach((s) => {
          try {
            chart.removeSeries(s);
          } catch (e) {}
        });
        extraSeriesRef.current = [];

        candles.setData(data.candles);

        // Price lines
        [
          ["ENTRY", entry, "#f6c453"],
          ["STOP", stop, "#fb7185"],
          ["TP1", tp1, "#4ade80"],
          ["TP2", tp2, "#4ade80"],
        ].forEach(([title, value, color]) => {
          if (Number.isFinite(Number(value)))
            candles.createPriceLine({
              price: Number(value),
              color,
              lineWidth: title === "ENTRY" ? 2 : 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title,
            });
        });

        // EMAs
        function calcEma(data, period) {
          if (data.length < period) return [];
          const k = 2 / (period + 1);
          let ema = data[0].close;
          return data.map((d, i) => {
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
          });
          const emaData = calcEma(data.candles, period);
          if (emaData.length) s.setData(emaData);
        });

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
  }, [pair, timeframe, entry, stop, tp1, tp2]);

  if (error)
    return (
      <div style={{ color: palette.textSoft, fontSize: 13, padding: 16 }}>
        {error}
      </div>
    );
  return <div ref={ref} style={{ width: "100%", height: "100%" }} />;
}

// ─── FieldLabel ───────────────────────────────────────────────────────────────

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

// ─── StatsBar ─────────────────────────────────────────────────────────────────

function StatsBar({ decisions }) {
  const stats = useMemo(() => {
    if (!decisions.length)
      return {
        totalTrades: 0,
        winRate: "—",
        avgRR: "—",
        totalPnl: "—",
        winCount: 0,
        lossCount: 0,
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
      .map((d) => Number(d.realizedRR))
      .filter(Number.isFinite);
    const avgRR = rrVals.length
      ? `${(rrVals.reduce((a, b) => a + b, 0) / rrVals.length).toFixed(2)}R`
      : "—";
    const pnlVals = decisions.map((d) => Number(d.pnl)).filter(Number.isFinite);
    const totalPnl = pnlVals.length ? pnlVals.reduce((a, b) => a + b, 0) : null;
    return {
      totalTrades: decisions.length,
      winRate,
      avgRR,
      totalPnl,
      winCount: wins,
      lossCount: losses,
    };
  }, [decisions]);

  const pnlPositive = stats.totalPnl != null && stats.totalPnl > 0;
  const pnlNegative = stats.totalPnl != null && stats.totalPnl < 0;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4,minmax(0,1fr))",
        gap: 10,
      }}
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
        <div style={styles.statSub}>all logged entries</div>
      </div>
      <div style={styles.statCard}>
        <div style={styles.statLabel}>Total PnL</div>
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
        <div style={styles.statSub}>logged pnl only</div>
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
  const [hasLwcCandles, setHasLwcCandles] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [logMode, setLogMode] = useState("event");
  const [showInsights, setShowInsights] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(
    Boolean(getStoredToken()),
  );
  const [currentUser, setCurrentUser] = useState({
    email: "",
    billingPlan: "starter",
    stripeStatus: "",
    stripeCustomerId: "",
    screenshotRemaining: 5,
  });
  const [featureFlags, setFeatureFlags] = useState(DEFAULT_FEATURE_FLAGS);
  const [chartReloadKey, setChartReloadKey] = useState(0);
  const [chartEvent, setChartEvent] = useState(null);
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
    if (selectedEvent?.chartCandles?.length) {
      setHasLwcCandles(true);
    }
  }, [selectedEvent]);

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

  const chartBaseEvent = chartEvent || selectedEvent;
  const chartPair =
    logMode === "manual"
      ? decisionForm.pair || "BTC/USDT"
      : chartBaseEvent?.pair || "BTC/USDT";
  const activeTimeframe =
    logMode === "manual"
      ? decisionForm.timeframe || "3m"
      : chartBaseEvent?.timeframe || decisionForm.timeframe || "3m";
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
          (evt) => getSignalState(evt.timestampUtc) !== "EXPIRED",
        );
        if (!freshEvents.length) return null;
        return {
          ...wave,
          events: freshEvents,
          state: getSignalState(freshEvents[0]?.timestampUtc),
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
    return Array.from(byPair.values()).slice(0, 10);
  }, [activeWaves]);

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

  const stableChartEvent = useMemo(
    () => selectedEvent,
    [
      selectedEvent?.id,
      selectedEvent?.pair,
      selectedEvent?.timestampUtc,
      selectedEvent?.chartCandles?.length,
    ],
  );

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
  const decisionPlannedRR = useMemo(
    () =>
      calcPlannedRR(
        decisionForm.entry,
        decisionForm.stop,
        decisionForm.tp1,
        decisionForm.tp2,
        null,
        null,
      ),
    [decisionForm.entry, decisionForm.stop, decisionForm.tp1, decisionForm.tp2],
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

  function selectWaveHead(wave) {
    const head = wave?.events?.[0];
    if (head) {
      setSelectedEvent(head);
      setChartEvent(head);
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
      toast("Logged in", "success");
    } catch (err) {
      toast(err.message || "Login failed", "warn");
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
    try {
      const response = await apiFetch("/logs", {
        method: "POST",
        body: JSON.stringify(payload),
      });
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
      toast(
        msg.toLowerCase().includes("daily screenshot limit")
          ? "Daily screenshot limit reached"
          : `Log save failed: ${msg}`,
        "warn",
      );
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
  }

  const displayDecisions = showInsights
    ? loggedDecisions
    : loggedDecisions.slice(0, 5);

  // ─── Login screen ───────────────────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <div style={styles.app}>
        <div
          style={{
            ...styles.shell,
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
          }}
        >
          <div
            style={{
              width: "min(400px,100%)",
              border: `1px solid ${palette.border}`,
              borderRadius: 24,
              background: palette.panel,
              padding: 24,
              display: "grid",
              gap: 16,
              boxShadow: "0 16px 42px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={styles.brandIcon}>ROS</div>
              <div>
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
                <div style={{ fontSize: 22, fontWeight: 900, marginTop: 2 }}>
                  Liquidity Lab
                </div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: palette.textSoft }}>
              Sign in to access journaling, AI review, and saved logs.
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <input
                style={fieldStyle}
                placeholder="Email"
                value={loginForm.email}
                onChange={(e) =>
                  setLoginForm((prev) => ({ ...prev, email: e.target.value }))
                }
              />
              <input
                style={fieldStyle}
                placeholder="Password"
                type="password"
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") loginUser();
                }}
              />
            </div>
            <button
              style={styles.primaryButton}
              type="button"
              onClick={loginUser}
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === "billing") {
    return (
      <div style={styles.app}>
        <div style={styles.shell}>
          <BillingPage token={getStoredToken()} compact={false} />
        </div>
      </div>
    );
  }

  // ─── Main dashboard ─────────────────────────────────────────────────────────

  return (
    <div style={styles.app}>
      <div style={styles.shell}>
        {/* TOP BAR */}
        <div style={styles.topbar}>
          <div style={styles.topbarRow}>
            <div style={styles.brandWrap}>
              <div style={styles.brandIcon}>ROS</div>
              <div>
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
                <div style={{ fontSize: 24, fontWeight: 900 }}>
                  Liquidity Lab
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <Pill tone={propStatus.tone}>{propStatus.status}</Pill>
              <Pill tone="neutral">
                {(currentUser?.billingPlan || "starter").toUpperCase()}
              </Pill>
              {aiRemaining != null && (
                <Pill tone="gold">{aiRemaining} AI left</Pill>
              )}
              <button
                style={styles.button}
                onClick={() => setActiveTab("billing")}
                type="button"
              >
                Billing
              </button>
              <button
                style={styles.button}
                onClick={() => window.location.reload()}
                type="button"
              >
                Refresh
              </button>
              <button
                style={{
                  ...styles.button,
                  border: "1px solid rgba(239,68,68,0.35)",
                  color: "#f87171",
                }}
                onClick={reportIssue}
                type="button"
              >
                Report Issue
              </button>
              <button
                style={styles.button}
                onClick={() => {
                  localStorage.removeItem("token");
                  localStorage.removeItem("liquidity_lab_token");
                  setIsAuthenticated(false);
                  setCurrentUser(null);
                  setActiveTab("login");
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* TICKER */}
        <SmartTicker
          items={tickerItems}
          onSelect={(item) => {
            if (item?._wave) selectWaveHead(item._wave);
            else setSelectedEvent(item);
          }}
        />

        {/* SESSION CLOCKS */}
        <SessionClockWidget />

        {/* STATS BAR */}
        <StatsBar decisions={loggedDecisions} />

        {/* MAIN GRID */}
        <div style={styles.mainGrid}>
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
          >
            <div style={styles.panelHeader}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 14 }}>Radar Feed</div>
                <div style={styles.subtext}>Waves · most recent first</div>
              </div>
              <Pill>{visibleWaves.length} active</Pill>
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
                  const state = getSignalState(wave.events?.[0]?.timestampUtc);
                  const stateColor =
                    state === "LIVE"
                      ? palette.long
                      : state === "AGING"
                        ? palette.gold
                        : palette.short;
                  return (
                    <div
                      key={wave.key}
                      onClick={() => selectWaveHead(wave)}
                      style={{
                        ...styles.waveCard,
                        borderLeft: `3px solid ${tone === "long" ? palette.long : palette.short}`,
                        "&:hover": { background: "rgba(255,255,255,0.03)" },
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
                  style={{ color: palette.textSoft, fontSize: 13, padding: 8 }}
                >
                  No live events yet.
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
              alignSelf: "start",
            }}
          >
            {/* Chart */}
            <div
              style={{
                ...styles.chartFrame,
                height: 440,
                minHeight: 440,
                flexShrink: 0,
                position: "relative",
              }}
            >
              <LightweightExecutionChart
                pair={chartPair}
                timeframe={activeTimeframe}
                entry={selectedEvent?.entry}
                stop={selectedEvent?.stop}
                tp1={selectedEvent?.tp1}
                tp2={selectedEvent?.tp2}
              />
            </div>
            {/* Exchange bar */}
            <div style={styles.exchangeBar}>
              <span style={styles.exchangeLabel}>Open on</span>
              {[
                ["BLOFIN", exchangeLinks.blofin],
                ["BINANCE", exchangeLinks.binance],
                ["BYBIT", exchangeLinks.bybit],
                ["OKX", exchangeLinks.okx],
                ["TV", exchangeLinks.tradingView],
              ].map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  style={styles.smallButton}
                >
                  {label}
                </a>
              ))}
            </div>

            {/* Signal insight bar */}
            <SignalInsightBar
              event={selectedEvent}
              rr={selectedEventRR}
              risk={decisionRiskAmount}
            />
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
                padding: "12px 12px 14px",
                display: "grid",
                gap: 10,
                alignContent: "start",
              }}
            >
              {/* Pair + Confidence */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                <MiniBox label="Pair" value={selectedEvent?.pair || "—"} />
                <MiniBox
                  label="Confidence"
                  value={`${Math.round((selectedEvent?.botConfidence || 0) * 100)}%`}
                  subtext={selectedEvent?.sweepType || "—"}
                />
              </div>

              {/* Confidence bar */}
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
                    {Math.round((selectedEvent?.botConfidence || 0) * 100)}%
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
                      width: `${Math.max(4, Math.round((selectedEvent?.botConfidence || 0) * 100))}%`,
                      height: "100%",
                      borderRadius: 999,
                      background:
                        (selectedEvent?.botConfidence || 0) >= 0.7
                          ? "linear-gradient(90deg,#22c55e,#86efac)"
                          : (selectedEvent?.botConfidence || 0) >= 0.45
                            ? "linear-gradient(90deg,#f59e0b,#fde68a)"
                            : "linear-gradient(90deg,#fb7185,#fecdd3)",
                    }}
                  />
                </div>
              </div>

              {/* Pattern + State */}
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
                    selectedEvent?.pattern || selectedEvent?.sweepType || "—"
                  }
                  subtext={selectedEvent?.structure || ""}
                />
                <MiniBox
                  label="State"
                  value={
                    selectedEvent?.tradeState ||
                    getSignalState(selectedEvent?.timestampUtc) ||
                    "—"
                  }
                />
              </div>

              <Divider />
              <SectionLabel>Prop Rules · {activePreset.label}</SectionLabel>

              {/* Prop status */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                <MiniBox
                  label="Daily Limit"
                  value={money(propStatus.dailyLoss)}
                  tone={propStatus.tone === "short" ? "short" : null}
                />
                <MiniBox
                  label="Max Drawdown"
                  value={money(propStatus.maxDrawdown)}
                />
              </div>
              <MiniBox
                label="Profit Target"
                value={money(propStatus.target)}
                subtext={activePreset.rules.consistencyHint}
              />

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

        {/* JOURNAL HEADER */}
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

          {/* RR summary row */}
          <div
            style={{
              padding: "12px 14px",
              borderBottom: `1px solid ${palette.borderSoft}`,
            }}
          >
            <div style={styles.topCardRow}>
              <MiniBox
                label="Planned RR1"
                value={rrText(decisionPlannedRR.rr1)}
                subtext={`Risk Δ ${num(decisionRiskAmount, 4)}`}
              />
              <MiniBox
                label="Planned RR2"
                value={rrText(decisionPlannedRR.rr2)}
                subtext={`Session · ${decisionForm.session}`}
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

          {/* Form */}
          <div style={{ padding: "14px 14px 18px" }}>
            <SectionLabel>Event Context</SectionLabel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,minmax(0,1fr))",
                gap: 10,
                marginBottom: 16,
              }}
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

            <SectionLabel>Execution Details</SectionLabel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,minmax(0,1fr))",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <FieldLabel label="Sweep Type">
                <select
                  style={fieldStyle}
                  value={decisionForm.sweepType}
                  onChange={(e) => updateDecision("sweepType", e.target.value)}
                >
                  {["High Sweep", "Low Sweep", "Equal Highs", "Equal Lows"].map(
                    (v) => (
                      <option key={v}>{v}</option>
                    ),
                  )}
                </select>
              </FieldLabel>
              <FieldLabel label="EMA Context">
                <select
                  style={fieldStyle}
                  value={decisionForm.emaContext}
                  onChange={(e) => updateDecision("emaContext", e.target.value)}
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

            <SectionLabel>Price Levels</SectionLabel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(6,minmax(0,1fr))",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <FieldLabel label="Entry">
                <input
                  style={fieldStyle}
                  value={decisionForm.entry}
                  onChange={(e) => updateDecision("entry", e.target.value)}
                />
              </FieldLabel>
              <FieldLabel label="Stop">
                <input
                  style={fieldStyle}
                  value={decisionForm.stop}
                  onChange={(e) => updateDecision("stop", e.target.value)}
                />
              </FieldLabel>
              <FieldLabel label="TP1">
                <input
                  style={fieldStyle}
                  value={decisionForm.tp1}
                  onChange={(e) => updateDecision("tp1", e.target.value)}
                />
              </FieldLabel>
              <FieldLabel label="TP2">
                <input
                  style={fieldStyle}
                  value={decisionForm.tp2}
                  onChange={(e) => updateDecision("tp2", e.target.value)}
                />
              </FieldLabel>
              <FieldLabel label="Exit">
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
                />
              </FieldLabel>
            </div>

            <SectionLabel>Discipline &amp; Outcome</SectionLabel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,minmax(0,1fr))",
                gap: 10,
                marginBottom: 16,
              }}
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
                style={{ ...fieldStyle, minHeight: 80, resize: "vertical" }}
                value={decisionForm.notes}
                onChange={(e) => updateDecision("notes", e.target.value)}
                placeholder="Describe your reasoning, what you saw, how you felt…"
              />
            </FieldLabel>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
                marginTop: 12,
              }}
            >
              <label
                style={{
                  ...styles.button,
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
              <button
                style={styles.primaryButton}
                type="button"
                onClick={saveDecision}
              >
                Log Trade / Apply Result
              </button>
              <button
                style={styles.button}
                type="button"
                onClick={runAiReviewNow}
              >
                {aiReviewLoading ? "Running AI…" : "Run AI Review"}
              </button>
            </div>

            {(aiReviewLoading || aiReviewResult) && (
              <div style={{ marginTop: 14 }}>
                <AiReviewPanel
                  entry={null}
                  liveReview={aiReviewResult}
                  loading={aiReviewLoading}
                  locked={!featureFlags.aiReview}
                />
              </div>
            )}
          </div>
        </div>
        {/* RECENT JOURNAL ENTRIES */}
        <div style={{ ...styles.journalShell }}>
          <div style={styles.journalHeader}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 15 }}>
                Recent Entries
              </div>
              <div style={styles.subtext}>Click a card to expand AI review</div>
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
                    style={{
                      ...cardButtonReset,
                      padding: "13px 14px",
                      borderRadius: 16,
                      border: `1px solid ${isExpanded ? getToneBorder(tone) : palette.border}`,
                      background: isExpanded
                        ? "rgba(255,255,255,0.025)"
                        : palette.card,
                      display: "grid",
                      gap: 10,
                      transition: "all 0.15s ease",
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
                        <div style={{ color: palette.textSoft, fontSize: 12 }}>
                          {log.eventType} · {log.sweepType} ·{" "}
                          {formatDateTime(log.timestamp)}
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
                        <div style={styles.topCardRow}>
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
                        {log.aiVerdict && (
                          <div
                            style={{ ...styles.aiSummaryCard, fontSize: 12 }}
                          >
                            <div style={styles.aiLabel}>Verdict</div>
                            <div style={{ marginTop: 4, fontWeight: 700 }}>
                              {log.aiVerdict}
                            </div>
                          </div>
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
