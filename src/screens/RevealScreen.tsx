import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import CardFace from '../components/CardFace';
import FaceDownCard from '../components/FaceDownCard';
import HardButton from '../components/HardButton';
import { insertCard } from '../db/cardsRepository';
import { useCards } from '../hooks/useCards';
import type { RootStackParamList } from '../navigation/types';
import { readableInk, withAlpha } from '../theme/color';
import type { SkinTokens } from '../theme/skins';
import { useSkin } from '../theme/SkinContext';
import { theme, vibeLabels, VIBE_ORDER, type VibeType } from '../theme/theme';
import { body, mono, s } from '../theme/typography';
import { formatMonoDateWithDay, todayDateKey } from '../utils/date';
import * as haptics from '../utils/haptics';
import { HOLO_STREAK_MILESTONE_DAYS, resolveIsHolo } from '../utils/holo';
import { computeDayStreak } from '../utils/streak';
import { randomTitlePhrase } from '../utils/titlePhrases';

// Reveal — mockup 2d. "Card lands face-down, flips, then you tag the vibe."
//
// The mockup drives the flip from a slider and has no title field; PLAN.md's "Title flow"
// requires one on this screen, so it's added below the vibe row in the same visual language
// (mono label, translucent field, shuffle button) rather than invented in another style.

const FLIP_DURATION_MS = 700;
const CARD_WIDTH = s(206);
const TITLE_MAX_LENGTH = 60;

type RevealNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Reveal'>;
type RevealRouteProp = RouteProp<RootStackParamList, 'Reveal'>;

