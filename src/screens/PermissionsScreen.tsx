import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useSQLiteContext } from 'expo-sqlite';

import { setOnboardingComplete } from '../db/settingsRepository';
import type { RootStackParamList } from '../navigation/types';
import { theme } from '../theme/theme';
import { requestNotificationPermission, scheduleDailyReminder } from '../utils/notifications';

type StepKey = 'camera' | 'notifications' | 'done';

type Step = {
  key: StepKey;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  buttonLabel: string;
};

const STEPS: Step[] = [
  {
    key: 'camera',
    color: theme.colors.vibe.adventure,
    icon: 'camera',
    title: "let's get your camera ready",
    subtitle: "everdot needs your camera and photos to capture or choose today's picture.",
    buttonLabel: 'allow access',
  },
  {
    key: 'notifications',
    color: theme.colors.accent,
    icon: 'notifications',
    title: "don't forget your daily card",
    subtitle: 'turn on one gentle reminder a day so you never miss capturing a moment.',
    buttonLabel: 'turn on reminders',
  },
  {
    key: 'done',
    color: theme.colors.vibe.calm,
    icon: 'checkmark',
    title: "you're all set",
    subtitle: "let's start your collection.",
    buttonLabel: 'continue',
  },
];

const DEFAULT_REMINDER_HOUR = 20;
const DEFAULT_REMINDER_MINUTE = 0;

export default function PermissionsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Permissions'>>();
  const db = useSQLiteContext();
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

  async function finishOnboarding() {
    await setOnboardingComplete(db);
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
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
        if (granted) {
          await scheduleDailyReminder(reminderHour, reminderMinute);
        }
        advance();
      } else {
        await finishOnboarding();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: step.color }]}>
          <Ionicons name={step.icon} size={34} color={theme.colors.surface} />
        </View>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.subtitle}>{step.subtitle}</Text>
        <Pressable style={styles.primaryButton} onPress={handlePrimary} disabled={busy}>
          <Text style={styles.primaryButtonText}>{step.buttonLabel}</Text>
        </Pressable>
        {!isDone && (
          <Pressable onPress={advance} hitSlop={8}>
            <Text style={styles.skipText}>not now</Text>
          </Pressable>
        )}
      </View>

      {!isDone && (
        <View style={styles.dots}>
          {STEPS.slice(0, 2).map((_, index) => (
            <View
              key={index}
              style={[styles.dot, index === stepIndex ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 20,
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 6,
  },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19.5,
    maxWidth: 230,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: theme.cardShape.radiusFull,
    alignItems: 'center',
    backgroundColor: theme.colors.accent,
    marginTop: 4,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.surface,
  },
  skipText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    padding: 2,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 16,
    backgroundColor: theme.colors.accent,
  },
  dotInactive: {
    width: 6,
    backgroundColor: theme.colors.border,
  },
});
