# Firecrawl and Parallel keys: where they may help fractionl-pulse

Status: A page-reading key (Firecrawl) and a web-search key (Parallel) were added on 2026-11-20 to the edge function secrets of the Supabase project this repository runs on. Checked by name only; no value was read. Nothing uses them yet and no spend has happened.

Where they are readable: from that project's edge functions. They are NOT readable from GitHub Actions, a Vercel function or Python code unless mirrored there, which is a secret write and needs Krish's approval first. Control Center's API gateway has no adapter for either yet.

Rules that still apply: measure before adopting, record the cost of every call, never block on no evidence, and a site that refuses an automated reader is an answer, not an obstacle to route around.

## Map for Pulse (inbound data is its weak point)

Do not name providers or secrets in any public file. In this note the keys are "the page-reading API" and "the web-search API". Edge functions can use both directly, so the existing collectors need no new route.

1. **Trial lane first.** Any new input starts in `collect-trials` and must pass the entry gate in `docs/CITABILITY.md`: it has to measure the thing, move, and clear the delivery bar. A page reader that returns text is not an input until that is shown.
2. **Repairs before retirement.** The nine retired inputs were tested with `collect-trials ?diagnose=repairs`. For any whose collector failed on script-rendered or blocked pages, a page-reading retry is a cheap further repair to test, per Krish's 2026-10-23 ruling.
3. **Fractional demand and supply from firm and job pages.** The web-search API can find the public listing and firm pages that official series miss; the page-reading API turns them into structured rows with the source URL kept. This is where the 10/10 citability streak is most starved.
4. **Verified engagement records (the moat in `docs/NORTH_STAR.md`).** Use only to find and read a partner's own public dated records, never to guess private ones.
5. **Relevance check.** The relevance lesson holds: 7 of 7 matches in one news source were cricket and jets. Every new source gets the relevance sample before it joins.

Next: pick one failing or retired input and run a trial through `collect-trials`, recording cost per reading.
North Star check (2026-11-20): holds. Moves the citability streak only if a trial input clears the delivery bar. Separately, the 2026-11-18 recalibration proposal on the deadline stands for Krish.
