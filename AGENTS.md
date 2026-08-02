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
