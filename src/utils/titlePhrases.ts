// Starter phrase bank for the title field's "randomize" button (reveal/tag/title screen).
// Content, not logic — swap, trim, or expand freely. Source: CLAUDE.md.
export const TITLE_PHRASES: string[] = [
  'the light before the rest of it happened',
  'small good thing found in transit',
  'proof this day was real',
  'a version of today worth keeping',
  'what today looked like from here',
  "the part I'll want back later",
  'nothing much, and that was the point',
  'the ordinary thing that wasn\'t',
  'today, roughly',
  'this, apparently',
  "a moment that didn't ask for attention",
  'the thing I noticed on the way somewhere else',
  'kept anyway',
  'this is what stuck',
];

export function randomTitlePhrase(): string {
  return TITLE_PHRASES[Math.floor(Math.random() * TITLE_PHRASES.length)];
}
