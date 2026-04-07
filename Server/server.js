import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import OpenAI from "openai";
import Stripe from "stripe";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./prisma/generated/prisma/client.js";

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT || 5000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const APP_URL = process.env.APP_URL || CLIENT_ORIGIN;
const JWT_SECRET = process.env.JWT_SECRET || "change-me-now";
const MAX_EVENTS = 250;

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const STRIPE_PRICE_STARTER = process.env.STRIPE_PRICE_STARTER || "";
const STRIPE_PRICE_CORE = process.env.STRIPE_PRICE_CORE || "";
const STRIPE_PRICE_PRO = process.env.STRIPE_PRICE_PRO || "";

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

// ==================================================
// DB
// ==================================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ==================================================
// STRIPE WEBHOOK FIRST
// ==================================================
app.post("/billing/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return res.status(500).send("Stripe webhook not configured");
  }

  let event;

  try {
    const signature = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("STRIPE SIGNATURE ERROR:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.userId || null;
        const plan = session.metadata?.plan || null;
        const customerId = session.customer || null;
        const subscriptionId = session.subscription || null;

        if (!userId) {
          console.log("No userId in checkout.session.completed metadata");
          break;
        }

        await prisma.user.update({
          where: { id: userId },
          data: {
            stripeCustomerId: customerId ? String(customerId) : null,
            stripeSubId: subscriptionId ? String(subscriptionId) : null,
            billingPlan: plan,
          },
        });

        console.log("checkout.session.completed linked to user:", userId);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const customerId = String(sub.customer);
        const priceId = sub.items?.data?.[0]?.price?.id || null;
        const status = sub.status || null;
        const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;

        let plan = null;
        if (priceId === STRIPE_PRICE_STARTER) plan = "starter";
        if (priceId === STRIPE_PRICE_CORE) plan = "core";
        if (priceId === STRIPE_PRICE_PRO) plan = "pro";

        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            stripeSubId: sub.id,
            stripePriceId: priceId,
            billingStatus: status,
            billingPlan: plan,
            billingPeriodEnd: periodEnd,
            isActive: status === "active" || status === "trialing",
          },
        });

        console.log("subscription updated for customer:", customerId, status, plan);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;

        await prisma.user.updateMany({
          where: { stripeCustomerId: String(sub.customer) },
          data: {
            billingStatus: sub.status || "canceled",
            isActive: false,
          },
        });

        console.log("subscription deleted for customer:", String(sub.customer));
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;

        await prisma.user.updateMany({
          where: { stripeCustomerId: String(invoice.customer) },
          data: {
            billingStatus: "past_due",
            isActive: false,
          },
        });

        console.log("payment failed for customer:", String(invoice.customer));
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object;

        await prisma.user.updateMany({
          where: { stripeCustomerId: String(invoice.customer) },
          data: {
            billingStatus: "active",
            isActive: true,
          },
        });

        console.log("invoice paid for customer:", String(invoice.customer));
        break;
      }

      default:
        console.log("Unhandled Stripe event:", event.type);
        break;
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("STRIPE WEBHOOK HANDLER ERROR:", error);
    return res.status(500).json({ error: error.message || "Webhook handler failed" });
  }
});

// ==================================================
// NORMAL MIDDLEWARE AFTER WEBHOOK
// ==================================================
const allowedOrigins = [
  "http://localhost:5173",
  "https://redoctobersystems.com",
  "https://www.redoctobersystems.com",
  "https://project-fjycv.vercel.app"
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);



app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true }));

// ==================================================
// AI
// ==================================================
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const ENABLE_AI = String(process.env.ENABLE_AI || "false").toLowerCase() === "true";
const AI_ONLY_WITH_SCREENSHOT = true;
const AI_ONLY_FOR_TAKEN_TRADES = true;
const AI_ONLY_FOR_L3 = false;
const AI_MIN_GAP_MS = 10000;
let lastAIRequestAt = 0;

