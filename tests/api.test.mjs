// Server safety tests. Uses a local stand-in for the Claude API, so no key or credit is needed.
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

let seen = null;
let reply = { status: 200, body: { content: [{ type: "text", text: "Olá!" }], stop_reason: "end_turn" } };
const mock = createServer(async (req, res) => {
  let raw = "";
  for await (const c of req) raw += c;
  if (req.url.startsWith("/auth/v1/user")) {
    const tokens = {
      "Bearer good": { email: "Marcos@Example.com", email_confirmed_at: "2026-11-01" },
      "Bearer stranger": { email: "other@example.com", email_confirmed_at: "2026-11-01" },
      "Bearer unconfirmed": { email: "marcos@example.com", email_confirmed_at: null },
    };
    const user = tokens[req.headers.authorization];
    res.statusCode = user ? 200 : 401;
    return res.end(JSON.stringify(user || {}));
  }
  seen = { headers: req.headers, body: JSON.parse(raw) };
  res.statusCode = reply.status;
  res.end(JSON.stringify(reply.body));
});
await new Promise((r) => mock.listen(0, r));
process.env.ANTHROPIC_API_URL = `http://127.0.0.1:${mock.address().port}/v1/messages`;
process.env.ANTHROPIC_API_KEY = "test-key";
process.env.APP_PASSCODE = "correct horse";
process.env.SUPABASE_URL = `http://127.0.0.1:${mock.address().port}`;
process.env.SUPABASE_ANON_KEY = "public-key";
process.env.ALLOWED_EMAILS = "someone@example.com, marcos@example.com";
const { default: handler } = await import("../api/chat.js");
const { supabaseOrigin } = await import("../api/config.js");
test.after(() => mock.close());

async function call(body, method = "POST") {
  const out = { code: 200, json: null };
  const res = { setHeader() {}, status(c) { out.code = c; return res; }, json(o) { out.json = o; return res; } };
  await handler({ method, body }, res);
  return out;
}
const good = { passcode: "correct horse", tier: "quick", messages: [{ role: "user", content: "Oi" }] };

test("rejects other methods", async () => assert.equal((await call({}, "GET")).code, 405));
test("rejects a missing or wrong passcode without calling Claude", async () => {
  seen = null;
  assert.equal((await call({ ...good, passcode: "nope" })).code, 401);
  assert.equal((await call({ messages: good.messages })).code, 401);
  assert.equal(seen, null);
});
test("ping checks the passcode without spending anything", async () => {
  seen = null;
  assert.deepEqual((await call({ passcode: "correct horse", ping: true })).json, { ok: true });
  assert.equal(seen, null);
});
test("forwards a valid request and returns text", async () => {
  const r = await call(good);
  assert.equal(r.code, 200);
  assert.equal(r.json.text, "Olá!");
  assert.equal(seen.headers["x-api-key"], "test-key");
  assert.equal(seen.body.model, "claude-haiku-5-5");
  assert.equal(seen.body.max_tokens, 900);
});
test("the phone cannot choose the model or token limit", async () => {
  await call({ ...good, tier: "x", model: "expensive", max_tokens: 99999 });
  assert.equal(seen.body.model, "claude-sonnet-5-5");
  assert.equal(seen.body.max_tokens, 3000);
});
test("strips extra fields from messages", async () => {
  await call({ ...good, messages: [{ role: "user", content: "Oi", system: "x" }] });
  assert.deepEqual(seen.body.messages, [{ role: "user", content: "Oi" }]);
});
test("rejects bad or oversized conversations", async () => {
  const m = (content, role = "user") => ({ role, content });
  for (const messages of [[], "x", [m("a", "assistant")], [m("a"), m("b", "assistant")], [m("a", "system")], [m("")], [m("x".repeat(24001))], Array(25).fill(m("a"))]) {
    assert.equal((await call({ ...good, messages })).code, 413);
  }
});
test("maps Claude API failures without leaking details", async () => {
  reply = { status: 429, body: {} };
  assert.equal((await call(good)).json.code, "rate_limited");
  reply = { status: 401, body: { error: "secret detail" } };
  assert.deepEqual((await call(good)).json, { code: "upstream_error" });
  reply = { status: 200, body: { content: [], stop_reason: "refusal" } };
  assert.equal((await call(good)).json.code, "refused");
  reply = { status: 200, body: { content: [{ type: "text", text: "Olá!" }] } };
});
test("accepts an allowed, confirmed account without the passcode", async () => {
  const r = await call({ accessToken: "good", tier: "quick", messages: good.messages });
  assert.equal(r.code, 200);
});
test("rejects other accounts without calling Claude", async () => {
  seen = null;
  const m = { tier: "quick", messages: good.messages };
  assert.equal((await call({ ...m, accessToken: "stranger" })).json.code, "not_allowed");
  assert.equal((await call({ ...m, accessToken: "unconfirmed" })).json.code, "not_allowed");
  assert.equal((await call({ ...m, accessToken: "expired" })).json.code, "bad_session");
  assert.equal(seen, null);
});
test("accepts a Supabase address pasted with extra path", async () => {
  const original = process.env.SUPABASE_URL;
  process.env.SUPABASE_URL = `${original}/rest/v1/`;
  assert.equal(supabaseOrigin("https://abc.supabase.co/rest/v1/"), "https://abc.supabase.co");
  assert.equal(supabaseOrigin(" https://abc.supabase.co/ "), "https://abc.supabase.co");
  assert.equal(supabaseOrigin("not a url"), "");
  assert.equal((await call({ accessToken: "good", tier: "quick", messages: good.messages })).code, 200);
  process.env.SUPABASE_URL = original;
});
test("sends a valid photo to Claude as an image block before the text", async () => {
  const r = await call({ ...good, tier: "default", image: { mediaType: "image/jpeg", data: "QUJD" } });
  assert.equal(r.code, 200);
  const content = seen.body.messages[0].content;
  assert.equal(content[0].type, "image");
  assert.equal(content[0].source.data, "QUJD");
  assert.deepEqual(content[1], { type: "text", text: "Oi" });
});
test("rejects unsafe or oversized photos without calling Claude", async () => {
  seen = null;
  assert.equal((await call({ ...good, image: { mediaType: "text/html", data: "QUJD" } })).json.code, "bad_image");
  assert.equal((await call({ ...good, image: { mediaType: "image/jpeg", data: "<script>" } })).json.code, "bad_image");
  assert.equal((await call({ ...good, image: "x" })).json.code, "bad_image");
  assert.equal((await call({ ...good, image: { mediaType: "image/jpeg", data: "A".repeat(3000001) } })).json.code, "image_too_large");
  assert.equal(seen, null);
});
test("a bad token cannot fall back to no check", async () => {
  assert.equal((await call({ ...good, passcode: "", accessToken: "expired" })).code, 401);
});
test("reports a server that isn't set up", async () => {
  const { APP_PASSCODE, SUPABASE_URL } = process.env;
  delete process.env.APP_PASSCODE;
  delete process.env.SUPABASE_URL;
  assert.equal((await call(good)).json.code, "not_configured");
  process.env.APP_PASSCODE = APP_PASSCODE;
  process.env.SUPABASE_URL = SUPABASE_URL;
});
