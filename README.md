# Voca

Portuguese and French speaking and recall practice for Spanish speakers. It has live conversation with corrections, spaced recall, Spanish bridges, pronunciation drills, and a level test for each language.

Portuguese shows Brazilian and Portugal forms. Brazilian forms come first for PORTUGUE 102, and Portugal forms take over on May 1, 2027. French uses standard France French.

Live app: https://voca-nine-taupe.vercel.app

## Install it on an iPhone

1. Open the live address in **Safari**.
2. Tap Share, then **Add to Home Screen**, then Add.

On a Mac, open the same address in Safari and choose **File > Add to Dock** to use it as an app.

Cards, bridges and sounds work offline. Conversation, feedback and class imports need a connection.

## Turn on accounts

Accounts save progress for each language and carry it across devices. The app keeps working without them.

### 1. Create the database
1. Create a free project at https://supabase.com.
2. Open **SQL Editor**, paste in everything from `supabase/schema.sql`, and click **Run**.
3. Under **Authentication > URL Configuration**, set **Site URL** to the live address.
4. Under **Project Settings**, copy the **Project URL** and the **publishable** or **anon** key.

### 2. Connect it in Vercel
Add these under **Settings > Environment Variables**, then redeploy:

| Name | Value |
|---|---|
| `SUPABASE_URL` | Your Project URL |
| `SUPABASE_ANON_KEY` | Your publishable or anon key |
| `ALLOWED_EMAILS` | The email you'll sign in with. Separate several with commas. |

Only emails on this list can use Claude, so strangers can't spend your API credit.

### 3. Create your account
Use the same email as your Supabase account, because Supabase's built-in email sender only reaches project team members and is capped at a few messages an hour. Tap the confirmation link, then sign in.

Free Supabase projects can pause after about a week of low activity. Your data is kept, and you can restore the project from its dashboard.

## Turn on daily reminders

1. Run everything in `supabase/schema.sql` again in the Supabase SQL Editor. It's safe to repeat.
2. Open `/setup-keys.html` on your Voca address and tap **Make keys**.
3. Add these in Vercel, then redeploy:

| Name | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | The public key |
| `VAPID_PRIVATE_KEY` | The private key |
| `VAPID_CONTACT` | `mailto:` plus your email |
| `SUPABASE_SERVICE_KEY` | Your Supabase secret key. Keep this private. |
| `CRON_SECRET` | A long random phrase |

4. On an iPhone, open Voca from the Home Screen and turn reminders on in Profile.

Reminders run twice a day and only reach people in their early evening who haven't practiced. Timing can vary by up to an hour on Vercel's free plan.

## Speaking and photos

Talk mode uses the browser's speech recognition, which works in Chrome and Safari on a Mac and usually in Safari tabs on an iPhone. It may not work in an app added to the iPhone Home Screen, so Voca falls back to keyboard dictation there. Pronunciation checks show whether speech recognition understood you. They are a guide, not a score.

Photo lessons shrink the image on the device and send it to Claude through `api/chat.js`. Voca doesn't store the photo.

## Photo credits

Picture Words uses photos from Wikimedia Commons. Each photo shows its author and license, and links to its source page.

## Updating the app

Changes pushed to `main` deploy automatically. The app loads the latest version each time it opens with a connection.

| To change | Edit |
| --- | --- |
| Portuguese content | `public/lang/pt.js` |
| French content | `public/lang/fr.js` |
| Picture words and photo credits | `public/lang/pictures.js` |
| Screens and logic | `public/app.js` |
| Look and feel | `public/styles.css` |
| Accounts and sync | `public/auth.js` |
| Review schedule | `public/memory.js` |
| Speech recognition | `public/voice.js` |
| Partner connection | `public/partner.js` |
| Server, models, limits | `api/chat.js` |
| Offline behavior | `public/sw.js`, and raise `CACHE` when you change `SHELL` |

To add a language, copy the structure of `public/lang/fr.js`, add the file to `public/index.html` and `public/sw.js`, and add its voice in `public/app.js`.

To change models without editing code, set `MODEL_QUICK` or `MODEL_DEFAULT` in Vercel.

## Project layout

```text
api/        Server code that holds the API key and checks access
public/     The app, served to the phone
scripts/    Local preview server and icon generator
supabase/   Database setup
tests/      Server tests and the iPhone-size app test
vercel.json Hosting, security and timeout settings
```

## Run it on a computer

Requires Node 20 or newer. Tests use stand-ins for Claude and Supabase, so they spend nothing.

```bash
npm test                    # server tests
node tests/e2e.cjs /tmp     # full app test at iPhone size, needs Playwright
ANTHROPIC_API_KEY=your-key APP_PASSCODE=test npm run dev   # http://localhost:3000
```
