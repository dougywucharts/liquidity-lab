import 'dotenv/config'
import OpenAI from 'openai'
import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import Stripe from 'stripe'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Resend } from 'resend'

// ---------------- PRISMA / STRIPE / EMAIL ----------------
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

const ENABLE_AI = String(process.env.ENABLE_AI || '').toLowerCase() === 'true'
const AI_REVIEW_DAILY_LIMIT = Number(process.env.AI_REVIEW_DAILY_LIMIT || 5)

const ALERT_FROM_EMAIL =
  process.env.ALERT_FROM_EMAIL || 'alerts@redoctobersystems.com'
const ALERT_TO_EMAIL = process.env.ALERT_TO_EMAIL || ''

// ---------------- APP ----------------
const app = express()
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

async function runAiTradeReview (payload) {
  if (!openai || !ENABLE_AI) {
    return {
      score: null,
      verdict: 'AI disabled',
      strengths: [],
      mistakes: [],
      coaching: 'AI review is currently disabled.',
      comparison: null
    }
  }

  const structuredInput = {
    trade: {
      pair: payload.pair || '',
      timeframe: payload.timeframe || '',
      directionBias: payload.directionBias || '',
      eventType: payload.eventType || '',
      sweepType: payload.sweepType || '',
      emaContext: payload.emaContext || '',
      session: payload.session || '',
      entry: payload.entry || '',
      stop: payload.stop || '',
      exit: payload.exit || '',
      tp1: payload.tp1 || '',
      tp2: payload.tp2 || '',
      rr1: payload.rr1 || '',
      rr2: payload.rr2 || '',
      action: payload.action || '',
      timing: payload.timing || '',
      planFollowed: payload.planFollowed || '',
      ruleBreak: payload.ruleBreak || '',
      setupQuality: payload.setupQuality || '',
      disciplineScore: payload.disciplineScore || '',
      emotionalPressure: payload.emotionalPressure || '',
      confidenceSelf: payload.confidenceSelf || '',
      outcome: payload.outcome || '',
      durationMinutes: payload.durationMinutes || '',
      pnl: payload.pnl || '',
      notes: payload.notes || ''
    },
    userStats: payload.userStats || {
      failRate: 0.37,
      winRate: 0.63
    },

    groupStats: payload.groupStats || {
      failRate: 0.42,
      winRate: 0.58
    },
    coachingRules: {
      strategy: 'liquidity sweep trading',
      mustCheck: [
        'Was there a valid sweep?',
        'Was confirmation waited for?',
        'Was entry chasing or controlled?',
        'Was stop placement logical?',
        'Was RR acceptable?',
        'Was this trade aligned with session/context?'
      ],
      avoidGenericFeedback: true
    },
    requiredJsonShape: {
      score: 'number 0-100',
      verdict: 'short direct verdict',
      strengths: ['specific things done well'],
      mistakes: ['specific issues or rule breaks'],
      coaching: 'specific correction for next time',
      comparison: 'compare userStats vs groupStats if provided'
    }
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You are a strict liquidity-sweep trading coach. Do not give generic advice. Reference the actual trade data. Be direct, concise, and behavior-focused.'
      },
      {
        role: 'user',
        content: JSON.stringify(structuredInput, null, 2)
      }
    ],
    temperature: 0.2
  })

  const raw = response.choices?.[0]?.message?.content || '{}'
  const parsed = JSON.parse(raw)

  return {
    score: Number.isFinite(Number(parsed.score)) ? Number(parsed.score) : null,
    verdict: parsed.verdict || 'No verdict',
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    mistakes: Array.isArray(parsed.mistakes) ? parsed.mistakes : [],
    coaching: parsed.coaching || 'No coaching returned.',
    comparison: parsed.comparison || null
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
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    })

    if (!user) return res.status(401).json({ error: 'Invalid user' })

    req.user = user
    next()
  } catch (err) {
    console.error('Auth error:', err?.message || err)
    return res.status(401).json({ error: 'Unauthorized' })
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
  if (payload.planFollowed === 'Yes') {
    whatWasGood.push('Followed the trade plan')
  }
  if (payload.timing === 'On Confirmation') {
    whatWasGood.push('Waited for confirmation')
  }
  if (setupQuality >= 8) {
    whatWasGood.push('High-quality setup')
  }

  const whatNeedsWork = []
  if (hasRuleBreak) {
    whatNeedsWork.push(payload.ruleBreak)
  }
  if (payload.timing === 'Early' || payload.timing === 'Chase Entry') {
    whatNeedsWork.push('Entry timing')
  }
  if (emotionalPressure >= 7) {
    whatNeedsWork.push('Emotional control')
  }

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
      <h2 style="margin-bottom:8px;">Liquidity Lab Trade Review</h2>
      <p style="margin-top:0;">${safe(log.pair)} • ${safe(
    log.timeframe
  )} • ${safe(log.directionBias)}</p>
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

// ---------------- WEBHOOK MUST BE FIRST ----------------
app.post(
  '/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' })
    }

    const sig = req.headers['stripe-signature']
    let event

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      )
    } catch (err) {
      console.error('Webhook signature error:', err.message)
      return res.status(400).send(`Webhook Error: ${err.message}`)
    }

    try {
      console.log('Stripe event:', event.type)

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object

        const userId = session.metadata?.userId || null
        const customerId =
          typeof session.customer === 'string'
            ? session.customer
            : session.customer?.id || null
        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id || null

        if (userId && subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId)
          const priceId = sub.items?.data?.[0]?.price?.id || null

          await prisma.user.update({
            where: { id: userId },
            data: {
              stripeCustomerId: customerId,
              stripeSubId: subscriptionId,
              stripePriceId: priceId,
              billingStatus: sub.status || 'active',
              billingPlan: resolveBillingPlanFromPriceId(priceId),
              billingPeriodEnd: sub.current_period_end
                ? new Date(sub.current_period_end * 1000)
                : null,
              isActive: ['active', 'trialing'].includes(sub.status || '')
            }
          })
        }
      }

      if (
        event.type === 'customer.subscription.created' ||
        event.type === 'customer.subscription.updated'
      ) {
        const sub = event.data.object
        const customerId =
          typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
        const priceId = sub.items?.data?.[0]?.price?.id || null

        if (customerId) {
          await prisma.user.updateMany({
            where: { stripeCustomerId: customerId },
            data: {
              stripeSubId: sub.id,
              stripePriceId: priceId,
              billingStatus: sub.status || 'active',
              billingPlan: resolveBillingPlanFromPriceId(priceId),
              billingPeriodEnd: sub.current_period_end
                ? new Date(sub.current_period_end * 1000)
                : null,
              isActive: ['active', 'trialing'].includes(sub.status || '')
            }
          })
        }
      }

      if (event.type === 'customer.subscription.deleted') {
        const sub = event.data.object
        const customerId =
          typeof sub.customer === 'string' ? sub.customer : sub.customer?.id

        if (customerId) {
          await prisma.user.updateMany({
            where: { stripeCustomerId: customerId },
            data: {
              billingStatus: 'canceled',
              isActive: false
            }
          })
        }
      }

      if (event.type === 'invoice.payment_succeeded') {
        const invoice = event.data.object
        const customerId =
          typeof invoice.customer === 'string'
            ? invoice.customer
            : invoice.customer?.id

        if (customerId) {
          await prisma.user.updateMany({
            where: { stripeCustomerId: customerId },
            data: {
              billingStatus: 'active',
              isActive: true
            }
          })
        }
      }

      if (event.type === 'invoice.payment_failed') {
        const invoice = event.data.object
        const customerId =
          typeof invoice.customer === 'string'
            ? invoice.customer
            : invoice.customer?.id

        if (customerId) {
          await prisma.user.updateMany({
            where: { stripeCustomerId: customerId },
            data: {
              billingStatus: 'past_due',
              isActive: false
            }
          })
        }
      }

      return res.json({ received: true })
    } catch (err) {
      console.error('Webhook failed:', err)
      return res.status(500).json({ error: 'Webhook failed' })
    }
  }
)

