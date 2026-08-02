import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/types';
import { theme } from '../theme/theme';

type Step = {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  hasTimePicker?: boolean;
};

const STEPS: Step[] = [
  {
    color: theme.colors.vibe.adventure,
    icon: 'camera',
    title: 'one day, one photo',
    subtitle: 'no clutter, just the moments that mattered.',
  },
  {
    color: theme.colors.vibe.calm,
    icon: 'calendar',
    title: 'watch your year fill in',
    subtitle: 'each day gets its own little dot on the calendar.',
  },
  {
    color: theme.colors.vibe.together,
    icon: 'notifications',
    title: "we'll remind you",
    subtitle: 'pick a time that works for you.',
    hasTimePicker: true,
  },
];

const MINUTE_STEP = 30;
const MINUTES_PER_DAY = 24 * 60;
const DEFAULT_REMINDER_MINUTES = 20 * 60;

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
}

export default function OnboardingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [stepIndex, setStepIndex] = useState(0);
  const [reminderMinutesTotal, setReminderMinutesTotal] = useState(DEFAULT_REMINDER_MINUTES);

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;
  const reminderHour = Math.floor(reminderMinutesTotal / 60);
  const reminderMinute = reminderMinutesTotal % 60;

  function adjustReminderTime(deltaMinutes: number) {
    setReminderMinutesTotal((prev) => (prev + deltaMinutes + MINUTES_PER_DAY) % MINUTES_PER_DAY);
  }

  function goToLastStep() {
    setStepIndex(STEPS.length - 1);
  }

  function handleNext() {
    if (!isLastStep) {
      setStepIndex((index) => index + 1);
      return;
    }
    navigation.navigate('Permissions', { reminderHour, reminderMinute });
  }

  return (
    <View style={styles.screen}>
      <View style={styles.skipRow}>
        <Pressable onPress={goToLastStep} hitSlop={8} disabled={isLastStep}>
          <Text style={[styles.skipText, isLastStep && styles.hidden]}>skip</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: step.color }]}>
          <Ionicons name={step.icon} size={34} color={theme.colors.surface} />
        </View>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.subtitle}>{step.subtitle}</Text>

        {step.hasTimePicker && (
          <View style={styles.timePicker}>
            <Pressable
              style={styles.timeStepButton}
              onPress={() => adjustReminderTime(-MINUTE_STEP)}
              hitSlop={8}
            >
              <Text style={styles.timeStepText}>−</Text>
            </Pressable>
            <Text style={styles.timeValue}>{formatTime(reminderHour, reminderMinute)}</Text>
            <Pressable
              style={styles.timeStepButton}
              onPress={() => adjustReminderTime(MINUTE_STEP)}
              hitSlop={8}
            >
              <Text style={styles.timeStepText}>+</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.dots}>
        {STEPS.map((_, index) => (
          <View
            key={index}
            style={[styles.dot, index === stepIndex ? styles.dotActive : styles.dotInactive]}
          />
        ))}
      </View>

      <Pressable style={styles.nextButton} onPress={handleNext}>
        <Text style={styles.nextButtonText}>{isLastStep ? 'get started' : 'next'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  skipRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  skipText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  hidden: {
    opacity: 0,
  },
  content: {
    flex: 1,
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
  },
  timePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 4,
  },
  timeStepButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeStepText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  timeValue: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    minWidth: 82,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginVertical: 12,
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
  nextButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: theme.cardShape.radiusFull,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
  },
  nextButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
});
