import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL || "http://localhost:5000";

function PasswordField({ value, onChange, placeholder, autoFocus }) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{ ...s.input, paddingRight: 56 }}
        autoFocus={autoFocus}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        style={{
          position: "absolute",
          right: 14,
          top: "50%",
          transform: "translateY(-50%)",
          border: "none",
          background: "none",
          color: "rgba(255,255,255,0.45)",
          fontSize: 11,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          cursor: "pointer",
          padding: 0,
        }}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}

async function apiFetch(path, options = {}) {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.details || `HTTP ${res.status}`);
  return data;
}

export default function ResetPasswordPage({ onDone }) {
  const token = new URLSearchParams(window.location.search).get("token") || "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [requestSent, setRequestSent] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  async function handleRequestSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      setSubmitting(true);
      setError("");
      await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setRequestSent(true);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    try {
      setSubmitting(true);
      const data = await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword: password }),
      });
      if (data?.token) localStorage.setItem("token", data.token);
      setResetDone(true);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.glowA} />
      <div style={s.glowB} />
      <div style={s.shell}>
        <div style={s.kicker}>RED OCTOBER SYSTEMS</div>
        <h1 style={s.title}>Liquidity Lab</h1>

        {!token ? (
          requestSent ? (
            <>
              <p style={s.muted}>
                If that email exists, we've sent a reset link to it. Check your
                inbox — the link expires in 1 hour.
              </p>
              <button style={s.secondaryButton} onClick={onDone}>
                Back to login
              </button>
            </>
          ) : (
            <form onSubmit={handleRequestSubmit}>
              <p style={s.muted}>
                Enter the email on your account and we'll send you a link to
                reset your password.
              </p>
              <label style={s.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={s.input}
                autoFocus
              />
              {error && <div style={s.errorBox}>{error}</div>}
              <button
                type="submit"
                style={{ ...s.primaryButton, opacity: submitting ? 0.6 : 1 }}
                disabled={submitting}
              >
                {submitting ? "Sending…" : "Send reset link"}
              </button>
              <button type="button" style={s.linkButton} onClick={onDone}>
                Back to login
              </button>
            </form>
          )
        ) : resetDone ? (
          <>
            <p style={s.muted}>Your password has been reset. You're all set.</p>
            <button style={s.primaryButton} onClick={onDone}>
              Go to dashboard →
            </button>
          </>
        ) : (
          <form onSubmit={handleResetSubmit}>
            <p style={s.muted}>Choose a new password for your account.</p>
            <label style={s.label}>New password</label>
            <PasswordField
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoFocus
            />
            <label style={s.label}>Confirm password</label>
            <PasswordField
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
            />
            {error && <div style={s.errorBox}>{error}</div>}
            <button
              type="submit"
              style={{ ...s.primaryButton, opacity: submitting ? 0.6 : 1 }}
              disabled={submitting}
            >
              {submitting ? "Resetting…" : "Reset password"}
            </button>
            <button type="button" style={s.linkButton} onClick={onDone}>
              Back to login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh", padding: 24,
    background: "radial-gradient(circle at top left, rgba(220,38,38,0.20), transparent 32%), radial-gradient(circle at bottom right, rgba(15,118,110,0.18), transparent 28%), #03050a",
    color: "#f8fafc",
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    position: "relative", overflow: "hidden",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  glowA: { position: "fixed", width: 420, height: 420, borderRadius: "50%", background: "rgba(239,68,68,0.12)", filter: "blur(60px)", top: -120, left: -120, pointerEvents: "none" },
  glowB: { position: "fixed", width: 360, height: 360, borderRadius: "50%", background: "rgba(34,197,94,0.10)", filter: "blur(70px)", right: -100, bottom: -100, pointerEvents: "none" },
  shell: { position: "relative", width: "100%", maxWidth: 420, border: "1px solid rgba(255,255,255,0.09)", background: "rgba(5,8,16,0.82)", borderRadius: 28, padding: 28, boxShadow: "0 24px 80px rgba(0,0,0,0.55)", backdropFilter: "blur(14px)" },
  kicker: { fontSize: 11, fontWeight: 900, letterSpacing: 4, color: "rgba(255,255,255,0.42)" },
  title: { margin: "8px 0 18px", fontSize: 26, lineHeight: 1, fontWeight: 900, letterSpacing: -1 },
  muted: { margin: "0 0 18px", color: "rgba(255,255,255,0.62)", fontSize: 14, lineHeight: 1.5 },
  label: { display: "block", fontSize: 11, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: 6, marginTop: 14 },
  input: { width: "100%", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(15,23,42,0.9)", color: "#fff", borderRadius: 14, padding: "12px 14px", fontWeight: 600, fontSize: 14, boxSizing: "border-box" },
  errorBox: { marginTop: 14, border: "1px solid rgba(248,113,113,0.30)", background: "rgba(127,29,29,0.25)", color: "#fecaca", borderRadius: 14, padding: 12, fontWeight: 700, fontSize: 13 },
  primaryButton: { width: "100%", marginTop: 20, border: "1px solid rgba(248,113,113,0.45)", background: "linear-gradient(180deg,#ef4444,#991b1b)", color: "#fff", borderRadius: 16, padding: "13px 15px", fontWeight: 900, cursor: "pointer", boxShadow: "0 12px 30px rgba(220,38,38,0.25)", fontSize: 14 },
  secondaryButton: { marginTop: 16, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(15,23,42,0.9)", color: "#fff", borderRadius: 14, padding: "11px 16px", fontWeight: 900, cursor: "pointer" },
  linkButton: { display: "block", width: "100%", textAlign: "center", marginTop: 14, border: "none", background: "none", color: "rgba(255,255,255,0.5)", fontWeight: 700, fontSize: 13, cursor: "pointer", textDecoration: "underline" },
};
