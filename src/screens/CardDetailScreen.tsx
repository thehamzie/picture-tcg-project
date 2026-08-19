import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import CardFace from '../components/CardFace';
import { getCardById, getEarliestCardDate } from '../db/cardsRepository';
import type { RootStackParamList } from '../navigation/types';
import { withAlpha } from '../theme/color';
import type { SkinTokens } from '../theme/skins';
import { useSkin } from '../theme/SkinContext';
import { body, mono, s } from '../theme/typography';
import type { Card } from '../types/card';
import { HOLO_BASE_CHANCE } from '../utils/holo';
import { getSetNumberForDate } from '../utils/sets';

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
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="close" size={s(20)} color={skin.shell.textPrimary} />
        </Pressable>
        <Text style={styles.headerLabel}>{card?.isHolo ? 'HOLO — TILT REACTIVE' : 'COMMON — MATTE'}</Text>
        <Pressable
          onPress={() => card && navigation.navigate('Export', { cardId: card.id })}
          hitSlop={12}
          disabled={!card}
        >
          <Ionicons name="share-outline" size={s(20)} color={skin.shell.accent} />
        </Pressable>
      </View>

      {card && (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + s(28) }]}
          showsVerticalScrollIndicator={false}
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

          <Text style={styles.anatomy}>
            Anatomy: 2px ink rule around the photo, date and rarity in mono, title in heavy caps, vibe chip
            bottom-left, card number beside it. Foil is two layers — a wide hue sweep driven by device tilt,
            plus a fixed 74° grain that only catches at an angle.
          </Text>
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
  });
}