export default function RevealScreen() {
  const navigation = useNavigation<RevealNavigationProp>();
  const route = useRoute<RevealRouteProp>();
  const db = useSQLiteContext();
  const { cards, refresh } = useCards();
  const { skin } = useSkin();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(skin), [skin]);

  const { photoUri, thumbUri, filterId } = route.params;
  const today = todayDateKey();

  const [flipped, setFlipped] = useState(false);
  const [resolvedHolo, setResolvedHolo] = useState(false);
  const [selectedVibe, setSelectedVibe] = useState<VibeType | null>(null);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const flip = useSharedValue(0);

  const priorStreak = computeDayStreak(cards);
  const openedStreak = priorStreak + 1;
  const isMilestone = openedStreak % HOLO_STREAK_MILESTONE_DAYS === 0;
  // The card number the row is about to get — `cards.id` is AUTOINCREMENT, so this is what
  // the mockup's "NO. 216" will read once it's written.
  const nextCardNumber = cards.reduce((max, card) => Math.max(max, card.id), 0) + 1;

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1100 }, { rotateY: `${flip.value * 180}deg` }],
    opacity: flip.value < 0.5 ? 1 : 0,
  }));
  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1100 }, { rotateY: `${180 - flip.value * 180}deg` }],
    opacity: flip.value < 0.5 ? 0 : 1,
  }));

  function handleFlip() {
    if (flipped) return;
    const holo = resolveIsHolo(openedStreak);
    setResolvedHolo(holo);
    setFlipped(true);
    // A rare pull gets the heavier notification rather than the same tap as a common one — the
    // one place in the app where the haptic itself carries information.
    if (holo) haptics.success();
    else haptics.thud();
    flip.value = withTiming(1, { duration: FLIP_DURATION_MS, easing: Easing.inOut(Easing.cubic) });
  }

  async function handleAddToBinder() {
    if (saving) return;
    setSaving(true);
    try {
      await insertCard(db, {
        date: today,
        photoUri,
        thumbUri,
        filterId,
        title: title.trim() ? title.trim() : null,
        vibeType: selectedVibe,
        isHolo: resolvedHolo,
      });
      await refresh();
      haptics.success();
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (error) {
      Alert.alert('Something went wrong', 'Could not save your card. Please try again.');
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + s(14), paddingBottom: insets.bottom + s(18) }]}>
      <Text style={styles.cardNumberLabel}>
        NO. {nextCardNumber} · {formatMonoDateWithDay(today)}
      </Text>

      <Pressable
        style={styles.stage}
        onPress={handleFlip}
        disabled={flipped}
        accessibilityRole="button"
        accessibilityLabel={flipped ? "Today's card" : 'Turn the card over'}
      >
        <View style={{ width: CARD_WIDTH, height: CARD_WIDTH / theme.cardShape.aspectRatio }}>
          <Animated.View style={[styles.face, backStyle]}>
            <FaceDownCard width={CARD_WIDTH} showLabel={false} float={!flipped} />
          </Animated.View>
          <Animated.View style={[styles.face, frontStyle]} pointerEvents={flipped ? 'auto' : 'none'}>
            <CardFace
              photoUri={photoUri}
              date={today}
              title={title}
              vibeType={selectedVibe}
              isHolo={resolvedHolo}
              cardNumber={nextCardNumber}
              width={CARD_WIDTH}
              interactive={flipped}
            />
          </Animated.View>
        </View>
      </Pressable>

      {!flipped ? (
        <Animated.View entering={FadeIn.delay(400).duration(500)} style={styles.copyBlock}>
          <Text style={styles.copyTitle}>Tap to turn it over.</Text>
          <Text style={styles.copySubtitle}>
            {isMilestone ? `Day ${openedStreak} — a milestone pull.` : 'Every seventh day pulls better odds.'}
          </Text>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInDown.duration(420)} style={styles.tagBlock}>
          <View style={styles.copyBlock}>
            <Text style={styles.copyTitle}>How did today feel?</Text>
            <Text style={styles.copySubtitle}>One tag. Sets the card&apos;s edge colour.</Text>
          </View>

          <View style={styles.vibeRow}>
            {VIBE_ORDER.map((vibe) => {
              const selected = selectedVibe === vibe;
              const color = theme.colors.vibe[vibe];
              return (
                <Pressable
                  key={vibe}
                  style={styles.vibeColumn}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${vibeLabels[vibe]} tag`}
                  onPress={() => {
                    haptics.selection();
                    setSelectedVibe((current) => (current === vibe ? null : vibe));
                  }}
                >
                  <View
                    style={[
                      styles.vibeSwatch,
                      { backgroundColor: color },
                      selected
                        ? {
                            boxShadow: [
                              { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: s(3), color: withAlpha(color, 0.3) },
                            ],
                          }
                        : styles.vibeSwatchDim,
                    ]}
                  >
                    {selected && (
                      <Ionicons name="checkmark" size={s(18)} color={readableInk(color)} />
                    )}
                  </View>
                  <Text style={[styles.vibeLabel, selected && { color }]}>{vibeLabels[vibe]}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.titleRow}>
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
              placeholder="TITLE (OPTIONAL)"
              placeholderTextColor={withAlpha(skin.shell.textPrimary, 0.32)}
              maxLength={TITLE_MAX_LENGTH}
            />
            <Pressable
              style={styles.shuffleButton}
              onPress={() => setTitle(randomTitlePhrase())}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Suggest a title"
            >
              <Ionicons name="shuffle" size={s(16)} color={skin.shell.accent} />
            </Pressable>
          </View>

          <HardButton
            label={saving ? 'Adding…' : 'Add to binder'}
            height={52}
            onPress={handleAddToBinder}
            disabled={saving}
            style={styles.cta}
          />
        </Animated.View>
      )}
    </View>
  );
}

function createStyles(skin: SkinTokens) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: skin.shell.background,
      alignItems: 'center',
    },
    cardNumberLabel: {
      ...mono(9.5, 0.2),
      color: skin.shell.accent,
      marginTop: s(8),
    },
    stage: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    },
    face: {
      ...StyleSheet.absoluteFillObject,
      backfaceVisibility: 'hidden',
    },
    copyBlock: {
      alignItems: 'center',
      paddingHorizontal: s(22),
    },
    copyTitle: {
      ...body(14, 600, 1.3),
      color: skin.shell.textPrimary,
    },
    copySubtitle: {
      ...body(11.5, 400, 1.4),
      color: withAlpha(skin.shell.textPrimary, 0.45),
      marginTop: s(4),
      textAlign: 'center',
    },
    tagBlock: {
      width: '100%',
    },
    vibeRow: {
      flexDirection: 'row',
      gap: s(7),
      paddingHorizontal: s(18),
      paddingTop: s(14),
    },
    vibeColumn: {
      flex: 1,
      alignItems: 'center',
      gap: s(6),
    },
    vibeSwatch: {
      width: '100%',
      height: s(44),
      borderRadius: s(8),
      alignItems: 'center',
      justifyContent: 'center',
    },
    vibeSwatchDim: {
      opacity: 0.55,
    },
    vibeLabel: {
      ...mono(7.5, 0.08),
      color: withAlpha(skin.shell.textPrimary, 0.45),
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s(8),
      marginHorizontal: s(22),
      marginTop: s(18),
    },
    titleInput: {
      flex: 1,
      ...mono(10, 0.08),
      color: skin.shell.textPrimary,
      backgroundColor: withAlpha(skin.shell.textPrimary, 0.07),
      borderRadius: s(8),
      paddingVertical: s(12),
      paddingHorizontal: s(12),
    },
    shuffleButton: {
      width: s(40),
      height: s(40),
      borderRadius: s(8),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: withAlpha(skin.shell.accent, 0.14),
    },
    cta: {
      marginHorizontal: s(22),
      marginTop: s(20),
    },
  });
}
