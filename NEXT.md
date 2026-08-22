# What's left

Handoff note, written 22 Aug 2026. `AGENTS.md` records *what was built and why*; this file
records *what hasn't been*. When something here gets done, delete it from here and add it to the
progress log there.

Current state in one line: the app is feature-complete for a first release, the camera has been
verified on a real device, and **nothing else has**.

---

## 1. Verify on a device — do this before building anything new

This is the highest-value item on the list and it's the only one that can't be done from a
keyboard. The camera went through five rounds of device feedback and **every round found a real
bug**. Everything below has had none.

### Backup round trip — do this one first

The archive format is hand-rolled (`src/utils/backup.ts`). The write path has never run on a
device and **the read path has never run at all**. If it's wrong, someone loses a collection.

A safe test that risks nothing:

1. Settings → **Back up everything** → save the file somewhere.
2. Immediately → **Restore from a backup** → pick that file.
   Expect: *"0 restored, N already in your binder"*. That proves the archive parses without
   touching your data.
3. Delete one card, restore again. It should come back with its title, tag and rarity.

### Then, in risk order

- **Share/export** — one card and one Set, a few templates each, at 1:1 and 9:16. Historically
  the crashiest path in this project (three separate crash investigations). Check the saved
  image is genuinely ~1080px wide, not a small upscale.
- **Binder at scale** — both Pages and Scroll modes. Virtualization, thumbnails and the
  background thumbnail backfill have only ever seen a handful of cards.
- **Set-complete reveal** — let a week fill up and check the fan animation fires once, then
  never again.
- **Card edit / delete**, **skin selector**, **onboarding + permissions**, **daily reminder**.
- **Android, at all.** Unclear whether any of this has run on Android. The orientation logic is
  measured rather than assumed so it should adapt, but that is a prediction, not a result.

---

## 2. Before either store

- [ ] **Privacy policy**, published at a reachable URL. Note the answer is no longer purely
      "nothing leaves the device" — crash reports do, if a DSN is configured. Say so.
- [ ] **Apple App Privacy** answers and **Google Data Safety** form.
- [ ] **Sentry DSN** into `expo.extra.sentryDsn` in `app.json`. Left empty, no client is created
      and nothing is sent — which is a perfectly valid way to ship, just undiagnosable.
- [ ] **`npm approve-scripts`** for `@sentry/cli` — its postinstall is currently blocked, which
      only affects source-map upload during EAS builds. Without it, stack traces arrive
      minified.
- [ ] **Confirm the bundle identifier.** `com.dailypull.app` for both platforms. Permanent once
      either store accepts a build.
- [ ] **EAS**: `eas login`, then a first build per platform. `eas.json` has development /
      preview / production profiles already.
- [ ] Screenshots, age rating, export compliance. The reveal flip and a full binder page are the
      two frames that sell it.

---

## 3. Product gaps, ranked

1. **Backfill a missed day.** The biggest gap left, and the most common reason people abandon a
   daily app — one forgotten evening currently kills a streak with no recourse, and the binder's
   "missed" slots are permanent holes. Proposed rule: fill from the library, but only with a
   photo whose EXIF capture date matches that day. Rescues the streak, can't be gamed, keeps the
   binder a true record. Also fixes a real inconsistency — the library import path currently
   accepts a photo from any date at all.
2. **Binder search / filter.** A year is 365 cards and the only navigation is paging through
   weeks. Filter by vibe, holo-only, jump to a month. The data is all there already.
3. **On this day.** One line on Today showing the card from a year ago. Cheap, and the only
   feature that rewards someone purely for having stayed.
4. **Year in review**, as 52 Sets. The Set mechanic already does the hard part. Most sellable
   thing the app can produce, and it lands in the same December window everyone else's does.
5. **Home screen widget.** For a once-a-day app the widget *is* the reminder, and it works for
   people who keep notifications off — which is most of them.
6. **Motion cards.** A second of video captured with the still; tilting the card in Card Detail
   plays it. The most trading-card idea available that no trading card can do.

### Smaller, known

