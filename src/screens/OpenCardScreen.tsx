import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useSQLiteContext } from 'expo-sqlite';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import CardFace from '../components/CardFace';
import { insertCard } from '../db/cardsRepository';
import { useCards } from '../hooks/useCards';
import { theme, type VibeType } from '../theme/theme';
import { todayDateKey } from '../utils/date';
import { HOLO_STREAK_MILESTONE_DAYS, resolveIsHolo } from '../utils/holo';
import { saveCardPhoto } from '../utils/photoStorage';
import { computeDayStreak } from '../utils/streak';

const CARD_WIDTH = 180;
const FLIP_DURATION_MS = 600;
const VIBE_ORDER: VibeType[] = ['golden', 'calm', 'together', 'adventure', 'cozy'];

export default function OpenCardScreen() {
  const db = useSQLiteContext();
  const { cards, refresh } = useCards();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cameraRef, setCameraRef] = useState<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [resolvedHolo, setResolvedHolo] = useState(false);
  const [selectedVibe, setSelectedVibe] = useState<VibeType | null>(null);
  const flipProgress = useSharedValue(0);

  const today = todayDateKey();
  const todaysCard = cards.find((card) => card.date === today);
  const priorStreak = computeDayStreak(cards);
  const openedStreak = priorStreak + 1;
  const isMilestone = openedStreak % HOLO_STREAK_MILESTONE_DAYS === 0;

  const backAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${flipProgress.value * 180}deg` }],
  }));
  const frontAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${180 - flipProgress.value * 180}deg` }],
  }));

  async function handleCapturedPhoto(sourceUri: string) {
    setSaving(true);
    try {
      const savedUri = saveCardPhoto(sourceUri, today);
      setPendingPhotoUri(savedUri);
      setCameraOpen(false);
    } catch (error) {
      Alert.alert('Something went wrong', 'Could not save today\'s card. Please try again.');
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  async function takePhoto() {
    if (!cameraRef || saving) return;
    setSaving(true);
    try {
      const photo = await cameraRef.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) {
        await handleCapturedPhoto(photo.uri);
      }
    } finally {
      setSaving(false);
    }
  }

  async function pickFromLibrary() {
    const permissionResponse = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResponse.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to import a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    await handleCapturedPhoto(result.assets[0].uri);
  }

  function handleOpen() {
    setResolvedHolo(resolveIsHolo(openedStreak));
    setFlipped(true);
    flipProgress.value = withTiming(1, { duration: FLIP_DURATION_MS });
  }

  async function finalizeCard(vibeType: VibeType | null) {
    if (!pendingPhotoUri || saving) return;
    setSaving(true);
    setSelectedVibe(vibeType);
    try {
      await insertCard(db, { date: today, photoUri: pendingPhotoUri, vibeType, isHolo: resolvedHolo });
      await refresh();
      setPendingPhotoUri(null);
      setFlipped(false);
      setResolvedHolo(false);
      setSelectedVibe(null);
      flipProgress.value = 0;
    } catch (error) {
      Alert.alert('Something went wrong', 'Could not save your card. Please try again.');
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  if (todaysCard) {
    return (
      <View style={styles.container}>
        <View style={styles.cardStage}>
          <CardFace
            photoUri={todaysCard.photoUri}
            date={todaysCard.date}
            vibeType={todaysCard.vibeType}
            isHolo={todaysCard.isHolo}
          />
        </View>
        <Text style={styles.title}>Today's card is captured</Text>
        <Text style={styles.subtitle}>Come back tomorrow for the next one.</Text>
      </View>
    );
  }

  if (cameraOpen) {
    if (!permission) {
      return <View style={styles.container} />;
    }

    if (!permission.granted) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Camera access needed</Text>
          <Pressable style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>Grant access</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => setCameraOpen(false)}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={setCameraRef} style={styles.camera} facing="back" />
        <View style={styles.cameraControls}>
          <Pressable style={styles.secondaryButton} onPress={() => setCameraOpen(false)}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.captureButton} onPress={takePhoto} disabled={saving} />
        </View>
      </View>
    );
  }

  if (pendingPhotoUri) {
    return (
      <View style={styles.container}>
        <View style={styles.streakHeader}>
          <Ionicons name="calendar" size={15} color={theme.colors.accent} />
          <Text style={styles.streakTitle}>today's card</Text>
        </View>
        <Text style={styles.streakSubtitle}>
          {flipped && isMilestone
            ? `day ${openedStreak} · streak milestone!`
            : `day ${flipped ? openedStreak : priorStreak} of your streak`}
        </Text>

        <View style={styles.flipStage}>
          <Animated.View style={[styles.cardLayer, backAnimatedStyle]}>
            <View style={styles.cardBack}>
              <Ionicons name="camera-outline" size={30} color={theme.colors.textSecondary} />
            </View>
          </Animated.View>
          <Animated.View style={[styles.cardLayer, frontAnimatedStyle]}>
            {flipped && (
              <CardFace photoUri={pendingPhotoUri} date={today} vibeType={selectedVibe} isHolo={resolvedHolo} />
            )}
          </Animated.View>
        </View>

        {flipped && (
          <View style={styles.chipRow}>
            {VIBE_ORDER.map((vibe) => (
              <Pressable
                key={vibe}
                style={[styles.chip, { backgroundColor: theme.colors.vibe[vibe] }]}
                onPress={() => finalizeCard(vibe)}
                disabled={saving}
              >
                <Ionicons name={theme.vibeIcons[vibe]} size={15} color={theme.colors.surface} />
              </Pressable>
            ))}
            <Pressable style={styles.chipSkip} onPress={() => finalizeCard(null)} disabled={saving}>
              <Ionicons name="close" size={15} color={theme.colors.textSecondary} />
            </Pressable>
          </View>
        )}

        {!flipped && (
          <Pressable style={styles.primaryButton} onPress={handleOpen}>
            <Text style={styles.primaryButtonText}>open card</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Today's card is waiting</Text>
      <Pressable style={styles.primaryButton} onPress={() => setCameraOpen(true)} disabled={saving}>
        <Text style={styles.primaryButtonText}>Take Photo</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={pickFromLibrary} disabled={saving}>
        <Text style={styles.secondaryButtonText}>Choose from Library</Text>
      </Pressable>
    </View>
  );
}

const CARD_HEIGHT = CARD_WIDTH / theme.cardShape.aspectRatio;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: theme.colors.background,
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  cardStage: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: theme.cardShape.radiusFull,
  },
  primaryButtonText: {
    color: theme.colors.surface,
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  secondaryButtonText: {
    color: theme.colors.textSecondary,
    fontWeight: '500',
    fontSize: 15,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.surface,
    borderWidth: 4,
    borderColor: theme.colors.accent,
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  streakTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  streakSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  flipStage: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  cardLayer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
  },
  cardBack: {
    width: '100%',
    height: '100%',
    borderRadius: theme.cardShape.radiusFull,
    backgroundColor: theme.colors.surface,
    borderWidth: 0.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  chip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSkip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
  },
});
