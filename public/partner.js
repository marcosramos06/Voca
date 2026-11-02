/* Talks to /api/chat. The API key stays on the server. */
const PASS_KEY = "voca-pass";
function getPass() { try { return localStorage.getItem(PASS_KEY) || ""; } catch (e) { return ""; } }
function setPass(v) { try { v ? localStorage.setItem(PASS_KEY, v) : localStorage.removeItem(PASS_KEY); } catch (e) {} }

/* Accepts bare JSON, a fenced block, or JSON with a sentence around it. */
function parseReply(text) {
  const t = String(text || "").trim();
  const attempts = [t];
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) attempts.push(fence[1]);
  const i = t.search(/[{[]/), j = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
  if (i >= 0 && j > i) attempts.push(t.slice(i, j + 1));
  for (const a of attempts) { try { return JSON.parse(a); } catch (e) {} }
  throw { code: "invalid_json" };
}
async function postChat(body, signal) {
  if (navigator.onLine === false) throw { code: "offline" };
  const token = await accessToken();
  if (!token && !getPass()) throw { code: "needs_sign_in" };
  let res;
  try {
    res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, accessToken: token || undefined, passcode: token ? undefined : getPass() }), signal });
  } catch (e) { throw { code: e && e.name === "AbortError" ? "cancelled" : "upstream_error" }; }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { code: data.code || "upstream_error" };
  return data;
}
async function ask(input, opts = {}) {
  const messages = typeof input === "string" ? [{ role: "user", content: input }] : input;
  const d = await postChat({ messages, tier: opts.modelTier === "quick" ? "quick" : "default" }, opts.signal);
  return d.text;
}
async function sample(input, opts = {}) {
  const text = await ask(input, opts);
  if (opts.onText) opts.onText({ text, delta: text });
  return { text };
}
sample.json = async (input, opts = {}) => parseReply(await ask(input, opts));
async function pingServer() { try { await postChat({ ping: true }); return "ok"; } catch (e) { return e.code || "upstream_error"; } }
