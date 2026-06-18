import { useState } from "react";

const palette = {
  bg: "#03060b",
  bg2: "#060a12",
  panel: "linear-gradient(180deg, rgba(8,12,20,0.98), rgba(5,8,14,0.98))",
  card: "linear-gradient(180deg, rgba(15,20,32,0.96), rgba(10,14,24,0.96))",
  border: "rgba(255,255,255,0.08)",
  borderSoft: "rgba(255,255,255,0.05)",
  text: "#f4f7fb",
  textSoft: "rgba(244,247,251,0.66)",
  textDim: "rgba(244,247,251,0.46)",
  long: "#4ade80",
  longSoft: "rgba(74,222,128,0.16)",
  short: "#fb7185",
  shortSoft: "rgba(251,113,133,0.16)",
  gold: "#f6c453",
  goldSoft: "rgba(246,196,83,0.14)",
  accent: "#ef4444",
  blue: "#60a5fa",
  blueSoft: "rgba(96,165,250,0.14)",
};

// ─── Pattern Library Data ─────────────────────────────────────────────────────

const PATTERNS = [
  {
    id: "high_sweep",
    name: "High Sweep",
    tag: "BEARISH",
    tone: "short",
    icon: "↑✕",
    tagline: "Price raids stops above a high, then rejects sharply.",
    what: "A candle wicks above a previous swing high or equal highs level, taking out buy-side liquidity, then closes back below it. The market used those stops as fuel to rotate lower.",
    entry:
      "Short on the first 1m candle that closes back below the swept level, after a rejection wick forms.",
    stop: "Above the wick high of the sweep candle. Give it a few ticks buffer.",
    tp1: "Previous local low or nearest demand zone. Typically 1.5–2R.",
    tp2: "Next major support level or session low. 3–4R on clean setups.",
    mistakes: [
      "Entering before price closes back below the level — wick alone is not confirmation.",
      "Placing stop at the candle close instead of above the wick.",
      "Trading High Sweeps against a strong bullish HTF bias without extra confirmation.",
      "Missing that the 'sweep' was actually a breakout — check if price holds below.",
    ],
    good: "Clean wick above equal highs, instant rejection, bearish close, volume spike on the sweep candle. EMA99 overhead acting as resistance.",
    bad: "Price lingers above the level for multiple candles. No rejection wick. HTF trend is strongly bullish. Thin volume on the sweep.",
    color: palette.short,
    bg: palette.shortSoft,
  },
  {
    id: "low_sweep",
    name: "Low Sweep",
    tag: "BULLISH",
    tone: "long",
    icon: "↓✕",
    tagline: "Price raids stops below a low, then reclaims sharply.",
    what: "A candle wicks below a previous swing low or equal lows level, taking out sell-side liquidity, then closes back above it. Smart money filled long orders using those stops as fuel.",
    entry:
      "Long on the first 1m candle that closes back above the swept level with a bullish body and rejection wick.",
    stop: "Below the wick low of the sweep candle, a few ticks buffer.",
    tp1: "Previous local high or nearest supply zone. Typically 1.5–2R.",
    tp2: "Session high or major resistance. 3–4R on clean setups.",
    mistakes: [
      "Buying the wick before the candle closes — need the close for confirmation.",
      "Ignoring bearish HTF structure — low sweeps work best in bullish regimes.",
      "Chasing the move after it's already run 1R without a retest.",
      "Missing equal lows as the actual target level — it's the pool, not random support.",
    ],
    good: "Wick below equal lows, sharp V-reversal, bullish close in upper half of candle, above-average volume. EMA99 below as support.",
    bad: "Price accepts below the level, closes at lows, bearish follow-through. Low volume sweep. Strong bearish HTF trend.",
    color: palette.long,
    bg: palette.longSoft,
  },
  {
    id: "double_sweep",
    name: "Double Sweep",
    tag: "HIGH CONVICTION",
    tone: "gold",
    icon: "↕✕",
    tagline: "Same level swept twice. Second sweep is the real entry.",
    what: "Price sweeps a liquidity level, partially retraces, then sweeps the same level again within 12 bars. The second sweep often has weaker momentum and is the institutional trap — the real move fires on the reclaim of that level.",
    entry:
      "On the reclaim of the level after the second sweep. Treat it like a High or Low Sweep entry but with higher conviction.",
    stop: "Beyond the second sweep's extreme, not the first.",
    tp1: "2–3R minimum. Double sweeps tend to have stronger displacement.",
    tp2: "Major structural level. 4–5R targets are common on strong setups.",
    mistakes: [
      "Entering on the first sweep expecting a double — wait for the second.",
      "Missing that the second sweep went significantly beyond the first — invalidation.",
      "Setting stop beyond the first sweep's extreme instead of the second.",
      "Trading this pattern in choppy, ranging markets with no clear direction.",
    ],
    good: "Second sweep has noticeably less momentum than the first. Small wick on second sweep. Immediate reclaim with a displacement candle.",
    bad: "Second sweep breaks significantly beyond first — structure is shifting. Multiple sweeps with no reclaim — market is distributing.",
    color: palette.gold,
    bg: palette.goldSoft,
  },
  {
    id: "equal_highs",
    name: "Equal Highs",
    tag: "LIQUIDITY POOL",
    tone: "short",
    icon: "══↑",
    tagline:
      "Two or more highs at the same level = a stop cluster waiting to be raided.",
    what: "When price creates multiple highs at the same price level, buy-stops accumulate just above that level. Institutional traders know this and will sweep those stops to fill large short orders. Equal highs are not resistance — they are a target.",
    entry:
      "Short after the sweep and rejection, same as a High Sweep. The equal highs label tells you WHY the level matters, not a different entry technique.",
    stop: "Above the highest wick in the equal highs cluster.",
    tp1: "First demand zone below. Often the origin of the move that created the equal highs.",
    tp2: "Session low or major HTF support.",
    mistakes: [
      "Treating equal highs as resistance and shorting without a sweep — premature.",
      "Only requiring 2 touches — the tighter the cluster and more touches, the stronger the pool.",
      "Forgetting that equal highs can also be swept from below as a breakout — context matters.",
      "Not checking the 5m or 15m map for how significant the level actually is.",
    ],
    good: "3+ touches within a tight range (0.15%). Level visible on 5m and 15m. Multiple failed breakout attempts before the sweep.",
    bad: "2 loose touches far apart in time. Level only visible on 1m. Already swept once before with no follow-through.",
    color: palette.short,
    bg: palette.shortSoft,
  },
  {
    id: "equal_lows",
    name: "Equal Lows",
    tag: "LIQUIDITY POOL",
    tone: "long",
    icon: "══↓",
    tagline:
      "Two or more lows at the same level = a stop cluster waiting to be swept long.",
    what: "Sell-stops cluster just below equal lows. Institutions sweep these to fill large buy orders at a discount. Equal lows are not support — they are a liquidity target that will eventually be taken.",
    entry:
      "Long after the sweep and reclaim, same mechanics as a Low Sweep entry.",
    stop: "Below the lowest wick in the equal lows cluster.",
    tp1: "First supply zone above. Often the origin of the legs that created the equal lows.",
    tp2: "Session high or major HTF resistance.",
    mistakes: [
      "Buying at equal lows expecting them to hold as support — they are targets, not floors.",
      "Entering without waiting for the sweep — price may still have further to run.",
      "Ignoring bearish HTF structure — equal lows in downtrends often lead to breakdown.",
      "Not accounting for spread/slippage on the stop placement.",
    ],
    good: "3+ clean touches in a tight range. Preceded by a strong bullish move. Level visible on 5m map. Volume dry-up at the level before sweep.",
    bad: "Sloppy touches with big gaps between them. Bearish HTF trend. Level already tested multiple times without a strong bounce.",
    color: palette.long,
    bg: palette.longSoft,
  },
  {
    id: "ema99_rejection",
    name: "EMA99 Rejection",
    tag: "CONFLUENCE",
    tone: "short",
    icon: "~✕",
    tagline:
      "Price taps the EMA99 and gets slapped down. The trend accelerates.",
    what: "In a bearish structure, price retraces into the EMA99 and rejects sharply. The EMA99 acts as dynamic resistance — institutions use retests into this level to add to short positions. The rejection confirms the trend is still in control.",
    entry:
      "Short on the 1m rejection candle from the EMA99. Combine with a sweep of a local high for maximum conviction.",
    stop: "Above the EMA99 by a small buffer. If price closes above, the thesis is invalid.",
    tp1: "Previous local low. 1.5–2R.",
    tp2: "Major support below. 3R+.",
    mistakes: [
      "Shorting into the EMA99 without waiting for a rejection candle — it might just push through.",
      "Using EMA99 rejection alone without a liquidity sweep as confluence.",
      "Ignoring when EMA99 has been broken and retested — it may have flipped to support.",
      "Holding through an EMA99 reclaim — that's your exit signal, not a dip.",
    ],
    good: "Price approaches EMA99 from below after a bearish sweep. Strong rejection wick. EMA99 is sloping downward (trending). Volume spike on rejection.",
    bad: "EMA99 is flat/sideways. Price has crossed EMA99 multiple times recently. No sweep confluence. HTF is bullish.",
    color: palette.short,
    bg: palette.shortSoft,
  },
  {
    id: "reclaim_failure",
    name: "Reclaim Failure",
    tag: "BEARISH SIGNAL",
    tone: "short",
    icon: "↑✗",
    tagline:
      "Price tries to reclaim a swept level and fails. Continuation lower.",
    what: "After a High Sweep, price attempts to push back above the swept level (the bulls try to reclaim). When this attempt fails and price closes back below, it signals the bears are still in control and a new leg lower is likely. This is a higher conviction entry than the original sweep.",
    entry:
      "Short on the candle that fails to close above the level on the reclaim attempt. The failed reclaim IS the entry signal.",
    stop: "Above the failed reclaim candle's high.",
    tp1: "Low of the sweep candle or recent demand. 2R+.",
    tp2: "Next major support. 3–5R targets common.",
    mistakes: [
      "Confusing a successful reclaim (bullish) with a failed one — one close matters enormously.",
      "Entering on the first rejection without confirming the candle closes below.",
      "Placing stop too tight — failed reclaims can have multiple attempts before failing.",
      "Missing that this is a continuation entry, not a reversal — the trend was already down.",
    ],
    good: "Clear attempt to push above the swept level followed by a bearish close below it. Increasing volume on the failure. EMA99 overhead.",
    bad: "Price closes above the level on the reclaim — that's a successful reclaim, not a failure. Low volume on the attempt.",
    color: palette.short,
    bg: palette.shortSoft,
  },
  {
    id: "sweep_confirmed",
    name: "Sweep Confirmed",
    tag: "DISPLACEMENT",
    tone: "gold",
    icon: "✓→",
    tagline: "The move fires. Displacement confirms the sweep was real.",
    what: "After a sweep and reclaim, a strong displacement candle moves away from the level with above-average range and volume. This is the highest conviction event — it tells you institutional orders have been filled and the move is underway.",
    entry:
      "The displacement candle itself is often too late for a clean entry. Look for a pullback to the reclaim level or the 50% of the displacement candle.",
    stop: "Below the swept level (for shorts) or above it (for longs). Never below the displacement candle's tail.",
    tp1: "Pre-defined TP from original sweep plan. 2–3R.",
    tp2: "Extended target. 4–6R on strong confirmations.",
    mistakes: [
      "Chasing the displacement candle at its high/low — wait for a retest.",
      "Treating any strong candle as displacement — it must occur after a sweep and reclaim.",
      "Moving TP targets too early because the move looks 'too big' — trust the plan.",
      "Ignoring session context — displacement in off-hours has less follow-through.",
    ],
    good: "Large candle (2x+ ATR), strong close, above-average volume, occurs within 3 bars of the reclaim. Clean break of structure above/below.",
    bad: "Small candle, closes near its open, average volume, occurs 10+ bars after the reclaim. Market is in choppy range.",
    color: palette.gold,
    bg: palette.goldSoft,
  },
  {
    id: "market_confirmation",
    name: "Market Confirmation",
    tag: "EXECUTION",
    tone: "neutral",
    icon: "→✓",
    tagline: "Entering on market close instead of a limit retest.",
    what: "Instead of waiting for price to retest the entry level on a limit order, you enter on market close when the confirmation candle closes. Higher fill rate, slightly worse entry price. Best used when the setup is A+ and you can't risk missing the move.",
    entry:
      "Market order on the close of the confirmation candle. Accept the slightly worse fill as the cost of certainty.",
    stop: "Same as limit retest — above/below the swept level. Stop doesn't change based on entry type.",
    tp1: "Slightly lower R than limit entry due to worse fill. Still target 1.5R minimum.",
    tp2: "Same target as limit entry. The extra cost is worth it on high-conviction setups.",
    mistakes: [
      "Using market confirmation on every trade — reserve it for setups where missing is worse than a bad fill.",
      "Widening the stop to compensate for the worse entry — this kills the RR.",
      "Market confirming into a setup that's already moved 1R+ — you've missed it.",
      "Not adjusting position size to account for the wider effective spread.",
    ],
    good: "A+ setup with a tight window. London or NY open. Signal is ACTIONABLE not MOVED. You have a clear reason for not using a limit.",
    bad: "Mediocre setup. Already MOVED state in the signal bar. Off-hours thin liquidity. RR below 1.5R after the worse fill.",
    color: palette.textSoft,
    bg: "rgba(255,255,255,0.04)",
  },
];

