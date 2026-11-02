// Regenerates the app icons. Run with: ICON_FONT=/path/to/hanken-grotesk-700.woff2 node scripts/make-icons.cjs
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const font = process.env.ICON_FONT ? fs.readFileSync(process.env.ICON_FONT).toString("base64") : "";
const art = (s, scale) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 512 512"><rect width="512" height="512" fill="#143b8c"/>
<g fill="none" stroke="#fff" stroke-width="10" opacity=".2"><circle cx="0" cy="0" r="170"/><circle cx="512" cy="0" r="170"/><circle cx="0" cy="512" r="170"/><circle cx="512" cy="512" r="170"/><circle cx="0" cy="0" r="120"/><circle cx="512" cy="0" r="120"/><circle cx="0" cy="512" r="120"/><circle cx="512" cy="512" r="120"/></g>
<text x="256" y="256" dy=".35em" text-anchor="middle" font-family="HG, -apple-system, Helvetica, sans-serif" font-weight="700" font-size="${150 * scale}" letter-spacing="-5" fill="#fff">Voca</text></svg>`;
(async () => {
  const b = await chromium.launch();
  for (const [name, size, scale] of [["apple-touch-icon", 180, 1], ["icon-192", 192, 1], ["icon-512", 512, 1], ["icon-maskable-512", 512, 0.88]]) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<!doctype html><style>@font-face{font-family:HG;src:url(data:font/woff2;base64,${font}) format("woff2");font-weight:700}body{margin:0}</style>${art(size, scale)}`);
    await p.evaluate(() => document.fonts.load('700 20px HG').then(() => document.fonts.ready));
    await p.screenshot({ path: path.join(__dirname, "..", "public", "icons", name + ".png") });
    await p.close();
  }
  await b.close();
})();
