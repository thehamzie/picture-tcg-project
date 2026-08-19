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
- **Manual camera's zoom/exposure controls are discrete tap-stops, not continuous drag
  sliders.** (Separate from the exposure/ISO-being-fake question, which the user has now
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