// ==================================================
// IN-MEMORY RADAR
// ==================================================
const radarEvents = [];

// ==================================================
// HELPERS
// ==================================================
function toNumberOrNull(value) {
  if (value === "" || value === undefined || value === null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  if (value === null || value === undefined || value === "") return null;
  return Boolean(value);
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTimestamp(value) {
  if (!value) return new Date().toISOString();

  if (typeof value === "number") {
    const millis = value < 1e12 ? value * 1000 : value;
    const d = new Date(millis);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (/^\d{10}$/.test(trimmed)) {
      return new Date(Number(trimmed) * 1000).toISOString();
    }

    if (/^\d{13}$/.test(trimmed)) {
      return new Date(Number(trimmed)).toISOString();
    }

    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(trimmed);
    const iso = hasTimezone ? trimmed : `${trimmed}Z`;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }

  return new Date().toISOString();
}

function pushRadarEvent(event) {
  const normalized = {
    id: event.id || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestampUtc: normalizeTimestamp(event.timestampUtc),
    pair: safeString(event.pair) || null,
    timeframe: safeString(event.timeframe) || null,
    session: safeString(event.session) || null,
    directionBias: safeString(event.directionBias) || null,
    eventType: safeString(event.eventType) || null,
    sweepType: safeString(event.sweepType) || null,
    emaContext: safeString(event.emaContext) || null,
    reclaimConfirmed: toBoolean(event.reclaimConfirmed),
    botConfidence: toNumberOrNull(event.botConfidence),
    entry: toNumberOrNull(event.entry),
    stop: toNumberOrNull(event.stop),
    tp1: toNumberOrNull(event.tp1),
    tp2: toNumberOrNull(event.tp2),
    rr1: toNumberOrNull(event.rr1),
    rr2: toNumberOrNull(event.rr2),
    volumeSpike: toNumberOrNull(event.volumeSpike),
    structure: safeString(event.structure) || null,
    signalLevel: safeString(event.signalLevel) || null,
  };

  radarEvents.unshift(normalized);
  if (radarEvents.length > MAX_EVENTS) radarEvents.length = MAX_EVENTS;
  return normalized;
}

function signToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function clampScore(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function findLinkedRadarEvent(trade) {
  if (trade.linkedRadarEvent && typeof trade.linkedRadarEvent === "object") {
    return trade.linkedRadarEvent;
  }

  if (!trade.linkedEventId) return null;
  return radarEvents.find((event) => event.id === trade.linkedEventId) || null;
}

function inferSignalLevel(linkedRadarEvent, trade) {
  if (linkedRadarEvent?.signalLevel) return linkedRadarEvent.signalLevel;

  const confidence = Number(linkedRadarEvent?.botConfidence || 0);
  const eventType = linkedRadarEvent?.eventType || trade?.eventType || "";

  if (eventType === "SWEEP_CONFIRMED" || eventType === "DOUBLE_SWEEP" || confidence >= 0.85) {
    return "L3";
  }
  if (eventType === "SWEEP_RECLAIM" || confidence >= 0.7) {
    return "L2";
  }
  return "L1";
}

function canCallAI() {
  const now = Date.now();
  if (now - lastAIRequestAt < AI_MIN_GAP_MS) return false;
  lastAIRequestAt = now;
  return true;
}

function shouldRunAI(trade, linkedRadarEvent = null) {
  if (!ENABLE_AI || !openai) return false;

  const hasScreenshot = Boolean(trade.screenshotUrl || trade.screenshotBase64);
  const signalLevel = inferSignalLevel(linkedRadarEvent, trade);

  if (AI_ONLY_WITH_SCREENSHOT && !hasScreenshot) return false;
  if (AI_ONLY_FOR_TAKEN_TRADES && trade.action !== "Taken") return false;
  if (AI_ONLY_FOR_L3 && signalLevel !== "L3") return false;
  if (!canCallAI()) return false;

  return true;
}

function buildTradePayload(body) {
  return {
    pair: safeString(body.pair) || null,
    timeframe: safeString(body.timeframe) || null,
    session: safeString(body.session) || null,
    action: safeString(body.action) || null,
    pnl: toNumberOrNull(body.pnl),
    notes: safeString(body.notes) || null,
    leverage: toNumberOrNull(body.leverage),

    entry: toNumberOrNull(body.entry),
    stop: toNumberOrNull(body.stop),
    tp1: toNumberOrNull(body.tp1),
    tp2: toNumberOrNull(body.tp2),
    rr1: toNumberOrNull(body.rr1),
    rr2: toNumberOrNull(body.rr2),

    directionBias: safeString(body.directionBias) || null,
    eventType: safeString(body.eventType) || null,
    sweepType: safeString(body.sweepType) || null,
    emaContext: safeString(body.emaContext) || null,
    reclaimConfirmed: toBoolean(body.reclaimConfirmed),

    planFollowed: safeString(body.planFollowed) || null,
    ruleBreak: safeString(body.ruleBreak) || null,

    executionType: safeString(body.executionType) || null,
    liquidityLevel: safeString(body.liquidityLevel) || null,
    htfBias: safeString(body.htfBias) || null,
    entryTrigger: safeString(body.entryTrigger) || null,
    outcome: safeString(body.outcome) || null,
    confidenceSelf: toNumberOrNull(body.confidenceSelf),
    durationMinutes: toNumberOrNull(body.durationMinutes),

    emotionalPressure: toNumberOrNull(body.emotionalPressure),
    setupQuality: toNumberOrNull(body.setupQuality),
    disciplineScore: toNumberOrNull(body.disciplineScore),

    linkedEventId:
      safeString(body.linkedEventId || body.radarEventId || body.linkedRadarEventId) || null,

    linkedRadarEvent:
      body.linkedRadarEvent && typeof body.linkedRadarEvent === "object"
        ? body.linkedRadarEvent
        : null,

    screenshotUrl: safeString(body.screenshotUrl) || null,
    screenshotBase64: safeString(body.screenshotBase64) || null,
    screenshotMimeType: safeString(body.screenshotMimeType) || null,
  };
}

function computeFallbackAnalysis(trade, linkedRadarEvent = null) {
  let setupScore = 70;
  let executionScore = 68;
  let managementScore = 68;
  let disciplineScoreAi = 70;

  const good = [];
  const work = [];
  const tags = [];

  if (trade.reclaimConfirmed) {
    setupScore += 6;
    good.push("Reclaim confirmation improved setup structure.");
  }

  if (trade.emaContext && /99/i.test(trade.emaContext)) {
    setupScore += 5;
    good.push("EMA99 context fits your preferred sweep framework.");
  }

  if (trade.rr1 !== null && trade.rr1 >= 1.5) {
    managementScore += 5;
    good.push("RR to TP1 was at or above your minimum standard.");
  }

  if (trade.rr1 !== null && trade.rr1 < 1.5) {
    managementScore -= 12;
    work.push("RR to TP1 was thin versus your usual rule set.");
    tags.push("poor_rr");
  }

  if (trade.ruleBreak && trade.ruleBreak.toLowerCase() !== "none") {
    executionScore -= 10;
    disciplineScoreAi -= 15;
    work.push(`Rule break logged: ${trade.ruleBreak}.`);
    tags.push(trade.ruleBreak);
  }

  if (trade.planFollowed && /no/i.test(trade.planFollowed)) {
    disciplineScoreAi -= 10;
    work.push("You marked this as not following plan.");
    tags.push("did_not_follow_plan");
  }

  if (trade.stop === null) {
    managementScore -= 12;
    work.push("No stop was supplied, so risk quality is weaker.");
    tags.push("missing_stop");
  }

  if (linkedRadarEvent?.directionBias && trade.directionBias) {
    const tradeBias = String(trade.directionBias).toLowerCase();
    const radarBias = String(linkedRadarEvent.directionBias).toLowerCase();

    if (
      (tradeBias.includes("short") && radarBias.includes("short")) ||
      (tradeBias.includes("long") && radarBias.includes("long"))
    ) {
      setupScore += 4;
      good.push("Trade direction matched linked radar bias.");
    } else {
      setupScore -= 6;
      work.push("Trade direction did not match linked radar bias.");
      tags.push("bias_mismatch");
    }
  }

  const overallScore = clampScore(
    (setupScore + executionScore + managementScore + disciplineScoreAi) / 4,
    70
  );
  const overallGrade =
    overallScore >= 90 ? "A" :
    overallScore >= 80 ? "B" :
    overallScore >= 70 ? "C" :
    overallScore >= 60 ? "D" : "F";

  return {
    overallScore,
    overallGrade,
    setupScore: clampScore(setupScore, 70),
    executionScore: clampScore(executionScore, 68),
    managementScore: clampScore(managementScore, 68),
    disciplineScoreAi: clampScore(disciplineScoreAi, 70),
    confidence: 0.42,
    chartRead:
      "Fallback analysis used because AI response was unavailable. This review is based on rule logic and submitted trade fields only.",
    setupAssessment: trade.sweepType
      ? `${trade.sweepType} with ${trade.emaContext || "limited EMA context"}.`
      : "Limited setup context was supplied.",
    executionAssessment: trade.action
      ? `Action logged as ${trade.action}. Review whether the entry was at confirmation or after extension.`
      : "Execution quality could not be judged well because action was missing.",
    riskAssessment: trade.stop !== null
      ? "A stop was supplied. Review whether it was placed beyond invalidation instead of noise."
      : "No stop was supplied, so risk quality is reduced.",
    biasAlignment: linkedRadarEvent?.directionBias || trade.directionBias || "Unknown",
    mistakeTags: normalizeStringArray(tags),
    whatWasGood: good.length ? good : ["The trade was logged and reviewed instead of ignored."],
    whatNeedsWork: work.length ? work : ["Add screenshot context for deeper chart-based analysis."],
    coachingTip:
      "Separate setup quality from execution quality so a green PnL does not hide a bad process.",
    summary: work.length ? work[0] : "Trade captured successfully.",
    usedScreenshot: Boolean(trade.screenshotUrl || trade.screenshotBase64),
  };
}

async function analyzeTradeWithAI(trade, linkedRadarEvent = null) {
  const hasImage = Boolean(trade.screenshotUrl || trade.screenshotBase64);

  const tradeContext = {
    pair: trade.pair,
    timeframe: trade.timeframe,
    session: trade.session,
    action: trade.action,
    pnl: trade.pnl,
    notes: trade.notes,
    leverage: trade.leverage,
    entry: trade.entry,
    stop: trade.stop,
    tp1: trade.tp1,
    tp2: trade.tp2,
    rr1: trade.rr1,
    rr2: trade.rr2,
    directionBias: trade.directionBias,
    eventType: trade.eventType,
    sweepType: trade.sweepType,
    emaContext: trade.emaContext,
    reclaimConfirmed: trade.reclaimConfirmed,
    planFollowed: trade.planFollowed,
    ruleBreak: trade.ruleBreak,
    emotionalPressure: trade.emotionalPressure,
    setupQuality: trade.setupQuality,
    executionType: trade.executionType,
    liquidityLevel: trade.liquidityLevel,
    htfBias: trade.htfBias,
    entryTrigger: trade.entryTrigger,
    outcome: trade.outcome,
    confidenceSelf: trade.confidenceSelf,
    durationMinutes: trade.durationMinutes,
    linkedEventId: trade.linkedEventId,
    linkedRadarEvent,
  };

  const systemPrompt = `You are an elite trading performance coach focused on liquidity sweeps, reclaim behavior, EMA context, execution quality, and risk discipline.

Return valid JSON only with fields:
overallScore, overallGrade, setupScore, executionScore, managementScore, disciplineScoreAi, confidence, chartRead, setupAssessment, executionAssessment, riskAssessment, biasAlignment, mistakeTags, whatWasGood, whatNeedsWork, coachingTip, summary, usedScreenshot.`;

  const userContent = [
    {
      type: "input_text",
      text: `Evaluate this trade log. Return JSON only.\n\nTrade context:\n${JSON.stringify(tradeContext, null, 2)}`,
    },
  ];

  if (trade.screenshotUrl) {
    userContent.push({
      type: "input_image",
      image_url: trade.screenshotUrl,
    });
  } else if (trade.screenshotBase64 && trade.screenshotMimeType) {
    userContent.push({
      type: "input_image",
      image_url: `data:${trade.screenshotMimeType};base64,${trade.screenshotBase64}`,
    });
  }

  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: systemPrompt }],
      },
      {
        role: "user",
        content: userContent,
      },
    ],
    temperature: 0.2,
  });

  const rawText = response.output_text?.trim();
  if (!rawText) {
    throw new Error("AI returned empty output");
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const cleaned = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```/, "")
      .replace(/```$/, "")
      .trim();
    parsed = JSON.parse(cleaned);
  }

  return {
    overallScore: clampScore(parsed.overallScore, 0),
    overallGrade: String(parsed.overallGrade || "C").toUpperCase(),
    setupScore: clampScore(parsed.setupScore, 0),
    executionScore: clampScore(parsed.executionScore, 0),
    managementScore: clampScore(parsed.managementScore, 0),
    disciplineScoreAi: clampScore(parsed.disciplineScoreAi, 0),
    confidence: Number.isFinite(Number(parsed.confidence)) ? Number(parsed.confidence) : 0,
    chartRead: String(parsed.chartRead || ""),
    setupAssessment: String(parsed.setupAssessment || ""),
    executionAssessment: String(parsed.executionAssessment || ""),
    riskAssessment: String(parsed.riskAssessment || ""),
    biasAlignment: String(parsed.biasAlignment || "Unknown"),
    mistakeTags: normalizeStringArray(parsed.mistakeTags),
    whatWasGood: normalizeStringArray(parsed.whatWasGood),
    whatNeedsWork: normalizeStringArray(parsed.whatNeedsWork),
    coachingTip: String(parsed.coachingTip || ""),
    summary: String(parsed.summary || ""),
    usedScreenshot: Boolean(parsed.usedScreenshot ?? hasImage),
  };
}

