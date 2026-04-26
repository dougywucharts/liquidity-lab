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

function calcRiskAmount(entry, stop) {
  const e = Number(entry);
  const s = Number(stop);
  if (![e, s].every(Number.isFinite)) return null;
  const risk = Math.abs(e - s);
  return Number.isFinite(risk) && risk > 0 ? risk : null;
}

function rrText(rr) {
  return rr == null || !Number.isFinite(Number(rr))
    ? "—"
    : `${Number(rr).toFixed(2)}R`;
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
      if ((b.hotScore || 0) !== (a.hotScore || 0)) {
        return (b.hotScore || 0) - (a.hotScore || 0);
      }
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

      const freshEnough = recentMinutes <= 30;
      const strongEnough = conf >= 0.6 || count >= 2;

      return freshEnough && strongEnough;
    })
    .sort((a, b) => {
      if ((b.hotScore || 0) !== (a.hotScore || 0)) {
        return (b.hotScore || 0) - (a.hotScore || 0);
      }
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
  const value = String(tf || "")
    .trim()
    .toLowerCase();
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

function MiniBox({ label, value, subtext, tone = null }) {
  const isLong = tone === "long";
  const isShort = tone === "short";

  return (
    <div
      style={{
        border: `1px solid ${
          isLong
            ? "rgba(34,197,94,0.35)"
            : isShort
              ? "rgba(239,68,68,0.35)"
              : palette.border
        }`,
        background: palette.card,
        borderRadius: 16,
        padding: 12,
        display: "grid",
        gap: 5,
        minWidth: 0,
        boxShadow: isLong
          ? "0 0 12px rgba(34,197,94,0.25)"
          : isShort
            ? "0 0 12px rgba(239,68,68,0.25)"
            : "none",
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: palette.textDim,
          textTransform: "uppercase",
          letterSpacing: 0.8,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "clamp(14px, 0.9vw, 18px)",
          fontWeight: 900,
          color: isLong
            ? "rgb(74,222,128)"
            : isShort
              ? "rgb(248,113,113)"
              : palette.text,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          minWidth: 0,
        }}
      >
        {value}
      </div>
      {subtext ? (
        <div
          style={{
            fontSize: 12,
            color: palette.textSoft,
            lineHeight: 1.35,
            overflowWrap: "anywhere",
            wordBreak: "break-word",
            minWidth: 0,
          }}
        >
          {subtext}
        </div>
      ) : null}
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
      <div
        style={{
          fontSize: 11,
          color: palette.textDim,
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      <div style={{ fontWeight: 900, fontSize: 20 }}>{value}</div>
      <div style={{ fontSize: 12, color: palette.textSoft }}>{subtitle}</div>
    </div>
  );
}

function BillingPlaceholder({ currentUser, featureFlags, onBack }) {
  const isPro = ["active", "trialing", "beta"].includes(
    currentUser?.stripeStatus || "",
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
      }}
    >
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
              Liquidity Lab Billing
            </div>
            <div style={{ fontSize: 13, color: palette.textSoft }}>
              Manage your plan, feature access, and beta controls.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={styles.button} onClick={onBack} type="button">
              Dashboard
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Pill tone={isPro ? "long" : "gold"}>
            {isPro ? "PRO / BETA" : "FREE PLAN"}
          </Pill>
          <Pill>
            {String(currentUser?.billingPlan || "starter").toUpperCase()}
          </Pill>
          <Pill>{currentUser?.stripeStatus || "inactive"}</Pill>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
          }}
        >
          <MiniBox
            label="AI Review"
            value={featureFlags.aiReview ? "Unlocked" : "Locked"}
          />
          <MiniBox
            label="Screenshot"
            value={featureFlags.screenshotReview ? "Unlocked" : "Locked"}
          />
          <MiniBox
            label="Export"
            value={featureFlags.export ? "Unlocked" : "Locked"}
          />
          <MiniBox
            label="Advanced Stats"
            value={featureFlags.deeperStats ? "Unlocked" : "Locked"}
          />
        </div>
      </div>
    </div>
  );
}

