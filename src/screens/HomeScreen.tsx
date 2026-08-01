import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCards } from '../hooks/useCards';
import type { TabParamList } from '../navigation/types';
import { theme } from '../theme/theme';
import { todayDateKey } from '../utils/date';
import { computeDayStreak } from '../utils/streak';

export default function HomeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();
  const { cards, loading } = useCards();

  const today = todayDateKey();
  const todaysCard = cards.find((card) => card.date === today);
  const streak = computeDayStreak(cards);
  const total = cards.length;

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Everdot</Text>

      <Pressable style={styles.heroCard} onPress={() => navigation.navigate('Open')}>
        <Text style={styles.heroTitle}>
          {loading ? ' ' : todaysCard ? "Today's card is captured" : "Today's card is waiting"}
        </Text>
        <Text style={styles.heroSubtitle}>{todaysCard ? 'See you tomorrow' : 'Open now →'}</Text>
      </Pressable>

      <View style={styles.statsRow}>
        <View style={styles.statTile}>
          <Text style={styles.statValue}>{streak}</Text>
          <Text style={styles.statLabel}>day streak</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statValue}>{total}</Text>
          <Text style={styles.statLabel}>total cards</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 20,
    gap: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  heroCard: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.cardShape.radiusFull,
    padding: 20,
    gap: 4,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.surface,
  },
  heroSubtitle: {
    fontSize: 14,
    color: theme.colors.surface,
    opacity: 0.85,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statTile: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.cardShape.radiusGrid,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  statLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
});
