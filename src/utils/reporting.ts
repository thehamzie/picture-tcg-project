import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';

// Crash reporting.
//
// This app's whole pitch is that nothing leaves the device, so this is the one thing that does
// and it is set up accordingly:
//
//   * It is **off unless a DSN is configured**. No DSN, no client, no network — which is the
//     state in development and in any build that hasn't been pointed at a project.
//   * It is **switchable by the user** and the switch is honoured in `beforeSend`, not merely
//     by not calling `init`. Turning it off stops events leaving mid-session.
//   * It sends **no photos, no titles, no tags, and no personal identifiers**. `sendDefaultPii`
//     is off, and `beforeSend` scrubs `file://` paths out of every string in the event —
//     those paths carry a card's date, which is the user's data.
//
// What it does send: the error, the stack, and the device/OS/app version needed to read it.
//
// Why it earns the exception: essentially every hard problem in this project's history —
// three separate crash theories before the real one, a worklet calling a non-worklet, a
// camera surface broken by a filter — took several rounds of guessing because a failure on a
// real device arrived as a description rather than a stack. Shipping to strangers without this
// means doing that again with no way to ask them what happened.

const DSN = (Constants.expoConfig?.extra as { sentryDsn?: string } | undefined)?.sentryDsn ?? '';

let started = false;
let enabled = true;

/** Whether reporting is even possible in this build. */
export function isReportingAvailable(): boolean {
  return DSN.length > 0;
}

/**
 * Starts the client. Safe to call when no DSN is configured — it simply does nothing, so
 * development builds never phone home and never warn about it.
 */
export function initReporting() {
  if (started || !isReportingAvailable()) return;
  started = true;

  Sentry.init({
    dsn: DSN,
    sendDefaultPii: false,
    // Diagnostics only. No performance tracing, no session replay, no profiling — none of it
    // is needed to read a crash and all of it sends more than a crash needs.
    tracesSampleRate: 0,
    enableAutoSessionTracking: false,
    beforeBreadcrumb: (breadcrumb) => {
      // Console breadcrumbs in this app routinely carry photo paths.
      if (breadcrumb.category === 'console') return null;
      return breadcrumb;
    },
    beforeSend: (event) => (enabled ? scrub(event) : null),
  });
}

/** Reflects the user's choice. Persisted by the caller; see `settingsRepository`. */
export function setReportingEnabled(next: boolean) {
  enabled = next;
}

/**
 * Reports a caught error. A no-op when reporting isn't configured, so call sites don't need to
 * care whether it is.
 */
export function reportError(error: unknown, context?: Record<string, string>) {
  if (!started || !enabled) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/**
 * Replaces any `file://…` path with a bare marker.
 *
 * Card photos are stored as `…/cards/2026-08-22.jpg`, so a raw path leaks the date of a card —
 * and file paths turn up in error messages from the file system, the image decoder and the
 * share sheet. Walking the event is cheap and means no call site has to remember this.
 */
function scrub<T>(value: T, depth = 0): T {
  if (depth > 8) return value;
  if (typeof value === 'string') {
    return value.replace(/file:\/\/\S+/g, '[file]') as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => scrub(entry, depth + 1)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = scrub(entry, depth + 1);
    }
    return out as unknown as T;
  }
  return value;
}
