import { useMemo } from 'react';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import CardFace from '../components/CardFace';
import FaceDownCard from '../components/FaceDownCard';
import HardButton from '../components/HardButton';
import { useCards } from '../hooks/useCards';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import { withAlpha } from '../theme/color';
import { placeholderHatch } from '../theme/gradients';
import type { SkinTokens } from '../theme/skins';
import { useSkin } from '../theme/SkinContext';
import { theme } from '../theme/theme';
import { body, display, mono, s } from '../theme/typography';
import { displayThumb } from '../types/card';
import { formatTodayHeaderDate, todayDateKey } from '../utils/date';
import { getMondayOfWeek, getSetNumberForDate, getWeekDateKeys } from '../utils/sets';
import { computeDayStreak } from '../utils/streak';

// Today — mockup 2a. Reading top to bottom: mono date + "TODAY" in Archivo Black with the
// streak count opposite it, a 7-pip streak strip, the face-down card as the focal object with
// its two lines of copy, the single gold CTA, this week's row, and the tab bar.

type TodayNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

const STREAK_PIP_COUNT = 7;
const CARD_WIDTH = s(184);

export default function TodayScreen() {
  const navigation = useNavigation<TodayNavigationProp>();
  const { cards, loading } = useCards();
  const { skin } = useSkin();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(skin), [skin]);

  const today = todayDateKey();
  const todaysCard = cards.find((card) => card.date === today);
  const streak = computeDayStreak(cards);
  // Days filled toward the next 7-day holo milestone (HOLO_STREAK_MILESTONE_DAYS). A fresh
  // multiple of 7 reads as a full row. The mockup's sample pairing (14-day streak, 5 pips)
  // doesn't map to any formula, so it's very likely placeholder data — see AGENTS.md.
  const filledPips = streak === 0 ? 0 : ((streak - 1) % STREAK_PIP_COUNT) + 1;

  const cardsByDate = new Map(cards.map((card) => [card.date, card]));
  const weekDateKeys = getWeekDateKeys(getMondayOfWeek(new Date()));
  const earliestCardDate =
    cards.length > 0 ? cards.reduce((min, card) => (card.date < min ? card.date : min), cards[0].date) : today;
  const currentSetNumber = getSetNumberForDate(today, earliestCardDate);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + s(18) }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerDate}>{formatTodayHeaderDate(today)}</Text>
          <Text style={styles.headerTitle}>Today</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            hitSlop={12}
            style={styles.skinButton}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={s(17)} color={skin.shell.textSecondary} />
          </Pressable>
          <Text style={styles.streakCount}>{loading ? '—' : streak}</Text>
          <Text style={styles.streakLabel}>DAY STREAK</Text>
        </View>
      </View>

      <View style={styles.pipRow}>
        {Array.from({ length: STREAK_PIP_COUNT }, (_, index) => (
          <View key={index} style={[styles.pip, index < filledPips ? styles.pipFilled : styles.pipEmpty]} />
        ))}
      </View>

      <View style={styles.stage}>
        {todaysCard ? (
          <Animated.View entering={FadeIn.duration(300)}>
            <Pressable onPress={() => navigation.navigate('CardDetail', { cardId: todaysCard.id })}>
              <CardFace
                photoUri={todaysCard.photoUri}
                date={todaysCard.date}
                title={todaysCard.title}
                vibeType={todaysCard.vibeType}
                isHolo={todaysCard.isHolo}
                cardNumber={todaysCard.id}
                width={CARD_WIDTH}
              />
            </Pressable>
          </Animated.View>
        ) : (
          <FaceDownCard width={CARD_WIDTH} tilted float />
        )}

        <Animated.View entering={FadeInDown.duration(360).delay(80)} style={styles.stageCopy}>
          <Text style={styles.stageTitle}>
            {todaysCard ? "Today's card is kept." : "Today's card is blank."}
          </Text>
          <Text style={styles.stageSubtitle}>
            {todaysCard ? 'Come back tomorrow for the next pull.' : 'One photo, any time before midnight.'}
          </Text>
        </Animated.View>
      </View>

      <View style={styles.ctaRow}>
        {todaysCard ? (
          <HardButton
            label="View card"
            variant="secondary"
            depth={0}
            onPress={() => navigation.navigate('CardDetail', { cardId: todaysCard.id })}
          />
        ) : (
          <HardButton label="Pull today's card" onPress={() => navigation.navigate('Camera')} disabled={loading} />
        )}
      </View>

      <View style={styles.weekBlock}>
        <View style={styles.weekHeader}>
          <Text style={styles.weekLabel}>SET {currentSetNumber} · THIS WEEK</Text>
          <Pressable onPress={() => navigation.navigate('Binder')} hitSlop={10}>
            <Text style={styles.openBinderLink}>Open binder →</Text>
          </Pressable>
        </View>
        <View style={styles.weekRow}>
          {weekDateKeys.map((dateKey) => {
            const card = cardsByDate.get(dateKey);
            if (card) {
              return (
                <Pressable
                  key={dateKey}
                  style={styles.weekSlot}
                  onPress={() => navigation.navigate('CardDetail', { cardId: card.id })}
                >
                  <View style={[styles.weekThumb, placeholderHatch(withAlpha(skin.cardstock.inkRule, 0.13))]}>
                    <Image source={{ uri: displayThumb(card) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  </View>
                  <View
                    style={[
                      styles.weekThumbBar,
                      {
                        backgroundColor: card.vibeType
                          ? theme.colors.vibe[card.vibeType]
                          : withAlpha(skin.shell.textPrimary, 0.25),
                      },
                    ]}
                  />
                </Pressable>
              );
            }
            if (dateKey === today) {
              return (
                <Pressable key={dateKey} style={styles.weekSlot} onPress={() => navigation.navigate('Camera')}>
                  <View style={styles.weekSlotToday} />
                </Pressable>
              );
            }
            return (
              <View key={dateKey} style={styles.weekSlot}>
                <View style={dateKey > today ? styles.weekSlotFuture : styles.weekSlotMissed} />
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function createStyles(skin: SkinTokens) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: skin.shell.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      paddingHorizontal: s(22),
    },
    headerLeft: {
      flexShrink: 1,
    },
    headerDate: {
      ...mono(9.5, 0.18),
      color: skin.shell.accent,
    },
    headerTitle: {
      ...display(34, 0.95),
      color: skin.shell.textPrimary,
      marginTop: s(8),
    },
    headerRight: {
      alignItems: 'flex-end',
    },
    skinButton: {
      marginBottom: s(6),
    },
    streakCount: {
      ...display(26),
      color: skin.shell.highlight,
    },
    streakLabel: {
      ...mono(8.5, 0.14),
      color: skin.shell.textSecondary,
      marginTop: s(5),
    },
    pipRow: {
      flexDirection: 'row',
      gap: s(5),
      paddingHorizontal: s(22),
      paddingTop: s(14),
    },
    pip: {
      flex: 1,
      height: s(4),
      borderRadius: s(2),
    },
    pipFilled: {
      backgroundColor: skin.shell.highlight,
    },
    pipEmpty: {
      backgroundColor: withAlpha(skin.shell.textPrimary, 0.16),
    },
    stage: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: s(20),
      paddingHorizontal: s(22),
      paddingVertical: s(6),
    },
    stageCopy: {
      alignItems: 'center',
    },
    stageTitle: {
      ...body(15, 600, 1.35),
      color: skin.shell.textPrimary,
    },
    stageSubtitle: {
      ...body(12.5, 400, 1.45),
      color: skin.shell.textSecondary,
      marginTop: s(4),
    },
    ctaRow: {
      paddingHorizontal: s(22),
    },
    weekBlock: {
      paddingHorizontal: s(22),
      paddingTop: s(20),
      paddingBottom: s(4),
    },
    weekHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    weekLabel: {
      ...mono(9, 0.16),
      color: withAlpha(skin.shell.textPrimary, 0.45),
    },
    openBinderLink: {
      ...body(10.5, 600),
      color: skin.shell.accent,
    },
    weekRow: {
      flexDirection: 'row',
      gap: s(5),
      marginTop: s(10),
    },
    weekSlot: {
      flex: 1,
      aspectRatio: 5 / 7,
    },
    weekThumb: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: s(3),
      backgroundColor: skin.cardstock.photoPlaceholder,
      overflow: 'hidden',
    },
    weekThumbBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: s(3),
      borderBottomLeftRadius: s(3),
      borderBottomRightRadius: s(3),
    },
    weekSlotToday: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: s(3),
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: skin.shell.accent,
      backgroundColor: withAlpha(skin.shell.accent, 0.09),
    },
    weekSlotFuture: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: s(3),
      borderWidth: 1,
      borderColor: withAlpha(skin.shell.textPrimary, 0.13),
    },
    weekSlotMissed: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: s(3),
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: withAlpha(skin.shell.textPrimary, 0.13),
    },
  });
}
