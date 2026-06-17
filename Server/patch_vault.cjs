const fs = require("fs");
const path = require("path");

// ─── CONFIG: update these paths if needed ─────────────────────────────────────
const APP_FILE = path.join(__dirname, "..", "client", "src", "App.jsx");
const VAULT_FILE = path.join(__dirname, "..", "client", "src", "MembersVault.jsx");
// If those paths don't work, try:
// const APP_FILE = path.join(__dirname, "src", "AppPreBeta.jsx");
// const VAULT_FILE = path.join(__dirname, "src", "MembersVault.jsx");

// ─── PATCH 1: AppPreBeta.jsx — exchange bar ───────────────────────────────────

const OLD_EXCHANGE_BAR = `              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flexWrap: "wrap",
                  padding: "6px 10px",
                  background:
                    "linear-gradient(0deg,rgba(3,6,11,0.88) 0%,transparent 100%)",
                  zIndex: 5,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.38)",
                    fontWeight: 800,
                    letterSpacing: 0.5,
                  }}
                >
                  Open on
                </span>
                {[
                  ["BLOFIN", exchangeLinks.blofin],
                  ["BINANCE", exchangeLinks.binance],
                  ["BYBIT", exchangeLinks.bybit],
                  ["OKX", exchangeLinks.okx],
                  ["TV", exchangeLinks.tradingView],
                ].map(([label, href]) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      ...styles.smallButton,
                      background: "rgba(0,0,0,0.55)",
                    }}
                  >
                    {label}
                  </a>
                ))}
              </div>`;

const NEW_EXCHANGE_BAR = `              {/* ── Exchange + Prop Firm Quick Links ── */}
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: "8px 10px",
                  background: "linear-gradient(0deg,rgba(3,6,11,0.92) 0%,transparent 100%)",
                  zIndex: 5,
                  display: "grid",
                  gap: 5,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", marginRight: 2 }}>Trade on</span>
                  {[
                    { label: "Blofin", href: \`https://blofin.com/futures/\${dashPair}?ref=redoctober\`, color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
                    { label: "Bybit", href: \`https://www.bybit.com/trade/usdt/\${basePair}?affiliate_id=redoctober\`, color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
                    { label: "Binance", href: \`https://www.binance.com/en/futures/\${basePair}?ref=redoctober\`, color: "#f0b90b", bg: "rgba(240,185,11,0.12)" },
                    { label: "OKX", href: \`https://www.okx.com/trade-swap/\${dashPair.toLowerCase()}-swap?channelid=redoctober\`, color: "#60a5fa", bg: "rgba(96,165,250,0.1)" },
                    { label: "Kraken", href: "https://www.kraken.com/sign-up?referral=redoctober", color: "#7c3aed", bg: "rgba(124,58,237,0.12)" },
                    { label: "TradingView", href: \`https://www.tradingview.com/chart/?symbol=BINANCE:\${basePair}&offer_id=10&aff_id=redoctober\`, color: "#2962ff", bg: "rgba(41,98,255,0.1)" },
                  ].map(({ label, href, color, bg }) => (
                    <a key={label} href={href} target="_blank" rel="noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 8, background: bg, border: \`1px solid \${color}33\`, color, fontSize: 11, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap" }}>
                      {label}
                    </a>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", marginRight: 2 }}>Prop firms</span>
                  {[
                    { label: "FTMO", href: "https://ftmo.com/?affiliates=redoctober", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
                    { label: "MyFundedFX", href: "https://myfundedfx.tech/registration/?ref=redoctober", color: "#10b981", bg: "rgba(16,185,129,0.1)" },
                    { label: "The5ers", href: "https://the5ers.com/?utm_source=redoctober", color: "#8b5cf6", bg: "rgba(139,92,246,0.1)" },
                    { label: "Topstep", href: "https://www.topstep.com/?ref=redoctober", color: "#f97316", bg: "rgba(249,115,22,0.1)" },
                    { label: "Apex", href: "https://apextraderfunding.com/?ref=redoctober", color: "#06b6d4", bg: "rgba(6,182,212,0.1)" },
                  ].map(({ label, href, color, bg }) => (
                    <a key={label} href={href} target="_blank" rel="noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 8, background: bg, border: \`1px solid \${color}33\`, color, fontSize: 11, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap" }}>
                      {label}
                    </a>
                  ))}
                </div>
              </div>`;

// ─── PATCH 2: MembersVault.jsx ────────────────────────────────────────────────

