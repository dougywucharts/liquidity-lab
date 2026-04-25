import { useEffect, useMemo, useState } from "react";

const plans = [
  {
    key: "starter",
    name: "Starter",
    price: "$19/mo",
    blurb: "Core journaling access for early users.",
    features: ["Up to 100 recent logs", "Monthly recap", "Basic radar + journal access"],
  },
  {
    key: "core",
    name: "Core",
    price: "$49/mo",
    blurb: "Best fit for active traders.",
    features: ["Up to 500 recent logs", "Weekly + monthly recap", "Screenshot logging"],
  },
  {
    key: "pro",
    name: "Pro",
    price: "$99/mo",
    blurb: "Full history and premium review layer.",
    features: ["Full history", "Session + weekly + monthly recap", "AI summaries and premium review"],
  },
];

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

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

function fmtDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function statusTone(status, isActive) {
  if (isActive) return {
    border: "1px solid rgba(80,255,160,0.24)",
    background: "rgba(40,120,70,0.14)",
    color: "#b8ffd1",
  };
  if (["past_due", "unpaid", "canceled"].includes(status || "")) return {
    border: "1px solid rgba(255,26,26,0.28)",
    background: "rgba(255,26,26,0.12)",
    color: "#ffb0b0",
  };
  return {
    border: "1px solid rgba(255,190,70,0.26)",
    background: "rgba(140,90,20,0.18)",
    color: "#ffd38b",
  };
}

export default function BillingPage({ token = "", compact = false }) {
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyPlan, setBusyPlan] = useState("");
  const [portalBusy, setPortalBusy] = useState(false);
  const [error, setError] = useState("");

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
        const data = await apiFetch("/billing/status", {}, token);
        if (!cancelled) setBilling(data.billing || null);
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
        "/billing/create-checkout-session",
        {
          method: "POST",
          body: JSON.stringify({ plan }),
        },
        token
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
        "/billing/create-portal-session",
        { method: "POST" },
        token
      );
      if (data?.url) window.location.href = data.url;
    } catch (err) {
      setError(err.message || "Portal failed");
    } finally {
      setPortalBusy(false);
    }
  }

  const tone = useMemo(
    () => statusTone(billing?.billingStatus, billing?.isActive),
    [billing]
  );

  if (!token) {
    return (
      <div className="rounded-3xl border border-white/10 bg-neutral-950 p-6 text-white shadow-2xl">
        <div className="text-xs uppercase tracking-[0.28em] text-white/40">Billing</div>
        <h2 className="mt-2 text-2xl font-black">Sign in to manage your plan</h2>
        <p className="mt-2 text-sm text-white/60">
          Billing status, upgrades, and customer portal access appear here after login.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-neutral-950 p-6 text-white shadow-2xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-white/40">Billing</div>
          <h2 className="mt-2 text-2xl font-black">Subscription & access</h2>
          <p className="mt-2 text-sm text-white/60">
            Control plan access, renewals, and customer billing from one place.
          </p>
        </div>
        <div
          className="rounded-full px-3 py-2 text-xs font-bold uppercase tracking-wide"
          style={tone}
        >
          {billing?.isActive ? "Active" : billing?.billingStatus || "No active plan"}
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-white/40">Current plan</div>
          <div className="mt-2 text-lg font-bold">{billing?.billingPlan || "Free / None"}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-white/40">Status</div>
          <div className="mt-2 text-lg font-bold">{billing?.billingStatus || "—"}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-white/40">Renewal</div>
          <div className="mt-2 text-lg font-bold">{fmtDate(billing?.billingPeriodEnd)}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-white/40">Customer portal</div>
          <button
            onClick={openPortal}
            disabled={portalBusy || !billing?.stripeCustomerId}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"
          >
            {portalBusy ? "Opening..." : "Manage Billing"}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = billing?.billingPlan === plan.key && billing?.isActive;
          return (
            <div
              key={plan.key}
              className={`rounded-3xl border p-5 shadow-xl ${isCurrent ? "border-red-500/30 bg-red-500/10" : "border-white/10 bg-white/5"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xl font-black">{plan.name}</div>
                  <div className="mt-1 text-sm text-white/55">{plan.blurb}</div>
                </div>
                <div className="text-lg font-black">{plan.price}</div>
              </div>

              <div className="mt-4 space-y-2 text-sm text-white/80">
                {plan.features.map((feature) => (
                  <div key={feature} className="rounded-xl border border-white/8 bg-black/20 px-3 py-2">
                    {feature}
                  </div>
                ))}
              </div>

              <button
                onClick={() => startCheckout(plan.key)}
                disabled={busyPlan === plan.key || isCurrent}
                className={`mt-5 w-full rounded-2xl px-4 py-3 text-sm font-black transition ${isCurrent ? "border border-white/10 bg-white/10 text-white/70" : "border border-red-500/30 bg-red-600 text-white hover:bg-red-500"} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {isCurrent ? "Current Plan" : busyPlan === plan.key ? "Redirecting..." : `Start ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {!compact ? (
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs uppercase tracking-[0.22em] text-white/40">Plan behavior</div>
          <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm text-white/75">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="font-bold text-white">Starter</div>
              <div className="mt-2">100 recent logs and monthly recap.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="font-bold text-white">Core</div>
              <div className="mt-2">500 recent logs, screenshots, weekly and monthly recap.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="font-bold text-white">Pro</div>
              <div className="mt-2">Full history, session recaps, AI summaries, and premium review.</div>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 text-sm text-white/50">Loading billing status...</div>
      ) : null}
    </div>
  );
}
