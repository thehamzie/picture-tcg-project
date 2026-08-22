# AGENTS.md

## Progress

- **Step 1 — rename + skin/token scaffold.** Everdot → Daily Pull rename done across
  `package.json`, `app.json` (name/slug/permission copy), `App.tsx` (SQLite db file renamed
  `everdot.db` → `dailypull.db`, fresh file — no migration needed for the rename itself),
  `HomeScreen.tsx`, `PermissionsScreen.tsx`. New `src/theme/skins.ts` defines the
  shell/page/cardstock/foilRamp token shape and all four skins (`SKINS`, keyed by
  `SkinId`); `src/theme/SkinContext.tsx` provides `useSkin()` / `SkinProvider`, backed by a
  new `skin_id` key in `app_settings` (`getSkinId`/`setSkinId` in `settingsRepository.ts`,
  default `warmBinder`). `SkinProvider` is mounted in `App.tsx` inside `SQLiteProvider`,
  around `NavigationContainer`. Not-yet-rebuilt screens (Home, Collection, OpenCard,
  Permissions, Onboarding, CardFace) still read the old static `theme.colors.*` export —
  they'll move to `useSkin()` as each is rebuilt in later steps, per PLAN.md's build order.
- **Step 2 — schema migration.** `cards` gained `title TEXT` (nullable); new `set_reveals`
  table (`set_start_date` PK, `revealed_at`) added. `schema.ts`'s `CREATE TABLE IF NOT
  EXISTS` covers fresh installs; a `ALTER TABLE cards ADD COLUMN title TEXT` guarded by a
  swallowed error handles upgrading an existing `dailypull.db` that predates this change.
  `types/card.ts` and `cardsRepository.ts` now carry `title` through `CardRow`/`Card`/
  `insertCard`. New `src/db/setRevealsRepository.ts` (`hasSetBeenRevealed`,
  `markSetRevealed`) — not yet called anywhere; wiring belongs to the Binder/Set-complete
  build in step 5.
- **Step 3 — Today, Camera (auto), reveal/tag/title.** New `TodayScreen.tsx` (face-down/
  revealed today slot via existing `CardFace`, day-streak text, Monday-start "this week" row
  via new `utils/sets.ts`, single CTA). New `CameraScreen.tsx` (live `CameraView`, 5-chip
  filter strip — cosmetic tint only, see open decisions — shutter, library-import fallback,
  reuses existing permission/capture/`saveCardPhoto` logic unchanged). New
  `RevealScreen.tsx` (flip animation reused from the old `OpenCardScreen`, vibe-chip toggle
  row, title `TextInput` + randomize button backed by new `utils/titlePhrases.ts`, single
  "add to binder" → `insertCard` write with `title` included, then `navigation.reset` to
  `Main`). `HomeScreen.tsx` and `OpenCardScreen.tsx` deleted (superseded by the two screens
  above); `EmptyFirstRunScreen.tsx` / `LookBackScreen.tsx` also deleted (see open decisions).
  Navigation restructured accordingly — see open decisions for details. `CardFace` itself is
  still the old Everdot-era anatomy (no title display yet, time-based shimmer instead of
  tilt-holo) — full anatomy + tilt-holo rebuild is step 4, and Today/Reveal will pick up the
  new look for free once that component is rebuilt in place. `npx tsc --noEmit` passes.
- **Step 4 — shared card component (anatomy + tilt-holo).** `CardFace.tsx` fully rebuilt to
  the PLAN.md anatomy spec (2px ink-rule border, mono date/rarity top row, heavy-caps title
  banner with the date-label fallback, vibe chip bottom-left, card number bottom-right) and
  is now skin-aware (`useSkin()` for `cardstock`/`foilRamp` tokens; `vibeColors`/`vibeIcons`
  still come from the constant, cross-skin `theme.ts` per PLAN.md). New `HoloFoil.tsx`
  implements the two-layer foil: a `expo-linear-gradient` hue sweep driven by
  `expo-sensors`' `DeviceMotion` (gamma/tilt), and a fixed-angle grain gradient layer. Both
  are new dependencies added via `npx expo install`. Added `NSMotionUsageDescription` to
  `app.json`'s iOS `infoPlist` for the motion sensor. Confirmed with the user: reduced-motion
  devices get a slow, gentle auto-cycling sweep instead of tilt/pan reactivity (not a fully
  static holo) — implemented via `AccessibilityInfo.isReduceMotionEnabled()` +
  `reduceMotionChanged` listener. Non-motion contexts (simulators, web) fall back to a
  touch/mouse-drag pan gesture via `react-native-gesture-handler`. `Today`/`Reveal` now pass
  `title`/`cardNumber` through to `CardFace`.
- **Step 5 — Binder + Set-complete reveal.** New `BinderScreen.tsx` replaces
  `CollectionScreen.tsx` (deleted), which was still the old Everdot month-calendar-grid
  concept; Binder is Sets-based per PLAN.md instead. `utils/sets.ts` gained `SetSummary` and
  `buildSets(cards, installedAt)`, producing every Set (Monday-start week) from the
  account's first Set through the current week, each with its 7 aligned card slots and an
  `isComplete` flag. `setRevealsRepository.ts` gained `getAllRevealedSetDates`. Pages mode
  is a horizontal paging `ScrollView` (one Set per page); Scroll mode is a vertical
  `ScrollView` of all Sets stacked, with the "focused" Set for reveal-triggering purposes
  determined by whichever section's `onLayout`-measured center is closest to the viewport
  center on scroll. New `SetCompleteReveal.tsx` renders the fan-out/tap-to-settle
  interaction for any complete-but-unrevealed Set; `markSetRevealed` fires once settled.
  Grid slots for non-today/non-card days reuse the blank/missed distinction from the old
  Everdot collection screen (blank = before install or future; missed = past day with no
  card). `utils/calendar.ts` (the old month-grid helpers) deleted as dead code — nothing
  referenced it once `CollectionScreen.tsx` was gone. Binder is skin-aware (`useSkin()` for
  `page.background` / `shell.*`) — a step ahead of step 7 for this screen, same as `CardFace`
  in step 4. `npx tsc --noEmit` passes.
- **Step 6 — Export.** New `ExportScreen.tsx` (`Export: { cardId }` route, pushed as a modal)
  with the 3 frame choices (Card / Borderless / Story 9:16), 4 overlay toggles (date/title/
  vibe/set number), a holo-sheen toggle (holo cards only), and "save raw photo instead."
  `CardFace.tsx` gained an `overlays` prop (`date`/`title`/`vibe` visibility, all default
  true) and a `showHoloSheen` prop distinct from `isHolo` itself — `isHolo` still always
  governs the "Holo"/"Common" rarity label; `showHoloSheen` only gates whether `HoloFoil`
  renders, since the export toggle is about the animated sheen, not the card's true rarity.
  "Set number" isn't part of `CardFace`'s anatomy (only "card number"/`cards.id` is, per the
  card-detail mockup) — it renders as a small caption below the preview instead, shared
  across all 3 frames, rather than being woven into `CardFace`. Saving uses two new
  dependencies: `expo-media-library` (`saveToLibraryAsync`, permission requested inline at
  export time — not during onboarding) and `react-native-view-shot` (`captureRef` on the
  preview view for the styled paths). `app.json` gained the `expo-media-library` plugin
  block with photos-permission copy. `cardsRepository.ts` gained `getCardById`; `utils/
  sets.ts` gained `getSetNumberForDate` (single-date variant of `buildSets`, avoids building
  every Set just to label one card). Entry points: tapping a filled Binder grid slot, or
  tapping Today's already-captured card, both open Export for that card — PLAN.md doesn't
  specify an entry point, so this was added as an implicit call. `npx tsc --noEmit` passes.
  **Not manually verified on a simulator/device** — this environment has no iOS/Android
  runtime available; flagging per the "say so explicitly" guidance rather than claiming it
  works end-to-end untested.
- **Step 7 — skin selector + wire tokens everywhere.** New `SkinSelectorScreen.tsx`
  (`SkinSelector` route, modal) lists all 4 skins from `SKIN_ORDER` with a small swatch
  preview (shell/page/cardstock/foil-sweep colors) and a checkmark on the active one; tapping
  calls `useSkin().setSkin`, which persists to `app_settings` and updates every screen live.
  Entry point: a palette icon in `TodayScreen`'s header (no entry point specced by PLAN.md,
  same implicit-call pattern as Export's entry point). Every remaining screen migrated off
  the static `theme.colors.*` palette onto `useSkin()`: `TodayScreen`, `CameraScreen`,
  `RevealScreen`, `PermissionsScreen`, `OnboardingScreen`, `TabNavigator` (tab bar chrome),
  `ScreenPlaceholder`, `SetCompleteReveal`, plus the remaining static bits of `BinderScreen`/
  `ExportScreen` from steps 5-6. Pattern used throughout: a `createStyles(skin)` factory
  called via `useMemo(() => createStyles(skin), [skin])` inside each component, since
  `StyleSheet.create` can't read a hook value at module scope. `vibeColors`/`vibeIcons`/
  `cardShape` stay as the static, cross-skin `theme.ts` import per PLAN.md ("vibe tag colors
  stay constant across all skins"); `theme.colors.surface` (`#FFFFFF`) is kept as a fixed
  "text/icon-on-colored-background" utility color (button labels on `skin.shell.accent`,
  icons on vibe-colored chips) rather than migrated to a skin token, since no skin defines a
  dedicated "on-accent contrast" token — see open decisions. Camera's live-preview overlay
  chrome (close button, filter strip, library button) intentionally stays fixed
  black/white-translucent rather than skin-colored, since it sits on top of a live camera
  feed rather than app chrome, and some skin accents (e.g. Scrapbook Sun's light orange)
  wouldn't read well as a translucent scrim over arbitrary photo content. `npx tsc --noEmit`
  passes.
- **Step 8 — manual camera controls (post-MVP).** New `ManualCameraScreen.tsx`
  (`ManualCamera` route), reached via a "manual" button on the auto `CameraScreen`. Zoom is a
  real control (wired to `CameraView`'s `zoom` prop, 0-1, via 5 discrete tap-stops rather than
  a continuous drag slider — see open decisions). Focus is real but binary: expo-camera only
  exposes autofocus as an on/off `FocusMode`, not a continuous manual distance, so it's a
  lock/unlock toggle, not a slider. Exposure/ISO is **not a real control** — expo-camera's
  native `CameraView` has no exposure-compensation or ISO prop in its public API (only a
  web-only, docs-hidden `WebCameraSettings` type exposes those field names, and that type
  isn't usable on iOS/Android); the exposure control is a UI stand-in labeled "(visual only)"
  that doesn't affect the actual capture. This is a hard library/platform limitation, not a
  scoping choice — confirmed by reading `expo-camera`'s `Camera.types.d.ts` rather than
  guessing. Capture reuses the same take-photo → `saveCardPhoto` → `Reveal` flow as the auto
  camera. Per PLAN.md, this doesn't block anything — auto-capture (steps 1-7) is fully
  shippable without it. `npx tsc --noEmit` passes. Not manually verified on a device, same
  caveat as step 6.

**All 8 steps of PLAN.md's suggested build order are now implemented.** Nothing has been run
on an actual iOS/Android simulator or device in this environment — everything above is
verified only by `npx tsc --noEmit` (clean throughout) and code review, not by exercising the
app.

- **Follow-up pass — real skin tokens + 3 resolved decisions.** Two mockup source files
  landed in `design-reference/` (`daily-pull-screens.png`, `Daily Pull - Screens
  (standalone).html`) — the latter is a JSON-escaped HTML export whose inline styles contain
  exact hex/rgba/gradient values for every screen. All 7 example screens in it render **Warm
  Binder**, so its token values are read directly from the markup and CONFIRMED: `shell.
  background` #17130F, `shell.surface` #241C15 (face-down card, page-turn spine, export
  photo stage), `shell.textPrimary` #F4ECDC, `shell.accent` #E0A32E, `page.background`
  #E8D9BE (binder page + set-complete page — cross-checked across 3 separate screens),
  `cardstock.base` #FAF3E4, `cardstock.border`/`inkRule` #17130F, and the foil sweep itself:
  `linear-gradient(112deg, transparent 18%, rgba(255,255,255,.85) 32%, rgba(255,196,90,.8)
  42%, rgba(110,230,255,.75) 52%, rgba(255,110,200,.65) 62%, transparent 78%)` from the "card
  object study" screen (2e), the most complete single instance — plus the previously-unknown
  grain layer definition: `repeating-linear-gradient(74deg, rgba(255,255,255,.7) 0 1px,
  transparent 1px 5px)` at `opacity:.22`, confirming grain is **white**, universal (not
  skin-tinted), and exactly 74°/0.22. The other 3 skins only appear as a 4-swatch preview chip
  (shell/page/cardstock/foil, in that order — verified by cross-checking Warm Binder's own
  swatch against its confirmed real values) plus a one-line descriptor in the skin-selector
  screen, no full renders — so several of their fields are ESTIMATED by analogy to Warm
  Binder's now-confirmed structure (e.g. ink-rule = shell.background on dark skins; a plain
  dark ink color on the one light skin). `src/theme/skins.ts` now comments every field
  CONFIRMED or ESTIMATED individually — see that file for the field-by-field breakdown; not
  duplicated here since it would drift out of sync. `FoilRampTokens` gained
  `sweepLocations: number[]` (uneven stop positions, e.g. `[0.18, 0.32, 0.42, ...]`, not the
  even spacing previously assumed) and `HoloFoil.tsx` now passes `locations` through to
  `LinearGradient`, uses a start/end vector approximating the source's 112° CSS angle instead
  of a plain 45° diagonal, and renders the grain layer in white instead of the per-skin
  `foilRamp.labelColor` it used before. Three decisions the user made explicitly (not
  inferred): (1) Set-numbering anchor changed from `installed_at` to the account's earliest
  *captured card* date — `buildSets`/`getSetNumberForDate` in `utils/sets.ts` now derive the
  anchor from `cards` directly (`fallbackAnchor`/`installedAt` only covers the empty-cards
  case, where Binder shows its empty state instead anyway); new
  `cardsRepository.getEarliestCardDate` backs `ExportScreen`'s Set-number lookup, replacing
  its `getInstalledAt` call. (2) Cosmetic-only camera filters and gradient-based (not
  noise-texture) foil grain are both confirmed final for MVP. (3) Manual camera exposure/ISO
  stays UI-only — no camera library swap. `npx tsc --noEmit` passes.