- **Onboarding can't be re-run** once dismissed.
- **Timezone/travel and streaks.** Day keys come from the device's local date. Fly east and a
  long streak can end through no fault of the user. Strict local dates are defensible — this
  needs a *decision on the record*, not necessarily a change.
- **`ExportScreen`'s `controls` ScrollView** has `flexGrow: 1` competing with a `flex: 1` stage —
  the same bug class that squashed the camera layout. Left alone deliberately because that
  screen hasn't been reported as wrong and the resulting split may be what makes it look right.
  Check it during the smoke test.

---

## 4. Camera follow-ups

- **`react-native-vision-camera`** is the only route to a filtered live viewfinder, real sensor
  exposure compensation, and a real tap-to-focus point. Three JS-side approaches to live
  filtering have now failed on hardware (documented at the top of `CameraScreen.tsx` so they
  aren't retried). Costs a camera screen rewrite — and the camera currently works, which is
  worth weighing. The develop screen stays useful either way.
- **Tune `ASSUMED_MAX_FACTOR`** in `src/camera/zoom.ts`. expo-camera's zoom is
  `magnification = maxZoomFactor ^ zoom` and `maxZoomFactor` has no getter, so the **2× stop and
  the pinch rate are calibrated against a guess**. 1× and 0.5× are exact. One constant to adjust
  once you can see how far off 2× lands.
- **Ultra-wide detection is English-only.** `getAvailableLenses` returns each lens's *localized*
  name, so finding the ultra-wide means matching `/ultra/i` against a translated string. Fails
  safe (no match just hides the 0.5× button) but won't work in other locales.
- **Manual ISO and shutter speed are closed, not pending.** No React Native camera library
  exposes them, VisionCamera included.

---

## 5. Monetization — thought through, nothing built

The rule that keeps it additive: **never charge for anything that touches the daily record.**
Capture, develop, filters, reveal, holo, binder, sets, streaks, backup and restore stay free
forever with no limit. Charge for the collection's *surface area* instead.

- **Free**: the whole daily loop, all 15 filters, all develop controls, backup/restore, 3 binder
  skins, 5 share templates.
- **Collector's Edition, one-time (~£8.99)**: the other 5 skins, the other 8 templates, widgets,
  year in review, poster-resolution exports, backfill passes.
- **One payment, not a subscription.** The app has no servers, so a monthly fee has nothing to
  point at, and subscription fatigue is brutal in this category. Revisit only if cloud sync ships
  — that genuinely costs money every month and people accept paying for it.
- **The real business is prints.** A finished Set is seven cards. Printing it as an actual pack —
  or a year as a real binder — is the most on-brand thing this app could sell, has margins
  software doesn't, gates nothing, and can't be copied in a weekend.

---

## 6. Standing constraints — read before changing related code

Hard-won; each of these cost at least one debugging round.

- **Nothing may wrap or draw over the `CameraView` except plain translucent views.** Full
  reasoning at the top of `src/screens/CameraScreen.tsx`.
- **Never rotate an image on an EXIF tag alone — measure.** Decoded pixel dimensions vs. the
  dimensions the capture API reported. See `src/camera/exif.ts#resolveOrientation`.
- **`s()`, `body()`, `mono()`, `display()`, `withAlpha()` are JS-thread only.** Anything a
  worklet needs from them must be computed outside it.
- **A `ScrollView` carries `flexGrow: 1`.** Inside a flex column it will fight its siblings for
  space, and `contentContainerStyle` cannot fix it — it needs `style={{ flexGrow: 0 }}`.
- **Don't edit source files through PowerShell `Get-Content`/`Set-Content`.** It reads as ANSI by
  default and mangles every em dash and curly quote. Use the editor, or Node.
- **Filters bake destructively.** There is no unfiltered original behind a stored photo, and a
  filter can't be changed after the fact. Deliberate, but it constrains any future "edit photo"
  feature.
- **Restoring into a non-empty binder renumbers the incoming cards** (`cards.id` is
  AUTOINCREMENT). Restoring onto a fresh install preserves the original numbering.
- **`set_reveals` isn't in the backup**, so completed Sets replay their reveal animation after a
  restore. Arguably a feature; flagged so it isn't mistaken for a bug.
