import 'dotenv/config'
import Anthropic from '@anthropic-ai/sdk'
import express from 'express'
import cors from 'cors'
import fetch from 'node-fetch'

const app = express() // MUST come before app.use

app.use(
  cors({
    origin: [
      'https://redoctobersystems.com',
      'https://www.redoctobersystems.com',
      'https://app.redoctobersystems.com'
    ],
    credentials: true
  })
)

app.post('/briefing', requireAuth, async (req, res) => {
  try {
    if (!anthropic || !ENABLE_AI)
      return res.status(503).json({ error: 'AI not enabled' })

    // Grab last 50 radar events
    const recentEvents = events.slice(0, 50)

    // Get user's Trader DNA if they have it
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    const dna = user?.traderDna || null

    // Get current UTC hour to determine session
    const utcHour = new Date().getUTCHours()
    const session =
      utcHour >= 8 && utcHour < 12
        ? 'New York Open'
        : utcHour >= 13 && utcHour < 17
        ? 'New York Midday'
        : utcHour >= 0 && utcHour < 6
        ? 'London'
        : 'Asia'

    // Summarize active pairs
    const pairSummary = {}
    recentEvents.forEach(evt => {
      const key = `${evt.pair}|${evt.directionBias}`
      if (!pairSummary[key])
        pairSummary[key] = {
          pair: evt.pair,
          direction: evt.directionBias,
          count: 0,
          sweepTypes: []
        }
      pairSummary[key].count++
      if (!pairSummary[key].sweepTypes.includes(evt.sweepType))
        pairSummary[key].sweepTypes.push(evt.sweepType)
    })
    const topPairs = Object.values(pairSummary)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    const prompt = `You are a trading session briefing assistant for a liquidity sweep trader.

Current session: ${session}
UTC time: ${new Date().toUTCString()}

TOP ACTIVE PAIRS (from live radar, last hour):
${topPairs
  .map(
    p =>
      `- ${p.pair} ${p.direction}: ${
        p.count
      } signals, types: ${p.sweepTypes.join(', ')}`
  )
  .join('\n')}

TRADER DNA (their personal profile):
${
  dna
    ? `
- Trader type: ${dna.traderType}
- Best session: ${dna.bestSession}
- Worst session: ${dna.worstSession}
- Best setup: ${dna.bestSetup}
- Worst setup: ${dna.worstSetup}
- Coaching focus: ${dna.coachingFocus}
- Win rate: ${
        dna.winRate != null ? (dna.winRate * 100).toFixed(0) + '%' : 'N/A'
      }
`
    : 'No Trader DNA available yet.'
}

Generate a pre-session briefing. Be direct, specific, and reference actual pairs and setups from the data above. No fluff.

Return ONLY a valid JSON object:
{
  "headline": "<one punchy sentence about today's market conditions>",
  "sessionContext": "<1-2 sentences about the current/upcoming session>",
  "topWatchlist": [
    { "pair": "<pair>", "direction": "<Long|Short>", "reason": "<why this pair is in play today>" }
  ],
  "dnaWarning": "<one sentence personal warning based on their DNA — what to avoid today>",
  "dnaTip": "<one sentence personal edge based on their DNA — what to lean into today>",
  "focusForSession": "<the single most important thing to do this session>"
}`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON returned')
    const briefing = JSON.parse(jsonMatch[0])

    res.json({
      ok: true,
      briefing,
      session,
      generatedAt: new Date().toISOString()
    })
  } catch (err) {
    console.error('Briefing error:', err)
    res.status(500).json({ error: 'Briefing generation failed' })
  }
})

app.get('/candles', async (req, res) => {
  try {
    const { pair = 'BTC/USDT', timeframe = '1m', limit = 300 } = req.query
    const symbol = pair.replace('/USDT', '').replace(':USDT', '') + '-USDT'
    const tf = timeframe
    const url = `https://openapi.blofin.com/api/v1/market/candles?instId=${symbol}&bar=${tf}&limit=${limit}`
    console.log('Candles URL:', url)

    const response = await fetch(url)
    const json = await response.json()
    console.log('Blofin response:', JSON.stringify(json).slice(0, 200))

    if (!json?.data?.length) return res.json({ candles: [], debug: json })

    const candles = json.data
      .map(c => ({
        time: Math.floor(Number(c[0]) / 1000),
        open: Number(c[1]),
        high: Number(c[2]),
        low: Number(c[3]),
        close: Number(c[4])
      }))
      .filter(c => c.open && c.high && c.low && c.close)
      .sort((a, b) => a.time - b.time)

    res.json({ candles })
  } catch (err) {
    console.error('Candles error:', err)
    res.status(500).json({ candles: [], error: err.message })
  }
})

// Stripe webhook needs raw body — must be before express.json()
app.use('/stripe/webhook', express.raw({ type: 'application/json' }))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import Stripe from 'stripe'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Resend } from 'resend'

// ---------------- PRISMA / STRIPE / EMAIL / CLAUDE ----------------
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

// Switched from OpenAI to Anthropic Claude
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

const ENABLE_AI = String(process.env.ENABLE_AI || '').toLowerCase() === 'true'
const AI_REVIEW_DAILY_LIMIT = Number(process.env.AI_REVIEW_DAILY_LIMIT || 5)

const ALERT_FROM_EMAIL =
  process.env.ALERT_FROM_EMAIL || 'alerts@redoctobersystems.com'
const ALERT_TO_EMAIL = process.env.ALERT_TO_EMAIL || ''

// ---------------- APP ----------------

const PORT = Number(process.env.PORT || 5000)
const APP_URL = process.env.APP_URL || 'http://localhost:5173'
const JWT_SECRET = process.env.JWT_SECRET || 'change-me'

// ---------------- HELPERS ----------------
function safe (v, fallback = '—') {
  return v === null || v === undefined || v === '' ? fallback : v
}

function parseNum (value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function signToken (user) {
  return jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: '7d'
  })
}

function canUseAiReview (user, limit = 5) {
  const now = new Date()
  if (!user.aiReviewReset || now > new Date(user.aiReviewReset)) {
    return { allowed: true, reset: true }
  }
  if ((user.aiReviewCount || 0) >= limit) {
    return { allowed: false }
  }
  return { allowed: true }
}

