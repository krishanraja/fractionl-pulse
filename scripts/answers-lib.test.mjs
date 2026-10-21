// Negative controls for the answer-hub validator: each test breaks one rule
// and asserts the validator names it. Run with `npm run test:answers`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { buildFeed, loadAnswers, parseFaq, parseFrontMatter, parseSources, renderMarkdown, validateAnswers, wordCount } from './answers-lib.mjs';

const TODAY = '2026-10-21';
const words = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
const filler = Array.from({ length: 40 }, () => 'The index reads demand, supply and culture signals for six roles.').join(' ');

function post(overrides = {}, body) {
  const meta = {
    title: 'Is this a test question?',
    slug: 'test-question',
    description: 'A description long enough to pass the fifty character minimum rule.',
    answer: words(50),
    datePublished: '2026-10-01',
    dateModified: '2026-10-02',
    ...overrides,
  };
  const b = body ?? `${filler}\n\n## Sources\n\n- [One](https://example.com/1)\n- [Two](https://example.com/2)\n\n## Frequently asked questions\n\n### First?\n\nYes.\n\n### Second?\n\nNo.\n`;
  return { file: `${meta.slug}.md`, meta, hasFrontMatter: true, body: b, sources: parseSources(b), faq: parseFaq(b) };
}

test('a well-formed post passes', () => {
  assert.deepEqual(validateAnswers([post()], { today: TODAY }), []);
});

test('the committed posts pass', () => {
  const posts = loadAnswers(resolve(import.meta.dirname, '..'));
  assert.ok(posts.length >= 3, 'expected at least three seed posts');
  assert.deepEqual(validateAnswers(posts), []);
});

const cases = [
  ['short answer', post({ answer: words(20) }), /answer is 20 words/],
  ['long answer', post({ answer: words(80) }), /answer is 80 words/],
  ['title not a question', post({ title: 'Not a question' }), /must be the question/],
  ['bad slug', post({ slug: 'Bad_Slug' }), /lowercase words/],
  ['future date', post({ dateModified: '2099-01-01' }), /in the future/],
  ['modified before published', post({ datePublished: '2026-10-05', dateModified: '2026-10-01' }), /earlier than datePublished/],
  ['missing field', post({ description: '' }), /missing required field "description"/],
  ['unknown related', post({ related: ['nope'] }), /related slug "nope"/],
  ['no sources', post({}, `${filler}\n\n## Frequently asked questions\n\n### A?\n\nB.\n\n### C?\n\nD.\n`), /missing "## Sources"/],
  ['no faq', post({}, `${filler}\n\n## Sources\n\n- [One](https://e.com/1)\n- [Two](https://e.com/2)\n`), /missing "## Frequently asked questions"/],
  ['em dash', post({ description: 'An em dash — is not allowed in any user-facing copy here.' }), /em dash/],
  ['hardcoded reading', post({}, `The FWI reads 52.3 this week. ${filler}\n\n## Sources\n\n- [One](https://e.com/1)\n- [Two](https://e.com/2)\n\n## Frequently asked questions\n\n### A?\n\nB.\n\n### C?\n\nD.\n`), /hardcoded live reading/],
  ['real-time claim', post({ description: 'Real-time data on the fractional leadership market for everyone.' }), /real-time/],
  ['American spelling', post({ description: 'We normalized every input before publishing it for readers.' }), /American spelling/],
  ['thin body', post({}, `## Sources\n\n- [One](https://e.com/1)\n- [Two](https://e.com/2)\n\n## Frequently asked questions\n\n### A?\n\nB.\n\n### C?\n\nD.\n`), /needs depth/],
];

for (const [name, p, re] of cases) {
  test(`rejects: ${name}`, () => {
    const f = validateAnswers([p], { today: TODAY });
    assert.ok(f.some((x) => re.test(x)), `expected ${re} in:\n${f.join('\n')}`);
  });
}

test('"not real-time" is allowed', () => {
  assert.deepEqual(validateAnswers([post({ description: 'It is not real-time; it is recalculated after each daily ingest.' })], { today: TODAY }), []);
});

test('duplicate slugs are rejected', () => {
  const f = validateAnswers([post(), post({ title: 'Another question?' })], { today: TODAY });
  assert.ok(f.some((x) => /duplicate slug/.test(x)));
});

test('front matter parses lists and scalars', () => {
  const { meta } = parseFrontMatter('---\ntitle: A?\nrelated: a, b\n---\nbody');
  assert.equal(meta.title, 'A?');
  assert.deepEqual(meta.related, ['a', 'b']);
});

test('renderer escapes HTML and renders tables, code and links', () => {
  const html = renderMarkdown('Text <script> **bold** [l](https://x.y)\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```\n<raw>\n```');
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<a href="https:\/\/x.y" rel="noopener">l<\/a>/);
  assert.match(html, /<th>a<\/th>.*<td>2<\/td>/s);
  assert.match(html, /<pre><code>&lt;raw&gt;<\/code><\/pre>/);
});

test('word count ignores link targets', () => {
  assert.equal(wordCount('Read [the index](https://pulse.fractionl.ai/) now'), 4);
});

test('feed lists every post with a permalink guid', () => {
  const xml = buildFeed([post()], 'https://pulse.fractionl.ai');
  assert.match(xml, /<guid isPermaLink="true">https:\/\/pulse.fractionl.ai\/answers\/test-question<\/guid>/);
  assert.match(xml, /<atom:link href="https:\/\/pulse.fractionl.ai\/answers\/feed.xml" rel="self"/);
});
