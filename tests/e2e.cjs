// Full app run at iPhone size against a local stand-in for the Claude API.
const { chromium, devices } = require("playwright");
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const assert = require("assert");
const shots = process.argv[2] || ".";
const reply = JSON.stringify({ reply: "Que bom! E depois?", en: "Great! And then?", fixes: [{ said: "voy", better: "vou", other: "", why: "Spanish form.", tag: "spanish" }], variety: "", try: ["Fui à praia"] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const mock = http.createServer((q, s) => { q.resume(); q.on("end", () => s.end(JSON.stringify({ content: [{ type: "text", text: "Sure:\n```json\n" + reply + "\n```" }] }))); });
  await new Promise((r) => mock.listen(4599, r));
  const server = spawn("node", ["scripts/dev-server.mjs"], { cwd: path.join(__dirname, ".."), stdio: "ignore", env: { ...process.env, PORT: "4598", ANTHROPIC_API_KEY: "k", APP_PASSCODE: "abc", ANTHROPIC_API_URL: "http://127.0.0.1:4599/" } });
  await wait(700);
  const b = await chromium.launch();
  const errors = [];
  try {
    const ctx = await b.newContext({ ...devices["iPhone 13"] });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => { if (m.type() === "error" && !/fonts\.g|ERR_/.test(m.text())) errors.push(m.text()); });
    await p.goto("http://localhost:4598/");
    await p.waitForFunction(() => navigator.serviceWorker.ready.then((r) => !!r.active));
    await p.reload();
    await p.waitForSelector(".wall svg");
    for (const t of ["hoje", "conversa", "cartoes", "ponte", "sons"]) {
      await p.evaluate((x) => (location.hash = x), t);
      await p.waitForTimeout(150);
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "overflow on " + t);
      await p.screenshot({ path: `${shots}/iphone-${t}.png` });
    }
    // grading
    assert.equal(await p.evaluate(() => grade("autocarro", ["ônibus", "autocarro"])), "good");
    // wrong passcode, then right passcode, then a conversation
    await p.evaluate(() => (location.hash = "conversa"));
    await p.fill("#pass-inline", "wrong"); await p.click('[data-act="save-pass"]');
    await p.waitForFunction(() => /doesn't match/.test(document.querySelector("#toast").textContent));
    await p.evaluate(() => { setPass(""); render(); });
    await p.fill("#pass-inline", "abc"); await p.click('[data-act="save-pass"]');
    await p.waitForFunction(() => /Connected/.test(document.querySelector("#toast").textContent));
    await p.fill("#chat-input", "voy"); await p.click('[data-act="send"]');
    await p.waitForSelector(".fix strong");
    assert.equal(await p.textContent(".fix strong"), "vou");
    await p.screenshot({ path: `${shots}/iphone-chat.png` });
    // backup and restore
    await p.evaluate(() => (location.hash = "hoje")); await p.waitForTimeout(100);
    await p.click('[data-act="backup"]');
    const backup = await p.inputValue("#backup-text");
    await p.evaluate(() => { S.errs = {}; save(); render(); });
    await p.fill("#backup-text", backup); await p.click('[data-act="restore"]'); await p.click('[data-act="restore"]');
    assert.equal(await p.evaluate(() => S.errs.spanish), 1);
    // offline
    await ctx.setOffline(true);
    await p.reload(); await p.waitForSelector(".wall svg");
    await p.evaluate(() => (location.hash = "cartoes")); await p.click('[data-act="review"]');
    await p.fill("#card-input", "Oi"); await p.keyboard.press("Enter"); await p.waitForSelector(".verdict");
    await p.evaluate(() => { location.hash = "conversa"; }); await p.waitForTimeout(100);
    await p.fill("#chat-input", "oi"); await p.click('[data-act="send"]');
    await p.waitForFunction(() => /offline/.test(document.querySelector("#chat-err").textContent));
    console.log("e2e passed; page errors:", errors);
  } finally { await b.close(); server.kill(); mock.close(); }
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