// ---------------- CLAUDE AI REVIEW ----------------
async function runAiTradeReview (payload) {
  if (!anthropic || !ENABLE_AI) {
    return {
      score: null,
      verdict: 'AI disabled',
      strengths: [],
      mistakes: [],
      coaching: 'AI review is currently disabled.',
      comparison: null
    }
  }

  // Build the content array — text + optional screenshot
  const contentBlocks = []

  // If screenshot was provided, add it as a vision block
  if (payload.screenshotBase64 && payload.screenshotMimeType) {
    contentBlocks.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: payload.screenshotMimeType || 'image/png',
        data: payload.screenshotBase64
      }
    })
  }

  // Build the trade context text
  const tradeContext = `
You are a strict professional liquidity-sweep trading coach reviewing a logged trade.
Analyze this trade and return a JSON object with your assessment.

TRADE DATA:
- Pair: ${payload.pair || '—'}
- Timeframe: ${payload.timeframe || '—'}
- Direction: ${payload.directionBias || '—'}
- Event Type: ${payload.eventType || '—'}
- Sweep Type: ${payload.sweepType || '—'}
- EMA Context: ${payload.emaContext || '—'}
- Session: ${payload.session || '—'}
- Entry: ${payload.entry || '—'}
- Stop: ${payload.stop || '—'}
- TP1: ${payload.tp1 || '—'} (${payload.rr1 ? payload.rr1 + 'R' : '—'})
- TP2: ${payload.tp2 || '—'} (${payload.rr2 ? payload.rr2 + 'R' : '—'})
- Exit: ${payload.exit || 'Still open'}
- Outcome: ${payload.outcome || 'Open'}
- PnL: ${payload.pnl || '—'}
- Action: ${payload.action || '—'}
- Timing: ${payload.timing || '—'}
- Plan Followed: ${payload.planFollowed || '—'}
- Rule Break: ${payload.ruleBreak || 'None'}
- Setup Quality (self): ${payload.setupQuality || '—'}/10
- Discipline (self): ${payload.disciplineScore || '—'}/10
- Emotional Pressure: ${payload.emotionalPressure || '—'}/10
- Confidence (self): ${payload.confidenceSelf || '—'}/10
- Notes: ${payload.notes || 'None'}

${
  payload.screenshotBase64
    ? 'A chart screenshot has been provided above. Reference what you see in the chart in your review.'
    : ''
}

USER STATS (their history):
- Win Rate: ${payload.userStats?.winRate || '—'}
- Fail Rate: ${payload.userStats?.failRate || '—'}

COACHING RULES:
- Strategy: Liquidity sweep trading (equal highs/lows, EMA99 rejections, reclaim entries)
- Be direct and specific — no generic feedback
- Reference the actual trade data in your response
- If a screenshot is provided, describe what you see and whether it matches the trade data
- Grade harshly — most trades are B or lower

Return ONLY a valid JSON object with this exact shape:
{
  "overallScore": <number 0-100>,
  "overallGrade": <"A+" | "A" | "B+" | "B" | "C" | "D" | "F">,
  "setupScore": <number 0-25>,
  "executionScore": <number 0-25>,
  "managementScore": <number 0-20>,
  "disciplineScoreAi": <number 0-15>,
  "verdict": "<one sentence direct verdict>",
  "executionAssessment": "<DISCIPLINED | MIXED | RULE BREAK>",
  "strengths": ["<specific strength 1>", "<specific strength 2>"],
  "mistakes": ["<specific mistake 1>", "<specific mistake 2>"],
  "coaching": "<specific correction for next trade — reference the actual setup>",
  "scoreNotes": "<brief explanation of score>",
  "chartRead": "<what you see in the chart if screenshot provided, else null>",
  "comparison": "<compare their stats vs typical trader if stats provided>"
}
`

  contentBlocks.push({
    type: 'text',
    text: tradeContext
  })

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: contentBlocks
      }
    ]
  })

  // Parse response — Claude returns text, extract JSON
  const rawText = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')

  // Strip markdown code fences if present
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Claude returned no JSON')
  }

  const parsed = JSON.parse(jsonMatch[0])

  return {
    // Map to the shape the frontend expects
    score: parsed.overallScore ?? null,
    overallScore: parsed.overallScore ?? null,
    overallGrade: parsed.overallGrade ?? null,
    grade: parsed.overallGrade ?? null,
    verdict: parsed.verdict ?? 'No verdict',
    executionAssessment: parsed.executionAssessment ?? 'MIXED',
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    mistakes: Array.isArray(parsed.mistakes) ? parsed.mistakes : [],
    coaching: parsed.coaching ?? 'No coaching returned.',
    coachingTip: parsed.coaching ?? 'No coaching returned.',
    scoreNotes: parsed.scoreNotes ?? '',
    chartRead: parsed.chartRead ?? null,
    comparison: parsed.comparison ?? null,
    setupScore: parsed.setupScore ?? null,
    executionScore: parsed.executionScore ?? null,
    managementScore: parsed.managementScore ?? null,
    disciplineScoreAi: parsed.disciplineScoreAi ?? null
  }
}

// ---------------- TRADER DNA ----------------
function computeTraderStats (logs) {
  // Only count trades with a real, decided outcome — exclude Open/Pending/empty
  const closed = logs.filter(log => {
    const o = String(log.outcome || '')
      .toLowerCase()
      .trim()
    return o && o !== 'open' && o !== 'pending'
  })

  const wins = closed.filter(log => {
    const o = String(log.outcome || '').toLowerCase()
    return o.includes('win') || o.includes('tp')
  })

  const losses = closed.filter(log => {
    const o = String(log.outcome || '').toLowerCase()
    return o.includes('loss')
  })

  const decidedCount = wins.length + losses.length
  const winRate = decidedCount > 0 ? wins.length / decidedCount : null

  const rrValues = closed
    .map(log => Number(log.realizedRR))
    .filter(n => Number.isFinite(n))
  const avgRR =
    rrValues.length > 0
      ? rrValues.reduce((a, b) => a + b, 0) / rrValues.length
      : null

  return {
    winRate,
    avgRR,
    closedCount: closed.length,
    openCount: logs.length - closed.length,
    winsCount: wins.length,
    lossesCount: losses.length
  }
}

async function runTraderDna (logs) {
  if (!anthropic || !ENABLE_AI) {
    return { error: 'AI disabled' }
  }

  // Compute real stats in code — never let the model invent these
  const stats = computeTraderStats(logs)

  // Summarize logs for the prompt — send condensed version to save tokens
  const logSummaries = logs.slice(0, 50).map((log, i) => ({
    n: i + 1,
    pair: log.pair,
    direction: log.directionBias,
    session: log.session,
    sweepType: log.sweepType,
    emaContext: log.emaContext,
    outcome: log.outcome,
    realizedRR: log.realizedRR,
    pnl: log.pnl,
    disciplineScore: log.disciplineScore,
    setupQuality: log.setupQuality,
    emotionalPressure: log.emotionalPressure,
    timing: log.timing,
    planFollowed: log.planFollowed,
    ruleBreak: log.ruleBreak,
    aiGrade: log.aiGrade,
    aiScore: log.aiScore,
    notes: log.notes ? log.notes.slice(0, 100) : ''
  }))

  const prompt = `
You are analyzing a trader's complete trade history to generate their "Trader DNA" profile.
This is a personalized psychological and performance analysis based on their actual logged trades.

PRE-CALCULATED STATS (these are ground truth — use them exactly, do not recalculate or estimate your own win rate or RR):
- Total trades logged: ${logs.length}
- Closed/decided trades: ${stats.closedCount} (wins: ${
    stats.winsCount
  }, losses: ${stats.lossesCount})
- Still open/undecided: ${stats.openCount}
- Win rate (closed trades only): ${
    stats.winRate != null
      ? (stats.winRate * 100).toFixed(1) + '%'
      : 'N/A — not enough closed trades'
  }
- Average realized RR (closed trades only): ${
    stats.avgRR != null ? stats.avgRR.toFixed(2) : 'N/A'
  }

TRADE HISTORY (${logs.length} trades):
${JSON.stringify(logSummaries, null, 2)}

Generate a comprehensive Trader DNA profile. Be specific — reference actual patterns you see in the data.
Don't make up patterns that aren't in the data.

Return ONLY a valid JSON object:
{
  "strengths": ["<specific strength based on data>", ...],
  "weaknesses": ["<specific weakness based on data>", ...],
  "bestSession": "<session name and win rate or avg RR>",
  "worstSession": "<session name and why>",
  "bestSetup": "<setup type and performance>",
  "worstSetup": "<setup type and why it struggles>",
  "patternBias": "<any directional or psychological bias observed>",
  "coachingFocus": "<the single most impactful thing to improve right now>",
  "overallAssessment": "<2-3 sentence honest summary of this trader>",
  "traderType": "<a short label like 'Disciplined Momentum Trader' or 'Impatient Scalper'>",
  "totalTrades": <number>,
  "bestStreakType": "<Win or Loss>",
  "riskDisciplineScore": <number 0-100>
}
`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }]
  })

  const rawText = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')

  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Claude returned no JSON for Trader DNA')

  const parsed = JSON.parse(jsonMatch[0])

  // Override with code-computed stats — never trust the model's math
  return {
    ...parsed,
    winRate: stats.winRate,
    avgRR: stats.avgRR,
    totalTrades: logs.length,
    closedTrades: stats.closedCount,
    openTrades: stats.openCount
  }
}

function getBearerToken (req) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return ''
  return auth.slice(7).trim()
}

async function requireAuth (req, res, next) {
  try {
    const token = getBearerToken(req)
    if (!token) return res.status(401).json({ error: 'Missing auth token' })
    const decoded = jwt.verify(token, JWT_SECRET)
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } })
    if (!user) return res.status(401).json({ error: 'Invalid user' })
    req.user = user
    next()
  } catch (err) {
    console.error('Auth error:', err?.message || err)
    return res.status(401).json({ error: 'Unauthorized' })
  }
}