function SmartTicker({ items, onSelect }) {
  const doubled = [...items, ...items];

  if (!items?.length) {
    return (
      <div style={styles.tickerWrap}>
        <div
          style={{
            padding: "10px 14px",
            fontSize: 12,
            color: palette.textSoft,
          }}
        >
          Waiting for high-confidence sweeps...
        </div>
      </div>
    );
  }

  return (
    <div style={styles.tickerWrap}>
      <style>{`
        @keyframes tickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .smart-ticker-track:hover {
          animation-play-state: paused !important;
        }
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
                ? "rgba(34,197,94,0.12)"
                : tone === "short"
                  ? "rgba(239,68,68,0.12)"
                  : "rgba(234,179,8,0.08)";

            const countColor =
              count >= 10
                ? "#22c55e"
                : count >= 5
                  ? "#f6c453"
                  : "rgba(255,255,255,0.65)";

            const recencyColor =
              minsAgo <= 2
                ? "#22c55e"
                : minsAgo <= 5
                  ? "#f6c453"
                  : "rgba(255,255,255,0.5)";

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
                  gap: 8,
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: `1px solid rgba(255,255,255,0.06)`,
                  background: bg,
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: isHot ? 900 : 700,
                  letterSpacing: 0.3,
                  boxShadow: isHot ? "0 0 12px rgba(246,196,83,0.30)" : "none",
                  transform: isHot ? "scale(1.03)" : "scale(1)",
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{ color: "#fff", fontWeight: 900 }}>
                  {evt?.pair}
                </span>
                <span style={{ opacity: 0.6 }}>{evt?.timeframe}</span>
                <span style={{ color: toneColor }}>
                  {String(evt?.directionBias || "Neutral").toUpperCase()}
                </span>
                <span style={{ opacity: 0.5, fontSize: 11 }}>
                  {evt?.sweepType || evt?.eventType}
                </span>

                {count > 1 ? (
                  <span
                    style={{
                      color: countColor,
                      fontWeight: 900,
                      fontSize: 13,
                      letterSpacing: 0.4,
                    }}
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

                <span style={{ opacity: 0.15 }}>|</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ChartLevelOverlay({ event }) {
  if (!event) return null;

  const levels = [
    { label: "TP2", value: Number(event.tp2), tone: "long" },
    { label: "TP1", value: Number(event.tp1), tone: "long" },
    { label: "ENTRY", value: Number(event.entry), tone: "gold" },
    { label: "STOP", value: Number(event.stop), tone: "short" },
  ].filter((x) => Number.isFinite(x.value));

  if (levels.length < 2) return null;

  const values = levels.map((x) => x.value);
  const rawHigh = Math.max(...values);
  const rawLow = Math.min(...values);
  const padding = (rawHigh - rawLow) * 0.25 || 0.01;
  const high = rawHigh + padding;
  const low = rawLow - padding;
  const range = high - low || 1;

  const entry = levels.find((x) => x.label === "ENTRY");
  const stop = levels.find((x) => x.label === "STOP");
  const tp1 = levels.find((x) => x.label === "TP1");

  const toPct = (value) => 14 + ((high - value) / range) * 72;
  const entryPct = entry ? toPct(entry.value) : null;
  const stopPct = stop ? toPct(stop.value) : null;
  const tpPct = tp1 ? toPct(tp1.value) : null;

  const riskTop =
    entryPct != null && stopPct != null ? Math.min(entryPct, stopPct) : null;
  const riskHeight =
    entryPct != null && stopPct != null ? Math.abs(entryPct - stopPct) : 0;

  const rewardTop =
    entryPct != null && tpPct != null ? Math.min(entryPct, tpPct) : null;
  const rewardHeight =
    entryPct != null && tpPct != null ? Math.abs(entryPct - tpPct) : 0;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 4,
      }}
    >
      {rewardTop != null && rewardHeight > 0 ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${rewardTop}%`,
            height: `${rewardHeight}%`,
            background:
              "linear-gradient(180deg, rgba(74,222,128,0.08), rgba(74,222,128,0.015))",
          }}
        />
      ) : null}

      {riskTop != null && riskHeight > 0 ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${riskTop}%`,
            height: `${riskHeight}%`,
            background:
              "linear-gradient(180deg, rgba(251,113,133,0.12), rgba(251,113,133,0.02))",
            borderTop: "1px solid rgba(251,113,133,0.18)",
            borderBottom: "1px solid rgba(251,113,133,0.18)",
          }}
        />
      ) : null}

      {levels.map((level) => {
        const pct = toPct(level.value);
        const color =
          level.tone === "long"
            ? "rgba(74,222,128,0.92)"
            : level.tone === "short"
              ? "rgba(251,113,133,0.92)"
              : "rgba(246,196,83,0.92)";

        return (
          <div
            key={level.label}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${pct}%`,
              borderTop: `1px dashed ${color}`,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 10,
                top: -12,
                padding: "4px 8px",
                borderRadius: 999,
                background: "rgba(3,6,11,0.82)",
                border: `1px solid ${color}`,
                color,
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: 0.6,
              }}
            >
              {level.label} {num(level.value)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
                minWidth: 56,
                textAlign: "center",
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
              minWidth: 72,
              textAlign: "center",
            }}
          >
            {score != null ? `${score}` : "—"}
          </div>
        </div>
      </div>

      <div style={styles.aiBody}>
        {loading ? (
          <div style={styles.aiSummaryCard}>Running AI review...</div>
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

  sessionWidget: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },
  sessionClockCard: {
    borderRadius: 18,
    padding: 14,
    display: "grid",
    gap: 8,
    transition: "all 0.22s ease",
  },
  sessionClockTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  sessionClockLabel: {
    fontSize: 11,
    color: palette.textDim,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontWeight: 800,
  },
  sessionClockTime: {
    fontSize: 26,
    fontWeight: 900,
    letterSpacing: 0.4,
  },
  sessionClockSub: {
    fontSize: 12,
    color: palette.textSoft,
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
    background:
      "linear-gradient(180deg, rgba(20,27,42,0.96), rgba(12,17,28,0.96))",
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
    gridTemplateColumns: "280px minmax(0, 1fr) 320px",
    gap: 12,
    alignItems: "start",
    minWidth: 0,
  },
  panel: {
    borderRadius: 22,
    border: `1px solid ${palette.border}`,
    background:
      "linear-gradient(180deg, rgba(10,14,22,0.98), rgba(6,10,16,0.98))",
    boxShadow: "0 10px 24px rgba(0,0,0,0.4)",
    overflow: "hidden",
    minWidth: 0,
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
    overflowY: "auto",
    overflowX: "visible",
    alignContent: "start",
    alignItems: "start",
    minHeight: 0,
    paddingRight: 6,
    paddingBottom: 14,
  },
  waveCard: {
    borderRadius: 20,
    border: `1px solid ${palette.border}`,
    background:
      "linear-gradient(180deg, rgba(14,20,32,0.98), rgba(9,13,23,0.98))",
    overflow: "visible",
    display: "grid",
    alignContent: "start",
    minHeight: 109,
    position: "relative",
    isolation: "isolate",
    zIndex: 1,
    boxShadow: "0 10px 24px rgba(0,0,0,0.22)",
  },
  expandedList: {
    display: "grid",
    gap: 8,
    padding: "12px 12px 14px 12px",
    borderTop: `1px solid ${palette.borderSoft}`,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.012))",
    position: "relative",
    zIndex: 6,
  },
  chartFrame: {
    position: "relative",
    width: "100%",
    height: "100%",
    minHeight: 0,
    borderRadius: 20,
    overflow: "hidden",
    border: `1px solid ${palette.border}`,
    background: palette.panel,
    boxShadow: "0 14px 34px rgba(0,0,0,0.35)",
    display: "flex",
    padding: 4,
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
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
    minWidth: 0,
  },
  tickerWrap: {
    borderRadius: 14,
    border: `1px solid ${palette.border}`,
    background: "linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0.65))",
    overflow: "hidden",
  },
  tickerViewport: {
    overflow: "hidden",
    width: "100%",
  },
  tickerTrack: {
    display: "flex",
    gap: 14,
    width: "max-content",
    padding: "10px 16px",
    animation: "tickerScroll 32s linear infinite",
  },
  planCard: {
    border: `1px solid ${palette.border}`,
    background: palette.card,
    borderRadius: 18,
    padding: 16,
    display: "grid",
    gap: 8,
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
    padding: "13px 14px",
    borderBottom: `1px solid ${palette.borderSoft}`,
    flexWrap: "wrap",
  },
  aiEyebrow: {
    fontSize: 10,
    color: palette.textDim,
    letterSpacing: 2.5,
    textTransform: "uppercase",
  },
  aiTitle: {
    fontSize: 18,
    fontWeight: 900,
    marginTop: 4,
  },
  aiBody: {
    padding: 12,
    display: "grid",
    gap: 12,
  },
  aiSummaryCard: {
    border: `1px solid ${palette.border}`,
    background: palette.card,
    borderRadius: 16,
    padding: 14,
    fontSize: 13,
    lineHeight: 1.6,
  },
  aiLabel: {
    fontSize: 11,
    color: palette.textDim,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: 800,
  },
  aiBreakdownGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },
  aiTwoCol: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 10,
  },
  aiListCard: {
    border: `1px solid ${palette.border}`,
    background: palette.card,
    borderRadius: 16,
    padding: 14,
    display: "grid",
    gap: 10,
  },
  aiList: {
    display: "grid",
    gap: 8,
  },
  aiListItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    fontSize: 13,
    color: palette.textSoft,
    lineHeight: 1.45,
  },
  aiBulletGood: {
    color: palette.long,
    fontSize: 12,
    marginTop: 2,
  },
  aiBulletBad: {
    color: palette.short,
    fontSize: 12,
    marginTop: 2,
  },
  aiEmpty: {
    fontSize: 12,
    color: palette.textDim,
  },
  aiMetaRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
};

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

  if (resolvedToken) {
    headers.Authorization = `Bearer ${resolvedToken}`;
  }

  return fetch(`${API_BASE}${path}`, { ...options, headers }).then(
    async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    },
  );
}

