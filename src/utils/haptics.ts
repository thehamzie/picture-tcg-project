import * as Haptics from 'expo-haptics';

// Haptics, in one place so the vocabulary stays consistent across screens rather than each one
// picking its own intensity.
//
// Every call is fire-and-forget and swallows its rejection: haptics are unavailable on
// simulators, on devices with the Taptic Engine disabled in accessibility settings, and on a
// fair number of Android handsets. None of that should ever surface as an error, and none of
// it should be awaited — a capture must not wait on a vibration.

const ignore = () => {};

/** Selecting one of a set: a filter swatch, a vibe chip, a skin, a template. */
export function selection() {
  Haptics.selectionAsync().catch(ignore);
}

/** A light acknowledgement — toggles, secondary buttons. */
export function tap() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(ignore);
}

/** The shutter, and the card turning over. The two moments that should feel physical. */
export function thud() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(ignore);
}

/** A card added to the binder, a Set settling into place. */
export function success() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore);
}

/** About to do something destructive. */
export function warn() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(ignore);
}

export function failure() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(ignore);
}
