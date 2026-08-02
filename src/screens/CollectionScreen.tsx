import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import ScreenPlaceholder from '../components/ScreenPlaceholder';
import { useCards } from '../hooks/useCards';
import { useInstalledAt } from '../hooks/useInstalledAt';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import { theme } from '../theme/theme';
import type { Card } from '../types/card';
import { formatMonthLabel, getMonthWeeks, type MonthCell } from '../utils/calendar';
import { todayDateKey } from '../utils/date';

const GRID_GAP = 5;
const SHIMMER_INTERVAL_MS = 600;

type CollectionNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

type DayState =
  | { kind: 'blank' }
  | { kind: 'missed' }
  | { kind: 'today'; card: Card | null }
  | { kind: 'filled'; card: Card };

function getDayState(
  dateKey: string,
  today: string,
  installedAt: string,
  card: Card | undefined
): DayState {
  if (dateKey === today) return { kind: 'today', card: card ?? null };
  if (card) return { kind: 'filled', card };
  if (dateKey > today || dateKey < installedAt) return { kind: 'blank' };
  return { kind: 'missed' };
}

export default function CollectionScreen() {
  const navigation = useNavigation<CollectionNavigationProp>();
  const { cards, loading } = useCards();
  const installedAt = useInstalledAt();
  const [viewedMonth, setViewedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [shimmerTick, setShimmerTick] = useState(0);

  const today = todayDateKey();
  const cardsByDate = useMemo(() => new Map(cards.map((card) => [card.date, card])), [cards]);
  const weeks = useMemo(
    () => getMonthWeeks(viewedMonth.getFullYear(), viewedMonth.getMonth()),
    [viewedMonth]
  );

  const hasHoloThisMonth = useMemo(
    () => weeks.some((week) => week.some((cell) => cell && cardsByDate.get(cell.dateKey)?.isHolo)),
    [weeks, cardsByDate]
  );

  useEffect(() => {
    if (!hasHoloThisMonth) return;
    const id = setInterval(() => setShimmerTick((tick) => tick + 1), SHIMMER_INTERVAL_MS);
    return () => clearInterval(id);
  }, [hasHoloThisMonth]);

  const vibeOrder = useMemo(() => {
    const order = new Map<string, number>();
    let index = 0;
    for (const week of weeks) {
      for (const cell of week) {
        if (!cell) continue;
        const card = cardsByDate.get(cell.dateKey);
        if (card?.vibeType) {
          order.set(cell.dateKey, index);
          index += 1;
        }
      }
    }
    return order;
  }, [weeks, cardsByDate]);

  if (loading || installedAt === null) {
    return <ScreenPlaceholder title="Collection" />;
  }

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const canGoNext = viewedMonth < currentMonthStart;

  function goToPrevMonth() {
    setViewedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }

  function goToNextMonth() {
    if (!canGoNext) return;
    setViewedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  function openToday() {
    navigation.navigate('Open');
  }

  function openLookBack() {
    navigation.navigate('LookBack');
  }

  function cellAccentColor(card: Card, dateKey: string): string | null {
    if (!card.vibeType) return null;
    if (!card.isHolo) return theme.colors.vibe[card.vibeType];
    const order = vibeOrder.get(dateKey) ?? 0;
    const colors = theme.holoShimmerColors;
    return colors[(shimmerTick + order) % colors.length];
  }

  function renderCellContent(cell: MonthCell) {
    if (!cell) return null;

    const card = cardsByDate.get(cell.dateKey);
    const state = getDayState(cell.dateKey, today, installedAt!, card);

    if (state.kind === 'blank') {
      return <View style={[styles.cell, styles.cellBlank]} />;
    }

    if (state.kind === 'missed') {
      return <View style={[styles.cell, styles.cellMissed]} />;
    }

    if (state.kind === 'today') {
      const activeCard = state.card;
      return (
        <Pressable style={[styles.cell, styles.cellToday]} onPress={openToday}>
          {activeCard && (
            <Image source={{ uri: activeCard.photoUri }} style={styles.cellImage} resizeMode="cover" />
          )}
          {!activeCard && <Text style={styles.plusIcon}>+</Text>}
          {activeCard?.isHolo && <Text style={styles.holoStar}>★</Text>}
          {activeCard ? (
            <View style={styles.dayNumberBackdrop}>
              <Text style={styles.dayNumber}>{cell.day}</Text>
            </View>
          ) : (
            <Text style={[styles.dayNumber, styles.dayNumberAccent, styles.dayNumberPlain]}>
              {cell.day}
            </Text>
          )}
        </Pressable>
      );
    }

    const filledCard = state.card;
    const accentColor = cellAccentColor(filledCard, cell.dateKey);
    return (
      <View style={[styles.cell, !accentColor && styles.cellUntyped]}>
        <Image source={{ uri: filledCard.photoUri }} style={styles.cellImage} resizeMode="cover" />
        {accentColor && <View style={[styles.cellAccentRing, { borderColor: accentColor }]} />}
        {filledCard.isHolo && <Text style={styles.holoStar}>★</Text>}
        <View style={styles.dayNumberBackdrop}>
          <Text style={styles.dayNumber}>{cell.day}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>your collection</Text>
        <Pressable onPress={openLookBack} hitSlop={8}>
          <Text style={styles.headerAction}>⟲</Text>
        </Pressable>
      </View>

      <View style={styles.monthNav}>
        <Pressable onPress={goToPrevMonth} hitSlop={8}>
          <Text style={styles.navArrow}>←</Text>
        </Pressable>
        <Text style={styles.monthLabel}>
          {formatMonthLabel(viewedMonth.getFullYear(), viewedMonth.getMonth())}
        </Text>
        <Pressable onPress={goToNextMonth} disabled={!canGoNext} hitSlop={8}>
          <Text style={[styles.navArrow, !canGoNext && styles.navArrowDisabled]}>→</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} style={styles.weekRow}>
            {week.map((cell, cellIndex) => (
              <View key={cell ? cell.dateKey : `${weekIndex}-${cellIndex}`} style={styles.cellSlot}>
                {renderCellContent(cell)}
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  headerAction: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  navArrow: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  navArrowDisabled: {
    opacity: 0.3,
  },
  monthLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  grid: {
    gap: GRID_GAP,
  },
  weekRow: {
    flexDirection: 'row',
    gap: GRID_GAP,
  },
  cellSlot: {
    flex: 1,
    aspectRatio: theme.cardShape.aspectRatio,
  },
  cell: {
    flex: 1,
    borderRadius: theme.cardShape.radiusGrid,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cellImage: {
    ...StyleSheet.absoluteFillObject,
  },
  cellAccentRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: theme.cardShape.radiusGrid,
    borderWidth: 2,
  },
  cellBlank: {
    backgroundColor: theme.colors.surface,
  },
  cellMissed: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
  },
  cellUntyped: {
    backgroundColor: theme.colors.surface,
    borderWidth: 0.5,
    borderColor: theme.colors.border,
  },
  cellToday: {
    borderWidth: 2,
    borderColor: theme.colors.accent,
  },
  plusIcon: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.accent,
  },
  holoStar: {
    position: 'absolute',
    top: 3,
    right: 4,
    fontSize: 9,
    color: theme.colors.surface,
  },
  dayNumberBackdrop: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    paddingHorizontal: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  dayNumber: {
    fontSize: 8,
    color: theme.colors.surface,
  },
  dayNumberAccent: {
    color: theme.colors.accent,
  },
  dayNumberPlain: {
    position: 'absolute',
    bottom: 2,
    right: 4,
  },
});
