// Holo rarity resolution — called once, at flip time, and the result is persisted to `is_holo`.
// Both knobs below are easy to tune later; they're not derived from anything else.
export const HOLO_STREAK_MILESTONE_DAYS = 7; // matches the streak milestone referenced in CLAUDE.md
export const HOLO_BASE_CHANCE = 0.08; // baseline odds of a holo pull on a non-milestone day

/** `streak` is the day count *after* today's card is counted (i.e. inclusive of opening today's card). */
export function resolveIsHolo(streak: number): boolean {
  const isMilestone = streak % HOLO_STREAK_MILESTONE_DAYS === 0;
  return isMilestone || Math.random() < HOLO_BASE_CHANCE;
}
