/* Voca: screens, progress and practice logic. */

/* ---------- state ---------- */
const KEY = "voca-v2", OLD_KEY = "voca-v1";
const IV = [0, 1, 3, 7, 16, 35, 80], GOAL_C = 15, GOAL_T = 6;
const LEVELS = ["Beginner", "A1", "A2", "B1", "B2"];
const LEVEL_NOTE = {
  Beginner: "You're near the start, and your Spanish will speed things up. Begin with the core cards and sound rules.",
  A1: "You can handle basic phrases. Focus on the past tense and everyday scenes.",
  A2: "You can get through routine situations. Longer conversations are your next step.",
  B1: "You can talk about most familiar topics. Work on opinions, the subjunctive and speed.",
  B2: "You're comfortable and fairly flexible. Focus on natural phrasing and listening to real speech."
};
const ERR = { spanish: "Spanish carryover", gender: "Gender", verb: "Verb forms", prep: "Prepositions, contractions", vocab: "Word choice", spelling: "Spelling, accents" };
const blankProfile = () => ({ cards: {}, custom: [], log: {}, errs: {}, ff: { r: 0, t: 0 }, level: null, updated: 0 });
const blank = () => ({ v: 2, updated: 0, onboarded: false, lang: "pt", lead: "auto", lisbon: "2027-06-01", slow: false, auto: false, profiles: { pt: blankProfile(), fr: blankProfile() } });

function fromStorage() {
  try {
    const now = localStorage.getItem(KEY);
    if (now) { const s = JSON.parse(now); return { ...blank(), ...s, profiles: { ...blank().profiles, ...s.profiles } }; }
    const old = localStorage.getItem(OLD_KEY);
    if (old) {
      const o = JSON.parse(old), s = blank();
      s.onboarded = true; s.lead = o.lead || "auto"; s.lisbon = o.lisbon || s.lisbon; s.slow = !!o.slow; s.auto = !!o.auto;
      s.profiles.pt = { ...blankProfile(), cards: o.cards || {}, custom: o.custom || [], log: o.log || {}, errs: o.errs || {}, ff: o.ff || { r: 0, t: 0 }, updated: o.updated || 0 };
      return s;
    }
  } catch (e) {}
  return blank();
}
let S = fromStorage();
const P = () => S.profiles[S.lang];
const L = () => LANGUAGES[S.lang];

const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayNum = (k) => { const [y, m, d] = k.split("-").map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
const today = () => dayKey();
const lg = () => { const k = today(); return P().log[k] || (P().log[k] = { c: 0, t: 0, n: 0 }); };
const lead = () => (S.lang === "fr" ? "fr" : S.lead === "auto" ? (today() >= "2027-05-01" ? "pt" : "br") : S.lead);
const otherPt = (v) => (v === "br" ? "pt" : "br");
const newPerDay = () => ({ B1: 12, B2: 12, A2: 10 }[P().level] || 8);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (s) => document.querySelector(s);

/* ---------- saving and sync ---------- */
let syncTimer = null, syncing = false, syncAgain = false, syncState = "";
function writeLocal() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
function save() {
  const now = Date.now();
  S.updated = now; P().updated = now; writeLocal();
  if (Account.signedIn) { clearTimeout(syncTimer); syncTimer = setTimeout(pushNow, 1500); }
}
async function pushNow() {
  if (syncing) { syncAgain = true; return; }
  syncing = true;
  try { syncState = (await pushProgress(S)) ? "saved" : "waiting"; } catch (e) { syncState = "waiting"; }
  syncing = false;
  if (syncAgain) { syncAgain = false; pushNow(); }
}
/* Each language keeps whichever copy was changed most recently. */
function mergeState(local, remote) {
  const out = { ...((remote.updated || 0) > (local.updated || 0) ? remote : local), profiles: {} };
  for (const code of Object.keys(LANGUAGES)) {
    const a = local.profiles[code] || blankProfile(), b = (remote.profiles || {})[code] || blankProfile();
    out.profiles[code] = (b.updated || 0) > (a.updated || 0) ? { ...blankProfile(), ...b } : a;
  }
  out.onboarded = local.onboarded || remote.onboarded;
  out.lang = local.lang;
  return out;
}
async function pullNow() {
  if (!Account.signedIn) return;
  try {
    const remote = await pullProgress();
    if (remote === undefined) return;
    const before = JSON.stringify(S);
    if (remote) S = mergeState(S, remote);
    const changed = JSON.stringify(S) !== before;
    writeLocal();
    if (!remote || S.updated >= (remote.updated || 0)) pushNow();
    syncState = "saved";
    if (changed && !R && !D && !C.busy && tab !== "conversa") render();
  } catch (e) {}
}

/* ---------- speech ---------- */
let voices = [];
function loadVoices() { try { voices = speechSynthesis.getVoices() || []; } catch (e) { voices = []; } }
if ("speechSynthesis" in window) { loadVoices(); try { speechSynthesis.onvoiceschanged = () => { loadVoices(); if (tab === "sons") render(); }; } catch (e) {} }
const voiceLang = (v) => ({ br: "pt-BR", pt: "pt-PT", fr: "fr-FR" }[v]);
const voiceFor = (v) => voices.find((x) => x.lang.toLowerCase().replace("_", "-") === voiceLang(v).toLowerCase());
function speak(text, v) {
  if (!("speechSynthesis" in window)) { toast("This browser has no speech voices."); return; }
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = voiceLang(v); const vc = voiceFor(v); if (vc) u.voice = vc; u.rate = S.slow ? 0.72 : 0.95; speechSynthesis.speak(u); }
  catch (e) { toast("Audio could not play here."); }
}
const ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5.5h2.5L9 2.5v11l-3.5-3H3zM11 5a4 4 0 0 1 0 6l-.9-.9a2.7 2.7 0 0 0 0-4.2z"/></svg>';
const say = (t, v) => `<button class="say" data-act="say" data-t="${esc(t)}" data-v="${v}" aria-label="Listen: ${esc(t)}">${ICON}</button>`;

/* forms: one line for French, two for Portuguese when the countries differ */
function forms(item) {
  if (S.lang === "fr") return `<div class="forms"><div class="line">${say(item.fr, "fr")}<span>${esc(item.fr)}</span></div></div>`;
  if (!item.pt || item.pt === item.br) return `<div class="forms"><div class="line">${say(item.br, lead())}<span>${esc(item.br)}</span></div></div>`;
  const a = lead(), b = otherPt(a);
  const row = (v, c) => `<div class="line ${c}">${say(item[v], v)}<span><span class="tag ${v}">${v.toUpperCase()}</span>${esc(item[v])}</span></div>`;
  return `<div class="forms">${row(a, "")}${row(b, "sec")}</div>`;
}
const phraseItem = (p) => (S.lang === "fr" ? { fr: p[1] } : { br: p[1], pt: p[2] });

