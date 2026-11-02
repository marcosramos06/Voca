// GET /api/config: the public sign-in settings for the app. These values are safe to share.

// Accepts a pasted address with extra path, such as https://x.supabase.co/rest/v1/
export function supabaseOrigin(value = process.env.SUPABASE_URL) {
  try {
    return new URL(String(value || "").trim()).origin;
  } catch {
    return "";
  }
}

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    supabaseUrl: supabaseOrigin(),
    supabaseKey: (process.env.SUPABASE_ANON_KEY || "").trim(),
    vapidKey: (process.env.VAPID_PUBLIC_KEY || "").trim(),
  });
}
