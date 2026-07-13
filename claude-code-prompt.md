# Build prompt — paste this whole thing into Claude Code

I want you to build a personal, single-user PWA (Progressive Web App). No business model, no auth, no backend server, no multi-user support — this is for me only, running on my phone. Optimize for lean and working, not scalable or fancy.

## Purpose

Two problems to solve:
1. **Noise** — too much AI/tech content to keep up with. I want one small daily digest (max 5 items), not a feed.
2. **Decision fatigue** — I want a max-5-item task list each morning, auto-carried from yesterday, not a giant backlog.

The tone throughout the app is "assistant + mentor" — direct, references yesterday's actual follow-through, never generic ("Good morning!"), never guilt-trippy. State facts plainly.

## Tech constraints

- Plain HTML, CSS, JS. No React/Vue/build step — keep it a static site that works by opening `index.html`, so it deploys cleanly to GitHub Pages.
- Must be installable as a PWA: `manifest.json` + a minimal service worker so it opens full-screen from the home screen and caches itself for offline use.
- Data persistence: `localStorage` only. No backend, no database.
- Mobile-first layout, single column, must look correct on a phone screen (~390px wide). Support dark mode via `prefers-color-scheme`.
- One single page (`index.html`). No routing, no multiple screens — everything lives on one scrollable page.

## File structure to create

```
/
  index.html          -- the single page (morning view + evening check-in section)
  manifest.json        -- PWA manifest
  sw.js                -- minimal service worker (cache-first for offline)
  icons/                -- placeholder icon(s), 192x192 and 512x512, simple flat design
  data/digest.json      -- placeholder static file (schema below), will later be overwritten by an automated script
  scripts/fetch_digest.py -- Python script (Phase 2, described below) that generates data/digest.json
  .github/workflows/digest.yml -- GitHub Actions workflow to run the script daily and commit the result
  README.md             -- short setup + deploy instructions (GitHub Pages)
```

## Data model (localStorage)

Store everything under a single key `focusAppState` as one JSON object, to minimize storage calls:

```json
{
  "tasks": [
    { "id": "uuid", "text": "string", "done": false, "carriedOverCount": 0, "createdDate": "YYYY-MM-DD" }
  ],
  "history": [
    { "date": "YYYY-MM-DD", "tasksCompleted": 2, "tasksTotal": 3, "feedbackNote": "string or empty" }
  ],
  "lastCheckInDate": "YYYY-MM-DD or null"
}
```

## Page sections (in this order, one scroll)

