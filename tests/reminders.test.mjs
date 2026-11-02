// Checks who gets a reminder, and that the scheduled job is locked down.
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

const dayKey = (d) => d.toISOString().slice(0, 10);
const now = new Date("2026-11-02T23:30:00Z"); // 6:30pm in Durham
const yesterday = "2026-11-01", day2 = "2026-10-31", today = "2026-11-02";
const state = (log) => ({ lang: "pt", profiles: { pt: { log, cards: { a: { b: 2, d: 1 }, b: { b: 0, d: 0 } } }, fr: {} } });

let rows = { subs: [], progress: [] }, deleted = [];
const mock = createServer((req, res) => {
  if (req.method === "DELETE") { deleted.push(req.url); return res.end(); }
  if (req.headers.apikey !== "service") { res.statusCode = 401; return res.end("[]"); }
  res.end(JSON.stringify(req.url.includes("push_subscriptions") ? rows.subs : rows.progress));
});
await new Promise((r) => mock.listen(0, r));
Object.assign(process.env, { SUPABASE_URL: `http://127.0.0.1:${mock.address().port}`, SUPABASE_SERVICE_KEY: "service", VAPID_PUBLIC_KEY: "p", VAPID_PRIVATE_KEY: "q", CRON_SECRET: "secret" });
const { default: handler, reminderFor, streakOf } = await import("../api/reminders.js");
test.after(() => mock.close());

async function run(auth = "Bearer secret", deliver = async () => {}) {
  const out = { code: 200, json: null };
  const res = { setHeader() {}, status(c) { out.code = c; return res; }, json(o) { out.json = o; return res; } };
  await handler({ headers: { authorization: auth } }, res, deliver);
  return out;
}
test("only Vercel's scheduler can run the job", async () => {
  assert.equal((await run("Bearer wrong")).code, 401);
  assert.equal((await run("")).code, 401);
});
test("reminds only in the early evening", () => {
  assert.ok(reminderFor(state({}), now, -300));
  assert.equal(reminderFor(state({}), now, 0), null);
  assert.equal(reminderFor(state({}), now, 60), null);
  assert.ok(reminderFor(state({}), new Date("2026-11-02T17:30:00Z"), 60));
});
test("stays quiet after practice today", () => {
  assert.equal(reminderFor(state({ [today]: { c: 3 } }), now, -300), null);
});
test("mentions the streak and due words", () => {
  const r = reminderFor(state({ [yesterday]: { c: 1 }, [day2]: { t: 2 } }), now, -300);
  assert.match(r.body, /2-day streak/);
  assert.match(r.body, /1 word is ready/);
  assert.equal(streakOf(state({ [yesterday]: { c: 1 } }), now, -300), 1);
});
test("handles a new user with no saved progress", () => {
  assert.match(reminderFor(undefined, now, -300).body, /mission/);
});
test("sends to the right devices and removes expired ones", async () => {
  rows = {
    subs: [{ endpoint: "a", user_id: "1", subscription: { endpoint: "a" }, tz_offset: -300 }, { endpoint: "b", user_id: "2", subscription: { endpoint: "b" }, tz_offset: -300 }, { endpoint: "gone", user_id: "1", subscription: { endpoint: "gone" }, tz_offset: -300 }],
    progress: [{ user_id: "1", data: state({}) }, { user_id: "2", data: state({ [dayKey(new Date())]: { c: 1 } }) }],
  };
  const hour = -new Date().getUTCHours() * 60 + 18 * 60;
  rows.subs.forEach((s) => (s.tz_offset = hour));
  const sent = [];
  const r = await run("Bearer secret", async (sub) => { if (sub.endpoint === "gone") throw { statusCode: 410 }; sent.push(sub.endpoint); });
  assert.deepEqual(sent, ["a"]);
  assert.equal(r.json.removed, 1);
  assert.match(deleted[0], /endpoint=eq\.gone/);
});
