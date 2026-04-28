# Modern Ranger Card System

Shared surface treatment for every Discover (and broader app) card. Defined in
`src/index.css` under the **MODERN RANGER · shared card surfaces** block.

> **Rule:** Don't write inline `background` / `border` / `border-radius` /
> `box-shadow` / `padding` for surfaces. Compose a `.ranger-card*` class
> instead. Reach for inline styles only for layout (flex, grid, sizing) and
> dynamic park-fingerprint colors.

---

## Base

### `.ranger-card`
Default editorial surface — light paper, hairline border, 10px radius, soft
1px shadow, 16px padding.

**Use for:** any standalone content card on the light/cream Discover canvas.
**Examples:** highlight tiles, crowd-pattern card, Trip card.

---

## Modifiers (compose with `.ranger-card`)

| Class | What it changes | Use when |
|---|---|---|
| `--rounded-lg` | Bumps radius to 14px and uses the slightly stronger `--ranger-shadow-soft`. | Larger hero-adjacent cards that need a touch more presence (e.g. crowd-pattern card). |
| `--flush` | Drops padding to `0` and clips overflow. | The card has internal sections that own their own padding (e.g. cards that contain a header strip + body). |
| `--warm` | Swaps to warm parchment background + warmer border. | Editorial / Mochi essay surfaces that should feel like a printed page. |
| `--featured` | Warm paper, no shadow, **3px dark left rule**, generous 26/24/22 padding. | The single "featured" essay or recommendation per section (Mochi seasonal essay). One per view. |
| `--quiet` | Flat, no shadow, centered text, 26/20 padding, slightly stronger border. | **Empty states.** No CTA elevation; the card is informational, not actionable. (e.g. "Planning a trip?" before a trip date is set.) |
| `--inset` | Bone-colored border, 8px radius, no shadow, tight 10/12 padding. | Inline action rows or chip-like sub-surfaces nested inside a parent card. |

---

## Dark "field" variants

For surfaces that sit on the near-black ribbon between major sections, or on
top of a hero photo. Text defaults to `--ranger-parchment`.

| Class | Purpose |
|---|---|
| `.ranger-card--night` | Solid dark card. Use for the Poko trip-briefing CTA and similar dark action surfaces. |
| `.ranger-card--night-rounded-lg` | Add to `--night` to bump radius to 14px (matches the larger CTA scale). |
| `.ranger-card--night-pop` | Small elevated dark popover (`--ranger-shadow-pop`, 12/14 padding). Use for inline footnote / tooltip bubbles that overlay the canvas. |

---

## Edge-to-edge ribbon strips

Full-bleed dividers between major page sections. **Reset radius and shadow,
horizontal hairline only.** Always pair `.ranger-card--strip` with one tone
modifier.

| Class | Background | Use for |
|---|---|---|
| `.ranger-card--strip-night` | `--ranger-night` | Park selector ribbon directly under the hero. |
| `.ranger-card--strip-warm` | `--ranger-night-warm`, softer divider, 14/12 padding | Telemetry strip (local time / countdown / sunrise / sunset). |
| `.ranger-card--strip-gradient` | Vertical gradient `night-warm → night-deep`, 26/20/28 padding, top + bottom hairlines | "Today" section — the single tall dark passage between editorial sections. |

---

## Lightbox

| Class | Purpose |
|---|---|
| `.ranger-card--lightbox-caption` | Bottom caption bar inside `HeroLightbox`. Hairline top, vertical veil gradient, safe-area-aware padding. Always `text-align: center`. |

---

## Interactive elevation

Every card variant *except* the static surfaces (strips, captions,
`--quiet`) ships with a unified hover/focus/press transition:

- **Hover / focus-visible:** lift 1px, swap to `--ranger-shadow-3` (or
  `--ranger-shadow-pop` for `--night`), darken the border to `--ranger-rule`
  (or `--ranger-gold` for `--night`).
- **Pressed:** sink back to baseline with a faster 90ms transition and a
  softer shadow.
- **Disabled:** `disabled` or `aria-disabled="true"` on the card cancels the
  transform and switches the cursor to `not-allowed`.
- **Reduced motion:** `prefers-reduced-motion: reduce` drops the translate
  but keeps the shadow + border swap so the affordance survives.

Activation rules:

1. The card **is** the interactive element — render it as `<button>`,
   `<a>`, or `[role="button"]`. Elevation is automatic.
2. The card **wraps** an interactive area but isn't itself a button — add
   `.ranger-card--interactive` explicitly.
3. The card is purely informational — do nothing. Don't make a passive
   surface look tappable.

---

## Decision tree

```
Is the surface full-bleed between sections?
├─ Yes → .ranger-card--strip + tone modifier (-night | -warm | -gradient)
└─ No
   ├─ Is it inside the lightbox? → .ranger-card--lightbox-caption
   ├─ Is the background dark/photographic?
   │   ├─ Action card  → .ranger-card--night [+ --night-rounded-lg]
   │   └─ Floating tip → .ranger-card--night-pop
   └─ Light canvas
       ├─ Empty state                         → .ranger-card .ranger-card--quiet
       ├─ Featured editorial (one per view)   → .ranger-card .ranger-card--featured
       ├─ Editorial / Mochi essay             → .ranger-card .ranger-card--warm
       ├─ Nested chip / inline action row     → .ranger-card .ranger-card--inset
       ├─ Card with internal padded sections  → .ranger-card .ranger-card--flush
       └─ Default content card                → .ranger-card [+ --rounded-lg]
```

---

## Anti-patterns

- ❌ Re-declaring `background`, `border`, `border-radius`, `box-shadow`, or
  base `padding` inline on a Discover surface. Add or extend a variant
  instead.
- ❌ Stacking custom hover utilities (`hover:brightness-95`,
  `active:scale-[0.98]`) on a `.ranger-card*` — duplicates and fights the
  shared elevation system.
- ❌ Using `--quiet` for a card that has a primary CTA. Quiet surfaces are
  intentionally inert; promote to base `.ranger-card` so users get the lift
  affordance.
- ❌ More than one `--featured` card per section. It loses meaning when
  repeated.
- ❌ Hardcoded park colors in CSS. Park-fingerprint backgrounds (badges,
  hero gradients) stay as runtime inline styles via the existing
  `badgeBg(parkConfig.primaryColor)` / fingerprint helpers.
