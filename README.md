# Daily Focus

A single-user PWA: a max-5-item morning task list and a max-5-item daily digest. No backend, no auth — everything lives in your browser's `localStorage`.

## 1. Push to GitHub and enable Pages

```
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

Then on GitHub: **Settings → Pages → Build and deployment → Source: "Deploy from a branch"**, branch `main`, folder `/ (root)`. Save. GitHub will give you a URL like `https://<username>.github.io/<repo>/`.

## 2. Add your Gemini API key as a repo secret

The digest workflow (`.github/workflows/digest.yml`) needs an API key to call Gemini.

Get a free key at [aistudio.google.com](https://aistudio.google.com) (Google AI Studio) — no credit card required. Then on GitHub go to **Settings → Secrets and variables → Actions → New repository secret**, name it `GEMINI_API_KEY`, and paste your key.

The Gemini free tier has a generous daily quota (1,500 requests/day) — more than enough for one run a day. Note that Google may use free-tier prompts for training; that's fine for public RSS content, but worth knowing.

## 3. Add to your phone's home screen

Open the deployed URL on your phone in Safari (iOS) or Chrome (Android):

- **iOS**: Share button → "Add to Home Screen"
- **Android**: Menu (⋮) → "Add to Home screen" / "Install app"

It'll open full-screen, like a native app, and keep working offline (cached copy) even with no signal.

## 4. Fill in your RSS feeds

The digest is placeholder data until you do this. Open `scripts/fetch_digest.py` and fill in the `FEED_URLS` list near the top with your actual sources (8-12 feeds is a good range). Until you do, `data/digest.json` stays as-is — the script leaves it untouched whenever there's nothing to rank or the API call fails, rather than overwriting it with an empty digest.

You can test the script locally:

```
pip install -r requirements.txt
export GEMINI_API_KEY=...
python scripts/fetch_digest.py
```

The workflow runs once a day (default: 06:00 UTC — edit the cron line in `.github/workflows/digest.yml` to match your timezone) and commits the updated `data/digest.json` back to the repo automatically.
