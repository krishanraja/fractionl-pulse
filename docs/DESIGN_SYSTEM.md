# Pulse Design System

This is the implementation contract for Pulse's public product experience. The source of truth is the rendered application in `src/components/PulseInstrument.tsx` and the Pulse-specific rules in `src/index.css`; this document explains the intent so future changes do not collapse the product back into a generic dashboard.

## Product idea

Pulse is a public market instrument. The current index, its movement, data coverage, timeline, and six-role view stay visible without sign-in. Explanation is a separate layer. Commercial access is a partner application, not a gate in front of the public index.

The interface follows three evidence levels:

1. **Measured fact:** index level, components, dates, movement, demand for the selected role, and data coverage.
2. **Interpretation:** bounded language that explains what the measured state can support.
3. **Decision cue:** an invitation to combine Pulse with the user's own pipeline, geography, and constraints. It is not financial advice or a prediction.

## Information architecture

| Surface | Job | Access |
|---|---|---|
| Index | Current FWI, 30-day movement, timeline, components, and data coverage | Public |
| My role | Current advertised-demand read for one of six C-suite roles | Public; selection persists locally or to the signed-in profile |
| Signals | Role and source observations | Public |
| Interpretation | Cached AI analysis grounded in the latest score observation | Public; unavailable state is explicit |
| Sources | Health, provenance, and methodology limits | Public |
| Ask the Index | One-question, evidence-bounded explanation | Public; origin-restricted and rate-limited |
| Partner access | Founding Benchmark Partner application path | Public application; no self-serve paid tier |
| Sign in | Optional profile, role persistence, and operational API-key management | Authenticated utility |

Sources and methods is one navigation destination. Its page combines live source health with a contextual route into calculation details; the methodology drawer is progressive disclosure, not a second menu item. Responsive secondary views are mounted once and restyled by breakpoint—never duplicated into hidden desktop and mobile DOM trees.

Role routes (`/fractional-cfo` through `/fractional-ceo`) are crawlable public demand pages. They must describe measured US job-posting evidence, disclose source overlap and missing referral work, and never infer pricing power or prescribe a fee.

## Device-specific systems

Pulse uses purposeful layouts rather than shrinking one desktop dashboard.

### Wide desktop: 1280px and above

- Persistent dark navigation rail on the left.
- Editorial index canvas in the centre.
- Persistent Ask the Index panel on the right, separating facts, explanation, and what to consider.
- Your role and sources and methods remain in the main reading path.

### Compact desktop and landscape tablet: 1024px to 1279px

- Same instrument model with reduced columns, type scale, and spacing.
- Labels must remain contained inside their navigation and evidence cells.
- No component may depend on clipped overflow to create the layout.

### Mobile and portrait tablet: below 1024px

- Brand header and compact overflow menu.
- Score-first index view, then timeline and expandable interpretation cards.
- Dedicated My role view instead of compressing the desktop role comparison.
- Bottom navigation for Index, My role, and Ask.
- Ask the Index opens as a full-height, focus-managed task surface that follows the visible viewport when the keyboard opens.
- Signals, Interpretation, and Sources use the same ruled editorial registers as the index. Generic rounded cards, muted utility palettes, and global Inter typography do not appear inside the Pulse frame.

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

### Typography

Pulse uses the typography already established by the public homepage. Both the product frame and portal-rendered overlays inherit these tokens:

| Token | Stack | Use |
|---|---|---|
| `--pulse-font-ui` | Arial, Helvetica, sans-serif | Navigation, controls, labels, metadata, and buttons |
| `--pulse-font-editorial` | Georgia, Times New Roman, serif | Headline score, major titles, user questions, and interpretive narrative |

The role, not the component library, chooses the font. A dialog or drawer must not fall back to the generic global Inter theme when it belongs to Pulse.

### Plain-language vocabulary

Primary interfaces use familiar language. Technical terms remain available inside expanded details and developer documentation.

| Product language | Technical equivalent |
|---|---|
| Your role | Role lens |
| Demand for this role | Role demand |
| Overall hiring demand | Market demand |
| Executive availability | Talent supply or availability |
| Market interest | Culture or market momentum |
| Data coverage | Evidence coverage or data completeness |
| Sources and methods | Methodology and provenance |
| What the data suggests | Interpretation |
| What to consider | Decision cue |

## Interaction rules

- Every control has a visible keyboard focus ring and a semantic label.
- Mobile primary targets are at least 44px high.
- Dialogs trap focus while open and restore focus to the invoking control when closed.
- Pulse overlays render above the sticky header and mobile navigation. The bottom navigation is removed from the rendered and focus layers while an overlay is open.
- Mobile overlays use `window.visualViewport` when available and `100dvh` as a fallback. Their header and footer stay fixed inside the visible viewport while the content area scrolls independently.
- The viewport includes `viewport-fit=cover` and `interactive-widget=resizes-content`; all fixed mobile actions include safe-area padding.
- Reduced-motion preferences remove non-essential motion.
- Loading, unavailable, stale, and degraded-data states are stated in words; missing values render as unavailable, never zero.
- Ask the Index accepts at most 280 characters, requires a live FWI context, returns `FACT`, `INTERPRETATION`, and `ACTION`, and fails closed when rate control or the live index is unavailable.
- AI text may interpret supplied evidence but may not create market facts, localise a US-scoped reading, call a role comparison a time trend, or turn media attention into pricing power.

## Change control

Before release, verify the public index, role selection, all navigation states, Sources and Methods, Ask the Index, authentication, and degraded states with keyboard and touch-sized viewports. At 320, 375, 390, and 768 pixels, test a reduced visual viewport that simulates an Android keyboard. The composer, close control, and methods footer must remain visible and tappable, with no bottom navigation above them. Complete a physical Android Chrome and Samsung Keyboard check before calling keyboard behavior production-verified. The portable concept in `design/pulse-deciding-sentence-v1.html` records the approved direction; it is not runtime code or a substitute for testing the rendered product.
