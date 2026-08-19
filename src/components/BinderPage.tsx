import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { repeatingStripes } from '../theme/gradients';
import type { SkinTokens } from '../theme/skins';
import { useSkin } from '../theme/SkinContext';
import { SCALE } from '../theme/typography';

// The binder leaf itself, from mockup 2f. Three parts, and all three matter to the metaphor:
//
//   1. Two page edges peeking out to the right of the current page (`#241C15` at right:-2,
//      `#2C231A` at right:2), so the page reads as one leaf in a stack.
//   2. The cream page (radius 8, padding 14/14/12/28 — the extra left padding clears the rings).
//   3. Four punched ring holes down the left edge, with an inset shadow so they read as
//      holes rather than dots.

const RING_COUNT = 4;

type BinderPageProps = {
  children: ReactNode;
  /** Renders the stacked page edges on the right. Off in scroll mode, where pages stack. */
  showSpine?: boolean;
  /**
   * Sizes the page to its content instead of filling the parent. Pages mode gives each leaf
   * the full viewport height; scroll mode stacks them, so each must size to its own grid.
   */
  autoHeight?: boolean;
  /**
   * Scale factor for the page's own metrics. Defaults to the device scale; share templates
   * pass their own so the rings, padding and radius grow with the exported canvas instead of
   * staying phone-sized on a 1080px image.
   */
  unit?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

export default function BinderPage({
  children,
  showSpine = true,
  autoHeight = false,
  unit = SCALE,
  style,
  contentStyle,
}: BinderPageProps) {
  const { skin } = useSkin();
  const styles = useMemo(() => createStyles(skin, unit), [skin, unit]);

  return (
    <View style={[autoHeight ? styles.wrapperAuto : styles.wrapper, style]}>
      {showSpine && (
        <>
          <View style={styles.spineBack} />
          <View style={styles.spineFront} />
        </>
      )}
      <View style={[autoHeight ? styles.pageAuto : styles.page, contentStyle]}>
        <View style={styles.ringColumn} pointerEvents="none">
          {Array.from({ length: RING_COUNT }, (_, index) => (
            <View key={index} style={styles.ring} />
          ))}
        </View>
        {children}
      </View>
    </View>
  );
}

function createStyles(skin: SkinTokens, u: number) {
  const s = (value: number) => value * u;

  const halftone =
    skin.page.texture === 'halftone'
      ? repeatingStripes({ angleDeg: 45, color: 'rgba(58,46,30,0.05)', stripe: 1, period: 4 })
      : null;

  const pageBase = {
    borderRadius: s(8),
    backgroundColor: skin.page.background,
    paddingTop: s(14),
    paddingRight: s(14),
    paddingBottom: s(12),
    paddingLeft: s(28),
    overflow: 'hidden' as const,
    boxShadow: [{ offsetX: 0, offsetY: s(14), blurRadius: s(30), color: 'rgba(0,0,0,0.5)' }],
    ...halftone,
  };

  return StyleSheet.create({
    wrapper: {
      flex: 1,
      minHeight: 0,
    },
    wrapperAuto: {
      flexGrow: 0,
    },
    pageAuto: pageBase,
    spineBack: {
      position: 'absolute',
      right: -s(2),
      top: s(14),
      bottom: s(14),
      width: s(12),
      borderTopRightRadius: s(8),
      borderBottomRightRadius: s(8),
      backgroundColor: skin.page.spineBack,
    },
    spineFront: {
      position: 'absolute',
      right: s(2),
      top: s(8),
      bottom: s(8),
      width: s(12),
      borderTopRightRadius: s(8),
      borderBottomRightRadius: s(8),
      backgroundColor: skin.page.spine,
    },
    page: {
      ...pageBase,
      flex: 1,
      minHeight: 0,
    },
    ringColumn: {
      position: 'absolute',
      left: s(10),
      top: s(24),
      bottom: s(24),
      justifyContent: 'space-between',
    },
    ring: {
      width: s(9),
      height: s(9),
      borderRadius: s(4.5),
      backgroundColor: skin.page.ring,
      boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 2, color: 'rgba(0,0,0,0.8)', inset: true }],
    },
  });
}
