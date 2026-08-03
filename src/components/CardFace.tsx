import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { theme, type VibeType } from '../theme/theme';
import { formatCardDateLabel } from '../utils/date';

const SHIMMER_INTERVAL_MS = 600;

type CardFaceProps = {
  photoUri: string;
  date: string;
  vibeType: VibeType | null;
  isHolo: boolean;
};

/** The revealed front of a card: photo, vibe frame/label, holo shimmer + star badge. */
export default function CardFace({ photoUri, date, vibeType, isHolo }: CardFaceProps) {
  const [shimmerTick, setShimmerTick] = useState(0);

  useEffect(() => {
    if (!isHolo) return;
    const id = setInterval(() => setShimmerTick((tick) => tick + 1), SHIMMER_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isHolo]);

  const frameColor = isHolo
    ? theme.holoShimmerColors[shimmerTick % theme.holoShimmerColors.length]
    : vibeType
      ? theme.colors.vibe[vibeType]
      : theme.colors.border;

  const labeled = isHolo || Boolean(vibeType);

  return (
    <View style={[styles.card, { borderColor: frameColor, borderWidth: labeled ? 3 : 0.5 }]}>
      <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
      {isHolo && (
        <View style={styles.starBadge}>
          <Text style={styles.starIcon}>★</Text>
        </View>
      )}
      <View style={[styles.labelBar, { backgroundColor: labeled ? frameColor : theme.colors.surface }]}>
        {vibeType ? (
          <>
            <Ionicons name={theme.vibeIcons[vibeType]} size={12} color={theme.colors.surface} />
            <Text style={[styles.labelText, { color: theme.colors.surface }]}>{vibeType}</Text>
          </>
        ) : (
          <Text style={[styles.labelText, { color: labeled ? theme.colors.surface : theme.colors.textSecondary }]}>
            no vibe yet
          </Text>
        )}
      </View>
      <View style={styles.dateLabelBackdrop}>
        <Text style={styles.dateLabel}>{formatCardDateLabel(date)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    height: '100%',
    borderRadius: theme.cardShape.radiusFull,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
  },
  starBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  starIcon: {
    fontSize: 13,
    color: theme.colors.surface,
  },
  labelBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 5,
  },
  labelText: {
    fontSize: 11,
    fontWeight: '500',
  },
  dateLabelBackdrop: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  dateLabel: {
    fontSize: 9,
    fontWeight: '500',
    color: theme.colors.surface,
  },
});