// ─── Psychology Vault Data ────────────────────────────────────────────────────

const PSYCH_ARTICLES = [
  {
    id: "stop_moving",
    category: "Risk",
    title: "Why Traders Move Their Stops",
    readTime: "40s",
    color: palette.short,
    body: `You had a plan. The stop was set. Then price got close and you moved it.

Here's what actually happened: your brain switched from trading mode to hoping mode. The moment you move a stop, you've stopped trading your system and started negotiating with the market.

Moving a stop wider doesn't give the trade more room. It gives your loss more room.

The stop is not arbitrary. It's the price at which your thesis is wrong. If you move it, you're saying your thesis can be wrong at a different price too. But that new price has no logic behind it — it's just a number that feels less painful.

**The fix:** Before entering, write down your stop and the word "invalid." When price hits that level, your thesis is invalid. Not unlucky. Invalid.

A thesis that's wrong at $1.152 is still wrong at $1.148. You're not giving it room. You're giving yourself permission to stay wrong longer.`,
  },
  {
    id: "revenge_trading",
    category: "Psychology",
    title: "Revenge Trading Patterns",
    readTime: "45s",
    color: palette.short,
    body: `Revenge trading doesn't feel like revenge. It feels like urgency.

After a loss, your brain registers a threat. Not just to your account — to your identity. You think of yourself as a good trader. That loss is evidence against that belief. So you need to erase it fast.

The next trade isn't a trade. It's an argument.

You're not looking for a setup. You're looking for a way to prove the last trade was a fluke. So you take something marginal. You size up because you need to recover faster. You skip your checklist because you already know you're right this time.

This is how one bad trade becomes a bad session.

**The pattern to recognize:** If your reason for entering a trade includes the phrase "to make back" — stop. Log off. Come back in an hour.

The market doesn't know about your last trade. It's not going to give you a gift. The only edge you had was your process, and you just abandoned it.`,
  },
  {
    id: "early_entry",
    category: "Execution",
    title: "Early Entry Syndrome",
    readTime: "35s",
    color: palette.gold,
    body: `Early entry feels like anticipation. It is actually fear of missing out wearing a disguise.

You see a setup forming. The sweep happened. You don't wait for the reclaim candle to close. You enter on the wick. Sometimes it works — which makes it worse, because you now have evidence that impatience pays.

But over 50 trades, early entries kill you. You're entering before the thesis is confirmed. You're getting stopped out on setups that would have worked if you'd waited 60 more seconds.

The reclaim candle close is not a formality. It's the moment the market shows its hand. Before that close, you don't know if the sweep is real or if price is just grinding through the level.

**The fix is boring:** Write WAIT on a sticky note and put it on your monitor. Your entry is not the sweep. Your entry is the close of the reclaim candle. Everything before that is observation, not action.`,
  },
  {
    id: "fomo_missed",
    category: "Psychology",
    title: "FOMO After a Missed Move",
    readTime: "40s",
    color: palette.gold,
    body: `You saw the setup. You hesitated. The trade ran 3R without you.

Now another signal appears on a different pair. It's okay — not great, but okay. And you take it, because you need to be in something. You need to participate. You need to feel like a trader.

This is FOMO, and it's not about the trade you missed. It's about your relationship with regret.

The missed trade is gone. It cannot be retrieved. The opportunity cost is real but it is fixed — it will not get larger. Every trade you take to compensate for it adds new risk on top of an already emotional state.

**What actually happened when you missed that trade:** Nothing. Your account didn't change. Your edge is intact. You preserved capital. That is a good outcome.

The market runs multiple A+ setups every session. Missing one is not a disaster. Chasing it with a C+ setup because you feel behind — that is.`,
  },
  {
    id: "boring_setups",
    category: "Mindset",
    title: "Why A+ Setups Feel Boring",
    readTime: "30s",
    color: palette.long,
    body: `The best setups feel obvious in retrospect. In the moment, they feel slow and dull.

You waited. The sweep happened. The reclaim formed. The displacement is underway. Everything checked out. You entered.

And now you're watching a trade work exactly as planned. No drama. No near-misses. No heroic saves. Just... a trade doing what you expected.

This feels anticlimactic because your brain is calibrated for stories. It likes tension, reversal, rescue. A trade that just works is narratively boring.

But this is what you should be hunting. The boring, obvious, everything-lined-up trade. Not the creative rescue. Not the gut feel. Not the "I just knew."

**The trades that feel exciting are usually warning signs.** If you're excited before entry, check your checklist twice. If it still passes, great. If you skipped steps because the excitement told you it was fine — that's the problem.

A+ setups are boring. That is the point.`,
  },
  {
    id: "overconfidence",
    category: "Risk",
    title: "Overconfidence After Wins",
    readTime: "35s",
    color: palette.short,
    body: `Three wins in a row does something to your brain. It convinces you that you've unlocked something. That you're seeing the market more clearly than usual.

You haven't. You had three good setups and executed them well. That's it.

But your brain interprets the streak as evidence of a new, higher level of skill. So on trade four, your position size creeps up. Your checklist gets a little shorter. The setup is a little less clean, but you feel good about it.

This is where drawdowns come from. Not from randomly bad trades. From good trades followed by overconfident trades.

**The rule:** Your position size has nothing to do with your last trade. It is determined by your setup quality and risk rules, calculated fresh for each trade as if you had no history.

Three wins in a row means your process worked three times. It is not permission to risk more.`,
  },
  {
    id: "session_bias",
    category: "Execution",
    title: "Trading the Wrong Session",
    readTime: "30s",
    color: palette.gold,
    body: `Not all hours are equal. Most traders lose money between 11am and 1pm New York time without ever noticing the pattern.

Midday chop is real. Volume drops. Spreads widen. The sweeps that fire during London open and NY open often fail during dead hours because there aren't enough participants to follow through.

Your bot knows this. That's why it has session awareness. The signal bar shows you which session you're in.

**The simplest improvement most traders can make:** Stop trading between NY midday and the afternoon session open unless you have a specific reason not to. Log it in your journal instead. Review it. You will almost certainly find a cluster of your worst trades there.

The market doesn't owe you opportunities in every hour. Some hours exist to take money from people who need to be in a trade.`,
  },
  {
    id: "tp_too_early",
    category: "Management",
    title: "Taking Profit Too Early",
    readTime: "35s",
    color: palette.gold,
    body: `You planned for 3R. At 1.5R you closed half. At 2R you closed everything.

The trade hit 4R an hour later.

This happens constantly, and it comes from the same place as moving your stop: you switched from executing your plan to managing your feelings.

At 1.5R, you were happy. You didn't want to give that back. So you took it. The problem is that 1.5R trades, repeated over a year, don't build accounts. 3R trades do — but only if you stay in them.

The plan said 3R. The plan was made when you were calm, systematic, and thinking clearly. The decision to exit at 1.5R was made while you were watching a green number and feeling something.

**One rule:** Once a trade is in profit and your stop is moved to breakeven, your only remaining job is to let it reach TP1. The management phase of a trade should be the most boring part. If it's not, you're managing feelings, not a trade.`,
  },
];

