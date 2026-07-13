#!/usr/bin/env python3
"""
Generates data/digest.json: pulls RSS feeds, dedupes, asks Gemini to rank/summarize
down to the top 5 items relevant to AI/software engineering.

Requires: feedparser, google-genai (pip install -r requirements.txt)
Requires env var: GEMINI_API_KEY
"""

import json
import os
import sys
from datetime import datetime, timezone

import feedparser

# ---------------------------------------------------------------------------
# RSS feed sources.
# ---------------------------------------------------------------------------
FEED_URLS = [
    "https://simonwillison.net/atom/everything/",
    "https://techcrunch.com/feed/",
    "https://jamesclear.com/feed",
    "https://highscalability.com/rss/",
    "https://netflixtechblog.com/feed",
]

MODEL = "gemini-2.5-flash"

# ---------------------------------------------------------------------------
# The prompt sent to Gemini. Tune this to change what gets surfaced.
# ---------------------------------------------------------------------------
RANKING_PROMPT = """You are curating a small daily digest for a software engineer who wants \
to keep up with AI and software engineering news without wading through noise.

Below is a list of recent article titles and summaries (deduped). Pick the top 5 that are most \
relevant and useful for someone working in AI/software engineering. Skip anything that is pure \
marketing, low-signal, or a duplicate story already covered by a better source.

For each of the 5 picks, write:
- "title": a short, clear title (rewrite for clarity if needed, keep it under ~90 characters)
- "why": one sentence on why it matters to this reader

Respond with ONLY valid JSON matching this exact shape, no other text:
{{
  "items": [
    {{"title": "...", "why": "..."}}
  ]
}}

Here are the candidate articles:

{articles}
"""

DIGEST_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "digest.json")

DIGEST_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "why": {"type": "string"},
                },
                "required": ["title", "why"],
            },
        },
    },
    "required": ["items"],
}


def fetch_entries():
    entries = []
    for url in FEED_URLS:
        parsed = feedparser.parse(url)
        for entry in parsed.entries:
            entries.append({
                "title": entry.get("title", "").strip(),
                "summary": entry.get("summary", "").strip(),
                "link": entry.get("link", ""),
            })
    return entries


def dedupe(entries):
    seen_titles = set()
    deduped = []
    for entry in entries:
        key = entry["title"].strip().lower()
        if not key or key in seen_titles:
            continue
        seen_titles.add(key)
        deduped.append(entry)
    return deduped


def rank_with_gemini(entries):
    """Returns a list of items, or None if ranking failed (caller should leave
    the existing digest.json untouched in that case)."""
    if not entries:
        print("No entries to rank (FEED_URLS empty or feeds returned nothing).", file=sys.stderr)
        return None

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY not set — leaving digest.json untouched.", file=sys.stderr)
        return None

    from google import genai
    from google.genai import types
    from google.genai import errors

    client = genai.Client(api_key=api_key)

    articles_text = "\n".join(
        "- {title}: {summary}".format(title=e["title"], summary=e["summary"][:300])
        for e in entries
    )

    try:
        response = client.models.generate_content(
            model=MODEL,
            contents=RANKING_PROMPT.format(articles=articles_text),
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=DIGEST_RESPONSE_SCHEMA,
            ),
        )
    except errors.ClientError as e:
        if getattr(e, "code", None) == 429:
            print("Gemini rate limit (429) hit — leaving digest.json untouched.", file=sys.stderr)
        else:
            print("Gemini API error: {e} — leaving digest.json untouched.".format(e=e), file=sys.stderr)
        return None
    except Exception as e:
        print("Unexpected error calling Gemini: {e} — leaving digest.json untouched.".format(e=e), file=sys.stderr)
        return None

    try:
        parsed = json.loads(response.text)
        return parsed.get("items", [])[:5]
    except (json.JSONDecodeError, AttributeError):
        print("Could not parse Gemini response as JSON:\n" + str(response.text), file=sys.stderr)
        return None


def write_digest(items):
    digest = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "items": items,
    }
    os.makedirs(os.path.dirname(DIGEST_PATH), exist_ok=True)
    with open(DIGEST_PATH, "w", encoding="utf-8") as f:
        json.dump(digest, f, indent=2)
    print("Wrote {n} items to {path}".format(n=len(items), path=DIGEST_PATH))


def main():
    entries = dedupe(fetch_entries())
    items = rank_with_gemini(entries)
    if items is None:
        print("Digest not updated this run.", file=sys.stderr)
        return
    write_digest(items)


if __name__ == "__main__":
    main()