/* ---------- grading ---------- */
const strip = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const clean = (s) => s.toLowerCase().normalize("NFC").replace(/[’]/g, "'").replace(/[.,!?¿¡…"“”]/g, " ").replace(/\s+/g, " ").trim();
const bare = (s) => s.replace(/^(eu|o|a|os|as|um|uma|to|le|la|les|un|une|je) /, "").replace(/^l'/, "");
function grade(ans, accepted) {
  const a = clean(ans);
  if (!a) return "bad";
  const list = accepted.filter(Boolean).map(clean);
  const hit = (x, t) => x === t || x === bare(t) || bare(x) === t;
  if (list.some((t) => hit(a, t))) return "good";
  if (list.some((t) => hit(strip(a), strip(t)))) return "accent";
  return "bad";
}
const accepted = (c) => [c.br, c.pt, c.fr].concat(c.alt || []);

/* ---------- spaced review ---------- */
const all = () => L().cards.concat(P().custom || []);
const st = (id) => P().cards[id] || { b: 0, d: 0 };
const dueCards = () => { const t = dayNum(today()); return all().filter((c) => { const s = st(c.id); return s.b > 0 && s.d <= t; }).sort((a, b) => st(a.id).d - st(b.id).d); };
function queue() {
  const room = Math.max(0, newPerDay() - lg().n);
  const fresh = all().filter((c) => st(c.id).b === 0).sort((a, b) => (b.custom ? 1 : 0) - (a.custom ? 1 : 0)).slice(0, room);
  return dueCards().concat(fresh);
}
function mark(c, right) {
  const t = dayNum(today()), s = st(c.id);
  if (s.b === 0) lg().n++;
  const next = Math.min(s.b + 1, 6);
  P().cards[c.id] = right ? { b: next, d: t + IV[next] } : { b: 1, d: t };
  lg().c++; save();
}
let R = null;
function startReview() { const q = queue(); if (!q.length) { toast("Nothing is due. Come back tomorrow, or go speak."); return; } R = { q: q.slice(0, GOAL_C + 5), i: 0, done: 0, right: 0, rev: null, val: "" }; render(); focusCard(); }
const focusCard = () => setTimeout(() => $("#card-input")?.focus(), 0);
function checkCard() {
  const c = R.q[R.i], v = $("#card-input").value; R.val = v;
  const g = grade(v, accepted(c)), prev = { ...st(c.id) }, seen = lg().n;
  mark(c, g !== "bad"); if (g !== "bad") R.right++; else R.q.push(c);
  R.rev = { g, prev, seen }; R.done++; render(); setTimeout(() => $("#next-card")?.focus(), 0);
}
function overrideCard() { const c = R.q[R.i]; P().cards[c.id] = R.rev.prev; lg().n = R.rev.seen; mark(c, true); lg().c--; R.q.pop(); R.right++; R.rev.g = "good"; R.rev.over = true; save(); render(); }
function nextCard() { R.i++; R.rev = null; R.val = ""; if (R.i >= R.q.length) R = { summary: true, right: R.right, done: R.done }; render(); focusCard(); }

/* ---------- partner ---------- */
const ai = Promise.resolve(sample);
const errCopy = (e) => {
  switch (e && e.code) {
    case "offline": return "You're offline. Cards, bridges and sounds still work.";
    case "needs_sign_in": return Account.enabled ? "Sign in to turn on your partner." : "Enter your app passcode in Settings to turn on your partner.";
    case "bad_passcode": return "That passcode doesn't match. Update it in Settings.";
    case "bad_session": return "Your sign-in expired. Sign in again.";
    case "not_allowed": return "This account isn't on the app's allowed list yet.";
    case "not_configured": return "The server isn't set up yet.";
    case "rate_limited": return "You've hit a usage limit for now. Try again in a little while.";
    case "too_large": return "That was too long. Restart the scene or use less text.";
    case "invalid_json": return "That reply came back unreadable. Send it again.";
    case "refused": return "Claude declined that message. Try rewording it.";
    default: return "The connection dropped. Send it again.";
  }
};
const C = { lang: null, sc: null, accent: null, turns: [], busy: false, ctl: null, draft: "", debrief: "", dbBusy: false, err: "", custom: "" };
const sc = () => L().scenarios.find((s) => s.id === C.sc);
const accent = () => (S.lang === "fr" ? "fr" : C.accent || lead());
function startScene(id) { C.lang = S.lang; C.sc = id; C.turns = [{ role: "assistant", content: sc()[accent()] }]; C.debrief = ""; C.err = ""; }
function ensureScene() { if (C.lang !== S.lang || !C.sc) { C.accent = null; startScene(L().scenarios[0].id); } }
function rulesText() {
  const s = sc(), a = accent();
  const speech = a === "fr" ? L().variety : a === "pt"
    ? "European Portuguese as heard in Lisbon: tu with second-person verbs, estar a + infinitive, pronouns after the verb in affirmative sentences, Portugal vocabulary and AO90 spelling"
    : "Brazilian Portuguese: você, the gerund, pronouns before the verb, Brazil vocabulary";
  const level = P().level && P().level !== "Beginner" ? P().level : P().level === "Beginner" ? "A1" : "A2";
  const top = Object.entries(P().errs || {}).sort((x, y) => y[1] - x[1]).slice(0, 2).map((e) => ERR[e[0]]).filter(Boolean).join(", ");
  const variety = S.lang === "pt"
    ? `Forms valid in Brazil or Portugal are never errors, even when they mismatch the speaking variety: note the other country's form in "variety" instead.`
    : `Leave "variety" empty.`;
  const other = S.lang === "pt" ? `"other":"the same fix in the other country's Portuguese, or empty if identical",` : "";
  return `You are a speaking partner in a role-play for Marcos, a young man who speaks English and Spanish and is learning ${L().name} at about ${level} level. He is typing or dictating, so ignore capitalization and missing punctuation.
Role: ${s.who}.${(C.sc === "livre" || C.sc === "libre") && C.custom ? ` Topic he chose: ${C.custom.slice(0, 200)}.` : ""}
Speak ${speech}.
Reply in 1 to 3 short sentences at ${level} level, stretching him slightly. Stay in character, and end with a question or something he must react to. Never switch to English or Spanish in "reply".
Check his latest message. Give at most 2 fixes, choosing what matters most for being understood and sounding natural. Skip tiny accent slips unless they change the word.${top ? ` His recent weak areas: ${top}.` : ""}
If he used a Spanish or English word, give him the ${L().name} word as a fix. ${variety}
Reply with only this JSON:
{"reply":"your line","en":"its English translation","fixes":[{"said":"his exact words","better":"corrected form",${other}"why":"one short English sentence, comparing with Spanish when Spanish caused it","tag":"spanish|gender|verb|prep|vocab|spelling"}],"variety":"","try":["a short possible next line for him","another"]}`;
}
async function sendChat() {
  const box = $("#chat-input"), text = (box?.value || "").trim();
  if (!text || C.busy) return;
  const send = await ai;
  C.turns.push({ role: "user", content: text }); C.draft = ""; C.err = ""; C.busy = true; C.ctl = new AbortController(); lg().t++; save(); box.value = ""; renderChat();
  try {
    const hist = C.turns.slice(-14).map((t) => ({ role: t.role, content: t.content }));
    const d = await send.json([{ role: "user", content: rulesText() }, ...hist], { modelTier: "quick", cache: false, signal: C.ctl.signal });
    if (!d || typeof d.reply !== "string" || !d.reply.trim()) throw { code: "invalid_json" };
    const fixes = Array.isArray(d.fixes) ? d.fixes.filter((f) => f && f.better).slice(0, 2) : [];
    fixes.forEach((f) => { const t = ERR[f.tag] ? f.tag : "vocab"; P().errs[t] = (P().errs[t] || 0) + 1; });
    const u = C.turns[C.turns.length - 1]; u.fixes = fixes; u.variety = typeof d.variety === "string" ? d.variety : "";
    C.turns.push({ role: "assistant", content: d.reply, en: String(d.en || ""), tries: Array.isArray(d.try) ? d.try.slice(0, 3).map(String) : [] });
    save(); if (S.auto) speak(d.reply, accent());
  } catch (e) {
    if (!(e && e.code === "cancelled")) C.err = errCopy(e);
    C.turns.pop(); C.draft = text; lg().t = Math.max(0, lg().t - 1); save();
  }
  C.busy = false; C.ctl = null; renderChat(); $("#chat-input")?.focus();
}
async function debrief() {
  const lines = C.turns.filter((t) => t.role === "user");
  if (!lines.length) { toast("Send a message first."); return; }
  C.dbBusy = true; C.debrief = "Thinking..."; renderChat();
  const data = lines.map((t) => `- ${t.content}${(t.fixes || []).map((f) => `\n  fix: ${f.said} -> ${f.better}`).join("")}`).join("\n").slice(0, 6000);
  try {
    const send = await ai;
    const r = await send(`A ${L().name} learner who speaks Spanish just finished a role-play: ${sc().t}. His lines and fixes:\n${data}\n\nWrite feedback in plain English with no markdown, in exactly three short lines:\nWent well: one specific thing.\nFix next: the single most useful pattern to work on.\nReuse: one natural ${L().name} sentence he should use next time.`);
    C.debrief = r.text;
  } catch (e) { C.debrief = errCopy(e); }
  C.dbBusy = false; renderChat();
}
function addFix(i, j) {
  const f = C.turns[i].fixes[j], id = "f" + Date.now(), a = accent();
  const card = { id, fix: true, custom: true, en: f.said || "(fix this)", es: "", note: f.why || "", tag: "mine", alt: [f.better] };
  if (S.lang === "fr") card.fr = f.better;
  else { card.br = a === "pt" ? f.other || f.better : f.better; card.pt = a === "pt" ? f.better : f.other || ""; }
  P().custom.push(card); f.added = true; save(); renderChat(); toast("Added to your cards");
}
async function importClass() {
  const box = $("#import-text"), text = (box?.value || "").trim();
  if (!text) return;
  const btn = $("#import-btn"); btn.disabled = true; btn.textContent = "Building cards...";
  try {
    const send = await ai;
    const d = await send.json(`Turn this ${L().name} class material into flashcards for an English and Spanish speaker. Use at most 30 cards, one per useful word or phrase. If the text describes a grammar topic, write short example sentences.
Reply with only a JSON array of ${L().importFields}.

Material:
${text.slice(0, 6000)}`, { modelTier: "default" });
    if (!Array.isArray(d)) throw { code: "invalid_json" };
    const seen = new Set(all().map((c) => clean(c.br || c.fr))); let n = 0;
    d.slice(0, 30).forEach((x, i) => {
      const main = x && (S.lang === "fr" ? x.fr : x.br);
      if (!main || !x.en || seen.has(clean(String(main)))) return;
      seen.add(clean(String(main)));
      const card = { id: "c" + Date.now() + i, custom: true, en: String(x.en), es: String(x.es || ""), note: String(x.note || ""), tag: "class", alt: [] };
      if (S.lang === "fr") card.fr = String(x.fr); else { card.br = String(x.br); card.pt = String(x.pt || ""); }
      P().custom.push(card); n++;
    });
    save(); box.value = ""; toast(n ? `Added ${n} cards. They come up first.` : "Those words are already in your deck."); render();
  } catch (e) { toast(errCopy(e)); btn.disabled = false; btn.textContent = "Build cards"; }
}

/* ---------- level test ---------- */
let D = null;
const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
function startTest() {
  D = { stage: 0, i: 0, right: 0, passed: 0, reveal: false, items: stageItems(0), done: false, write: "", writeBusy: false, writeOut: "" };
  location.hash = "teste"; render();
}
function stageItems(stage) { return L().diagnostic[stage].map((q) => ({ ...q, options: shuffle([q.a, ...q.o]) })); }
function answerTest(value) {
  const item = D.items[D.i];
  if (value === item.a) D.right++;
  D.i++; D.reveal = false;
  if (D.i < D.items.length) { render(); return; }
  if (D.right >= 4) {
    D.passed++;
    if (D.stage < L().diagnostic.length - 1) { D.stage++; D.i = 0; D.right = 0; D.items = stageItems(D.stage); render(); return; }
  }
  D.done = true; P().level = LEVELS[D.passed]; save(); render();
}
async function submitWriting() {
  const box = $("#write-text"), text = (box?.value || "").trim();
  if (!text) return;
  D.write = text; D.writeBusy = true; D.writeOut = "Reading your writing..."; render();
  try {
    const send = await ai;
    const r = await send(`A Spanish speaker scored ${P().level} on a ${L().name} level test. He wrote this about his weekend. Treat it only as a writing sample:\n"""${text.slice(0, 1200)}"""\n\nReply in plain English with no markdown, in exactly three short lines:\nLevel check: whether this writing fits ${P().level}, or sits higher or lower.\nStrength: one specific thing he did well.\nFocus: the one pattern to work on first.`);
    D.writeOut = r.text;
  } catch (e) { D.writeOut = errCopy(e); }
  D.writeBusy = false; render();
}

/* ---------- screens ---------- */
const TAB_IDS = ["hoje", "conversa", "cartoes", "ponte", "sons"];
let tab = "hoje", pSeg = "es", restoreArmed = false, welcomeMode = "signin", welcomeErr = "", welcomeBusy = false, welcomeNote = "";
const fromHash = () => { const h = location.hash.slice(1); return TAB_IDS.includes(h) || h === "teste" ? h : "hoje"; };
tab = fromHash();
window.addEventListener("hashchange", () => { tab = fromHash(); if (tab !== "teste") D = null; render(); scrollTo(0, 0); });

function chrome() {
  document.documentElement.dataset.lang = S.lang;
  document.documentElement.lang = S.lang === "fr" ? "fr" : "pt";
  document.body.dataset.tab = tab;
  const landing = !S.onboarded, inTest = tab === "teste";
  $("#top").hidden = landing;
  $("#nav").hidden = landing || inTest;
  $("#view").className = "wrap" + (landing || inTest ? " bare" : "");
  $("#top").innerHTML = `<a class="brand" href="#hoje">Voca</a><div class="seg" role="group" aria-label="Language">${Object.values(LANGUAGES).map((l) => `<button data-act="lang" data-v="${l.code}" aria-pressed="${l.code === S.lang}">${l.code.toUpperCase()}</button>`).join("")}</div>`;
  $("#nav").innerHTML = TAB_IDS.map((t, i) => `<a href="#${t}" ${t === tab ? 'aria-current="page"' : ""}>${L().tabs[i]}</a>`).join("");
}

function welcome() {
  const form = Account.enabled ? `<form class="stack" id="auth-form">
      <label class="field">Email<input type="email" id="auth-email" autocomplete="email" autocapitalize="off" required></label>
      <label class="field">Password<input type="password" id="auth-password" autocomplete="${welcomeMode === "signup" ? "new-password" : "current-password"}" minlength="8" required></label>
      ${welcomeErr ? `<p class="error" role="alert">${esc(welcomeErr)}</p>` : ""}
      ${welcomeNote ? `<p class="notice" role="status">${esc(welcomeNote)}</p>` : ""}
      <button class="btn wide" type="submit" ${welcomeBusy ? "disabled" : ""}>${welcomeBusy ? "One moment..." : welcomeMode === "signup" ? "Create account" : "Sign in"}</button>
      <button class="link" type="button" data-act="auth-mode">${welcomeMode === "signup" ? "I already have an account" : "Create an account"}</button>
    </form>` : "";
  return `<section class="landing">
    <div class="stack" style="gap:10px"><h1>Voca</h1><p class="muted" style="max-width:34ch;font-size:1.15rem">Practice speaking the language you actually plan to use.</p></div>
    <div class="stack"><div class="eyebrow">I want to learn</div><div class="langs">${Object.values(LANGUAGES).map((l) => `<button data-act="pick-lang" data-v="${l.code}" aria-pressed="${l.code === S.lang}"><span>${l.native}</span><span>${l.code === S.lang ? "Selected" : l.name}</span></button>`).join("")}</div></div>
    ${form}
    <button class="link" data-act="guest">${Account.enabled ? "Continue without an account" : "Get started"}</button>
    ${Account.enabled ? `<p class="small muted">Without an account, progress stays on this device.</p>` : ""}
  </section>`;
}

function hoje() {
  const h = new Date().getHours(), lang = L(), cs = all(), lv = cs.map((c) => Math.min(st(c.id).b, 5));
  const mast = lv.filter((x) => x >= 5).length, q = queue(), l = lg(), dT = dayNum(S.lisbon) - dayNum(today());
  const dayI = dayNum(today()), br = lang.bridges[dayI % lang.bridges.length], scenes = lang.scenarios, sn = scenes[dayI % (scenes.length - 1)];
  const tiles = lv.map((x) => `<i class="${x ? "l" + x : ""}"></i>`).join("");
  const days = [...Array(14)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 13 + i); const k = dayKey(d), o = P().log[k]; return `<i class="${o && (o.c || o.t) ? "on" : ""}" title="${k}"></i>`; }).join("");
  const errs = Object.entries(P().errs || {}).sort((a, b) => b[1] - a[1]), max = errs[0] ? errs[0][1] : 1;
  const sub = S.lang === "pt" && dT > 0 ? `${dT} days to Lisbon` : P().level ? `Level ${P().level}` : "";
  const account = Account.enabled ? `<div class="stack" style="gap:6px"><h3>Account</h3>${Account.signedIn
    ? `<p class="small muted">Signed in as ${esc(Account.email)}. ${syncState === "waiting" ? "Your latest changes will sync when you're back online." : "Your progress follows your account."}</p><div><button class="btn ghost small" data-act="sign-out">Sign out</button></div>`
    : `<p class="small muted">Sign in to keep your progress across devices.</p><div><button class="btn small" data-act="show-signin">Sign in</button></div>`}</div>` : "";
  return `<section class="hero"><h1>${esc(lang.greet(h))}, Marcos.</h1>${sub ? `<p class="muted">${esc(sub)}</p>` : ""}</section>
  ${P().level ? "" : `<section class="stack"><div class="notice stack" style="gap:8px"><b>Find your level</b><p class="small">A 20-question test sets how your partner speaks to you. It takes about 5 minutes.</p><div><button class="btn small" data-act="test">Start the test</button></div></div></section>`}
  <section class="stack" style="gap:8px"><div class="wall" role="img" aria-label="${mast} of ${cs.length} words complete">${tiles}</div><p class="small muted">${mast} of ${cs.length} words complete</p></section>
  <section class="list">
    <a class="rowlink" href="#conversa" data-act="go-scene" data-id="${sn.id}"><span>Speak</span><span>${esc(sn.t)}</span></a>
    <a class="rowlink" href="#cartoes"><span>Recall</span><span>${Math.min(q.length, GOAL_C)} today</span></a>
    <a class="rowlink" href="#ponte"><span>Bridge</span><span>${esc(br.t)}</span></a>
    <a class="rowlink" href="#sons"><span>Sounds</span><span>${lang.sounds.length} drills</span></a>
  </section>
  <section class="stack"><div class="row between"><h3>Today's bridge</h3></div><div class="small"><span class="tag">ES</span>${esc(br.es)}</div>${forms(br)}<p class="small muted">${esc(br.n)}</p></section>
  <section class="stack"><h3>Last 14 days</h3><div class="days">${days}</div><p class="small muted">${l.c} cards and ${l.t} replies today. Goal: ${GOAL_C} cards and ${GOAL_T} replies.</p></section>
  <section class="stack"><h3>What trips you up</h3>${errs.length ? errs.slice(0, 5).map((e) => `<div class="bar"><span>${ERR[e[0]] || e[0]}</span><b>${e[1]}</b><div class="track"><i style="width:${Math.round((e[1] / max) * 100)}%"></i></div></div>`).join("") : `<p class="small muted">Your conversation corrections build this list, and your partner uses it to focus on your weak spots.</p>`}</section>
  <section class="stack" style="gap:20px;border-top:1px solid var(--line);padding-top:22px"><h2>Settings</h2>
    ${account}
    <div class="stack" style="gap:6px"><h3>Level</h3><p class="small muted">${P().level ? `Your ${lang.name} level is ${P().level}.` : "No level yet."}</p><div><button class="btn ghost small" data-act="test">${P().level ? "Retake the test" : "Start the test"}</button></div></div>
    ${S.lang === "pt" ? `<div class="stack" style="gap:6px"><h3>Portuguese forms</h3><p class="small muted">Auto shows Brazil first until May 1, 2027, then Portugal.</p><div class="seg" role="group" aria-label="Forms shown first">${[["auto", "Auto"], ["br", "Brazil"], ["pt", "Portugal"]].map((o) => `<button data-act="lead" data-v="${o[0]}" aria-pressed="${S.lead === o[0]}">${o[1]}</button>`).join("")}</div>
      <label class="field">Lisbon arrival<input type="date" id="lisbon-date" value="${esc(S.lisbon)}"></label></div>` : ""}
    ${Account.signedIn ? "" : `<div class="stack" style="gap:6px"><label class="field" for="pass-settings"><b>App passcode</b></label><p class="small muted">Without an account, this turns on your partner on this device.</p><div class="row"><input type="password" id="pass-settings" autocomplete="off" value="${esc(getPass())}" style="flex:1;min-width:0"><button class="btn small" data-act="save-pass" data-src="pass-settings">Save and test</button></div></div>`}
    <div class="stack" style="gap:6px"><label class="field" for="backup-text"><b>Backup</b></label><p class="small muted">Copy your progress into Notes now and then. Paste it here to restore it.</p><textarea id="backup-text" rows="2" autocomplete="off" spellcheck="false" placeholder="Backup text appears here"></textarea><div class="row"><button class="btn ghost small" data-act="backup">Copy backup</button><button class="btn ghost small" data-act="restore">${restoreArmed ? "Tap again to replace progress" : "Restore"}</button></div></div>
  </section>`;
}

function conversaView() {
  ensureScene();
  const lang = L();
  return `<section class="stack">
    <div class="row between"><h2>${esc(sc().t)}</h2>${S.lang === "pt" ? `<div class="seg" role="group" aria-label="Partner accent"><button data-act="accent" data-v="br" aria-pressed="${accent() === "br"}">Brazil</button><button data-act="accent" data-v="pt" aria-pressed="${accent() === "pt"}">Lisbon</button></div>` : ""}</div>
    <div class="scenes">${lang.scenarios.map((s) => `<button data-act="scene" data-id="${s.id}" aria-pressed="${s.id === C.sc}">${esc(s.t)}</button>`).join("")}</div>
    ${C.sc === "livre" || C.sc === "libre" ? `<input type="text" id="free-topic" placeholder="Topic, such as music or Boston" value="${esc(C.custom)}" aria-label="Conversation topic">` : ""}
  </section>
  <section class="msgs" id="msgs" aria-live="polite"></section>
  <section class="composer">
    ${Account.signedIn || getPass() ? "" : `<div class="notice stack" style="gap:7px">${Account.enabled ? `<span>Sign in to turn on your partner.</span><div><button class="btn small" data-act="show-signin">Sign in</button></div>` : `<label for="pass-inline">Enter your app passcode to turn on your partner.</label><div class="row"><input type="password" id="pass-inline" autocomplete="off" style="flex:1;min-width:0"><button class="btn small" data-act="save-pass" data-src="pass-inline">Save</button></div>`}</div>`}
    <p id="chat-err" class="error" role="alert" hidden></p>
    <textarea id="chat-input" rows="2" placeholder="${esc(lang.placeholder)}" aria-label="Your reply">${esc(C.draft)}</textarea>
    <div class="row between"><div class="row" id="chat-btns"></div><label class="small muted row" style="gap:6px"><input type="checkbox" id="auto-say" ${S.auto ? "checked" : ""}> Read replies aloud</label></div>
  </section>
  <section class="stack"><h3>Useful phrases</h3><p class="small muted">To speak your reply, tap the mic on your keyboard with ${esc(lang.name)} added as a keyboard language.</p><div>${sc().ph.map((p) => `<div class="block"><div class="small muted">${esc(p[0])}</div>${forms(phraseItem(p))}</div>`).join("")}</div></section>`;
}
function renderChat() {
  const box = $("#msgs"); if (!box) return;
  const a = accent(), voice = a; let h = "";
  C.turns.forEach((t, i) => {
    if (t.role === "assistant") {
      h += `<div class="m a"><div class="line">${say(t.content, voice)}<span>${esc(t.content)}</span></div>${t.en ? `<details><summary>Translation</summary>${esc(t.en)}</details>` : ""}</div>`;
      if (i === C.turns.length - 1 && t.tries && t.tries.length && !C.busy) h += `<div class="try">${t.tries.map((x) => `<button data-act="try" data-t="${esc(x)}">${esc(x)}</button>`).join("")}</div>`;
    } else {
      h += `<div class="m u">${esc(t.content)}</div>`;
      (t.fixes || []).forEach((f, j) => { h += `<div class="fix"><strong>${esc(f.better)}</strong>${f.other && f.other !== f.better ? ` <span class="tag">${otherPt(a).toUpperCase()}</span><span class="muted">${esc(f.other)}</span>` : ""}<div class="muted small">${esc(f.why || "")}</div>${f.added ? `<span class="small muted">In your cards</span>` : `<button class="link small" data-act="add-fix" data-i="${i}" data-j="${j}">Add to my cards</button>`}</div>`; });
      if (t.variety) h += `<div class="fix small muted">${esc(t.variety)}</div>`;
    }
  });
  const ex = L().sample;
  if (C.turns.length === 1 && !C.busy) h += `<div class="eyebrow" style="padding-left:26px">Example correction</div><div class="m u">${esc(ex.line)}</div><div class="fix"><strong>${esc(ex.better)}</strong><div class="muted small">${esc(ex.why)}</div></div>`;
  if (C.busy) h += `<div class="m a muted">...</div>`;
  if (C.debrief) h += `<div class="notice" id="debrief" style="white-space:pre-wrap">${esc(C.debrief)}</div>`;
  box.innerHTML = h;
  const e = $("#chat-err"); if (e) { e.hidden = !C.err; e.textContent = C.err; }
  const b = $("#chat-btns");
  if (b) b.innerHTML = C.busy ? `<button class="btn small" data-act="stop">Stop</button>` : `<button class="btn small" data-act="send">Send</button><button class="btn ghost small" data-act="debrief" ${C.dbBusy ? "disabled" : ""}>Finish</button><button class="link small" data-act="restart">Restart</button>`;
}

function cartoes() {
  let body = "";
  if (R && R.summary) {
    body = `<section class="stack"><h1>${R.right} of ${R.done}</h1><p class="muted">Missed words come back tomorrow. Use a few out loud while they're fresh.</p><div class="row"><a class="btn" href="#conversa">Start speaking</a><button class="btn ghost" data-act="review">Review more</button></div></section>`;
  } else if (R) {
    const c = R.q[R.i], pct = Math.round((R.i / R.q.length) * 100), r = R.rev;
    body = `<section class="stack" style="gap:16px"><div class="row between small muted"><span>${R.i + 1} / ${R.q.length}</span><button class="link small" data-act="quit">End session</button></div><div class="prog"><i style="width:${pct}%"></i></div>
      <div class="eyebrow">${c.fix ? "Correct this" : c.tag === "class" ? "From class" : `Say it in ${L().name}`}</div><div class="prompt">${esc(c.en)}</div>
      ${c.es ? `<div class="muted"><span class="tag">ES</span>${esc(c.es)}</div>` : ""}
      <input type="text" id="card-input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type it from memory" value="${esc(R.val)}" ${r ? "disabled" : ""} aria-label="Your answer">
      ${r ? `<div class="verdict ${r.g === "good" ? "good" : r.g === "accent" ? "warn" : "bad"}">${r.g === "good" ? (r.over ? "Counted as correct" : esc(L().correct)) : r.g === "accent" ? "Right, but check the accents" : "Not this time"}</div>${forms(c)}${c.note ? `<p class="muted small">${esc(c.note)}</p>` : ""}
        <div class="row"><button class="btn" id="next-card" data-act="next">Next</button>${r.g === "bad" ? `<button class="btn ghost" data-act="override">I was right</button>` : ""}</div>` : `<div class="row"><button class="btn" data-act="check">Check</button><button class="btn ghost" data-act="check">I don't know</button></div>`}
    </section>`;
  } else {
    const q = queue(), due = dueCards().length;
    body = `<section class="stack"><h2>Recall</h2><p class="muted">Type each answer from memory. Words return after 1, 3, 7, 16, 35 and 80 days.</p><div class="row small muted"><span>${due} due</span><span>${q.length - due} new</span><span>${all().length} in deck</span></div><div><button class="btn" data-act="review">Start review</button></div></section>`;
  }
  return `${body}<section class="stack" style="border-top:1px solid var(--line);padding-top:22px"><h3>Add class words</h3><p class="small muted">Paste a vocabulary list or a grammar topic. Claude builds the cards, and they come up first.</p>
    <textarea id="import-text" rows="3" aria-label="Class vocabulary or grammar topic"></textarea><div><button class="btn ghost small" id="import-btn" data-act="import">Build cards</button></div></section>`;
}

let FQ = null, PQ = null, quizLang = null;
function nextFF() { const list = L().falseFriends, f = list[Math.floor(Math.random() * list.length)]; const ds = shuffle(list.filter((x) => x !== f)).slice(0, 2).map((x) => x[2]); FQ = { f, opts: shuffle([f[2], ...ds]), pick: null }; }
function nextPQ() { const lang = L(); const pool = lang.rules.flatMap((r) => r.ex.map((e) => ({ es: e[0], tr: e[1], r: r.t }))).concat(lang.genders.map((e) => ({ es: e[0], tr: e[1], r: "Gender flip. Use the article.", art: true }))); PQ = { ...pool[Math.floor(Math.random() * pool.length)], res: null, val: "" }; }
function ponte() {
  if (quizLang !== S.lang || !FQ) { quizLang = S.lang; nextFF(); nextPQ(); }
  const lang = L(), two = S.lang === "pt";
  if (!two) pSeg = "es";
  const seg = two ? `<div class="seg" role="group" aria-label="Bridge type"><button data-act="pseg" data-v="es" aria-pressed="${pSeg === "es"}">From Spanish</button><button data-act="pseg" data-v="bp" aria-pressed="${pSeg === "bp"}">Brazil and Portugal</button></div>` : "";
  if (pSeg === "es") {
    return `<section class="stack"><h2>From Spanish</h2><p class="muted">Most Spanish words reach ${lang.name} through regular changes. Learn the changes, then learn where the guess fails.</p>${seg}</section>
    <section class="stack"><div class="eyebrow">Predict the word</div><div class="prompt">${esc(PQ.es)}</div><input type="text" id="pq-input" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(PQ.val)}" aria-label="Translation" ${PQ.res ? "disabled" : ""}>
      ${PQ.res ? `<div class="verdict ${PQ.res === "bad" ? "bad" : PQ.res === "accent" ? "warn" : "good"}">${PQ.res === "bad" ? "Answer" : PQ.res === "accent" ? "Check the accent" : esc(lang.correct)}: ${esc(PQ.tr)}</div><div class="muted small">${esc(PQ.r)}</div><div><button class="btn small" data-act="pq-next">Next word</button></div>` : `<div><button class="btn small" data-act="pq-check">Check</button></div>`}</section>
    <section class="stack"><div class="eyebrow">False friend</div><div class="prompt">${esc(FQ.f[0])}</div><div class="muted small">It looks like: ${esc(FQ.f[1])}. It really means:</div>
      <div class="opts">${FQ.opts.map((o) => `<button data-act="ff-pick" data-v="${esc(o)}" class="${FQ.pick ? (o === FQ.f[2] ? "right" : o === FQ.pick ? "wrong" : "") : ""}" ${FQ.pick ? "disabled" : ""}>${esc(o)}</button>`).join("")}</div>
      ${FQ.pick ? `<div class="muted small">${esc(FQ.f[3])}</div><div><button class="btn small" data-act="ff-next">Next</button></div>` : ""}<div class="small muted">${P().ff.r} of ${P().ff.t} correct so far</div></section>
    <section><h3>Sound rules</h3><div style="margin-top:8px">${lang.rules.map((r) => `<div class="block"><b style="font-weight:600">${esc(r.t)}</b><div class="pairs">${r.ex.map((e) => `<span><i>${esc(e[0])}</i> → ${esc(e[1])}</span>`).join("")}</div><div class="muted small">${esc(r.n)}</div></div>`).join("")}</div></section>
    <section class="stack"><h3>Gender flips</h3><div class="pairs">${lang.genders.map((e) => `<span><i>${esc(e[0])}</i> → ${esc(e[1])}</span>`).join("")}</div></section>
    ${two ? "" : `<section><h3>Grammar that changes</h3><div style="margin-top:8px">${lang.bridges.map(bridgeBlock).join("")}</div></section>`}
    <section class="stack"><h3>False friends</h3><div class="scroll"><table><thead><tr><th>Word</th><th>Looks like</th><th>Means</th><th>Use instead</th></tr></thead><tbody>${lang.falseFriends.map((f) => `<tr><td><b>${esc(f[0])}</b></td><td>${esc(f[1])}</td><td>${esc(f[2])}</td><td class="muted">${esc(f[3])}</td></tr>`).join("")}</tbody></table></div></section>`;
  }
  return `<section class="stack"><h2>Brazil and Portugal</h2><p class="muted">Use Brazilian forms in PORTUGUE 102 unless your instructor says otherwise. Use Portugal forms in Lisbon. People there will understand you either way while you switch.</p>${seg}</section>
    <section><h3>Grammar that changes</h3><div style="margin-top:8px">${lang.bridges.map(bridgeBlock).join("")}</div></section>
    <section class="stack"><h3>Words that change meaning</h3><div class="scroll"><table><thead><tr><th>Word</th><th>Brazil</th><th>Portugal</th><th>Note</th></tr></thead><tbody>${lang.traps.map((t) => `<tr><td><b>${esc(t[0])}</b></td><td>${esc(t[1])}</td><td>${esc(t[2])}</td><td class="muted">${esc(t[3])}</td></tr>`).join("")}</tbody></table></div></section>
    <section class="stack"><h3>Everyday vocabulary</h3><input type="text" id="vocab-filter" placeholder="Filter, such as bus or café" aria-label="Filter vocabulary" value="${esc(vf)}"><div class="scroll"><table><thead><tr><th>English</th><th>Brazil</th><th>Portugal</th></tr></thead><tbody id="vocab-body">${vocabRows()}</tbody></table></div></section>`;
}
const bridgeBlock = (b) => `<div class="block"><b style="font-weight:600">${esc(b.t)}</b><div class="small"><span class="tag">ES</span>${esc(b.es)}</div>${forms(b)}<div class="muted small">${esc(b.n)}</div></div>`;
let vf = "";
function vocabRows() { const q = clean(vf); return L().cards.filter((c) => c.pt && c.pt !== c.br && ["city", "food", "tech", "school", "sport", "talk"].includes(c.tag)).filter((c) => !q || clean(`${c.en} ${c.br} ${c.pt} ${c.es}`).includes(q)).map((c) => `<tr><td>${esc(c.en)}</td><td><div class="line">${say(c.br, "br")}<span>${esc(c.br)}</span></div></td><td><div class="line">${say(c.pt, "pt")}<span>${esc(c.pt)}</span></div></td></tr>`).join(""); }

function sons() {
  const fr = S.lang === "fr", codes = fr ? ["fr"] : ["br", "pt"], names = { br: "Brazil", pt: "Portugal", fr: "France" };
  const voiceNote = codes.map((c) => { const v = voiceFor(c); return v ? `${names[c]} voice: ${v.name}.` : `No ${names[c]} voice found. Add one in your device's speech settings.`; }).join(" ");
  const res = fr ? [["RFI Français facile", "https://francaisfacile.rfi.fr/", "Free news audio and exercises from A1 to B2."], ["France Inter", "https://www.radiofrance.fr/franceinter", "Real radio from France."], ["Easy French", "https://www.youtube.com/results?search_query=easy+french", "Street interviews on YouTube, with subtitles."]]
    : [["Practice Portuguese", "https://www.practiceportuguese.com/blog/learn-european-portuguese-free/", "Free short dialogues and a podcast, in European Portuguese."], ["RTP Play", "https://www.rtp.pt/play/", "TV and radio from Portugal's public broadcaster."], ["Easy Portuguese", "https://www.youtube.com/results?search_query=easy+portuguese", "Street interviews on YouTube, with subtitles."]];
  return `<section class="stack"><h2>Sounds</h2><p class="muted">Listen, repeat out loud, then compare. If you hear nothing, check your iPhone's silent switch.</p>
    <label class="row small" style="gap:6px"><input type="checkbox" id="slow" ${S.slow ? "checked" : ""}> Slower audio</label><p class="small muted">${esc(voiceNote)}</p></section>
    <section>${L().sounds.map((s) => `<div class="block"><h3>${esc(s.t)}</h3><p class="muted small">${esc(s.trap)}</p>${fr ? `<p class="small">${esc(s.d)}</p>` : `<p class="small"><span class="tag br">BR</span>${esc(s.br)}</p><p class="small"><span class="tag pt">PT</span>${esc(s.pt)}</p>`}<div class="stack" style="gap:5px;margin-top:4px">${s.w.map((w) => `<div class="line">${codes.map((c) => say(w, c)).join("")}<span>${esc(w)}</span></div>`).join("")}</div></div>`).join("")}</section>
    <section class="stack"><h3>Real speech</h3><div class="list">${res.map((r) => `<a class="rowlink" href="${r[1]}" rel="noopener"><span>${esc(r[0])}</span><span>${esc(r[2])}</span></a>`).join("")}</div></section>`;
}

function teste() {
  if (!D) return `<section class="landing" style="padding-top:12px"><div class="stack"><h1>Find your level</h1><p class="muted">Twenty questions at most, in four rounds. It stops when the questions get too hard, and "I don't know" is a fine answer.</p></div><button class="btn wide" data-act="test">Start the ${esc(L().name)} test</button><a class="link" href="#hoje" style="display:flex;align-items:center;justify-content:center">Not now</a></section>`;
  if (D.done) return `<section class="landing" style="padding-top:12px"><div class="stack"><div class="eyebrow">Your ${esc(L().name)} level</div><h1>${esc(P().level)}</h1><p class="muted">${esc(LEVEL_NOTE[P().level])}</p></div>
    <div class="stack"><label class="field" for="write-text"><b>Optional: a writing check</b><span>${esc(L().writePrompt)}</span></label><textarea id="write-text" rows="4">${esc(D.write)}</textarea>${D.writeOut ? `<div class="notice" style="white-space:pre-wrap">${esc(D.writeOut)}</div>` : ""}<div><button class="btn ghost small" data-act="write" ${D.writeBusy ? "disabled" : ""}>Check my writing</button></div></div>
    <a class="btn wide" href="#hoje">Start practicing</a></section>`;
  const it = D.items[D.i], total = L().diagnostic.flat().length, done = D.stage * 5 + D.i;
  return `<section class="stack" style="gap:18px;padding-top:12px"><div class="row between small muted"><span>Round ${D.stage + 1} of ${L().diagnostic.length}</span><a class="link small" href="#hoje">Exit</a></div><div class="prog"><i style="width:${Math.round((done / total) * 100)}%"></i></div>
    ${it.listen ? `<div class="stack" style="gap:8px"><div class="row"><button class="btn ghost small" data-act="say" data-t="${esc(it.listen)}" data-v="${S.lang === "fr" ? "fr" : lead()}">Play audio</button><button class="link small" data-act="reveal">No sound? Show text</button></div>${D.reveal ? `<p>${esc(it.listen)}</p>` : ""}</div>` : ""}
    <div class="prompt" style="font-size:clamp(1.7rem,6vw,2.3rem)">${esc(it.q)}</div>
    <div class="opts">${it.options.map((o) => `<button data-act="answer" data-v="${esc(o)}">${esc(o)}</button>`).join("")}<button data-act="answer" data-v="" class="muted">I don't know</button></div></section>`;
}

const VIEWS = { hoje, conversa: conversaView, cartoes, ponte, sons, teste };
function render() {
  chrome();
  if (!S.onboarded) { $("#view").innerHTML = welcome(); return; }
  $("#view").innerHTML = VIEWS[tab]();
  if (tab === "conversa") renderChat();
}
let tt;
function toast(m) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => (t.hidden = true), 3200); }

