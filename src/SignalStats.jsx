import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL || "http://localhost:5000";

function winRateColor(rate) {
  if (rate == null) return "rgba(255,255,255,0.4)";
  if (rate >= 60) return "#4ade80";
  if (rate >= 45) return "#f6c453";
  return "#fb7185";
}

function avgRColor(avgR) {
  if (avgR == null) return "rgba(255,255,255,0.4)";
  if (avgR > 0) return "#4ade80";
  if (avgR < 0) return "#fb7185";
  return "#f6c453";
}

const CONFIDENCE_ORDER = ["90-100%", "80-89%", "70-79%", "60-69%", "50-59%", "Below 50%"];

function BreakdownTable({ title, data, minSample = 5, order }) {
  const entries = Object.entries(data || {});
  const rows = order
    ? order.filter((k) => data?.[k]).map((k) => [k, data[k]])
    : entries.sort((a, b) => (b[1].winRate ?? -1) - (a[1].winRate ?? -1));

  return (
    <div style={s.card}>
      <div style={s.cardTitle}>{title}</div>
      {rows.length === 0 ? (
        <div style={s.empty}>No resolved signals yet.</div>
      ) : (
        <div style={s.table}>
          <div style={{ ...s.row, ...s.rowHeader }}>
            <div style={s.colName}>Name</div>
            <div style={s.colNum}>Total</div>
            <div style={s.colNum}>Wins</div>
            <div style={s.colNum}>Stopped</div>
            <div style={s.colNum}>Win rate</div>
            <div style={s.colNum}>Avg R</div>
          </div>
          {rows.map(([name, stat]) => (
            <div key={name} style={s.row}>
              <div style={s.colName}>{name}</div>
              <div style={s.colNum}>{stat.total}</div>
              <div style={s.colNum}>{stat.wins}</div>
              <div style={s.colNum}>{stat.stopped}</div>
              <div style={{ ...s.colNum, fontWeight: 900, color: winRateColor(stat.winRate) }}>
                {stat.winRate == null ? "—" : `${stat.winRate}%`}
                {stat.total < minSample && (
                  <span style={s.lowSample} title={`Only ${stat.total} sample(s) — not statistically reliable yet`}>
                    low n
                  </span>
                )}
              </div>
              <div style={{ ...s.colNum, fontWeight: 900, color: avgRColor(stat.avgR) }}>
                {stat.avgR == null ? "—" : `${stat.avgR > 0 ? "+" : ""}${stat.avgR}R`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SignalStats({ onBack }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewShadow, setViewShadow] = useState(false);

  async function load(shadow) {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API_BASE}/sweep/stats?shadow=${shadow ? "true" : "false"}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setStats(data);
    } catch (err) {
      setError(err.message || "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(viewShadow);
  }, [viewShadow]);

  const overall = stats?.overall;

  return (
    <div style={s.page}>
      <div style={s.shell}>
        <div style={s.header}>
          <div>
            <div style={s.kicker}>RED OCTOBER SYSTEMS</div>
            <h1 style={s.title}>Signal Quality</h1>
            <p style={s.muted}>
              Every alert, tracked forward. Win rate is TP1 or TP2 hit before stop,
              among resolved signals only (expired/still-pending excluded).
            </p>
            {stats?.filter?.since && (
              <p style={{ ...s.muted, fontSize: 11, marginTop: 4 }}>
                Since {new Date(stats.filter.since).toLocaleString()} (today's config changes — earlier data blends multiple bot versions)
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              style={{ ...s.secondaryButton, ...(viewShadow ? s.secondaryButtonActive : {}) }}
              onClick={() => setViewShadow((v) => !v)}
            >
              {viewShadow ? "👁 Viewing shadow (suppressed)" : "Show shadow signals"}
            </button>
            <button style={s.secondaryButton} onClick={() => load(viewShadow)} disabled={loading}>
              {loading ? "Refreshing…" : "🔄 Refresh"}
            </button>
            {onBack && (
              <button style={s.secondaryButton} onClick={onBack}>← Dashboard</button>
            )}
          </div>
        </div>

        {viewShadow && (
          <div style={s.shadowBanner}>
            Shadow mode: signals that got suppressed (below the confidence floor, or
            a disabled event type) but were still tracked for outcome. Never shown
            to users — this is purely to prove the filter is earning its keep.
          </div>
        )}

        {error && <div style={s.errorBox}>{error}</div>}

        <div style={s.statusGrid}>
          <div style={s.statusCard}>
            <div style={s.label}>Total resolved</div>
            <div style={s.bigValue}>{overall?.total ?? "—"}</div>
            <div style={s.smallText}>Excludes pending signals</div>
          </div>
          <div style={s.statusCard}>
            <div style={s.label}>Win rate</div>
            <div style={{ ...s.bigValue, color: winRateColor(overall?.winRate) }}>
              {overall?.winRate == null ? "—" : `${overall.winRate}%`}
            </div>
            <div style={s.smallText}>TP1 or TP2 hit first</div>
          </div>
          <div style={s.statusCard}>
            <div style={s.label}>Wins</div>
            <div style={{ ...s.bigValue, color: "#4ade80" }}>{overall?.wins ?? "—"}</div>
            <div style={s.smallText}>TP1_HIT + TP2_HIT</div>
          </div>
          <div style={s.statusCard}>
            <div style={s.label}>Stopped</div>
            <div style={{ ...s.bigValue, color: "#fb7185" }}>{overall?.stopped ?? "—"}</div>
            <div style={s.smallText}>Stop hit before any target</div>
          </div>
          <div style={s.statusCard}>
            <div style={s.label}>Expired</div>
            <div style={s.bigValue}>{overall?.expired ?? "—"}</div>
            <div style={s.smallText}>No resolution within 8h</div>
          </div>
          <div style={s.statusCard}>
            <div style={s.label}>Avg R (expectancy)</div>
            <div style={{ ...s.bigValue, color: avgRColor(overall?.avgR) }}>
              {overall?.avgR == null ? "—" : `${overall.avgR > 0 ? "+" : ""}${overall.avgR}R`}
            </div>
            <div style={s.smallText}>Per signal, wins + stops</div>
          </div>
        </div>

        <div style={s.breakdownGrid}>
          <BreakdownTable title="By event type" data={stats?.byEventType} />
          <BreakdownTable title="By pattern" data={stats?.byPattern} />
          <BreakdownTable title="By pair" data={stats?.byPair} />
          <BreakdownTable
            title="By confidence score"
            data={stats?.byConfidence}
            order={CONFIDENCE_ORDER}
          />
        </div>

        {loading && !stats && <div style={s.loading}>Loading signal stats…</div>}
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", padding: 24, background: "#03060b", color: "#f4f7fb", fontFamily: "Arial, sans-serif" },
  shell: { maxWidth: 1100, margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 },
  kicker: { fontSize: 11, fontWeight: 900, letterSpacing: 2, color: "#ef4444", marginBottom: 6 },
  title: { fontSize: 28, fontWeight: 900, margin: "0 0 8px" },
  muted: { fontSize: 13, color: "rgba(244,247,251,0.6)", maxWidth: 560, lineHeight: 1.5, margin: 0 },
  secondaryButton: { border: "1px solid rgba(255,255,255,0.14)", background: "rgba(15,23,42,0.9)", color: "#fff", borderRadius: 12, padding: "9px 14px", fontWeight: 800, cursor: "pointer", fontSize: 13, height: 38 },
  secondaryButtonActive: { border: "1px solid rgba(246,196,83,0.4)", background: "rgba(246,196,83,0.1)", color: "#f6c453" },
  shadowBanner: { background: "rgba(246,196,83,0.08)", border: "1px solid rgba(246,196,83,0.25)", borderRadius: 12, padding: 12, marginBottom: 16, fontSize: 12, color: "#f6c453", lineHeight: 1.5 },
  errorBox: { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: 12, marginBottom: 16, fontSize: 13, color: "#fca5a5" },

  statusGrid: { display: "grid", gridTemplateColumns: "repeat(6,minmax(0,1fr))", gap: 12, marginBottom: 24 },
  statusCard: { border: "1px solid rgba(255,255,255,0.08)", background: "linear-gradient(180deg,rgba(15,23,42,0.86),rgba(2,6,23,0.78))", borderRadius: 20, padding: 16, minHeight: 100 },
  label: { fontSize: 10, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase", color: "rgba(255,255,255,0.42)" },
  bigValue: { marginTop: 10, fontSize: 22, fontWeight: 900 },
  smallText: { marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.46)", fontWeight: 700 },

  breakdownGrid: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 16 },
  card: { border: "1px solid rgba(255,255,255,0.09)", background: "linear-gradient(180deg,rgba(15,23,42,0.90),rgba(3,7,18,0.88))", borderRadius: 20, padding: 18 },
  cardTitle: { fontSize: 14, fontWeight: 900, marginBottom: 14 },
  empty: { fontSize: 12, color: "rgba(255,255,255,0.4)" },
  table: { display: "grid", gap: 2 },
  row: { display: "grid", gridTemplateColumns: "1.4fr 0.6fr 0.6fr 0.7fr 0.9fr 0.8fr", gap: 6, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", alignItems: "center" },
  rowHeader: { fontSize: 10, fontWeight: 900, letterSpacing: 0.6, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", borderBottom: "1px solid rgba(255,255,255,0.1)" },
  colName: { fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  colNum: { fontSize: 12, textAlign: "right" },
  lowSample: { marginLeft: 6, fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 999, padding: "1px 5px", textTransform: "uppercase" },
  loading: { textAlign: "center", padding: 40, color: "rgba(255,255,255,0.5)" },
};