- **Follow-up pass — Card Detail was a missing screen.** The user corrected PLAN.md: item 5
  ("Card component / holo anatomy — this is a shared component, not just a screen") was
  wrong — Card Detail (mockup 2e, "the card as an object") is its own screen, not only the
  shared `CardFace` component embedded elsewhere. New `CardDetailScreen.tsx`
  (`CardDetail: { cardId }` route, modal): a single card shown large with full holo tilt/pan
  interactivity (`interactive` default `true` on `CardFace`, same as Reveal — a single focal
  card, unlike the non-interactive Binder grid), plus the Common/Holo rarity legend panel
  from the mockup beneath it (both "common"/"holo ~8%" panels always shown, side by side;
  whichever matches the card's actual `isHolo` is accent-highlighted). A share icon in its
  header opens Export (`navigation.navigate('Export', { cardId })`) — Export is no longer
  reached directly. Entry points retargeted: `BinderScreen.tsx`'s filled grid slots
  (`onOpenExport` renamed `onOpenCardDetail`) and `TodayScreen.tsx`'s already-captured-card
  tap now both open `CardDetail` instead of `Export`. `HoloFoil.tsx` was explicitly left
  untouched per the user's instruction — its tilt/gradient logic was already confirmed
  correct against the mockup in the prior pass. Note for future sessions: at the time of this
  correction, `PLAN.md` on disk still showed the old "shared component, not a screen" wording
  and no visible "Errata" section — the correction came via the user's message directly, not
  a re-read of an already-edited `PLAN.md`. Worth checking whether `PLAN.md` itself still
  needs updating to match. `npx tsc --noEmit` passes.
- **Follow-up pass — 6 corrections from PLAN.md's Typography/Cross-cutting-requirements
  sections and screenshot review.** `PLAN.md` on disk was confirmed re-read this time and
  does now have both new sections plus a second Errata note (card anatomy). Fixes, in the
  priority order given:
  1. **Safe-area insets everywhere.** Added `useSafeAreaInsets()` to every screen that didn't
     already account for it: `TodayScreen`, `BinderScreen` (header `paddingTop`), `CameraScreen`
     / `ManualCameraScreen` (close/manual buttons repositioned from a hardcoded `top: 56` to
     `insets.top + 12`; bottom controls shifted by `insets.bottom`), `RevealScreen`,
     `CardDetailScreen`, `ExportScreen` (its `ScrollView`'s `contentContainerStyle`),
     `SkinSelectorScreen`, `OnboardingScreen`, `PermissionsScreen`. Used inline
     `paddingTop: insets.top + <existing base padding>` on each screen's container rather than
     wrapping in `SafeAreaView`, so skin-driven background colors and existing padding values
     stay intact.
  2. **Binder grid wrap.** Root cause: `gridSlot`'s `width: '22%'` combined with the grid's
     `gap: 8` — RN's flexbox `gap` isn't subtracted from a percentage child's own size, so the
     actual per-row footprint exceeded the container width and wrapping landed wrong (visually,
     4 cards fit while the rest were pushed out of view rather than wrapping into clean rows of
     3). Fixed by measuring the grid's real width via `onLayout` and computing an exact pixel
     `slotWidth = (gridWidth - GAP*(COLUMNS-1)) / COLUMNS` for 3 columns, applied instead of the
     percentage (a `31%` fallback covers the one frame before the first layout measurement
     lands).
  3. **`CardFace` rebuilt to the two-part photo-window/info-plate structure.** Removed every
     photo-overlay element (corner scrim badges, title scrim banner) — the photo window (flex
     `7`) now holds only the `Image` + `HoloFoil`, nothing else. Added a `flex 3` info plate
     below it, `backgroundColor: skin.cardstock.base`, holding the mono date/rarity row, heavy-
     caps title, vibe chip bottom-left, card number bottom-right — all now in
     `skin.cardstock.inkRule` (dark ink) instead of white-on-scrim, since text no longer sits on
     the photo. The rarity label is plain colored text now (`skin.foilRamp.labelColor` for
     holo, muted ink for common, with a "◆" prefix matching the mockup) instead of a pill/chip
     background, since it no longer needs a scrim for legibility. `CardFace`'s public props
     (photoUri/date/title/vibeType/isHolo/cardNumber/interactive/overlays/showHoloSheen) are
     unchanged, so no consumer (Today, Reveal, Card Detail, Binder grid, Export) needed prop
     changes — only its internal rendering changed. See open decisions for a real tension this
     surfaced with the Binder grid specifically.
  4. **Heavy-caps typography.** Applied `fontWeight: '800'`, `textTransform: 'uppercase'`, and
     negative `letterSpacing` (tightened, not the previous positive/loosened value) to:
     `TodayScreen`'s "Daily Pull" header, `BinderScreen`'s "your binder" header and "set N"
     page label, `CardFace`'s title text, `ExportScreen`'s "export card" title, and
     `SkinSelectorScreen`'s "binder skin" title. Left onboarding/permissions step titles and
     Binder's empty-state headline alone — those read as sentence-case body copy in the
     mockup, not display headers, and PLAN.md's named examples (Today, Binder, card titles)
     don't cover them; scoped narrowly rather than applying it everywhere a heading-like role
     exists.
  5. **Today's streak is now a 7-pip row** (`TodayScreen`'s `pipRow`), replacing the old
     `day N of your streak` sentence. A small `day N · streak` mono label sits above it (kept
     since dropping the exact count read as a regression the instruction didn't ask for). See
     open decisions for the fill-count formula, which isn't confirmed against PLAN.md.
  6. **Today's "this week" row rebuilt as compact thumbnails** with a 3px vibe-color bottom bar
     (`weekThumbBar`, matching the mockup's photo-placeholder-plus-colored-bar treatment,
     conditionally rendered when the card has a vibe) instead of the old plain `Image` tiles.
     Added a `SET {n} · THIS WEEK` label (using the existing earliest-card-date Set anchor,
     computed client-side from `cards` — no new DB call) and an `Open binder →` link that
     navigates to the Binder tab.
  `npx tsc --noEmit` passes throughout; not manually verified on a device (same standing
  caveat as every prior UI pass in this environment).

- **Design pass — rebuilt against the extracted mockup source.** The `design-reference/"Daily
  Pull - Screens (standalone).html"` bundle was unpacked properly this time: its
  `<script type="__bundler/template">` block is a JSON string holding the whole design export,
  which decodes to ~62KB of markup with **exact inline styles for all 9 mockup screens**
  (2a–2i), plus the design's own `renderVals()` script carrying the literal tilt and fan math.
  That is now the source of truth; a decoded copy is reproducible via the template block.
  What changed:
  - **Real fonts** (user-approved). `@expo-google-fonts/archivo`, `archivo-black`, `dm-mono` +
    `expo-font` + `expo-splash-screen`. New `src/theme/typography.ts` owns the family names,
    the `FONT_ASSETS` map, and `display()`/`body()`/`mono()` helpers. `App.tsx` holds the
    splash until they load. The mockup uses exactly three faces — Archivo Black (all display
    headers, card titles, primary button labels), Archivo 400/500/600 (body), DM Mono 400/500
    (dates, rarity, card numbers, every tracked-out label). This was the single biggest reason
    the build didn't read like the reference.
  - **Mockup-pixel scaling.** The mockup frame is 344pt wide; every value in the code is its
    literal pixel value passed through `s()`, which scales by `viewportWidth / 344` clamped to
    [0.9, 1.18]. `…Raw` type helpers exist for callers that already derived their own factor
    (`CardFace` scales by `u = width / 250`) so the two never compound.
  - **Vibe colours were wrong** and are now the confirmed values: golden `#F2A007`, calm
    `#12B37A`, together `#EE3F76`, adventure `#F2571C`, cozy `#6C63E8`. The previous palette
    was a desaturated variant of each (golden was `#BA7517`), which is why the app read muddy.
  - **`CardFace` rebuilt again**, to the actual 2e anatomy — which is *not* the flex-7/flex-3
    photo-window/info-plate split the last pass built. The real structure: card padding
    11/11/13, a photo frame with a 2px ink rule + 5px inner **mat** (`#EFE4CC`, a token that
    didn't exist before) around a **square (1:1) photo**, then the plate — mono `AUG 16 · SAT`
    / `◆ HOLO` row, Archivo Black title, and a bottom row of a *labelled vibe chip* next to a
    *card-number chip* (not corner-anchored text). A `vibeStyle="bar"` variant covers 2h's
    smaller export preview.
  - **Foil is now the real CSS.** RN 0.81 supports `mixBlendMode`, `boxShadow`, `isolation`
    and gradient `experimental_backgroundImage`, so `HoloFoil` renders the source's two
    `mix-blend-mode: overlay` layers rather than approximating them. New `theme/gradients.ts`
    emits CSS *strings* (RN's hand-written `.d.ts` mistypes a colour stop's `positions` as
    `string[][]`; the string form avoids it) and unrolls repeating gradients by hand, since
    RN's parser accepts only `linear-gradient`/`radial-gradient`. Note the foil covers the
    **whole card**, not just the photo window — in both 2d and 2e the layers are children of
    the card root at `inset: 0`. That contradicts PLAN.md's "confined to the photo window";
    the mockup was followed.
  - **New shared pieces**: `HardButton` (the `box-shadow: 0 5px 0` gold key, which now
    depresses onto its own shadow when pressed), `FaceDownCard` (the DP card back, with an
    idle float), `BinderPage` (cream leaf + 4 punched rings + the two stacked page edges),
    `CardThumb` (the *simpler* grid/fan cell the mockup actually uses), `Slider` (a real drag
    slider), `useTilt` (one motion/pan source feeding both the foil sweep and the card's own
    3D tilt, using the design export's own `rx=(50-fy)/6, ry=(fx-50)/5`).
  - **Every screen rebuilt** to its mockup: Today (2a), Camera (2b), Manual (2c), Reveal (2d),
    Card Detail (2e), Binder (2f), Set-complete (2g), Export (2h), Skin selector (2i).
    Onboarding and Permissions have no mockup and were rebuilt from the same tokens with fresh
    copy (the old text described a month calendar this rebuild no longer has).
  - **Third tab added** (user-approved). Both 2a and 2f show `TODAY / BINDER / SETS`; there was
    no Sets screen and PLAN.md never mentions one. New `SetsScreen.tsx` is an index of every
    Set with a 7-day completion strip, tapping through to that Set's Binder page via a new
    `Binder: { setStartDate }` route param. New `DailyPullTabBar` replaces the default tab bar
    (plain tracked-out uppercase labels over a hairline, per the mockup).
  - Verified by `npx tsc --noEmit` (clean) **and** by having Metro build the full iOS and
    Android bundles successfully, which confirms every import and font asset resolves. Still
    **not run on a simulator or device** — this environment has none, and the Expo web target
    can't bundle at all here for an unrelated reason (`expo-sqlite`'s web build imports a
    `wa-sqlite.wasm` asset that isn't present in the installed package). So layout and colour
    are verified by construction against the source values, not by looking at it.

- **Crash fixes + the share/templates feature.** Two crashes the user hit, and the export
  system rebuilt around them.
  - **Manual camera crash — two live camera sessions.** `native-stack` keeps the screen
    underneath mounted, so navigating Camera → ManualCamera left *two* `CameraView`s mounted
    and two native capture sessions competing for the hardware, which hard-crashes on both
    platforms. Fixed three ways: each camera screen now renders its `CameraView` only while
    `useIsFocused()` is true (genuine unmount — `active` alone is not enough, it's iOS-only),
    passes `active={isFocused}`, and the manual/auto buttons use `navigation.replace` so only
    one camera screen is ever in the stack. Also fixed an inverted focus mode: expo-camera's
    `FocusMode` reads backwards from its label — `'on'` means "focus once then **lock**",
    `'off'` means "refocus automatically" — and the rewrite had them swapped.
  - **Share crash — snapshotting blend layers.** `mixBlendMode`/`isolation` put a view in its
    own compositing layer, which is exactly what `captureRef` handles worst; walking that
    subtree crashes or yields a black frame. New `components/CaptureContext.tsx` exposes a
    `capturing` flag; `HoloFoil` swaps `mixBlendMode: 'overlay'` for plain alpha and `CardFace`
    drops `isolation` while it's set. The capture path flips the flag, waits two frames for
    the re-render to commit, then snapshots — so exports are also deterministic instead of
    depending on whether the snapshot backend supports blending. The share path additionally
    normalises bare paths to `file://` and falls back to RN's own `Share` API if
    `expo-sharing`'s native module isn't in the build.
  - **Share templates (new feature).** `components/share/ShareCanvas.tsx` composes six
    templates — for a single card: `classic` (card centred on the shell), `bleed` (full-bleed
    photo + scrim caption), `pageCard` (card tilted on the binder leaf); for a whole Set:
    `grid` (the week as one binder page), `fan` (seven cards fanned, reusing the 2g geometry),
    `filmstrip` (seven bands with day labels, built for 9:16). Output ratio is selectable —
    `1:1` / `4:5` / `9:16` — and the overlay chips (date/title/vibe/set no./holo sheen) drive
    all of them. No app branding in any template, per PLAN.md.
  - **Export resolution is now real**, which resolves the open decision below. The capture
    target is laid out at `EXPORT_WIDTH = 1080` and merely `transform: scale`d down for the
    on-screen preview, so the snapshot is taken from genuine 1080px-wide layout rather than
    upscaled from a ~200pt preview. This required making internal metrics width-derived rather
    than device-derived: `CardThumb` now scales by `width / 86` (falling back to the device
    scale when no width is given, which reproduces its old sizing), and `BinderPage` takes a
    `unit` prop. `CardFace` already scaled by `width / 250`.
  - Entry points: Card Detail's share icon (single card), plus **new** share icons on each
    Sets-tab row and on the Binder page header (whole Set). `ExportParams` is now a union —
    exactly one of `cardId` / `setStartDate`.
  - Deleted `ScreenPlaceholder.tsx`, dead since the Binder rebuild stopped using it.
  - `npx tsc --noEmit` clean; iOS and Android bundles both build. **The two crashes could not
    be reproduced here** (no simulator/device in this environment) — the diagnoses above are
    from reading the expo-camera types and the capture path, not from a stack trace, so if
    either persists the next step is the actual native log.

- **Share crash (real cause), more skins/templates, batch photo save, card edit/delete.**
  - **The share crash was memory, not blend modes.** The previous pass's blend-layer fix was
    real but wasn't the cause — the actual problem was that the capture target was laid out at
    `EXPORT_WIDTH` **points** (1080) and merely transform-scaled down for the preview. On a 3×
    device that is a 3240px-wide backing store — roughly 50-75MB for a 4:5 or 9:16 frame — and
    snapshotting it took the process down. Worst on the single-card path, which is where the
    user hit it, because that's the one that also renders the foil. Now the preview and the
    capture target are two separate renders of the same width-parameterised `ShareCanvas`: the
    preview at ~230pt, and the capture mounted **off-screen only while a snapshot is in
    flight**, laid out at `CAPTURE_LAYOUT_WIDTH = min(540, 1080 / PixelRatio.get())` so
    `layout × pixelRatio` still lands on 1080px. Same output, about a ninth of the memory, and
    no ancestor transform for the snapshot to disagree about. The blend-mode/`CaptureContext`
    work from the previous pass is kept — it's still correct, and it makes exports deterministic
    rather than dependent on snapshot-time blend support.
  - **Second contributor: unbounded gradient stop counts.** `foilGrain` emitted a fixed 800px
    run at a 5px period — **320 colour stops** in one native gradient — and, being quoted in
    absolute pixels, it also rendered as an invisible hairline on a large canvas.
    `repeatingStripes` now takes a bounded `repeats` count (default 64, hard cap 96) and every
    caller scales `stripe`/`period` by the element instead, so the texture looks the same at
    any size and the shader cost is constant. `CardFace`, `CardThumb` and `FaceDownCard` pass
    their own `u`.
  - **Four new skins** — `midnightInk`, `forestPress`, `sakuraPress`, `monoPress` (8 total).
    None are from the design source; they're original token sets following Warm Binder's
    confirmed structure, and `skins.ts` says so explicitly so a later reader doesn't mistake
    them for extracted values. The status bar no longer hardcodes a skin id — new
    `isLightSurface()` derives light/dark from the shell colour, so a new light skin gets it
    right without editing `App.tsx`.
  - **Four new share templates** (10 total). Cards: `minimal` ("QUIET" — square photo, wide
    margins, one mono line, built for everyday posting) and `poster` (editorial; photo above,
    large title below). Sets: `contact` ("SHEET" — seven square frames with day labels, the
    plainest of the set templates) and `stack` (cards cascading with slight counter-rotation,
    which suits 9:16 best).
  - **Save a Set's photos individually.** On a Set's Share screen, "Save each photo
    separately" writes every original to the library untouched — no composition, no downscale.
    Reports partial success honestly rather than claiming all N saved.
  - **Card edit + delete** — the most significant functional gap left. `updateCardDetails` and
    `deleteCard` in `cardsRepository`, `deleteCardPhoto` in `photoStorage`, wired to a pencil
    icon in Card Detail's header that opens an inline edit panel (title + vibe, reusing the
    reveal screen's picker) plus a destructive-confirm delete. Deliberately narrow: only the
    title and vibe are editable. The photo, date, holo roll and card number are what make the
    card a record of that day, so they stay immutable.
  - Deleted `ScreenPlaceholder.tsx` (dead). `npx tsc --noEmit` clean; iOS and Android bundles
    both build. Still no simulator/device in this environment.

- **Crash diagnosis made possible; manual camera merged into Camera; Settings + backup.**
  Both crashes survived two rounds of inference, so this pass stopped guessing and changed the
  structure instead.
  - **`ErrorBoundary` at the root of `App.tsx`.** Without it, an uncaught JS error unmounts the
    tree and the app simply vanishes — indistinguishable from a native crash and impossible to
    report. Now a JS error renders a readable, selectable message + stack. **This is also a
    diagnostic:** if a failure still kills the app *without* showing that screen, the fault is
    native (a module, the camera session, an out-of-memory) and only the device log will have
    it. Deliberately styled without `useSkin` or the bundled fonts, so it still renders when
    the theme or the font loader is what broke.
  - **Manual camera is no longer a separate screen.** `ManualCameraScreen.tsx` is deleted and
    the `ManualCamera` route is gone; manual is now a drawer on `CameraScreen`, toggled by the
    AUTO/MANUAL pill. This is what the mockup describes ("manual drawer pulled up… auto still
    shoots underneath", 2c), and structurally it means the app now contains **exactly one
    `CameraView`**, which is unmounted whenever the screen is unfocused. The previous fix
    (`useIsFocused` + `replace`) reduced the window for two competing capture sessions but
    didn't eliminate it; merging the screens does.
  - **Share capture, shape 4.** The history is worth keeping because each shape failed
    differently: (1) ~200pt preview upscaled via captureRef's `width`/`height` — soft;
    (2) canvas laid out at 1080 **points** and transform-scaled for display — a 3240px backing
    store, ~50-75MB, enough to exhaust memory mid-snapshot; (3) a copy mounted off-screen at
    `left: -10000` — light, but snapshotting a view the compositor never had reason to render
    is unreliable. Now: laid out at `CAPTURE_LAYOUT_WIDTH` (~360pt, so `layout × pixelRatio`
    still lands near 1080px) and scaled for display by a transform **on the captured node
    itself**. That transform is safe — both backends rasterize from layout bounds
    (`view.bounds` on iOS, `getWidth()/getHeight()` on Android) and a view's own transform
    affects its frame in its parent, not the content it draws. Shape 2's mistake was the
    1080-point layout, not the scaling. "Use the raw photo instead" now applies to Share as
    well as Save, giving a path that never touches view-shot at all.
  - **Settings screen** (`Settings` route, modal; gear in Today's header, replacing the
    unlabelled palette icon). Houses three things that had no home: the daily reminder
    (scheduled once during onboarding and then unreachable — now persisted in `app_settings`
    via `getReminder`/`setReminder`, editable, and cancellable), the skin picker, and getting
    a copy of the collection out.
  - **Backup — the release blocker.** New `utils/backup.ts`, deliberately two honest operations
    rather than one "Backup" button that implies more than it delivers:
    `saveAllPhotosToLibrary` copies every photo into the OS library (grouped into a "Daily
    Pull" album where permitted), which is the part that genuinely protects against loss since
    the library is already covered by iCloud/Google Photos; and `writeCollectionExport` writes
    dates/titles/vibes/rarity as JSON to share. Settings states plainly that cards live only on
    the phone. **This is not a restore** — the export carries `photoFilename` so a future
    import can re-link records to files, but nothing reads it back yet.
  - Android adaptive-icon background changed from `#E6F4FE` (a light blue belonging to no skin)
    to Warm Binder's `#17130F`.
  - `npx tsc --noEmit` clean; iOS and Android bundles both build. Still no simulator/device
    here — the crash fixes are structural, not observed.

- **The Settings / single-card-share crash: found, and it was never the native modules.** Two
  earlier passes attributed this to blend-mode snapshotting and then to capture-canvas memory.
  Both of those were real problems and both fixes are worth keeping, but neither was this
  crash. The actual cause: **a `useAnimatedStyle` worklet calling `s()`, an ordinary
  non-worklet imported function**, in exactly three places —
  `SettingsScreen.tsx`'s `PillSwitch` (`progress.value * s(17)`), `ExportScreen.tsx`'s
  `PillSwitch` (identical, a copy of the same component), and `Slider.tsx`'s `knobStyle`
  (`-s(KNOB) / 2`). Reanimated's Babel plugin captures `s` into the worklet's closure; on the
  UI runtime it is a non-worklet stub, so invoking it throws *on the UI thread*, outside
  React's reach. That is why it presented as a total process death with no error code and why
  `ErrorBoundary` never fired — the boundary was working correctly and was, as intended,
  the evidence that the fault was below JS.
  Why those exact screens and nothing else: `useAnimatedStyle`'s **first** evaluation runs on
  the JS thread, where `s` is perfectly callable, so mounting is fine; it only moves to the UI
  runtime once the value animates. `PillSwitch`'s `useEffect` fires `withTiming` immediately on
  mount, so Settings and the card-share screen die on open. `Slider` only re-evaluates on drag,
  so the manual-camera drawer opens fine and would have died on first slider drag.
  It also explains the sharp Set-vs-card asymmetry the user reported: `ExportScreen` renders
  `PillSwitch` only under `isCardSubject` — a Set share renders a plain `Ionicons` row instead,
  which is why sharing a whole Set worked while sharing one photo did not.
  Fix is a one-line hoist in each: `s()` is resolved at module load on the JS thread
  (`KNOB_TRAVEL`, `KNOB_HALF`) and the worklet multiplies a captured number. Every other
  worklet in the app was audited and is clean — `useTilt`, `HoloFoil`, `SetCompleteReveal`,
  `HardButton`, `FaceDownCard`, `DailyPullTabBar`, `RevealScreen` and both gesture handlers
  capture only numbers, booleans, `Math`, worklet-marked helpers (`clamp`), or `runOnJS`.
  Standing lesson for this codebase: `s()`, `body()`, `mono()`, `display()`, `withAlpha()` are
  all JS-thread-only. Anything a worklet needs from them must be computed outside it.
  `npx tsc --noEmit` clean. Still no simulator/device here — but unlike the two previous
  attempts this is a structural defect identified in the source, not an inference about
  native behaviour, and it predicts the observed symptom set exactly.

- **Real image pipeline: the camera's controls and filters now change the photograph.** The
  user confirmed Settings and manual mode no longer crash, and asked for the manual controls to
  stop being decorative. Both that and "more filters" turned out to be the same missing piece —
  the app had no image processing anywhere, so the filter strip was a preview tint that never
  reached the file (`saveCardPhoto` copied the untouched capture) and EXPOSURE/ISO were labelled
  "VISUAL ONLY".
  - **`@shopify/react-native-skia` added** (user-approved; the plan was explicitly "Skia now,
    VisionCamera after"). New `src/camera/`: `colorMatrix.ts` (4x5 matrix algebra — compose,
    exposure in real stops, contrast about mid-grey, Rec.709 saturation, temperature, film
    fade, duotone), `filters.ts` (**15 presets**, up from 5; the mockup's original NONE/KODA/
    FADE/DISCO/GREY keep their confirmed swatches, plus NOIR/SUN/FROST/DUST/PINE/BLOOM/SEPIA/
    NEON/SLATE/HONEY), and `develop.ts` (the Skia pass). A whole recipe — preset plus the
    user's five adjustments — collapses into **one** colour matrix, so any photo costs one
    texture upload and one draw regardless of how much is stacked.
  - **What is real, precisely.** ZOOM, FOCUS (binary lock), FLASH and the newly-added TORCH act
    on the sensor. EXPOSURE, CONTRAST, SATURATION, WARMTH and GRAIN are real but act on the
    captured still, not the sensor — expo-camera 17 still exposes `exposureCompensation`/`iso`
    only on `WebCameraSettings`, re-verified in `Camera.types.d.ts` rather than assumed. So the
    drawer is now a *develop* panel and says "BAKED AT CAPTURE" instead of "POST-MVP". Manual
    ISO/shutter is unavailable in **every** RN camera library including VisionCamera, so that
    one is not a scoping choice at any point on the roadmap.
  - **EXIF orientation had to be handled explicitly.** Skia decodes raw pixels and ignores the
    orientation tag while RN's `<Image>` honours it, so without this a landscape capture would
    look upright everywhere in the app until the moment it was developed, then silently come
    out rotated. `takePictureAsync({ exif: true })` now feeds all eight orientations through
    `applyExifTransform`.
  - **Live preview is blend layers, not a flat tint.** Each preset declares a small
    `mixBlendMode` stack (`saturation`, `color`, `soft-light`, `color-burn`), which gets
    genuinely close for the monochrome and duotone presets where a translucent rectangle only
    ever washed the image out. Two traps here, both handled: no `isolation` on the wrapper (the
    layers must stay in the camera's stacking context to blend against it), and a flat-tint
    fallback on Android below API 29, where RN ignores `mixBlendMode` — an ignored `saturation`
    blend on opaque black is a black viewfinder.
  - **Filters bake destructively — the user's explicit choice**, after being told the two
    consequences. Recorded in open decisions below. Export's "use the raw photo instead" was
    relabelled **"Use the photo on its own"** ("no frame, no captions, full resolution")
    because it can no longer honestly mean *unfiltered*.
- **Thumbnails + virtualization.** The binder mounted every Set at once in a plain ScrollView
  and drew full 12MP captures into ~100pt slots — a year in, that is 52 pages and 365 decoded
  photos resident. Capture now also writes a 360px thumbnail (`cards.thumb_uri`), both binder
  modes are `FlatList`s (`getItemLayout` + `initialScrollIndex` for pages, so it still opens
  directly on the newest Set; `onViewableItemsChanged` for scroll, replacing the old
  measure-every-section centre math), and `displayThumb(card)` feeds the grid, Today's week row
  and the set-complete fan. Share templates deliberately keep full photos — a 1080px export
  would show a 360px thumbnail. Old cards are filled in by `useThumbnailBackfill`, mounted in
  `TabNavigator`: four at a time with a pause between batches, failures written back as the
  photo's own URI so the query can't loop on an unreadable row.
- **Backup is now a real round trip.** `writeCollectionExport` was write-only; nothing read it.
  New `writeBackupArchive` / `restoreFromArchive` produce and consume **one file** containing
  every record *and* every photo, written and read through a `FileHandle` one photo at a time
  so a 300-card collection costs a few MB of memory rather than the archive's size. Format is
  `DPBAK1\n` + a ten-digit header length + ASCII-escaped JSON header + the photos concatenated
  in header order. Deliberately not a zip: a JS zip library would have to hold everything at
  once, which is the same mistake the share canvas made twice. `TextEncoder` is avoided for the
  same reason — its presence depends on the engine build — so the header is escaped to printable
  ASCII via JSON's own `\uXXXX` and `JSON.parse` reverses it, meaning a title in any script
  survives. Restore is **additive**: existing days are never overwritten (photos still have to
  be consumed in order so the read head doesn't land mid-photo), and it reports restored /
  already-present / failed separately. Backup goes out via the share sheet rather than a
  directory picker — one step, and it sidesteps Android SAF entirely.
- **Three new share templates**, on the user's request for a side-by-side grid and things that
  sit naturally in a story. **MOSAIC** (set) is the direct answer: seven photos edge to edge,
  no gutters, no card stock, no binder leaf — one hero across the top and two rows of three,
  which is exactly seven with no leftover cells. It packs photos rather than day slots, so an
  incomplete week reads as tight rather than broken. **TILES** (set, 9:16) is two seamless
  columns with the eighth cell carrying the set label. **STORY** (card, 9:16) holds the photo in
  the middle of the frame with the type below it. New `storyInset()` insets edge content on
  every 9:16 export (7.5% top / 10% bottom) so Instagram's own controls stop covering captions;
  BLEED picks it up too. Templates can now declare a `bestAspect`, shown as a badge and applied
  on selection.
- **Haptics** (`src/utils/haptics.ts`, `expo-haptics`) on the shutter, the card flip — with the
  *heavier* notification for a holo pull, the one place the haptic carries information — adding
  to the binder, vibe and filter selection, the set-complete settle, page turns and destructive
  confirms. Every call is fire-and-forget and swallows its rejection; simulators, Android
  handsets without the hardware and users who've turned it off must never surface an error, and
  a capture must never wait on a vibration.
- `cards` gained `thumb_uri` and `filter_id` (ALTER-guarded, same pattern as `title`).
  `insertCard` takes `createdAt` so restore preserves the original timestamp.
  `npx tsc --noEmit` clean; iOS and Android bundles both build. **Still no simulator or device
  in this environment** — the Skia pipeline, the blend-mode previews and the archive round trip
  are verified by construction and by the type/bundle passes, not by looking at a photo.

- **First real device run, and it found three things.** The previous pass was the first code in
  this repo ever exercised on hardware. Reported: photos coming out wrongly oriented, filters
  reading as opaque sheets rather than filters, and a request to see the manual controls working
  live in the viewfinder.
  - **Orientation — the previous pass trusted the wrong number.** There are *two* orientation
    values for a capture and they are not the same. The canonical one is TIFF/IFD0 tag 0x0112 in
    the file, which is what every decoder honours, React Native's `<Image>` included. The other
    is `photo.exif.Orientation` as reported by expo-camera, which its iOS implementation derives
    from the `UIImage`'s own orientation and writes into the EXIF **sub-dictionary**
    (`ExpoCameraUtils.data`, `ios/Common/ExpoCameraUtils.swift`) — not where the canonical tag
    lives. So it is computed independently of the file's tag and can disagree with it. Skia
    applies neither, so the develop pass has to reproduce exactly what `<Image>` does or the
    photo changes orientation the moment it is developed. New `src/camera/exif.ts` parses the
    real tag out of the JPEG bytes (APP1 → TIFF header → IFD0 → 0x0112, both byte orders);
    `developPhoto` now reads the file's bytes once and uses them for both the tag and the
    decode, and `exif: true` is gone from the capture calls. **This is the invariant to keep:
    whatever `<Image>` honours, the develop pass must apply — never what a camera API reports.**
  - **Filters are now real filters.** The `mixBlendMode` overlay stack from the previous pass
    was wrong twice over — the layers read as coloured curtains, and blend modes composite
    unreliably against a native camera preview layer. Replaced entirely with React Native's
    **`filter` style prop** (RN 0.81, `StyleSheetTypes.d.ts` → `FilterFunction`), applied to a
    `View` wrapping the `CameraView`: `filter` affects a view's whole subtree, so the live
    preview is genuinely filtered rather than covered. Every preset now declares real
    `brightness`/`contrast`/`saturate`/`sepia`/`grayscale`/`hueRotate` functions plus an optional
    `tint` **capped at 0.16 opacity** for hue casts no filter primitive expresses. No blend modes
    anywhere, so the Android API 29 gate is gone too.
  - **The manual controls preview live.** `buildPreviewFilter(recipe)` folds the preset *and* the
    user's exposure/contrast/saturation into one filter array driven by the same numbers as
    `buildDevelopMatrix`, so dragging a slider changes the viewfinder by the amount it will
    change the photo — exposure via `brightness: 2^ev`, matching the EV readout exactly. Two
    exceptions, both handled honestly: warmth is a faint amber/blue tint (there is no colour-
    temperature filter primitive, and `sepia` has no cool counterpart so a warm/cool slider built
    on it would be asymmetric), and grain is a Skia `<Canvas>` + `<FractalNoise>` + `<ColorMatrix>`
    layer using the *same* noise shader the bake uses, mounted outside the filtered wrapper so
    exposure and contrast don't move the grain around. Drawer badge now reads "LIVE PREVIEW".
- **Accessibility gap closed** (identified in the audit; 2 accessibility props existed in the
  whole codebase). Every icon-only control now carries a role and a label — camera close/torch/
  flash/library/flip/shutter/filter swatches, card detail close/edit/share/shuffle/delete,
  settings close and the reminder steppers, export close, binder and sets share, today's
  settings, binder grid cells (labelled with title, day and rarity), reveal's flip target and
  vibe chips. `Slider` gained `accessibilityRole="adjustable"` with increment/decrement actions
  and a spoken `valueText` — a drag gesture is otherwise completely invisible to a screen
  reader, which mattered most on exactly the manual controls this pass made real.
- **Store identifiers** (also from the audit): `ios.bundleIdentifier` and `android.package` set
  to `com.dailypull.app`, with `buildNumber`/`versionCode`, plus a new `eas.json` with
  development/preview/production build profiles. **Change the identifier before the first
  publish if a different one is wanted — it is permanent once either store has accepted a
  build.** `supportsTablet` flipped to `false`: every measurement derives from a 344pt mockup
  width clamped to 1.18×, so an iPad would render a stretched phone, and leaving the flag on
  commits to iPad screenshots and an iPad review. `userInterfaceStyle` corrected from `light` to
  `dark` — the app's default skin is Warm Binder and the old value forced light system keyboards
  and sheets under it.
- `npx tsc --noEmit` clean; both bundles build. The orientation fix is a structural correction
  traced to expo-camera's own source, not another inference — but like everything else here it
  is unverified on a device from this environment.

- **The live-filtered viewfinder is not buildable on expo-camera. Develop moved to its own
  screen.** The `filter`-prop approach from the previous pass broke the camera on device:
  selecting any filter or touching any slider turned the preview black, froze it, or rendered
  only part of the frame. Cause: React Native's `filter` forces the view it is applied to into
  an **offscreen layer**, and a native camera surface is not part of that rasterisation — so
  wrapping `CameraView` in a filtered `View` breaks the preview outright. It also explains the
  partial/"square" preview, since expo-camera's preview is `FILL` and only letterboxes if
  `ratio` is set, which it isn't.
  **Three approaches have now failed on device, and the file headers say so, so nobody retries
  them:** (1) flat alpha tints — work, but can never desaturate, so monochrome presets are
  impossible; (2) `mixBlendMode` — composites unreliably over a native preview and, when
  ignored, an opaque black `saturation` layer is a black screen; (3) RN's `filter` prop — the
  above. Filtering live frames genuinely requires frame processors, i.e. vision-camera.
  What replaced it:
  - **New `DevelopScreen`** (`Develop: { sourceUri, filterId }`), sitting between Camera and
    Reveal. It shows the capture through a Skia `<Canvas>` with the **same** colour matrix, the
    same `FractalNoise` grain and the same vignette that `developPhoto` bakes in — so the
    preview is exact rather than approximate, and every develop slider updates it in real time.
    `prepareEditableImage` does the orientation and downscale once (to 1200px) and returns a
    `makeNonTextureImage()` CPU copy that outlives its surface; each slider frame is then a
    single GPU draw of that image with a colour filter, not a re-decode. Confirming re-runs the
    recipe at full resolution against the original capture.
  - **`CameraScreen` no longer filters anything.** `CameraView` sits at `absoluteFill` with
    nothing wrapping it; the only thing drawn over it is one plain translucent tint, capped
    low, explicitly a *hint* at the chosen filter. The manual drawer is now sensor-only (zoom,
    focus) and carries a line saying where exposure/contrast/warmth/grain went. Capture
    `replace`s into Develop, so the camera unmounts and releases its session before Skia starts
    GPU work.
  - This also resolves the concern flagged when destructive baking was chosen: the user now
    sees and adjusts the photograph *before* it is committed, instead of first meeting it on
    the card.
  - `FilterDef` lost its `preview` field and `buildPreviewFilter`/`buildPreviewTints` were
    deleted — dead code describing an abandoned approach is worse than none.
- **Camera layout: a `ScrollView` was eating half the screen.** Reported as "the square is
  squished to the top half and the filters are in the middle". Cause: React Native's
  `ScrollView` carries `flexGrow: 1, flexShrink: 1` in its own base style. When the filter strip
  became a horizontal `ScrollView` (to hold 15 presets rather than 5) it inherited that, so in
  the column it competed with the `flex: 1` viewfinder and took roughly half the vertical space.
  **`contentContainerStyle` cannot fix this** — the growth is on the ScrollView's own root, so
  it needs `style={{ flexGrow: 0 }}`. Applied here and to both ScrollViews on the develop
  screen, which had the same latent bug.
  While fixing it, the framing was also **wrong, not just off-centre**, and that is worth
  recording: the preview is full-bleed, expo-camera crops the capture to the preview's aspect
  (`CameraPhotoCapture.swift` uses `AVMakeRect(aspectRatio: previewSize, …)`), and `CardFace`
  then centre-crops that to a square. So the part of the picture that survives onto the card is
  the centre square of the **whole screen** — not the centre of an inset viewfinder box, which
  is where the old guide drew it. The inset box is gone; the guide is now two flexible scrims
  with a full-width square between them, which centres it exactly and shows the cut regions
  literally. Rule-of-thirds lines moved inside the square, since that is the frame being
  composed.
  `chrome` now has exactly two children (top bar, and one wrapper around the bottom group) so
  its `space-between` has a well-defined job.
  **Not touched: `ExportScreen`'s vertical `controls` ScrollView has the same `flexGrow: 1`
  against a `flex: 1` stage.** It hasn't been reported as wrong and the resulting split may be
  what makes that screen look right, so it was left alone rather than changed blind — but it is
  the same shape of bug and worth a look on device.
- **Grain preview was opaque static, and orientation was still being inferred.** Both from
  device testing.
  - **Static.** The develop screen's grain layer pinned the colour matrix's alpha to 1 and put
    the strength in `<Fill opacity>`, where the bake puts the strength *in the matrix's alpha*
    and composites with soft-light. So the preview drew fully opaque noise over the photo. It
    looked like "every filter is broken" because 8 of the 15 presets carry grain of their own.
    Fixed by exporting `grainColorMatrix`/`GRAIN_FREQUENCY`/`GRAIN_OCTAVES` from `develop.ts`
    and having both paths use them — one definition, so they cannot drift again. Note the
    failure mode is now benign: with the strength in the matrix, an unsupported blend mode
    degrades to a faint grey veil rather than to opaque static.
  - **Orientation, resolved empirically instead of by reading the tag.** Photos were coming out
    rotated 90°. The previous fix read the file's own EXIF tag, which was still the wrong basis:
    expo-camera's iOS path writes the JPEG through `UIImage.jpegData()`, which **bakes** the
    orientation into the pixels, and then stamps the *pre-baked* orientation into the file's
    EXIF anyway (`ExpoCameraUtils.data`). The result is a file with upright pixels and a tag
    saying to turn it — so honouring the tag rotated every portrait.
    New `resolveOrientation` compares two independent facts about the same file instead of
    trusting one claim: the **decoded pixel dimensions** against the **dimensions the capture
    API reported**. Agree → the pixels are already right, do nothing whatever the tag says.
    Transposed → really is on its side, turn it, and the tag chooses the direction (6 when it
    doesn't know). `sourceWidth`/`sourceHeight` are plumbed through the Develop route from
    `photo.width/height` and `asset.width/height`. **This is the standing rule: never rotate on
    a tag alone — measure.**
- **Filters now live in exactly one place.** The user asked, reasonably, why a filter could be
  picked on the camera *and* again after the shutter. Since a live-filtered viewfinder is
  impossible here, the camera's strip could never show what it did — two pickers where only the
  later one told the truth. The camera's filter strip and its `tint` hint are gone (and
  `FilterDef.tint` with them); the develop screen owns filters, and gained a **FILTERS / ADJUST**
  tab pair so both halves are visible rather than hidden behind an icon.
- **Grid toggle.** A `grid`/`grid-outline` button in the camera's top bar hides the crop scrims
  and rule-of-thirds lines, for framing against the whole sensor image. Asked for directly.
- **Camera zoom: pinch, shortcut stops, and tap-to-dismiss.** All three requested directly, and
  the previous round's fixes confirmed good on device.
  - **The zoom prop is exponential, and its scale is unknowable from JS.** expo-camera's iOS
    implementation is `device.videoZoomFactor = pow(device.activeFormat.videoMaxZoomFactor,
    zoom)` (`CameraSessionManager.updateZoom`), so magnification is `max ^ zoom` — but
    `videoMaxZoomFactor` has **no getter on `CameraView`**. New `src/camera/zoom.ts` holds the
    inverse (`log(factor) / log(max)`) and a single `ASSUMED_MAX_FACTOR` calibration constant.
    **The 1× stop is exact (zoom 0); the 2× stop and the pinch rate both depend on that guess
    and are approximate.** One constant to tune if it lands wrong on a device.
  - **0.5× is a lens change, not a zoom** — no amount of zoom makes a lens wider than it is. It
    switches `selectedLens` to the ultra-wide, and the stop is hidden when there isn't one
    (which is also correct on a phone with no ultra-wide). Caveat worth knowing:
    `getAvailableLenses` returns each device's **`localizedName`**, so identifying the ultra-wide
    means matching `/ultra/i` against a localised string. It fails safe — no match just hides
    the stop — but it will not work outside English.
  - **Pinch** is a root-level `Gesture.Pinch`, so it can start anywhere on the preview while
    single-finger taps still reach their own handlers. It is multiplicative in magnification
    (`zoom += log(scale) / log(max)`), which is what makes it feel even across the range given
    the exponential prop. The worklet captures only numbers, `Math` and `runOnJS` —
    `LN_MAX_FACTOR` is precomputed on the JS thread specifically so nothing calls an imported
    function from the UI runtime, which is the crash this codebase has already paid for once.
  - Lens availability is read in an effect keyed on the camera ref *and* `facing`, not from
    `onCameraReady` — that event can fire against a render where the ref hadn't been captured
    yet, and the front camera has different lenses. Flipping the camera clears the lens and zoom.
  - Tapping anywhere above the manual drawer closes it, via a `flex: 1` Pressable sitting
    between the top bar and the drawer in `chrome`'s column.
- **Process note.** `src/camera/filters.ts` was briefly corrupted by editing it with
  `Get-Content` + `Set-Content`: `Get-Content` reads as ANSI by default, so every em dash and
  curly quote round-tripped into mojibake. Repaired, and the whole of `src/` was swept for
  stray U+00E2 to confirm nothing else was hit. **Use the Edit tool for source files**, or pass
  `-Encoding utf8` to *both* halves of a PowerShell read/write.
- `npx tsc --noEmit` clean; both bundles build.

## Open decisions

- **"Look back" (random past-card recall) and a dedicated empty-first-run screen were
  dropped**, not carried over from the Everdot-era `LookBackScreen.tsx` /
  `EmptyFirstRunScreen.tsx` placeholders (both deleted). PLAN.md's screen list has no
  look-back feature and no separate empty-first-run screen — Today's spec is just
  face-down-card / streak / this-week's-row / CTA, and Binder is expected to handle its own
  empty state inline (step 5). This was an implicit removal made while rewiring navigation
  around PLAN.md's screen set, not an explicit product call — flag if look-back was meant to
  carry forward.
- **Navigation restructured**: `Open` tab removed; "Today" (was `Home`) and "Binder" (was
  `Collection`, screen itself unchanged — full Binder rebuild is step 5) are now the two
  tabs. Camera and Reveal are root-stack screens reached from Today's "pull today's card"
  CTA (`Camera`, pushed full-screen-modal) → `Reveal` (`navigation.replace`, so back doesn't
  re-enter the camera) → `navigation.reset` back to `Main` once "add to binder" writes the
  row. `set_reveals`/holo-odds/streak logic all reused unchanged per CLAUDE.md.
- **Vibe-tag + title now finalize together via one "Add to binder" write**, not
  write-on-chip-tap like the old Everdot flow — this matches PLAN.md's reveal/tag/title spec
  explicitly ("'Add to binder' writes the row once"). Vibe chip selection is now a toggle
  (tap again, or tap the skip/x chip, to clear) held in local state until the write.
- **Holo-foil pan-fallback and Binder scrolling.** `HoloFoil` exposes an `interactive` prop
  (default `true`) so grid/scroll contexts can skip attaching the pan gesture, since a
  `GestureDetector` Pan on every grid card could otherwise fight a parent `ScrollView`.
  Resolved in step 5: `BinderScreen.tsx`'s grid slots pass `interactive={false}` on
  `CardFace`; only Today/Reveal (single focal card) use the interactive default.
- **Mono font is the platform system monospace** (`Menlo` on iOS, `monospace` on Android),
  not a bundled custom font — no font-loading dependency (`expo-font`) is set up in this
  project yet. PLAN.md says "a mono font" without naming one; revisit if a specific bundled
  typeface is wanted for the date/rarity/card-number labels.
- **Binder's Set-complete order is newest-first in both Pages and Scroll modes** (index 0 =
  the current/most recent Set), rather than PLAN's more literal binder metaphor of paging
  forward from Set 1. Chosen so both view modes share one `sets` ordering and neither needs
  a scroll/page shim to jump initially to "now" — implicit call, flag if oldest-first is the
  intended flip-through-a-real-binder feel.
- ~~**Export's styled-capture resolution**~~ — RESOLVED. Styled exports now rasterize from a
  composite laid out at `EXPORT_WIDTH = 1080` (scaled down only for the preview), so they are
  1080px-wide images rather than upscaled screen previews. "Save raw photo instead" still
  hands over the untouched original, which is the one path PLAN.md calls out as
  full-resolution. Note the styled composite is still 1080px, not the photo's native
  resolution — that's a deliberate ceiling (it matches Instagram's short edge and keeps the
  off-screen layout cheap), not an oversight.
- **Export's entry point is now resolved by explicit instruction: reached only via the share
  icon in Card Detail's header**, not directly from Binder/Today anymore (superseded — the
  original "tap a filled card → Export directly" design, noted here as invented/unspecced,
  is no longer how the app works). Card Detail's *own* entry point (tap a filled Binder grid
  card, or tap Today's already-captured card) is still an invented, not-specced choice in the
  same sense the old Export entry point was — PLAN.md doesn't say how a user reaches Card
  Detail either. Flag if a different entry point was intended for Card Detail.
- **No dedicated "on-accent contrast" skin token exists.** Text/icons drawn on top of a
  `skin.shell.accent`-colored surface (primary button labels, the capture-button ring, etc.)
  reuse the fixed white `theme.colors.surface` rather than a skin-specific contrast color.
  This happens to read fine for all 4 current accents (gold/blue/orange/teal all support
  white text), but nothing enforces that for a future 5th skin — worth adding an explicit
  `shell.onAccent` token if/when a skin ships with a light or low-contrast accent color.
- **Skin selector's entry point was invented, not specced**, same situation as Export's.
  Implemented as a palette icon in `TodayScreen`'s header, chosen for parity with the old
  Everdot home-screen mockup's settings-gear placement (see `design-reference/home-
  screen.html`) even though that reference predates the Sets/skin concept entirely. Flag if
  a different location (e.g. inside Binder, or a dedicated Settings screen) was intended.
- **Filters bake destructively — decided by the user, with the trade-offs on the table.** The
  alternatives offered were keeping the original alongside a filtered derivative (~2x storage,
  fully re-editable) or storing parameters and applying them at render (no extra storage, but
  every surface would have to draw through Skia). Destructive was chosen. Two consequences
  follow and neither is a bug: **a filter can never be changed or removed after capture**, and
  there is no unfiltered negative behind the stored photo — which is why Export's toggle is now
  worded "Use the photo on its own" rather than "raw". A third consequence worth watching in
  real use: the develop pass runs *before* the reveal screen, so the user commits to a filter
  from the live preview and first sees the finished photograph on the card. If that turns out
  to feel wrong, the fix is a develop step on the reveal screen, which would require revisiting
  the destructive decision.
- **`react-native-vision-camera` is now the only route to a filtered viewfinder**, and the
  device testing above is the evidence. The user already chose "Skia now, VisionCamera after";
  what has changed is that this is no longer a nice-to-have. Frame processors are the *only*
  mechanism that can filter live camera frames — every JS-side compositing trick has now been
  tried and failed on hardware. It would also buy real sensor exposure compensation and a real
  tap-to-focus point (instead of the binary AF lock). It would still not buy manual ISO or
  shutter; no RN camera library exposes those. Cost is a full `CameraScreen` rewrite and a
  heavier native dependency. Worth noting the develop screen would remain useful either way —
  adjusting a photo after taking it is not merely a workaround.
- ~~**Manual camera's zoom/exposure controls are discrete tap-stops, not continuous drag
  sliders.**~~ — RESOLVED twice over: `Slider.tsx` made them real drag sliders, and the
  exposure/ISO question is settled by the develop pipeline above (exposure is real and acts on
  the still; ISO is gone from the UI rather than faked). Original note kept for the reasoning: (Separate from the exposure/ISO-being-fake question, which the user has now
  confirmed final — see the follow-up pass above.) PLAN.md says "sliders"; building a real
  draggable slider would mean either a new dependency (`@react-native-community/slider`) or a
  custom gesture-driven drag component. Given this step is explicitly post-MVP and
  lower-priority, `ManualCameraScreen.tsx` uses 5 tappable step-segments per control instead —
  functionally equivalent (still adjustable, still visual feedback) but not a literal slider.
  Revisit if a continuous drag interaction is specifically wanted.
- **Flagged, not guessed: the streak pip-row fill-count formula isn't specified in PLAN.md.**
  The mockup's sample data shows a 14-day streak with 5 of 7 pips filled, which doesn't match
  any obvious formula (`streak % 7` gives 0; `((streak-1) % 7) + 1` gives 7). Implemented as
  `((streak - 1) % 7) + 1` — a fresh multiple of 7 reads as a full row, consistent with
  `HOLO_STREAK_MILESTONE_DAYS` already meaning something every 7th day elsewhere in the app —
  but this is the most defensible reading, not a confirmed spec. The mockup's `{{ streak }}`
  value is very likely just illustrative placeholder data rather than proof of a specific
  formula, but worth confirming rather than assuming.
- **Flagged, not guessed: CardFace in the Binder grid vs. the mockup's actual grid-cell
  design.** Fix #3's instruction lists "Binder grid" as one of the screens the `CardFace`
  rebuild touches, which was followed literally (Binder grid slots still render full
  `CardFace`, just the corrected version). But the confirmed mockup source extracted in an
  earlier pass shows Binder's actual grid cells as a *simpler*, different component: photo +
  a small day label (e.g. "MON 10") + a vibe-color bottom bar — no title, no rarity label, no
  card number, unlike the full anatomy `CardFace` now renders. At small grid-slot sizes (the
  3-column layout puts slots around 100-110px wide), `CardFace`'s info plate — title, date/
  rarity row, and card number all in one ~30-45px-tall strip — will read as cramped in a way
  the mockup's grid cells don't, because the mockup's grid cells simply don't carry that much
  text at that size. Kept `CardFace` in the grid per the explicit instruction rather than
  guessing that a simplified thumbnail (matching Today's now-rebuilt "this week" row, which
  *is* that simpler style) was actually intended for Binder's grid too — but this is worth a
  direct decision rather than inferring it from "touches Binder grid" alone.