// ─── Video Library Data ───────────────────────────────────────────────────────

const VIDEO_LIBRARY = [
  {
    id: "douglas",
    teacher: "Mark Douglas",
    teacherBio:
      "Author of Trading in the Zone. The definitive voice on trading psychology and probabilistic thinking.",
    teacherColor: "#60a5fa",
    videos: [
      {
        id: "md1",
        title: "Trading in the Zone — Full Seminar",
        description:
          "The complete Mark Douglas seminar on probabilistic thinking, removing fear from trading, and building consistency. Required watching.",
        youtubeId: "laHlPCgFHTo",
        duration: "2h 18m",
      },
      {
        id: "md2",
        title: "How to Think Like a Professional Trader",
        description:
          "Mark Douglas breaks down the five fundamental truths every trader must internalize to stop fighting the market.",
        youtubeId: "7ocTVm-M7q8",
        duration: "58m",
      },
      {
        id: "md3",
        title: "The Mental Game of Trading",
        description:
          "Deep dive into why traders self-sabotage and how to rewire your relationship with uncertainty and risk.",
        youtubeId: "sg4YzRhILFE",
        duration: "1h 12m",
      },
    ],
  },
  {
    id: "paul",
    teacher: "David Paul",
    teacherBio:
      "Veteran trader and educator known for institutional price action, liquidity concepts, and market structure. Decades of live trading experience.",
    teacherColor: "#f6c453",
    videos: [
      {
        id: "dp1",
        title: "Institutional Price Action Masterclass",
        description:
          "David Paul walks through how institutions move markets, where they accumulate and distribute, and how retail traders can align with them.",
        youtubeId: "gAYLXYmUUCg",
        duration: "1h 45m",
      },
      {
        id: "dp2",
        title: "Reading Market Structure Like a Pro",
        description:
          "How to identify genuine market structure shifts vs. noise, and why most traders misread swing highs and lows.",
        youtubeId: "GKckbawOVeU",
        duration: "52m",
      },
      {
        id: "dp3",
        title: "Liquidity, Stop Hunts & Smart Money",
        description:
          "The mechanics behind stop hunts, liquidity grabs, and how to use them as entry signals instead of getting caught on the wrong side.",
        youtubeId: "MGglyvc8d58",
        duration: "1h 3m",
      },
    ],
  },
];

