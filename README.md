# Voca

Portuguese speaking and recall practice for a Spanish speaker. Brazilian forms come first for PORTUGUE 102, and Lisbon forms take over on May 1, 2027.

It installs on an iPhone from Safari. Cards, Ponte and Sons work offline. Conversa and class imports need a connection.

Live app: https://voca-nine-taupe.vercel.app

## Put it on your iPhone

You need a free GitHub account, a free Vercel account, and an Anthropic API account with credit. API usage is billed separately from a Claude subscription.

### 1. Get an API key
1. Sign in to the Claude Console and add a small amount of credit. [Anthropic's guide](https://support.claude.com/en/articles/8114521-how-can-i-access-the-anthropic-api) shows how to get there.
2. Set a low monthly spend limit. This caps your cost even if something goes wrong.
3. Create an API key and copy it somewhere safe for step 3.

### 2. Put the code on GitHub
1. Create a new **private** repository named `voca`.
2. Upload everything in this folder, including `vercel.json`. Do not upload a real `.env` file.

### 3. Deploy on Vercel
1. Sign in at https://vercel.com with GitHub and import the repository. Keep the default settings.
2. Before you deploy, add two environment variables:
   - `ANTHROPIC_API_KEY`: the key from step 1
   - `APP_PASSCODE`: a long passphrase of your own, such as four random words
3. Deploy, and open the address Vercel gives you. If you add the variables after deploying, redeploy once.

### 4. Install it
1. Open your Vercel address in **Safari** on your iPhone.
2. Tap Share, then **Add to Home Screen**, then Add.
3. Open Voca from your Home Screen. In Conversa, enter your passcode.

To speak instead of type, go to Settings > General > Keyboard > Keyboards and add Portuguese. Then tap the microphone on the keyboard in Conversa.

For Portugal and Brazil voices in Sons, add them under Settings > Accessibility > Read & Speak > Voices. Menu names can vary by iOS version.

## Project layout

```text
api/chat.js   Server that holds the API key and talks to Claude
public/       The app itself, served to the phone
scripts/      Local preview server and icon generator
tests/        Server safety tests and the iPhone-size app test
vercel.json   Hosting, security and timeout settings
```

## Your progress

Progress is stored only on the device you use. Use Hoje > Settings > Copy backup now and then, and keep the text in Notes. Paste it into the same box to restore.

## Updating the app

Edit files on GitHub and Vercel redeploys automatically. The phone picks up changes the next time the app opens, and they show on the open after that.

| To change | Edit |
| --- | --- |
| Words, rules, scenes | `public/content.js` |
| Screens and logic | `public/app.js` |
| Look and feel | `public/styles.css` |
| Partner connection on the phone | `public/partner.js` |
| Server, models, limits | `api/chat.js` |
| Offline behavior | `public/sw.js`, and raise `CACHE` when you change `SHELL` |

To change models without editing code, set `MODEL_QUICK` or `MODEL_DEFAULT` in Vercel.

## Run it on a computer

Requires Node 20 or newer. Tests use a stand-in for the Claude API, so they spend nothing.

```bash
npm test                                   # server safety tests
ANTHROPIC_API_KEY=your-key APP_PASSCODE=test npm run dev   # http://localhost:3000
node tests/e2e.cjs /tmp                    # iPhone-size app test, needs Playwright
```

## Ideas for what's next

1. **Sync across devices:** add accounts and a database so progress isn't tied to one phone.
2. **Live speech:** add a transcription service so you can talk hands-free without the keyboard.
3. **App Store version:** wrap this code with Capacitor. This needs a Mac and a paid Apple Developer membership.