// ---------------- NORMAL MIDDLEWARE ----------------
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '15mb' }))

// ---------------- HEALTH ----------------
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    stripe: Boolean(stripe),
    email: Boolean(resend),
    time: new Date().toISOString()
  })
})

app.get('/email-test', async (_req, res) => {
  try {
    await sendSweepAlertEmail({
      pair: 'BTC/USDT',
      timeframe: '1m',
      directionBias: 'Short',
      eventType: 'SWEEP_CONFIRMED',
      sweepType: 'High Sweep',
      botConfidence: 0.88,
      entry: 84500,
      stop: 84720,
      tp1: 84150,
      tp2: 83800,
      rr1: 1.6,
      rr2: 3.1,
      session: 'New York',
      timestampUtc: new Date().toISOString()
    })

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ---------------- AUTH ----------------
const BETA_ACCESS_CODE = process.env.BETA_ACCESS_CODE || ''
const BETA_FULL_ACCESS =
  String(process.env.BETA_FULL_ACCESS || '').toLowerCase() === 'true'

app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, betaCode } = req.body || {}

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' })
    }

    if (!betaCode || betaCode !== BETA_ACCESS_CODE) {
      return res.status(403).json({ error: 'Invalid beta access code.' })
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase().trim() }
    })

    if (existingUser) {
      return res.status(409).json({ error: 'User already exists.' })
    }

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
          aiReview: BETA_FULL_ACCESS ? true : false,
          screenshotReview: BETA_FULL_ACCESS ? true : false,
          export: BETA_FULL_ACCESS ? true : false,
          deeperStats: BETA_FULL_ACCESS ? true : false
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

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing credentials' })
    }

    const user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

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

    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    return res.json({
      token: signToken(user),
      user: {
        id: user.id,
        email: user.email,
        billingPlan: user.billingPlan || 'starter',
        stripeStatus: user.billingStatus || '',
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
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found.' })
    }

    const isBetaFullAccess =
      user.isBetaUser &&
      String(process.env.BETA_FULL_ACCESS || '').toLowerCase() === 'true'

    const screenshotLimit = 5
    const screenshotRemaining = Math.max(
      0,
      screenshotLimit - (user.screenshotCount || 0)
    )

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        billingPlan: user.billingPlan,
        stripeStatus: user.stripeStatus,
        stripeCustomerId: user.stripeCustomerId || '',
        isBetaUser: user.isBetaUser,
        screenshotRemaining,
        aiRemaining: Math.max(
          0,
          AI_REVIEW_DAILY_LIMIT - (user.aiReviewCount || 0)
        ),
        featureFlags: {
          manualJournal: true,
          aiReview: isBetaFullAccess,
          screenshotReview: isBetaFullAccess,
          export: isBetaFullAccess,
          deeperStats: isBetaFullAccess
        }
      }
    })
  } catch (err) {
    console.error('[ME ERROR]', err)
    return res.status(500).json({ error: 'Failed to load profile.' })
  }
})