// ─── Video Library Component ──────────────────────────────────────────────────

function VideoLibraryPage() {
  const [activeTeacher, setActiveTeacher] = useState(VIDEO_LIBRARY[0].id);
  const [activeVideo, setActiveVideo] = useState(null);

  const teacher =
    VIDEO_LIBRARY.find((t) => t.id === activeTeacher) || VIDEO_LIBRARY[0];
  const currentVideo = activeVideo || teacher.videos[0];

  return (
    <div style={{ display: "grid", gap: 24, maxWidth: 960, margin: "0 auto" }}>
      <div style={{ display: "grid", gap: 8 }}>
        <div
          style={{
            fontSize: 10,
            color: palette.textDim,
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          Members Vault
        </div>
        <div style={{ fontSize: 28, fontWeight: 900 }}>Video Library</div>
        <div style={{ fontSize: 13, color: palette.textSoft, lineHeight: 1.6 }}>
          Curated sessions from the traders who changed how serious people think
          about markets.
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {VIDEO_LIBRARY.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setActiveTeacher(t.id);
              setActiveVideo(null);
            }}
            style={{
              appearance: "none",
              border: `1px solid ${activeTeacher === t.id ? t.teacherColor + "66" : "rgba(255,255,255,0.08)"}`,
              background:
                activeTeacher === t.id ? t.teacherColor + "12" : "transparent",
              color: activeTeacher === t.id ? t.teacherColor : palette.textDim,
              borderRadius: 12,
              padding: "8px 18px",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: activeTeacher === t.id ? 800 : 600,
              transition: "all 0.15s ease",
            }}
          >
            {t.teacher}
          </button>
        ))}
      </div>
      <div
        style={{
          padding: "14px 18px",
          borderRadius: 14,
          border: `1px solid ${teacher.teacherColor}22`,
          background: `${teacher.teacherColor}08`,
          fontSize: 13,
          color: palette.textSoft,
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: teacher.teacherColor, fontWeight: 800 }}>
          {teacher.teacher} —{" "}
        </strong>
        {teacher.teacherBio}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 280px",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: 10 }}>
          <div
            style={{
              borderRadius: 16,
              overflow: "hidden",
              border: `1px solid ${teacher.teacherColor}33`,
              aspectRatio: "16/9",
              background: "#000",
            }}
          >
            <iframe
              key={currentVideo.youtubeId}
              src={`https://www.youtube.com/embed/${currentVideo.youtubeId}?rel=0&modestbranding=1`}
              title={currentVideo.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                display: "block",
              }}
            />
          </div>
          <div
            style={{
              border: `1px solid ${palette.border}`,
              borderRadius: 14,
              padding: "14px 16px",
              background:
                "linear-gradient(180deg,rgba(15,20,32,0.96),rgba(10,14,24,0.96))",
              display: "grid",
              gap: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.3 }}>
                {currentVideo.title}
              </div>
              <a
                href={`https://www.youtube.com/watch?v=${currentVideo.youtubeId}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "6px 12px",
                  borderRadius: 8,
                  background: "rgba(255,0,0,0.12)",
                  border: "1px solid rgba(255,0,0,0.25)",
                  color: "#ff4444",
                  fontSize: 11,
                  fontWeight: 800,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                ▶ YouTube ↗
              </a>
            </div>
            <div
              style={{ fontSize: 12, color: palette.textSoft, lineHeight: 1.6 }}
            >
              {currentVideo.description}
            </div>
            <div
              style={{ fontSize: 11, color: palette.textDim, fontWeight: 700 }}
            >
              {teacher.teacher} · {currentVideo.duration}
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: palette.textDim,
              marginBottom: 4,
            }}
          >
            All videos
          </div>
          {teacher.videos.map((video) => {
            const isActive = video.youtubeId === currentVideo.youtubeId;
            return (
              <button
                key={video.id}
                onClick={() => setActiveVideo(video)}
                style={{
                  appearance: "none",
                  border: `1px solid ${isActive ? teacher.teacherColor + "44" : "rgba(255,255,255,0.06)"}`,
                  background: isActive
                    ? `${teacher.teacherColor}10`
                    : "rgba(255,255,255,0.02)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  cursor: "pointer",
                  textAlign: "left",
                  color: palette.text,
                  display: "grid",
                  gap: 6,
                  transition: "all 0.15s ease",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: isActive ? 800 : 700,
                    color: isActive ? teacher.teacherColor : palette.text,
                    lineHeight: 1.4,
                  }}
                >
                  {video.title}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: 10, color: palette.textDim }}>
                    {video.duration}
                  </span>
                  {isActive && (
                    <span
                      style={{
                        fontSize: 10,
                        color: teacher.teacherColor,
                        fontWeight: 800,
                      }}
                    >
                      ▶ Playing
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Pill component ───────────────────────────────────────────────────────────

function Pill({ children, tone = "neutral", small }) {
  const map = {
    neutral: {
      color: "rgba(244,247,251,0.66)",
      bg: "rgba(255,255,255,0.05)",
      border: "rgba(255,255,255,0.08)",
    },
    long: {
      color: palette.long,
      bg: palette.longSoft,
      border: "rgba(74,222,128,0.26)",
    },
    short: {
      color: palette.short,
      bg: palette.shortSoft,
      border: "rgba(251,113,133,0.26)",
    },
    gold: {
      color: palette.gold,
      bg: palette.goldSoft,
      border: "rgba(246,196,83,0.24)",
    },
    blue: {
      color: palette.blue,
      bg: palette.blueSoft,
      border: "rgba(96,165,250,0.24)",
    },
  };
  const s = map[tone] || map.neutral;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: small ? "2px 7px" : "4px 10px",
        borderRadius: 999,
        fontSize: small ? 10 : 11,
        fontWeight: 800,
        letterSpacing: 0.3,
        color: s.color,
        background: s.bg,
        border: `1px solid ${s.border}`,
      }}
    >
      {children}
    </span>
  );
}

// ─── Pattern Card (grid view) ─────────────────────────────────────────────────

function PatternCard({ pattern, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={() => onClick(pattern)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        appearance: "none",
        WebkitAppearance: "none",
        border: `1px solid ${hovered ? pattern.color.replace(")", ",0.4)").replace("rgb", "rgba") : "rgba(255,255,255,0.08)"}`,
        background: hovered
          ? pattern.bg
          : "linear-gradient(180deg,rgba(15,20,32,0.96),rgba(10,14,24,0.96))",
        borderRadius: 18,
        padding: "20px 22px",
        cursor: "pointer",
        textAlign: "left",
        color: palette.text,
        display: "grid",
        gap: 12,
        transition: "all 0.2s ease",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        boxShadow: hovered ? `0 8px 24px ${pattern.bg}` : "none",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            fontSize: 28,
            fontWeight: 900,
            fontFamily: "monospace",
            color: pattern.color,
            opacity: 0.8,
          }}
        >
          {pattern.icon}
        </div>
        <Pill tone={pattern.tone} small>
          {pattern.tag}
        </Pill>
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 6 }}>
          {pattern.name}
        </div>
        <div style={{ fontSize: 12, color: palette.textSoft, lineHeight: 1.5 }}>
          {pattern.tagline}
        </div>
      </div>
      <div
        style={{
          fontSize: 11,
          color: pattern.color,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        Read pattern guide →
      </div>
    </button>
  );
}

// ─── Pattern Detail View ──────────────────────────────────────────────────────

function PatternDetail({ pattern, onBack }) {
  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 860, margin: "0 auto" }}>
      <button
        onClick={onBack}
        style={{
          appearance: "none",
          border: "none",
          background: "none",
          color: palette.textDim,
          cursor: "pointer",
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: 0,
          width: "fit-content",
        }}
      >
        ← Back to patterns
      </button>

      {/* Header */}
      <div
        style={{
          borderRadius: 22,
          border: `1px solid ${pattern.color}33`,
          background: `linear-gradient(135deg, ${pattern.bg}, rgba(5,8,14,0.98))`,
          padding: "28px 32px",
          display: "grid",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 36,
              fontFamily: "monospace",
              color: pattern.color,
            }}
          >
            {pattern.icon}
          </span>
          <div>
            <div
              style={{
                fontSize: 10,
                color: palette.textDim,
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              Pattern Guide
            </div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{pattern.name}</div>
          </div>
          <Pill tone={pattern.tone}>{pattern.tag}</Pill>
        </div>
        <div
          style={{
            fontSize: 15,
            color: palette.textSoft,
            lineHeight: 1.6,
            maxWidth: 600,
          }}
        >
          {pattern.tagline}
        </div>
      </div>

      {/* What it is */}
      <Section title="What it looks like" accent={pattern.color}>
        <p style={{ color: palette.textSoft, lineHeight: 1.7, fontSize: 14 }}>
          {pattern.what}
        </p>
      </Section>

      {/* Entry / Stop / TP grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 12,
        }}
      >
        <LevelCard label="ENTRY" color="#60a5fa" content={pattern.entry} />
        <LevelCard label="STOP" color={palette.short} content={pattern.stop} />
        <LevelCard
          label="TP1 / TP2"
          color={palette.long}
          content={`${pattern.tp1}\n\n${pattern.tp2}`}
        />
      </div>

      {/* Good vs Bad */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <ExampleCard type="good" content={pattern.good} />
        <ExampleCard type="bad" content={pattern.bad} />
      </div>

      {/* Common mistakes */}
      <Section title="Common mistakes" accent={palette.short}>
        <div style={{ display: "grid", gap: 8 }}>
          {pattern.mistakes.map((m, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                fontSize: 13,
                color: palette.textSoft,
                lineHeight: 1.5,
              }}
            >
              <span
                style={{
                  color: palette.short,
                  fontSize: 16,
                  marginTop: 1,
                  flexShrink: 0,
                }}
              >
                ✗
              </span>
              <span>{m}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, accent, children }) {
  return (
    <div
      style={{
        border: `1px solid ${palette.border}`,
        background:
          "linear-gradient(180deg,rgba(15,20,32,0.96),rgba(10,14,24,0.96))",
        borderRadius: 18,
        padding: "20px 22px",
        display: "grid",
        gap: 12,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: accent || palette.textDim,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function LevelCard({ label, color, content }) {
  return (
    <div
      style={{
        border: `1px solid ${color}33`,
        background: `${color}0d`,
        borderRadius: 14,
        padding: "14px 16px",
        display: "grid",
        gap: 8,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 12,
          color: palette.textSoft,
          lineHeight: 1.6,
          whiteSpace: "pre-line",
        }}
      >
        {content}
      </div>
    </div>
  );
}

function ExampleCard({ type, content }) {
  const isGood = type === "good";
  const color = isGood ? palette.long : palette.short;
  const icon = isGood ? "✓" : "✗";
  const label = isGood
    ? "What a good setup looks like"
    : "What a bad setup looks like";
  return (
    <div
      style={{
        border: `1px solid ${color}33`,
        background: `${color}0d`,
        borderRadius: 14,
        padding: "14px 16px",
        display: "grid",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color, fontSize: 16, fontWeight: 900 }}>{icon}</span>
        <div
          style={{
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color,
          }}
        >
          {label}
        </div>
      </div>
      <div style={{ fontSize: 12, color: palette.textSoft, lineHeight: 1.6 }}>
        {content}
      </div>
    </div>
  );
}

// ─── Psychology Article Card ──────────────────────────────────────────────────

function ArticleCard({ article, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={() => onClick(article)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        appearance: "none",
        WebkitAppearance: "none",
        border: `1px solid ${hovered ? "rgba(255,255,255,0.14)" : palette.border}`,
        background: hovered
          ? "rgba(255,255,255,0.04)"
          : "linear-gradient(180deg,rgba(15,20,32,0.96),rgba(10,14,24,0.96))",
        borderRadius: 16,
        padding: "18px 20px",
        cursor: "pointer",
        textAlign: "left",
        color: palette.text,
        display: "grid",
        gap: 10,
        transition: "all 0.15s ease",
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <Pill tone="neutral" small>
          {article.category}
        </Pill>
        <span style={{ fontSize: 11, color: palette.textDim, fontWeight: 600 }}>
          {article.readTime} read
        </span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.4 }}>
        {article.title}
      </div>
      <div style={{ fontSize: 12, color: palette.textSoft, lineHeight: 1.5 }}>
        {article.body.split("\n")[0].slice(0, 100)}…
      </div>
      <div style={{ fontSize: 11, color: article.color, fontWeight: 700 }}>
        Read →
      </div>
    </button>
  );
}

// ─── Psychology Article Detail ────────────────────────────────────────────────

function ArticleDetail({ article, onBack }) {
  // Format body — bold **text** and paragraph breaks
  const formatted = article.body.split("\n").map((line, i) => {
    if (!line.trim()) return <br key={i} />;
    const parts = line.split(/(\*\*.*?\*\*)/g);
    return (
      <p
        key={i}
        style={{
          margin: "0 0 4px",
          lineHeight: 1.75,
          fontSize: 14,
          color: line.startsWith("**") ? palette.text : palette.textSoft,
        }}
      >
        {parts.map((part, j) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={j} style={{ color: palette.text, fontWeight: 800 }}>
              {part.slice(2, -2)}
            </strong>
          ) : (
            part
          ),
        )}
      </p>
    );
  });

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", display: "grid", gap: 16 }}>
      <button
        onClick={onBack}
        style={{
          appearance: "none",
          border: "none",
          background: "none",
          color: palette.textDim,
          cursor: "pointer",
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: 0,
          width: "fit-content",
        }}
      >
        ← Back to psychology vault
      </button>

      <div
        style={{
          borderLeft: `3px solid ${article.color}`,
          paddingLeft: 20,
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Pill tone="neutral" small>
            {article.category}
          </Pill>
          <span style={{ fontSize: 11, color: palette.textDim }}>
            {article.readTime} read
          </span>
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.25 }}>
          {article.title}
        </div>
      </div>

      <div
        style={{
          border: `1px solid ${palette.border}`,
          background:
            "linear-gradient(180deg,rgba(15,20,32,0.96),rgba(10,14,24,0.96))",
          borderRadius: 18,
          padding: "24px 28px",
          display: "grid",
          gap: 4,
        }}
      >
        {formatted}
      </div>
    </div>
  );
}

// ─── Trader DNA Page ─────────────────────────────────────────────────────────

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

function DnaStatBar({ label, value, max = 100, color }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: palette.textSoft,
        }}
      >
        <span>{label}</span>
        <span style={{ color, fontWeight: 800 }}>{value}</span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 999,
            background: color,
            transition: "width 0.8s ease",
          }}
        />
      </div>
    </div>
  );
}

function DnaCard({ label, value, subtext, accent, icon }) {
  return (
    <div
      style={{
        border: `1px solid ${accent}33`,
        background: `${accent}0d`,
        borderRadius: 16,
        padding: "16px 18px",
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
        <div
          style={{
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: accent,
          }}
        >
          {label}
        </div>
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 800,
          color: palette.text,
          lineHeight: 1.4,
        }}
      >
        {value || "—"}
      </div>
      {subtext && (
        <div style={{ fontSize: 12, color: palette.textSoft, lineHeight: 1.5 }}>
          {subtext}
        </div>
      )}
    </div>
  );
}

function TraderDnaPage({
  dna,
  setDna,
  loading,
  setLoading,
  error,
  setError,
  currentUser,
}) {
  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`${API_BASE}/trader-dna`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Failed");
      setDna(data.dna);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 24, maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "grid", gap: 8 }}>
        <div
          style={{
            fontSize: 10,
            color: palette.textDim,
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          Members Vault
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 36, fontWeight: 900 }}>
            Trader DNA
            <sup
              style={{
                fontSize: 14,
                color: palette.gold,
                fontWeight: 900,
                marginLeft: 3,
              }}
            >
              ™
            </sup>
          </div>
          <span
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              background: "rgba(96,165,250,0.12)",
              border: "1px solid rgba(96,165,250,0.24)",
              fontSize: 11,
              fontWeight: 800,
              color: palette.blue,
            }}
          >
            Claude-Reviewed™
          </span>
        </div>
        <div
          style={{
            fontSize: 14,
            color: palette.textSoft,
            maxWidth: 540,
            lineHeight: 1.6,
          }}
        >
          AI synthesizes every trade you've logged into a personal performance
          profile. Gets smarter as you log more trades. Requires 10+ trades.
        </div>
      </div>

      {/* Generate button or results */}
      {!dna && !loading && (
        <div
          style={{
            border: `1px solid ${palette.border}`,
            borderRadius: 20,
            padding: "40px 32px",
            textAlign: "center",
            display: "grid",
            gap: 16,
            background:
              "linear-gradient(180deg,rgba(15,20,32,0.96),rgba(10,14,24,0.96))",
          }}
        >
          <div style={{ fontSize: 56 }}>🧬</div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>
            Generate Your DNA Profile
          </div>
          <div
            style={{
              fontSize: 13,
              color: palette.textSoft,
              maxWidth: 400,
              margin: "0 auto",
              lineHeight: 1.6,
            }}
          >
            Claude will analyze all your logged trades and build a detailed
            psychological and performance profile unique to you.
          </div>
          {error && (
            <div
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                background: "rgba(251,113,133,0.1)",
                border: "1px solid rgba(251,113,133,0.3)",
                color: palette.short,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {error}
            </div>
          )}
          <button
            onClick={generate}
            style={{
              appearance: "none",
              border: "none",
              borderRadius: 14,
              padding: "14px 32px",
              background: "linear-gradient(135deg,#f6c453,#d97706)",
              color: "#000",
              fontWeight: 900,
              fontSize: 15,
              cursor: "pointer",
              margin: "0 auto",
              letterSpacing: 0.3,
            }}
          >
            🧬 Generate Trader DNA
          </button>
        </div>
      )}

      {loading && (
        <div
          style={{
            border: `1px solid ${palette.border}`,
            borderRadius: 20,
            padding: "60px 32px",
            textAlign: "center",
            display: "grid",
            gap: 16,
            background:
              "linear-gradient(180deg,rgba(15,20,32,0.96),rgba(10,14,24,0.96))",
          }}
        >
          <div style={{ fontSize: 48, animation: "spin 2s linear infinite" }}>
            🧬
          </div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>
            Analyzing your trades…
          </div>
          <div style={{ fontSize: 13, color: palette.textSoft }}>
            Claude is reading your trade history and building your profile.
          </div>
          <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
        </div>
      )}

      {dna && !loading && (
        <div style={{ display: "grid", gap: 16 }}>
          {/* Trader type badge + overall */}
          <div
            style={{
              borderRadius: 22,
              border: `1px solid rgba(246,196,83,0.3)`,
              background:
                "linear-gradient(135deg,rgba(246,196,83,0.08),rgba(5,8,14,0.98))",
              padding: "28px 32px",
              display: "grid",
              gap: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: palette.gold,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    fontWeight: 800,
                    marginBottom: 6,
                  }}
                >
                  Your Trader Type
                </div>
                <div style={{ fontSize: 26, fontWeight: 900 }}>
                  {dna.traderType || "—"}
                </div>
              </div>
              <div style={{ display: "grid", gap: 6, textAlign: "right" }}>
                <div
                  style={{
                    fontSize: 11,
                    color: palette.textDim,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  Risk Discipline
                </div>
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 900,
                    color:
                      dna.riskDisciplineScore >= 70
                        ? palette.long
                        : dna.riskDisciplineScore >= 40
                          ? palette.gold
                          : palette.short,
                  }}
                >
                  {dna.riskDisciplineScore ?? "—"}
                  <span style={{ fontSize: 16, color: palette.textDim }}>
                    /100
                  </span>
                </div>
              </div>
            </div>
            <div
              style={{
                fontSize: 14,
                color: palette.textSoft,
                lineHeight: 1.7,
                borderTop: `1px solid ${palette.borderSoft}`,
                paddingTop: 14,
              }}
            >
              {dna.overallAssessment}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 12,
              }}
            >
              <div
                style={{
                  textAlign: "center",
                  padding: "10px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: palette.textDim,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Trades
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>
                  {dna.totalTrades ?? "—"}
                </div>
              </div>
              <div
                style={{
                  textAlign: "center",
                  padding: "10px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: palette.textDim,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Win Rate
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                    color: palette.long,
                    marginTop: 4,
                  }}
                >
                  {dna.winRate != null
                    ? `${Math.round(dna.winRate * 100)}%`
                    : "—"}
                </div>
              </div>
              <div
                style={{
                  textAlign: "center",
                  padding: "10px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: palette.textDim,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Avg RR
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                    color: palette.blue,
                    marginTop: 4,
                  }}
                >
                  {dna.avgRR != null ? `${Number(dna.avgRR).toFixed(2)}R` : "—"}
                </div>
              </div>
            </div>
            <DnaStatBar
              label="Risk Discipline Score"
              value={dna.riskDisciplineScore ?? 0}
              color={
                dna.riskDisciplineScore >= 70
                  ? palette.long
                  : dna.riskDisciplineScore >= 40
                    ? palette.gold
                    : palette.short
              }
            />
          </div>

          {/* Strengths + Weaknesses */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            <div
              style={{
                border: `1px solid rgba(74,222,128,0.2)`,
                background: "rgba(74,222,128,0.04)",
                borderRadius: 18,
                padding: "20px 22px",
                display: "grid",
                gap: 12,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: palette.long,
                }}
              >
                Strengths
              </div>
              {(dna.strengths || []).map((s, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    fontSize: 13,
                    color: palette.textSoft,
                    lineHeight: 1.5,
                  }}
                >
                  <span
                    style={{ color: palette.long, fontSize: 16, flexShrink: 0 }}
                  >
                    ✓
                  </span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
            <div
              style={{
                border: `1px solid rgba(251,113,133,0.2)`,
                background: "rgba(251,113,133,0.04)",
                borderRadius: 18,
                padding: "20px 22px",
                display: "grid",
                gap: 12,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: palette.short,
                }}
              >
                Weaknesses
              </div>
              {(dna.weaknesses || []).map((w, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    fontSize: 13,
                    color: palette.textSoft,
                    lineHeight: 1.5,
                  }}
                >
                  <span
                    style={{
                      color: palette.short,
                      fontSize: 16,
                      flexShrink: 0,
                    }}
                  >
                    ✗
                  </span>
                  <span>{w}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Session + Setup breakdown */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2,1fr)",
              gap: 14,
            }}
          >
            <DnaCard
              label="Best Session"
              value={dna.bestSession}
              icon="🟢"
              accent="#4ade80"
            />
            <DnaCard
              label="Worst Session"
              value={dna.worstSession}
              icon="🔴"
              accent="#fb7185"
            />
            <DnaCard
              label="Best Setup"
              value={dna.bestSetup}
              icon="⭐"
              accent="#f6c453"
            />
            <DnaCard
              label="Worst Setup"
              value={dna.worstSetup}
              icon="⚠️"
              accent="#f87171"
            />
          </div>

          {/* Pattern bias + coaching focus */}
          <div
            style={{
              border: `1px solid ${palette.border}`,
              borderRadius: 18,
              padding: "20px 22px",
              display: "grid",
              gap: 14,
              background:
                "linear-gradient(180deg,rgba(15,20,32,0.96),rgba(10,14,24,0.96))",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: palette.textDim,
                  marginBottom: 8,
                }}
              >
                Pattern Bias
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: palette.textSoft,
                  lineHeight: 1.6,
                }}
              >
                {dna.patternBias || "—"}
              </div>
            </div>
            <div
              style={{
                borderTop: `1px solid ${palette.borderSoft}`,
                paddingTop: 14,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: palette.gold,
                  marginBottom: 8,
                }}
              >
                🎯 Coaching Focus This Week
              </div>
              <div
                style={{
                  fontSize: 15,
                  color: palette.text,
                  lineHeight: 1.6,
                  fontWeight: 700,
                }}
              >
                {dna.coachingFocus || "—"}
              </div>
            </div>
          </div>

          {/* Regenerate */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 12,
              paddingTop: 8,
            }}
          >
            <button
              onClick={generate}
              style={{
                appearance: "none",
                border: `1px solid ${palette.border}`,
                borderRadius: 12,
                padding: "10px 24px",
                background: "rgba(255,255,255,0.04)",
                color: palette.textSoft,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              🔄 Regenerate Profile
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main MembersVault component ──────────────────────────────────────────────

export default function MembersVault({ onBack, currentUser, featureFlags }) {
  const [activeSection, setActiveSection] = useState("home");
  const [selectedPattern, setSelectedPattern] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [patternFilter, setPatternFilter] = useState("all");
  const [articleFilter, setArticleFilter] = useState("all");
  const [dna, setDna] = useState(null);
  const [dnaLoading, setDnaLoading] = useState(false);
  const [dnaError, setDnaError] = useState(null);

  const isPro =
    ["active", "trialing", "beta", "pro"].includes(
      currentUser?.stripeStatus || "",
    ) || featureFlags?.aiReview;

  const patternTones = ["all", "short", "long", "gold", "neutral"];
  const articleCategories = [
    "all",
    "Risk",
    "Psychology",
    "Execution",
    "Mindset",
    "Management",
  ];

  const filteredPatterns =
    patternFilter === "all"
      ? PATTERNS
      : PATTERNS.filter((p) => p.tone === patternFilter);
  const filteredArticles =
    articleFilter === "all"
      ? PSYCH_ARTICLES
      : PSYCH_ARTICLES.filter((a) => a.category === articleFilter);

  if (!isPro) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: `radial-gradient(circle at 15% 20%, rgba(239,68,68,0.08), transparent 40%), linear-gradient(180deg,#060a12,#03060b)`,
          display: "grid",
          placeItems: "center",
          fontFamily: "Inter, ui-sans-serif, sans-serif",
          color: palette.text,
        }}
      >
        <div
          style={{
            textAlign: "center",
            display: "grid",
            gap: 20,
            padding: 32,
            maxWidth: 420,
          }}
        >
          <div style={{ fontSize: 48 }}>🔒</div>
          <div
            style={{
              fontSize: 10,
              color: palette.textDim,
              letterSpacing: 3,
              textTransform: "uppercase",
            }}
          >
            Members Vault
          </div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>Pro Access Only</div>
          <div
            style={{ fontSize: 14, color: palette.textSoft, lineHeight: 1.6 }}
          >
            The Members Vault is available on Pro plans. Upgrade to unlock the
            Pattern Library, Psychology Vault, and everything coming next.
          </div>
          <button
            onClick={onBack}
            style={{
              border: `1px solid ${palette.border}`,
              borderRadius: 14,
              padding: "11px 20px",
              background:
                "linear-gradient(180deg,rgba(20,27,42,0.96),rgba(12,17,28,0.96))",
              color: palette.text,
              cursor: "pointer",
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `radial-gradient(circle at 15% 20%, rgba(239,68,68,0.08), transparent 40%), linear-gradient(180deg,#060a12,#03060b)`,
        fontFamily: "Inter, ui-sans-serif, sans-serif",
        color: palette.text,
      }}
    >
      {/* Top nav */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          borderBottom: `1px solid ${palette.border}`,
          background: "rgba(3,6,11,0.92)",
          backdropFilter: "blur(12px)",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          gap: 0,
          height: 54,
        }}
      >
        <button
          onClick={onBack}
          style={{
            appearance: "none",
            border: "none",
            background: "none",
            color: palette.textDim,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "0 16px 0 0",
            borderRight: `1px solid ${palette.border}`,
            height: "100%",
            whiteSpace: "nowrap",
          }}
        >
          ← Dashboard
        </button>
        <div
          style={{
            padding: "0 16px",
            borderRight: `1px solid ${palette.border}`,
            height: "100%",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: palette.textDim,
              letterSpacing: 2,
              textTransform: "uppercase",
              fontWeight: 800,
            }}
          >
            Members Vault
          </span>
          <span
            style={{
              fontSize: 10,
              padding: "2px 6px",
              borderRadius: 4,
              background: palette.goldSoft,
              color: palette.gold,
              fontWeight: 800,
            }}
          >
            PRO
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            padding: "0 12px",
            flex: 1,
          }}
        >
          {[
            { id: "home", label: "Home" },
            { id: "patterns", label: "Pattern Library" },
            { id: "psychology", label: "Psychology Vault" },
            { id: "dna", label: "Trader DNA", badge: "™", gold: true },
            { id: "videos", label: "Video Library" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveSection(tab.id);
                setSelectedPattern(null);
                setSelectedArticle(null);
              }}
              style={{
                appearance: "none",
                border: "none",
                background: "none",
                color:
                  tab.gold && activeSection === tab.id
                    ? palette.gold
                    : activeSection === tab.id
                      ? palette.text
                      : palette.textDim,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: activeSection === tab.id ? 800 : 600,
                padding: "0 14px",
                height: "100%",
                borderBottom:
                  activeSection === tab.id
                    ? `2px solid ${tab.gold ? palette.gold : palette.accent}`
                    : "2px solid transparent",
                transition: "all 0.15s ease",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {tab.label}
              {tab.badge && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 900,
                    color: palette.gold,
                    verticalAlign: "super",
                    lineHeight: 1,
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "32px 24px", maxWidth: 1100, margin: "0 auto" }}>
        {/* ── HOME ── */}
        {activeSection === "home" && (
          <div style={{ display: "grid", gap: 24 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <div
                style={{
                  fontSize: 10,
                  color: palette.textDim,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                }}
              >
                Red October Systems
              </div>
              <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 1.1 }}>
                Members Vault
              </div>
              <div
                style={{
                  fontSize: 15,
                  color: palette.textSoft,
                  maxWidth: 500,
                  lineHeight: 1.6,
                }}
              >
                Your private edge. Pattern guides, psychology reads, and tools
                that get better as you log more trades.
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
                gap: 16,
                marginTop: 8,
              }}
            >
              {[
                {
                  id: "patterns",
                  icon: "📐",
                  title: "Pattern Library",
                  desc: "9 patterns. What they look like, how to trade them, and the mistakes most people make.",
                  count: `${PATTERNS.length} patterns`,
                  color: palette.blue,
                  tone: "blue",
                },
                {
                  id: "psychology",
                  icon: "🧠",
                  title: "Psychology Vault",
                  desc: "30-second reads on the mental patterns that kill accounts. No motivation. Just the truth.",
                  count: `${PSYCH_ARTICLES.length} articles`,
                  color: palette.gold,
                  tone: "gold",
                },
                {
                  id: "dna",
                  icon: "🧬",
                  title: "Trader DNA™",
                  desc: "AI synthesizes all your logged trades into a personal performance profile. Gets smarter every trade.",
                  count: "Claude-powered",
                  color: palette.gold,
                  tone: "gold",
                },
                {
                  id: "videos",
                  icon: "🎬",
                  title: "Video Library",
                  desc: "Mark Douglas and David Paul. Embedded sessions from the traders who changed how serious people think about markets.",
                  count: "6 videos",
                  color: palette.blue,
                  tone: "blue",
                },
                {
                  id: "coming",
                  icon: "🚧",
                  title: "More Coming Soon",
                  desc: "AI Review Archive, Advanced Analytics, Hall of Fame, Prop Firm Vault, Playbook Builder.",
                  count: "In development",
                  color: palette.textDim,
                  tone: "neutral",
                  disabled: true,
                },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => !item.disabled && setActiveSection(item.id)}
                  style={{
                    appearance: "none",
                    border: `1px solid ${item.disabled ? "rgba(255,255,255,0.05)" : palette.border}`,
                    background:
                      "linear-gradient(180deg,rgba(15,20,32,0.96),rgba(10,14,24,0.96))",
                    borderRadius: 20,
                    padding: "24px 26px",
                    cursor: item.disabled ? "default" : "pointer",
                    textAlign: "left",
                    color: palette.text,
                    display: "grid",
                    gap: 14,
                    opacity: item.disabled ? 0.5 : 1,
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ fontSize: 32 }}>{item.icon}</div>
                  <div>
                    <div
                      style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}
                    >
                      {item.title}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: palette.textSoft,
                        lineHeight: 1.55,
                      }}
                    >
                      {item.desc}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: item.color,
                        fontWeight: 700,
                      }}
                    >
                      {item.count}
                    </span>
                    {!item.disabled && (
                      <span style={{ fontSize: 12, color: palette.textDim }}>
                        Open →
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── PATTERN LIBRARY ── */}
        {activeSection === "patterns" && !selectedPattern && (
          <div style={{ display: "grid", gap: 20 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: palette.textDim,
                    letterSpacing: 3,
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  Members Vault
                </div>
                <div style={{ fontSize: 28, fontWeight: 900 }}>
                  Pattern Library
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: palette.textSoft,
                    marginTop: 4,
                  }}
                >
                  Your actual setups. Not YouTube nonsense.
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {patternTones.map((f) => (
                  <button
                    key={f}
                    onClick={() => setPatternFilter(f)}
                    style={{
                      appearance: "none",
                      border: `1px solid ${patternFilter === f ? palette.text : "rgba(255,255,255,0.08)"}`,
                      background:
                        patternFilter === f
                          ? "rgba(255,255,255,0.1)"
                          : "transparent",
                      color:
                        patternFilter === f ? palette.text : palette.textDim,
                      borderRadius: 8,
                      padding: "5px 12px",
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "capitalize",
                    }}
                  >
                    {f === "all"
                      ? "All"
                      : f === "short"
                        ? "Bearish"
                        : f === "long"
                          ? "Bullish"
                          : f === "gold"
                            ? "Special"
                            : "Other"}
                  </button>
                ))}
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))",
                gap: 14,
              }}
            >
              {filteredPatterns.map((p) => (
                <PatternCard
                  key={p.id}
                  pattern={p}
                  onClick={setSelectedPattern}
                />
              ))}
            </div>
          </div>
        )}

        {activeSection === "patterns" && selectedPattern && (
          <PatternDetail
            pattern={selectedPattern}
            onBack={() => setSelectedPattern(null)}
          />
        )}

        {/* ── PSYCHOLOGY VAULT ── */}
        {activeSection === "psychology" && !selectedArticle && (
          <div style={{ display: "grid", gap: 20 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: palette.textDim,
                    letterSpacing: 3,
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  Members Vault
                </div>
                <div style={{ fontSize: 28, fontWeight: 900 }}>
                  Psychology Vault
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: palette.textSoft,
                    marginTop: 4,
                  }}
                >
                  Tiny lessons. Not motivation. The stuff that actually costs
                  you money.
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {articleCategories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setArticleFilter(c)}
                    style={{
                      appearance: "none",
                      border: `1px solid ${articleFilter === c ? palette.text : "rgba(255,255,255,0.08)"}`,
                      background:
                        articleFilter === c
                          ? "rgba(255,255,255,0.1)"
                          : "transparent",
                      color:
                        articleFilter === c ? palette.text : palette.textDim,
                      borderRadius: 8,
                      padding: "5px 12px",
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
                gap: 14,
              }}
            >
              {filteredArticles.map((a) => (
                <ArticleCard
                  key={a.id}
                  article={a}
                  onClick={setSelectedArticle}
                />
              ))}
            </div>
          </div>
        )}

        {activeSection === "psychology" && selectedArticle && (
          <ArticleDetail
            article={selectedArticle}
            onBack={() => setSelectedArticle(null)}
          />
        )}

        {/* ── VIDEO LIBRARY ── */}
        {activeSection === "videos" && <VideoLibraryPage />}

        {/* ── TRADER DNA ── */}
        {activeSection === "dna" && (
          <TraderDnaPage
            dna={dna}
            setDna={setDna}
            loading={dnaLoading}
            setLoading={setDnaLoading}
            error={dnaError}
            setError={setDnaError}
            currentUser={currentUser}
          />
        )}
      </div>
    </div>
  );
}
