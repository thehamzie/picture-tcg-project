@AGENTS.md

# CLAUDE.md

This is the Daily Pull rebuild (previously "Everdot" / picture-tcg-project). Read `PLAN.md`
first — it's the full spec. This file is working conventions plus a couple of things PLAN.md
points to but doesn't spell out.

## Conventions

- **Reuse before rewriting.** `src/utils/date.ts`, `src/utils/streak.ts`, and
  `src/utils/holo.ts` all carry over unchanged per PLAN.md — don't refactor them unless a new
  requirement genuinely forces it. Same goes for the permission-handling code in
  `PermissionsScreen.tsx` and the capture→flip→tag→write loop's data logic; the *screens* are
  being rebuilt, the *logic* mostly isn't.
- **Keep `set_reveals` separate from `cards`.** It's tracking UI state (has this been shown),
  not card data — don't fold it into the cards table.
- **Skins are tokens, not forks.** All four binder skins should read from one token
  structure (shell/page/cardstock/foil-ramp). If adding a screen requires a skin-specific
  code branch rather than a token lookup, that's a sign the token structure needs another
  layer, not that the screen needs per-skin variants.
- **Maintain a progress log as you go.** The previous version of this repo kept a running
  `## Progress` and `## Open decisions` log in `AGENTS.md` (imported here via `@AGENTS.md`)
  — decisions made implicitly by how something was built, not explicitly decided, were
  called out there specifically so they could be revisited. Keep doing that. Reset
  `AGENTS.md`'s content for this rebuild rather than appending to the old Everdot-era notes.

## Starter title-randomizer phrase bank

Placeholder data for the "randomize" button on the title field — swap, trim, or expand this
freely, it's content, not logic:

```
the light before the rest of it happened
small good thing found in transit
proof this day was real
a version of today worth keeping
what today looked like from here
the part I'll want back later
nothing much, and that was the point
the ordinary thing that wasn't
today, roughly
this, apparently
a moment that didn't ask for attention
the thing I noticed on the way somewhere else
kept anyway
this is what stuck
```

## Things to flag instead of guessing

- Reduced-motion behavior for the tilt-holo effect isn't specced — surface it as a question
  rather than picking a fallback unprompted.
- Exact copy/tone for empty states, onboarding text, and permission-priming screens hasn't
  been carried over from the old design references — check `design-reference/*.html` in the
  old repo for structure and pacing, but the wording itself is fair game to propose fresh
  given the new visual direction.
