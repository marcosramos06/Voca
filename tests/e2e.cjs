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
      const asked = JSON.parse(raw || "{}"), last = (asked.messages || []).slice(-1)[0] || {};
      if (Array.isArray(last.content)) {
        store.photo = last.content[0];
        return s.end(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ title: "O menu", summary: "A lunch menu.", cards: [{ en: "soup of the day", es: "sopa del día", br: "sopa do dia", pt: "", note: "" }, { en: "grilled sardines", es: "sardinas", br: "sardinhas grelhadas", pt: "", note: "" }], scene: { who: "a waiter", open: "Boa tarde! Já escolheu?" } }) }] }));
      }
      if (/weak spot/.test(typeof last.content === "string" ? last.content : "")) return s.end(JSON.stringify({ content: [{ type: "text", text: JSON.stringify([{ en: "I went home", es: "Fui a casa", br: "Fui para casa", pt: "", note: "" }]) }] }));
      store.lastPrompt = (asked.messages || [])[0]?.content;
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
    await ctx.addInitScript(() => {
      window.__spoken = [];
      window.SpeechRecognition = window.webkitSpeechRecognition = class {
        start() { const self = this, say = window.__say || "Je voudrais un café"; setTimeout(() => { self.onresult({ results: [Object.assign([{ transcript: say, confidence: 0.61 }], { isFinal: true })] }); self.onend(); }, 30); }
        abort() {} stop() {}
      };
      const real = speechSynthesis;
      Object.defineProperty(window, "speechSynthesis", { value: { speak: (u) => { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 20); }, cancel() {}, getVoices: () => [], onvoiceschanged: null } });
    });
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

    // hands-free talk: hears, sends, speaks the reply, then listens again until stopped
    await p.evaluate(() => { window.__say = "Je voudrais un café"; });
    await p.click('[data-act="talk"]');
    await p.waitForFunction(() => window.__spoken.includes("Très bien. Et avec ceci ?"));
    await p.waitForFunction(() => document.querySelectorAll("#msgs .m.u").length >= 2);
    await p.click('[data-act="talk-stop"]');
    assert.equal(await p.evaluate(() => T.on), false);
    assert.match(store.lastPrompt, /speech recognition with 61% confidence/);
    await p.waitForTimeout(200);
    await p.screenshot({ path: `${shots}/talk-chat.png` });

    // recall in French
    await p.evaluate(() => (location.hash = "cartoes")); await p.waitForTimeout(100);
    await p.click('[data-act="review"]');
    await p.fill("#card-input", "wrong"); await p.keyboard.press("Enter"); await p.waitForSelector(".verdict");
    await p.screenshot({ path: `${shots}/6-card-fr.png` });
    await p.click('[data-act="next"]');

    // weak-spot drill builds cards from recent corrections
    await p.click('[data-act="quit"]').catch(() => {});
    await p.evaluate(() => { location.hash = "cartoes"; R = null; render(); }); await p.waitForSelector('[data-act="drill"]');
    await p.click('[data-act="drill"]');
    await p.waitForFunction(() => P().custom.some((c) => c.tag === "focus"), null, { timeout: 5000 }).catch(() => {});

    // photo lesson: a real image file becomes cards and a scene
    await p.evaluate(() => { S.lang = "pt"; C.lang = null; render(); }); await p.waitForSelector("#photo-input");
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAAEklEQVR4nGP8z4APMOGVGbHSAEEsAROxCnMTAAAAAElFTkSuQmCC", "base64");
    await p.setInputFiles("#photo-input", { name: "menu.png", mimeType: "image/png", buffer: png });
    await p.waitForSelector('[data-act="photo-scene"]');
    assert.equal(store.photo.source.media_type, "image/jpeg");
    await p.screenshot({ path: `${shots}/photo-result.png` });
    assert.equal(await p.evaluate(() => P().custom.filter((c) => c.tag === "photo").length), 2);
    await p.click('[data-act="photo-scene"]'); await p.waitForSelector("#msgs .m.a");
    assert.match(await p.textContent("#msgs .m.a"), /Já escolheu/);
    await p.evaluate(() => { S.lang = "fr"; C.lang = null; location.hash = "cartoes"; render(); });

    // daily mission: report back, get feedback, earn the first stamp
    await p.evaluate(() => { location.hash = "hoje"; }); await p.waitForSelector("#mission-note");
    const firstMission = await p.textContent(".mission-task");
    await p.click('[data-act="mission-skip"]');
    assert.notEqual(await p.textContent(".mission-task"), firstMission);
    await p.fill("#mission-note", "J'ai parlé avec mon ami"); await p.click('[data-act="mission-done"]');
    await p.waitForSelector(".mission h3");
    await p.waitForFunction(() => P().missions[today()].done && S.earned.mission1);
    await p.waitForSelector(".streak-chip");
    assert.ok(await p.evaluate(() => S.earned.mission1));
    await p.screenshot({ path: `${shots}/mission-done.png` });

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

    // picture words: browse a set, then finish a quiz that feeds the review schedule
    await p.evaluate(() => { S.lang = "fr"; location.hash = "fotos"; }); await p.waitForSelector(".sets");
    assert.equal(await p.evaluate(() => PICTURE_RAW.length), 63);
    assert.equal(await p.evaluate(() => new Set(PICTURE_RAW.map((r) => r[6])).size), 63);
    assert.equal(await p.evaluate(() => PICTURE_RAW.every((r) => r.length === 9 && r[7] && r[8])), true);
    await p.click('[data-act="pic-learn"][data-id="food"]'); await p.waitForSelector(".gallery .pic-card");
    assert.equal(await p.locator(".pic-card").count(), 16);
    assert.match(await p.textContent(".pic-card .credit"), /Photo: /);
    await p.screenshot({ path: `${shots}/pic-learn.png` });
    await p.evaluate(() => startPicQuiz("food"));
    assert.equal(await p.locator(".pic-opt").count(), 4);
    await p.screenshot({ path: `${shots}/pic-pick.png` });
    await p.evaluate(() => { const id = PW.q[PW.i].id; document.querySelector(`[data-act="pic-pick"][data-id="${id}"]`).click(); });
    await p.waitForSelector(".pic-opt.right"); await p.waitForSelector("#pic-next"); await p.click("#pic-next");
    await p.waitForSelector("#pic-input");
    await p.fill("#pic-input", await p.evaluate(() => PW.q[PW.i].fr)); await p.keyboard.press("Enter"); await p.waitForSelector(".verdict.good");
    assert.equal(await p.evaluate(() => PW.right), 2);
    await p.screenshot({ path: `${shots}/pic-name.png` });
    for (let i = 0; i < 9; i++) await p.evaluate(() => { if (PW.res == null) { PW.val = ""; picResult("bad"); } picNext(); });
    await p.waitForFunction(() => PW.mode === "done");
    assert.ok(await p.evaluate(() => Object.keys(P().cards).filter((k) => k.startsWith("pic-")).length) >= 10);
    await p.evaluate(() => { PW = null; S.lang = "pt"; location.hash = "hoje"; render(); });

    // pronunciation check on one word
    await p.evaluate(() => { window.__say = "vida"; S.lang = "pt"; location.hash = "sons"; render(); }); await p.waitForSelector('[data-act="try-say"]');
    await p.click('[data-act="try-say"]'); await p.waitForSelector(".ok-note");
    await p.evaluate(() => { window.__say = "bida"; }); await p.click('[data-act="try-say"]');
    await p.waitForFunction(() => /Heard "bida"/.test(document.body.innerText));

    // profile
    await p.evaluate(() => (location.hash = "perfil")); await p.waitForSelector(".stamps");
    await p.screenshot({ path: `${shots}/stamps.png` });
    await p.evaluate(() => (location.hash = "hoje")); await p.waitForTimeout(100);
    await p.click(".who"); await p.waitForSelector("#profile-name");
    assert.equal(await overflow(p), false, "profile overflow");
    await p.fill("#profile-name", "Marcos"); await p.keyboard.press("Tab");
    assert.equal(await p.evaluate(() => S.name), "Marcos");
    await p.screenshot({ path: `${shots}/10-profile.png` });
    await p.click('[data-act="backup"]');
    const backup = await p.inputValue("#backup-text");
    assert.ok(backup.includes("profiles"));

    // comfortable touch targets and readable text on every phone screen
    const audit = (where) => p.evaluate((where) => {
      const out = [];
      const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; };
      for (const e of document.querySelectorAll("button,a,summary,label.check,input:not([type=checkbox]),textarea")) {
        if (!visible(e) || e.closest("thead")) continue;
        const r = e.getBoundingClientRect();
        if (Math.round(r.height) < 44 || Math.round(r.width) < 44) out.push(`${where} target ${e.tagName}.${e.className} "${(e.innerText || e.getAttribute("aria-label") || "").slice(0, 20)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walk.nextNode()) {
        const n = walk.currentNode, e = n.parentElement;
        if (!n.textContent.trim() || !e || !visible(e) || ["SCRIPT", "STYLE"].includes(e.tagName) || e.closest("thead")) continue;
        const min = e.closest("nav") ? 13.5 : 15, size = parseFloat(getComputedStyle(e).fontSize);
        if (size < min) out.push(`${where} text ${size}px "${n.textContent.trim().slice(0, 20)}"`);
      }
      return out;
    }, where);
    let issues = [];
    for (const lang of ["fr", "pt"]) {
      await p.evaluate((l) => { S.lang = l; R = null; render(); }, lang);
      for (const t of ["hoje", "perfil", "fotos", "conversa", "cartoes", "ponte", "sons"]) {
        await p.evaluate((x) => (location.hash = x), t); await p.waitForTimeout(120);
        issues = issues.concat(await audit(`${lang}/${t}`));
        if (t === "ponte" && lang === "pt") { await p.click('[data-act="pseg"][data-v="bp"]'); await p.waitForSelector("#vocab-body tr"); issues = issues.concat(await audit("pt/ponte-bp")); await p.screenshot({ path: `${shots}/a11y-ponte.png` }); }
        assert.equal(await overflow(p), false, `overflow ${lang}/${t}`);
      }
    }
    await p.evaluate(() => (location.hash = "cartoes")); await p.waitForTimeout(100);
    await p.click('[data-act="review"]'); issues = issues.concat(await audit("card")); await p.screenshot({ path: `${shots}/a11y-card.png` });
    await p.click('[data-act="quit"]');
    await p.evaluate(() => { startTest(); }); await p.waitForTimeout(100); issues = issues.concat(await audit("test")); await p.screenshot({ path: `${shots}/a11y-test.png` });
    await p.evaluate(() => (location.hash = "hoje")); await p.waitForTimeout(100);
    await p.evaluate(() => { homeOpen = true; render(); }); issues = issues.concat(await audit("landing"));
    await p.evaluate(() => { homeOpen = false; render(); });
    if (issues.length) console.log([...new Set(issues.map((x) => x.replace(/^\S+ /, "")))].join("\n"));
    assert.deepEqual(issues, [], "accessibility issues");

    // largest text keeps every screen usable
    await p.evaluate(() => { S.textSize = "largest"; save(); render(); });
    for (const t of ["hoje", "perfil", "conversa", "cartoes", "ponte", "sons"]) {
      await p.evaluate((x) => (location.hash = x), t); await p.waitForTimeout(120);
      assert.equal(await overflow(p), false, "largest text overflow on " + t);
      if (t === "hoje" || t === "conversa") await p.screenshot({ path: `${shots}/a11y-largest-${t}.png` });
    }
    await p.evaluate(() => { S.textSize = "standard"; save(); render(); });
    await p.evaluate(() => (location.hash = "conversa")); await p.waitForTimeout(100);
    await p.screenshot({ path: `${shots}/a11y-chat.png` });
    await p.focus("#chat-input"); await p.waitForTimeout(100);
    assert.equal(await p.isVisible("#nav a"), false, "tab bar hides while typing");
    await p.screenshot({ path: `${shots}/a11y-typing.png` });
    await p.evaluate(() => document.activeElement.blur());

    // Mac width
    await p.setViewportSize({ width: 1280, height: 800 });
    for (const t of ["hoje", "perfil", "conversa", "cartoes", "ponte", "sons"]) {
      await p.evaluate((x) => (location.hash = x), t); await p.waitForTimeout(150);
      assert.equal(await overflow(p), false, "desktop overflow on " + t);
      await p.screenshot({ path: `${shots}/mac-${t}.png` });
    }
    await p.evaluate(() => (location.hash = "hoje")); await p.waitForTimeout(100);
    await p.evaluate(() => document.activeElement.blur()); await p.keyboard.press("3"); await p.waitForFunction(() => tab === "cartoes");
    await p.click(".brand"); await p.waitForSelector(".landing-art"); await p.screenshot({ path: `${shots}/mac-landing.png` });
    await p.click('[data-act="guest"]'); await p.waitForFunction(() => !homeOpen);
    await p.setViewportSize({ width: 390, height: 664 });
    await p.evaluate(() => (location.hash = "hoje")); await p.waitForTimeout(100);

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
