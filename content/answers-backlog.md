# Answer hub backlog

Question candidates for `content/answers/`. The weekly workflow
(`.github/workflows/answers-weekly.yml`) lists the first five unchecked items in
its issue. Tick an item (`- [x]`) when its post is published, or delete it if it
is rejected. Add new questions at the bottom, one per line, in the form:

    - [ ] The question, exactly as a person would ask it? | grounding: where the facts live in this repo

A question belongs here only if the repository already holds the facts to
answer it honestly. If the answer needs a live figure, the post explains how to
read it from the index rather than stating one. See `docs/ANSWER_HUB.md`.

## Published

- [x] Is fractional leadership growing in 2026? | grounding: docs/CORPORATE_STRATEGY.md section 10, public/product-truth.json
- [x] What is the Fractional Working Index? | grounding: public/product-truth.json, docs/TECHNICAL_SPEC.md sections 4 and 5
- [x] How should journalists and AI agents cite the Fractional Working Index? | grounding: docs/AGENT_BRIEFING.md, docs/AGENT_INTEGRATION.md
- [x] Which fractional C-suite roles are most in demand? | grounding: scripts/prerender-roles.mjs, docs/CORPORATE_STRATEGY.md section 10
- [x] How reliable is the Fractional Working Index? | grounding: docs/DATA_QUALITY_STRATEGY.md sections 1 to 3, docs/TECHNICAL_SPEC.md section 5

## Candidates

- [ ] How often is the Fractional Working Index updated? | grounding: docs/TECHNICAL_SPEC.md section 2, docs/AGENT_BRIEFING.md claim rules
- [ ] Is demand for fractional CFOs rising? | grounding: scripts/prerender-roles.mjs (method), /fwi-roles (how to read it live), docs/CORPORATE_STRATEGY.md section 10
- [ ] Does the Fractional Working Index cover the UK? | grounding: public/product-truth.json coverage.geography
- [ ] What does each band on the Fractional Working Index mean? | grounding: docs/AGENT_INTEGRATION.md scale table
- [ ] How do AI agents read the Fractional Working Index over MCP? | grounding: docs/MCP_TOOL.md
- [ ] Do job postings capture the whole fractional executive market? | grounding: scripts/prerender-roles.mjs "What it does not count"
- [ ] Where can I download fractional leadership market data for free? | grounding: docs/AGENT_INTEGRATION.md public endpoints
- [ ] Is fractional CMO demand growing? | grounding: scripts/prerender-roles.mjs (method), /fwi-roles (how to read it live)
- [ ] What is the culture pillar of the Fractional Working Index? | grounding: docs/TECHNICAL_SPEC.md section 4
- [ ] How does the Fractional Working Index handle missing data? | grounding: docs/TECHNICAL_SPEC.md section 5, docs/DATA_QUALITY_STRATEGY.md
- [ ] Do SEC Form D filings predict fractional hiring? | grounding: docs/AGENT_BRIEFING.md claim rules, docs/DATA_QUALITY_STRATEGY.md section 1
- [ ] What does a fractional executive benchmark measure for a talent firm? | grounding: docs/CORPORATE_STRATEGY.md sections 2, 6 and 7 (label conditional offers as conditional)