const VIDEO_DATA = `
// ─── Video Library Data ───────────────────────────────────────────────────────

const VIDEO_LIBRARY = [
  {
    id: "douglas",
    teacher: "Mark Douglas",
    teacherBio: "Author of Trading in the Zone. The definitive voice on trading psychology and probabilistic thinking.",
    teacherColor: "#60a5fa",
    videos: [
      { id: "md1", title: "Trading in the Zone — Full Seminar", description: "The complete Mark Douglas seminar on probabilistic thinking, removing fear from trading, and building consistency. Required watching.", youtubeId: "laHlPCgFHTo", duration: "2h 18m" },
      { id: "md2", title: "How to Think Like a Professional Trader", description: "Mark Douglas breaks down the five fundamental truths every trader must internalize to stop fighting the market.", youtubeId: "T3DFPfmGGnw", duration: "58m" },
      { id: "md3", title: "The Mental Game of Trading", description: "Deep dive into why traders self-sabotage and how to rewire your relationship with uncertainty and risk.", youtubeId: "94pFsLGJy-s", duration: "1h 12m" },
    ],
  },
  {
    id: "paul",
    teacher: "David Paul",
    teacherBio: "Veteran trader and educator known for institutional price action, liquidity concepts, and market structure. Decades of live trading experience.",
    teacherColor: "#f6c453",
    videos: [
      { id: "dp1", title: "Institutional Price Action Masterclass", description: "David Paul walks through how institutions move markets, where they accumulate and distribute, and how retail traders can align with them.", youtubeId: "GqZ9qRlw5HY", duration: "1h 45m" },
      { id: "dp2", title: "Reading Market Structure Like a Pro", description: "How to identify genuine market structure shifts vs. noise, and why most traders misread swing highs and lows.", youtubeId: "yDXB8vIgFNQ", duration: "52m" },
      { id: "dp3", title: "Liquidity, Stop Hunts & Smart Money", description: "The mechanics behind stop hunts, liquidity grabs, and how to use them as entry signals instead of getting caught on the wrong side.", youtubeId: "4XJ3BFfmKGY", duration: "1h 3m" },
    ],
  },
];

// ─── Video Library Component ──────────────────────────────────────────────────

function VideoLibraryPage() {
  const [activeTeacher, setActiveTeacher] = useState(VIDEO_LIBRARY[0].id);
  const [activeVideo, setActiveVideo] = useState(null);

  const teacher = VIDEO_LIBRARY.find(t => t.id === activeTeacher) || VIDEO_LIBRARY[0];
  const currentVideo = activeVideo || teacher.videos[0];

  return (
    <div style={{ display: "grid", gap: 24, maxWidth: 960, margin: "0 auto" }}>
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontSize: 10, color: palette.textDim, letterSpacing: 3, textTransform: "uppercase" }}>Members Vault</div>
        <div style={{ fontSize: 28, fontWeight: 900 }}>Video Library</div>
        <div style={{ fontSize: 13, color: palette.textSoft, lineHeight: 1.6 }}>Curated sessions from the traders who changed how serious people think about markets.</div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {VIDEO_LIBRARY.map(t => (
          <button key={t.id} onClick={() => { setActiveTeacher(t.id); setActiveVideo(null); }}
            style={{ appearance: "none", border: \`1px solid \${activeTeacher === t.id ? t.teacherColor + "66" : "rgba(255,255,255,0.08)"}\`, background: activeTeacher === t.id ? t.teacherColor + "12" : "transparent", color: activeTeacher === t.id ? t.teacherColor : palette.textDim, borderRadius: 12, padding: "8px 18px", cursor: "pointer", fontSize: 13, fontWeight: activeTeacher === t.id ? 800 : 600, transition: "all 0.15s ease" }}>
            {t.teacher}
          </button>
        ))}
      </div>
      <div style={{ padding: "14px 18px", borderRadius: 14, border: \`1px solid \${teacher.teacherColor}22\`, background: \`\${teacher.teacherColor}08\`, fontSize: 13, color: palette.textSoft, lineHeight: 1.6 }}>
        <strong style={{ color: teacher.teacherColor, fontWeight: 800 }}>{teacher.teacher} — </strong>{teacher.teacherBio}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ borderRadius: 16, overflow: "hidden", border: \`1px solid \${teacher.teacherColor}33\`, aspectRatio: "16/9", background: "#000" }}>
            <iframe key={currentVideo.youtubeId} src={\`https://www.youtube.com/embed/\${currentVideo.youtubeId}?rel=0&modestbranding=1\`} title={currentVideo.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ width: "100%", height: "100%", border: "none", display: "block" }} />
          </div>
          <div style={{ border: \`1px solid \${palette.border}\`, borderRadius: 14, padding: "14px 16px", background: "linear-gradient(180deg,rgba(15,20,32,0.96),rgba(10,14,24,0.96))", display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.3 }}>{currentVideo.title}</div>
              <a href={\`https://www.youtube.com/watch?v=\${currentVideo.youtubeId}\`} target="_blank" rel="noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, background: "rgba(255,0,0,0.12)", border: "1px solid rgba(255,0,0,0.25)", color: "#ff4444", fontSize: 11, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0 }}>
                ▶ YouTube ↗
              </a>
            </div>
            <div style={{ fontSize: 12, color: palette.textSoft, lineHeight: 1.6 }}>{currentVideo.description}</div>
            <div style={{ fontSize: 11, color: palette.textDim, fontWeight: 700 }}>{teacher.teacher} · {currentVideo.duration}</div>
          </div>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1.5, textTransform: "uppercase", color: palette.textDim, marginBottom: 4 }}>All videos</div>
          {teacher.videos.map(video => {
            const isActive = video.youtubeId === currentVideo.youtubeId;
            return (
              <button key={video.id} onClick={() => setActiveVideo(video)}
                style={{ appearance: "none", border: \`1px solid \${isActive ? teacher.teacherColor + "44" : "rgba(255,255,255,0.06)"}\`, background: isActive ? \`\${teacher.teacherColor}10\` : "rgba(255,255,255,0.02)", borderRadius: 12, padding: "12px 14px", cursor: "pointer", textAlign: "left", color: palette.text, display: "grid", gap: 6, transition: "all 0.15s ease" }}>
                <div style={{ fontSize: 12, fontWeight: isActive ? 800 : 700, color: isActive ? teacher.teacherColor : palette.text, lineHeight: 1.4 }}>{video.title}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: palette.textDim }}>{video.duration}</span>
                  {isActive && <span style={{ fontSize: 10, color: teacher.teacherColor, fontWeight: 800 }}>▶ Playing</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
`;

