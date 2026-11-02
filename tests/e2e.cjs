// Full app run at iPhone size against local stand-ins for the Claude and Supabase APIs.
const { chromium, devices } = require("playwright");
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const assert = require("assert");
const shots = process.argv[2] || ".";
const reply = JSON.stringify({ reply: "Très bien. Et avec ceci ?", en: "Very good.", fixes: [{ said: "por favor", better: "s'il vous plaît", other: "", why: "Spanish form.", tag: "spanish" }], variety: "", try: ["Une baguette"] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const store = { row: null };
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*" };
(async () => {
  const mock = http.createServer((q, s) => {
    let raw = "";
    q.on("data", (c) => (raw += c));
    q.on("end", () => {
      const url = q.url;
      if (q.method === "OPTIONS") { s.writeHead(204, cors); return s.end(); }
      if (url.startsWith("/auth/v1/token") && JSON.parse(raw).password === "wrong-pass") {
        s.writeHead(400, { ...cors, "Content-Type": "application/json" });
        return s.end(JSON.stringify({ error_code: "invalid_credentials" }));
      }
      s.writeHead(200, { ...cors, "Content-Type": "application/json" });
      if (url.startsWith("/auth/v1/signup")) return s.end(JSON.stringify({ id: "u1", email: JSON.parse(raw).email }));
      if (url.startsWith("/auth/v1/token")) return s.end(JSON.stringify({ access_token: "good", refresh_token: "r", expires_in: 3600, user: { id: "u1", email: "marcos@example.com" } }));
      if (url.startsWith("/auth/v1/user")) return s.end(JSON.stringify({ email: "marcos@example.com", email_confirmed_at: "2026-11-01" }));
      if (url.startsWith("/auth/v1/logout")) return s.end("{}");
      if (url.startsWith("/rest/v1/progress")) {
        if (q.method === "POST") { store.row = JSON.parse(raw); return s.end(); }
        return s.end(JSON.stringify(store.row ? [{ data: store.row.data }] : []));
      }
      s.end(JSON.stringify({ content: [{ type: "text", text: "Sure:\n```json\n" + reply + "\n```" }] }));
    });
  });
  await new Promise((r) => mock.listen(4599, r));
  const server = spawn("node", ["scripts/dev-server.mjs"], { cwd: path.join(__dirname, ".."), stdio: "ignore", env: { ...process.env, PORT: "4598", ANTHROPIC_API_KEY: "k", ANTHROPIC_API_URL: "http://127.0.0.1:4599/", SUPABASE_URL: "http://127.0.0.1:4599", SUPABASE_ANON_KEY: "pk", ALLOWED_EMAILS: "marcos@example.com", APP_PASSCODE: "abc" } });
  await wait(700);
  const b = await chromium.launch();
  const errors = [];
  const watch = (p) => { p.on("pageerror", (e) => errors.push(e.message)); p.on("console", (m) => { if (m.type() === "error" && !/fonts\.g|ERR_|40[01]|Content Security|supabase/.test(m.text())) errors.push(m.text()); }); };
  const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  try {
    const ctx = await b.newContext({ ...devices["iPhone 13"], serviceWorkers: "allow" });
    await ctx.route("**/*", (r) => r.continue());
    const p = await ctx.newPage(); watch(p);
    await p.goto("http://localhost:4598/");
    await p.waitForSelector("#auth-form");
    await p.screenshot({ path: `${shots}/1-landing.png` });
    assert.equal(await overflow(p), false, "landing overflow");

    // wrong password, then create an account, then sign in with French selected
    await p.click('[data-act="pick-lang"][data-v="fr"]');
    await p.fill("#auth-email", "marcos@example.com"); await p.fill("#auth-password", "wrong-pass");
    await p.click('#auth-form button[type="submit"]'); await p.waitForSelector(".error");
    assert.match(await p.textContent(".error"), /wrong/);
    await p.click('[data-act="auth-mode"]');
    await p.fill("#auth-email", "marcos@example.com"); await p.fill("#auth-password", "long-enough-pass");
    await p.click('#auth-form button[type="submit"]'); await p.waitForSelector("#auth-form .notice");
    await p.fill("#auth-password", "long-enough-pass");
    await p.click('#auth-form button[type="submit"]');

    // lands on the level test because French has no level yet
    await p.waitForSelector('[data-act="test"]');
    await p.click('[data-act="test"]');
    for (let i = 0; i < 20; i++) {
      if (await p.$(".opts")) {
        const answer = await p.evaluate(() => D && !D.done ? D.items[D.i].a : null);
        if (!answer) break;
        if (i === 12) await p.screenshot({ path: `${shots}/2-test.png` });
        await p.evaluate((a) => answerTest(a), answer);
      }
    }
    await p.waitForSelector("#write-text");
    assert.equal(await p.evaluate(() => P().level), "B2");
    await p.screenshot({ path: `${shots}/3-result.png` });
    await p.click('a.btn[href="#hoje"]'); await p.waitForSelector(".wall i");
    await p.screenshot({ path: `${shots}/4-home-fr.png` });

    // failing round two stops at A1
    await p.evaluate(() => { startTest(); });
    for (let i = 0; i < 5; i++) await p.evaluate(() => answerTest(D.items[D.i].a));
    for (let i = 0; i < 5; i++) await p.evaluate(() => answerTest(""));
    assert.equal(await p.evaluate(() => P().level), "A1");
    await p.evaluate(() => (location.hash = "hoje"));

    for (const t of ["conversa", "cartoes", "ponte", "sons"]) {
      await p.evaluate((x) => (location.hash = x), t); await p.waitForTimeout(150);
      assert.equal(await overflow(p), false, "overflow on fr " + t);
    }
    // grading
    const g = await p.evaluate(() => [grade("le pain", ["le pain"]), grade("pain", ["le pain"]), grade("la pain", ["le pain"]), grade("autocarro", ["ônibus", "autocarro"]), grade("onibus", ["ônibus"]), grade("o trem", ["trem"]), grade("j’ai faim", ["J'ai faim"]), grade("", ["x"])]);
    assert.deepEqual(g, ["good", "good", "bad", "good", "accent", "good", "good", "bad"]);

    // French conversation through the account
    await p.evaluate(() => { location.hash = "conversa"; }); await p.waitForTimeout(150);
    await p.click('[data-act="scene"][data-id="boulangerie"]');
    await p.fill("#chat-input", "Je veux un croissant, por favor"); await p.click('[data-act="send"]');
    await p.waitForSelector(".fix strong");
    await p.screenshot({ path: `${shots}/5-chat-fr.png` });
    assert.equal(await p.textContent("#msgs .fix strong"), "s'il vous plaît");
    await p.click('[data-act="add-fix"]');

    // recall in French
    await p.evaluate(() => (location.hash = "cartoes")); await p.waitForTimeout(100);
    await p.click('[data-act="review"]');
    await p.fill("#card-input", "wrong"); await p.keyboard.press("Enter"); await p.waitForSelector(".verdict");
    await p.screenshot({ path: `${shots}/6-card-fr.png` });
    await p.click('[data-act="next"]');

    // Portuguese keeps both country forms and its own progress
    await p.click('[data-act="lang"][data-v="pt"]');
    assert.equal(await p.evaluate(() => document.documentElement.dataset.lang), "pt");
    await p.evaluate(() => (location.hash = "hoje")); await p.waitForTimeout(100);
    await p.screenshot({ path: `${shots}/7-home-pt.png` });
    assert.equal(await p.evaluate(() => S.profiles.fr.level), "A1");
    assert.equal(await p.evaluate(() => S.profiles.pt.level), null);
    await p.evaluate(() => (location.hash = "ponte")); await p.waitForTimeout(100);
    await p.click('[data-act="pseg"][data-v="bp"]'); await p.waitForSelector("#vocab-body tr");
    assert.equal(await overflow(p), false, "overflow pt ponte");
    await p.screenshot({ path: `${shots}/8-ponte-pt.png` });

    // the Voca name opens the landing page, and Continue returns to the app
    await p.click(".brand"); await p.waitForSelector(".landing .langs");
    assert.equal(await p.isVisible("#nav"), false);
    await p.screenshot({ path: `${shots}/9-home.png` });
    await p.click('[data-act="pick-lang"][data-v="fr"]');
    await p.click('[data-act="guest"]');
    await p.waitForFunction(() => tab === "teste" || tab === "hoje");
    assert.equal(await p.evaluate(() => S.lang), "fr");
    assert.equal(await p.isVisible("#nav"), true);

    // progress reached the account, then returns on a new device
    await p.waitForTimeout(1800);
    assert.equal(store.row.data.profiles.fr.level, "A1");
    const phone2 = await b.newContext({ ...devices["iPhone 13"] });
    const q = await phone2.newPage(); watch(q);
    await q.goto("http://localhost:4598/"); await q.waitForSelector("#auth-form");
    await q.fill("#auth-email", "marcos@example.com"); await q.fill("#auth-password", "long-enough-pass");
    await q.click('#auth-form button[type="submit"]'); await q.waitForFunction(() => S.onboarded);
    assert.equal(await q.evaluate(() => S.profiles.fr.level), "A1");
    await phone2.close();

    // older saved progress moves into the new format
    const old = await b.newContext({ ...devices["iPhone 13"] });
    const o = await old.newPage(); watch(o);
    await o.goto("http://localhost:4598/manifest.webmanifest");
    await o.evaluate(() => localStorage.setItem("voca-v1", JSON.stringify({ cards: { k0: { b: 3, d: 1 } }, lisbon: "2027-06-20", errs: { verb: 2 } })));
    await o.goto("http://localhost:4598/"); await o.waitForSelector(".wall i");
    assert.equal(await o.evaluate(() => S.profiles.pt.cards.k0.b), 3);
    assert.equal(await o.evaluate(() => S.lisbon), "2027-06-20");
    await old.close();

    // offline
    await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForTimeout(800);
    await p.reload(); await p.waitForSelector("#top .brand");
    await ctx.setOffline(true);
    await p.reload(); await p.waitForSelector("#top .brand");
    await p.evaluate(() => (location.hash = "cartoes")); await p.click('[data-act="review"]');
    await p.fill("#card-input", "Oi"); await p.keyboard.press("Enter"); await p.waitForSelector(".verdict");
    await p.evaluate(() => { location.hash = "conversa"; }); await p.waitForTimeout(100);
    await p.fill("#chat-input", "oi"); await p.click('[data-act="send"]');
    await p.waitForFunction(() => /offline/.test(document.querySelector("#chat-err").textContent));
    console.log("e2e passed; page errors:", errors);
  } finally { await b.close(); server.kill(); mock.close(); }
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
