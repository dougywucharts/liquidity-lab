import { plans } from "./plansData.js";

const FEATURES = [
  {
    icon: "📡",
    title: "Live liquidity radar",
    text: "Sweep, reclaim, and confirmation alerts across 45+ pairs, scored in real time with entry, stop, and target lines.",
  },
  {
    icon: "🤖",
    title: "AI trade journal",
    text: "Log a trade in one click and get an instant AI review — what was good, what to fix, graded against your plan.",
  },
  {
    icon: "🧬",
    title: "Trader DNA™ coaching",
    text: "Claude builds a running profile of your habits from every logged trade, then coaches you on the patterns holding you back.",
  },
  {
    icon: "📓",
    title: "Event + manual journal",
    text: "Link a journal entry directly to a live radar event, or log manual trades — either way it feeds your AI review.",
  },
  {
    icon: "🎯",
    title: "Prop firm challenge tracker",
    text: "Track daily loss limits, drawdown, and targets against FTMO-style rules so you know your status before you overtrade.",
  },
  {
    icon: "📚",
    title: "Members Vault",
    text: "Pattern library, trading psychology lessons, and a growing video library from real traders.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Bot scans the market",
    text: "45+ pairs, watched continuously for liquidity sweeps, reclaims, and confirmations.",
  },
  {
    n: "2",
    title: "You get a scored alert",
    text: "Entry, stop, and targets — live, with a confidence score, not a vague \"buy signal.\"",
  },
  {
    n: "3",
    title: "Log it in one click",
    text: "Pull the event straight into your journal, or log a manual trade of your own.",
  },
  {
    n: "4",
    title: "AI reviews and coaches",
    text: "Instant grading on the trade, plus Trader DNA updating your long-term coaching profile.",
  },
];

