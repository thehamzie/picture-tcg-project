import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent, ViewToken } from 'react-native';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp, RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import BinderPage from '../components/BinderPage';
import CardThumb from '../components/CardThumb';
import HardButton from '../components/HardButton';
import SetCompleteReveal from '../components/SetCompleteReveal';
import { getAllRevealedSetDates, markSetRevealed } from '../db/setRevealsRepository';
import { useCards } from '../hooks/useCards';
import { useInstalledAt } from '../hooks/useInstalledAt';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import { withAlpha } from '../theme/color';
import type { SkinTokens } from '../theme/skins';
import { useSkin } from '../theme/SkinContext';
import { body, display, mono, s } from '../theme/typography';
import { displayThumb } from '../types/card';
import { formatCardDateLabel, formatGridDayLabel, formatSetRange, todayDateKey } from '../utils/date';
import * as haptics from '../utils/haptics';
import { buildSets, type SetSummary } from '../utils/sets';

// Binder — mockup 2f. The page-by-page mode is the default: one Set per binder leaf, with the
// stacked page edges on the right and the punched rings on the left (see BinderPage).
//
// Ordering is oldest → newest, opening on the newest page. The mockup's own footer settles
// this — it reads "◀ SET 32 … SET 34 ▶", so paging right moves forward in time, which is how
// a physical binder flips. (AGENTS.md previously recorded newest-first as an open decision.)
//
// Both modes are virtualized. They used to be plain ScrollViews holding every Set at once,
// which mounted seven card images per Set for the whole history — a year in is 52 pages and
// 365 decoded photos resident at all times. FlatList keeps a few pages either side of the one
// being read, and the grid draws thumbnails rather than full captures.

type BinderNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

type ViewMode = 'pages' | 'scroll';

const GRID_COLUMNS = 3;
const GRID_GAP = s(8);
const MAX_DOTS = 5;