function getGrade (score) {
  if (score >= 95) return 'A+'
  if (score >= 90) return 'A'
  if (score >= 85) return 'B+'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

function buildTradeScorecard (trade) {
  let setupScore = 15
  let entryScore = 20
  let riskScore = 20
  let disciplineScore = 15
  let emotionScore = 15
  const notes = []

  const entry = Number(trade.entry || trade.entryPrice || 0)
  const stop = Number(trade.stop || trade.stopLoss || 0)
  const tp1 = Number(trade.tp1 || trade.takeProfit || 0)

  if (!stop) {
    riskScore -= 15
    notes.push('No stop loss defined.')
  }

  if (entry && stop && tp1) {
    const risk = Math.abs(entry - stop)
    const reward = Math.abs(tp1 - entry)
    const rr = risk > 0 ? reward / risk : 0
    if (rr < 1.5) {
      riskScore -= 8
      notes.push('Risk/reward was weak.')
    } else if (rr >= 2) {
      riskScore += 5
      notes.push('Risk/reward was strong.')
    }
  }

  const text = `${trade.notes || ''} ${trade.reason || ''} ${
    trade.setup || ''
  }`.toLowerCase()

  if (
    text.includes('fomo') ||
    text.includes('chase') ||
    text.includes('chased')
  ) {
    entryScore -= 10
    emotionScore -= 5
    notes.push('Possible chase/FOMO entry.')
  }
  if (text.includes('early') || text.includes('before confirmation')) {
    entryScore -= 10
    disciplineScore -= 5
    notes.push('Entered before confirmation.')
  }
  if (text.includes('revenge')) {
    emotionScore -= 10
    notes.push('Possible revenge trade.')
  }
  if (text.includes('sweep')) setupScore += 5
  if (text.includes('rejection')) setupScore += 3
  if (text.includes('breakdown') || text.includes('bos')) entryScore += 5
  if (text.includes('followed plan')) disciplineScore += 5

  setupScore = Math.max(0, Math.min(25, setupScore))
  entryScore = Math.max(0, Math.min(25, entryScore))
  riskScore = Math.max(0, Math.min(20, riskScore))
  disciplineScore = Math.max(0, Math.min(15, disciplineScore))
  emotionScore = Math.max(0, Math.min(15, emotionScore))

  const tradeScore =
    setupScore + entryScore + riskScore + disciplineScore + emotionScore

  return {
    tradeScore,
    aiScore: tradeScore,
    setupScore,
    executionScore: entryScore,
    managementScore: riskScore,
    disciplineScoreAi: disciplineScore,
    aiGrade: getGrade(tradeScore),
    scoreNotes: notes.join(' ') || 'No major issues detected.'
  }
}

function getTradeGrade (item) {
  if (
    item.action === 'Taken' &&
    item.timing === 'On Confirmation' &&
    item.planFollowed === 'Yes' &&
    item.ruleBreak === 'None'
  ) {
    return 'DISCIPLINED'
  }
  if (
    item.timing === 'Early' ||
    item.timing === 'Chase Entry' ||
    item.planFollowed === 'No' ||
    item.ruleBreak !== 'None'
  ) {
    return 'RULE BREAK'
  }
  return 'MIXED'
}

function analyzeTrade (payload) {
  const setupQuality = parseNum(payload.setupQuality, 0)
  const disciplineScore = parseNum(payload.disciplineScore, 0)
  const emotionalPressure = parseNum(payload.emotionalPressure, 0)
  const hasRuleBreak = payload.ruleBreak && payload.ruleBreak !== 'None'

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
  )

  const overallGrade = overallScore >= 88 ? 'A' : overallScore >= 76 ? 'B' : 'C'

  const whatWasGood = []
  if (payload.planFollowed === 'Yes')
    whatWasGood.push('Followed the trade plan')
  if (payload.timing === 'On Confirmation')
    whatWasGood.push('Waited for confirmation')
  if (setupQuality >= 8) whatWasGood.push('High-quality setup')

  const whatNeedsWork = []
  if (hasRuleBreak) whatNeedsWork.push(payload.ruleBreak)
  if (payload.timing === 'Early' || payload.timing === 'Chase Entry')
    whatNeedsWork.push('Entry timing')
  if (emotionalPressure >= 7) whatNeedsWork.push('Emotional control')

  return {
    overallScore,
    overallGrade,
    summary:
      payload.action === 'Taken'
        ? `Trade logged for ${payload.pair}. Review weighted setup quality, discipline, and rule adherence.`
        : `Decision logged for ${payload.pair}. Review focused on whether the pass aligned with the plan.`,
    coachingTip: hasRuleBreak
      ? `Main issue: ${payload.ruleBreak}. Tighten execution and wait for confirmation.`
      : 'Execution looked controlled. Keep matching entries to structure and confirmation.',
    setupScore: setupQuality,
    executionScore: disciplineScore,
    managementScore: Math.max(1, 10 - emotionalPressure),
    chartRead: payload.screenshotUrl
      ? 'Screenshot attached for chart context.'
      : 'No screenshot attached.',
    setupAssessment: setupQuality >= 8 ? 'Strong setup' : 'Average setup',
    executionAssessment: getTradeGrade(payload),
    riskAssessment: hasRuleBreak
      ? 'Rule break present'
      : 'Risk rules respected',
    biasAlignment: payload.htfBias || 'Unknown',
    mistakeTags: hasRuleBreak ? [payload.ruleBreak] : [],
    whatWasGood,
    whatNeedsWork,
    usedScreenshot: Boolean(payload.screenshotUrl)
  }
}

function canUseScreenshot (user, limit = 5) {
  const now = new Date()
  if (!user.screenshotReset || now > new Date(user.screenshotReset)) {
    return { allowed: true, reset: true }
  }
  if ((user.screenshotCount || 0) >= limit) {
    return { allowed: false }
  }
  return { allowed: true }
}

async function sendSweepAlertEmail (payload) {
  if (!resend || !ALERT_FROM_EMAIL || !ALERT_TO_EMAIL) {
    console.warn('[EMAIL] Missing Resend config. Skipping sweep email.')
    return
  }
  const subject = `${safe(payload.pair)} — ${safe(payload.eventType)} — ${safe(
    payload.directionBias
  )}`
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;">
      <h2 style="margin-bottom:8px;">Liquidity Lab Alert</h2>
      <p style="margin-top:0;">${safe(payload.pair)} • ${safe(
    payload.timeframe
  )} • ${safe(payload.directionBias)}</p>
      <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#ddd;">
        <tr><td><strong>Event</strong></td><td>${safe(
          payload.eventType
        )}</td></tr>
        <tr><td><strong>Sweep Type</strong></td><td>${safe(
          payload.sweepType
        )}</td></tr>
        <tr><td><strong>Confidence</strong></td><td>${safe(
          payload.botConfidence
        )}</td></tr>
        <tr><td><strong>Entry</strong></td><td>${safe(payload.entry)}</td></tr>
        <tr><td><strong>Stop</strong></td><td>${safe(payload.stop)}</td></tr>
        <tr><td><strong>TP1</strong></td><td>${safe(payload.tp1)}</td></tr>
        <tr><td><strong>TP2</strong></td><td>${safe(payload.tp2)}</td></tr>
        <tr><td><strong>RR1</strong></td><td>${safe(payload.rr1)}</td></tr>
        <tr><td><strong>RR2</strong></td><td>${safe(payload.rr2)}</td></tr>
        <tr><td><strong>Session</strong></td><td>${safe(
          payload.session
        )}</td></tr>
        <tr><td><strong>Time</strong></td><td>${safe(
          payload.timestampUtc
        )}</td></tr>
      </table>
    </div>
  `
  await resend.emails.send({
    from: ALERT_FROM_EMAIL,
    to: ALERT_TO_EMAIL,
    subject,
    html
  })
  console.log('[EMAIL] Sweep alert sent:', subject)
}

async function sendTradeReviewEmail (log) {
  if (!resend || !ALERT_FROM_EMAIL || !ALERT_TO_EMAIL) {
    console.warn('[EMAIL] Missing Resend config. Skipping trade review email.')
    return
  }
  const subject = `Trade Review — ${safe(log.pair)} — ${safe(log.outcome)}`
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;">
      <h2>Liquidity Lab Trade Review</h2>
      <p>${safe(log.pair)} • ${safe(log.timeframe)} • ${safe(
    log.directionBias
  )}</p>
      <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#ddd;">
        <tr><td><strong>Outcome</strong></td><td>${safe(log.outcome)}</td></tr>
        <tr><td><strong>PnL</strong></td><td>${safe(log.pnl)}</td></tr>
        <tr><td><strong>RR1</strong></td><td>${safe(log.rr1)}</td></tr>
        <tr><td><strong>RR2</strong></td><td>${safe(log.rr2)}</td></tr>
        <tr><td><strong>Realized RR</strong></td><td>${safe(
          log.realizedRR
        )}</td></tr>
        <tr><td><strong>AI Summary</strong></td><td>${safe(
          log.aiSummary
        )}</td></tr>
        <tr><td><strong>Coaching</strong></td><td>${safe(
          log.aiCoachingNote
        )}</td></tr>
      </table>
      <p><strong>Notes:</strong> ${safe(log.notes)}</p>
    </div>
  `
  await resend.emails.send({
    from: ALERT_FROM_EMAIL,
    to: ALERT_TO_EMAIL,
    subject,
    html
  })
  console.log('[EMAIL] Trade review sent:', subject)
}

async function getOrCreateStripeCustomer (user) {
  if (!stripe) throw new Error('Stripe not configured')
  if (user.stripeCustomerId) return user.stripeCustomerId
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { userId: user.id }
  })
  await prisma.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id }
  })
  return customer.id
}

