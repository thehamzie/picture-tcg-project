import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useCards } from '../hooks/useCards';
import {
  getReminder,
  setReminder as persistReminder,
  type ReminderSetting,
} from '../db/settingsRepository';
import type { RootStackParamList } from '../navigation/types';
import { withAlpha } from '../theme/color';
import { linearGradient } from '../theme/gradients';
import { SKIN_SWATCHES, type SkinTokens } from '../theme/skins';
import { useSkin } from '../theme/SkinContext';
import { body, display, mono, s } from '../theme/typography';
import {
  restoreFromArchive,
  saveAllPhotosToLibrary,
  writeBackupArchive,
  writeCollectionExport,
} from '../utils/backup';
import { formatMonoDate } from '../utils/date';
import * as haptics from '../utils/haptics';
import { resetThumbnailBackfill } from '../hooks/useThumbnailBackfill';
import { cancelDailyReminder, requestNotificationPermission, scheduleDailyReminder } from '../utils/notifications';

// Settings. Three things live here that previously had no home at all: the reminder (scheduled
// once during onboarding and then unreachable), the skin picker (behind an unlabelled palette
// icon), and getting a copy of the collection out of the app.

const MINUTE_STEP = 15;
const MINUTES_PER_DAY = 24 * 60;

// Resolved on the JS thread at module load, NOT inside the worklet below. `s()` is an ordinary
// imported function; calling it from a worklet running on the UI runtime throws "tried to
// synchronously call a non-worklet function", which surfaces as a hard native crash with no JS
// error rather than something the ErrorBoundary can catch.
const KNOB_TRAVEL = s(17);

type SettingsNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

