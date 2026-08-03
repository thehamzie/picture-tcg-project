# AGENTS.md

## Progress

- Onboarding carousel (`src/screens/OnboardingScreen.tsx`) is built: 3-step swipeable
  intro (photo concept, calendar concept, reminder time picker), feeding a chosen
  reminder hour/minute into the Permissions screen.
- Permission priming screen (`src/screens/PermissionsScreen.tsx`) is built and wired
  to real device permissions: camera (`expo-camera` `useCameraPermissions`) and
  media library (`expo-image-picker` `requestMediaLibraryPermissionsAsync`) on the
  camera step, and notifications (`requestNotificationPermission` +
  `scheduleDailyReminder` from `src/utils/notifications.ts`) on the notifications
  step. Each step has a "not now" skip that still advances the flow.
- Open card interaction (`src/screens/OpenCardScreen.tsx`) is built: after a photo
  is captured/imported it's held as a pending card (saved to disk, not yet in the
  `cards` table) while a face-down card flips via `react-native-reanimated` to
  reveal it. Holo rarity is resolved once, at flip time, by `resolveIsHolo`
  (`src/utils/holo.ts`) and only then is the row written with `insertCard`
  (`vibe_type` + `is_holo` included from the start, no separate update step).
  Vibe tagging is a row of 5 color chips + a "leave plain" skip, both of which
  finalize and write the card immediately. The revealed card face is rendered by
  the reusable `src/components/CardFace.tsx`, shared between the in-flow reveal
  and the "already captured today" static view.

## Open decisions

- **Day rollover is strict midnight, no forgiveness window.** Confirmed in
  `computeDayStreak` (`src/utils/streak.ts`): it checks today's date key, and if
  missing, backs off one calendar day before counting consecutive date keys
  backward. There's no grace period for a capture taken shortly after midnight
  that was "meant" for the previous day. **This was decided implicitly** (by
  writing the streak logic this way) rather than as an explicit product call —
  worth confirming it's the intended behavior before it's relied on elsewhere.
- **Notifications permission is requested during onboarding/first-run**, as the
  second step of `PermissionsScreen`, rather than deferred to a later point of
  engagement (e.g. after the user's first successful capture or streak). Deferred
  prompting was one option considered, but the current implementation asks upfront
  during the same flow as the camera permission. **This was an implicit decision**
  made by how the onboarding flow was built, not an explicit product decision —
  worth revisiting if upfront prompting hurts opt-in rates.
- **Holo odds are placeholder numbers.** `HOLO_STREAK_MILESTONE_DAYS` (7) and
  `HOLO_BASE_CHANCE` (0.08, an ~8% baseline pull on any non-milestone day) live
  in `src/utils/holo.ts` as standalone constants specifically so they're easy to
  retune once there's real data on how often players should pull a holo — no
  design rationale went into the exact numbers beyond "matches the 7-day streak
  milestone already used elsewhere" and "roughly one in twelve."
