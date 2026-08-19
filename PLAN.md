# Daily Pull — Build Plan

A daily photo journal styled as a nostalgic, colorful trading-card collection. One photo a
day = one card. Journaling first, collectible-card feeling second — the card metaphor is
material and aesthetic, not a competitive game layer. Rebuilding the visual layer and screen
structure of the existing `picture-tcg-project` repo (previously "Everdot") on top of its
working permission/capture/DB logic.

Full discovery context and the reasoning behind these decisions lives in this Project's
knowledge base (`daily-pull-project-plan` and the earlier discovery findings doc) — this
file is the actionable spec distilled from that.

## Tech stack

Carried over from the existing repo: Expo, React Native, TypeScript, expo-sqlite,
react-native-reanimated, react-native-gesture-handler, @react-navigation. Revisit only if
something here (most likely the tilt-reactive holo effect) genuinely can't be done well on
this stack — don't change it preemptively.

## Data model

### `cards` table — mostly unchanged, one new column

```sql
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,   -- doubles as the collection-wide card number ("No. 216")
  date TEXT NOT NULL UNIQUE,              -- YYYY-MM-DD, drives Set membership
  photo_uri TEXT NOT NULL,
  title TEXT,                             -- NEW: optional, see "Title flow" below
  vibe_type TEXT,
  is_holo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
```

`id`, `date`, `vibe_type`, and `is_holo` are used exactly as they are today — no changes to
`cardsRepository.ts` beyond accepting/reading `title`.

### NEW: `set_reveals` table

```sql
CREATE TABLE IF NOT EXISTS set_reveals (
  set_start_date TEXT PRIMARY KEY NOT NULL,  -- the Monday of that week, e.g. '2026-08-10'
  revealed_at TEXT NOT NULL
);
```

Tracks whether a completed Set's fan-reveal animation has already played. Keyed by the
Monday of the week rather than a numeric set number, so there's nothing to keep in sync — the
display number ("Set 33") is always derived, never stored (see "Sets" below).

### `app_settings` — unchanged, reused as-is

Already a generic key-value store (`installed_at`, `onboarding_complete`). No changes
needed for this rebuild; a future export-preference default could live here if wanted, but
that's not MVP-blocking.

## Screens

Built from the approved Claude Design mockups. Nine screens total, corrected below (see
"Errata" — the original version of this file undercounted by one and it caused a real
navigation bug, see that note for what changed and why):

1. **Today** — today's card face-down until captured; day-streak count; this week's row of
   cards; single "pull today's card" CTA.
2. **Camera — auto** — live viewfinder, live filter strip, one shutter button. This is the
   default, ship-first camera experience.
3. **Camera — manual** — exposure/ISO/focus sliders. **Explicitly post-MVP** — build the
   screen, but auto-capture should be fully functional and shippable without it. Don't let
   this block the rest of the build.
4. **Card reveal, vibe tag, and title** — card flips face-up after capture. One vibe-tag
   choice (golden/calm/together/adventure/cozy) sets the card's edge color. Title field is
   part of this same screen (see "Title flow" below). "Add to binder" writes the row once,
   same single-write pattern as the current `insertCard` flow.
5. **Card Detail** — a real, standalone screen, not just the shared card component. This is
   mockup 2e ("the card as an object, move your cursor over it") — a single card shown large,
   with the full anatomy on display and the "Common"/"Holo + odds" rarity panel beneath it.
   **This is the tap target for a card in the Binder grid and for Today's already-captured
   card** — not Export. Holo tilt/pan interactivity is **on** here (single focal card, same
   as Reveal), unlike the Binder grid where it's intentionally off. Export is reached *from*
   this screen (e.g. a share/export icon in its header), not by tapping the card directly.
6. **Binder** — cards grouped into Sets (calendar weeks), with a Pages/Scroll toggle so both
   browsing modes are available. Pagination between Sets.