function resolveBillingPlanFromPriceId (priceId) {
  const normalized = String(priceId || '')
  const starterIds = [
    process.env.STRIPE_PRICE_STARTER,
    process.env.PRICE_STARTER
  ].filter(Boolean)
  const coreIds = [
    process.env.STRIPE_PRICE_CORE,
    process.env.PRICE_CORE
  ].filter(Boolean)
  const proIds = [
    process.env.STRIPE_PRICE_PRO,
    process.env.PRICE_PRO,
    process.env.PRICE_PRO_MONTHLY
  ].filter(Boolean)
  const yearlyIds = [
    process.env.STRIPE_PRICE_PRO_YEARLY,
    process.env.PRICE_PRO_YEARLY
  ].filter(Boolean)
  if (starterIds.includes(normalized)) return 'starter'
  if (coreIds.includes(normalized)) return 'core'
  if (proIds.includes(normalized)) return 'pro'
  if (yearlyIds.includes(normalized)) return 'pro'
  return 'starter'
}

function resolveCheckoutPriceId (plan) {
  const normalized = String(plan || '').toLowerCase()
  const map = {
    starter:
      process.env.STRIPE_PRICE_STARTER || process.env.PRICE_STARTER || '',
    core: process.env.STRIPE_PRICE_CORE || process.env.PRICE_CORE || '',
    pro:
      process.env.STRIPE_PRICE_PRO ||
      process.env.PRICE_PRO ||
      process.env.PRICE_PRO_MONTHLY ||
      '',
    pro_yearly:
      process.env.STRIPE_PRICE_PRO_YEARLY || process.env.PRICE_PRO_YEARLY || '',
    yearly:
      process.env.STRIPE_PRICE_PRO_YEARLY || process.env.PRICE_PRO_YEARLY || '',
    monthly:
      process.env.STRIPE_PRICE_PRO ||
      process.env.PRICE_PRO ||
      process.env.PRICE_PRO_MONTHLY ||
      ''
  }
  return map[normalized] || ''
}

async function getLatestActiveSubscriptionForCustomer (customerId) {
  if (!stripe || !customerId) return null
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 20
  })
  const activeSubs = subs.data
    .filter(sub =>
      ['active', 'trialing', 'past_due', 'incomplete'].includes(sub.status)
    )
    .sort((a, b) => b.created - a.created)
  return activeSubs[0] || null
}

// ---------------- RADAR INGEST ----------------
const events = []
const MAX_EVENTS = 200

// Simple in-memory rate limiter for /sweep — no extra packages needed
// Allows 60 requests per minute per IP, then blocks for 60 seconds
const sweepRateLimiter = new Map()
const SWEEP_RATE_LIMIT = 60 // max requests per window
const SWEEP_RATE_WINDOW = 60000 // 1 minute window in ms
const SWEEP_BLOCK_DURATION = 60000 // block for 1 minute after limit hit

function checkSweepRateLimit (ip) {
  const now = Date.now()
  const record = sweepRateLimiter.get(ip)

  if (!record) {
    sweepRateLimiter.set(ip, { count: 1, windowStart: now, blocked: false })
    return { allowed: true }
  }

  // Still blocked
  if (record.blocked) {
    if (now - record.blockedAt < SWEEP_BLOCK_DURATION) {
      return {
        allowed: false,
        retryAfter: Math.ceil(
          (SWEEP_BLOCK_DURATION - (now - record.blockedAt)) / 1000
        )
      }
    }
    // Block expired — reset
    sweepRateLimiter.set(ip, { count: 1, windowStart: now, blocked: false })
    return { allowed: true }
  }

  // New window
  if (now - record.windowStart > SWEEP_RATE_WINDOW) {
    sweepRateLimiter.set(ip, { count: 1, windowStart: now, blocked: false })
    return { allowed: true }
  }

  // Within window
  record.count++
  if (record.count > SWEEP_RATE_LIMIT) {
    record.blocked = true
    record.blockedAt = now
    console.warn(
      `[RATE LIMIT] /sweep blocked IP: ${ip} after ${record.count} requests`
    )
    return { allowed: false, retryAfter: 60 }
  }

  return { allowed: true, remaining: SWEEP_RATE_LIMIT - record.count }
}

// Clean up old rate limit records every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now()
  for (const [ip, record] of sweepRateLimiter.entries()) {
    if (now - record.windowStart > SWEEP_RATE_WINDOW * 2) {
      sweepRateLimiter.delete(ip)
    }
  }
}, 5 * 60 * 1000)

// Global AI rate limiter — IP based, prevents account farming abuse
// Max 20 AI calls per IP per hour regardless of how many accounts they make
const aiRateLimiter = new Map()
const AI_GLOBAL_LIMIT = 20 // max AI calls per IP per hour
const AI_GLOBAL_WINDOW = 3600000 // 1 hour in ms

function checkAiRateLimit (ip) {
  const now = Date.now()
  const record = aiRateLimiter.get(ip)

  if (!record) {
    aiRateLimiter.set(ip, { count: 1, windowStart: now })
    return { allowed: true, remaining: AI_GLOBAL_LIMIT - 1 }
  }

  // New window — reset
  if (now - record.windowStart > AI_GLOBAL_WINDOW) {
    aiRateLimiter.set(ip, { count: 1, windowStart: now })
    return { allowed: true, remaining: AI_GLOBAL_LIMIT - 1 }
  }

  record.count++
  if (record.count > AI_GLOBAL_LIMIT) {
    const retryAfter = Math.ceil(
      (AI_GLOBAL_WINDOW - (now - record.windowStart)) / 60000
    )
    console.warn(
      `[AI RATE LIMIT] IP ${ip} hit global AI limit (${record.count} calls this hour)`
    )
    return {
      allowed: false,
      retryAfter,
      message: `AI review limit reached. Try again in ${retryAfter} minutes.`
    }
  }

  return { allowed: true, remaining: AI_GLOBAL_LIMIT - record.count }
}

// Also limit Trader DNA — max 3 per IP per hour (expensive call)
const dnaRateLimiter = new Map()
const DNA_GLOBAL_LIMIT = 3
const DNA_GLOBAL_WINDOW = 3600000

function checkDnaRateLimit (ip) {
  const now = Date.now()
  const record = dnaRateLimiter.get(ip)
  if (!record) {
    dnaRateLimiter.set(ip, { count: 1, windowStart: now })
    return { allowed: true }
  }
  if (now - record.windowStart > DNA_GLOBAL_WINDOW) {
    dnaRateLimiter.set(ip, { count: 1, windowStart: now })
    return { allowed: true }
  }
  record.count++
  if (record.count > DNA_GLOBAL_LIMIT) {
    return {
      allowed: false,
      message: 'Trader DNA limit reached. Max 3 generations per hour.'
    }
  }
  return { allowed: true }
}

// Clean up old AI rate limit records every 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [ip, record] of aiRateLimiter.entries()) {
    if (now - record.windowStart > AI_GLOBAL_WINDOW * 2)
      aiRateLimiter.delete(ip)
  }
  for (const [ip, record] of dnaRateLimiter.entries()) {
    if (now - record.windowStart > DNA_GLOBAL_WINDOW * 2)
      dnaRateLimiter.delete(ip)
  }
}, 10 * 60 * 1000)

// Load recent radar events from DB on startup so feed survives server restarts
async function loadRadarEventsFromDb () {
  try {
    const rows = await prisma.radarEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: MAX_EVENTS
    })
    // rows are newest first — add to events array in order
    for (const row of rows.reverse()) {
      events.unshift(row.payload)
    }
    console.log(`[RADAR] Loaded ${rows.length} events from DB`)
  } catch (err) {
    console.error('[RADAR] Failed to load events from DB:', err.message)
  }
}

loadRadarEventsFromDb()

