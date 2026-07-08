import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL || "http://localhost:5000";

const plans = [
  {
    key: "starter",
    name: "Starter",
    price: "Free",
    sub: "",
    badge: "Free",
    blurb: "Core radar and journaling for early traders.",
    features: [
      "Live radar feed",
      "Manual journal",
      "50 log entries",
      "No AI reviews",
      "Members Vault locked",
    ],
    highlight: false,
  },
  {
    key: "core",
    name: "Core",
    price: "$29",
    sub: "/mo",
    badge: "Popular",
    blurb: "AI reviews, Members Vault, and screenshot logging.",
    features: [
      "Everything in Starter",
      "15 AI reviews / day",
      "Screenshot uploads",
      "Members Vault access",
      "Pattern Library",
      "Psychology Vault",
      "500 log entries",
    ],
    highlight: false,
  },
  {
    key: "pro",
    name: "Pro",
    price: "$59",
    sub: "/mo",
    badge: "Full Access",
    blurb: "Unlimited AI, Trader DNA™, and advanced analytics.",
    features: [
      "Everything in Core",
      "Unlimited AI reviews",
      "🧬 Trader DNA™ (Claude-powered)",
      "Advanced Analytics",
      "Playbook Builder",
      "Hall of Fame / Shame",
      "Prop Firm Vault",
      "AI coaching chat",
      "Export logs",
      "Priority support",
    ],
    highlight: true,
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
  if (!res.ok) throw new Error(data.error || data.details || `HTTP ${res.status}`);
  return data;
}

function isActiveStatus(status) {
  return ["active", "trialing", "beta", "pro"].includes(String(status || "").toLowerCase());
}

function fmtStatus(status) {
  if (!status) return "inactive";
  return String(status).replaceAll("_", " ");
}

export default function BillingPage({ token = "", compact = false, onBack, onSignIn }) {
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyPlan, setBusyPlan] = useState("");
  const [portalBusy, setPortalBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoStatus, setPromoStatus] = useState("idle"); // idle | checking | valid | invalid
  const [promoLabel, setPromoLabel] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);

  const active = isActiveStatus(billing?.stripeStatus);
  const currentPlan = billing?.billingPlan || "starter";

  useEffect(() => {
    let cancelled = false;
    async function loadBilling() {
      if (!token) { setLoading(false); setBilling(null); return; }
      try {
        setLoading(true); setError("");
        const data = await apiFetch("/me", {}, token);
        if (!cancelled) setBilling(data.user || null);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load billing");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadBilling();
    return () => { cancelled = true; };
  }, [token]);

  // Check for Stripe redirect success/cancel
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success")) {
      setSuccess("Payment successful! Your plan has been upgraded.");
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("canceled")) {
      setError("Checkout canceled — no changes made.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function startCheckout(plan) {
    try {
      setBusyPlan(plan); setError("");
      const body = { plan };
      if (plan === "pro" && promoStatus === "valid" && promoCode) {
        body.promoCode = promoCode;
      }
      const data = await apiFetch("/stripe/create-checkout-session", { method:"POST", body:JSON.stringify(body) }, token);
      if (data?.portalUrl) { window.location.href = data.portalUrl; return; }
      if (data?.url) window.location.href = data.url;
    } catch (err) {
      // If already subscribed, might return portalUrl in error body
      setError(err.message || "Checkout failed");
    } finally {
      setBusyPlan("");
    }
  }

  async function applyPromoCode() {
    if (!promoCode.trim()) return;
    try {
      setPromoBusy(true); setPromoStatus("idle");
      const data = await apiFetch("/promo/validate", { method:"POST", body:JSON.stringify({ code: promoCode.trim() }) }, token);
      if (data?.valid) {
        setPromoStatus("valid");
        setPromoLabel(data.label || "Promo applied");
      } else {
        setPromoStatus("invalid");
      }
    } catch {
      setPromoStatus("invalid");
    } finally {
      setPromoBusy(false);
    }
  }

  async function openPortal() {
    try {
      setPortalBusy(true); setError("");
      const data = await apiFetch("/stripe/create-portal-session", { method:"POST" }, token);
      if (data?.url) window.location.href = data.url;
    } catch (err) {
      setError(err.message || "Portal failed");
    } finally {
      setPortalBusy(false);
    }
  }

  async function syncStripe() {
    try {
      setSyncBusy(true); setError("");
      const data = await apiFetch("/stripe/sync", { method:"POST" }, token);
      setSuccess(`Synced — Plan: ${data.billingPlan}, Status: ${data.stripeStatus}`);
      // Reload billing data
      const me = await apiFetch("/me", {}, token);
      setBilling(me.user || null);
    } catch (err) {
      setError(err.message || "Sync failed");
    } finally {
      setSyncBusy(false);
    }
  }

  const featureCards = useMemo(() => [
    ["AI Review", billing?.featureFlags?.aiReview],
    ["Screenshot Review", billing?.featureFlags?.screenshotReview],
    ["Export Logs", billing?.featureFlags?.export],
    ["Advanced Stats", billing?.featureFlags?.deeperStats],
  ], [billing]);

  if (!token) {
    return (
      <div style={s.page}>
        <div style={s.glowA} />
        <div style={s.glowB} />
        <div style={s.shell}>
          <div style={s.header}>
            <div>
              <div style={s.kicker}>RED OCTOBER SYSTEMS</div>
              <h1 style={s.title}>Liquidity Lab</h1>
              <p style={s.muted}>Live liquidity radar, an AI-powered trade journal, and coaching that learns your patterns — not just another signals feed.</p>
            </div>
          </div>

          <div style={s.pillarGrid}>
            <div style={s.pillarCard}>
              <div style={s.pillarIcon}>📡</div>
              <div style={s.pillarTitle}>Live radar</div>
              <div style={s.pillarText}>Sweep, reclaim, and confirmation alerts across 45+ pairs, scored in real time.</div>
            </div>
            <div style={s.pillarCard}>
              <div style={s.pillarIcon}>🤖</div>
              <div style={s.pillarTitle}>AI trade journal</div>
              <div style={s.pillarText}>Log a trade and get an instant AI review — what was good, what to fix, graded.</div>
            </div>
            <div style={s.pillarCard}>
              <div style={s.pillarIcon}>🧬</div>
              <div style={s.pillarTitle}>Trader DNA™ coaching</div>
              <div style={s.pillarText}>Claude builds a running profile of your habits from every logged trade and coaches you on it.</div>
            </div>
          </div>

          <div style={s.plansGrid}>
            {plans.map(plan => (
              <div key={plan.key} style={{ ...s.planCard, ...(plan.highlight ? s.highlightCard : {}) }}>
                {plan.highlight && (
                  <div style={s.popularBadgeWrap}>
                    <span style={s.popularBadge}>⭐ Most Popular</span>
                  </div>
                )}
                <div style={s.planTop}>
                  <div>
                    <div style={s.planBadge}>{plan.badge}</div>
                    <h2 style={s.planName}>{plan.name}</h2>
                    <p style={s.planBlurb}>{plan.blurb}</p>
                  </div>
                  <div style={s.priceWrap}>
                    <span style={s.price}>{plan.price}</span>
                    {plan.sub && <span style={s.sub}>{plan.sub}</span>}
                  </div>
                </div>
                <div style={s.featuresList}>
                  {plan.features.map(feature => (
                    <div key={feature} style={s.planFeature}>
                      <span style={{ color: feature.includes("🧬") ? "#f6c453" : "#fb7185", marginRight:8, fontSize:9 }}>●</span>
                      {feature}
                    </div>
                  ))}
                </div>
                <button
                  style={{ ...s.primaryButton, ...(plan.highlight ? s.highlightButton : {}) }}
                  onClick={onSignIn || onBack}
                >
                  {plan.key === "starter" ? "Create Free Account" : `Sign Up for ${plan.name}`}
                </button>
              </div>
            ))}
          </div>

          {!compact && (
            <div style={s.footerPanel}>
              <div style={s.footerTitle}>How plans work</div>
              <div style={s.footerGrid}>
                <div><b>Starter</b><p>Free forever. Live radar + manual journal. No AI, no vault.</p></div>
                <div><b>Core $29</b><p>AI reviews, Members Vault (Pattern Library + Psychology), screenshot logging.</p></div>
                <div><b>Pro $59</b><p>Everything in Core plus unlimited AI, Trader DNA™, Analytics, and all future vault features.</p></div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.glowA} />
      <div style={s.glowB} />

      <div style={s.shell}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <div style={s.kicker}>RED OCTOBER SYSTEMS</div>
            <h1 style={s.title}>Liquidity Lab Billing</h1>
            <p style={s.muted}>Manage your plan, AI tools, and subscription.</p>
          </div>
          <button style={s.backButton} onClick={onBack || (() => window.history.back())}>
            ← Dashboard
          </button>
        </div>

        {error && <div style={s.errorBox}>{error}</div>}
        {success && <div style={s.successBox}>{success}</div>}

        {/* Status cards */}
        <div style={s.statusGrid}>
          <div style={s.statusCard}>
            <div style={s.label}>Current Plan</div>
            <div style={s.bigValue}>
              {currentPlan.toUpperCase()}
              {billing?.founderMember ? " 🏆" : ""}
            </div>
            {billing?.founderMember && (
              <div style={{ ...s.smallText, color: "#f6c453" }}>Founding Member</div>
            )}
            <div style={s.smallText}>Stripe: {fmtStatus(billing?.stripeStatus)}</div>
          </div>
          <div style={s.statusCard}>
            <div style={s.label}>Access State</div>
            <div style={active ? s.greenValue : s.goldValue}>{active ? "ACTIVE" : "UNLOCKED"}</div>
            <div style={s.smallText}>{active ? "Subscription verified" : "Beta / manual access"}</div>
          </div>
          <div style={s.statusCard}>
            <div style={s.label}>AI Reviews Left</div>
            <div style={s.bigValue}>{billing?.aiRemaining ?? "—"}</div>
            <div style={s.smallText}>Resets daily · Claude-powered</div>
          </div>
          <div style={s.statusCard}>
            <div style={s.label}>Screenshots Left</div>
            <div style={s.bigValue}>{billing?.screenshotRemaining ?? "—"}</div>
            <div style={s.smallText}>Daily review limit</div>
          </div>
        </div>

        {/* Feature flags */}
        <div style={s.featureGrid}>
          {featureCards.map(([name, unlocked]) => (
            <div key={name} style={s.featureCard}>
              <div style={s.featureName}>{name}</div>
              <div style={unlocked ? s.unlocked : s.locked}>{unlocked ? "✓ Unlocked" : "✗ Locked"}</div>
            </div>
          ))}
        </div>

        {/* Portal + Sync row */}
        <div style={s.portalRow}>
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <button style={{ ...s.secondaryButton, opacity: portalBusy || !billing?.stripeCustomerId ? 0.55 : 1 }}
              disabled={portalBusy || !billing?.stripeCustomerId} onClick={openPortal}>
              {portalBusy ? "Opening…" : "Manage Billing"}
            </button>
            <button style={{ ...s.secondaryButton, opacity: syncBusy ? 0.55 : 1 }}
              disabled={syncBusy} onClick={syncStripe}>
              {syncBusy ? "Syncing…" : "🔄 Sync Stripe"}
            </button>
          </div>
          <div style={s.customerText}>
            Customer ID: {billing?.stripeCustomerId || "Not created yet"} · Email: {billing?.email || "—"}
          </div>
        </div>

        {/* Plan cards */}
        <div style={s.plansGrid}>
          {plans.map(plan => {
            const isCurrent = currentPlan === plan.key;
            const isBusy = busyPlan === plan.key;
            const founderApplied = plan.key === "pro" && promoStatus === "valid";
            return (
              <div key={plan.key} style={{ ...s.planCard, ...(plan.highlight ? s.highlightCard : {}), ...(isCurrent ? s.currentPlanCard : {}) }}>
                {plan.highlight && (
                  <div style={s.popularBadgeWrap}>
                    <span style={s.popularBadge}>⭐ Most Popular</span>
                  </div>
                )}
                {founderApplied && (
                  <div style={s.popularBadgeWrap}>
                    <span style={{ ...s.popularBadge, background:"#f6c453", color:"#1a1200" }}>🏆 Founder rate applied</span>
                  </div>
                )}
                <div style={s.planTop}>
                  <div>
                    <div style={s.planBadge}>{plan.badge}</div>
                    <h2 style={s.planName}>{plan.name}</h2>
                    <p style={s.planBlurb}>{plan.blurb}</p>
                  </div>
                  <div style={s.priceWrap}>
                    <span style={s.price}>{founderApplied ? "$40.83" : plan.price}</span>
                    {plan.sub && <span style={s.sub}>{founderApplied ? "/mo for life" : plan.sub}</span>}
                  </div>
                </div>
                <div style={s.featuresList}>
                  {plan.features.map(feature => (
                    <div key={feature} style={s.planFeature}>
                      <span style={{ color: feature.includes("🧬") ? "#f6c453" : "#fb7185", marginRight:8, fontSize:9 }}>●</span>
                      {feature}
                    </div>
                  ))}
                </div>
                {plan.key === "starter" ? (
                  <div style={{ ...s.primaryButton, textAlign:"center", opacity:0.5, cursor:"default", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", boxShadow:"none" }}>
                    Free — No card required
                  </div>
                ) : (
                  <button style={{ ...s.primaryButton, ...(isCurrent ? s.currentButton : {}), ...(plan.highlight && !isCurrent ? s.highlightButton : {}), ...(founderApplied ? { background:"linear-gradient(135deg,#f6c453,#c9922f)", boxShadow:"0 10px 24px rgba(246,196,83,0.3)" } : {}) }}
                    disabled={isBusy || isCurrent} onClick={() => startCheckout(plan.key)}>
                    {isCurrent ? "✓ Current Plan" : isBusy ? "Redirecting…" : founderApplied ? "Start Founder Pro →" : `Start ${plan.name}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Annual upsell */}
        <div style={s.annualBanner}>
          <div>
            <div style={{ fontWeight:900, fontSize:15, marginBottom:4 }}>💰 Save with Annual Pro</div>
            <div style={{ color:"rgba(255,255,255,0.6)", fontSize:13 }}>$490/year — saves $218 vs monthly. Lock in your rate.</div>
          </div>
          <button style={{ ...s.secondaryButton, borderColor:"rgba(246,196,83,0.4)", color:"#f6c453" }}
            onClick={() => startCheckout("pro_yearly")}>
            Get Annual Pro →
          </button>
        </div>

        {!billing?.founderMember && (
          <div style={s.annualBanner}>
            <div>
              <div style={{ fontWeight:900, fontSize:15, marginBottom:4 }}>🏆 Have a Founder code?</div>
              <div style={{ color: promoStatus === "valid" ? "#f6c453" : "rgba(255,255,255,0.6)", fontSize:13 }}>
                {promoStatus === "valid"
                  ? `${promoLabel} — click "Start Founder Pro" on the Pro card above.`
                  : "Direct-invite customers get Pro at the annual rate, billed monthly, for life."}
              </div>
              {promoStatus === "invalid" && (
                <div style={{ color:"#f87171", fontSize:12, marginTop:4 }}>Invalid code</div>
              )}
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <input
                value={promoCode}
                onChange={e => { setPromoCode(e.target.value); setPromoStatus("idle"); }}
                onKeyDown={e => { if (e.key === "Enter") applyPromoCode(); }}
                placeholder="Promo code"
                disabled={promoStatus === "valid"}
                style={s.promoInput}
              />
              <button style={{ ...s.secondaryButton, opacity: promoBusy || promoStatus === "valid" ? 0.55 : 1 }}
                disabled={promoBusy || promoStatus === "valid"} onClick={applyPromoCode}>
                {promoBusy ? "Checking…" : promoStatus === "valid" ? "Applied ✓" : "Apply"}
              </button>
            </div>
          </div>
        )}

        {!compact && (
          <div style={s.footerPanel}>
            <div style={s.footerTitle}>How plans work</div>
            <div style={s.footerGrid}>
              <div><b>Starter</b><p>Free forever. Live radar + manual journal. No AI, no vault.</p></div>
              <div><b>Core $29</b><p>AI reviews, Members Vault (Pattern Library + Psychology), screenshot logging.</p></div>
              <div><b>Pro $59</b><p>Everything in Core plus unlimited AI, Trader DNA™, Analytics, and all future vault features.</p></div>
            </div>
          </div>
        )}

        {loading && <div style={s.loading}>Loading billing status…</div>}
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight:"100vh", padding:24,
    background:"radial-gradient(circle at top left, rgba(220,38,38,0.20), transparent 32%), radial-gradient(circle at bottom right, rgba(15,118,110,0.18), transparent 28%), #03050a",
    color:"#f8fafc",
    fontFamily:'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    position:"relative", overflow:"hidden",
  },
  glowA: { position:"fixed", width:420, height:420, borderRadius:"50%", background:"rgba(239,68,68,0.12)", filter:"blur(60px)", top:-120, left:-120, pointerEvents:"none" },
  glowB: { position:"fixed", width:360, height:360, borderRadius:"50%", background:"rgba(34,197,94,0.10)", filter:"blur(70px)", right:-100, bottom:-100, pointerEvents:"none" },
  shell: { position:"relative", maxWidth:1220, margin:"0 auto", border:"1px solid rgba(255,255,255,0.09)", background:"rgba(5,8,16,0.82)", borderRadius:28, padding:22, boxShadow:"0 24px 80px rgba(0,0,0,0.55)", backdropFilter:"blur(14px)" },
  header: { display:"flex", justifyContent:"space-between", gap:18, alignItems:"flex-start", paddingBottom:18, borderBottom:"1px solid rgba(255,255,255,0.08)" },
  kicker: { fontSize:11, fontWeight:900, letterSpacing:4, color:"rgba(255,255,255,0.42)" },
  title: { margin:"8px 0 0", fontSize:32, lineHeight:1, fontWeight:900, letterSpacing:-1 },
  muted: { margin:"8px 0 0", color:"rgba(255,255,255,0.62)", fontSize:14 },
  backButton: { border:"1px solid rgba(255,255,255,0.10)", background:"linear-gradient(180deg,rgba(30,41,59,0.90),rgba(15,23,42,0.90))", color:"#fff", borderRadius:14, padding:"11px 16px", fontWeight:900, cursor:"pointer", whiteSpace:"nowrap" },
  errorBox: { marginTop:16, border:"1px solid rgba(248,113,113,0.30)", background:"rgba(127,29,29,0.25)", color:"#fecaca", borderRadius:16, padding:14, fontWeight:800 },
  successBox: { marginTop:16, border:"1px solid rgba(74,222,128,0.30)", background:"rgba(20,70,38,0.25)", color:"#bbf7d0", borderRadius:16, padding:14, fontWeight:800 },
  statusGrid: { display:"grid", gridTemplateColumns:"repeat(4,minmax(0,1fr))", gap:12, marginTop:18 },
  pillarGrid: { display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", gap:14, marginTop:22 },
  pillarCard: { border:"1px solid rgba(255,255,255,0.09)", background:"linear-gradient(180deg,rgba(15,23,42,0.90),rgba(3,7,18,0.88))", borderRadius:20, padding:20 },
  pillarIcon: { fontSize:26, marginBottom:10 },
  pillarTitle: { fontSize:16, fontWeight:900, marginBottom:6 },
  pillarText: { fontSize:13, color:"rgba(255,255,255,0.6)", lineHeight:1.5 },
  statusCard: { border:"1px solid rgba(255,255,255,0.08)", background:"linear-gradient(180deg,rgba(15,23,42,0.86),rgba(2,6,23,0.78))", borderRadius:20, padding:16, minHeight:110 },
  label: { fontSize:10, fontWeight:900, letterSpacing:1.4, textTransform:"uppercase", color:"rgba(255,255,255,0.42)" },
  bigValue: { marginTop:10, fontSize:23, fontWeight:900 },
  greenValue: { marginTop:10, fontSize:23, fontWeight:900, color:"#4ade80" },
  goldValue: { marginTop:10, fontSize:23, fontWeight:900, color:"#facc15" },
  smallText: { marginTop:8, fontSize:12, color:"rgba(255,255,255,0.50)", fontWeight:700 },
  featureGrid: { display:"grid", gridTemplateColumns:"repeat(4,minmax(0,1fr))", gap:12, marginTop:12 },
  featureCard: { border:"1px solid rgba(255,255,255,0.08)", background:"rgba(255,255,255,0.035)", borderRadius:18, padding:14 },
  featureName: { fontSize:11, textTransform:"uppercase", letterSpacing:1.2, color:"rgba(255,255,255,0.45)", fontWeight:900 },
  unlocked: { marginTop:8, color:"#4ade80", fontSize:16, fontWeight:900 },
  locked: { marginTop:8, color:"#fb7185", fontSize:16, fontWeight:900 },
  portalRow: { display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginTop:16, padding:14, borderRadius:18, background:"rgba(255,255,255,0.035)", border:"1px solid rgba(255,255,255,0.08)", flexWrap:"wrap" },
  secondaryButton: { border:"1px solid rgba(255,255,255,0.14)", background:"rgba(15,23,42,0.9)", color:"#fff", borderRadius:14, padding:"11px 16px", fontWeight:900, cursor:"pointer" },
  promoInput: { border:"1px solid rgba(246,196,83,0.3)", background:"rgba(15,23,42,0.9)", color:"#fff", borderRadius:14, padding:"11px 14px", fontWeight:700, fontSize:13, width:160 },
  customerText: { color:"rgba(255,255,255,0.45)", fontSize:12, fontWeight:700 },
  plansGrid: { display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", gap:14, marginTop:18 },
  planCard: { border:"1px solid rgba(255,255,255,0.09)", background:"linear-gradient(180deg,rgba(15,23,42,0.90),rgba(3,7,18,0.88))", borderRadius:24, padding:18, boxShadow:"0 14px 38px rgba(0,0,0,0.38)", position:"relative" },
  highlightCard: { border:"1px solid rgba(246,196,83,0.35)", boxShadow:"0 0 0 1px rgba(246,196,83,0.1), 0 18px 50px rgba(120,80,0,0.25)" },
  currentPlanCard: { border:"1px solid rgba(74,222,128,0.42)", boxShadow:"0 0 0 1px rgba(74,222,128,0.12), 0 18px 50px rgba(20,70,38,0.25)" },
  popularBadgeWrap: { textAlign:"center", marginBottom:8 },
  popularBadge: { fontSize:11, fontWeight:900, color:"#f6c453", background:"rgba(246,196,83,0.1)", border:"1px solid rgba(246,196,83,0.25)", borderRadius:999, padding:"3px 10px" },
  planTop: { display:"flex", justifyContent:"space-between", gap:12 },
  planBadge: { display:"inline-block", border:"1px solid rgba(248,113,113,0.30)", background:"rgba(127,29,29,0.28)", color:"#fecaca", borderRadius:999, padding:"4px 9px", fontSize:10, fontWeight:900, textTransform:"uppercase", letterSpacing:1 },
  planName: { margin:"12px 0 0", fontSize:24, fontWeight:900 },
  planBlurb: { margin:"8px 0 0", color:"rgba(255,255,255,0.55)", fontSize:13, lineHeight:1.45 },
  priceWrap: { whiteSpace:"nowrap", textAlign:"right" },
  price: { fontSize:32, fontWeight:900 },
  sub: { color:"rgba(255,255,255,0.45)", fontWeight:800, marginLeft:2 },
  featuresList: { display:"grid", gap:8, marginTop:18 },
  planFeature: { border:"1px solid rgba(255,255,255,0.07)", background:"rgba(0,0,0,0.22)", borderRadius:14, padding:"10px 11px", fontSize:13, fontWeight:800, color:"rgba(255,255,255,0.78)" },
  primaryButton: { width:"100%", marginTop:18, border:"1px solid rgba(248,113,113,0.45)", background:"linear-gradient(180deg,#ef4444,#991b1b)", color:"#fff", borderRadius:16, padding:"13px 15px", fontWeight:900, cursor:"pointer", boxShadow:"0 12px 30px rgba(220,38,38,0.25)", fontSize:14 },
  highlightButton: { background:"linear-gradient(180deg,#d97706,#92400e)", border:"1px solid rgba(246,196,83,0.45)", boxShadow:"0 12px 30px rgba(180,100,0,0.25)" },
  currentButton: { background:"rgba(74,222,128,0.1)", border:"1px solid rgba(74,222,128,0.3)", color:"#4ade80", boxShadow:"none", cursor:"not-allowed" },
  annualBanner: { marginTop:16, border:"1px solid rgba(246,196,83,0.2)", background:"rgba(246,196,83,0.05)", borderRadius:18, padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center", gap:16, flexWrap:"wrap" },
  footerPanel: { marginTop:18, border:"1px solid rgba(255,255,255,0.08)", background:"rgba(255,255,255,0.035)", borderRadius:22, padding:17 },
  footerTitle: { fontSize:11, letterSpacing:1.6, color:"rgba(255,255,255,0.45)", textTransform:"uppercase", fontWeight:900 },
  footerGrid: { display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", gap:12, marginTop:12, color:"rgba(255,255,255,0.62)", fontSize:13, lineHeight:1.45 },
  loading: { marginTop:14, color:"rgba(255,255,255,0.45)", fontSize:13, fontWeight:800 },
};