function SessionClockWidget() {
  const [now, setNow] = useState(Date.now());

  function formatMilitary(date, timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);

    const hh = parts.find((p) => p.type === "hour")?.value || "00";
    const mm = parts.find((p) => p.type === "minute")?.value || "00";
    return `${hh}${mm}`;
  }

  function formatLocalSessionRange(startHour, endHour) {
    const fmt = (hour) => {
      const h = hour % 24;
      return `${String(h).padStart(2, "0")}00`;
    };
    return `${fmt(startHour)}–${fmt(endHour)}`;
  }

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
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
      label: "Asia",
      tzLabel: "TKY",
      timeZone: "Asia/Tokyo",
      localPrimeStart: 20,
      localPrimeEnd: 23,
    },
  ];

  function getParts(timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).formatToParts(now);

    const hour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "numeric",
        hour12: false,
      }).format(now),
    );

    const display = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(now);

    return { hour, display };
  }

  function isPrime(hour, openHour, closeHour) {
    if (openHour <= closeHour) {
      return hour >= openHour && hour < closeHour;
    }
    return hour >= openHour || hour < closeHour;
  }

  return (
    <div style={styles.sessionWidget}>
      {sessions.map((session) => {
        const display = formatMilitary(new Date(now), session.timeZone);
        const localHour = new Date(now).getHours();

        const active = isPrime(
          localHour,
          session.localPrimeStart,
          session.localPrimeEnd,
        );

        return (
          <div
            key={session.key}
            style={{
              ...styles.sessionClockCard,
              border: active
                ? "1px solid rgba(74,222,128,0.34)"
                : `1px solid ${palette.border}`,
              boxShadow: active
                ? "0 0 24px rgba(34,197,94,0.25), inset 0 0 20px rgba(34,197,94,0.08)"
                : "0 10px 24px rgba(0,0,0,0.18)",
              background: active
                ? "linear-gradient(180deg, rgba(12,24,18,0.96), rgba(8,14,12,0.96))"
                : palette.card,
            }}
          >
            <div style={styles.sessionClockTop}>
              <div style={styles.sessionClockLabel}>{session.label}</div>
              <Pill tone={active ? "long" : "neutral"}>
                {active ? "Prime" : "Idle"}
              </Pill>
            </div>

            <div style={styles.sessionClockTime}>
              {display}
              <span
                style={{
                  fontSize: 11,
                  color: palette.textDim,
                  marginLeft: 8,
                  letterSpacing: 1,
                  opacity: 0.8,
                }}
              >
                {session.tzLabel}
              </span>
            </div>

            <div style={styles.sessionClockSub}>
              {session.label.toUpperCase()} PRIME (EST):{" "}
              {formatLocalSessionRange(
                session.localPrimeStart,
                session.localPrimeEnd,
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 👇 ADD HERE
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

export default function AppPreBeta() {
  const [events, setEvents] = useState([]);
  const [expandedWaves, setExpandedWaves] = useState({});
  const [selectedEvent, setSelectedEvent] = useState(null);

  const [activeTab, setActiveTab] = useState("dashboard");
  const [logMode, setLogMode] = useState("event");
  const [showInsights, setShowInsights] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState(null);

  const [isAuthenticated, setIsAuthenticated] = useState(
    Boolean(getStoredToken()),
  );
  const [currentUser, setCurrentUser] = useState({
    email: "dougywucharts@gmail.com",
    billingPlan: "starter",
    stripeStatus: "",
    stripeCustomerId: "",
    screenshotRemaining: 5,
  });
  const [featureFlags, setFeatureFlags] = useState(DEFAULT_FEATURE_FLAGS);
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
    pair: "",
    manualStructure: "",
    manualConfidence: "",
  });

  const isEventLocked = logMode === "event";

  const lockedFieldStyle = {
    ...fieldStyle,
    opacity: 0.78,
    cursor: "not-allowed",
    background: "rgba(255,255,255,0.025)",
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
  const isMountedRef = useRef(true);
  const [betaInput, setBetaInput] = useState("");
  const [betaUnlocked, setBetaUnlocked] = useState(() => {
    try {
      return localStorage.getItem("beta_access") === "granted";
    } catch {
      return false;
    }
  });

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
    return () => {
      isMountedRef.current = false;
      if (chartTimeoutRef.current) clearTimeout(chartTimeoutRef.current);
      Object.values(toastTimersRef.current).forEach((timerId) => {
        clearTimeout(timerId);
      });
      toastTimersRef.current = {};
      for (const entry of loggedDecisions) {
        if (entry?.screenshot && entry.screenshot.startsWith("blob:")) {
          URL.revokeObjectURL(entry.screenshot);
        }
      }
      if (
        decisionForm?.screenshot &&
        decisionForm.screenshot.startsWith("blob:")
      ) {
        URL.revokeObjectURL(decisionForm.screenshot);
      }
    };
  }, [loggedDecisions, decisionForm?.screenshot]);

  function toast(message, type = "info") {
    const id = `${Date.now()}_${Math.random()}`;

    setToasts((prev) => [
      ...prev,
      {
        id,
        message,
        type,
      },
    ]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
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
        const me = await apiFetch("/me").catch(() => null);
        if (!me) return;

        const profile = me.user || me.profile || me;
        setIsAuthenticated(true);
        if (profile?.aiRemaining !== undefined)
          setAiRemaining(profile.aiRemaining);
        setCurrentUser((prev) => ({
          ...prev,
          email: profile?.email || prev.email,
          billingPlan: profile?.billingPlan || prev.billingPlan,
          stripeStatus:
            profile?.stripeStatus ||
            profile?.billingStatus ||
            prev.stripeStatus,
          stripeCustomerId: profile?.stripeCustomerId || prev.stripeCustomerId,
          screenshotRemaining:
            typeof profile?.screenshotRemaining === "number"
              ? profile.screenshotRemaining
              : prev.screenshotRemaining,
        }));

        setFeatureFlags({
          manualJournal: true,
          aiReview: Boolean(profile?.featureFlags?.aiReview),
          screenshotReview: Boolean(profile?.featureFlags?.screenshotReview),
          export: Boolean(profile?.featureFlags?.export),
          deeperStats: Boolean(profile?.featureFlags?.deeperStats),
        });
      } catch {
        //
      }
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
            ? String(selectedEvent.entry)
            : prev.entry,
        stop:
          selectedEvent?.stop != null ? String(selectedEvent.stop) : prev.stop,
        tp1: selectedEvent?.tp1 != null ? String(selectedEvent.tp1) : prev.tp1,
        tp2: selectedEvent?.tp2 != null ? String(selectedEvent.tp2) : prev.tp2,
      }));
    }
  }, [selectedEvent, logMode]);

  useEffect(() => {
    if (chartTimeoutRef.current) clearTimeout(chartTimeoutRef.current);

    setChartLoading(true);
    setChartFailed(false);
    setChartReloadKey((k) => k + 1);

    chartTimeoutRef.current = setTimeout(() => {
      setChartLoading(false);
      setChartFailed(false);
    }, 3000);

    return () => {
      if (chartTimeoutRef.current) clearTimeout(chartTimeoutRef.current);
    };
  }, [
    selectedEvent?.pair,
    selectedEvent?.timeframe,
    logMode,
    decisionForm.pair,
    decisionForm.timeframe,
  ]);

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

  const chartSrc =
    `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart` +
    `&symbol=${encodeURIComponent(chartSymbol)}` +
    `&interval=${encodeURIComponent(chartInterval)}` +
    `&hidesidetoolbar=0` +
    `&symboledit=1` +
    `&saveimage=1` +
    `&toolbarbg=0f172a` +
    `&studies=[]` +
    `&theme=dark` +
    `&style=1` +
    `&timezone=America%2FNew_York` +
    `&withdateranges=1` +
    `&hideideas=1`;

  const waves = useMemo(() => groupWaves(events), [events]);

  // ACTIVE WAVES GOES HERE
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
        const stateRank = { LIVE: 0, AGING: 1, EXPIRED: 2 };

        const aRank = stateRank[a.state] ?? 9;
        const bRank = stateRank[b.state] ?? 9;

        if (aRank !== bRank) return aRank - bRank;

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

      const waveTime = parseEventDate(wave.events?.[0]?.timestampUtc).getTime();
      const existingTime = parseEventDate(
        existing.events?.[0]?.timestampUtc,
      ).getTime();

      if (waveTime > existingTime) {
        byPair.set(key, wave);
      }
    });

    return Array.from(byPair.values()).slice(0, 8);
  }, [activeWaves]);

  const tickerItems = useMemo(() => bestTickerItems(waves, 10), [waves]);
  const topTickerWaveKey = tickerItems?.[0]?._wave?.key || null;

  const activePreset = useMemo(() => {
    return (
      PROP_PRESETS.find((p) => p.id === propAccount.presetId) || PROP_PRESETS[0]
    );
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
        topOutcome: "—",
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
      entries.reduce(
        (sum, item) => sum + (Number(item.confidenceSelf) || 0),
        0,
      ) / Math.max(entries.length, 1);

    return {
      topExecution: mostCommon("executionType"),
      topLiquidity: mostCommon("liquidityLevel"),
      topOutcome: mostCommon("outcome"),
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
      };
    }

    const rules = activePreset.rules;
    const size = Number(propAccount.accountSize) || 0;
    const dailyLoss = size * rules.dailyLossPct;
    const maxDrawdown = size * rules.maxDrawdownPct;
    const target = size * rules.profitTargetPct;

    const riskPerTrade = Math.abs(
      (Number(decisionForm.entry) || 0) - (Number(decisionForm.stop) || 0),
    );
    const dailyUsage = dailyLoss ? riskPerTrade / dailyLoss : 0;
    const totalUsage = maxDrawdown ? riskPerTrade / maxDrawdown : 0;

    let status = "PASS";
    let tone = "long";
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

  const chartInfo = getChartInfo(selectedEvent?.pair);

  const selectedEventRR = useMemo(() => {
    return calcPlannedRR(
      selectedEvent?.entry,
      selectedEvent?.stop,
      selectedEvent?.tp1,
      selectedEvent?.tp2,
      selectedEvent?.rr1,
      selectedEvent?.rr2,
    );
  }, [selectedEvent]);

  const decisionRealizedRR = useMemo(() => {
    return calcRealizedRR(
      decisionForm.directionBias,
      decisionForm.entry,
      decisionForm.stop,
      decisionForm.exit,
    );
  }, [
    decisionForm.directionBias,
    decisionForm.entry,
    decisionForm.stop,
    decisionForm.exit,
  ]);

  const decisionPlannedRR = useMemo(() => {
    return calcPlannedRR(
      decisionForm.entry,
      decisionForm.stop,
      decisionForm.tp1,
      decisionForm.tp2,
      null,
      null,
    );
  }, [
    decisionForm.entry,
    decisionForm.stop,
    decisionForm.tp1,
    decisionForm.tp2,
  ]);

  const decisionRiskAmount = useMemo(() => {
    return calcRiskAmount(decisionForm.entry, decisionForm.stop);
  }, [decisionForm.entry, decisionForm.stop]);

  const activeLogEntry = useMemo(() => {
    return (
      loggedDecisions.find((item) => item.id === expandedLogId) ||
      loggedDecisions[0] ||
      null
    );
  }, [loggedDecisions, expandedLogId]);

  function updateDecision(field, value) {
    setDecisionForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleScreenshotUpload(event) {
    const allowScreenshotUpload =
      betaUnlocked ||
      featureFlags?.screenshotReview ||
      currentUser?.stripeStatus === "beta";

    if (!allowScreenshotUpload) {
      toast("Upgrade required for screenshot review.", "warn");
      if (event?.target) event.target.value = "";
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    if (
      decisionForm.screenshot &&
      decisionForm.screenshot.startsWith("blob:")
    ) {
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

  async function reportIssue() {
    try {
      const payload = {
        timestamp: new Date().toISOString(),
        page: window.location.href,
        selectedPair: selectedEvent?.pair || decisionForm?.pair || "",
        selectedTimeframe:
          selectedEvent?.timeframe || decisionForm?.timeframe || "",
        session: decisionForm?.session || selectedEvent?.session || "",
        directionBias:
          decisionForm?.directionBias || selectedEvent?.directionBias || "",
        eventType: decisionForm?.eventType || selectedEvent?.eventType || "",
        sweepType: decisionForm?.sweepType || selectedEvent?.sweepType || "",
        chartSymbol,
        chartInterval,
        activeTab,
        logMode,
        userEmail: currentUser?.email || "",
        notes: "User clicked quick issue report",
      };

      const res = await fetch(`${API_BASE}/bug-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to send issue report");

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
      } catch {
        //
      }

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
        durationMinutes: decisionForm?.durationMinutes || "",
        pnl: decisionForm?.pnl || "",
        rr1: selectedEvent?.rr1 ?? "",
        rr2: selectedEvent?.rr2 ?? "",
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

      const review = data.ai || data.review || null;
      setAiReviewResult(review);
      if (data.aiRemaining !== undefined) setAiRemaining(data.aiRemaining);
      if (data.remaining !== undefined) setAiRemaining(data.remaining);
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
      const message = String(err?.message || "");
      if (message.toLowerCase().includes("daily screenshot limit reached")) {
        setCurrentUser((prev) => ({ ...prev, screenshotRemaining: 0 }));
        toast("Daily screenshot limit reached", "warn");
      } else {
        toast(`Log save failed: ${message}`, "warn");
      }
      return;
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
      rr1: calcPlannedRR(
        payload.entry,
        payload.stop,
        payload.tp1,
        payload.tp2,
        selectedEvent?.rr1,
        selectedEvent?.rr2,
      ).rr1,
      rr2: calcPlannedRR(
        payload.entry,
        payload.stop,
        payload.tp1,
        payload.tp2,
        selectedEvent?.rr1,
        selectedEvent?.rr2,
      ).rr2,
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
        "Continue following your rules and review recurring patterns.",
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
          aiSummary: "AI Review is locked on the current plan.",
          aiVerdict: "",
          aiCoachingNote:
            "Upgrade in Billing to unlock AI trade review and coaching.",
          aiStrengths: [],
          aiMistakes: [],
          setupScore: null,
          executionScore: null,
          managementScore: null,
          chartRead: "",
          setupAssessment: "",
          executionAssessment: "",
          riskAssessment: "",
          biasAlignment: "",
          whatWasGood: [],
          whatNeedsWork: [],
          usedScreenshot: false,
        };

    setLoggedDecisions((prev) => [finalEntry, ...prev].slice(0, 60));
    setExpandedLogId(finalEntry.id);
    toast(
      finalEntry.aiGrade
        ? `Decision logged • Grade ${finalEntry.aiGrade}`
        : "Decision logged",
      "success",
    );
  }

  const displayDecisions = showInsights
    ? loggedDecisions
    : loggedDecisions.slice(0, 3);

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
            Enter your beta code to unlock the live radar, journal, and review
            flow.
          </div>

          <input
            value={betaInput}
            onChange={(e) => setBetaInput(e.target.value)}
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px solid #333",
              background: "#0b0f1a",
              color: "#fff",
              outline: "none",
            }}
            placeholder="Enter beta code"
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
              width: "min(420px, 100%)",
              border: `1px solid ${palette.border}`,
              borderRadius: 24,
              background: palette.panel,
              padding: 22,
              display: "grid",
              gap: 14,
              boxShadow: "0 16px 42px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "grid", gap: 4 }}>
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
                Liquidity Lab Login
              </div>
              <div style={{ fontSize: 13, color: palette.textSoft }}>
                Sign in to access billing, journaling, AI review, and saved
                logs.
              </div>
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

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                style={styles.primaryButton}
                type="button"
                onClick={loginUser}
              >
                Login
              </button>
            </div>
          </div>
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
            onBack={() => setActiveTab("dashboard")}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <div style={styles.shell}>
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
                <div style={{ fontSize: 26, fontWeight: 900 }}>
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
              {propStatus && (
                <Pill tone={propStatus.tone}>{propStatus.status}</Pill>
              )}

              <Pill>{currentUser?.billingPlan || "starter"}</Pill>

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
                  border: "1px solid rgba(239,68,68,0.4)",
                  color: "#f87171",
                }}
                onClick={reportIssue}
                type="button"
              >
                Report Issue
              </button>

              <button
                style={{
                  ...styles.button,
                  opacity: 0.6,
                  cursor: "not-allowed",
                }}
                type="button"
                onClick={() =>
                  toast("Members Vault unlocks in a later beta.", "warn")
                }
              >
                Members Vault 🔒
              </button>
            </div>
          </div>
        </div>

        <SmartTicker
          items={tickerItems}
          onSelect={(item) => {
            if (item?._wave) {
              selectWaveHead(item._wave);
            } else {
              setSelectedEvent(item);
            }
          }}
        />

        <SessionClockWidget />

        <div style={styles.mainGrid}>
          <div
            style={{
              ...styles.panel,
              height: 650,
              display: "grid",
              gridTemplateRows: "auto minmax(0, 1fr)",
              minHeight: 0,
            }}
          >
            <div style={styles.panelHeader}>
              <div>
                <div style={{ fontWeight: 900 }}>Radar Feed</div>
                <div style={styles.subtext}>
                  Grouped by wave, most recent first.
                </div>
              </div>
              <Pill>{visibleWaves.length} active</Pill>
            </div>

            <div
              style={{
                ...styles.panelBody,
                ...styles.radarList,
                minWidth: 0,
                overflowX: "hidden",
              }}
            >
              {visibleWaves.length > 0 ? (
                visibleWaves.map((wave) => {
                  const tone = directionTone(wave.directionBias);
                  const isExpanded = Boolean(expandedWaves[wave.key]);

                  const signalState =
                    wave.state ||
                    getSignalState(wave.events?.[0]?.timestampUtc);
                  const signalStateStyle =
                    signalState === "LIVE"
                      ? {
                          opacity: 1,
                          borderColor:
                            tone === "long"
                              ? "rgba(74,222,128,0.45)"
                              : tone === "short"
                                ? "rgba(251,113,133,0.48)"
                                : "rgba(246,196,83,0.45)",
                          background:
                            tone === "long"
                              ? "rgba(74,222,128,0.02)" // 👈 toned down
                              : tone === "short"
                                ? "rgba(251,113,133,0.025)"
                                : "rgba(246,196,83,0.02)",

                          // 👇 ADD THIS
                          borderLeft:
                            tone === "long"
                              ? "3px solid rgba(74,222,128,0.7)"
                              : tone === "short"
                                ? "3px solid rgba(251,113,133,0.7)"
                                : "3px solid rgba(246,196,83,0.7)",
                        }
                      : signalState === "AGING"
                        ? {
                            opacity: 0.88,
                            borderColor: "rgba(246,196,83,0.42)",
                            background: "rgba(246,196,83,0.025)",

                            // 👇 ADD THIS
                            borderLeft: "3px solid rgba(246,196,83,0.6)",
                          }
                        : {
                            opacity: 0.72,
                            borderColor: "rgba(120,120,120,0.28)",
                            background: "rgba(120,120,120,0.02)",
                            filter: "grayscale(0.18)",

                            // 👇 ADD THIS
                            borderLeft: "3px solid rgba(120,120,120,0.3)",
                          };
                  const recentMinutes = wave.events?.[0]?.timestampUtc
                    ? Math.floor(
                        (Date.now() -
                          parseEventDate(
                            wave.events[0].timestampUtc,
                          ).getTime()) /
                          60000,
                      )
                    : 999;

                  const isHotWave =
                    (wave.events?.length || 0) >= 3 || recentMinutes <= 3;

                  const isTopTickerWave =
                    topTickerWaveKey && wave.key === topTickerWaveKey;

                  return (
                    <div
                      key={wave.key}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = isHotWave
                          ? "translateY(-4px) scale(1.015)"
                          : "translateY(-3px) scale(1.01)";
                        e.currentTarget.style.zIndex = 8;

                        if (isHotWave) {
                          e.currentTarget.style.boxShadow =
                            tone === "long"
                              ? "0 0 0 1px rgba(74,222,128,0.45), 0 22px 50px rgba(74,222,128,0.28)"
                              : tone === "short"
                                ? "0 0 0 1px rgba(251,113,133,0.45), 0 22px 50px rgba(251,113,133,0.28)"
                                : "0 18px 42px rgba(0,0,0,0.34)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform =
                          "translateY(0) scale(1)";
                        e.currentTarget.style.zIndex = 1;
                        e.currentTarget.style.boxShadow = "";
                      }}
                      style={{
                        ...styles.waveCard,
                        ...signalStateStyle,

                        width: "100%",
                        minWidth: 0,
                        overflow: "hidden",

                        // 👇 ADD HERE
                        padding: "10px 12px",
                        gap: 6,

                        borderLeft:
                          tone === "long"
                            ? "3px solid #4ade80"
                            : tone === "short"
                              ? "3px solid #fb7185"
                              : "3px solid #f6c453",

                        transition:
                          "transform 0.15s ease, box-shadow 0.15s ease",

                        borderColor:
                          signalState !== "LIVE"
                            ? signalStateStyle.borderColor
                            : isTopTickerWave
                              ? tone === "long"
                                ? "rgba(74,222,128,0.55)"
                                : tone === "short"
                                  ? "rgba(251,113,133,0.55)"
                                  : getToneBorder(tone)
                              : signalStateStyle.borderColor,

                        boxShadow: isTopTickerWave
                          ? tone === "long"
                            ? "0 0 0 1px rgba(74,222,128,0.45), 0 18px 44px rgba(74,222,128,0.22)"
                            : tone === "short"
                              ? "0 0 0 1px rgba(251,113,133,0.45), 0 18px 44px rgba(251,113,133,0.22)"
                              : "0 14px 30px rgba(0,0,0,0.30)"
                          : isHotWave
                            ? tone === "long"
                              ? "0 0 0 1px rgba(74,222,128,0.35), 0 16px 40px rgba(74,222,128,0.18)"
                              : tone === "short"
                                ? "0 0 0 1px rgba(251,113,133,0.35), 0 16px 40px rgba(251,113,133,0.18)"
                                : "0 12px 28px rgba(0,0,0,0.28)"
                            : "0 10px 24px rgba(0,0,0,0.22)",
                      }}
                    >
                      {/* HEADER */}
                      <div
                        onClick={() => selectWaveHead(wave)}
                        style={{
                          display: "grid",
                          gap: 6,
                          padding: "10px 12px",
                          cursor: "pointer",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 10,
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              minWidth: 0,
                              flex: 1,
                              fontWeight: 900,
                              fontSize: 15,
                              lineHeight: 1.1,
                            }}
                          >
                            <span
                              style={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                minWidth: 0,
                                maxWidth: 120,
                              }}
                            >
                              {wave.pair}
                            </span>

                            <span
                              style={{
                                flexShrink: 0,
                                fontSize: 10,
                                fontWeight: 900,
                                letterSpacing: 0.5,
                                padding: "2px 6px",
                                borderRadius: 6,
                                background:
                                  tone === "long"
                                    ? "rgba(74,222,128,0.12)"
                                    : tone === "short"
                                      ? "rgba(251,113,133,0.12)"
                                      : "rgba(246,196,83,0.12)",
                                color:
                                  tone === "long"
                                    ? "#4ade80"
                                    : tone === "short"
                                      ? "#fb7185"
                                      : "#f6c453",
                              }}
                            >
                              {wave.directionBias?.toUpperCase() || "—"}
                            </span>
                          </div>

                          <button
                            style={{
                              ...styles.button,
                              flexShrink: 0,
                              padding: "7px 10px",
                              fontSize: 12,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedWaves((prev) => ({
                                ...prev,
                                [wave.key]: !prev[wave.key],
                              }));
                            }}
                          >
                            {isExpanded ? "Hide" : "Show"}
                          </button>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                            flexWrap: "wrap",
                            fontSize: 12,
                            color: palette.textSoft,
                            fontWeight: 600,
                          }}
                        >
                          <span>{wave.timeframe}</span>

                          {wave.events?.length > 1 && (
                            <>
                              <span style={{ opacity: 0.45 }}>•</span>
                              <span
                                style={{
                                  padding: "2px 6px",
                                  borderRadius: 999,
                                  background:
                                    wave.events.length >= 5
                                      ? "rgba(246,196,83,0.16)"
                                      : "rgba(255,255,255,0.06)",
                                  color:
                                    wave.events.length >= 5
                                      ? palette.gold
                                      : palette.textSoft,
                                  fontWeight: 800,
                                  fontSize: 11,
                                }}
                              >
                                {wave.events.length}x
                              </span>
                            </>
                          )}

                          {wave.events?.[0]?.timestampUtc && (
                            <>
                              <span style={{ opacity: 0.45 }}>•</span>
                              <span>
                                {minutesAgo(wave.events[0].timestampUtc)}
                              </span>

                              <span style={{ opacity: 0.45 }}>•</span>

                              <span
                                style={{
                                  color:
                                    signalState === "LIVE"
                                      ? "rgba(74,222,128,0.95)"
                                      : "rgba(246,196,83,0.85)",
                                  fontWeight: 900,
                                  animation:
                                    signalState === "LIVE"
                                      ? "pulseLive 1.2s ease-in-out infinite"
                                      : "none",
                                }}
                              >
                                {signalState === "LIVE"
                                  ? `LIVE ${getSignalCountdown(wave.events?.[0]?.timestampUtc)}`
                                  : "AGING"}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* EXPANDED */}
                      {isExpanded && (
                        <div
                          style={{
                            padding: "12px 14px",
                            borderTop: `1px solid ${palette.borderSoft}`,
                            display: "grid",
                            gap: 10,
                          }}
                        >
                          <div style={styles.rightPanelGroup}>
                            <div style={styles.topCardRow}>
                              <MiniBox
                                label="Entry"
                                value={num(wave.events[0]?.entry)}
                              />
                              <MiniBox
                                label="TP1"
                                value={num(wave.events[0]?.tp1)}
                              />
                              <MiniBox
                                label="TP2"
                                value={num(wave.events[0]?.tp2)}
                              />
                              <MiniBox
                                label="Time"
                                value={formatTimeOnly(
                                  wave.events[0]?.timestampUtc,
                                )}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div style={{ color: palette.textSoft, fontSize: 13 }}>
                  No live events yet. Trigger /test-sweep or wait for the
                  scanner.
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateRows: "420px auto auto",
              gap: 12,
              minWidth: 0,
              alignContent: "start",
            }}
          >
            <div
              style={{
                ...styles.chartFrame,
                marginBottom: 0,
                minHeight: 0,
                height: "100%",
              }}
            >
              <iframe
                key={`${chartSymbol}_${chartInterval}_${chartReloadKey}`}
                src={chartSrc}
                style={{
                  width: "100%",
                  height: "100%",
                  flex: 1,
                  border: "none",
                  display: "block",
                }}
              />

              <ChartLevelOverlay event={selectedEvent} />

              {chartLoading ? (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 3,
                    display: "grid",
                    placeItems: "center",
                    background:
                      "linear-gradient(180deg, rgba(3,6,11,0.52), rgba(3,6,11,0.78))",
                    backdropFilter: "none",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gap: 12,
                      justifyItems: "center",
                      padding: 20,
                      minWidth: 240,
                      borderRadius: 18,
                      background: "rgba(15,23,42,0.72)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      boxShadow: "0 12px 30px rgba(0,0,0,0.28)",
                    }}
                  >
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: "50%",
                        border: "3px solid rgba(255,255,255,0.14)",
                        borderTopColor: "rgba(239,68,68,0.95)",
                        animation: "spin 0.9s linear infinite",
                      }}
                    />
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: 15,
                        letterSpacing: 0.2,
                      }}
                    >
                      Syncing liquidity map
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "rgba(255,255,255,0.66)",
                        textAlign: "center",
                      }}
                    >
                      {selectedEvent?.pair || decisionForm.pair || "BTC/USDT"} ·{" "}
                      {selectedEvent?.timeframe ||
                        decisionForm.timeframe ||
                        "1m"}
                    </div>
                  </div>
                </div>
              ) : null}

              {chartFailed ? (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "grid",
                    placeItems: "center",
                    background: "rgba(3,6,11,0.82)",
                    zIndex: 4,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gap: 10,
                      justifyItems: "center",
                    }}
                  >
                    <div style={{ color: palette.textSoft }}>
                      Chart failed to load.
                    </div>
                    <button
                      style={styles.primaryButton}
                      type="button"
                      onClick={retryChart}
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div style={styles.panel}>
              <div style={styles.panelBody}>
                <div style={styles.topCardRow}>
                  <MiniBox
                    label="Entry"
                    value={num(selectedEvent?.entry)}
                    subtext={`Stop ${num(selectedEvent?.stop)}`}
                  />
                  <MiniBox
                    label="TP1"
                    value={num(selectedEvent?.tp1)}
                    subtext={rrText(selectedEventRR.rr1)}
                  />
                  <MiniBox
                    label="TP2"
                    value={num(selectedEvent?.tp2)}
                    subtext={rrText(selectedEventRR.rr2)}
                  />
                  <MiniBox
                    label="Session"
                    value={selectedEvent?.session || "—"}
                    subtext={formatDateTime(selectedEvent?.timestampUtc)}
                  />
                </div>
              </div>
            </div>
            <AiReviewPanel
              entry={activeLogEntry}
              liveReview={aiReviewResult}
              loading={aiReviewLoading}
              locked={false}
            />
          </div>

          <div
            style={{
              display: "grid",
              gap: 10,
              alignContent: "start",
              minWidth: 0,
            }}
          >
            <div
              style={{
                ...styles.panel,
                minHeight: 185,
                display: "grid",
                alignContent: "stretch",
              }}
            >
              <div style={styles.panelHeader}>
                <div>
                  <div style={{ fontWeight: 900 }}>Decision Context</div>
                  <div style={styles.subtext}>
                    Current event and prop controls.
                  </div>
                </div>
              </div>

              <div style={styles.panelBody}>
                <MiniBox
                  label="Selected Pair"
                  value={selectedEvent?.pair || "BTC/USDT"}
                  subtext={selectedEvent?.eventType || "No event"}
                />
                <MiniBox
                  label="Confidence"
                  value={`${((Number(selectedEvent?.botConfidence) || 0) * 100).toFixed(0)}%`}
                  subtext={selectedEvent?.sweepType || "—"}
                />
                <MiniBox
                  label="Prop Daily Loss"
                  value={money(propStatus.dailyLoss)}
                  subtext={`Target ${money(propStatus.target)}`}
                />
                <MiniBox
                  label="Top Execution"
                  value={advancedStats.topExecution}
                  subtext={`Avg confidence self ${advancedStats.avgConfidenceSelf.toFixed(1)}`}
                />

                <select
                  style={fieldStyle}
                  value={propAccount.presetId}
                  onChange={(e) =>
                    setPropAccount((prev) => ({
                      ...prev,
                      presetId: e.target.value,
                    }))
                  }
                >
                  {PROP_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>

                <select
                  style={fieldStyle}
                  value={propAccount.accountSize}
                  onChange={(e) =>
                    setPropAccount((prev) => ({
                      ...prev,
                      accountSize: Number(e.target.value) || 0,
                    }))
                  }
                >
                  {activePreset.accountSizes.map((size) => (
                    <option key={size} value={size}>
                      {size === 0 ? "Off" : `$${size.toLocaleString()}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            ...styles.journalShell,
            width: "100%",
            marginTop: 0,
          }}
        >
          <div style={styles.journalHeader}>
            <div>
              <div style={{ fontWeight: 900 }}>Behavior Engine Journal</div>
              <div style={styles.subtext}>
                Log event-linked or manual decisions with AI review.
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
              <button
                style={{
                  ...styles.button,
                  background:
                    logMode === "event"
                      ? "rgba(74,222,128,0.12)"
                      : "rgba(59,130,246,0.12)",
                  border:
                    logMode === "event"
                      ? "1px solid rgba(74,222,128,0.35)"
                      : "1px solid rgba(59,130,246,0.35)",
                  fontWeight: 900,
                }}
                onClick={() =>
                  setLogMode((prev) => (prev === "event" ? "manual" : "event"))
                }
                type="button"
              >
                {logMode === "event" ? "EVENT MODE" : "MANUAL MODE"}
              </button>

              <button
                style={{
                  ...styles.button,
                  opacity: 0.7,
                }}
                onClick={handleExportLogs}
                type="button"
              >
                Export Logs
              </button>
            </div>
          </div>

          <div style={{ padding: 12, display: "grid", gap: 12 }}>
            <div style={styles.topCardRow}>
              <MiniBox
                label="Planned RR1"
                value={rrText(decisionPlannedRR.rr1)}
                subtext={`Risk ${num(decisionRiskAmount, 4)}`}
              />
              <MiniBox
                label="Planned RR2"
                value={rrText(decisionPlannedRR.rr2)}
                subtext={`Session ${decisionForm.session}`}
              />
              <MiniBox
                label="Realized RR"
                value={rrText(decisionRealizedRR)}
                subtext={`Outcome ${decisionForm.outcome}`}
              />
              <MiniBox
                label="Prop Mode"
                value={propStatus.status}
                subtext={`${money(propStatus.dailyLoss)} daily loss`}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 10,
                alignItems: "start",
              }}
            >
              <input
                style={isEventLocked ? lockedFieldStyle : fieldStyle}
                value={decisionForm.pair}
                onChange={(e) => updateDecision("pair", e.target.value)}
                placeholder="Pair"
                disabled={isEventLocked}
              />

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

              <select
                style={fieldStyle}
                value={decisionForm.action}
                onChange={(e) => updateDecision("action", e.target.value)}
              >
                {["Taken", "Passed"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>

              <select
                style={fieldStyle}
                value={decisionForm.timing}
                onChange={(e) => updateDecision("timing", e.target.value)}
              >
                {["On Confirmation", "Early", "Chase Entry"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>

              <select
                style={fieldStyle}
                value={decisionForm.planFollowed}
                onChange={(e) => updateDecision("planFollowed", e.target.value)}
              >
                {["Yes", "No"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>

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

              <select
                style={fieldStyle}
                value={decisionForm.executionType}
                onChange={(e) =>
                  updateDecision("executionType", e.target.value)
                }
              >
                {["Limit Retest", "Market Confirmation", "Breakdown Entry"].map(
                  (v) => (
                    <option key={v}>{v}</option>
                  ),
                )}
              </select>

              <select
                style={fieldStyle}
                value={decisionForm.liquidityLevel}
                onChange={(e) =>
                  updateDecision("liquidityLevel", e.target.value)
                }
              >
                {["Range High", "Range Low", "Session High", "Session Low"].map(
                  (v) => (
                    <option key={v}>{v}</option>
                  ),
                )}
              </select>

              <select
                style={fieldStyle}
                value={decisionForm.htfBias}
                onChange={(e) => updateDecision("htfBias", e.target.value)}
              >
                {["Bearish", "Bullish", "Neutral"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>

              <select
                style={fieldStyle}
                value={decisionForm.entryTrigger}
                onChange={(e) => updateDecision("entryTrigger", e.target.value)}
              >
                {["Reclaim Failure", "Breakdown", "Wick Rejection"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>

              <select
                style={fieldStyle}
                value={decisionForm.outcome}
                onChange={(e) => updateDecision("outcome", e.target.value)}
              >
                {["Open", "Win", "Loss", "Scratch"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>

              <input
                style={fieldStyle}
                value={decisionForm.entry}
                onChange={(e) => updateDecision("entry", e.target.value)}
                placeholder="Entry"
              />
              <input
                style={fieldStyle}
                value={decisionForm.stop}
                onChange={(e) => updateDecision("stop", e.target.value)}
                placeholder="Stop"
              />
              <input
                style={fieldStyle}
                value={decisionForm.tp1}
                onChange={(e) => updateDecision("tp1", e.target.value)}
                placeholder="TP1"
              />
              <input
                style={fieldStyle}
                value={decisionForm.tp2}
                onChange={(e) => updateDecision("tp2", e.target.value)}
                placeholder="TP2"
              />
              <input
                style={fieldStyle}
                value={decisionForm.exit}
                onChange={(e) => updateDecision("exit", e.target.value)}
                placeholder="Exit"
              />
              <input
                style={fieldStyle}
                value={decisionForm.pnl}
                onChange={(e) => updateDecision("pnl", e.target.value)}
                placeholder="PnL"
              />

              <input
                style={fieldStyle}
                value={decisionForm.disciplineScore}
                onChange={(e) =>
                  updateDecision("disciplineScore", e.target.value)
                }
                placeholder="Discipline Score"
              />
              <input
                style={fieldStyle}
                value={decisionForm.setupQuality}
                onChange={(e) => updateDecision("setupQuality", e.target.value)}
                placeholder="Setup Quality"
              />
              <input
                style={fieldStyle}
                value={decisionForm.emotionalPressure}
                onChange={(e) =>
                  updateDecision("emotionalPressure", e.target.value)
                }
                placeholder="Emotional Pressure"
              />
              <input
                style={fieldStyle}
                value={decisionForm.confidenceSelf}
                onChange={(e) =>
                  updateDecision("confidenceSelf", e.target.value)
                }
                placeholder="Confidence Self"
              />

              <textarea
                style={{
                  ...fieldStyle,
                  minHeight: 88,
                  resize: "vertical",
                  gridColumn: "1 / -1",
                }}
                value={decisionForm.notes}
                onChange={(e) => updateDecision("notes", e.target.value)}
                placeholder="Notes"
              />

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "center",
                  gridColumn: "1 / -1",
                }}
              >
                <label
                  style={{
                    ...styles.button,
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  Screenshot
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleScreenshotUpload}
                    style={{ display: "none" }}
                  />
                </label>

                {decisionForm.screenshot ? (
                  <img
                    src={decisionForm.screenshot}
                    alt="Trade screenshot"
                    style={{
                      width: 68,
                      height: 68,
                      objectFit: "cover",
                      borderRadius: 12,
                      border: `1px solid ${palette.border}`,
                    }}
                  />
                ) : null}

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
                  {aiReviewLoading ? "Running AI..." : "Run AI Review"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={{ ...styles.journalShell, width: "100%" }}>
          <div style={styles.journalHeader}>
            <div>
              <div style={{ fontWeight: 900 }}>Recent Journal Entries</div>
              <div style={styles.subtext}>
                Click a log card to load its AI review.
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                style={styles.button}
                onClick={() => setShowInsights((prev) => !prev)}
                type="button"
              >
                {showInsights ? "Show Less" : "Show More"}
              </button>
            </div>
          </div>

          <div
            style={{
              padding: 12,
              display: "grid",
              gap: 10,
              maxHeight: 520,
              overflowY: "auto",
            }}
          >
            {displayDecisions.length ? (
              displayDecisions.map((log) => {
                const isExpanded = expandedLogId === log.id;
                const tone = gradeTone(log.aiGrade || log.executionAssessment);
                const direction = log.directionBias;
                const isLong = direction === "Long";
                const isShort = direction === "Short";
                return (
                  <button
                    key={log.id}
                    type="button"
                    onClick={() => toggleLogCard(log.id)}
                    style={{
                      ...cardButtonReset,
                      padding: 14,
                      borderRadius: 18,
                      border: `1px solid ${getToneBorder(tone)}`,
                      background: palette.card,
                      display: "grid",
                      gap: 10,
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
                      <div style={{ display: "grid", gap: 6 }}>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ fontWeight: 900, fontSize: 16 }}>
                            {log.pair}
                          </div>
                          <Pill tone={directionTone(log.directionBias)}>
                            {log.directionBias}
                          </Pill>
                          <Pill>{log.timeframe}</Pill>
                          {log.aiGrade ? (
                            <Pill tone={tone}>{log.aiGrade}</Pill>
                          ) : null}
                        </div>
                        <div style={{ color: palette.textSoft, fontSize: 13 }}>
                          {log.eventType} • {log.sweepType} •{" "}
                          {formatDateTime(log.timestamp)}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gap: 6,
                          justifyItems: "end",
                        }}
                      >
                        <div style={{ fontSize: 12, color: palette.textSoft }}>
                          {log.outcome || "—"}
                        </div>
                        <div style={{ fontWeight: 800 }}>{money(log.pnl)}</div>
                      </div>
                    </div>

                    {isExpanded ? (
                      <div
                        style={{
                          display: "grid",
                          gap: 8,
                          paddingTop: 8,
                          borderTop: `1px solid ${palette.borderSoft}`,
                        }}
                      >
                        <div style={styles.topCardRow}>
                          <MiniBox
                            label="Entry / Stop"
                            value={`${num(log.entry)} / ${num(log.stop)}`}
                            subtext={`Realized ${rrText(log.realizedRR)}`}
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
                        </div>

                        {log.notes ? (
                          <div
                            style={{ color: palette.textSoft, fontSize: 13 }}
                          >
                            {log.notes}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <div style={{ color: palette.textSoft, fontSize: 13 }}>
                No journal entries yet.
              </div>
            )}
          </div>
        </div>

        {/* GLOBAL TOASTS */}
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
}
