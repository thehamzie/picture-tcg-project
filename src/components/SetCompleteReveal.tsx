import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { withAlpha } from '../theme/color';
import type { SkinTokens } from '../theme/skins';
import { useSkin } from '../theme/SkinContext';
import { mono, s } from '../theme/typography';
import type { Card } from '../types/card';
import CardThumb from './CardThumb';

// Set-complete "pack reveal" — mockup 2g. The fan geometry is the design export's own
// `renderVals()`, reproduced exactly:
//
//   angles = [-30, -20, -10, 0, 10, 20, 30]
//   rot    = angles[i] * fan
//   lift   = (1 - |i - 3| / 3) * 12 * fan      (the middle card rises highest)
//   spread = (i - 3) * 6 * fan
//   scale  = 0.9 + 0.1 * fan
//   transform-origin: 50% 130%   → the cards pivot from a point below their own bottom edge,
//                                  which is what makes it read as a hand of cards rather than
//                                  a pile rotating in place.
//
// The mockup drives `fan` from a slider; here it plays itself once on entry and collapses on
// tap, then `onSettle` writes the `set_reveals` row so it never replays.

const FAN_ANGLES = [-30, -20, -10, 0, 10, 20, 30];
const CENTER_INDEX = 3;
const CARD_WIDTH = s(126);
const CARD_HEIGHT = s(172);
const ENTRANCE_DELAY_MS = 220;
const ENTRANCE_DURATION_MS = 700;
const SETTLE_DURATION_MS = 420;

type SetCompleteRevealProps = {
  dateKeys: string[];
  cards: (Card | null)[];
  active: boolean;
  onSettle: () => void;
};

export default function SetCompleteReveal({ dateKeys, cards, active, onSettle }: SetCompleteRevealProps) {
  const { skin } = useSkin();
  const styles = useMemo(() => createStyles(skin), [skin]);
  const fan = useSharedValue(0); // 0 = stacked, 1 = fully fanned

  useEffect(() => {
    if (!active) {
      fan.value = 0;
      return;
    }
    fan.value = withDelay(
      ENTRANCE_DELAY_MS,
      withTiming(1, { duration: ENTRANCE_DURATION_MS, easing: Easing.out(Easing.cubic) })
    );
  }, [active, fan]);

  function handleSettle() {
    fan.value = withTiming(
      0,
      { duration: SETTLE_DURATION_MS, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(onSettle)();
      }
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.stage}>
        {cards.map((card, index) => (
          <FannedCard
            key={dateKeys[index]}
            index={index}
            card={card}
            date={dateKeys[index]}
            fan={fan}
            onPress={handleSettle}
          />
        ))}
      </View>

      <Text style={styles.hint}>TAP ANY CARD TO OPEN</Text>
    </View>
  );
}

function FannedCard({
  index,
  card,
  date,
  fan,
  onPress,
}: {
  index: number;
  card: Card | null;
  date: string;
  fan: SharedValue<number>;
  onPress: () => void;
}) {
  const angle = FAN_ANGLES[index];
  const liftFactor = 1 - Math.abs(index - CENTER_INDEX) / CENTER_INDEX;

  const style = useAnimatedStyle(() => {
    const t = fan.value;
    return {
      // `transform-origin: 50% 130%` has no RN equivalent, so it's composed manually:
      // translate the pivot below the card, rotate, translate back.
      transform: [
        { translateY: CARD_HEIGHT * 0.8 },
        { rotate: `${angle * t}deg` },
        { translateY: -CARD_HEIGHT * 0.8 },
        { translateX: (index - CENTER_INDEX) * 6 * t },
        { translateY: -liftFactor * 12 * t },
        { scale: 0.9 + 0.1 * t },
      ],
      zIndex: 10 - Math.abs(index - CENTER_INDEX),
    };
  });

  return (
    <Animated.View style={[styles.fanSlot, style]}>
      <Pressable onPress={onPress}>
        <CardThumb
          photoUri={card?.photoUri ?? null}
          date={date}
          vibeType={card?.vibeType ?? null}
          isHolo={card?.isHolo ?? false}
          variant="fan"
          width={CARD_WIDTH}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fanSlot: {
    position: 'absolute',
    width: CARD_WIDTH,
  },
});

function createStyles(skin: SkinTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      minHeight: CARD_HEIGHT + s(90),
      alignItems: 'center',
      justifyContent: 'center',
    },
    stage: {
      flex: 1,
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
    },
    hint: {
      ...mono(8.5, 0.14),
      color: withAlpha(skin.page.ink, 0.5),
      position: 'absolute',
      bottom: s(12),
    },
  });
}