export default function BinderScreen() {
  const navigation = useNavigation<BinderNavigationProp>();
  const route = useRoute<RouteProp<TabParamList, 'Binder'>>();
  const db = useSQLiteContext();
  const { cards, loading } = useCards();
  const installedAt = useInstalledAt();
  const { skin } = useSkin();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(skin), [skin]);

  const [viewMode, setViewMode] = useState<ViewMode>('pages');
  const [revealedSetDates, setRevealedSetDates] = useState<Set<string> | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);
  const [scrollFocusIndex, setScrollFocusIndex] = useState(0);
  const pagerRef = useRef<FlatList<SetSummary> | null>(null);
  const didInitialScroll = useRef(false);

  // FlatList rejects a changing `onViewableItemsChanged`, so it is pinned in a ref. Scroll mode
  // uses it to decide which Set is "being read", which is what gates the set-complete reveal.
  const handleViewableChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setScrollFocusIndex(first.index);
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 55 }).current;

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
    return buildSets(cards, installedAt); // oldest first, matching the mockup's page order
  }, [cards, installedAt]);

  // Open on the newest Set, or on the one the Sets tab asked for.
  const requestedSetStart = route.params?.setStartDate;
  const targetIndex = useMemo(() => {
    if (requestedSetStart) {
      const found = sets.findIndex((set) => set.startDate === requestedSetStart);
      if (found >= 0) return found;
    }
    return Math.max(0, sets.length - 1);
  }, [requestedSetStart, sets]);

  useEffect(() => {
    if (viewMode !== 'pages' || pageWidth === 0 || sets.length === 0) return;
    if (didInitialScroll.current && !requestedSetStart) return;
    didInitialScroll.current = true;
    pagerRef.current?.scrollToOffset({ offset: targetIndex * pageWidth, animated: false });
    setPageIndex(targetIndex);
  }, [viewMode, pageWidth, sets.length, targetIndex, requestedSetStart]);

  const handleSettle = useCallback(
    async (setStartDate: string) => {
      await markSetRevealed(db, setStartDate);
      setRevealedSetDates((prev) => new Set(prev).add(setStartDate));
    },
    [db]
  );

  function handlePagerScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const width = pageWidth || event.nativeEvent.layoutMeasurement.width;
    if (!width) return;
    setPageIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  }

  function goToPage(index: number) {
    if (index < 0 || index >= sets.length || !pageWidth) return;
    haptics.tap();
    pagerRef.current?.scrollToOffset({ offset: index * pageWidth, animated: true });
    setPageIndex(index);
  }

  const scrollModeSets = useMemo(() => [...sets].reverse(), [sets]);

  const totalCards = cards.length;
  const ready = !loading && installedAt !== null && revealedSetDates !== null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + s(16) }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Binder</Text>
          <Text style={styles.headerMeta}>
            {totalCards} {totalCards === 1 ? 'CARD' : 'CARDS'} · {sets.length}{' '}
            {sets.length === 1 ? 'SET' : 'SETS'}
          </Text>
        </View>
        <View style={styles.toggle}>
          {(['pages', 'scroll'] as ViewMode[]).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => setViewMode(mode)}
              style={[styles.togglePill, viewMode === mode && styles.togglePillActive]}
            >
              <Text style={[styles.toggleText, viewMode === mode && styles.toggleTextActive]}>
                {mode.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {!ready ? (
        <View style={styles.stageFill} />
      ) : cards.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Your binder starts today</Text>
          <Text style={styles.emptySubtitle}>
            Every card you pull adds a slot to this week&apos;s page.
          </Text>
          <HardButton
            label="Pull your first card"
            onPress={() => navigation.navigate('Camera')}
            style={styles.emptyButton}
          />
        </View>
      ) : viewMode === 'pages' ? (
        <View style={styles.pagerArea} onLayout={(event) => setPageWidth(event.nativeEvent.layout.width)}>
          {pageWidth > 0 && (
            <FlatList
              ref={pagerRef}
              data={sets}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handlePagerScrollEnd}
              keyExtractor={(set) => set.startDate}
              // Every page is exactly the viewport's width, so the offsets are known without
              // measuring — which is what lets the binder open directly on the newest Set
              // instead of scrolling there after layout.
              getItemLayout={(_, index) => ({
                length: pageWidth,
                offset: pageWidth * index,
                index,
              })}
              initialScrollIndex={targetIndex}
              initialNumToRender={1}
              windowSize={3}
              removeClippedSubviews
              renderItem={({ item, index }) => (
                <View style={{ width: pageWidth }}>
                  <View style={styles.pageInset}>
                    <SetPage
                      set={item}
                      isFocused={index === pageIndex}
                      revealed={revealedSetDates.has(item.startDate)}
                      onSettle={handleSettle}
                      navigation={navigation}
                      footer={
                        <PageFooter
                          styles={styles}
                          previousSet={sets[index - 1]}
                          nextSet={sets[index + 1]}
                          index={index}
                          total={sets.length}
                          onGo={goToPage}
                        />
                      }
                    />
                  </View>
                </View>
              )}
            />
          )}
        </View>
      ) : (
        <FlatList
          style={styles.stageFill}
          contentContainerStyle={styles.scrollContent}
          data={scrollModeSets}
          keyExtractor={(set) => set.startDate}
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={handleViewableChanged}
          viewabilityConfig={viewabilityConfig}
          initialNumToRender={2}
          windowSize={5}
          removeClippedSubviews
          renderItem={({ item, index }) => (
            <View style={styles.scrollSection}>
              <SetPage
                set={item}
                isFocused={index === scrollFocusIndex}
                revealed={revealedSetDates.has(item.startDate)}
                onSettle={handleSettle}
                navigation={navigation}
                showSpine={false}
                fixedHeight={false}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}

function SetPage({
  set,
  isFocused,
  revealed,
  onSettle,
  navigation,
  footer,
  showSpine = true,
  fixedHeight = true,
}: {
  set: SetSummary;
  isFocused: boolean;
  revealed: boolean;
  onSettle: (startDate: string) => void;
  navigation: BinderNavigationProp;
  footer?: React.ReactNode;
  showSpine?: boolean;
  fixedHeight?: boolean;
}) {
  const { skin } = useSkin();
  const styles = useMemo(() => createStyles(skin), [skin]);
  const [gridWidth, setGridWidth] = useState(0);
  const today = todayDateKey();

  // RN's flexbox `gap` isn't subtracted from a percentage child's own width, so 3 items at a
  // percentage plus 2 gaps overflow the row. Measuring and computing an exact pixel slot
  // width is what makes the grid wrap into clean rows of 3.
  const slotWidth = gridWidth > 0 ? (gridWidth - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS : undefined;

  // A complete-but-unrevealed Set takes the whole page over, matching mockup 2g: the banner
  // and date range replace the normal page header, the grid is replaced by the fan, and the
  // page-turn footer is suppressed until it settles.
  if (set.isComplete && !revealed) {
    return (
      <View style={styles.revealWrapper}>
        <View style={styles.revealHeader}>
          <Text style={styles.revealBanner}>SET {set.setNumber} COMPLETE · 7/7</Text>
          <Text style={styles.revealRange}>{formatSetRange(set.startDate, set.dateKeys[6])}</Text>
        </View>
        <BinderPage showSpine={false} autoHeight={!fixedHeight}>
          <SetCompleteReveal
            dateKeys={set.dateKeys}
            cards={set.cards}
            active={isFocused}
            onSettle={() => onSettle(set.startDate)}
          />
        </BinderPage>
        <View style={styles.revealFooter}>
          <Text style={styles.revealFooterTitle}>A full week, sealed and kept.</Text>
          <Text style={styles.revealFooterBody}>Plays once, only when you come back to it.</Text>
        </View>
      </View>
    );
  }

  return (
    <BinderPage showSpine={showSpine} autoHeight={!fixedHeight}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageSetLabel}>Set {set.setNumber}</Text>
        <View style={styles.pageHeaderRight}>
          <Text style={styles.pageRange}>
            {formatSetRange(set.startDate, set.dateKeys[6])} · {set.cardCount}/7
          </Text>
          {set.cardCount > 0 && (
            <Pressable
              onPress={() => navigation.navigate('Export', { setStartDate: set.startDate })}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`Share set ${set.setNumber}`}
            >
              <Ionicons name="share-outline" size={s(15)} color={skin.page.ink} />
            </Pressable>
          )}
        </View>
      </View>

      {(
        <Animated.View entering={FadeIn.duration(240)} style={styles.grid} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
          {set.dateKeys.map((dateKey, dayIndex) => {
            const card = set.cards[dayIndex];
            if (card) {
              return (
                <Pressable
                  key={dateKey}
                  style={slotWidth != null ? { width: slotWidth } : styles.slotFallback}
                  accessibilityRole="button"
                  accessibilityLabel={[
                    card.title?.trim() || formatCardDateLabel(card.date),
                    formatGridDayLabel(dateKey),
                    card.isHolo ? 'holo' : null,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  onPress={() => {
                    haptics.tap();
                    navigation.navigate('CardDetail', { cardId: card.id });
                  }}
                >
                  <CardThumb
                    photoUri={displayThumb(card)}
                    date={card.date}
                    vibeType={card.vibeType}
                    isHolo={card.isHolo}
                    width={slotWidth}
                  />
                </Pressable>
              );
            }
            const style = [
              styles.emptySlot,
              slotWidth != null ? { width: slotWidth } : styles.slotFallback,
              dateKey === today && styles.emptySlotToday,
            ];
            if (dateKey === today) {
              return (
                <Pressable
                  key={dateKey}
                  style={style}
                  onPress={() => navigation.navigate('Camera')}
                  accessibilityRole="button"
                  accessibilityLabel="Pull today's card"
                >
                  <Text style={styles.emptySlotPlus}>+</Text>
                </Pressable>
              );
            }
            return <View key={dateKey} style={style} />;
          })}
          {/* The mockup's page always shows 9 cells: 7 days plus two dashed fillers. */}
          <View style={[styles.emptySlot, slotWidth != null ? { width: slotWidth } : styles.slotFallback]} />
          <View style={[styles.emptySlot, slotWidth != null ? { width: slotWidth } : styles.slotFallback]} />
        </Animated.View>
      )}

      {footer}
    </BinderPage>
  );
}

function PageFooter({
  styles,
  previousSet,
  nextSet,
  index,
  total,
  onGo,
}: {
  styles: ReturnType<typeof createStyles>;
  previousSet?: SetSummary;
  nextSet?: SetSummary;
  index: number;
  total: number;
  onGo: (index: number) => void;
}) {
  // A windowed dot strip — the mockup shows three, which only works for a three-Set binder.
  const windowStart = Math.max(0, Math.min(index - Math.floor(MAX_DOTS / 2), total - MAX_DOTS));
  const dotCount = Math.min(MAX_DOTS, total);

  return (
    <View style={styles.pageFooter}>
      <Pressable onPress={() => onGo(index - 1)} disabled={!previousSet} hitSlop={10}>
        <Text style={[styles.pageNavLabel, !previousSet && styles.pageNavDisabled]}>
          {previousSet ? `◀ SET ${previousSet.setNumber}` : ' '}
        </Text>
      </Pressable>
      <View style={styles.dotRow}>
        {Array.from({ length: dotCount }, (_, dot) => (
          <View
            key={dot}
            style={[styles.dot, windowStart + dot === index && styles.dotActive]}
          />
        ))}
      </View>
      <Pressable onPress={() => onGo(index + 1)} disabled={!nextSet} hitSlop={10}>
        <Text style={[styles.pageNavLabel, !nextSet && styles.pageNavDisabled]}>
          {nextSet ? `SET ${nextSet.setNumber} ▶` : ' '}
        </Text>
      </Pressable>
    </View>
  );
}

function createStyles(skin: SkinTokens) {
  const pageInk = skin.page.ink;
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: skin.shell.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
    toggle: {
      flexDirection: 'row',
      padding: s(3),
      borderRadius: s(20),
      backgroundColor: withAlpha(skin.shell.textPrimary, 0.1),
    },
    togglePill: {
      paddingVertical: s(7),
      paddingHorizontal: s(10),
      borderRadius: s(16),
    },
    togglePillActive: {
      backgroundColor: skin.shell.accent,
    },
    toggleText: {
      ...mono(8.5, 0.1),
      color: skin.shell.textSecondary,
    },
    toggleTextActive: {
      color: skin.shell.onAccent,
    },
    stageFill: {
      flex: 1,
      minHeight: 0,
    },
    pagerArea: {
      flex: 1,
      minHeight: 0,
      marginTop: s(16),
    },
    pageInset: {
      flex: 1,
      paddingHorizontal: s(14),
    },
    revealWrapper: {
      flex: 1,
      minHeight: s(430),
    },
    revealHeader: {
      alignItems: 'center',
      paddingBottom: s(10),
    },
    revealBanner: {
      ...mono(9, 0.2),
      color: skin.shell.accent,
    },
    revealRange: {
      ...display(22, 1.1),
      color: skin.shell.textPrimary,
      marginTop: s(9),
    },
    revealFooter: {
      alignItems: 'center',
      paddingTop: s(14),
    },
    revealFooterTitle: {
      ...body(13, 600, 1.35),
      color: skin.shell.textPrimary,
    },
    revealFooterBody: {
      ...body(11.5, 400, 1.45),
      color: withAlpha(skin.shell.textPrimary, 0.45),
      marginTop: s(4),
    },
    scrollContent: {
      paddingHorizontal: s(14),
      paddingTop: s(16),
      paddingBottom: s(24),
      gap: s(18),
    },
    scrollSection: {
      minHeight: s(300),
    },
    pageHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    pageSetLabel: {
      ...display(15),
      color: pageInk,
    },
    pageHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s(10),
    },
    pageRange: {
      ...mono(8.5, 0.12),
      color: withAlpha(pageInk, 0.6),
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: GRID_GAP,
      marginTop: s(12),
      alignContent: 'flex-start',
    },
    slotFallback: {
      width: '31%',
    },
    emptySlot: {
      aspectRatio: 5 / 6.6,
      borderRadius: s(6),
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: withAlpha(pageInk, 0.22),
      backgroundColor: withAlpha(skin.cardstock.base, 0.35),
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptySlotToday: {
      borderColor: skin.shell.accent,
      borderStyle: 'dashed',
      backgroundColor: withAlpha(skin.shell.accent, 0.1),
    },
    emptySlotPlus: {
      ...display(16),
      color: skin.shell.accent,
    },
    pageFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 'auto',
      paddingTop: s(10),
    },
    pageNavLabel: {
      ...mono(8.5, 0.12),
      color: withAlpha(pageInk, 0.45),
    },
    pageNavDisabled: {
      opacity: 0,
    },
    dotRow: {
      flexDirection: 'row',
      gap: s(4),
    },
    dot: {
      width: s(5),
      height: s(5),
      borderRadius: s(2.5),
      backgroundColor: withAlpha(pageInk, 0.25),
    },
    dotActive: {
      backgroundColor: pageInk,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: s(10),
      paddingHorizontal: s(32),
    },
    emptyTitle: {
      ...display(17, 1.2),
      color: skin.shell.textPrimary,
      textAlign: 'center',
    },
    emptySubtitle: {
      ...body(12.5, 400, 1.45),
      color: skin.shell.textSecondary,
      textAlign: 'center',
    },
    emptyButton: {
      marginTop: s(8),
      alignSelf: 'stretch',
    },
  });
}