const OLD_PSYCH_END = `];

// ─── Pill component`;
const NEW_PSYCH_END = `];
${VIDEO_DATA}
// ─── Pill component`;

const OLD_VAULT_TAB = `      { id:"dna", label:"Trader DNA", badge:"™", gold:true },`;
const NEW_VAULT_TAB = `      { id:"dna", label:"Trader DNA", badge:"™", gold:true },
      { id:"videos", label:"Video Library" },`;

const OLD_HOME_CARD = `                { id:"coming", icon:"🚧", title:"More Coming Soon"`;
const NEW_HOME_CARD = `                { id:"videos", icon:"🎬", title:"Video Library", desc:"Mark Douglas and David Paul. Embedded sessions from the traders who changed how serious people think about markets.", count:"6 videos", color:palette.blue, tone:"blue" },
                { id:"coming", icon:"🚧", title:"More Coming Soon"`;

const OLD_DNA_RENDER = `        {/* ── TRADER DNA ── */}
        {activeSection === "dna" && (`;
const NEW_DNA_RENDER = `        {/* ── VIDEO LIBRARY ── */}
        {activeSection === "videos" && <VideoLibraryPage />}

        {/* ── TRADER DNA ── */}
        {activeSection === "dna" && (`;

// ─── Apply ────────────────────────────────────────────────────────────────────

function patch(filePath, patches) {
  if (!fs.existsSync(filePath)) {
    console.error(`\n❌  File not found: ${filePath}`);
    console.error(`    Edit the paths at the top of this script and try again.\n`);
    process.exit(1);
  }
  let content = fs.readFileSync(filePath, "utf8");
  let changed = 0;
  for (const [oldStr, newStr, label] of patches) {
    if (content.includes(oldStr)) {
      content = content.replace(oldStr, newStr);
      console.log(`  ✅  ${label}`);
      changed++;
    } else {
      console.warn(`  ⚠️   Already patched or not found: ${label}`);
    }
  }
  if (changed > 0) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`  💾  Saved ${filePath}\n`);
  }
}

console.log("\n🔧  Patching AppPreBeta.jsx...");
patch(APP_FILE, [
  [OLD_EXCHANGE_BAR, NEW_EXCHANGE_BAR, "Exchange + prop firm quick link bar"],
]);

console.log("🔧  Patching MembersVault.jsx...");
patch(VAULT_FILE, [
  [OLD_PSYCH_END, NEW_PSYCH_END, "Video library data + component"],
  [OLD_VAULT_TAB, NEW_VAULT_TAB, "Video Library nav tab"],
  [OLD_HOME_CARD, NEW_HOME_CARD, "Video Library home card"],
  [OLD_DNA_RENDER, NEW_DNA_RENDER, "Video Library render block"],
]);

console.log("✅  Done! Push and deploy.\n");
console.log("📝  Reminders:");
console.log("    • Verify YouTube video IDs are correct");
console.log("    • Swap ?ref=redoctober for real affiliate IDs when ready\n");
