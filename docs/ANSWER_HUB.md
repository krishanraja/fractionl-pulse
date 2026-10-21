# Answer hub

**Status:** Built in code on 21 October 2026. Production was not read back when this was written, so whether `/answers` is live is unverified until a deploy is read back.

The answer hub is a set of question-led pages at `https://pulse.fractionl.ai/answers/<slug>`. Each answers one question people ask about the fractional leadership market, directly, with sources, and shows how to read the live Fractional Working Index instead of freezing a number into the page. It serves the North Star (`docs/NORTH_STAR.md`): Pulse becoming the number journalists, firms and AI agents cite when they ask whether fractional leadership is growing.

## What it is, and what it is not

- **Same page for everyone.** Every answer is static HTML written at build time. Humans, search crawlers and AI agents receive identical bytes. Nothing reads a user agent, nothing is hidden with CSS, and nothing is served only to bots. Any change that breaks this is cloaking and must not ship.
- **Not in the app's navigation.** The hub is not linked from the dashboard header, footer or marketing UI. It is public and discoverable through `sitemap.xml`, `llms.txt`, `llms-full.txt`, `/answers/feed.xml`, the `/answers` index and cross-links between answers.
- **Not a news blog.** An answer is evergreen. It explains what the evidence shows, what it cannot show and how to read the current reading. It never states the current score.

## Where things live

| Thing | Path |
|---|---|
| Posts, one Markdown file each | `content/answers/<slug>.md` |
| Question backlog | `content/answers-backlog.md` |
| Parser, renderer, validator, page and feed builder | `scripts/answers-lib.mjs` |
| Check and sync command | `scripts/answers-check.mjs` |
| Validator tests, with negative controls | `scripts/answers-lib.test.mjs` |
| Build step that writes the pages | `scripts/prerender.mjs` (calls `buildAnswerHub`) |
| Weekly brief | `.github/workflows/answers-weekly.yml` |
| Social card used by the hub | `public/og-image.png`, rendered by `scripts/render-og-card.mjs` |

The build writes `dist/answers/index.html`, `dist/answers/<slug>/index.html`, `dist/answers/feed.xml` (RSS 2.0), `dist/llms-full.txt`, the answers block of `dist/llms.txt` and the answer entries of `dist/sitemap.xml`. A post that fails validation fails the build.

## Cadence

Weekly. Every Monday at 08:23 UTC the workflow opens an issue titled "Answer hub brief: week of <date>" with the publishing checklist and the next five unchecked questions from the backlog. It uses no model and no paid API. One good answer a week is the target; a week with nothing that meets the bar is closed with the reason, so the gap is recorded rather than silent.

## Sourcing rules

1. **Only facts already in this repository or in a linked primary source.** The authority order in `docs/DOCUMENTATION_GOVERNANCE.md` applies: production readback, then runtime code, then `docs/CORPORATE_STRATEGY.md`, then `public/product-truth.json`, then task guides.
2. **Never type a live figure.** The current score, band, completeness or role rank changes after each daily ingest. Explain how to read it (`/fwi-api/current`, `/fwi-roles`) and quote fields, not values. The validator rejects phrases such as "the index reads 52".
3. **Dated measurements carry their date.** A one-off measurement, such as the effective number of independent inputs, is quoted with the date and sample it came from.
4. **Third-party figures carry their limits.** Provider data is labelled as that provider's book, as in the evidence matrix in `docs/CORPORATE_STRATEGY.md` section 10.
5. **Claim rules hold.** Everything in `docs/AGENT_BRIEFING.md` "Rules for claims" and `product-truth.json` `do_not_say` applies: 20 tracked inputs, not independent sources; recalculated after each successful daily ingest; not official, not a forecast; six roles; US-scoped role demand; no rate advice; never "first" or "only".
6. **Commercial offers keep their status label.** A conditional offer is called conditional. Prices are hypotheses (`docs/DOCUMENTATION_GOVERNANCE.md`, status vocabulary).

## Quality bar

The validator enforces the mechanical part. A post passes only if it has:

- a `title` that is the question, ending in "?", unique across the hub
- a `slug` of lowercase words joined by hyphens, equal to the file name, unique
- a `description` of 50 to 160 characters
- an `answer` of 40 to 60 words that answers the question in its first sentence
- real `datePublished` and `dateModified` dates (YYYY-MM-DD, not in the future, modified not before published)
- at least 300 words of body, with no raw HTML and no "# " heading
- `## Sources` with at least two linked sources
- `## Frequently asked questions` with at least two `### ` questions, each answered
- `related` slugs that exist
- British English, no em dashes, and none of the banned claims

The judgement part is the author's: would a journalist quote the first two sentences as they stand, and would an agent that reads only the short answer say something true?

## How to add a post

1. Pick a question from `content/answers-backlog.md`, or add one with its grounding.
2. Copy an existing file in `content/answers/` to `content/answers/<slug>.md` and rewrite it. Front matter is `key: value` lines; `related` and `keywords` are comma-separated lists.
3. Run `npm run answers:sync` to update the answers blocks in `public/llms.txt` and `public/sitemap.xml`.
4. Run `npm run test:answers`, `npm run answers:check`, `npm run lint` and `npm run build`. After the build, `npm run answers:check` also verifies `dist/`.
5. Tick the question in the backlog, commit, and open a pull request.
6. After deploy, read back `/answers/<slug>` and `/answers/feed.xml` in production before calling it live.

To change a post, edit the file and set `dateModified` to the day of a substantive change. Do not bump the date for typo fixes; the date is what the sitemap and feed report.

## Structured data on every answer

`Article` (headline, abstract, dates, author and publisher, citations), `FAQPage` (the title question with the short answer, then the FAQ), and `BreadcrumbList`. Every visible FAQ is in the JSON-LD and nothing is in the JSON-LD that is not visible. The `/answers` index carries `CollectionPage` with an `ItemList`.
