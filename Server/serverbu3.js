import "dotenv/config";

import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// ---------------- PRISMA / STRIPE ----------------
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// ---------------- APP ----------------
const app = express();
const PORT = Number(process.env.PORT || 5000);
const APP_URL = process.env.APP_URL || "http://localhost:5173";
const JWT_SECRET = process.env.JWT_SECRET || "change-me";

// ---------------- WEBHOOK MUST BE FIRST ----------------
app.post("/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: "Stripe not configured" });
  }

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    console.log("Stripe event:", event.type);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const userId = session.metadata?.userId || null;
      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id || null;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id || null;

      if (userId && subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);

        await prisma.user.update({
          where: { id: userId },
          data: {
            stripeCustomerId: customerId,
            stripeSubId: subscriptionId,
            stripePriceId: sub.items?.data?.[0]?.price?.id || null,
            billingStatus: sub.status || "active",
            billingPlan:
              sub.items?.data?.[0]?.price?.id === process.env.PRICE_PRO_YEARLY
                ? "pro_yearly"
                : "pro_monthly",
            billingPeriodEnd: sub.current_period_end
              ? new Date(sub.current_period_end * 1000)
              : null,
            isActive: ["active", "trialing"].includes(sub.status || ""),
          },
        });
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated"
    ) {
      const sub = event.data.object;
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

      if (customerId) {
        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            stripeSubId: sub.id,
            stripePriceId: sub.items?.data?.[0]?.price?.id || null,
            billingStatus: sub.status || "active",
            billingPlan:
              sub.items?.data?.[0]?.price?.id === process.env.PRICE_PRO_YEARLY
                ? "pro_yearly"
                : "pro_monthly",
            billingPeriodEnd: sub.current_period_end
              ? new Date(sub.current_period_end * 1000)
              : null,
            isActive: ["active", "trialing"].includes(sub.status || ""),
          },
        });
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

      if (customerId) {
        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            billingStatus: "canceled",
            isActive: false,
          },
        });
      }
    }

    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object;
      const customerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id;

      if (customerId) {
        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            billingStatus: "active",
            isActive: true,
          },
        });
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      const customerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id;

      if (customerId) {
        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            billingStatus: "past_due",
            isActive: false,
          },
        });
      }
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("Webhook failed:", err);
    return res.status(500).json({ error: "Webhook failed" });
  }
});

// ---------------- NORMAL MIDDLEWARE ----------------
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "15mb" }));

// ---------------- HELPERS ----------------
function signToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function getBearerToken(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return "";
  return auth.slice(7).trim();
}

async function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing auth token" });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) return res.status(401).json({ error: "Invalid user" });

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

function parseNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getTradeGrade(item) {
  if (
    item.action === "Taken" &&
    item.timing === "On Confirmation" &&
    item.planFollowed === "Yes" &&
    item.ruleBreak === "None"
  ) {
    return "DISCIPLINED";
  }

  if (
    item.timing === "Early" ||
    item.timing === "Chase Entry" ||
    item.planFollowed === "No" ||
    item.ruleBreak !== "None"
  ) {
    return "RULE BREAK";
  }

  return "MIXED";
}

function analyzeTrade(payload) {
  const setupQuality = parseNum(payload.setupQuality, 0);
  const disciplineScore = parseNum(payload.disciplineScore, 0);
  const emotionalPressure = parseNum(payload.emotionalPressure, 0);
  const hasRuleBreak = payload.ruleBreak && payload.ruleBreak !== "None";

  const overallScore = Math.max(
    40,
    Math.min(
      95,
      58 +
        setupQuality * 2 +
        disciplineScore * 2 -
        emotionalPressure -
        (hasRuleBreak ? 10 : 0)
    )
  );

  const overallGrade =
    overallScore >= 88 ? "A" : overallScore >= 76 ? "B" : "C";

  const whatWasGood = [];
  if (payload.planFollowed === "Yes") whatWasGood.push("Followed the trade plan");
  if (payload.timing === "On Confirmation") whatWasGood.push("Waited for confirmation");
  if (setupQuality >= 8) whatWasGood.push("High-quality setup");

  const whatNeedsWork = [];
  if (hasRuleBreak) whatNeedsWork.push(payload.ruleBreak);
  if (payload.timing === "Early" || payload.timing === "Chase Entry") {
    whatNeedsWork.push("Entry timing");
  }
  if (emotionalPressure >= 7) whatNeedsWork.push("Emotional control");

  return {
    overallScore,
    overallGrade,
    summary:
      payload.action === "Taken"
        ? `Trade logged for ${payload.pair}. Review weighted setup quality, discipline, and rule adherence.`
        : `Decision logged for ${payload.pair}. Review focused on whether the pass aligned with the plan.`,
    coachingTip: hasRuleBreak
      ? `Main issue: ${payload.ruleBreak}. Tighten execution and wait for confirmation.`
      : "Execution looked controlled. Keep matching entries to structure and confirmation.",
    setupScore: setupQuality,
    executionScore: disciplineScore,
    managementScore: Math.max(1, 10 - emotionalPressure),
    chartRead: payload.screenshotUrl
      ? "Screenshot attached for chart context."
      : "No screenshot attached.",
    setupAssessment: setupQuality >= 8 ? "Strong setup" : "Average setup",
    executionAssessment: getTradeGrade(payload),
    riskAssessment: hasRuleBreak ? "Rule break present" : "Risk rules respected",
    biasAlignment: payload.htfBias || "Unknown",
    mistakeTags: hasRuleBreak ? [payload.ruleBreak] : [],
    whatWasGood,
    whatNeedsWork,
    usedScreenshot: Boolean(payload.screenshotUrl),
  };
}