// ==================================================
// AUTH / BILLING MIDDLEWARE
// ==================================================
function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "Missing auth token" });
    }

    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

async function requireActiveSub(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });

    if (!user || !user.isActive) {
      return res.status(403).json({ error: "Active subscription required" });
    }

    req.userPlan = user.billingPlan || "starter";
    next();
  } catch (error) {
    return res.status(500).json({ error: error.message || "Billing check failed" });
  }
}

// ==================================================
// ROUTES
// ==================================================
app.get("/health", async (_req, res) => {
  let db = "ok";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = "error";
  }

  res.json({
    ok: true,
    time: new Date().toISOString(),
    db,
    radarEventCount: radarEvents.length,
  });
});

app.post("/register", async (req, res) => {
  try {
    const email = safeString(req.body.email).toLowerCase();
    const password = safeString(req.body.password);

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, passwordHash } });

    const token = signToken(user);
    res.json({ ok: true, token, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    res.status(500).json({ error: error.message || "Registration failed" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const email = safeString(req.body.email).toLowerCase();
    const password = safeString(req.body.password);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signToken(user);
    res.json({ ok: true, token, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({ error: error.message || "Login failed" });
  }
});

app.get("/billing/status", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        billingPlan: true,
        billingStatus: true,
        billingPeriodEnd: true,
        isActive: true,
        stripeCustomerId: true,
      },
    });

    return res.json({ ok: true, billing: user });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Billing status failed" });
  }
});

