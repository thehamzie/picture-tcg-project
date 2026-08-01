import { FlatList, Image, StyleSheet, Text, View } from 'react-native';

import ScreenPlaceholder from '../components/ScreenPlaceholder';
import { useCards } from '../hooks/useCards';
import { theme } from '../theme/theme';
import type { Card } from '../types/card';

const NUM_COLUMNS = 3;
const GRID_GAP = 8;

function CardTile({ card }: { card: Card }) {
  return (
    <View style={styles.tile}>
      <Image source={{ uri: card.photoUri }} style={styles.tileImage} />
    </View>
  );
}

export default function CollectionScreen() {
  const { cards, loading } = useCards();

  if (loading) {
    return <ScreenPlaceholder title="Collection" />;
  }

  if (cards.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No cards yet — open today's card to start your collection.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={cards}
      keyExtractor={(card) => card.date}
      numColumns={NUM_COLUMNS}
      contentContainerStyle={styles.gridContent}
      columnWrapperStyle={styles.gridRow}
      renderItem={({ item }) => <CardTile card={item} />}
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  gridContent: {
    padding: GRID_GAP,
  },
  gridRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  tile: {
    flex: 1 / NUM_COLUMNS,
    aspectRatio: theme.cardShape.aspectRatio,
    borderRadius: theme.cardShape.radiusGrid,
    backgroundColor: theme.colors.cardMuted,
    overflow: 'hidden',
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: theme.colors.background,
  },
  emptyText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});
