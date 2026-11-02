// Server safety tests. Uses a local stand-in for the Claude API, so no key or credit is needed.
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

let seen = null;
let reply = { status: 200, body: { content: [{ type: "text", text: "Olá!" }], stop_reason: "end_turn" } };
const mock = createServer(async (req, res) => {
  let raw = "";
  for await (const c of req) raw += c;
  seen = { headers: req.headers, body: JSON.parse(raw) };
  res.statusCode = reply.status;
  res.end(JSON.stringify(reply.body));
});
await new Promise((r) => mock.listen(0, r));
process.env.ANTHROPIC_API_URL = `http://127.0.0.1:${mock.address().port}/v1/messages`;
process.env.ANTHROPIC_API_KEY = "test-key";
process.env.APP_PASSCODE = "correct horse";
const { default: handler } = await import("../api/chat.js");
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
test("reports a server that isn't set up", async () => {
  delete process.env.APP_PASSCODE;
  assert.equal((await call(good)).json.code, "not_configured");
  process.env.APP_PASSCODE = "correct horse";
});
