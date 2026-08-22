import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import CardFace from '../components/CardFace';
import HardButton from '../components/HardButton';
import { deleteCard, getCardById, getEarliestCardDate, updateCardDetails } from '../db/cardsRepository';
import type { RootStackParamList } from '../navigation/types';
import { readableInk, withAlpha } from '../theme/color';
import type { SkinTokens } from '../theme/skins';
import { useSkin } from '../theme/SkinContext';
import { theme, vibeLabels, VIBE_ORDER, type VibeType } from '../theme/theme';
import { body, mono, s } from '../theme/typography';
import type { Card } from '../types/card';
import * as haptics from '../utils/haptics';
import { HOLO_BASE_CHANCE } from '../utils/holo';
import { deleteCardPhoto } from '../utils/photoStorage';
import { getSetNumberForDate } from '../utils/sets';
import { randomTitlePhrase } from '../utils/titlePhrases';

const TITLE_MAX_LENGTH = 60;

// Card Detail — mockup 2e, "the card as an object." A single card shown large on the shell's
// raised surface, with full tilt/pan holo interactivity, the Common/Holo rarity legend, and
// the anatomy note. Export is reached from the share icon here, never by tapping a card.

const CARD_WIDTH = s(250);
const HOLO_ODDS_LABEL = `HOLO ~${Math.round(HOLO_BASE_CHANCE * 100)}%`;

type CardDetailNavigationProp = NativeStackNavigationProp<RootStackParamList, 'CardDetail'>;
type CardDetailRouteProp = RouteProp<RootStackParamList, 'CardDetail'>;

