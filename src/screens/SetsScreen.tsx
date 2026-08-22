import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { getAllRevealedSetDates } from '../db/setRevealsRepository';
import { useCards } from '../hooks/useCards';
import { useInstalledAt } from '../hooks/useInstalledAt';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import { withAlpha } from '../theme/color';
import type { SkinTokens } from '../theme/skins';
import { useSkin } from '../theme/SkinContext';
import { theme } from '../theme/theme';
import { body, display, mono, s } from '../theme/typography';
import { formatSetRange, todayDateKey } from '../utils/date';
import { buildSets, type SetSummary } from '../utils/sets';

// Sets — the third tab both the Today and Binder mockups show in their tab bar (TODAY /
// BINDER / SETS) but which no mockup renders. Designed here from the same tokens: an index of
// every week as a Set, newest first, with a 7-day completion strip in the day's own vibe
// colour. Tapping a row opens that Set's page in the Binder.

type SetsNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function SetsScreen() {
  const navigation = useNavigation<SetsNavigationProp>();
  const db = useSQLiteContext();
  const { cards, loading } = useCards();
  const installedAt = useInstalledAt();
  const { skin } = useSkin();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(skin), [skin]);
  const [revealedSetDates, setRevealedSetDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    getAllRevealedSetDates(db).then((dates) => {
      if (!cancelled) setRevealedSetDates(dates);
    });
    return () => {
      cancelled = true;
    };
  }, [db]);

  const sets = useMemo(() => {
    if (installedAt === null) return [];
    return [...buildSets(cards, installedAt)].reverse(); // newest first, this is an index
  }, [cards, installedAt]);

  const completeCount = sets.filter((set) => set.isComplete).length;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + s(16) }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sets</Text>
        <Text style={styles.headerMeta}>
          {sets.length} {sets.length === 1 ? 'SET' : 'SETS'} · {completeCount} COMPLETE
        </Text>
      </View>

      {loading || installedAt === null ? (
        <View style={styles.fill} />
      ) : sets.length === 0 || cards.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No sets yet</Text>
          <Text style={styles.emptyBody}>
            A set is one Monday-to-Sunday week. Your first card starts Set 1.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + s(20) }]}
          showsVerticalScrollIndicator={false}
        >
          {sets.map((set, index) => (
            <SetRow
              key={set.startDate}
              set={set}
              unopened={set.isComplete && !revealedSetDates.has(set.startDate)}
              styles={styles}
              index={index}
              accent={skin.shell.accent}
              onPress={() => navigation.navigate('Binder', { setStartDate: set.startDate })}
              onShare={
                set.cardCount > 0
                  ? () => navigation.navigate('Export', { setStartDate: set.startDate })
                  : undefined
              }
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function SetRow({
  set,
  unopened,
  styles,
  index,
  accent,
  onPress,
  onShare,
}: {
  set: SetSummary;
  unopened: boolean;
  styles: ReturnType<typeof createStyles>;
  index: number;
  accent: string;
  onPress: () => void;
  onShare?: () => void;
}) {
  const today = todayDateKey();

  return (
    <Animated.View entering={FadeInDown.duration(300).delay(Math.min(index, 8) * 40)}>
      <Pressable onPress={onPress} style={[styles.row, set.isComplete && styles.rowComplete]}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowSet}>Set {set.setNumber}</Text>
          <Text style={styles.rowRange}>{formatSetRange(set.startDate, set.dateKeys[6])}</Text>
        </View>

        <View style={styles.dayStrip}>
          {set.dateKeys.map((dateKey, dayIndex) => {
            const card = set.cards[dayIndex];
            return (
              <View
                key={dateKey}
                style={[
                  styles.dayPip,
                  card
                    ? { backgroundColor: card.vibeType ? theme.colors.vibe[card.vibeType] : styles.dayPipPlain.backgroundColor }
                    : dateKey === today
                      ? styles.dayPipToday
                      : dateKey > today
                        ? styles.dayPipFuture
                        : styles.dayPipMissed,
                ]}
              />
            );
          })}
        </View>

        <View style={styles.rowFooter}>
          <Text style={[styles.rowCount, set.isComplete && styles.rowCountComplete]}>
            {set.cardCount}/7{set.isComplete ? ' · COMPLETE' : ''}
          </Text>
          <View style={styles.rowActions}>
            {unopened && (
              <View style={styles.newChip}>
                <Text style={styles.newChipText}>UNOPENED</Text>
              </View>
            )}
            {onShare && (
              <Pressable
                onPress={onShare}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={`Share set ${set.setNumber}`}
              >
                <Ionicons name="share-outline" size={s(16)} color={accent} />
              </Pressable>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function createStyles(skin: SkinTokens) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: skin.shell.background,
    },
    fill: {
      flex: 1,
    },
    header: {
      paddingHorizontal: s(22),
    },
    headerTitle: {
      ...display(20),
      color: skin.shell.textPrimary,
    },
    headerMeta: {
      ...mono(9, 0.14),
      color: skin.shell.textSecondary,
      marginTop: s(6),
    },
    list: {
      paddingHorizontal: s(22),
      paddingTop: s(16),
      gap: s(10),
    },
    row: {
      borderRadius: s(10),
      backgroundColor: skin.shell.surface,
      padding: s(13),
      gap: s(10),
    },
    rowComplete: {
      boxShadow: [
        { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: withAlpha(skin.shell.accent, 0.45), inset: true },
      ],
    },
    rowHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    rowSet: {
      ...display(15),
      color: skin.shell.textPrimary,
    },
    rowRange: {
      ...mono(8.5, 0.12),
      color: skin.shell.textSecondary,
    },
    dayStrip: {
      flexDirection: 'row',
      gap: s(5),
    },
    dayPip: {
      flex: 1,
      height: s(6),
      borderRadius: s(3),
    },
    dayPipPlain: {
      backgroundColor: withAlpha(skin.shell.textPrimary, 0.55),
    },
    dayPipMissed: {
      backgroundColor: withAlpha(skin.shell.textPrimary, 0.12),
    },
    dayPipFuture: {
      backgroundColor: withAlpha(skin.shell.textPrimary, 0.06),
    },
    dayPipToday: {
      backgroundColor: withAlpha(skin.shell.accent, 0.45),
    },
    rowFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    rowCount: {
      ...mono(8.5, 0.12),
      color: skin.shell.textSecondary,
    },
    rowCountComplete: {
      color: skin.shell.accent,
    },
    rowActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s(10),
    },
    newChip: {
      paddingVertical: s(4),
      paddingHorizontal: s(8),
      borderRadius: s(12),
      backgroundColor: skin.shell.accent,
    },
    newChipText: {
      ...mono(7.5, 0.1),
      color: skin.shell.onAccent,
    },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: s(8),
      paddingHorizontal: s(32),
    },
    emptyTitle: {
      ...display(17, 1.2),
      color: skin.shell.textPrimary,
    },
    emptyBody: {
      ...body(12.5, 400, 1.45),
      color: skin.shell.textSecondary,
      textAlign: 'center',
    },
  });
}
