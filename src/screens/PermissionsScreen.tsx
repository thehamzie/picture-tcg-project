import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import HardButton from '../components/HardButton';
import { setOnboardingComplete } from '../db/settingsRepository';
import type { RootStackParamList } from '../navigation/types';
import { readableInk, withAlpha } from '../theme/color';
import type { SkinTokens } from '../theme/skins';
import { useSkin } from '../theme/SkinContext';
import { theme } from '../theme/theme';
import { body, display, mono, s } from '../theme/typography';
import { requestNotificationPermission, scheduleDailyReminder } from '../utils/notifications';

// Permission priming. The permission-handling logic is carried over unchanged per CLAUDE.md
// ("the screens are being rebuilt, the logic mostly isn't") — only the presentation and copy
// are new, matching the rest of the rebuilt shell.

type StepKey = 'camera' | 'notifications' | 'done';

type Step = {
  key: StepKey;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  title: string;
  subtitle: string;
  buttonLabel: string;
};

const DEFAULT_REMINDER_HOUR = 20;
const DEFAULT_REMINDER_MINUTE = 0;

function getSteps(accent: string): Step[] {
  return [
    {
      key: 'camera',
      color: theme.colors.vibe.adventure,
      icon: 'camera',
      label: 'PERMISSION 1 OF 2',
      title: 'The camera, only when you ask',
      subtitle:
        'Daily Pull opens the camera when you pull a card, and never in the background. Photo library access lets you pick an existing shot instead.',
      buttonLabel: 'Allow access',
    },
    {
      key: 'notifications',
      color: accent,
      icon: 'notifications',
      label: 'PERMISSION 2 OF 2',
      title: 'One nudge, once a day',
      subtitle: 'A single reminder at the time you picked. No streak-guilt, no second notification.',
      buttonLabel: 'Turn on reminders',
    },
    {
      key: 'done',
      color: theme.colors.vibe.calm,
      icon: 'checkmark',
      label: 'READY',
      title: 'Your binder is empty',
      subtitle: 'That is the fun part. Pull the first card whenever today gives you something.',
      buttonLabel: 'Open Daily Pull',
    },
  ];
}

export default function PermissionsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Permissions'>>();
  const db = useSQLiteContext();
  const { skin } = useSkin();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(skin), [skin]);
  const STEPS = useMemo(() => getSteps(skin.shell.accent), [skin.shell.accent]);
  const [, requestCameraPermission] = useCameraPermissions();
  const [stepIndex, setStepIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  const reminderHour = route.params?.reminderHour ?? DEFAULT_REMINDER_HOUR;
  const reminderMinute = route.params?.reminderMinute ?? DEFAULT_REMINDER_MINUTE;
  const step = STEPS[stepIndex];
  const isDone = step.key === 'done';

  function advance() {
    setStepIndex((index) => Math.min(index + 1, STEPS.length - 1));
  }

  async function handlePrimary() {
    if (busy) return;
    setBusy(true);
    try {
      if (step.key === 'camera') {
        await requestCameraPermission();
        await ImagePicker.requestMediaLibraryPermissionsAsync();
        advance();
      } else if (step.key === 'notifications') {
        const granted = await requestNotificationPermission();
        if (granted) await scheduleDailyReminder(reminderHour, reminderMinute);
        advance();
      } else {
        await setOnboardingComplete(db);
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + s(20), paddingBottom: insets.bottom + s(20) }]}>
      <Animated.View key={step.key} entering={FadeInDown.duration(340)} style={styles.content}>
        <View style={[styles.iconTile, { backgroundColor: step.color }]}>
          <Ionicons name={step.icon} size={s(30)} color={readableInk(step.color)} />
        </View>
        <Text style={[styles.stepLabel, { color: step.color }]}>{step.label}</Text>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.subtitle}>{step.subtitle}</Text>
      </Animated.View>

      <View style={styles.footer}>
        <HardButton label={step.buttonLabel} onPress={handlePrimary} disabled={busy} style={styles.cta} />
        {!isDone && (
          <Pressable onPress={advance} hitSlop={10} style={styles.skipButton}>
            <Text style={styles.skipText}>NOT NOW</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function createStyles(skin: SkinTokens) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: skin.shell.background,
      paddingHorizontal: s(22),
      justifyContent: 'space-between',
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      gap: s(6),
    },
    iconTile: {
      width: s(64),
      height: s(64),
      borderRadius: s(14),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: s(18),
    },
    stepLabel: {
      ...mono(9, 0.2),
    },
    title: {
      ...display(24, 1.08),
      color: skin.shell.textPrimary,
      marginTop: s(4),
    },
    subtitle: {
      ...body(13, 400, 1.5),
      color: withAlpha(skin.shell.textPrimary, 0.5),
      marginTop: s(6),
    },
    footer: {
      gap: s(6),
    },
    cta: {
      alignSelf: 'stretch',
    },
    skipButton: {
      alignSelf: 'center',
      paddingVertical: s(10),
    },
    skipText: {
      ...mono(9, 0.14),
      color: skin.shell.textSecondary,
    },
  });
}