app.post('/sweep', async (req, res) => {
  // SWEEP_SECRET_KEY is REQUIRED on all /sweep posts — no unauthenticated access
  // Any POST without the correct key is rejected immediately
  const sweepKey = req.headers['x-sweep-key'] || ''
  const validSweepKey = process.env.SWEEP_SECRET_KEY || ''

  if (!validSweepKey) {
    // SWEEP_SECRET_KEY not configured — log warning but allow through in dev
    console.warn(
      '[SWEEP] WARNING: SWEEP_SECRET_KEY not set in environment — endpoint is unprotected!'
    )
  } else if (sweepKey !== validSweepKey) {
    console.warn(
      `[SWEEP] Rejected unauthorized POST — invalid or missing X-Sweep-Key`
    )
    return res.status(401).json({ error: 'Unauthorized — invalid sweep key' })
  }

  // Rate limit as secondary check (valid key still rate limited to catch misconfigured bots)
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown'
  const rateCheck = checkSweepRateLimit(ip)
  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: rateCheck.retryAfter,
      message: `Too many requests. Try again in ${rateCheck.retryAfter} seconds.`
    })
  }

  const event = req.body || {}
  const pair =
    event.pair ||
    event.symbol ||
    event.market ||
    event.instId ||
    event.instrument
  if (!pair) {
    console.log('[SWEEP BAD PAYLOAD]', event)
    return res.status(400).json({ error: 'Missing pair', received: event })
  }
  const saved = {
    id: event.id || `local_${Date.now()}`,
    timestampUtc:
      event.timestampUtc ||
      event.timestamp ||
      event.time ||
      new Date().toISOString(),
    ...event,
    pair
  }

  // Persist to DB so events survive server restarts
  // chartCandles excluded from DB to keep payload size manageable
  try {
    const { chartCandles, ...payloadForDb } = saved
    await prisma.radarEvent.create({
      data: {
        pair: saved.pair || '',
        timeframe: saved.timeframe || null,
        eventType: saved.eventType || null,
        directionBias: saved.directionBias || null,
        sweepType: saved.sweepType || null,
        session: saved.session || null,
        timestampUtc: saved.timestampUtc || null,
        entry: saved.entry != null ? Number(saved.entry) : null,
        stop: saved.stop != null ? Number(saved.stop) : null,
        tp1: saved.tp1 != null ? Number(saved.tp1) : null,
        tp2: saved.tp2 != null ? Number(saved.tp2) : null,
        rr1: saved.rr1 != null ? Number(saved.rr1) : null,
        rr2: saved.rr2 != null ? Number(saved.rr2) : null,
        botConfidence:
          saved.botConfidence != null ? Number(saved.botConfidence) : null,
        tradeState: saved.tradeState || null,
        pattern: saved.pattern || null,
        payload: payloadForDb
      }
    })

    // Trim old DB records — keep last 500
    const count = await prisma.radarEvent.count()
    if (count > 500) {
      const oldest = await prisma.radarEvent.findMany({
        orderBy: { createdAt: 'asc' },
        take: count - 500,
        select: { id: true }
      })
      await prisma.radarEvent.deleteMany({
        where: { id: { in: oldest.map(r => r.id) } }
      })
    }
  } catch (err) {
    console.error('[RADAR] Failed to persist event:', err.message)
    // Don't fail the request — memory store still works
  }

  events.unshift(saved)
  if (events.length > MAX_EVENTS) events.pop()
  console.log('[SWEEP RECEIVED]', saved.pair, saved.eventType || 'UNKNOWN')
  res.json({ ok: true, event: saved })
})

// ---------------- AUTH ----------------
const BETA_ACCESS_CODE = process.env.BETA_ACCESS_CODE || ''
const BETA_FULL_ACCESS =
  String(process.env.BETA_FULL_ACCESS || '').toLowerCase() === 'true'