async function getOrCreateStripeCustomer(user) {
  if (!stripe) throw new Error("Stripe not configured");
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { userId: user.id },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

// ---------------- HEALTH ----------------
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    stripe: Boolean(stripe),
    time: new Date().toISOString(),
  });
});

// ---------------- AUTH ----------------
app.post("/register", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "Email already exists" });

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        billingStatus: "free",
        billingPlan: "free",
        isActive: false,
      },
    });

    return res.json({
      token: signToken(user),
      user: {
        id: user.id,
        email: user.email,
        stripeStatus: user.billingStatus,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "Register failed" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash || "");
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    return res.json({
      token: signToken(user),
      user: {
        id: user.id,
        email: user.email,
        stripeStatus: user.billingStatus,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Login failed" });
  }
});

app.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    const active = ["active", "trialing"].includes(user?.billingStatus || "");

    return res.json({
      user: {
        ...user,
        stripeStatus: user?.billingStatus || "free",
      },
      features: {
        radar: true,
        manualJournal: true,
        aiReview: active,
        screenshotReview: active,
        export: active,
        deeperStats: active,
      },
    });
  } catch (err) {
    console.error("Me error:", err);
    return res.status(500).json({ error: "Failed to load profile" });
  }
});

// ---------------- RADAR ----------------
const events = [];
const MAX_EVENTS = 300;

app.get("/events", (_req, res) => {
  res.json({ events });
});

app.get("/test-sweep", (_req, res) => {
  const fake = {
    id: `test_${Date.now()}`,
    timestampUtc: new Date().toISOString(),
    pair: "SUI/USDT",
    timeframe: "3m",
    session: "New York",
    directionBias: "Short",
    eventType: "SWEEP_RECLAIM",
    sweepType: "High Sweep",
    emaContext: "EMA99 Rejection",
    structure: "Compression",
    reclaimConfirmed: true,
    botConfidence: 0.82,
    entry: 1.25,
    stop: 1.28,
    tp1: 1.20,
    tp2: 1.15,
  };

  events.unshift(fake);
  if (events.length > MAX_EVENTS) events.pop();

  res.json({ ok: true, fake });
});

app.post("/sweep", (req, res) => {
  events.unshift(req.body);
  if (events.length > MAX_EVENTS) events.pop();
  res.json({ ok: true });
});

// ---------------- LOGS ----------------
app.get("/logs", requireAuth, async (req, res) => {
  try {
    const logs = await prisma.tradeLog.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return res.json({ logs });
  } catch (err) {
    console.error("Get logs error:", err);
    return res.status(500).json({ error: "Failed to load logs" });
  }
});

