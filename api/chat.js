// POST /api/chat: forwards a practice conversation to the Claude API.
// The API key never reaches the phone. Every request must come from an allowed
// signed-in account, or carry the app passcode.
import { createHash, timingSafeEqual } from "node:crypto";
import { supabaseOrigin } from "./config.js";

const API_URL = process.env.ANTHROPIC_API_URL || "https://api.anthropic.com/v1/messages";
const MAX_MESSAGES = 24;
const MAX_CHARS = 24000;
const TIERS = {
  quick: { model: process.env.MODEL_QUICK || "claude-haiku-5-5", maxTokens: 900 },
  default: { model: process.env.MODEL_DEFAULT || "claude-sonnet-5-5", maxTokens: 3000 },
};

const digest = (value) => createHash("sha256").update(String(value)).digest();
const passcodeMatches = (given, expected) =>
  typeof given === "string" && given.length > 0 && timingSafeEqual(digest(given), digest(expected));

// Confirms the sign-in token with Supabase, then checks the email against ALLOWED_EMAILS.
async function accountAccess(token) {
  const { SUPABASE_ANON_KEY: rawKey = "", ALLOWED_EMAILS: allowed = "" } = process.env;
  const url = supabaseOrigin(), key = rawKey.trim();
  if (!url || !key || typeof token !== "string" || !token) return "bad_session";
  let reply;
  try {
    reply = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, authorization: `Bearer ${token}` } });
  } catch {
    return "upstream_error";
  }
  if (!reply.ok) return "bad_session";
  const user = await reply.json();
  const list = allowed.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!user.email_confirmed_at || !list.includes(String(user.email).toLowerCase())) return "not_allowed";
  return "ok";
}

function validMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return false;
  if (messages[0].role !== "user" || messages[messages.length - 1].role !== "user") return false;
  let total = 0;
  for (const m of messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) return false;
    if (typeof m.content !== "string" || !m.content.trim()) return false;
    total += m.content.length;
  }
  return total <= MAX_CHARS;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ code: "method_not_allowed" });

  const { ANTHROPIC_API_KEY: apiKey, APP_PASSCODE: passcode, SUPABASE_URL: supabase } = process.env;
  if (!apiKey || (!passcode && !supabase)) return res.status(500).json({ code: "not_configured" });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  if (body.accessToken) {
    const access = await accountAccess(body.accessToken);
    if (access === "not_allowed") return res.status(403).json({ code: access });
    if (access === "upstream_error") return res.status(502).json({ code: access });
    if (access !== "ok") return res.status(401).json({ code: access });
  } else if (!passcode || !passcodeMatches(body.passcode, passcode)) {
    return res.status(401).json({ code: "bad_passcode" });
  }
  if (body.ping === true) return res.status(200).json({ ok: true });
  if (!validMessages(body.messages)) return res.status(413).json({ code: "too_large" });

  // Only the server decides the model and the token limit.
  const tier = TIERS[body.tier === "quick" ? "quick" : "default"];
  const messages = body.messages.map(({ role, content }) => ({ role, content }));

  let upstream;
  try {
    upstream = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: tier.model, max_tokens: tier.maxTokens, messages }),
    });
  } catch {
    return res.status(502).json({ code: "upstream_error" });
  }

  if (upstream.status === 429) return res.status(429).json({ code: "rate_limited" });
  if (!upstream.ok) {
    console.error("Claude API error", upstream.status);
    return res.status(502).json({ code: "upstream_error" });
  }

  const data = await upstream.json();
  if (data.stop_reason === "refusal") return res.status(422).json({ code: "refused" });
  const text = (data.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
  if (!text.trim()) return res.status(502).json({ code: "upstream_error" });
  return res.status(200).json({ text });
}
