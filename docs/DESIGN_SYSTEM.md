# Pulse Design System

This is the implementation contract for Pulse's public product experience. The source of truth is the rendered application in `src/components/PulseInstrument.tsx` and the Pulse-specific rules in `src/index.css`; this document explains the intent so future changes do not collapse the product back into a generic dashboard.

## Product idea

Pulse is a public market instrument. The current index, its movement, evidence coverage, timeline, and six-role lens stay visible without sign-in. Interpretation is a separate layer. Commercial access is a partner application, not a gate in front of the public index.

The interface follows three evidence levels:

1. **Measured fact:** index level, components, dates, movement, role demand, and completeness.
2. **Interpretation:** bounded language that explains what the measured state can support.
3. **Decision cue:** an invitation to combine Pulse with the user's own pipeline, geography, and constraints. It is not financial advice or a prediction.

## Information architecture

| Surface | Job | Access |
|---|---|---|
| Index | Current FWI, 30-day movement, timeline, components, and evidence coverage | Public |
| My role | Current advertised-demand read for one of six C-suite roles | Public; selection persists locally or to the signed-in profile |
| Signals | Role and source observations | Public |
| Interpretation | Cached AI analysis grounded in the latest settled score | Public; unavailable state is explicit |
| Sources | Health, provenance, and methodology limits | Public |
| Ask Pulse | One-question, evidence-bounded interpretation | Public; origin-restricted and rate-limited |
| Partner access | Founding Benchmark Partner application path | Public application; no self-serve paid tier |
| Sign in | Optional profile, role persistence, and operational API-key management | Authenticated utility |

Role routes (`/fractional-cfo` through `/fractional-ceo`) are crawlable public demand pages. They must describe measured US job-posting evidence, disclose source overlap and missing referral work, and never infer pricing power or prescribe a fee.

## Device-specific systems

Pulse uses purposeful layouts rather than shrinking one desktop dashboard.

### Wide desktop: 1280px and above

- Persistent dark navigation rail on the left.
- Editorial index canvas in the centre.
- Persistent Ask Pulse panel on the right, separating facts, interpretation, and the decision cue.
- Role lens and methodology remain in the main reading path.

### Compact desktop and landscape tablet: 1024px to 1279px

- Same instrument model with reduced columns, type scale, and spacing.
- Labels must remain contained inside their navigation and evidence cells.
- No component may depend on clipped overflow to create the layout.

### Mobile and portrait tablet: below 1024px

- Brand header and compact overflow menu.
- Score-first index view, then timeline and expandable interpretation cards.
- Dedicated My role view instead of compressing the desktop role lens.
- Bottom navigation for Index, My role, and Ask.
- Ask Pulse opens as a focus-managed modal with practical touch targets.

The acceptance widths are 320, 375, 390, 768, 1024, 1280, 1440, and 1920 pixels. No width may introduce horizontal page scroll, clipped navigation labels, unreachable actions, or hover-only information.

## Brand system

The supplied Fractionl identity is implemented from:

- `src/assets/fractionl-icon.png`
- `src/assets/fractionl-logo.png`
- `public/favicon.ico`, `public/favicon.png`, `public/favicon-64.png`, `public/favicon.svg`
- `public/apple-touch-icon.png`

Pulse's instrument palette is defined on `.pulse-product-frame`:

| Token | Value | Use |
|---|---|---|
| `--pulse-ink` | `#07172a` | Navigation, primary type, structural contrast |
| `--pulse-paper` | `#fbf7ed` | Main instrument field |
| `--pulse-paper-deep` | `#f2ebdd` | Secondary surfaces |
| `--pulse-amber` | `#e59500` | Fractionl signal accent and active state |
| `--pulse-amber-soft` | `#f5c463` | Focus halo and restrained emphasis |
| `--pulse-rule` | `#9d988c` | Strong evidence dividers |
| `--pulse-rule-soft` | `#d5cec1` | Internal component rules |

Amber is an accent, not body-text colour. Status bands also use a word label and shape or direction, never colour alone.

## Interaction rules

- Every control has a visible keyboard focus ring and a semantic label.
- Mobile primary targets are at least 44px high.
- Dialogs trap focus while open and restore focus to the invoking control when closed.
- Reduced-motion preferences remove non-essential motion.
- Loading, unavailable, stale, and degraded-data states are stated in words; missing values render as unavailable, never zero.
- Ask Pulse accepts at most 280 characters, requires a live FWI context, returns `FACT`, `INTERPRETATION`, and `ACTION`, and fails closed when rate control or the live index is unavailable.
- AI text may interpret supplied evidence but may not create market facts, localise a US-scoped reading, call a role comparison a time trend, or turn media attention into pricing power.

## Change control

Before release, verify the public index, role selection, all navigation states, methodology, Ask Pulse, authentication, and degraded states with keyboard and touch-sized viewports. The portable concept in `design/pulse-deciding-sentence-v1.html` records the approved direction; it is not runtime code or a substitute for testing the rendered product.