// ---------------- RADAR ----------------
const events = []
const MAX_EVENTS = 300

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

app.post('/sweep', async (req, res) => {
  try {
    events.unshift(req.body)
    if (events.length > MAX_EVENTS) events.pop()

    sendSweepAlertEmail(req.body).catch(err => {
      console.error('[EMAIL] sweep alert failed:', err.message)
    })

    res.json({ ok: true })
  } catch (err) {
    console.error('Sweep route error:', err)
    res.status(500).json({ ok: false, error: 'Failed to process sweep' })
  }
})

// ---------------- AI REVIEW ----------------
app.post('/ai-review', requireAuth, async (req, res) => {
  try {
    if (!ENABLE_AI || !openai) {
      return res.status(503).json({ error: 'AI review is not enabled' })
    }

    const usage = canUseAiReview(req.user, AI_REVIEW_DAILY_LIMIT)

    if (!usage.allowed) {
      return res.status(403).json({
        error: 'Daily AI review limit reached'
      })
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
      data: {
        aiReviewCount: { increment: 1 }
      }
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

    if (payload.screenshotUrl) {
      const usage = canUseScreenshot(req.user, 5)

      if (!usage.allowed) {
        return res.status(403).json({
          error: 'Daily screenshot limit reached'
        })
      }

      if (usage.reset) {
        const nextReset = new Date(Date.now() + 24 * 60 * 60 * 1000)

        await prisma.user.update({
          where: { id: req.user.id },
          data: {
            screenshotCount: 0,
            screenshotReset: nextReset
          }
        })

        req.user.screenshotCount = 0
        req.user.screenshotReset = nextReset
      }

      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          screenshotCount: { increment: 1 }
        }
      })

      req.user.screenshotCount = (req.user.screenshotCount || 0) + 1
    }

    const aiAnalysis = analyzeTrade(payload)

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
        pnl: pnlNum,

        notes: payload.notes || '',
        screenshotUrl: payload.screenshotUrl || '',

        linkedEventId: payload.linkedEventId || null,
        reclaimConfirmed: Boolean(payload.reclaimConfirmed),

        aiStatus: 'ready',
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

        usedScreenshot: aiAnalysis.usedScreenshot
      }
    })

    const reviewEmailPayload = {
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
    }

    sendTradeReviewEmail(reviewEmailPayload).catch(err => {
      console.error('[EMAIL] trade review failed:', err.message)
    })

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
    return res.status(500).json({
      error: 'Failed to save log',
      details: err.message
    })
  }
})

