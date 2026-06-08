import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const plans = [
  {
    key: "starter",
    name: "Starter",
    price: "$19",
    sub: "/mo",
    badge: "Basic",
    blurb: "Core radar and journaling for early traders.",
    features: [
      "Live radar",
      "Manual journal",
      "100 recent logs",
      "Monthly recap",
    ],
  },
  {
    key: "core",
    name: "Core",
    price: "$49",
    sub: "/mo",
    badge: "Popular",
    blurb: "More history, screenshots, and deeper recaps.",
    features: [
      "Everything in Starter",
      "Screenshot logging",
      "500 logs",
      "Weekly recap",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: "$99",
    sub: "/mo",
    badge: "Full Access",
    blurb: "AI review, exports, advanced stats, and premium trade feedback.",
    features: [
      "AI reviews",
      "Screenshot review",
      "Export logs",
      "Advanced stats",
    ],
  },
];

async function apiFetch(path, options = {}, token = "") {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || data.details || `HTTP ${res.status}`);
  }

  return data;
}

function isActiveStatus(status) {
  return ["active", "trialing"].includes(String(status || "").toLowerCase());
}

function fmtStatus(status) {
  if (!status) return "inactive";
  return String(status).replaceAll("_", " ");
}

export default function BillingPage({ token = "", compact = false }) {
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyPlan, setBusyPlan] = useState("");
  const [portalBusy, setPortalBusy] = useState(false);
  const [error, setError] = useState("");

  const active = isActiveStatus(billing?.stripeStatus);
  const currentPlan = billing?.billingPlan || "starter";

  useEffect(() => {
    let cancelled = false;

    async function loadBilling() {
      if (!token) {
        setLoading(false);
        setBilling(null);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const data = await apiFetch("/me", {}, token);
        if (!cancelled) setBilling(data.user || null);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load billing");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadBilling();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function startCheckout(plan) {
    try {
      setBusyPlan(plan);
      setError("");

      const data = await apiFetch(
        "/stripe/create-checkout-session",
        {
          method: "POST",
          body: JSON.stringify({ plan }),
        },
        token,
      );

      if (data?.url) window.location.href = data.url;
    } catch (err) {
      setError(err.message || "Checkout failed");
    } finally {
      setBusyPlan("");
    }
  }

  async function openPortal() {
    try {
      setPortalBusy(true);
      setError("");

      const data = await apiFetch(
        "/stripe/create-portal-session",
        { method: "POST" },
        token,
      );

      if (data?.url) window.location.href = data.url;
    } catch (err) {
      setError(err.message || "Portal failed");
    } finally {
      setPortalBusy(false);
    }
  }

  const featureCards = useMemo(
    () => [
      ["AI Review", billing?.featureFlags?.aiReview],
      ["Screenshot Review", billing?.featureFlags?.screenshotReview],
      ["Export Logs", billing?.featureFlags?.export],
      ["Advanced Stats", billing?.featureFlags?.deeperStats],
    ],
    [billing],
  );

  if (!token) {
    return (
      <div style={styles.page}>
        <div style={styles.shell}>
          <h1 style={styles.title}>Sign in required</h1>
          <p style={styles.muted}>Log in to manage your Liquidity Lab plan.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.glowA} />
      <div style={styles.glowB} />

      <div style={styles.shell}>
        <div style={styles.header}>
          <div>
            <div style={styles.kicker}>RED OCTOBER SYSTEMS</div>
            <h1 style={styles.title}>Liquidity Lab Billing</h1>
            <p style={styles.muted}>
              Manage plan access, AI tools, exports, and customer billing.
            </p>
          </div>

          <button
            style={styles.backButton}
            onClick={() => window.history.back()}
          >
            Dashboard
          </button>
        </div>

        {error ? <div style={styles.error}>{error}</div> : null}

        <div style={styles.statusGrid}>
          <div style={styles.statusCard}>
            <div style={styles.label}>Current Plan</div>
            <div style={styles.bigValue}>{currentPlan.toUpperCase()}</div>
            <div style={styles.smallText}>
              Stripe: {fmtStatus(billing?.stripeStatus)}
            </div>
          </div>

          <div style={styles.statusCard}>
            <div style={styles.label}>Access State</div>
            <div style={active ? styles.greenValue : styles.goldValue}>
              {active ? "ACTIVE" : "UNLOCKED"}
            </div>
            <div style={styles.smallText}>
              {active ? "Subscription verified" : "Manual/pro access enabled"}
            </div>
          </div>

          <div style={styles.statusCard}>
            <div style={styles.label}>Screenshots Left</div>
            <div style={styles.bigValue}>
              {billing?.screenshotRemaining ?? "—"}
            </div>
            <div style={styles.smallText}>Daily review limit</div>
          </div>

          <div style={styles.statusCard}>
            <div style={styles.label}>AI Reviews Left</div>
            <div style={styles.bigValue}>{billing?.aiRemaining ?? "—"}</div>
            <div style={styles.smallText}>OpenAI quota still required</div>
          </div>
        </div>

        <div style={styles.featureGrid}>
          {featureCards.map(([name, unlocked]) => (
            <div key={name} style={styles.featureCard}>
              <div style={styles.featureName}>{name}</div>
              <div style={unlocked ? styles.unlocked : styles.locked}>
                {unlocked ? "Unlocked" : "Locked"}
              </div>
            </div>
          ))}
        </div>

        <div style={styles.portalRow}>
          <button
            style={{
              ...styles.secondaryButton,
              opacity: portalBusy || !billing?.stripeCustomerId ? 0.55 : 1,
            }}
            disabled={portalBusy || !billing?.stripeCustomerId}
            onClick={openPortal}
          >
            {portalBusy ? "Opening Portal..." : "Manage Billing"}
          </button>

          <div style={styles.customerText}>
            Customer ID: {billing?.stripeCustomerId || "Not created yet"}
          </div>
        </div>

        <div style={styles.plansGrid}>
          {plans.map((plan) => {
            const isCurrent = currentPlan === plan.key;
            const isBusy = busyPlan === plan.key;

            return (
              <div
                key={plan.key}
                style={{
                  ...styles.planCard,
                  ...(isCurrent ? styles.currentPlanCard : {}),
                }}
              >
                <div style={styles.planTop}>
                  <div>
                    <div style={styles.planBadge}>{plan.badge}</div>
                    <h2 style={styles.planName}>{plan.name}</h2>
                    <p style={styles.planBlurb}>{plan.blurb}</p>
                  </div>

                  <div style={styles.priceWrap}>
                    <span style={styles.price}>{plan.price}</span>
                    <span style={styles.sub}>{plan.sub}</span>
                  </div>
                </div>

                <div style={styles.featuresList}>
                  {plan.features.map((feature) => (
                    <div key={feature} style={styles.planFeature}>
                      <span style={styles.dot}>●</span>
                      {feature}
                    </div>
                  ))}
                </div>

                <button
                  style={{
                    ...styles.primaryButton,
                    ...(isCurrent ? styles.currentButton : {}),
                  }}
                  disabled={isBusy || isCurrent}
                  onClick={() => startCheckout(plan.key)}
                >
                  {isCurrent
                    ? "Current Plan"
                    : isBusy
                      ? "Redirecting..."
                      : `Start ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>

        {!compact ? (
          <div style={styles.footerPanel}>
            <div style={styles.footerTitle}>Plan behavior</div>
            <div style={styles.footerGrid}>
              <div>
                <b>Starter</b>
                <p>Basic radar and manual journal for new users.</p>
              </div>
              <div>
                <b>Core</b>
                <p>More logs, screenshots, and weekly review tools.</p>
              </div>
              <div>
                <b>Pro</b>
                <p>AI reviews, exports, deeper stats, and premium feedback.</p>
              </div>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div style={styles.loading}>Loading billing status...</div>
        ) : null}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: 24,
    background:
      "radial-gradient(circle at top left, rgba(220,38,38,0.20), transparent 32%), radial-gradient(circle at bottom right, rgba(15,118,110,0.18), transparent 28%), #03050a",
    color: "#f8fafc",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    position: "relative",
    overflow: "hidden",
  },
  glowA: {
    position: "fixed",
    width: 420,
    height: 420,
    borderRadius: "50%",
    background: "rgba(239,68,68,0.12)",
    filter: "blur(60px)",
    top: -120,
    left: -120,
    pointerEvents: "none",
  },
  glowB: {
    position: "fixed",
    width: 360,
    height: 360,
    borderRadius: "50%",
    background: "rgba(34,197,94,0.10)",
    filter: "blur(70px)",
    right: -100,
    bottom: -100,
    pointerEvents: "none",
  },
  shell: {
    position: "relative",
    maxWidth: 1220,
    margin: "0 auto",
    border: "1px solid rgba(255,255,255,0.09)",
    background: "rgba(5,8,16,0.82)",
    borderRadius: 28,
    padding: 22,
    boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
    backdropFilter: "blur(14px)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "flex-start",
    paddingBottom: 18,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  kicker: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 4,
    color: "rgba(255,255,255,0.42)",
  },
  title: {
    margin: "8px 0 0",
    fontSize: 34,
    lineHeight: 1,
    fontWeight: 1000,
    letterSpacing: -1,
  },
  muted: {
    margin: "8px 0 0",
    color: "rgba(255,255,255,0.62)",
    fontSize: 14,
  },
  backButton: {
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "linear-gradient(180deg, rgba(30,41,59,0.90), rgba(15,23,42,0.90))",
    color: "#fff",
    borderRadius: 14,
    padding: "11px 16px",
    fontWeight: 900,
    cursor: "pointer",
  },
  error: {
    marginTop: 16,
    border: "1px solid rgba(248,113,113,0.30)",
    background: "rgba(127,29,29,0.25)",
    color: "#fecaca",
    borderRadius: 16,
    padding: 14,
    fontWeight: 800,
  },
  statusGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginTop: 18,
  },
  statusCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.86), rgba(2,6,23,0.78))",
    borderRadius: 20,
    padding: 16,
    minHeight: 110,
  },
  label: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.42)",
  },
  bigValue: {
    marginTop: 10,
    fontSize: 23,
    fontWeight: 1000,
  },
  greenValue: {
    marginTop: 10,
    fontSize: 23,
    fontWeight: 1000,
    color: "#4ade80",
  },
  goldValue: {
    marginTop: 10,
    fontSize: 23,
    fontWeight: 1000,
    color: "#facc15",
  },
  smallText: {
    marginTop: 8,
    fontSize: 12,
    color: "rgba(255,255,255,0.50)",
    fontWeight: 700,
  },
  featureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginTop: 12,
  },
  featureCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.035)",
    borderRadius: 18,
    padding: 14,
  },
  featureName: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.45)",
    fontWeight: 900,
  },
  unlocked: {
    marginTop: 8,
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: 1000,
  },
  locked: {
    marginTop: 8,
    color: "#fb7185",
    fontSize: 18,
    fontWeight: 1000,
  },
  portalRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 16,
    padding: 14,
    borderRadius: 18,
    background: "rgba(255,255,255,0.035)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  secondaryButton: {
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(15,23,42,0.9)",
    color: "#fff",
    borderRadius: 14,
    padding: "11px 16px",
    fontWeight: 1000,
    cursor: "pointer",
  },
  customerText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    fontWeight: 800,
  },
  plansGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 14,
    marginTop: 18,
  },
  planCard: {
    border: "1px solid rgba(255,255,255,0.09)",
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.90), rgba(3,7,18,0.88))",
    borderRadius: 24,
    padding: 18,
    boxShadow: "0 14px 38px rgba(0,0,0,0.38)",
  },
  currentPlanCard: {
    border: "1px solid rgba(248,113,113,0.42)",
    boxShadow:
      "0 0 0 1px rgba(248,113,113,0.12), 0 18px 50px rgba(127,29,29,0.25)",
  },
  planTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
  },
  planBadge: {
    display: "inline-block",
    border: "1px solid rgba(248,113,113,0.30)",
    background: "rgba(127,29,29,0.28)",
    color: "#fecaca",
    borderRadius: 999,
    padding: "4px 9px",
    fontSize: 10,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  planName: {
    margin: "12px 0 0",
    fontSize: 25,
    fontWeight: 1000,
  },
  planBlurb: {
    margin: "8px 0 0",
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    lineHeight: 1.45,
  },
  priceWrap: {
    whiteSpace: "nowrap",
    textAlign: "right",
  },
  price: {
    fontSize: 32,
    fontWeight: 1000,
  },
  sub: {
    color: "rgba(255,255,255,0.45)",
    fontWeight: 800,
    marginLeft: 2,
  },
  featuresList: {
    display: "grid",
    gap: 8,
    marginTop: 18,
  },
  planFeature: {
    border: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(0,0,0,0.22)",
    borderRadius: 14,
    padding: "10px 11px",
    fontSize: 13,
    fontWeight: 800,
    color: "rgba(255,255,255,0.78)",
  },
  dot: {
    color: "#fb7185",
    marginRight: 8,
    fontSize: 9,
  },
  primaryButton: {
    width: "100%",
    marginTop: 18,
    border: "1px solid rgba(248,113,113,0.45)",
    background: "linear-gradient(180deg, #ef4444, #991b1b)",
    color: "#fff",
    borderRadius: 16,
    padding: "13px 15px",
    fontWeight: 1000,
    cursor: "pointer",
    boxShadow: "0 12px 30px rgba(220,38,38,0.25)",
  },
  currentButton: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "rgba(255,255,255,0.7)",
    boxShadow: "none",
    cursor: "not-allowed",
  },
  footerPanel: {
    marginTop: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.035)",
    borderRadius: 22,
    padding: 17,
  },
  footerTitle: {
    fontSize: 11,
    letterSpacing: 1.6,
    color: "rgba(255,255,255,0.45)",
    textTransform: "uppercase",
    fontWeight: 1000,
  },
  footerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    marginTop: 12,
    color: "rgba(255,255,255,0.62)",
    fontSize: 13,
    lineHeight: 1.45,
  },
  loading: {
    marginTop: 14,
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    fontWeight: 800,
  },
};