export default function CardDetailScreen() {
  const navigation = useNavigation<CardDetailNavigationProp>();
  const route = useRoute<CardDetailRouteProp>();
  const db = useSQLiteContext();
  const { skin } = useSkin();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(skin), [skin]);

  const [card, setCard] = useState<Card | null>(null);
  const [setNumber, setSetNumber] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftVibe, setDraftVibe] = useState<VibeType | null>(null);
  const [saving, setSaving] = useState(false);

  function startEdit(loaded: Card) {
    setDraftTitle(loaded.title ?? '');
    setDraftVibe(loaded.vibeType);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  async function saveEdit() {
    if (!card || saving) return;
    setSaving(true);
    try {
      const title = draftTitle.trim() ? draftTitle.trim() : null;
      await updateCardDetails(db, card.id, { title, vibeType: draftVibe });
      // Update in place rather than refetching — the card is already fully loaded, and this
      // keeps the tilt/foil from remounting mid-edit.
      setCard({ ...card, title, vibeType: draftVibe });
      setEditing(false);
    } catch (error) {
      Alert.alert('Could not save', 'Your changes were not saved. Please try again.');
      console.error('[cardDetail] update failed', error);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!card) return;
    haptics.warn();
    Alert.alert(
      'Delete this card?',
      'The photo and everything recorded with it are removed for good. This cannot be undone.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCard(db, card.id);
              deleteCardPhoto(card.photoUri, card.thumbUri);
              navigation.goBack();
            } catch (error) {
              Alert.alert('Could not delete', 'The card was not removed. Please try again.');
              console.error('[cardDetail] delete failed', error);
            }
          },
        },
      ]
    );
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await getCardById(db, route.params.cardId);
      if (cancelled || !loaded) return;
      setCard(loaded);
      const anchor = await getEarliestCardDate(db);
      if (!cancelled && anchor) setSetNumber(getSetNumberForDate(loaded.date, anchor));
    })();
    return () => {
      cancelled = true;
    };
  }, [db, route.params.cardId]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + s(12) }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={s(20)} color={skin.shell.textPrimary} />
        </Pressable>
        <Text style={styles.headerLabel}>{card?.isHolo ? 'HOLO — TILT REACTIVE' : 'COMMON — MATTE'}</Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => (editing ? cancelEdit() : card && startEdit(card))}
            hitSlop={12}
            disabled={!card}
            accessibilityRole="button"
            accessibilityLabel={editing ? 'Stop editing' : 'Edit the title and tag'}
          >
            <Ionicons
              name={editing ? 'close-circle-outline' : 'create-outline'}
              size={s(20)}
              color={editing ? skin.shell.accent : skin.shell.textSecondary}
            />
          </Pressable>
          <Pressable
            onPress={() => card && navigation.navigate('Export', { cardId: card.id })}
            hitSlop={12}
            disabled={!card}
            accessibilityRole="button"
            accessibilityLabel="Share this card"
          >
            <Ionicons name="share-outline" size={s(20)} color={skin.shell.accent} />
          </Pressable>
        </View>
      </View>

      {card && (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + s(28) }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={FadeInUp.duration(420)} style={styles.cardStage}>
            <CardFace
              photoUri={card.photoUri}
              date={card.date}
              title={card.title}
              vibeType={card.vibeType}
              isHolo={card.isHolo}
              cardNumber={card.id}
              width={CARD_WIDTH}
              interactive
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(420).delay(90)} style={styles.panelRow}>
            <View style={[styles.panel, !card.isHolo && styles.panelActive]}>
              <Text style={[styles.panelLabel, !card.isHolo && styles.panelLabelActive]}>COMMON</Text>
              <Text style={styles.panelDetail}>Matte stock, no sheen</Text>
            </View>
            <View style={[styles.panel, card.isHolo && styles.panelActive]}>
              <Text style={[styles.panelLabel, card.isHolo && styles.panelLabelActive]}>{HOLO_ODDS_LABEL}</Text>
              <Text style={styles.panelDetail}>Foil sweep + fine grain</Text>
            </View>
          </Animated.View>

          {setNumber != null && (
            <Text style={styles.setLine}>
              SET {setNumber} · CARD NO. {card.id}
            </Text>
          )}

          {editing ? (
            <Animated.View entering={FadeInDown.duration(280)} style={styles.editPanel}>
              <Text style={styles.editLabel}>TITLE</Text>
              <View style={styles.titleRow}>
                <TextInput
                  style={styles.titleInput}
                  value={draftTitle}
                  onChangeText={setDraftTitle}
                  placeholder="TITLE (OPTIONAL)"
                  placeholderTextColor={withAlpha(skin.shell.textPrimary, 0.32)}
                  maxLength={TITLE_MAX_LENGTH}
                />
                <Pressable
                  style={styles.shuffleButton}
                  onPress={() => setDraftTitle(randomTitlePhrase())}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Suggest a title"
                >
                  <Ionicons name="shuffle" size={s(16)} color={skin.shell.accent} />
                </Pressable>
              </View>

              <Text style={styles.editLabel}>VIBE</Text>
              <View style={styles.vibeRow}>
                {VIBE_ORDER.map((vibe) => {
                  const selected = draftVibe === vibe;
                  const color = theme.colors.vibe[vibe];
                  return (
                    <Pressable
                      key={vibe}
                      style={styles.vibeColumn}
                      onPress={() => setDraftVibe((current) => (current === vibe ? null : vibe))}
                    >
                      <View
                        style={[
                          styles.vibeSwatch,
                          { backgroundColor: color },
                          selected
                            ? {
                                boxShadow: [
                                  {
                                    offsetX: 0,
                                    offsetY: 0,
                                    blurRadius: 0,
                                    spreadDistance: s(3),
                                    color: withAlpha(color, 0.3),
                                  },
                                ],
                              }
                            : styles.vibeSwatchDim,
                        ]}
                      >
                        {selected && <Ionicons name="checkmark" size={s(15)} color={readableInk(color)} />}
                      </View>
                      <Text style={[styles.vibeLabel, selected && { color }]}>{vibeLabels[vibe]}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.editActions}>
                <HardButton
                  label="Cancel"
                  variant="secondary"
                  depth={0}
                  height={44}
                  onPress={cancelEdit}
                  style={styles.editButton}
                />
                <HardButton
                  label={saving ? 'Saving…' : 'Save changes'}
                  depth={4}
                  height={44}
                  fontSize={12}
                  onPress={saveEdit}
                  disabled={saving}
                  style={styles.editButton}
                />
              </View>

              <Pressable
                onPress={confirmDelete}
                hitSlop={10}
                style={styles.deleteButton}
                accessibilityRole="button"
                accessibilityLabel="Delete this card"
                accessibilityHint="Asks you to confirm first"
              >
                <Ionicons name="trash-outline" size={s(14)} color={theme.colors.vibe.adventure} />
                <Text style={styles.deleteText}>DELETE THIS CARD</Text>
              </Pressable>
            </Animated.View>
          ) : (
            <Text style={styles.anatomy}>
              Anatomy: 2px ink rule around the photo, date and rarity in mono, title in heavy caps, vibe chip
              bottom-left, card number beside it. Foil is two layers — a wide hue sweep driven by device tilt,
              plus a fixed 74° grain that only catches at an angle.
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(skin: SkinTokens) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: skin.shell.surface,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: s(22),
      paddingBottom: s(6),
    },
    headerLabel: {
      ...mono(9, 0.2),
      color: withAlpha(skin.shell.textPrimary, 0.45),
    },
    content: {
      paddingHorizontal: s(22),
      paddingTop: s(18),
      gap: s(18),
      alignItems: 'center',
    },
    cardStage: {
      alignItems: 'center',
    },
    panelRow: {
      flexDirection: 'row',
      gap: s(9),
      alignSelf: 'stretch',
    },
    panel: {
      flex: 1,
      paddingVertical: s(9),
      paddingHorizontal: s(10),
      borderRadius: s(7),
      backgroundColor: withAlpha(skin.shell.textPrimary, 0.06),
    },
    panelActive: {
      backgroundColor: withAlpha(skin.shell.accent, 0.14),
    },
    panelLabel: {
      ...mono(8, 0.1),
      color: withAlpha(skin.shell.textPrimary, 0.45),
    },
    panelLabelActive: {
      color: skin.shell.accent,
    },
    panelDetail: {
      ...body(10.5, 600, 1.3),
      color: skin.shell.textPrimary,
      marginTop: s(5),
    },
    setLine: {
      ...mono(8.5, 0.14),
      color: withAlpha(skin.shell.textPrimary, 0.4),
      alignSelf: 'flex-start',
    },
    anatomy: {
      ...body(11, 400, 1.55),
      color: withAlpha(skin.shell.textPrimary, 0.5),
      alignSelf: 'flex-start',
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s(14),
    },
    editPanel: {
      alignSelf: 'stretch',
      gap: s(8),
    },
    editLabel: {
      ...mono(9, 0.16),
      color: withAlpha(skin.shell.textPrimary, 0.45),
      marginTop: s(6),
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s(8),
    },
    titleInput: {
      flex: 1,
      ...mono(10, 0.08),
      color: skin.shell.textPrimary,
      backgroundColor: withAlpha(skin.shell.textPrimary, 0.07),
      borderRadius: s(8),
      paddingVertical: s(11),
      paddingHorizontal: s(12),
    },
    shuffleButton: {
      width: s(38),
      height: s(38),
      borderRadius: s(8),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: withAlpha(skin.shell.accent, 0.14),
    },
    vibeRow: {
      flexDirection: 'row',
      gap: s(7),
    },
    vibeColumn: {
      flex: 1,
      alignItems: 'center',
      gap: s(6),
    },
    vibeSwatch: {
      width: '100%',
      height: s(38),
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
    editActions: {
      flexDirection: 'row',
      gap: s(9),
      marginTop: s(10),
    },
    editButton: {
      flex: 1,
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s(7),
      paddingVertical: s(14),
      marginTop: s(4),
    },
    deleteText: {
      ...mono(9, 0.14),
      color: theme.colors.vibe.adventure,
    },
  });
}