export default function LandingPage({ onSignIn, onGetStarted }) {
  return (
    <div style={s.page}>
      <div style={s.glowA} />

      <nav style={s.nav}>
        <div style={s.navBrand}>Liquidity Lab</div>
        <div style={s.navLinks}>
          <a href="#how-it-works" style={s.navLink}>How it works</a>
          <a href="#features" style={s.navLink}>Features</a>
          <a href="#pricing" style={s.navLink}>Pricing</a>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button style={s.navSignIn} onClick={onSignIn}>Sign In</button>
          <button style={s.navCta} onClick={onGetStarted}>Get Started Free →</button>
        </div>
      </nav>

      <div style={s.hero}>
        <div style={s.kicker}>Live Radar · Real Signals · AI Coaching</div>
        <h1 style={s.heroTitle}>
          The market shows its hand.
          <br />
          We catch it in real time.
        </h1>
        <p style={s.heroText}>
          Liquidity sweeps happen before the move. Our bot detects them the moment
          they fire — so you're ready before everyone else is. Then the AI journal
          and Trader DNA coaching turn every trade into something you actually learn from.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
          <button style={s.heroCta} onClick={onGetStarted}>Get Started Free →</button>
          <a href="#how-it-works" style={s.heroSecondary}>See how it works</a>
        </div>
      </div>

      <div id="how-it-works" style={s.section}>
        <div style={s.sectionKicker}>How it works</div>
        <h2 style={s.sectionTitle}>Not just a signal. A full loop.</h2>
        <div style={s.stepsGrid}>
          {STEPS.map(step => (
            <div key={step.n} style={s.stepCard}>
              <div style={s.stepNum}>{step.n}</div>
              <div style={s.stepTitle}>{step.title}</div>
              <div style={s.stepText}>{step.text}</div>
            </div>
          ))}
        </div>
      </div>

      <div id="features" style={s.section}>
        <div style={s.sectionKicker}>Features</div>
        <h2 style={s.sectionTitle}>The whole package, not more signals</h2>
        <div style={s.featuresGrid}>
          {FEATURES.map(f => (
            <div key={f.title} style={s.featureCard}>
              <div style={s.featureIcon}>{f.icon}</div>
              <div style={s.featureTitle}>{f.title}</div>
              <div style={s.featureText}>{f.text}</div>
            </div>
          ))}
        </div>
      </div>

      <div id="pricing" style={s.section}>
        <div style={s.sectionKicker}>Pricing</div>
        <h2 style={s.sectionTitle}>Pick a plan</h2>
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
                  <h3 style={s.planName}>{plan.name}</h3>
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
                    <span style={{ color: feature.includes("🧬") ? "#f6c453" : "#fb7185", marginRight: 8, fontSize: 9 }}>●</span>
                    {feature}
                  </div>
                ))}
              </div>
              <button
                style={{ ...s.primaryButton, ...(plan.highlight ? s.highlightButton : {}) }}
                onClick={onGetStarted}
              >
                {plan.key === "starter" ? "Create Free Account" : `Sign Up for ${plan.name}`}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={s.footer}>
        <div style={s.footerBrand}>Liquidity Lab</div>
        <div style={s.footerText}>Red October Systems · support@redoctobersystems.com</div>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: "#03060b", color: "#f4f7fb", fontFamily: "Arial, sans-serif", position: "relative", overflow: "hidden" },
  glowA: { position: "fixed", top: "-10%", left: "50%", transform: "translateX(-50%)", width: 900, height: 500, background: "radial-gradient(ellipse, rgba(239,68,68,0.12), transparent 70%)", pointerEvents: "none" },

  nav: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 40px", borderBottom: "1px solid rgba(255,255,255,0.08)", position: "relative", zIndex: 2, flexWrap: "wrap", gap: 12 },
  navBrand: { fontSize: 18, fontWeight: 900 },
  navLinks: { display: "flex", gap: 24 },
  navLink: { color: "rgba(244,247,251,0.66)", textDecoration: "none", fontSize: 14, fontWeight: 700 },
  navSignIn: { border: "none", background: "none", color: "rgba(244,247,251,0.66)", fontWeight: 800, fontSize: 14, cursor: "pointer" },
  navCta: { border: "none", borderRadius: 10, padding: "9px 16px", background: "linear-gradient(135deg,#ff2f2f 0%,#c71f1f 100%)", color: "#fff", fontWeight: 900, fontSize: 13, cursor: "pointer" },

  hero: { maxWidth: 780, margin: "0 auto", padding: "90px 24px 70px", textAlign: "center", position: "relative", zIndex: 1 },
  kicker: { fontSize: 12, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase", color: "#ef4444", marginBottom: 18 },
  heroTitle: { fontSize: 46, fontWeight: 900, lineHeight: 1.2, margin: "0 0 20px" },
  heroText: { fontSize: 17, lineHeight: 1.6, color: "rgba(244,247,251,0.66)", maxWidth: 620, margin: "0 auto" },
  heroCta: { border: "none", borderRadius: 12, padding: "13px 24px", background: "linear-gradient(135deg,#ff2f2f 0%,#c71f1f 100%)", color: "#fff", fontWeight: 900, fontSize: 15, cursor: "pointer", boxShadow: "0 10px 24px rgba(239,68,68,0.25)" },
  heroSecondary: { border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, padding: "13px 24px", color: "#f4f7fb", fontWeight: 800, fontSize: 15, textDecoration: "none", display: "inline-flex", alignItems: "center" },

  section: { maxWidth: 1080, margin: "0 auto", padding: "60px 24px" },
  sectionKicker: { fontSize: 12, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase", color: "#f6c453", marginBottom: 8, textAlign: "center" },
  sectionTitle: { fontSize: 30, fontWeight: 900, textAlign: "center", margin: "0 0 36px" },

  stepsGrid: { display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 16 },
  stepCard: { border: "1px solid rgba(255,255,255,0.09)", borderRadius: 18, padding: 20, background: "linear-gradient(180deg,rgba(15,23,42,0.7),rgba(3,7,18,0.7))" },
  stepNum: { fontSize: 13, fontWeight: 900, color: "#ef4444", marginBottom: 10 },
  stepTitle: { fontSize: 15, fontWeight: 900, marginBottom: 6 },
  stepText: { fontSize: 13, color: "rgba(244,247,251,0.6)", lineHeight: 1.5 },

  featuresGrid: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 16 },
  featureCard: { border: "1px solid rgba(255,255,255,0.09)", borderRadius: 18, padding: 22, background: "linear-gradient(180deg,rgba(15,23,42,0.7),rgba(3,7,18,0.7))" },
  featureIcon: { fontSize: 26, marginBottom: 10 },
  featureTitle: { fontSize: 16, fontWeight: 900, marginBottom: 6 },
  featureText: { fontSize: 13, color: "rgba(244,247,251,0.6)", lineHeight: 1.5 },

  plansGrid: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 16 },
  planCard: { border: "1px solid rgba(255,255,255,0.09)", background: "linear-gradient(180deg,rgba(15,23,42,0.90),rgba(3,7,18,0.88))", borderRadius: 24, padding: 20, position: "relative" },
  highlightCard: { border: "1px solid rgba(246,196,83,0.35)" },
  popularBadgeWrap: { textAlign: "center", marginBottom: 10 },
  popularBadge: { fontSize: 11, fontWeight: 900, color: "#f6c453", background: "rgba(246,196,83,0.1)", border: "1px solid rgba(246,196,83,0.25)", borderRadius: 999, padding: "3px 10px" },
  planTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 14 },
  planBadge: { fontSize: 10, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: "rgba(244,247,251,0.46)" },
  planName: { fontSize: 20, fontWeight: 900, margin: "4px 0" },
  planBlurb: { fontSize: 12, color: "rgba(244,247,251,0.6)", margin: 0 },
  priceWrap: { textAlign: "right", whiteSpace: "nowrap" },
  price: { fontSize: 24, fontWeight: 900 },
  sub: { fontSize: 12, color: "rgba(244,247,251,0.46)" },
  featuresList: { display: "grid", gap: 8, marginBottom: 18 },
  planFeature: { fontSize: 13, color: "rgba(244,247,251,0.8)" },
  primaryButton: { width: "100%", border: "1px solid rgba(248,113,113,0.45)", background: "linear-gradient(180deg,#ef4444,#991b1b)", color: "#fff", borderRadius: 16, padding: "13px 15px", fontWeight: 900, cursor: "pointer", fontSize: 14 },
  highlightButton: { background: "linear-gradient(180deg,#d97706,#92400e)", border: "1px solid rgba(246,196,83,0.45)" },

  footer: { textAlign: "center", padding: "40px 24px 60px", borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 20 },
  footerBrand: { fontSize: 14, fontWeight: 900, marginBottom: 6 },
  footerText: { fontSize: 12, color: "rgba(244,247,251,0.4)" },
};