7. **Set-complete / pack reveal** — triggers only the first time the user scrolls back into
   a *completed* Set that hasn't been revealed yet (no matching row in `set_reveals`): cards
   fan out from the page, tap one to settle into the normal page view. Insert the
   `set_reveals` row the first time this plays. Every later visit shows the settled page
   directly — no replay.
8. **Export** — frame choice (Card / Borderless / Story 9:16), toggleable overlays
   (date/title/vibe/set number), holo-sheen toggle, and a "save raw photo instead" switch
   (unstyled, full resolution). No app branding in any export path. Reached from Card Detail,
   not by tapping a card directly (see screen 5).
9. **Binder skin selector** — see "Binder skins" below.

### Errata (post-build correction)

The original version of this section described screen 5 as "Card component / holo anatomy —
this is a shared component, not just a screen," folding a real mockup screen into a
component spec. That was wrong, and it directly caused a real bug: with nowhere else to
route to, tapping a card in the Binder went straight to Export instead of a bigger card
view, and holo interactivity had no focal-view screen to live in outside of Reveal. The
`CardFace` component itself is still correct as a shared component (used inside Today,
Reveal, Binder's grid, Card Detail, and Export) — the fix is adding Card Detail as its own
screen on top of that component, not changing the component.

## Card anatomy & holo effect

**Errata (2nd correction):** the first version of this section listed anatomy elements
(date, rarity, title, vibe chip, card number) without saying where they live relative to the
photo. The build's reasonable-but-wrong interpretation was to overlay all of them directly
on top of the photo — corner pill badges for date/rarity, a translucent scrim banner for the
title. That's not what the mockup shows and it's the single biggest reason the built card
doesn't read as a trading card. Corrected structure below.

A card has **two stacked parts, both inside the 2px ink-rule border, never overlapping**:

1. **Photo window** — the top ~70% of the card. Just the photo (and the holo foil effect,
   for holo cards). No text is ever drawn on top of the photo itself. No corner badges, no
   scrim, nothing.
2. **Info plate** — the bottom ~30%, a solid block in the skin's `cardstock` color (i.e. the
   card's own background color showing through, not the photo). Contains, top to bottom /
   left to right:
   - Date and rarity label, in a mono font, as a small top row within the plate
   - Title, in heavy caps, as the dominant text in the plate
   - Vibe chip bottom-left of the plate, card number bottom-right of the plate

This matches actual trading-card conventions (image window + a separate printed info area
below it) and is what both the reveal-screen mockup and the card-object-study mockup show —
neither has any text sitting on top of the photo pixels.

- Non-holo cards show a "Common" label with a matte finish, no sheen — this applies to the
  photo window only; the info plate looks the same regardless of rarity.
- Holo cards show "Holo" + the pull odds, with a **two-layer foil effect** confined to the
  photo window:
  1. A wide hue sweep that responds to device tilt (or cursor position, for non-motion
     contexts) — this is the primary, obviously-reactive layer.
  2. A fixed ~74° grain overlay that only catches the light at an angle, so the card doesn't
     read as flat even when held still.

This was pressure-tested in chat before Design ran (a static-shimmer vs. tilt-reactive
comparison) — tilt-reactive was the clear preference, and Design's spec independently landed
on the same direction, which is a good sign it's well understood before being built for real.

## Typography

Also underspecified the first time, and also a real reason the build doesn't read like the
mockup: headers ("Today," "Binder," a card's title) need a **bold, all-caps, slightly
condensed treatment** — heavy font weight, `textTransform: uppercase`, tightened letter
spacing — not default system text in mixed case. Date/rarity/card-number labels need a
**true monospace font**. Per AGENTS.md, the project currently uses the platform system
monospace (`Menlo`/`monospace`) with no bundled font dependency — that's fine to keep, the
gap isn't the font family, it's that the bold-caps treatment for headers hasn't been applied
at all yet (everything is currently default system text, mixed case, regular weight). This
alone — headers and titles in heavy uppercase, numbers in mono — is likely the single
highest-leverage fix for the whole app reading as "designed" rather than generic.

## Cross-cutting requirements (apply to every screen)

- **Safe-area insets.** Every screen must respect the device's safe area (notch/Dynamic
  Island/status bar, home indicator) via `SafeAreaView` or `useSafeAreaInsets` padding.
  Headers currently render underneath the status bar on multiple screens, which both looks
  broken and makes some buttons genuinely unreachable — this is a functional bug, not a
  style note, and should be treated as a blocking fix.
- **Binder's grid must wrap.** A Set has 7 day-slots and should render as a wrapping grid
  (e.g. 3 columns), matching the mockup's Mon/Tue/Wed, Thu/Fri/Sat, Sun layout — not a single
  non-wrapping row.

## Streak & holo odds — reuse as-is

`computeDayStreak` (strict midnight rollover, no grace period) and `resolveIsHolo`
(`HOLO_STREAK_MILESTONE_DAYS = 7`, `HOLO_BASE_CHANCE = 0.08`) carry over unchanged from
`src/utils/streak.ts` and `src/utils/holo.ts`. Worth noting: the 8% baseline already matches
the "Holo −8%" label shown on the card-detail mockup, so the existing numbers and the design
are already in agreement — no retuning needed for this build.

## Sets (weekly "pack") mechanic

- A Set = a Monday–Sunday calendar week (matches the Aug 10–16 example in the mockups).
- The displayed Set number ("Set 33") is derived, not stored: weeks elapsed between the
  account's first Set and this one, plus one.
- A Set is "complete" once it has 7 cards in it — this is just `COUNT(*)` grouped by week,
  no new column needed.
- See `set_reveals` above for the reveal-once behavior.

## Title flow

- Optional field, part of the reveal/tag screen (screen 4).
- A "randomize" button fills in a suggestion the user can accept or edit, rather than
  requiring free typing. Starter phrase bank is in `CLAUDE.md` — treat it as swappable data,
  not hardcoded logic, so it's trivial to expand later.
- Leaving it blank is fine. Anywhere a title would display, fall back to
  `formatCardDateLabel(date)` (already exists in `src/utils/date.ts`) instead of an empty
  string.

## Binder skins

Token-based theming: shell / page / cardstock / foil-ramp per skin. Ship with all four skins
from the Design output rather than just the default, since the full token sets already exist:

- **Warm Binder** (default) — dark warm shell, cream cardstock, gold foil
- **Card Shop '97** — cool ink base, gold foil
- **Scrapbook Sun** — light paper, halftone texture
- **Foil Arcade** — jewel-dark base, chrome foil

Vibe tag colors (`vibeColors` in the current theme file) stay constant across all skins —
only shell/page/stock/foil change. Adding a future skin should be a new token set, not a
design pass on every screen.

## Suggested build order

1. Rename app (Everdot → Daily Pull) and scaffold the new theme/token structure to support
   multiple skins from the start.
2. Migrate the schema: add `title` to `cards`, add the `set_reveals` table.
3. Rebuild Today, Camera (auto), and the reveal/tag/title screen on top of the existing
   permission, capture, and DB-write logic — don't rewrite what already works.
4. Build the card component (anatomy + tilt-holo effect) as a shared, reusable piece used by
   reveal, binder, and export.
5. Build Binder (Pages/Scroll toggle) and the Set-complete reveal.
6. Build Export.
7. Build the skin selector and wire skin tokens through every screen.
8. Manual camera controls — deliberately last, since it's post-MVP.

## Flag, don't guess

- Randomizer phrase bank content — a starter list is provided in `CLAUDE.md`, but treat the
  actual wording as easy-to-change data, not something to over-engineer.
- Reduced-motion / accessibility fallback for the tilt-holo effect hasn't been specced —
  flag it rather than inventing a behavior.
