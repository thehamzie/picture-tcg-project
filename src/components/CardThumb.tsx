import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { withAlpha } from '../theme/color';
import { placeholderHatch } from '../theme/gradients';
import type { SkinTokens } from '../theme/skins';
import { useSkin } from '../theme/SkinContext';
import { theme, type VibeType } from '../theme/theme';
import { monoRaw, SCALE } from '../theme/typography';
import { formatGridDayLabel } from '../utils/date';
import HoloFoil from './HoloFoil';

// The small card, as it actually appears in the binder grid (2f) and the set-complete fan
// (2g). It is deliberately NOT the full `CardFace` anatomy: the mockup's grid cells carry a
// photo, a day label, and a vibe bar — no title, no rarity line, no card number, because at
// ~100pt wide none of that would read. AGENTS.md flagged this as an open question; the
// extracted mockup settles it.
//
//   grid cell (2f): radius 6, bg cardstock, padding 5, shadow 0 4px 10px rgba(23,19,15,.28)
//                   photo aspect 5/6, then a row of "MON 10" + a 16x4 vibe bar
//   fan card (2g):  radius 8, bg cardstock, padding 6, photo aspect 5/6, full-width 4px bar

// The mockup's grid cell is ~86pt wide inside its page, which is the reference the padding,
// radius, label size and vibe bar below are all quoted at.
const BASE_WIDTH = 86;

type CardThumbProps = {
  photoUri: string | null;
  date: string;
  vibeType: VibeType | null;
  isHolo: boolean;
  variant?: 'grid' | 'fan';
  /**
   * Width in points; the cell's height follows from its content. Internal metrics scale with
   * it, so the same component is correct at a 90pt binder slot and at a 300pt export cell —
   * without it, share templates rendered at export resolution would have device-sized text.
   */
  width?: number;
  /** Hides the day label — used by templates that carry their own captions. */
  showDayLabel?: boolean;
};

export default function CardThumb({
  photoUri,
  date,
  vibeType,
  isHolo,
  variant = 'grid',
  width,
  showDayLabel = true,
}: CardThumbProps) {
  const { skin } = useSkin();
  // Falls back to the device scale when rendered without an explicit width, which reproduces
  // the previous `s()`-based sizing exactly.
  const u = width != null ? width / BASE_WIDTH : SCALE;
  const styles = useMemo(() => createStyles(skin, variant, u), [skin, variant, u]);
  const vibeColor = vibeType ? theme.colors.vibe[vibeType] : withAlpha(skin.cardstock.inkRule, 0.18);

  return (
    <View style={[styles.cell, width != null ? { width } : null]}>
      <View style={[styles.photo, placeholderHatch(withAlpha(skin.cardstock.inkRule, 0.12), u)]}>
        {photoUri && <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
      </View>

      {variant === 'grid' && showDayLabel ? (
        <View style={styles.metaRow}>
          <Text style={styles.dayLabel}>{formatGridDayLabel(date)}</Text>
          <View style={[styles.vibeBarShort, { backgroundColor: vibeColor }]} />
        </View>
      ) : (
        <View style={[styles.vibeBarFull, { backgroundColor: vibeColor }]} />
      )}

      {isHolo && <HoloFoil foilRamp={skin.foilRamp} borderRadius={(variant === 'grid' ? 6 : 8) * u} />}
    </View>
  );
}

function createStyles(skin: SkinTokens, variant: 'grid' | 'fan', u: number) {
  const ink = skin.cardstock.inkRule;
  const isGrid = variant === 'grid';
  return StyleSheet.create({
    cell: {
      borderRadius: (isGrid ? 6 : 8) * u,
      backgroundColor: skin.cardstock.base,
      padding: (isGrid ? 5 : 6) * u,
      overflow: 'hidden',
      boxShadow: isGrid
        ? [{ offsetX: 0, offsetY: 4 * u, blurRadius: 10 * u, color: withAlpha(ink, 0.28) }]
        : [{ offsetX: 0, offsetY: 8 * u, blurRadius: 18 * u, color: withAlpha(ink, 0.32) }],
    },
    photo: {
      width: '100%',
      aspectRatio: 5 / 6,
      backgroundColor: skin.cardstock.photoPlaceholder,
      borderWidth: Math.max(1, u * 0.9),
      borderColor: withAlpha(ink, 0.28),
      overflow: 'hidden',
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 5 * u,
    },
    dayLabel: {
      ...monoRaw(7.5 * u),
      color: withAlpha(ink, 0.55),
    },
    vibeBarShort: {
      width: 16 * u,
      height: 4 * u,
      borderRadius: 2 * u,
    },
    vibeBarFull: {
      height: 4 * u,
      borderRadius: 2 * u,
      marginTop: 6 * u,
    },
  });
}
