// App Store screenshots (6.9" iPhone, 1320x2868) from the demo web build, captioned. See docs/APP-STORE.md.
// npm run web:preview && npx serve -s dist -l 8093 (any static server with an index.html fallback), then:
// node scripts/store/screenshots.js store/screenshots/iphone-6.9 .
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const OUT = process.argv[2];
const APP = process.argv[3];
const RAW = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-store-')); // uncaptioned screens, not kept
const BASE = process.env.STORE_BASE_URL || 'http://localhost:8093';
const W = 440;
const H = 956; // 6.9" iPhone in points; device scale 3 → 1320x2868

const SHOTS = [
  { path: '/', scheme: 'dark', caption: 'Faith events, happening near you.' },
  { path: '/event/eeeeeeee-0000-4000-8000-000000000005', scheme: 'dark', caption: 'See who’s going. Join in one tap.' },
  { path: '/tickets', scheme: 'dark', caption: 'Tickets, ready at the door.' },
  { path: '/community?view=prayer', scheme: 'light', caption: 'Pray together. Celebrate answers.' },
  { path: '/church/cccccccc-0000-4000-8000-000000000001', scheme: 'light', caption: 'Find your Home Church.' },
  { path: '/host', scheme: 'dark', caption: 'Host, sell tickets and check guests in.' },
];

// Pages built with setContent can't load file:// URLs, so the font and screens are embedded as data URIs
const font = rel => `data:font/ttf;base64,${fs.readFileSync(path.join(APP, 'node_modules/@expo-google-fonts', rel)).toString('base64')}`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  // 1. Raw app screens at device resolution
  for (const [i, s] of SHOTS.entries()) {
    const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: s.scheme });
    await ctx.addInitScript(sc => {
      localStorage.setItem('cl.onboardingDone', 'true');
      localStorage.setItem('cl.theme', JSON.stringify(sc));
    }, s.scheme);
    const p = await ctx.newPage();
    await p.goto(BASE + s.path, { waitUntil: 'networkidle' });
    await p.waitForTimeout(3000);
    await p.screenshot({ path: path.join(RAW, `${i + 1}.png`) });
    await ctx.close();
  }
  // 2. Composed store images: caption above the screen, on the screen's own ground
  for (const [i, s] of SHOTS.entries()) {
    const dark = s.scheme === 'dark';
    const ground = dark ? '#0E0C0A' : '#F7F2E8';
    const ink = dark ? '#F6EFE3' : '#1C160E';
    const raw = `data:image/png;base64,${fs.readFileSync(path.join(RAW, `${i + 1}.png`)).toString('base64')}`;
    const html = `<!doctype html><html><head><style>
      @font-face { font-family: 'Newsreader'; src: url('${font('newsreader/500Medium/Newsreader_500Medium.ttf')}'); }
      html, body { margin: 0; width: ${W}px; height: ${H}px; background: ${ground}; overflow: hidden; }
      .cap { position: absolute; top: 64px; left: 36px; right: 36px; text-align: center; font-family: 'Newsreader', serif;
             font-size: 34px; line-height: 40px; letter-spacing: -0.4px; color: ${ink}; text-wrap: balance; }
      .phone { position: absolute; top: 176px; left: 50%; width: 356px; height: ${Math.round(H * (356 / W))}px; transform: translateX(-50%);
               border-radius: 34px; overflow: hidden; border: 1px solid ${dark ? 'rgba(201,168,76,0.35)' : 'rgba(28,22,14,0.12)'};
               box-shadow: 0 24px 60px ${dark ? 'rgba(0,0,0,0.6)' : 'rgba(28,22,14,0.18)'}; }
      .phone img { width: 100%; display: block; }
    </style></head><body><div class="cap">${s.caption}</div><div class="phone"><img src="${raw}"></div></body></html>`;
    const page = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 3 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `iphone-6.9-${i + 1}.png`) });
    await page.close();
  }
  await b.close();
})();
