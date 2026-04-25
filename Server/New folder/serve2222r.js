require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const { analyzeScreenshot } = require("./ai/screenshotCoach");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

// ================= LIVE EVENT FEED =================
let liveEvents = [];

// ================= HELPERS =================
function signToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      isAdmin: !!user.isAdmin,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function normalizeEventPayload(body = {}) {
  return {
    id: body.id || `evt_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
    timestampUtc: body.timestampUtc || new Date().toISOString(),
    pair: body.pair || "UNKNOWN",
    timeframe: body.timeframe || "3m",
    session: body.session || "New York",
    directionBias: body.directionBias || "Short",
    eventType: body.eventType || "SWEEP_DETECTED",
    sweepType: body.sweepType || "High Sweep",
    emaContext: body.emaContext || "Liquidity Sweep",
    attemptTag: body.attemptTag || "First Sweep",
    botConfidence: Number(body.botConfidence || 0),
    reclaimConfirmed: Boolean(body.reclaimConfirmed),
    structure: body.structure || "",
    strengthScore:
      body.strengthScore === undefined || body.strengthScore === null
        ? 0
        : Number(body.strengthScore),
    volumeSpike:
      body.volumeSpike === undefined || body.volumeSpike === null
        ? null
        : Number(body.volumeSpike),
    entry:
      body.entry === undefined || body.entry === null || body.entry === ""
        ? null
        : Number(body.entry),
    stop:
      body.stop === undefined || body.stop === null || body.stop === ""
        ? null
        : Number(body.stop),
    tp1:
      body.tp1 === undefined || body.tp1 === null || body.tp1 === ""
        ? null
        : Number(body.tp1),
    tp2:
      body.tp2 === undefined || body.tp2 === null || body.tp2 === ""
        ? null
        : Number(body.tp2),
    rr1:
      body.rr1 === undefined || body.rr1 === null || body.rr1 === ""
        ? null
        : Number(body.rr1),
    rr2:
      body.rr2 === undefined || body.rr2 === null || body.rr2 === ""
        ? null
        : Number(body.rr2),
  };
}

function pushLiveEvent(evt) {
  liveEvents.unshift(evt);
  liveEvents = liveEvents.slice(0, 300);
  return evt;
}

// ================= AUTH MIDDLEWARE =================
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "No token" });

  const token = header.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Invalid token format" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      isAdmin: !!decoded.isAdmin,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ================= BASIC ROUTES =================
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    port: PORT,
    liveEventCount: liveEvents.length,
    timestampUtc: new Date().toISOString(),
  });
});

app.get("/events", (req, res) => {
  try {
    const safeEvents = JSON.parse(JSON.stringify(liveEvents));
    res.json(safeEvents);
  } catch (err) {
    console.error("GET /events error:", err);
    res.status(500).json({
      error: "Failed to load events",
      details: err.message,
    });
  }
});

app.post("/events", (req, res) => {
  try {
    const evt = normalizeEventPayload(req.body);
    pushLiveEvent(evt);

    console.log(
      "[EVENT RECEIVED]",
      evt.pair,
      evt.eventType,
      evt.directionBias,
      evt.timestampUtc
    );

    res.json({ ok: true, event: evt });
  } catch (err) {
    console.error("POST /events error:", err);
    res.status(500).json({
      error: "Failed to save event",
      details: err.message,
    });
  }
});

// compatibility alias in case bot posts to /sweep
app.post("/sweep", (req, res) => {
  try {
    const evt = normalizeEventPayload(req.body);
    pushLiveEvent(evt);

    console.log(
      "[SWEEP RECEIVED]",
      evt.pair,
      evt.eventType,
      evt.directionBias,
      evt.timestampUtc
    );

    res.json({ ok: true, event: evt });
  } catch (err) {
    console.error("POST /sweep error:", err);
    res.status(500).json({
      error: "Failed to save sweep event",
      details: err.message,
    });
  }
});

app.post("/test-event", (req, res) => {
  try {
    const evt = normalizeEventPayload({
      pair: "SUI/USDT",
      timeframe: "3m",
      session: "New York",
      directionBias: "Short",
      eventType: "SWEEP_CONFIRMED",
      sweepType: "High Sweep",
      emaContext: "EMA99 Rejection",
      botConfidence: 0.99,
      ...req.body,
    });

    pushLiveEvent(evt);

    console.log("[TEST EVENT]", evt.pair, evt.eventType, evt.timestampUtc);

    res.json({ ok: true, event: evt });
  } catch (err) {
    console.error("POST /test-event error:", err);
    res.status(500).json({
      error: "Failed to create test event",
      details: err.message,
    });
  }
});

app.delete("/events", (req, res) => {
  try {
    const count = liveEvents.length;
    liveEvents = [];
    res.json({ ok: true, cleared: count });
  } catch (err) {
    console.error("DELETE /events error:", err);
    res.status(500).json({
      error: "Failed to clear events",
      details: err.message,
    });
  }
});

// ================= SIMPLE AI (RULE ENGINE) =================
function analyzeTrade(body) {
  let score = 70;

  if (body.planFollowed === "No") score -= 20;
  if (body.ruleBreak && body.ruleBreak !== "None") score -= 15;
  if (
    body.emotionalPressure === "High" ||
    Number(body.emotionalPressure || 0) >= 8
  ) {
    score -= 10;
  }
  if (body.setupQuality === "A+" || Number(body.setupQuality || 0) >= 9) {
    score += 10;
  }

  score = Math.max(0, Math.min(100, score));

  let grade = "C";
  if (score >= 80) grade = "A";
  else if (score >= 65) grade = "B";

  return {
    aiScore: score,
    aiGrade: grade,
    aiClassification:
      score >= 80
        ? "Disciplined Execution"
        : score >= 65
        ? "Decent Execution"
        : "Needs Improvement",
    aiSummary: "Basic trade evaluation complete.",
    aiCoachingNote:
      score < 65
        ? "Focus on discipline and rule adherence."
        : "Maintain current execution quality.",
  };
}

// ================= LOG ROUTE =================
app.post("/logs", requireAuth, async (req, res) => {
  try {
    console.log("REQ USER:", req.user);
    console.log("LOG BODY:", req.body);

    if (!req.user?.userId) {
      return res.status(401).json({ error: "Missing userId" });
    }

    const userExists = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!userExists) {
      return res.status(401).json({
        error: "User not found in DB",
      });
    }

    const ai = analyzeTrade(req.body);

    const log = await prisma.tradeLog.create({
      data: {
        userId: req.user.userId,
        pair: req.body.pair || "UNKNOWN",
        timeframe: req.body.timeframe || "3m",
        action: req.body.action || "Taken",
        pnl: req.body.pnl ?? 0,

        notes: req.body.notes || "",
        leverage: req.body.leverage || 1,
        planFollowed: req.body.planFollowed || "Yes",
        ruleBreak: req.body.ruleBreak || "None",
        disciplineScore: req.body.disciplineScore || 5,
        setupQuality: req.body.setupQuality || "B",
        emotionalPressure: req.body.emotionalPressure || "Low",

        aiScore: ai.aiScore,
        aiGrade: ai.aiGrade,
        aiClassification: ai.aiClassification,
        aiSummary: ai.aiSummary,
        aiCoachingNote: ai.aiCoachingNote,
      },
    });

    console.log("SCREENSHOT FIELD:", req.body.screenshot);

    if (req.body.screenshot) {
      try {
        const shotAnalysis = await analyzeScreenshot({
          imageUrl: req.body.screenshot,
          trade: req.body,
        });

        console.log("AI Screenshot Analysis:", shotAnalysis);

        // Optional future save-back:
        // await prisma.tradeLog.update({
        //   where: { id: log.id },
        //   data: {
        //     aiSummary: shotAnalysis.coachSummary,
        //     aiCoachingNote: shotAnalysis.bestCorrection,
        //   },
        // });
      } catch (err) {
        console.error("Screenshot AI failed:", err.message);
      }
    }

    res.json({ ok: true, log });
  } catch (err) {
    console.error("LOG ERROR:", err);
    res.status(500).json({
      error: "Failed to save log",
      details: err.message,
    });
  }
});

// ================= AUTH HANDLERS =================
async function registerHandler(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { email, password: hash },
    });

    const token = signToken(user);

    res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        isAdmin: !!user.isAdmin,
      },
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({
      error: "Register failed",
      details: err.message,
    });
  }
}

async function loginHandler(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) return res.status(401).json({ error: "Invalid login" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid login" });

    const token = signToken(user);

    res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        isAdmin: !!user.isAdmin,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({
      error: "Login failed",
      details: err.message,
    });
  }
}

// ================= AUTH ROUTES =================
app.post("/auth/register", registerHandler);
app.post("/auth/login", loginHandler);

app.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        isAdmin: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error("AUTH ME ERROR:", err);
    res.status(500).json({
      error: "Failed to load user",
      details: err.message,
    });
  }
});

// compatibility aliases
app.post("/register", registerHandler);
app.post("/login", loginHandler);

// ================= START =================
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});