### 1. Greeting header
Dynamic text generated from `history` (most recent entry):
- If yesterday had incomplete tasks: mention the count plainly. E.g. "You closed 2 of 3 yesterday — let's fix that today."
- If no check-in happened yesterday (`lastCheckInDate` isn't yesterday): call it out. E.g. "No check-in yesterday — today's list is a guess, not a plan."
- If yesterday was fully completed: acknowledge briefly, no over-praise. E.g. "Clean sweep yesterday. Let's keep it that way."
- Keep it to one sentence. Date shown below it in small muted text.

### 2. Today's focus (tasks)
- Show max 5 tasks: unfinished tasks carried over from yesterday first (visually distinct — muted/secondary style), then today's new tasks.
- Each task is a checkbox row. Tapping toggles `done` in localStorage immediately.
- A simple text input + "add" button below the list to add a new task (still capped at 5 visible — if adding a 6th, prompt to either finish/drop one first, don't silently allow unlimited tasks).
- If a task's `carriedOverCount` reaches 3, show a small inline prompt: "Carried over 3 days — still relevant?" with two quick buttons: Keep / Drop.

### 3. Signal digest
- Read from `data/digest.json` (fetched via fetch() on load — same-origin, static file).
- Show max 5 items, each with: title (bold, one line) + one-sentence "why it matters" (muted, one line). No links required in the UI itself but okay to add if present in the JSON.
- If the fetch fails (e.g. offline), show a quiet fallback message, don't break the page.

`data/digest.json` schema (this is what the Phase 2 script will produce — create a placeholder with 2-3 example items for now):
```json
{
  "generatedAt": "2026-07-13T06:00:00Z",
  "items": [
    { "title": "string", "why": "string" }
  ]
}
```

### 4. Evening check-in (same page, lower section — reachable by scrolling, or via a "#checkin" anchor so a phone shortcut/alarm can deep-link straight to it)
- A short form: shows today's tasks with checkboxes (same state as above, so ticking here or above both update the same data).
- One free-text box: "How did today actually go?" — saved as `feedbackNote` in that day's `history` entry.
- One button: "Close out today" — on click: writes today's `history` entry (tasksCompleted/tasksTotal/feedbackNote), sets `lastCheckInDate` to today, and rolls unfinished tasks into tomorrow (increments `carriedOverCount`, keeps `done: false`). Show a brief confirmation state on the button after saving.
- Below the form, a static (non-functional, informational only) line: "Set a phone alarm at a fixed time linking to this page + `#checkin` — an alarm can't be swiped away like a notification." This is guidance text for me, not something the app can do itself since a webpage can't set OS-level alarms.

## Visual style
- Flat, minimal, generous whitespace, no gradients/shadows.
- Two font weights only (regular + medium/semibold).
- Muted secondary text color for anything non-primary (carried-over tasks, digest "why" lines, dates).
- No more than one accent color used sparingly (e.g. for the "add task" button and checkboxes).
- Must render correctly in both light and dark mode using `prefers-color-scheme`.

## manifest.json requirements
- `name` and `short_name`: "Daily Focus"
- `display`: "standalone"
- `start_url`: "/index.html#morning" (or just "/")
- `theme_color` and `background_color`: match the app's neutral background
- icons array pointing to the 192x192 and 512x512 placeholder icons

## Service worker requirements
- Minimal cache-first strategy: cache `index.html`, `manifest.json`, and the digest.json on install/fetch, so the page opens even with no signal (digest will just show the last cached data).
- No push notifications, no background sync — out of scope for v1.

## Phase 2 (build this too, but keep it separate from the page): scripts/fetch_digest.py
- A Python script using `feedparser` to pull from a hardcoded list of 8-12 RSS feed URLs (leave the list as a clearly marked placeholder array at the top of the file for me to fill in with my actual sources).
- Dedupes similar stories, then calls the **Google Gemini API** (model: `gemini-2.5-flash`, free tier) using the official `google-genai` Python SDK, with an API key read from env var `GEMINI_API_KEY`. Use a prompt that ranks and summarizes down to the top 5 items relevant to "AI/software engineering," each reduced to a title + one-sentence "why it matters." Ask the model to return strict JSON matching the `data/digest.json` schema so the script can parse it directly without extra cleanup.
- Writes the result to `data/digest.json` in the schema above.
- Keep the prompt used inside the script in a clearly separated string constant near the top of the file, so I can tune it later.
- Wrap the Gemini call in basic error handling for HTTP 429 (rate limit) — on failure, leave the existing `data/digest.json` untouched rather than overwriting it with an error, so the app always has something to show.
- Add `google-genai` to a `requirements.txt` alongside `feedparser`.

## .github/workflows/digest.yml
- A GitHub Actions workflow that runs `scripts/fetch_digest.py` once daily on a schedule (early morning, pick a reasonable UTC cron time and note in a comment that I should adjust it to my timezone), installs dependencies from `requirements.txt`, runs the script with `GEMINI_API_KEY` from repo secrets, and commits/pushes the updated `data/digest.json` back to the repo if it changed.

## README.md
Short, plain instructions covering:
1. How to push this repo to GitHub and enable GitHub Pages (which branch/folder to serve).
2. How to get a free Gemini API key from Google AI Studio (aistudio.google.com) — no credit card required — and add it as `GEMINI_API_KEY` in the repo's GitHub Actions secrets.
3. How to open the deployed URL on my phone and "Add to Home Screen."
4. A reminder to fill in my actual RSS feed list in `scripts/fetch_digest.py` before the digest becomes useful.
5. A one-line note that the Gemini free tier has a generous daily quota (1,500 requests/day) more than enough for one run a day, but that Google may use free-tier prompts for training — fine for public RSS content, worth knowing.

## Build order
1. `index.html` + inline/linked CSS + JS, fully working against `localStorage` and the placeholder `digest.json`, testable locally by just opening the file.
2. `manifest.json`, `sw.js`, placeholder icons — confirm it installs as a PWA.
3. `scripts/fetch_digest.py` + workflow file — these can be stubbed/tested separately, don't need to block step 1-2.
4. `README.md` last, once the actual file structure is final.

Ask me before choosing a specific icon design — a simple flat placeholder is fine, I'll replace it later. Everything else, use your best judgment and keep it as simple as possible; I'd rather have a working lean version today than a more complete one later.