app.post("/billing/create-checkout-session", requireAuth, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: "Stripe not configured" });
    }

    const plan = safeString(req.body.plan).toLowerCase();

    const priceMap = {
      starter: STRIPE_PRICE_STARTER,
      core: STRIPE_PRICE_CORE,
      pro: STRIPE_PRICE_PRO,
    };

    const priceId = priceMap[plan];
    if (!priceId) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });

      customerId = customer.id;

      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${APP_URL}/billing?success=1`,
      cancel_url: `${APP_URL}/billing?canceled=1`,
      metadata: {
        userId: user.id,
        plan,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          plan,
        },
      },
    });

    return res.json({ ok: true, url: session.url });
  } catch (error) {
    console.error("CHECKOUT SESSION ERROR:", error);
    return res.status(500).json({ error: error.message || "Checkout session failed" });
  }
});

app.post("/billing/create-portal-session", requireAuth, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: "Stripe not configured" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!user?.stripeCustomerId) {
      return res.status(400).json({ error: "No Stripe customer found" });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${APP_URL}/billing`,
    });

    return res.json({ ok: true, url: session.url });
  } catch (error) {
    console.error("PORTAL SESSION ERROR:", error);
    return res.status(500).json({ error: error.message || "Portal session failed" });
  }
});

app.get("/events", (_req, res) => {
  res.json({ ok: true, events: radarEvents });
});

