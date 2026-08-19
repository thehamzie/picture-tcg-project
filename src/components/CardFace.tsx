import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import { readableInk, withAlpha } from '../theme/color';
import { placeholderHatch } from '../theme/gradients';
import type { SkinTokens } from '../theme/skins';
import { useSkin } from '../theme/SkinContext';
import { theme, vibeLabels, type VibeType } from '../theme/theme';
import { bodyRaw, displayRaw, monoRaw } from '../theme/typography';
import { formatCardDateLabel, formatMonoDateWithDay } from '../utils/date';
import { useIsCapturing } from './CaptureContext';
import HoloFoil from './HoloFoil';
import { useTilt } from './useTilt';

// The shared card anatomy, built to mockup 2e ("the card as an object"), whose own caption
// states the spec: "2px ink rule around the photo, date and rarity in mono, title in heavy
// caps, vibe chip bottom-left, set number bottom-right. Foil is two layers — a wide hue
// sweep driven by device tilt, plus a fixed 74° grain that only catches at an angle."
//
// Every dimension below is the mockup's own pixel value at its 250pt card width, scaled by
// `u = width / 250`, so the card holds its proportions at any size it's rendered.

const BASE_WIDTH = 250;

/** The card silhouette. A square photo window plus the info plate resolve to roughly 5:7. */
export const CARD_ASPECT = theme.cardShape.aspectRatio;

export type CardFaceOverlayToggles = {
  date?: boolean;
  title?: boolean;
  vibe?: boolean;
  cardNumber?: boolean;
};

type CardFaceProps = {
  photoUri: string;
  date: string;
  /** Optional; anywhere it would display, falls back to the date label (PLAN.md "Title flow"). */
  title?: string | null;
  vibeType: VibeType | null;
  isHolo: boolean;
  /** `cards.id` — doubles as the collection-wide card number. Null while mid-reveal. */
  cardNumber?: number | null;
  /** Rendered width in points. Height follows from the 5:7 silhouette. */
  width: number;
  /** Attaches tilt/pan reactivity + the card's own 3D tilt. Off for grids. */
  interactive?: boolean;
  /** Per-field visibility for Export's overlay toggles. All default true. */
  overlays?: CardFaceOverlayToggles;
  /** Whether a holo card renders its foil. Distinct from `isHolo`, which still sets the label. */
  showHoloSheen?: boolean;
  /** Drops the outer shadow — used when the card sits inside another shadowed container. */
  flat?: boolean;
  /**
   * How the vibe reads on the plate. The card-object-study mockup (2e) uses a labelled chip;
   * the smaller export preview (2h) reduces it to a bare 26x4 color bar.
   */
  vibeStyle?: 'chip' | 'bar';
};