app.post("/logs", requireAuth, async (req, res) => {
  try {
    const payload = req.body || {};
    const aiAnalysis = analyzeTrade(payload);

    const log = await prisma.tradeLog.create({
      data: {
        userId: req.user.id,
        pair: payload.pair || "",
        timeframe: payload.timeframe || "3m",
        session: payload.session || "New York",
        directionBias: payload.directionBias || "Short",
        eventType: payload.eventType || "SWEEP_DETECTED",
        sweepType: payload.sweepType || "High Sweep",
        emaContext: payload.emaContext || "",
        leverage: parseNum(payload.leverage, 1),
        action: payload.action || "Taken",
        timing: payload.timing || "On Confirmation",
        planFollowed: payload.planFollowed || "Yes",
        ruleBreak: payload.ruleBreak || "None",
        disciplineScore: parseNum(payload.disciplineScore, 0),
        setupQuality: parseNum(payload.setupQuality, 0),
        emotionalPressure: parseNum(payload.emotionalPressure, 0),
        confidenceSelf: parseNum(payload.confidenceSelf, 0),
        executionType: payload.executionType || null,
        liquidityLevel: payload.liquidityLevel || null,
        htfBias: payload.htfBias || null,
        entryTrigger: payload.entryTrigger || null,
        outcome: payload.outcome || null,
        durationMinutes: parseNum(payload.durationMinutes, 0),
        entry: parseNum(payload.entry, 0),
        stop: parseNum(payload.stop, 0),
        exit: parseNum(payload.exit, 0),
        tp1: parseNum(payload.tp1, 0),
        tp2: parseNum(payload.tp2, 0),
        pnl: parseNum(payload.pnl, 0),
        notes: payload.notes || "",
        screenshotUrl: payload.screenshotUrl || "",
        linkedEventId: payload.linkedEventId || null,
        linkedRadarEvent: payload.linkedRadarEvent || null,
        reclaimConfirmed: Boolean(payload.reclaimConfirmed),
        aiStatus: "ready",
        aiScore: aiAnalysis.overallScore,
        aiGrade: aiAnalysis.overallGrade,
        aiSummary: aiAnalysis.summary,
        aiCoachingNote: aiAnalysis.coachingTip,
        setupScore: aiAnalysis.setupScore,
        executionScore: aiAnalysis.executionScore,
        managementScore: aiAnalysis.managementScore,
        chartRead: aiAnalysis.chartRead,
        setupAssessment: aiAnalysis.setupAssessment,
        executionAssessment: aiAnalysis.executionAssessment,
        riskAssessment: aiAnalysis.riskAssessment,
        biasAlignment: aiAnalysis.biasAlignment,
        mistakeTags: aiAnalysis.mistakeTags,
        whatWasGood: aiAnalysis.whatWasGood,
        whatNeedsWork: aiAnalysis.whatNeedsWork,
        usedScreenshot: aiAnalysis.usedScreenshot,
      },
    });

    return res.json({
      log,
      aiStatus: "ready",
      aiAnalysis,
    });
  } catch (err) {
    console.error("Create log error:", err);
    return res.status(500).json({
      error: "Failed to save log",
      details: err.message,
    });
  }
});

// ---------------- STRIPE ----------------
app.post("/stripe/create-checkout-session", requireAuth, async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: "Stripe not configured" });

    const plan = String(req.body.plan || "monthly").toLowerCase();
    const priceId =
      plan === "yearly"
        ? process.env.PRICE_PRO_YEARLY
        : process.env.PRICE_PRO_MONTHLY;

    if (!priceId) {
      return res.status(400).json({ error: "Missing Stripe price ID" });
    }

    const customerId = await getOrCreateStripeCustomer(req.user);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_URL}/billing?success=1`,
      cancel_url: `${APP_URL}/billing?canceled=1`,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      client_reference_id: req.user.id,
      metadata: {
        userId: req.user.id,
        plan,
      },
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error("Create checkout session error:", err);
    return res.status(500).json({ error: "Failed to create checkout session" });
  }
});

app.post("/stripe/create-portal-session", requireAuth, async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: "Stripe not configured" });
    if (!req.user.stripeCustomerId) {
      return res.status(400).json({ error: "No Stripe customer found" });
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: req.user.stripeCustomerId,
      return_url: `${APP_URL}/billing`,
    });

    return res.json({ url: portal.url });
  } catch (err) {
    console.error("Create portal session error:", err);
    return res.status(500).json({ error: "Failed to create portal session" });
  }
});

app.post("/stripe/sync", requireAuth, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: "Stripe not configured" });
    }

    if (!req.user.stripeCustomerId) {
      return res.json({
        ok: true,
        stripeStatus: req.user.billingStatus || "free",
      });
    }

    const subs = await stripe.subscriptions.list({
      customer: req.user.stripeCustomerId,
      status: "all",
      limit: 10,
    });

    console.log("SYNC user:", req.user.id);
    console.log("SYNC customer:", req.user.stripeCustomerId);
    console.log(
      "SYNC subscriptions:",
      subs.data.map((sub) => ({
        id: sub.id,
        status: sub.status,
        price: sub.items?.data?.[0]?.price?.id,
      }))
    );

    const activeLike = subs.data.find((sub) =>
      ["active", "trialing", "past_due", "incomplete"].includes(sub.status)
    );

    // 🔥 Important: do NOT downgrade to free just because sync found nothing
    if (!activeLike) {
      return res.json({
        ok: true,
        stripeStatus: req.user.billingStatus || "free",
        note: "No active-like subscription found during sync; kept existing billing state.",
      });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        stripeSubId: activeLike.id || null,
        stripePriceId: activeLike.items?.data?.[0]?.price?.id || null,
        billingStatus: activeLike.status || req.user.billingStatus || "free",
        billingPlan:
          activeLike.items?.data?.[0]?.price?.id === process.env.PRICE_PRO_YEARLY
            ? "pro_yearly"
            : "pro_monthly",
        billingPeriodEnd: activeLike.current_period_end
          ? new Date(activeLike.current_period_end * 1000)
          : null,
        isActive: ["active", "trialing"].includes(activeLike.status || ""),
      },
    });

    return res.json({
      ok: true,
      stripeStatus: activeLike.status || req.user.billingStatus || "free",
    });
  } catch (err) {
    console.error("Stripe sync error:", err);
    return res.status(500).json({ error: "Stripe sync failed" });
  }
});

// ---------------- START ----------------
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});