app.get("/test-sweep", (_req, res) => {
  const event = pushRadarEvent({
    pair: "SUI/USDT",
    timeframe: "3m",
    session: "New York",
    directionBias: "Short",
    eventType: "SWEEP_RECLAIM",
    sweepType: "High Sweep",
    emaContext: "EMA99 Rejection",
    reclaimConfirmed: true,
    botConfidence: 0.79,
    entry: 1.242,
    stop: 1.248,
    tp1: 1.233,
    tp2: 1.226,
    rr1: 1.5,
    rr2: 2.66,
    structure: "Range high liquidity clear",
    signalLevel: "L2",
  });

  res.json({ ok: true, event });
});

app.post("/sweep", (req, res) => {
  console.log("SWEEP BODY:", req.body);
  const event = pushRadarEvent(req.body || {});
  res.json({ ok: true, event });
});

// ==================================================
// PAID LOG ROUTES
// ==================================================
app.post("/logs", requireAuth, requireActiveSub, async (req, res) => {
  try {
    const trade = buildTradePayload(req.body);

    if (!trade.pair) {
      return res.status(400).json({ error: "pair is required" });
    }

    if (!trade.timeframe) {
      return res.status(400).json({ error: "timeframe is required" });
    }

    const linkedRadarEvent = findLinkedRadarEvent(trade);

    let aiAnalysis;
    let aiStatus = "fallback";

    if (shouldRunAI(trade, linkedRadarEvent)) {
      try {
        aiAnalysis = await analyzeTradeWithAI(trade, linkedRadarEvent);
        aiStatus = "success";
      } catch (error) {
        console.error("AI ANALYSIS ERROR:", error);
        aiAnalysis = computeFallbackAnalysis(trade, linkedRadarEvent);
      }
    } else {
      aiAnalysis = computeFallbackAnalysis(trade, linkedRadarEvent);
    }

    const log = await prisma.tradeLog.create({
      data: {
        userId: req.user.userId,
        pair: trade.pair,
        timeframe: trade.timeframe,
        session: trade.session,
        action: trade.action,
        pnl: trade.pnl,
        notes: trade.notes,
        leverage: trade.leverage,

        entry: trade.entry,
        stop: trade.stop,
        tp1: trade.tp1,
        tp2: trade.tp2,
        rr1: trade.rr1,
        rr2: trade.rr2,

        directionBias: trade.directionBias,
        eventType: trade.eventType,
        sweepType: trade.sweepType,
        emaContext: trade.emaContext,
        reclaimConfirmed: trade.reclaimConfirmed,
        planFollowed: trade.planFollowed,
        ruleBreak: trade.ruleBreak,

        executionType: trade.executionType,
        liquidityLevel: trade.liquidityLevel,
        htfBias: trade.htfBias,
        entryTrigger: trade.entryTrigger,
        outcome: trade.outcome,
        confidenceSelf: trade.confidenceSelf,
        durationMinutes: trade.durationMinutes,

        emotionalPressure: trade.emotionalPressure,
        setupQuality: trade.setupQuality,
        disciplineScore: trade.disciplineScore,
        linkedEventId: trade.linkedEventId,

        screenshotUrl: trade.screenshotUrl,

        aiScore: aiAnalysis.overallScore,
        aiGrade: aiAnalysis.overallGrade,
        aiSummary: aiAnalysis.summary,
        aiCoachingNote: aiAnalysis.coachingTip,
        aiStatus,
        setupScore: aiAnalysis.setupScore,
        executionScore: aiAnalysis.executionScore,
        managementScore: aiAnalysis.managementScore,
        disciplineScoreAi: aiAnalysis.disciplineScoreAi,
        aiConfidence: aiAnalysis.confidence,
        chartRead: aiAnalysis.chartRead,
        setupAssessment: aiAnalysis.setupAssessment,
        executionAssessment: aiAnalysis.executionAssessment,
        riskAssessment: aiAnalysis.riskAssessment,
        biasAlignment: aiAnalysis.biasAlignment,
        mistakeTags: aiAnalysis.mistakeTags,
        whatWasGood: aiAnalysis.whatWasGood,
        whatNeedsWork: aiAnalysis.whatNeedsWork,
        usedScreenshot: aiAnalysis.usedScreenshot,
        aiPayload: {
          ...aiAnalysis,
          aiStatus,
          linkedRadarEvent,
        },
      },
    });

    res.json({ ok: true, aiStatus, log, aiAnalysis });
  } catch (err) {
    console.error("LOG ERROR FULL:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/logs", requireAuth, requireActiveSub, async (req, res) => {
  try {
    const take =
      req.userPlan === "starter" ? 100 :
      req.userPlan === "core" ? 500 :
      2000;

    const logs = await prisma.tradeLog.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: "desc" },
      take,
    });

    res.json({ ok: true, logs });
  } catch (error) {
    console.error("GET LOGS ERROR:", error);
    res.status(500).json({ error: error.message || "Failed to fetch logs" });
  }
});