app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, betaCode } = req.body || {}
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required.' })
    const REQUIRE_BETA_CODE = false
    if (REQUIRE_BETA_CODE && (!betaCode || betaCode !== BETA_ACCESS_CODE)) {
      return res.status(403).json({ error: 'Invalid beta access code.' })
    }
    const existingUser = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase().trim() }
    })
    if (existingUser)
      return res.status(409).json({ error: 'User already exists.' })
    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        email: String(email).toLowerCase().trim(),
        passwordHash,
        billingPlan: BETA_FULL_ACCESS ? 'pro_beta' : 'starter',
        stripeStatus: BETA_FULL_ACCESS ? 'beta' : '',
        isBetaUser: true,
        betaGrantedAt: new Date()
      }
    })
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '7d'
    })

    // Send welcome email

    console.log('[EMAIL] Attempting welcome email to:', user.email)

    if (resend && ALERT_FROM_EMAIL) {
      resend.emails
        .send({
          from: ALERT_FROM_EMAIL,
          to: user.email,
          subject: "Welcome to Liquidity Lab — You're in.",
          html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#03060b;color:#f4f7fb;padding:40px 32px;border-radius:16px;">
        <div style="font-size:22px;font-weight:900;margin-bottom:8px;">Liquidity Lab</div>
        <div style="font-size:12px;color:#ef4444;letter-spacing:2px;text-transform:uppercase;margin-bottom:32px;">Red October Systems</div>
        <h1 style="font-size:28px;font-weight:900;margin:0 0 16px;">You're in.</h1>
        <p style="color:rgba(244,247,251,0.7);line-height:1.6;margin-bottom:24px;">Your free account is ready. The radar is live and scanning 50+ pairs right now.</p>
        <a href="https://app.redoctobersystems.com" style="display:inline-block;padding:14px 28px;background:#ef4444;color:#fff;font-weight:900;text-decoration:none;border-radius:10px;margin-bottom:32px;">Open Liquidity Lab →</a>
        <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:24px 0;">
        <p style="font-size:13px;color:rgba(244,247,251,0.4);line-height:1.6;">
          <strong style="color:rgba(244,247,251,0.7);">What's included free:</strong><br>
          Live radar feed · Manual trade journal · 50 log entries · Session clocks
        </p>
        <p style="font-size:13px;color:rgba(244,247,251,0.4);line-height:1.6;margin-top:16px;">
          Upgrade to Core ($29/mo) for AI trade reviews, screenshot coaching, and Members Vault.<br>
          <a href="https://app.redoctobersystems.com/billing" style="color:#ef4444;">View plans →</a>
        </p>
        <p style="font-size:11px;color:rgba(244,247,251,0.25);margin-top:32px;">Red October Systems · support@redoctobersystems.com</p>
      </div>
    `
        })
        .catch(err =>
          console.error('[EMAIL] Welcome email failed:', err.message)
        )
    }

    return res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        billingPlan: user.billingPlan,
        stripeStatus: user.stripeStatus,
        isBetaUser: user.isBetaUser,
        featureFlags: {
          manualJournal: true,
          aiReview: BETA_FULL_ACCESS,
          screenshotReview: BETA_FULL_ACCESS,
          export: BETA_FULL_ACCESS,
          deeperStats: BETA_FULL_ACCESS
        }
      }
    })
  } catch (err) {
    console.error('[REGISTER ERROR]', err)
    return res.status(500).json({ error: 'Registration failed.' })
  }
})

app.post('/login', async (req, res) => {
  try {
    const email = String(req.body.email || '')
      .trim()
      .toLowerCase()
    const password = String(req.body.password || '')
    if (!email || !password)
      return res.status(400).json({ error: 'Missing credentials' })
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })
    if (!user.passwordHash) {
      console.error('User missing passwordHash:', user.email)
      return res.status(500).json({ error: 'User not initialized properly' })
    }
    let valid = false
    try {
      valid = await bcrypt.compare(password, user.passwordHash)
    } catch (err) {
      console.error('bcrypt crash:', err)
      return res.status(500).json({ error: 'Auth failure' })
    }
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })
    return res.json({
      token: signToken(user),
      user: {
        id: user.id,
        email: user.email,
        billingPlan: user.billingPlan || 'starter',
        stripeStatus: user.stripeStatus || '',
        stripeCustomerId: user.stripeCustomerId || ''
      }
    })
  } catch (err) {
    console.error('LOGIN ERROR:', err)
    return res.status(500).json({ error: 'Login failed' })
  }
})

app.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!user) return res.status(404).json({ error: 'User not found.' })
    const now = new Date()
    if (user.aiReviewReset && now > new Date(user.aiReviewReset)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { aiReviewCount: 0, aiReviewReset: null }
      })
      user.aiReviewCount = 0
      user.aiReviewReset = null
    }

    const hasProAccess =
      user.billingPlan === 'pro' ||
      user.billingPlan === 'pro_beta' ||
      user.billingPlan === 'core'
    const screenshotLimit = 5
    const screenshotRemaining = Math.max(
      0,
      screenshotLimit - (user.screenshotCount || 0)
    )
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        billingPlan: user.billingPlan || 'starter',
        stripeStatus: user.stripeStatus || 'inactive',
        stripeCustomerId: user.stripeCustomerId || '',
        isBetaUser: user.isBetaUser,
        screenshotRemaining,
        aiRemaining: Math.max(
          0,
          AI_REVIEW_DAILY_LIMIT - (user.aiReviewCount || 0)
        ),
        featureFlags: {
          manualJournal: true,
          aiReview: hasProAccess,
          screenshotReview: hasProAccess,
          export: hasProAccess,
          deeperStats: hasProAccess
        }
      }
    })
  } catch (err) {
    console.error('[ME ERROR]', err)
    return res.status(500).json({ error: 'Failed to load profile.' })
  }
})

// ---------------- RADAR ----------------
app.get('/events', (_req, res) => {
  res.json({ events })
})

app.get('/test-sweep', (_req, res) => {
  const fake = {
    id: `test_${Date.now()}`,
    timestampUtc: new Date().toISOString(),
    pair: 'SUI/USDT',
    timeframe: '3m',
    session: 'New York',
    directionBias: 'Short',
    eventType: 'SWEEP_RECLAIM',
    sweepType: 'High Sweep',
    emaContext: 'EMA99 Rejection',
    structure: 'Compression',
    reclaimConfirmed: true,
    botConfidence: 0.82,
    entry: 1.25,
    stop: 1.28,
    tp1: 1.2,
    tp2: 1.15,
    rr1: 1.67,
    rr2: 3.33
  }
  events.unshift(fake)
  if (events.length > MAX_EVENTS) events.pop()
  res.json({ ok: true, fake })
})

// ---------------- AI REVIEW ----------------
app.post('/ai-review', requireAuth, async (req, res) => {
  try {
    if (!ENABLE_AI || !anthropic) {
      return res.status(503).json({ error: 'AI review is not enabled' })
    }

    // Global IP rate limit — stops account farming abuse
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown'
    const globalCheck = checkAiRateLimit(ip)
    if (!globalCheck.allowed) {
      return res.status(429).json({ error: globalCheck.message })
    }

    // Per-user daily limit
    const usage = canUseAiReview(req.user, AI_REVIEW_DAILY_LIMIT)
    if (!usage.allowed) {
      return res.status(403).json({ error: 'Daily AI review limit reached' })
    }
    if (usage.reset) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          aiReviewCount: 0,
          aiReviewReset: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      })
      req.user.aiReviewCount = 0
      req.user.aiReviewReset = new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
    const payload = req.body?.trade || req.body || {}
    const result = await runAiTradeReview(payload)
    await prisma.user.update({
      where: { id: req.user.id },
      data: { aiReviewCount: { increment: 1 } }
    })
    req.user.aiReviewCount = (req.user.aiReviewCount || 0) + 1
    return res.json({
      ok: true,
      ai: result,
      aiRemaining: Math.max(
        0,
        AI_REVIEW_DAILY_LIMIT - (req.user.aiReviewCount || 0)
      )
    })
  } catch (err) {
    console.error('AI review error:', err)
    return res.status(500).json({ error: 'AI review failed' })
  }
})

// GET /trader-dna — return stored DNA without regenerating
app.get('/trader-dna', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (!user.traderDna)
      return res.json({ ok: true, dna: null, tradesAnalyzed: 0 })
    return res.json({
      ok: true,
      dna: user.traderDna,
      tradesAnalyzed: user.traderDna?.totalTrades || 0,
      generatedAt: user.traderDnaGeneratedAt
    })
  } catch (err) {
    console.error('Get Trader DNA error:', err)
    return res.status(500).json({ error: 'Failed to load Trader DNA' })
  }
})

// GET /trader-dna/pdf — generate print-friendly PDF of stored DNA
app.get('/trader-dna/pdf', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (!user.traderDna)
      return res
        .status(404)
        .json({ error: 'No Trader DNA found. Generate your profile first.' })

    const dna = user.traderDna
    const PDFDocument = (await import('pdfkit')).default

    const doc = new PDFDocument({ margin: 50, size: 'A4' })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="trader-dna-${new Date()
        .toISOString()
        .slice(0, 10)}.pdf"`
    )
    doc.pipe(res)

    // ── HEADER ──
    doc.rect(0, 0, doc.page.width, 80).fill('#111111')
    doc
      .fill('#ffffff')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('TRADER DNA™', 50, 25)
    doc
      .fontSize(10)
      .font('Helvetica')
      .text('Red October Systems · Liquidity Lab', 50, 52)
    doc
      .fill('#ef4444')
      .fontSize(10)
      .text(
        `Generated ${new Date().toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        })}`,
        50,
        65
      )

    doc.moveDown(3)

    // ── TRADER TYPE ──
    doc
      .fill('#111111')
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('YOUR TRADER TYPE', { characterSpacing: 2 })
    doc.moveDown(0.3)
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text(dna.traderType || '—')
    doc.moveDown(0.5)
    doc
      .fontSize(10)
      .font('Helvetica')
      .fill('#444444')
      .text(dna.overallAssessment || '', { lineGap: 4 })

    doc.moveDown(1)

    // ── STATS ROW ──
    const statsY = doc.y
    const colW = (doc.page.width - 100) / 3

    const stats = [
      { label: 'TRADES', value: String(dna.totalTrades ?? '—') },
      {
        label: 'WIN RATE',
        value: dna.winRate != null ? `${Math.round(dna.winRate * 100)}%` : '—'
      },
      {
        label: 'AVG RR',
        value:
          dna.avgRR != null && Number(dna.avgRR) !== 0
            ? `${Number(dna.avgRR).toFixed(2)}R`
            : '—'
      }
    ]

    stats.forEach((s, i) => {
      const x = 50 + i * colW
      doc.rect(x, statsY, colW - 8, 52).fill('#f5f5f5')
      doc
        .fill('#888888')
        .fontSize(8)
        .font('Helvetica-Bold')
        .text(s.label, x + 10, statsY + 8, {
          width: colW - 20,
          align: 'center',
          characterSpacing: 1
        })
      doc
        .fill('#111111')
        .fontSize(18)
        .font('Helvetica-Bold')
        .text(s.value, x + 10, statsY + 22, {
          width: colW - 20,
          align: 'center'
        })
    })

    doc.y = statsY + 62
    doc.moveDown(1)

    // ── DIVIDER ──
    function divider () {
      doc
        .moveTo(50, doc.y)
        .lineTo(doc.page.width - 50, doc.y)
        .stroke('#dddddd')
      doc.moveDown(0.8)
    }

    // ── SECTION HEADER ──
    function sectionHeader (title, color = '#111111') {
      doc
        .fill(color)
        .fontSize(8)
        .font('Helvetica-Bold')
        .text(title, { characterSpacing: 2 })
      doc.moveDown(0.4)
    }

    // ── STRENGTHS ──
    divider()
    sectionHeader('STRENGTHS', '#16a34a')
    ;(dna.strengths || []).forEach(s => {
      doc.fill('#16a34a').fontSize(10).text('+ ', { continued: true })
      doc
        .fill('#333333')
        .font('Helvetica')
        .text(String(s).replace(/^['"]/, ''), { lineGap: 3 })
    })

    doc.moveDown(0.8)

    // ── WEAKNESSES ──
    divider()
    sectionHeader('WEAKNESSES', '#dc2626')
    ;(dna.weaknesses || []).forEach(w => {
      doc.fill('#dc2626').fontSize(10).text('- ', { continued: true })
      doc
        .fill('#333333')
        .font('Helvetica')
        .text(String(w).replace(/^['"]/, ''), { lineGap: 3 })
    })

    doc.moveDown(0.8)

    // ── SESSIONS & SETUPS ──
    divider()
    const gridY = doc.y
    const halfW = (doc.page.width - 108) / 2

    function infoBox (x, y, label, value, color) {
      doc.rect(x, y, halfW, 60).fill('#f9f9f9')
      doc
        .fill(color)
        .fontSize(7)
        .font('Helvetica-Bold')
        .text(label, x + 8, y + 8, { width: halfW - 16, characterSpacing: 1 })
      doc
        .fill('#222222')
        .fontSize(9)
        .font('Helvetica')
        .text(value || '—', x + 8, y + 20, { width: halfW - 16, lineGap: 2 })
    }

    infoBox(50, gridY, 'BEST SESSION', dna.bestSession, '#16a34a')
    infoBox(58 + halfW, gridY, 'WORST SESSION', dna.worstSession, '#dc2626')
    doc.y = gridY + 68
    const gridY2 = doc.y
    infoBox(50, gridY2, 'BEST SETUP', dna.bestSetup, '#ca8a04')
    infoBox(58 + halfW, gridY2, 'WORST SETUP', dna.worstSetup, '#ea580c')
    doc.y = gridY2 + 68

    doc.moveDown(0.8)

    // ── PATTERN BIAS ──
    if (dna.patternBias) {
      divider()
      sectionHeader('PATTERN BIAS')
      doc
        .fill('#333333')
        .fontSize(10)
        .font('Helvetica')
        .text(dna.patternBias, { lineGap: 3 })
      doc.moveDown(0.8)
    }

    // ── COACHING FOCUS ──
    divider()
    sectionHeader('COACHING FOCUS THIS WEEK', '#b45309')
    doc.rect(50, doc.y, doc.page.width - 100, 1).fill('#f59e0b')
    doc.moveDown(0.3)
    doc
      .fill('#111111')
      .fontSize(11)
      .font('Helvetica-Bold')
      .text(dna.coachingFocus || '—', { lineGap: 4 })

    // ── FOOTER ──
    doc.moveDown(2)
    divider()
    doc
      .fill('#999999')
      .fontSize(8)
      .font('Helvetica')
      .text(
        'Red October Systems · app.redoctobersystems.com · Powered by Claude AI',
        { align: 'center' }
      )

    doc.end()
  } catch (err) {
    console.error('PDF generation error:', err)
    if (!res.headersSent) {
      return res.status(500).json({ error: 'PDF generation failed' })
    }
  }
})

// POST /trader-dna — generate fresh DNA and store it
app.post('/trader-dna', requireAuth, async (req, res) => {
  try {
    if (!ENABLE_AI || !anthropic) {
      return res.status(503).json({ error: 'AI not enabled' })
    }

    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown'
    const dnaCheck = checkDnaRateLimit(ip)
    if (!dnaCheck.allowed) {
      return res.status(429).json({ error: dnaCheck.message })
    }

    const logs = await prisma.tradeLog.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    if (logs.length < 10) {
      return res.status(400).json({
        error: 'Not enough trades',
        message: `You need at least 10 logged trades for Trader DNA. You have ${logs.length}.`,
        tradesNeeded: 10 - logs.length
      })
    }

    const dna = await runTraderDna(logs)

    // Store result on the user record
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        traderDna: dna,
        traderDnaGeneratedAt: new Date()
      }
    })

    return res.json({ ok: true, dna, tradesAnalyzed: logs.length })
  } catch (err) {
    console.error('Trader DNA error:', err)
    return res.status(500).json({ error: 'Trader DNA generation failed' })
  }
})

// ---------------- LOGS ----------------
app.get('/logs', requireAuth, async (req, res) => {
  try {
    const logs = await prisma.tradeLog.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 100
    })
    return res.json({ logs })
  } catch (err) {
    console.error('Get logs error:', err)
    return res.status(500).json({ error: 'Failed to load logs' })
  }
})

