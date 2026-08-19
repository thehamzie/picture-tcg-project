import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { withAlpha } from '../theme/color';
import { linearGradient } from '../theme/gradients';
import { SKIN_ORDER, SKIN_SWATCHES, SKINS, type SkinId, type SkinTokens } from '../theme/skins';
import { useSkin } from '../theme/SkinContext';
import { body, display, mono, s } from '../theme/typography';

// Binder skins — mockup 2i. "Shell, page and foil swap; layout and card anatomy never move."
// Each row is the skin's own 4-swatch strip (shell / page / cardstock / foil, in that order),
// its name, and its descriptor. The active row gets an accent tint plus a 1.5px inset ring.

export default function SkinSelectorScreen() {
  const navigation = useNavigation();
  const { skin, skinId, setSkin } = useSkin();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(skin), [skin]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + s(12) }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Binder skin</Text>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="close" size={s(20)} color={skin.shell.textPrimary} />
        </Pressable>
      </View>
      <Text style={styles.subtitle}>
        Changes surfaces and foil only. Your cards keep their vibe colours.
      </Text>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + s(24) }]}
        showsVerticalScrollIndicator={false}
      >
        {SKIN_ORDER.map((id, index) => (
          <SkinRow key={id} id={id} active={id === skinId} styles={styles} onPress={() => setSkin(id)} index={index} />
        ))}
        <Text style={styles.footnote}>
          Skins are four token sets — shell, page, stock, foil ramp — so a new one is a config file, not a
          redesign.
        </Text>
      </ScrollView>
    </View>
  );
}

function SkinRow({
  id,
  active,
  styles,
  onPress,
  index,
}: {
  id: SkinId;
  active: boolean;
  styles: ReturnType<typeof createStyles>;
  onPress: () => void;
  index: number;
}) {
  const tokens = SKINS[id];
  const swatches = SKIN_SWATCHES[id];

  return (
    <Animated.View entering={FadeInDown.duration(320).delay(index * 60)}>
      <Pressable onPress={onPress} style={[styles.row, active && styles.rowActive]}>
        <View style={styles.swatchStrip}>
          {swatches.map((colors, swatchIndex) => (
            <View key={swatchIndex} style={[styles.swatch, linearGradient(colors, 150)]} />
          ))}
        </View>
        <View style={styles.rowCopy}>
          <Text style={styles.rowName}>{tokens.name}</Text>
          <Text style={[styles.rowDescriptor, active && styles.rowDescriptorActive]}>
            {active ? `${tokens.descriptor} · IN USE` : tokens.descriptor}
          </Text>
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: s(20),
    },
    title: {
      ...display(17),
      color: skin.shell.textPrimary,
    },
    subtitle: {
      ...body(11, 400, 1.45),
      color: withAlpha(skin.shell.textPrimary, 0.5),
      paddingHorizontal: s(20),
      marginTop: s(6),
    },
    list: {
      paddingHorizontal: s(20),
      paddingTop: s(14),
      gap: s(14),
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s(12),
      padding: s(11),
      borderRadius: s(10),
      backgroundColor: withAlpha(skin.shell.textPrimary, 0.05),
    },
    rowActive: {
      backgroundColor: withAlpha(skin.shell.accent, 0.13),
      boxShadow: [
        { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1.5, color: skin.shell.accent, inset: true },
      ],
    },
    swatchStrip: {
      flexDirection: 'row',
      gap: s(3),
    },
    swatch: {
      width: s(18),
      height: s(44),
      borderRadius: s(3),
    },
    rowCopy: {
      flexShrink: 1,
    },
    rowName: {
      ...body(12.5, 600, 1.2),
      color: skin.shell.textPrimary,
    },
    rowDescriptor: {
      ...mono(8.5, 0.1),
      color: withAlpha(skin.shell.textPrimary, 0.45),
      marginTop: s(4),
    },
    rowDescriptorActive: {
      color: skin.shell.accent,
    },
    footnote: {
      ...body(10.5, 400, 1.55),
      color: withAlpha(skin.shell.textPrimary, 0.42),
      paddingTop: s(2),
    },
  });
}
