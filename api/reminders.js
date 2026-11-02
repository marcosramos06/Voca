// Scheduled by Vercel twice a day. Sends a reminder to people who haven't practiced today,
// at the run that lands in their early evening.
import webpush from "web-push";
import { supabaseOrigin } from "./config.js";

const dayKey = (date, offsetMinutes) => new Date(date.getTime() + offsetMinutes * 60000).toISOString().slice(0, 10);
const practiced = (state, key) => Object.values(state?.profiles || {}).some((p) => p?.log?.[key] && (p.log[key].c || p.log[key].t));

export function streakOf(state, now, offsetMinutes) {
  let n = 0, cursor = new Date(now.getTime() - 86400000);
  while (practiced(state, dayKey(cursor, offsetMinutes))) { n++; cursor = new Date(cursor.getTime() - 86400000); }
  return n;
}
function dueCount(state, now, offsetMinutes) {
  const day = Math.floor(Date.parse(dayKey(now, offsetMinutes)) / 86400000);
  return Object.values(state?.profiles?.[state?.lang || "pt"]?.cards || {}).filter((c) => c.b > 0 && c.d <= day).length;
}
export function reminderFor(state, now, offsetMinutes) {
  const hour = new Date(now.getTime() + offsetMinutes * 60000).getUTCHours();
  if (hour < 17 || hour > 21) return null;
  if (practiced(state, dayKey(now, offsetMinutes))) return null;
  const streak = streakOf(state, now, offsetMinutes), due = dueCount(state, now, offsetMinutes);
  const words = due ? `${due} ${due === 1 ? "word is" : "words are"} ready to review.` : "Your daily mission is waiting.";
  return { title: "Voca", body: streak >= 2 ? `Keep your ${streak}-day streak going. ${words}` : words, url: "/#hoje" };
}
async function send(subscription, payload) {
  return webpush.sendNotification(subscription, JSON.stringify(payload));
}

export default async function handler(req, res, deliver = send) {
  res.setHeader("Cache-Control", "no-store");
  const { CRON_SECRET: secret, SUPABASE_SERVICE_KEY: key, VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, VAPID_CONTACT: contact } = process.env;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ code: "unauthorized" });
  const base = supabaseOrigin();
  if (!base || !key || !pub || !priv) return res.status(500).json({ code: "not_configured" });
  if (deliver === send) webpush.setVapidDetails(contact || "mailto:noreply@example.com", pub, priv);

  const headers = { apikey: key, authorization: `Bearer ${key}` };
  const load = async (path) => {
    const r = await fetch(`${base}/rest/v1/${path}`, { headers });
    if (!r.ok) throw new Error(`Supabase ${r.status}`);
    return r.json();
  };
  let subs, rows;
  try {
    [subs, rows] = await Promise.all([load("push_subscriptions?select=endpoint,user_id,subscription,tz_offset"), load("progress?select=user_id,data")]);
  } catch {
    return res.status(502).json({ code: "upstream_error" });
  }
  const states = new Map(rows.map((r) => [r.user_id, r.data]));
  const now = new Date();
  let sent = 0, removed = 0;
  for (const sub of subs) {
    const payload = reminderFor(states.get(sub.user_id), now, sub.tz_offset || 0);
    if (!payload) continue;
    try {
      await deliver(sub.subscription, payload);
      sent++;
    } catch (e) {
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await fetch(`${base}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, { method: "DELETE", headers });
        removed++;
      }
    }
  }
  return res.status(200).json({ sent, removed });
}