app.post('/logs', requireAuth, async (req, res) => {
  try {
    const payload = req.body || {}

    // Enforce log limits by plan
    const plan = req.user.billingPlan || 'starter'
    const LOG_LIMITS = {
      starter: 50,
      core: 500,
      pro: Infinity,
      pro_beta: Infinity
    }
    const limit = LOG_LIMITS[plan] ?? 50
    if (limit !== Infinity) {
      const currentCount = await prisma.tradeLog.count({
        where: { userId: req.user.id }
      })
      if (currentCount >= limit) {
        return res.status(403).json({
          error: 'Log limit reached',
          message: `Your ${plan} plan allows ${limit} log entries. Upgrade to log more trades.`
        })
      }
    }

    if (payload.screenshotUrl) {
      const usage = canUseScreenshot(req.user, 5)
      if (!usage.allowed)
        return res.status(403).json({ error: 'Daily screenshot limit reached' })
      if (usage.reset) {
        const nextReset = new Date(Date.now() + 24 * 60 * 60 * 1000)
        await prisma.user.update({
          where: { id: req.user.id },
          data: { screenshotCount: 0, screenshotReset: nextReset }
        })
        req.user.screenshotCount = 0
        req.user.screenshotReset = nextReset
      }
      await prisma.user.update({
        where: { id: req.user.id },
        data: { screenshotCount: { increment: 1 } }
      })
      req.user.screenshotCount = (req.user.screenshotCount || 0) + 1
    }

    const aiAnalysis = analyzeTrade(payload)
    const scorecard = buildTradeScorecard(payload)

    const entryNum =
      payload.entry === null ||
      payload.entry === undefined ||
      payload.entry === ''
        ? null
        : parseNum(payload.entry, 0)
    const stopNum =
      payload.stop === null || payload.stop === undefined || payload.stop === ''
        ? null
        : parseNum(payload.stop, 0)
    const exitNum =
      payload.exit === null || payload.exit === undefined || payload.exit === ''
        ? null
        : parseNum(payload.exit, 0)
    const tp1Num =
      payload.tp1 === null || payload.tp1 === undefined || payload.tp1 === ''
        ? null
        : parseNum(payload.tp1, 0)
    const tp2Num =
      payload.tp2 === null || payload.tp2 === undefined || payload.tp2 === ''
        ? null
        : parseNum(payload.tp2, 0)
    const pnlNum =
      payload.pnl === null || payload.pnl === undefined || payload.pnl === ''
        ? null
        : parseNum(payload.pnl, 0)

    const risk =
      entryNum != null && stopNum != null ? Math.abs(entryNum - stopNum) : 0
    const rr1 =
      risk > 0 && tp1Num != null ? Math.abs(tp1Num - entryNum) / risk : null
    const rr2 =
      risk > 0 && tp2Num != null ? Math.abs(tp2Num - entryNum) / risk : null

    let realizedRR = null
    if (risk > 0 && exitNum != null) {
      if (
        String(payload.directionBias || '')
          .toLowerCase()
          .includes('long')
      ) {
        realizedRR = (exitNum - entryNum) / risk
      } else {
        realizedRR = (entryNum - exitNum) / risk
      }
      if (!Number.isFinite(realizedRR)) realizedRR = null
    }

    const log = await prisma.tradeLog.create({
      data: {
        userId: req.user.id,
        pair: payload.pair || '',
        timeframe: payload.timeframe || '3m',
        session: payload.session || 'New York',
        directionBias: payload.directionBias || 'Short',
        eventType: payload.eventType || 'SWEEP_DETECTED',
        sweepType: payload.sweepType || 'High Sweep',
        emaContext: payload.emaContext || '',
        leverage: parseNum(payload.leverage, 1),
        action: payload.action || 'Taken',
        planFollowed: payload.planFollowed || 'Yes',
        ruleBreak: payload.ruleBreak || 'None',
        disciplineScore: parseNum(payload.disciplineScore, 0),
        setupQuality: parseNum(payload.setupQuality, 0),
        emotionalPressure: parseNum(payload.emotionalPressure, 0),
        confidenceSelf: parseNum(payload.confidenceSelf, 0),
        outcome: payload.outcome || null,
        durationMinutes: parseNum(payload.durationMinutes, 0),
        entry: entryNum,
        stop: stopNum,
        exit: exitNum,
        pnl: pnlNum,
        realizedRR: realizedRR != null ? Number(realizedRR.toFixed(2)) : null,
        notes: payload.notes || '',
        screenshotUrl: payload.screenshotUrl || '',
        linkedEventId: payload.linkedEventId || null,
        reclaimConfirmed: Boolean(payload.reclaimConfirmed),
        aiStatus: 'ready',
        aiScore: scorecard.aiScore,
        tradeScore: scorecard.tradeScore,
        aiGrade: scorecard.aiGrade,
        aiSummary: aiAnalysis.summary,
        aiCoachingNote: aiAnalysis.coachingTip,
        setupScore: scorecard.setupScore,
        executionScore: scorecard.executionScore,
        managementScore: scorecard.managementScore,
        disciplineScoreAi: scorecard.disciplineScoreAi,
        scoreNotes: scorecard.scoreNotes,
        chartRead: aiAnalysis.chartRead,
        setupAssessment: aiAnalysis.setupAssessment,
        executionAssessment: aiAnalysis.executionAssessment,
        riskAssessment: aiAnalysis.riskAssessment,
        biasAlignment: aiAnalysis.biasAlignment,
        usedScreenshot: aiAnalysis.usedScreenshot,
        aiVerdict:
          aiAnalysis.verdict ||
          aiAnalysis.tradeVerdict ||
          aiAnalysis.executionAssessment ||
          '',
        aiStrengths: aiAnalysis.strengths || aiAnalysis.whatWasGood || [],
        aiMistakes: aiAnalysis.mistakes || aiAnalysis.whatNeedsWork || []
      }
    })

    sendTradeReviewEmail({
      pair: log.pair,
      timeframe: log.timeframe,
      directionBias: log.directionBias,
      outcome: log.outcome,
      pnl: log.pnl,
      rr1: rr1 != null ? Number(rr1.toFixed(2)) : null,
      rr2: rr2 != null ? Number(rr2.toFixed(2)) : null,
      realizedRR: realizedRR != null ? Number(realizedRR.toFixed(2)) : null,
      aiSummary: aiAnalysis.summary,
      aiCoachingNote: aiAnalysis.coachingTip,
      notes: log.notes
    }).catch(err => console.error('[EMAIL] trade review failed:', err.message))

    return res.json({
      log,
      aiStatus: 'ready',
      aiAnalysis,
      rr1: rr1 != null ? Number(rr1.toFixed(2)) : null,
      rr2: rr2 != null ? Number(rr2.toFixed(2)) : null,
      realizedRR: realizedRR != null ? Number(realizedRR.toFixed(2)) : null,
      screenshotRemaining: Math.max(0, 5 - (req.user.screenshotCount || 0))
    })
  } catch (err) {
    console.error('Create log error:', err)
    return res
      .status(500)
      .json({ error: 'Failed to save log', details: err.message })
  }
})