export default function CardFace({
  photoUri,
  date,
  title,
  vibeType,
  isHolo,
  cardNumber = null,
  width,
  interactive = false,
  overlays,
  showHoloSheen = true,
  flat = false,
  vibeStyle = 'chip',
}: CardFaceProps) {
  const { skin } = useSkin();
  const capturing = useIsCapturing();
  const { fx, fy, panGesture, tiltStyle } = useTilt(interactive);
  const u = width / BASE_WIDTH;
  const styles = useMemo(() => createStyles(skin, u), [skin, u]);

  const showDate = overlays?.date ?? true;
  const showTitle = overlays?.title ?? true;
  const showVibe = overlays?.vibe ?? true;
  const showNumber = overlays?.cardNumber ?? true;
  const displayTitle = title?.trim() ? title.trim() : formatCardDateLabel(date);
  const showChipRow = (showVibe && vibeType) || (showNumber && cardNumber != null);

  const card = (
    <Animated.View
      style={[
        styles.card,
        { width, height: width / CARD_ASPECT },
        // `isolation` exists only to scope the foil's blend layer. During a snapshot the foil
        // isn't blending, and the extra compositing layer is itself a capture hazard.
        capturing ? null : styles.isolate,
        flat ? null : styles.cardShadow,
        interactive ? tiltStyle : null,
      ]}
    >
      <View style={styles.photoFrame}>
        <View style={[styles.photo, placeholderHatch(withAlpha(skin.cardstock.inkRule, 0.11), u)]}>
          <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        </View>
      </View>

      <View style={styles.infoPlate}>
        <View style={styles.infoTopRow}>
          {showDate ? <Text style={styles.dateLabel}>{formatMonoDateWithDay(date)}</Text> : <View />}
          <Text style={isHolo ? styles.rarityHolo : styles.rarityCommon}>
            {isHolo ? '◆ HOLO' : 'COMMON'}
          </Text>
        </View>

        {showTitle && (
          <Text style={styles.title} numberOfLines={2}>
            {displayTitle}
          </Text>
        )}

        {showChipRow ? (
          <View style={styles.chipRow}>
            {showVibe && vibeType ? (
              vibeStyle === 'bar' ? (
                <View style={[styles.vibeBar, { backgroundColor: theme.colors.vibe[vibeType] }]} />
              ) : (
                <View style={[styles.vibeChip, { backgroundColor: theme.colors.vibe[vibeType] }]}>
                  <Text style={[styles.vibeChipText, { color: readableInk(theme.colors.vibe[vibeType]) }]}>
                    {vibeLabels[vibeType]}
                  </Text>
                </View>
              )
            ) : null}
            {showNumber && cardNumber != null ? (
              <View style={styles.numberChip}>
                <Text style={styles.numberChipText}>{cardNumber}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {isHolo && showHoloSheen && (
        <HoloFoil
          foilRamp={skin.foilRamp}
          fx={interactive ? fx : undefined}
          fy={interactive ? fy : undefined}
          borderRadius={Math.round(12 * u)}
        />
      )}
    </Animated.View>
  );

  if (!interactive) return card;
  return <GestureDetector gesture={panGesture}>{card}</GestureDetector>;
}

function createStyles(skin: SkinTokens, u: number) {
  const ink = skin.cardstock.inkRule;
  return StyleSheet.create({
    card: {
      borderRadius: Math.round(12 * u),
      backgroundColor: skin.cardstock.base,
      paddingHorizontal: Math.round(11 * u),
      paddingTop: Math.round(11 * u),
      paddingBottom: Math.round(13 * u),
      // Mockup 2e: `inset 0 0 0 1px rgba(23,19,15,.15)` — the printed card's edge.
      boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: withAlpha(ink, 0.15), inset: true }],
    },
    isolate: {
      // Keeps the foil's `overlay` blend inside the card instead of blending with the screen.
      isolation: 'isolate',
    },
    cardShadow: {
      boxShadow: [
        { offsetX: 0, offsetY: 22 * u, blurRadius: 42 * u, color: 'rgba(0,0,0,0.55)' },
        { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: withAlpha(ink, 0.15), inset: true },
      ],
    },
    photoFrame: {
      borderWidth: Math.max(1, Math.round(2 * u)),
      borderColor: skin.cardstock.border,
      borderRadius: Math.round(4 * u),
      padding: Math.round(5 * u),
      backgroundColor: skin.cardstock.mat,
    },
    photo: {
      aspectRatio: 1,
      width: '100%',
      overflow: 'hidden',
      backgroundColor: skin.cardstock.photoPlaceholder,
      borderWidth: 1,
      borderColor: withAlpha(ink, 0.32),
    },
    infoPlate: {
      flex: 1,
      justifyContent: 'flex-start',
    },
    infoTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: Math.round(9 * u),
    },
    dateLabel: {
      ...monoRaw(9 * u, 0.12),
      color: withAlpha(ink, 0.6),
    },
    rarityHolo: {
      ...monoRaw(8.5 * u, 0.12),
      color: skin.foilRamp.labelColor,
    },
    rarityCommon: {
      ...monoRaw(8.5 * u, 0.12),
      color: withAlpha(ink, 0.45),
    },
    title: {
      ...displayRaw(15 * u, 1.15),
      color: ink,
      marginTop: Math.round(5 * u),
    },
    chipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Math.round(6 * u),
      marginTop: 'auto',
      paddingTop: Math.round(9 * u),
    },
    vibeChip: {
      paddingVertical: Math.round(5 * u),
      paddingHorizontal: Math.round(8 * u),
      borderRadius: Math.round(3 * u),
    },
    vibeChipText: bodyRaw(8.5 * u, 600),
    vibeBar: {
      // Mockup 2h's export preview: `width:26px;height:4px;border-radius:2px`.
      width: Math.round(26 * u),
      height: Math.round(4 * u),
      borderRadius: Math.round(2 * u),
    },
    numberChip: {
      paddingVertical: Math.round(5 * u),
      paddingHorizontal: Math.round(8 * u),
      borderRadius: Math.round(3 * u),
      backgroundColor: withAlpha(ink, 0.08),
    },
    numberChipText: {
      ...monoRaw(8.5 * u, 0.1),
      color: withAlpha(ink, 0.55),
    },
  });
}