export default function SettingsScreen() {
  const navigation = useNavigation<SettingsNavigationProp>();
  const db = useSQLiteContext();
  const { cards, refresh } = useCards();
  const { skin, skinId } = useSkin();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(skin), [skin]);

  const [reminder, setReminderState] = useState<ReminderSetting | null>(null);
  const [busy, setBusy] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getReminder(db).then((value) => {
      if (!cancelled) setReminderState(value);
    });
    return () => {
      cancelled = true;
    };
  }, [db]);

  const applyReminder = useCallback(
    async (next: ReminderSetting) => {
      setReminderState(next);
      await persistReminder(db, next);
      if (!next.enabled) {
        await cancelDailyReminder();
        return;
      }
      const granted = await requestNotificationPermission();
      if (!granted) {
        // Reflect reality rather than showing an "on" switch for a notification the OS will
        // never deliver.
        const disabled = { ...next, enabled: false };
        setReminderState(disabled);
        await persistReminder(db, disabled);
        Alert.alert('Notifications are off', 'Turn on notifications for Daily Pull in your system settings first.');
        return;
      }
      await scheduleDailyReminder(next.hour, next.minute);
    },
    [db]
  );

  function shiftReminder(deltaMinutes: number) {
    if (!reminder) return;
    const total = (reminder.hour * 60 + reminder.minute + deltaMinutes + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    applyReminder({ ...reminder, hour: Math.floor(total / 60), minute: total % 60 });
  }

  async function handleSaveAllPhotos() {
    if (busy || cards.length === 0) return;
    setBusy(true);
    setProgressLabel(`0 / ${cards.length}`);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to copy your photos out.');
        return;
      }
      const result = await saveAllPhotosToLibrary(cards, ({ done, total }) =>
        setProgressLabel(`${done} / ${total}`)
      );
      Alert.alert(
        result.failed.length === 0 ? 'Photos copied' : 'Partly copied',
        result.failed.length === 0
          ? `${result.saved} ${result.saved === 1 ? 'photo is' : 'photos are'} now in your photo library, where your phone's own backup will pick them up.`
          : `${result.saved} of ${cards.length} copied. Could not copy: ${result.failed.slice(0, 5).join(', ')}${result.failed.length > 5 ? '…' : ''}.`
      );
    } catch (error) {
      Alert.alert('Could not copy photos', describe(error));
      console.error('[settings] save all failed', error);
    } finally {
      setBusy(false);
      setProgressLabel(null);
    }
  }

  async function handleBackup() {
    if (busy || cards.length === 0) return;
    setBusy(true);
    setProgressLabel(`0 / ${cards.length}`);
    try {
      const result = await writeBackupArchive(cards, ({ done, total }) =>
        setProgressLabel(`${done} / ${total}`)
      );
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, {
          mimeType: 'application/octet-stream',
          UTI: 'public.data',
          dialogTitle: 'Save your Daily Pull backup',
        });
      } else {
        Alert.alert('Backup written', `Saved to ${result.uri}`);
      }
      if (result.skipped.length > 0) {
        // Named rather than glossed over: a skipped card means its photo file is missing from
        // this phone, which the user probably wants to know about independently of the backup.
        Alert.alert(
          'Backed up, with gaps',
          `${result.cardCount} cards are in the backup. ${result.skipped.length} could not be included because their photo is missing: ${result.skipped.slice(0, 5).join(', ')}${result.skipped.length > 5 ? '…' : ''}.`
        );
      }
    } catch (error) {
      Alert.alert('Could not back up', describe(error));
      console.error('[settings] backup failed', error);
    } finally {
      setBusy(false);
      setProgressLabel(null);
    }
  }

  async function handleRestore() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await restoreFromArchive(db, ({ done, total }) =>
        setProgressLabel(`${done} / ${total}`)
      );
      if (result.cancelled) return;

      // New rows arrive without thumbnails when one couldn't be built, so let the backfill run
      // again this session rather than waiting for the next launch.
      resetThumbnailBackfill();
      await refresh();
      haptics.success();

      const parts = [`${result.restored} restored`];
      if (result.alreadyPresent > 0) parts.push(`${result.alreadyPresent} already in your binder`);
      if (result.failed.length > 0) parts.push(`${result.failed.length} could not be read`);
      Alert.alert(result.restored > 0 ? 'Restored' : 'Nothing to restore', `${parts.join(', ')}.`);
    } catch (error) {
      Alert.alert('Could not restore', describe(error));
      console.error('[settings] restore failed', error);
    } finally {
      setBusy(false);
      setProgressLabel(null);
    }
  }

  async function handleExportData() {
    if (busy || cards.length === 0) return;
    setBusy(true);
    try {
      const uri = writeCollectionExport(cards);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Export collection' });
      } else {
        Alert.alert('Export written', `Saved to ${uri}`);
      }
    } catch (error) {
      Alert.alert('Could not export', describe(error));
      console.error('[settings] export failed', error);
    } finally {
      setBusy(false);
    }
  }

  const firstCardDate = cards.length > 0 ? cards.reduce((min, c) => (c.date < min ? c.date : min), cards[0].date) : null;
  const holoCount = cards.filter((card) => card.isHolo).length;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + s(12) }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close settings"
        >
          <Ionicons name="close" size={s(20)} color={skin.shell.textPrimary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + s(28) }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>DAILY REMINDER</Text>
        <View style={styles.card}>
          <Pressable
            style={styles.row}
            onPress={() => reminder && applyReminder({ ...reminder, enabled: !reminder.enabled })}
          >
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Remind me once a day</Text>
              <Text style={styles.rowSubtitle}>One nudge, never a second.</Text>
            </View>
            <PillSwitch value={reminder?.enabled ?? false} skin={skin} />
          </Pressable>

          {reminder?.enabled && (
            <View style={styles.timeRow}>
              <Pressable
                style={styles.timeStep}
                onPress={() => shiftReminder(-MINUTE_STEP)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Fifteen minutes earlier"
              >
                <Text style={styles.timeStepText}>−</Text>
              </Pressable>
              <Text style={styles.timeValue} accessibilityLabel={`Reminder at ${formatTime(reminder.hour, reminder.minute)}`}>
                {formatTime(reminder.hour, reminder.minute)}
              </Text>
              <Pressable
                style={styles.timeStep}
                onPress={() => shiftReminder(MINUTE_STEP)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Fifteen minutes later"
              >
                <Text style={styles.timeStepText}>+</Text>
              </Pressable>
            </View>
          )}
        </View>

        <Text style={styles.sectionLabel}>APPEARANCE</Text>
        <Pressable style={styles.card} onPress={() => navigation.navigate('SkinSelector')}>
          <View style={styles.row}>
            <View style={styles.swatchStrip}>
              {SKIN_SWATCHES[skinId].map((colors, index) => (
                <View key={index} style={[styles.swatch, linearGradient(colors, 150)]} />
              ))}
            </View>
            <View style={styles.rowCopyGrow}>
              <Text style={styles.rowTitle}>Binder skin</Text>
              <Text style={styles.rowSubtitle}>{skin.name}</Text>
            </View>
            <Ionicons name="chevron-forward" size={s(16)} color={skin.shell.textSecondary} />
          </View>
        </Pressable>

        <Text style={styles.sectionLabel}>BACKUP</Text>
        <View style={styles.card}>
          {/* Stated plainly, because the consequence is permanent and most people assume
              otherwise about an app that holds photos. */}
          <Text style={styles.warning}>
            Your cards live only on this phone. If Daily Pull is deleted, they go with it.
          </Text>

          <Pressable style={styles.row} onPress={handleBackup} disabled={busy || cards.length === 0}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Back up everything</Text>
              <Text style={styles.rowSubtitle}>
                {progressLabel
                  ? `Packing ${progressLabel}…`
                  : 'One file with every photo and record — save it somewhere safe'}
              </Text>
            </View>
            <Ionicons name="archive-outline" size={s(19)} color={skin.shell.accent} />
          </Pressable>

          <View style={styles.divider} />

          <Pressable style={styles.row} onPress={handleRestore} disabled={busy}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Restore from a backup</Text>
              <Text style={styles.rowSubtitle}>
                Adds any days you don&apos;t already have. Nothing here is overwritten.
              </Text>
            </View>
            <Ionicons name="download-outline" size={s(19)} color={skin.shell.accent} />
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>YOUR COLLECTION</Text>
        <View style={styles.card}>
          <Pressable style={styles.row} onPress={handleSaveAllPhotos} disabled={busy || cards.length === 0}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Copy every photo to Photos</Text>
              <Text style={styles.rowSubtitle}>
                {progressLabel
                  ? `Copying ${progressLabel}…`
                  : `${cards.length} ${cards.length === 1 ? 'photo' : 'photos'} — your phone's backup then covers them`}
              </Text>
            </View>
            <Ionicons name="images-outline" size={s(19)} color={skin.shell.accent} />
          </Pressable>

          <View style={styles.divider} />

          <Pressable style={styles.row} onPress={handleExportData} disabled={busy || cards.length === 0}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Export your records</Text>
              <Text style={styles.rowSubtitle}>Dates, titles, tags and rarity as a data file</Text>
            </View>
            <Ionicons name="document-text-outline" size={s(19)} color={skin.shell.accent} />
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.card}>
          <View style={styles.statRow}>
            <Stat styles={styles} label="CARDS" value={String(cards.length)} />
            <Stat styles={styles} label="HOLO" value={String(holoCount)} />
            <Stat
              styles={styles}
              label="SINCE"
              value={firstCardDate ? formatMonoDate(firstCardDate) : '—'}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({
  styles,
  label,
  value,
}: {
  styles: ReturnType<typeof createStyles>;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function PillSwitch({ value, skin }: { value: boolean; skin: SkinTokens }) {
  const progress = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 180 });
  }, [value, progress]);
  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: progress.value * KNOB_TRAVEL }] }));

  return (
    <View
      style={{
        width: s(40),
        height: s(23),
        borderRadius: s(12),
        padding: s(2.5),
        backgroundColor: value ? skin.shell.accent : withAlpha(skin.shell.textPrimary, 0.18),
      }}
    >
      <Animated.View
        style={[
          {
            width: s(18),
            height: s(18),
            borderRadius: s(9),
            backgroundColor: value ? skin.shell.onAccent : skin.shell.textPrimary,
          },
          knobStyle,
        ]}
      />
    </View>
  );
}

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
}

