import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import FaceDownCard from '../components/FaceDownCard';
import HardButton from '../components/HardButton';
import type { RootStackParamList } from '../navigation/types';
import { withAlpha } from '../theme/color';
import type { SkinTokens } from '../theme/skins';
import { useSkin } from '../theme/SkinContext';
import { theme } from '../theme/theme';
import { body, display, mono, s } from '../theme/typography';
import { HOLO_BASE_CHANCE } from '../utils/holo';

// Onboarding. No mockup exists for this screen, so it's built from the same tokens as the
// rest: mono step label, heavy-caps headline, one line of body copy, the gold hard button.
//
// The copy is fresh rather than carried over — CLAUDE.md explicitly flags the old Everdot
// wording as fair game, and the old text described a month calendar grid ("each day gets its
// own little dot on the calendar") that this rebuild no longer has.

type Step = {
  label: string;
  title: string;
  body: string;
  accentColor?: string;
  hasTimePicker?: boolean;
};

const STEPS: Step[] = [
  {
    label: 'ONE · CAPTURE',
    title: 'One photo a day',
    body: 'No feed, no backlog, nothing to catch up on. One picture, any time before midnight.',
  },
  {
    label: 'TWO · COLLECT',
    title: 'Every week is a set',
    body: 'Seven cards fill a binder page. Finish one and it opens like a pack — once, when you come back to it.',
    accentColor: theme.colors.vibe.calm,
  },
  {
    label: 'THREE · REMIND',
    title: `About 1 in ${Math.round(1 / HOLO_BASE_CHANCE)} pulls foil`,
    body: 'Keep a streak and every seventh day is guaranteed. Pick a time and we will nudge you once.',
    accentColor: theme.colors.vibe.together,
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
  const { skin } = useSkin();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(skin), [skin]);
  const [stepIndex, setStepIndex] = useState(0);
  const [reminderMinutesTotal, setReminderMinutesTotal] = useState(DEFAULT_REMINDER_MINUTES);

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;
  const reminderHour = Math.floor(reminderMinutesTotal / 60);
  const reminderMinute = reminderMinutesTotal % 60;

  function handleNext() {
    if (!isLastStep) {
      setStepIndex((index) => index + 1);
      return;
    }
    navigation.navigate('Permissions', { reminderHour, reminderMinute });
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + s(16), paddingBottom: insets.bottom + s(20) }]}>
      <View style={styles.topRow}>
        <Text style={styles.wordmark}>Daily Pull</Text>
        <Pressable onPress={() => setStepIndex(STEPS.length - 1)} hitSlop={10} disabled={isLastStep}>
          <Text style={[styles.skip, isLastStep && styles.invisible]}>SKIP</Text>
        </Pressable>
      </View>

      <View style={styles.stage}>
        <FaceDownCard width={s(150)} tilted float />
      </View>

      <Animated.View key={stepIndex} entering={FadeInDown.duration(340)} style={styles.copy}>
        <Text style={[styles.stepLabel, step.accentColor ? { color: step.accentColor } : null]}>
          {step.label}
        </Text>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.bodyText}>{step.body}</Text>

        {step.hasTimePicker && (
          <Animated.View entering={FadeIn.delay(160)} style={styles.timePicker}>
            <Pressable
              style={styles.timeStep}
              hitSlop={8}
              onPress={() =>
                setReminderMinutesTotal((prev) => (prev - MINUTE_STEP + MINUTES_PER_DAY) % MINUTES_PER_DAY)
              }
            >
              <Text style={styles.timeStepText}>−</Text>
            </Pressable>
            <Text style={styles.timeValue}>{formatTime(reminderHour, reminderMinute)}</Text>
            <Pressable
              style={styles.timeStep}
              hitSlop={8}
              onPress={() => setReminderMinutesTotal((prev) => (prev + MINUTE_STEP) % MINUTES_PER_DAY)}
            >
              <Text style={styles.timeStepText}>+</Text>
            </Pressable>
          </Animated.View>
        )}
      </Animated.View>

      <View style={styles.pipRow}>
        {STEPS.map((_, index) => (
          <View key={index} style={[styles.pip, index === stepIndex ? styles.pipActive : styles.pipInactive]} />
        ))}
      </View>

      <HardButton
        label={isLastStep ? 'Get started' : 'Next'}
        onPress={handleNext}
        style={styles.cta}
      />
    </View>
  );
}

function createStyles(skin: SkinTokens) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: skin.shell.background,
      paddingHorizontal: s(22),
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    wordmark: {
      ...display(13),
      color: skin.shell.accent,
    },
    skip: {
      ...mono(9, 0.14),
      color: skin.shell.textSecondary,
    },
    invisible: {
      opacity: 0,
    },
    stage: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: {
      gap: s(6),
      minHeight: s(150),
    },
    stepLabel: {
      ...mono(9, 0.2),
      color: skin.shell.accent,
    },
    title: {
      ...display(26, 1.05),
      color: skin.shell.textPrimary,
      marginTop: s(4),
    },
    bodyText: {
      ...body(13, 400, 1.5),
      color: skin.shell.textSecondary,
      marginTop: s(4),
    },
    timePicker: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s(14),
      marginTop: s(12),
    },
    timeStep: {
      width: s(34),
      height: s(34),
      borderRadius: s(8),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: withAlpha(skin.shell.textPrimary, 0.08),
    },
    timeStepText: {
      ...display(15),
      color: skin.shell.textPrimary,
    },
    timeValue: {
      ...mono(12, 0.08),
      color: skin.shell.textPrimary,
      minWidth: s(88),
      textAlign: 'center',
    },
    pipRow: {
      flexDirection: 'row',
      gap: s(5),
      marginVertical: s(18),
    },
    pip: {
      flex: 1,
      height: s(4),
      borderRadius: s(2),
    },
    pipActive: {
      backgroundColor: skin.shell.highlight,
    },
    pipInactive: {
      backgroundColor: withAlpha(skin.shell.textPrimary, 0.16),
    },
    cta: {
      alignSelf: 'stretch',
    },
  });
}
