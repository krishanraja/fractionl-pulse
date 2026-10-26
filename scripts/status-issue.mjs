// Body of the pinned "Pulse status" issue, rewritten every day by
// .github/workflows/publication-check.yml (Krish, 2026-10-26: one visible place
// to see where things stand, no hidden schedules to investigate).
//
//   node scripts/status-issue.mjs <citability.json> <publication-check.txt> [open-issues.json]
//
// Reads the day's citability JSON (scripts/citability.mjs --json) and the
// publication check's output; prints Markdown. Read-only.
import { readFileSync } from 'node:fs';

const [citeFile, checkFile, openFile] = process.argv.slice(2);
const c = JSON.parse(readFileSync(citeFile, 'utf8'));
const check = readFileSync(checkFile, 'utf8');
const open = openFile ? JSON.parse(readFileSync(openFile, 'utf8')) : [];
const passed = check.match(/(\d+)\/(\d+) publication checks passed/);
const failing = check.split('\n').filter((l) => l.startsWith('FAIL'));
const run = process.env.RUN_URL || '';

const streak = `${c.streak_days_at_10}${c.streak_target_days ? ` of ${c.streak_target_days}` : ''}`;
const startOn = Object.values(c.inputs).map((i) => i.clear_on).filter(Boolean).sort().at(-1);
const lines = [
  `## ${c.score} / 10 on ${c.date} · streak at 10/10: ${streak} days`,
  '',
  `**Reading:** ${c.reading ?? 'none'} (as of ${c.as_of}). **Publication check:** ${passed ? `${passed[1]}/${passed[2]} passed` : 'did not run'}.`,
  c.streak_days_at_10 > 0
    ? `**The streak is running.** Any day below 10 resets it.`
    : startOn
      ? `**The streak can start on ${startOn} at the earliest**, when the last input clears the delivery bar, if no input misses another day.`
      : `**The streak starts the first day every point scores 1.**`,
  '',
  '### What is short of 10',
  c.gaps.length ? c.gaps.map((g) => `- Point ${g}`).join('\n') : '- Nothing. Every point scores 1.',
  ...(failing.length ? ['', '### Publication check failures', failing.map((f) => `- ${f.replace(/^FAIL\s+/, '')}`).join('\n')] : []),
  '',
  '### Inputs (point 2)',
  '| Input | Delivered (30 days) | Misses left | Moved | Clears on |',
  '|---|---|---|---|---|',
  ...Object.entries(c.inputs).map(([s, i]) => `| \`${s}\` | ${i.delivered ?? '?'} | ${i.misses_left ?? '?'} | ${i.moved ? 'yes' : i.judgeable ? '**no**' : 'pending'} | ${i.clear_on ?? '–'} |`),
  '',
  '### Open issues needing attention',
  open.length ? open.map((i) => `- #${i.number} ${i.title}`).join('\n') : '- None.',
  '',
  '---',
  `Rewritten every day by the [daily publication check](../actions/workflows/publication-check.yml)${run ? ` ([today's run](${run}))` : ''}. Rules: \`docs/CITABILITY.md\`. Daily record: \`docs/citability-log.jsonl\`. A new failure opens its own issue assigned to Krish, and an investigation by Claude that reports back on that issue. This issue only comments, and so notifies, when the streak starts, reaches its target, or resets.`,
];
console.log(lines.join('\n'));