function describe(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Please try again.';
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
      paddingHorizontal: s(22),
    },
    headerTitle: {
      ...display(20),
      color: skin.shell.textPrimary,
    },
    content: {
      paddingHorizontal: s(22),
      paddingTop: s(18),
    },
    sectionLabel: {
      ...mono(9, 0.16),
      color: withAlpha(skin.shell.textPrimary, 0.45),
      marginBottom: s(9),
      marginTop: s(18),
    },
    card: {
      borderRadius: s(10),
      backgroundColor: skin.shell.surface,
      paddingHorizontal: s(14),
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s(12),
      paddingVertical: s(14),
    },
    rowCopy: {
      flex: 1,
    },
    rowCopyGrow: {
      flex: 1,
    },
    rowTitle: {
      ...body(12.5, 600, 1.25),
      color: skin.shell.textPrimary,
    },
    rowSubtitle: {
      ...body(10.5, 400, 1.35),
      color: withAlpha(skin.shell.textPrimary, 0.45),
      marginTop: s(3),
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: withAlpha(skin.shell.textPrimary, 0.1),
    },
    warning: {
      ...body(10.5, 400, 1.45),
      color: skin.shell.accent,
      paddingTop: s(14),
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s(16),
      paddingBottom: s(16),
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
      ...mono(13, 0.08),
      color: skin.shell.textPrimary,
      minWidth: s(96),
      textAlign: 'center',
    },
    swatchStrip: {
      flexDirection: 'row',
      gap: s(3),
    },
    swatch: {
      width: s(9),
      height: s(30),
      borderRadius: s(2),
    },
    statRow: {
      flexDirection: 'row',
      paddingVertical: s(16),
    },
    stat: {
      flex: 1,
      alignItems: 'center',
      gap: s(6),
    },
    statValue: {
      ...display(20),
      color: skin.shell.textPrimary,
    },
    statLabel: {
      ...mono(8, 0.16),
      color: withAlpha(skin.shell.textPrimary, 0.45),
    },
  });
}