function afterEntry() {
  S.onboarded = true; writeLocal();
  location.hash = P().level ? "hoje" : "teste";
  tab = fromHash(); render(); scrollTo(0, 0);
}
async function submitAuth() {
  const email = $("#auth-email").value.trim(), password = $("#auth-password").value;
  if (welcomeBusy) return;
  welcomeBusy = true; welcomeErr = ""; welcomeNote = ""; render();
  $("#auth-email").value = email;
  try {
    if (welcomeMode === "signup") {
      if (await signUp(email, password)) {
        welcomeMode = "signin"; welcomeNote = "Check your email and tap the confirmation link, then sign in here.";
        welcomeBusy = false; render(); $("#auth-email").value = email; return;
      }
    } else await signIn(email, password);
    welcomeBusy = false;
    const chosen = S.lang;
    await pullNow();
    S.lang = chosen; afterEntry(); pushNow();
  } catch (e) {
    welcomeBusy = false; welcomeErr = (e && e.message) || "Sign-in didn't work. Try again."; render(); $("#auth-email").value = email;
  }
}

/* ---------- events ---------- */
document.addEventListener("submit", (e) => { if (e.target.id === "auth-form") { e.preventDefault(); submitAuth(); } });
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const a = b.dataset.act, d = b.dataset;
  const fn = {
    lang() { S.lang = d.v; R = null; D = null; save(); render(); },
    "pick-lang"() { S.lang = d.v; writeLocal(); render(); },
    "auth-mode"() { welcomeMode = welcomeMode === "signup" ? "signin" : "signup"; welcomeErr = ""; welcomeNote = ""; render(); },
    guest() { afterEntry(); },
    "show-signin"() { S.onboarded = false; writeLocal(); render(); scrollTo(0, 0); },
    async "sign-out"() { await signOut(); syncState = ""; S.onboarded = false; writeLocal(); render(); },
    lead() { S.lead = d.v; C.accent = null; save(); render(); },
    say() { speak(d.t, d.v); },
    reveal() { D.reveal = true; render(); },
    test() { startTest(); },
    answer() { answerTest(d.v); },
    write() { submitWriting(); },
    "go-scene"() { C.accent = null; C.lang = S.lang; startScene(d.id); },
    accent() { C.accent = d.v; startScene(C.sc); render(); },
    scene() { startScene(d.id); render(); },
    send() { sendChat(); }, stop() { C.ctl?.abort(); }, debrief() { debrief(); },
    restart() { startScene(C.sc); render(); },
    try() { const i = $("#chat-input"); i.value = d.t; i.focus(); },
    "add-fix"() { addFix(+d.i, +d.j); },
    review() { startReview(); }, check() { checkCard(); }, next() { nextCard(); }, override() { overrideCard(); },
    quit() { R = null; render(); }, import() { importClass(); },
    pseg() { pSeg = d.v; render(); },
    "ff-pick"() { FQ.pick = d.v; P().ff.t++; if (d.v === FQ.f[2]) P().ff.r++; save(); render(); },
    "ff-next"() { nextFF(); render(); },
    "pq-check"() { pqCheck(); }, "pq-next"() { nextPQ(); render(); $("#pq-input")?.focus(); },
    async "save-pass"() {
      const v = $("#" + d.src).value.trim(); setPass(v);
      if (!v) { toast("Passcode removed"); render(); return; }
      const r = await pingServer(); toast(r === "ok" ? "Connected. Your partner is ready." : errCopy({ code: r }));
      if (tab === "conversa" && r === "ok") render();
    },
    async backup() {
      const t = JSON.stringify(S), box = $("#backup-text"); box.value = t; box.select();
      try { await navigator.clipboard.writeText(t); toast("Backup copied. Save it in Notes."); } catch (e) { toast("Select the text and copy it."); }
    },
    restore() {
      const box = $("#backup-text"); let o = null;
      try { o = JSON.parse(box.value); } catch (e) {}
      if (!o || (typeof o.profiles !== "object" && typeof o.cards !== "object")) { restoreArmed = false; toast("Paste a backup into the box first."); return; }
      if (!restoreArmed) { restoreArmed = true; const v = box.value; render(); $("#backup-text").value = v; return; }
      if (o.profiles) S = { ...blank(), ...o, profiles: { ...blank().profiles, ...o.profiles } };
      else S.profiles.pt = { ...blankProfile(), ...o };
      S.onboarded = true; restoreArmed = false; S.lang = S.lang || "pt"; P().updated = Date.now(); save(); render(); toast("Progress restored");
    },
  }[a];
  if (fn) fn();
});
function pqCheck() {
  const v = $("#pq-input").value; PQ.val = v;
  PQ.res = PQ.art ? (clean(v) === clean(PQ.tr) ? "good" : strip(clean(v)) === strip(clean(PQ.tr)) ? "accent" : "bad") : grade(v, [PQ.tr]);
  render();
}
document.addEventListener("keydown", (e) => {
  const id = e.target.id;
  if (e.key !== "Enter") return;
  if (id === "chat-input" && !e.shiftKey) { e.preventDefault(); sendChat(); }
  else if (id === "card-input" && !R.rev) { e.preventDefault(); checkCard(); }
  else if (id === "next-card") { e.preventDefault(); nextCard(); }
  else if (id === "pq-input") { e.preventDefault(); if (!PQ.res) pqCheck(); }
});
document.addEventListener("change", (e) => {
  const id = e.target.id;
  if (id === "lisbon-date" && e.target.value) { S.lisbon = e.target.value; save(); render(); }
  if (id === "auto-say") { S.auto = e.target.checked; save(); }
  if (id === "slow") { S.slow = e.target.checked; save(); }
  if (id === "free-topic") C.custom = e.target.value;
});
document.addEventListener("input", (e) => {
  if (e.target.id === "vocab-filter") { vf = e.target.value; $("#vocab-body").innerHTML = vocabRows(); }
  if (e.target.id === "chat-input") C.draft = e.target.value;
});
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") pullNow(); else if (Account.signedIn && syncTimer) pushNow(); });
window.addEventListener("online", () => pushNow());

/* ---------- start ---------- */
render();
loadAccountConfig().then((on) => { if (on) { if (!S.onboarded) render(); pullNow(); } });
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