// ---------------- BUG REPORT ----------------
app.post('/bug-report', async (req, res) => {
  try {
    const payload = req.body || {}
    console.log('[BUG REPORT]', payload)
    if (resend && ALERT_FROM_EMAIL && ALERT_TO_EMAIL) {
      await resend.emails.send({
        from: ALERT_FROM_EMAIL,
        to: ALERT_TO_EMAIL,
        subject: `Bug Report — ${payload.selectedPair || 'Unknown'} — ${
          payload.userEmail || 'Unknown'
        }`,
        html: `<pre>${JSON.stringify(payload, null, 2)}</pre>`
      })
    }
    return res.json({ ok: true })
  } catch (err) {
    console.error('[BUG REPORT ERROR]', err)
    return res.status(500).json({ error: 'Failed to send bug report' })
  }
})

// ---------------- STRIPE ----------------
app.post('/stripe/create-checkout-session', requireAuth, async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: 'Stripe not configured' })
    const plan = String(req.body.plan || 'pro').toLowerCase()
    const priceId = resolveCheckoutPriceId(plan)
    if (!priceId)
      return res.status(400).json({ error: 'Missing Stripe price ID', plan })
    const customerId = await getOrCreateStripeCustomer(req.user)
    const existingSub = await getLatestActiveSubscriptionForCustomer(customerId)
    if (existingSub) {
      const existingPriceId = existingSub.items?.data?.[0]?.price?.id || null
      const existingPlan = resolveBillingPlanFromPriceId(existingPriceId)
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${APP_URL}/billing`
      })
      return res.status(409).json({
        error:
          existingPriceId === priceId
            ? 'You already have this plan active. Opening billing portal.'
            : `You already have an active subscription (${existingPlan}). Opening billing portal.`,
        existingPlan,
        portalUrl: portal.url
      })
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_URL}/billing?success=1`,
      cancel_url: `${APP_URL}/billing?canceled=1`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      client_reference_id: req.user.id,
      metadata: { userId: req.user.id, plan }
    })
    return res.json({ url: session.url })
  } catch (err) {
    console.error('Create checkout session error:', err)
    return res.status(500).json({ error: 'Failed to create checkout session' })
  }
})

app.post('/stripe/create-portal-session', requireAuth, async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: 'Stripe not configured' })
    const customerId = await getOrCreateStripeCustomer(req.user)
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${APP_URL}/billing`
    })
    return res.json({ url: portal.url })
  } catch (err) {
    console.error('Create portal session error:', err)
    return res.status(500).json({ error: 'Failed to create portal session' })
  }
})

app.post('/stripe/sync', requireAuth, async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: 'Stripe not configured' })
    if (!req.user.stripeCustomerId) {
      return res.json({
        ok: true,
        stripeStatus: req.user.stripeStatus || 'free',
        billingPlan: req.user.billingPlan || 'starter'
      })
    }
    const subs = await stripe.subscriptions.list({
      customer: req.user.stripeCustomerId,
      status: 'all',
      limit: 20
    })
    const activeSubs = subs.data
      .filter(sub =>
        ['active', 'trialing', 'past_due', 'incomplete'].includes(sub.status)
      )
      .sort((a, b) => b.created - a.created)
    const activeLike = activeSubs[0]
    if (!activeLike) {
      return res.json({
        ok: true,
        stripeStatus: req.user.stripeStatus || 'free',
        billingPlan: req.user.billingPlan || 'starter',
        note: 'No active subscription found.'
      })
    }
    const priceId = activeLike.items?.data?.[0]?.price?.id || null
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        stripeSubId: activeLike.id || null,
        stripePriceId: priceId,
        stripeStatus: activeLike.status || req.user.stripeStatus || 'free',
        billingPlan: resolveBillingPlanFromPriceId(priceId),
        billingPeriodEnd: activeLike.current_period_end
          ? new Date(activeLike.current_period_end * 1000)
          : null,
        isActive: ['active', 'trialing'].includes(activeLike.status || '')
      }
    })
    // BUG FIX: was 'user.screenshotCount' — should be 'req.user.screenshotCount'
    const screenshotRemaining = Math.max(0, 5 - (req.user.screenshotCount || 0))
    return res.json({
      ok: true,
      stripeStatus: activeLike.status || req.user.stripeStatus || 'free',
      billingPlan: resolveBillingPlanFromPriceId(priceId),
      screenshotRemaining
    })
  } catch (err) {
    console.error('Stripe sync error:', err)
    return res.status(500).json({ error: 'Stripe sync failed' })
  }
})

// ---------------- STRIPE WEBHOOK ----------------
// This is the critical endpoint that auto-updates user plans after payment
// Must be registered in Stripe Dashboard → Webhooks → Add endpoint
// URL: https://your-render-url.onrender.com/stripe/webhook
// Events to listen for: customer.subscription.created, updated, deleted
//                        checkout.session.completed, invoice.payment_failed

app.post('/stripe/webhook', async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' })

  const sig = req.headers['stripe-signature']
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('[WEBHOOK] STRIPE_WEBHOOK_SECRET not set')
    return res.status(500).json({ error: 'Webhook secret not configured' })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
  } catch (err) {
    console.error('[WEBHOOK] Signature verification failed:', err.message)
    return res
      .status(400)
      .json({ error: `Webhook signature failed: ${err.message}` })
  }

  console.log('[WEBHOOK]', event.type, event.id)

  try {
    switch (event.type) {
      // Payment succeeded — checkout completed
      case 'checkout.session.completed': {
        const session = event.data.object
        const customerId = session.customer
        const userId = session.client_reference_id || session.metadata?.userId

        if (!customerId) break

        // Get the subscription from the session
        const subId = session.subscription
        if (!subId) break

        const sub = await stripe.subscriptions.retrieve(subId)
        const priceId = sub.items?.data?.[0]?.price?.id || null
        const billingPlan = resolveBillingPlanFromPriceId(priceId)

        // Find user by customerId or userId
        const whereClause = userId
          ? { id: userId }
          : { stripeCustomerId: customerId }

        await prisma.user.updateMany({
          where: whereClause,
          data: {
            stripeCustomerId: customerId,
            stripeSubId: sub.id,
            stripePriceId: priceId,
            stripeStatus: sub.status,
            billingPlan,
            isActive: ['active', 'trialing'].includes(sub.status),
            billingPeriodEnd: sub.current_period_end
              ? new Date(sub.current_period_end * 1000)
              : null
          }
        })

        console.log(
          '[WEBHOOK] Checkout complete — plan updated to:',
          billingPlan,
          'for customer:',
          customerId
        )
        break
      }

      // Subscription created or updated
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object
        const customerId = sub.customer
        const priceId = sub.items?.data?.[0]?.price?.id || null
        const billingPlan = resolveBillingPlanFromPriceId(priceId)

        await prisma.user.updateMany({
          where: { stripeCustomerId: String(customerId) },
          data: {
            stripeSubId: sub.id,
            stripePriceId: priceId,
            stripeStatus: sub.status,
            billingPlan,
            isActive: ['active', 'trialing'].includes(sub.status),
            billingPeriodEnd: sub.current_period_end
              ? new Date(sub.current_period_end * 1000)
              : null
          }
        })

        console.log(
          '[WEBHOOK] Subscription',
          event.type,
          '— plan:',
          billingPlan,
          'status:',
          sub.status
        )
        break
      }

      // Subscription cancelled or expired
      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const customerId = sub.customer

        await prisma.user.updateMany({
          where: { stripeCustomerId: String(customerId) },
          data: {
            stripeStatus: 'canceled',
            billingPlan: 'starter',
            isActive: false
          }
        })

        console.log('[WEBHOOK] Subscription canceled for customer:', customerId)
        break
      }

      // Payment failed — notify but don't downgrade immediately
      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const customerId = invoice.customer

        await prisma.user.updateMany({
          where: { stripeCustomerId: String(customerId) },
          data: { stripeStatus: 'past_due' }
        })

        console.log('[WEBHOOK] Payment failed for customer:', customerId)
        break
      }

      default:
        console.log('[WEBHOOK] Unhandled event type:', event.type)
    }
  } catch (err) {
    console.error('[WEBHOOK] Handler error:', err)
    return res.status(500).json({ error: 'Webhook handler failed' })
  }

  res.json({ received: true })
})

// ---------------- START ----------------
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`)
})
