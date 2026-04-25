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

function bestTickerItems(events, limit = 10) {
  if (!Array.isArray(events)) return [];
  const now = Date.now();
  const maxAgeMs = 1000 * 60 * 20;

  return [...events]
    .filter((evt) => {
      const ts = parseEventDate(evt?.timestampUtc)?.getTime() || 0;
      const ageOk = ts > 0 && now - ts <= maxAgeMs;
      const conf = Number(evt?.botConfidence) || 0;
      const confOk = conf >= 0.7;
      const type = String(evt?.eventType || "").toUpperCase();
      const typeOk =
        type.includes("CONFIRMED") ||
        type.includes("ACCEPTED") ||
        type.includes("DOUBLE");
      return ageOk && confOk && typeOk;
    })
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
      {subtext ? (
        <div style={{ fontSize: 12, color: palette.textSoft }}>{subtext}</div>
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
            const isStrong = confidence >= 0.8;

            const toneColor =
              tone === "long"
                ? "#22c55e"
                : tone === "short"
                  ? "#ef4444"
                  : "#eab308";

            const bg =
              tone === "long"
                ? "rgba(34,197,94,0.08)"
                : tone === "short"
                  ? "rgba(239,68,68,0.08)"
                  : "rgba(234,179,8,0.08)";

            return (
              <button
                key={`${eventKey(evt)}_${index}`}
                onClick={() => onSelect?.(evt)}
                style={{
                  ...cardButtonReset,
                  width: "auto",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: `1px solid rgba(255,255,255,0.06)`,
                  background: bg,
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: isStrong ? 900 : 700,
                  letterSpacing: 0.3,
                  boxShadow: isStrong
                    ? "0 0 12px rgba(255,255,255,0.08)"
                    : "none",
                }}
              >
                <span style={{ color: "#fff" }}>{evt?.pair}</span>
                <span style={{ opacity: 0.6 }}>{evt?.timeframe}</span>
                <span style={{ color: toneColor }}>
                  {String(evt?.directionBias || "Neutral").toUpperCase()}
                </span>
                <span style={{ opacity: 0.8 }}>
                  {evt?.sweepType || evt?.eventType}
                </span>
                <span style={{ color: toneColor }}>
                  {(confidence * 100).toFixed(0)}%
                </span>
                <span style={{ opacity: 0.5 }}>
                  {formatTimeOnly(evt?.timestampUtc)}
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
  shell: {
    maxWidth: 1700,
    margin: "0 auto",
    padding: 16,
    display: "grid",
    gap: 12,

    gridTemplateColumns: "300px 1.6fr 320px",
    gridTemplateRows: "auto auto 1fr",
  }, // ← THIS COMMA FIXES EVERYTHING

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
    gridTemplateColumns: "380px minmax(480px, 1fr) 360px",
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
    alignItems: "start",
    paddingRight: 6,
    paddingBottom: 20,
  },
  waveCard: {
    borderRadius: 20,
    border: `1px solid ${palette.border}`,
    background:
      "linear-gradient(180deg, rgba(14,20,32,0.98), rgba(9,13,23,0.98))",
    overflow: "visible",
    display: "grid",
    alignContent: "start",
    minHeight: 180,
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
    height: 360,
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
  if (resolvedToken) headers.Authorization = `Bearer ${resolvedToken}`;

  return fetch(`${API_BASE}${path}`, { ...options, headers }).then(
    async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    },
  );
}

export default function AppPreBeta() {
  const [events, setEvents] = useState([]);
  const [expandedWaves, setExpandedWaves] = useState({});
  const [selectedEvent, setSelectedEvent] = useState(null);

  const [activeTab, setActiveTab] = useState("dashboard");
  const [logMode, setLogMode] = useState("event");
  const [showInsights, setShowInsights] = useState(false);
  const [journalExpanded, setJournalExpanded] = useState(false);
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
    setToasts((prev) => [...prev, { id, message, type }]);

    const timer = window.setTimeout(() => {
      if (!isMountedRef.current) return;
      setToasts((prev) => prev.filter((t) => t.id !== id));
      delete toastTimersRef.current[id];
    }, 2600);

    toastTimersRef.current[id] = timer;
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
      setChartFailed(true);
    }, 7000);

    return () => {
      if (chartTimeoutRef.current) clearTimeout(chartTimeoutRef.current);
    };
  }, [selectedEvent?.pair, selectedEvent?.timeframe]);

  const waves = useMemo(() => groupWaves(events), [events]);
  const tickerItems = useMemo(() => bestTickerItems(events, 12), [events]);

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

  const chartInfo = getChartInfo(selectedEvent?.pair || "BTC/USDT");

  const chartSrc = `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(
    chartInfo.tvSymbol,
  )}&interval=${getTvInterval(selectedEvent?.timeframe || "15m")}&hidesidetoolbar=1&symboledit=1&saveimage=1&toolbarbg=0a0f18&theme=dark&style=1&withdateranges=1&hideideas=1&key=${chartReloadKey}`;

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
    const allowScreenshotUpload = true;
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
    if (chartTimeoutRef.current) {
      clearTimeout(chartTimeoutRef.current);
      chartTimeoutRef.current = null;
    }

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
        emaContext: decisionForm?.emaContext || selectedEvent?.emaContext || "",
        botConfidence: selectedEvent?.botConfidence ?? "",
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
        <div style={{ gridColumn: "1 / span 3" }}>
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
                <Pill tone={propStatus.tone}>{propStatus.status}</Pill>
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
              </div>
            </div>

            <div style={styles.statsRow}>
              <StatCard
                title="Radar Events"
                value={events.length}
                subtitle="Live in current session"
              />
              <StatCard
                title="Waves"
                value={waves.length}
                subtitle="Grouped by pair / TF / bias"
              />
              <StatCard
                title="Logged Trades"
                value={loggedDecisions.length}
                subtitle="Saved in this session"
              />
              <StatCard
                title="AI Remaining"
                value={aiRemaining ?? "—"}
                subtitle="Daily review allowance"
              />
            </div>
          </div>
        </div>

        <div style={{ gridColumn: "1 / span 3" }}>
          <SmartTicker
            items={tickerItems}
            onSelect={(evt) => setSelectedEvent(evt)}
          />
        </div>

        <div style={{ gridColumn: "1 / span 3", display: "contents" }}>
          {/* ===== LEFT: RADAR ===== */}
          <div style={{ gridColumn: "1", gridRow: "3" }}>
            <div style={styles.panel}>
              <div style={styles.panelHeader}>
                <div>
                  <div style={{ fontWeight: 900 }}>Radar Feed</div>
                  <div style={styles.subtext}>
                    Grouped by wave, most recent first.
                  </div>
                </div>
                <Pill>{waves.length} waves</Pill>
              </div>

              <div style={{ ...styles.panelBody, ...styles.radarList }}>
                {waves.map((wave) => {
                  const tone = directionTone(wave.directionBias);
                  const isExpanded = Boolean(expandedWaves[wave.key]);
                  const head = wave.events[0];

                  return (
                    <div
                      key={wave.key}
                      style={{
                        ...styles.waveCard,
                        borderColor: getToneBorder(tone),
                      }}
                    >
                      <div
                        onClick={() => selectWaveHead(wave)}
                        style={{
                          padding: 14,
                          display: "grid",
                          gap: 10,
                          cursor: "pointer",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 900 }}>{wave.pair}</div>
                            <div
                              style={{ fontSize: 12, color: palette.textSoft }}
                            >
                              {wave.sweepType} • {wave.eventType}
                            </div>
                          </div>

                          {wave.count > 1 && (
                            <button
                              style={styles.button}
                              type="button"
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
                          )}
                        </div>

                        <div style={styles.topCardRow}>
                          <MiniBox
                            label="Conf"
                            value={`${(wave.avgConfidence * 100).toFixed(0)}%`}
                          />
                          <MiniBox label="Entry" value={num(head?.entry)} />
                          <MiniBox label="TP1" value={num(head?.tp1)} />
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={styles.expandedList}>
                          {wave.events.map((evt) => (
                            <button
                              key={eventKey(evt)}
                              type="button"
                              onClick={() => setSelectedEvent(evt)}
                              style={cardButtonReset}
                            >
                              {evt.pair} {evt.timeframe}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ===== CENTER: CHART + JOURNAL ===== */}
          <div
            style={{ gridColumn: "2", gridRow: "3", display: "grid", gap: 12 }}
          >
            {/* CHART */}
            <div style={styles.panel}>
              <div style={styles.panelHeader}>
                <div>
                  <div style={{ fontWeight: 900 }}>Chart Center</div>
                  <div style={styles.subtext}>
                    {selectedEvent?.pair || "BTC/USDT"} •{" "}
                    {selectedEvent?.timeframe || "15m"}
                  </div>
                </div>

                <button
                  style={styles.button}
                  onClick={retryChart}
                  type="button"
                >
                  Reload
                </button>
              </div>

              <div style={styles.chartFrame}>
                {chartFailed ? (
                  <button
                    type="button"
                    onClick={retryChart}
                    style={styles.primaryButton}
                  >
                    Retry
                  </button>
                ) : (
                  <iframe
                    key={chartReloadKey}
                    src={chartSrc}
                    width="100%"
                    height="100%"
                    style={{ border: "none" }}
                    title="TradingView Chart"
                    onLoad={() => {
                      if (chartTimeoutRef.current) {
                        clearTimeout(chartTimeoutRef.current);
                        chartTimeoutRef.current = null;
                      }
                      setChartLoading(false);
                      setChartFailed(false);
                    }}
                  />
                )}
              </div>

              <div
                style={{
                  ...styles.panelBody,
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                }}
              >
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

            {/* JOURNAL */}
            <div style={styles.journalShell}>
              <div style={styles.journalHeader}>
                <div style={{ fontWeight: 900 }}>Behavior Engine Journal</div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    style={styles.button}
                    type="button"
                    onClick={() => setLogMode("manual")}
                  >
                    Manual
                  </button>
                  <button
                    style={styles.button}
                    type="button"
                    onClick={handleExportLogs}
                  >
                    Export
                  </button>
                </div>
              </div>

              <div style={{ padding: 12 }}>
                {/* your form stays EXACTLY as is */}
              </div>
            </div>
          </div>

          {/* ===== RIGHT: AI + DECISION ===== */}
          <div
            style={{ gridColumn: "3", gridRow: "3", display: "grid", gap: 12 }}
          >
            <AiReviewPanel
              entry={activeLogEntry}
              liveReview={aiReviewResult}
              loading={aiReviewLoading}
              locked={!featureFlags.aiReview}
            />

            <div style={styles.panel}>
              <div style={styles.panelHeader}>
                <div style={{ fontWeight: 900 }}>Decision Context</div>
              </div>

              <div style={styles.panelBody}>
                <MiniBox label="Pair" value={selectedEvent?.pair || "—"} />
                <MiniBox
                  label="Confidence"
                  value={`${((selectedEvent?.botConfidence || 0) * 100).toFixed(0)}%`}
                />
              </div>
            </div>
          </div>
        </div>

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
          {toasts.map((t) => {
            const tone =
              t.type === "warn"
                ? {
                    bg: "rgba(120,30,30,0.92)",
                    border: "rgba(251,113,133,0.24)",
                  }
                : t.type === "success"
                  ? {
                      bg: "rgba(17,60,32,0.92)",
                      border: "rgba(74,222,128,0.24)",
                    }
                  : { bg: "rgba(20,27,42,0.96)", border: palette.border };

            return (
              <div
                key={t.id}
                style={{
                  minWidth: 220,
                  maxWidth: 360,
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: `1px solid ${tone.border}`,
                  background: tone.bg,
                  color: palette.text,
                  boxShadow: "0 10px 24px rgba(0,0,0,0.28)",
                }}
              >
                {t.message}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
