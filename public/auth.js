/* Accounts and cloud progress, using Supabase's web API directly. */
const SESSION_KEY = "voca-session";
const Account = {
  url: "", key: "", session: null,
  get enabled() { return !!(this.url && this.key); },
  get signedIn() { return !!(this.session && this.session.access_token); },
  get email() { return (this.session && this.session.user && this.session.user.email) || ""; },
};
try { Account.session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch (e) {}

function keepSession(data) {
  Account.session = data ? { ...data, expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600) } : null;
  try { data ? localStorage.setItem(SESSION_KEY, JSON.stringify(Account.session)) : localStorage.removeItem(SESSION_KEY); } catch (e) {}
}
async function loadAccountConfig() {
  try {
    const r = await fetch("/api/config", { cache: "no-store" });
    const c = await r.json();
    Account.url = c.supabaseUrl || "";
    Account.key = c.supabaseKey || "";
  } catch (e) {}
  return Account.enabled;
}
async function authPost(path, body) {
  let r;
  try {
    r = await fetch(Account.url + "/auth/v1/" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: Account.key },
      body: JSON.stringify(body),
    });
  } catch (e) { throw { message: "You're offline. Connect and try again." }; }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw { status: r.status, message: authMessage(r.status, d) };
  return d;
}
function authMessage(status, d) {
  const code = d.error_code || d.code || "";
  if (code === "invalid_credentials") return "That email or password is wrong.";
  if (code === "email_not_confirmed") return "Confirm your email first, using the link we sent you.";
  if (code === "user_already_exists") return "That email already has an account. Sign in instead.";
  if (code === "weak_password") return "Use a longer password, at least 8 characters.";
  if (status === 429) return "Too many attempts. Wait a few minutes and try again.";
  return d.msg || d.error_description || "Sign-in didn't work. Try again.";
}
async function signIn(email, password) {
  keepSession(await authPost("token?grant_type=password", { email, password }));
}
/* Returns true when the account still needs its email confirmed. */
async function signUp(email, password) {
  const d = await authPost("signup", { email, password });
  if (d.access_token) { keepSession(d); return false; }
  return true;
}
async function accessToken() {
  if (!Account.signedIn) return "";
  if (Account.session.expires_at - 60 > Date.now() / 1000) return Account.session.access_token;
  try {
    keepSession(await authPost("token?grant_type=refresh_token", { refresh_token: Account.session.refresh_token }));
    return Account.session.access_token;
  } catch (e) {
    if (e.status === 400 || e.status === 401) keepSession(null);
    return "";
  }
}
async function signOut() {
  const t = await accessToken();
  if (t) fetch(Account.url + "/auth/v1/logout", { method: "POST", headers: { apikey: Account.key, Authorization: "Bearer " + t } }).catch(() => {});
  keepSession(null);
}
async function rest(path, options = {}) {
  const t = await accessToken();
  if (!t) return null;
  return fetch(Account.url + "/rest/v1/" + path, {
    ...options,
    headers: { "Content-Type": "application/json", apikey: Account.key, Authorization: "Bearer " + t, ...(options.headers || {}) },
  });
}
async function pullProgress() {
  const r = await rest("progress?select=data&limit=1");
  if (!r || !r.ok) return undefined;
  const rows = await r.json();
  return rows[0] ? rows[0].data : null;
}
async function pushProgress(data) {
  const r = await rest("progress?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ user_id: Account.session.user.id, data, updated_at: new Date().toISOString() }),
  });
  return !!(r && r.ok);
}
