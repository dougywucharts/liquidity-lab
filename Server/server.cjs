require("dotenv").config();

import "dotenv/config";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const app = express();
const PORT = 5000;

const APP_URL = process.env.APP_URL || "http://localhost:5173";
const JWT_SECRET = process.env.JWT_SECRET || "change-me";

// 🔥 STRIPE WEBHOOK (MUST BE FIRST)
app.post("/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    events: events.length,
    stripe: !!process.env.STRIPE_SECRET_KEY,
    time: new Date().toISOString()
  });
}); 


  try {

    if (!stripe) {
      return res.status(500).json({ error: "Stripe not configured" });
    }



    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const userId = session.metadata?.userId;
      const customerId = session.customer;
      const subscriptionId = session.subscription;

      if (userId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);

        await prisma.user.update({
          where: { id: userId },
          data: {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            stripePriceId: sub.items.data[0].price.id,
            stripeStatus: sub.status,
          },
        });
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      await prisma.user.updateMany({
        where: { stripeCustomerId: invoice.customer },
        data: { stripeStatus: "past_due" },
      });
    }

    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object;
      await prisma.user.updateMany({
        where: { stripeCustomerId: invoice.customer },
        data: { stripeStatus: "active" },
      });
    }

    res.json({ received: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Webhook failed" });
  }
});

// NORMAL MIDDLEWARE
app.use(cors());
app.use(express.json());

// ---------------- AUTH ----------------

function signToken(user) {
  return jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
}

async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) return res.status(401).json({ error: "Invalid user" });

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  const hash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: hash,
      stripeStatus: "free",
    },
  });

  res.json({
    token: signToken(user),
    user,
  });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "Invalid" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid" });

  res.json({
    token: signToken(user),
    user,
  });
});

app.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
  });

  const active = ["active", "trialing"].includes(user.stripeStatus);

  res.json({
    user,
    features: {
      ai: active,
      export: active,
    },
  });
});

// ---------------- RADAR ----------------

const events = [];

app.get("/events", (req, res) => {
  res.json({ events });
});

app.get("/test-sweep", (req, res) => {
  const fake = {
    id: "test_" + Date.now(),
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
    tp2: 1.15
  };

  events.unshift(fake);

  res.json({ ok: true, fake });
});

app.post("/sweep", (req, res) => {
  events.unshift(req.body);
  res.json({ ok: true });
});

// ---------------- LOGS ----------------

app.post("/logs", requireAuth, async (req, res) => {
  const log = await prisma.tradeLog.create({
    data: {
      ...req.body,
      userId: req.user.id,
    },
  });

  res.json(log);
});

// ---------------- STRIPE ----------------

app.post("/stripe/create-checkout-session", requireAuth, async (req, res) => {
  const priceId = process.env.PRICE_PRO_MONTHLY;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: req.user.email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}/billing?success=1`,
    cancel_url: `${APP_URL}/billing`,
    metadata: {
      userId: req.user.id,
    },
  });


  const handleUpgrade = async () => {
    const res = await fetch("http://localhost:5000/stripe/create-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json();
    window.location.href = data.url;
  };

  res.json({ url: session.url });
});

app.listen(PORT, () => {
  console.log("Server running on 5000");
});