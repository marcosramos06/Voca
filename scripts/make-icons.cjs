// Regenerates the app icons. Run with: node scripts/make-icons.cjs
const { chromium } = require("playwright");
const path = require("path");
const art = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 512 512"><rect width="512" height="512" fill="#143b8c"/>
<g fill="none" stroke="#fff" stroke-width="20" opacity=".9"><circle cx="0" cy="0" r="190"/><circle cx="512" cy="0" r="190"/><circle cx="0" cy="512" r="190"/><circle cx="512" cy="512" r="190"/></g>
<path d="M256 112 400 256 256 400 112 256Z" fill="none" stroke="#fff" stroke-width="22"/><circle cx="256" cy="256" r="52" fill="#f5b700"/></svg>`;
(async () => {
  const b = await chromium.launch();
  for (const [name, size] of [["apple-touch-icon", 180], ["icon-192", 192], ["icon-512", 512], ["icon-maskable-512", 512]]) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<!doctype html><body style="margin:0">${art(size)}</body>`);
    await p.screenshot({ path: path.join(__dirname, "..", "public", "icons", name + ".png") });
    await p.close();
  }
  await b.close();
})();