app.get("/stats/summary", requireAuth, requireActiveSub, async (req, res) => {
  try {
    const take =
      req.userPlan === "starter" ? 100 :
      req.userPlan === "core" ? 500 :
      2000;

    const logs = await prisma.tradeLog.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: "desc" },
      take,
    });

    const total = logs.length;
    const avgAiScore = total
      ? Math.round(logs.reduce((sum, log) => sum + (log.aiScore || 0), 0) / total)
      : 0;

    const mistakeCounts = {};
    const pairCounts = {};

    for (const log of logs) {
      const tags = Array.isArray(log.mistakeTags) ? log.mistakeTags : [];
      for (const tag of tags) {
        const key = String(tag);
        mistakeCounts[key] = (mistakeCounts[key] || 0) + 1;
      }
      if (log.pair) {
        pairCounts[log.pair] = (pairCounts[log.pair] || 0) + 1;
      }
    }

    const topMistakes = Object.entries(mistakeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count }));

    const topPairs = Object.entries(pairCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pair, count]) => ({ pair, count }));

    res.json({
      ok: true,
      totalLogs: total,
      avgAiScore,
      topMistakes,
      topPairs,
    });
  } catch (error) {
    console.error("SUMMARY ERROR:", error);
    res.status(500).json({ error: error.message || "Failed to build summary" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});