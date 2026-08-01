// Vibe/type palette — see CLAUDE.md "Visual system"
export const vibeColors = {
  golden: '#BA7517',
  calm: '#1D9E75',
  together: '#D4537E',
  adventure: '#D85A30',
  cozy: '#7F77DD',
} as const;

export type VibeType = keyof typeof vibeColors;

export const vibeIcons: Record<VibeType, string> = {
  golden: 'sunny',
  calm: 'moon',
  together: 'heart',
  adventure: 'flash',
  cozy: 'cafe',
};

export const holoShimmerColors = Object.values(vibeColors);

export const neutral = {
  background: '#FAF9F7',
  surface: '#FFFFFF',
  cardMuted: '#E7E4DE',
  border: '#DEDAD2',
  textPrimary: '#22201D',
  textSecondary: '#6F6A62',
};

// Primary brand/accent color is an open decision (see CLAUDE.md "Open decisions").
// Placeholder only — borrowed from the "cozy" vibe until a real accent is chosen.
export const accent = vibeColors.cozy;

export const cardShape = {
  aspectRatio: 5 / 7,
  radiusGrid: 8,
  radiusFull: 12,
};

export const theme = {
  colors: {
    ...neutral,
    accent,
    vibe: vibeColors,
  },
  vibeIcons,
  holoShimmerColors,
  cardShape,
};

export type Theme = typeof theme;