// ---------------- STRIPE ----------------
app.post('/stripe/create-checkout-session', requireAuth, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' })
    }

    const plan = String(req.body.plan || 'pro').toLowerCase()
    const priceId = resolveCheckoutPriceId(plan)

    if (!priceId) {
      return res.status(400).json({
        error: 'Missing Stripe price ID',
        plan
      })
    }

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
      metadata: {
        userId: req.user.id,
        plan
      }
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
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' })
    }

    if (!req.user.stripeCustomerId) {
      return res.json({
        ok: true,
        stripeStatus: req.user.billingStatus || 'free',
        billingPlan: req.user.billingPlan || 'starter'
      })
    }

    const subs = await stripe.subscriptions.list({
      customer: req.user.stripeCustomerId,
      status: 'all',
      limit: 20
    })

    console.log('SYNC user:', req.user.id)
    console.log('SYNC customer:', req.user.stripeCustomerId)
    console.log(
      'SYNC subscriptions:',
      subs.data.map(sub => ({
        id: sub.id,
        status: sub.status,
        created: sub.created,
        price: sub.items?.data?.[0]?.price?.id
      }))
    )

    const activeSubs = subs.data
      .filter(sub =>
        ['active', 'trialing', 'past_due', 'incomplete'].includes(sub.status)
      )
      .sort((a, b) => b.created - a.created)

    const activeLike = activeSubs[0]

    if (!activeLike) {
      return res.json({
        ok: true,
        stripeStatus: req.user.billingStatus || 'free',
        billingPlan: req.user.billingPlan || 'starter',
        note: 'No active-like subscription found during sync; kept existing billing state.'
      })
    }

    const priceId = activeLike.items?.data?.[0]?.price?.id || null

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        stripeSubId: activeLike.id || null,
        stripePriceId: priceId,
        billingStatus: activeLike.status || req.user.billingStatus || 'free',
        billingPlan: resolveBillingPlanFromPriceId(priceId),
        billingPeriodEnd: activeLike.current_period_end
          ? new Date(activeLike.current_period_end * 1000)
          : null,
        isActive: ['active', 'trialing'].includes(activeLike.status || '')
      }
    })

    return res.json({
      ok: true,
      stripeStatus: activeLike.status || req.user.billingStatus || 'free',
      billingPlan: resolveBillingPlanFromPriceId(priceId)
    })
  } catch (err) {
    console.error('Stripe sync error:', err)
    return res.status(500).json({ error: 'Stripe sync failed' })
  }
})

// ---------------- START ----------------
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`)
})
