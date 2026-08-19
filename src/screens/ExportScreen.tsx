import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, PixelRatio, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import { captureRef } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { CaptureProvider } from '../components/CaptureContext';
import HardButton from '../components/HardButton';
import ShareCanvas, {
  ASPECT_ORDER,
  ASPECT_RATIOS,
  EXPORT_WIDTH,
  TEMPLATES,
  type AspectId,
  type ShareOverlays,
  type ShareSubject,
  type TemplateId,
} from '../components/share/ShareCanvas';
import { getAllCards, getCardById, getEarliestCardDate } from '../db/cardsRepository';
import { getInstalledAt } from '../db/settingsRepository';
import type { RootStackParamList } from '../navigation/types';
import { withAlpha } from '../theme/color';
import type { SkinTokens } from '../theme/skins';
import { useSkin } from '../theme/SkinContext';
import { body, display, mono, s } from '../theme/typography';
import { buildSets, getSetNumberForDate } from '../utils/sets';

// Share — replaces the old single-purpose Export screen. Two things changed:
//
//  1. The subject can be a whole Set, not just one card, so a finished week can go out as a
//     single image.
//  2. Each subject has several templates rather than one styled frame, and an output ratio
//     (1:1 / 4:5 / 9:16) so a story-shaped export isn't a cropped square.
//
// Everything is composed by `ShareCanvas`, which sizes itself from its `width` prop. That
// lets the same component render the small preview *and* the full-size image: the capture
// target is laid out at EXPORT_WIDTH and merely scaled down for display, so the snapshot has
// real 1080px-wide type rather than upscaled phone-sized type.

type ExportNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Export'>;
type ExportRouteProp = RouteProp<RootStackParamList, 'Export'>;

/**
 * Layout width for the capture. Chosen so `width × pixelRatio` lands near the 1080px output
 * we want, and capped well below it so no device tries to lay out a canvas measured in
 * thousands of points — that is what previously exhausted memory during the snapshot.
 */
const CAPTURE_LAYOUT_WIDTH = Math.min(540, Math.round(EXPORT_WIDTH / PixelRatio.get()));

/** Tallest the on-screen preview is allowed to get, so the controls stay reachable. */
const MAX_PREVIEW_HEIGHT = 330;

/** Time for the canvas to settle after `capturing` flips, before snapshotting. */
const CAPTURE_SETTLE_MS = 220;

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const OVERLAY_CHIPS: { key: keyof ShareOverlays; label: string }[] = [
  { key: 'date', label: 'DATE' },
  { key: 'title', label: 'TITLE' },
  { key: 'vibe', label: 'VIBE' },
  { key: 'setNumber', label: 'SET NO.' },
  { key: 'holoSheen', label: 'HOLO SHEEN' },
];

export default function ExportScreen() {
  const navigation = useNavigation<ExportNavigationProp>();
  const route = useRoute<ExportRouteProp>();
  const db = useSQLiteContext();
  const { skin } = useSkin();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(skin), [skin]);
  const captureViewRef = useRef<View>(null);

  const [subject, setSubject] = useState<ShareSubject | null>(null);
  const [template, setTemplate] = useState<TemplateId | null>(null);
  const [aspect, setAspect] = useState<AspectId>('4:5');
  const [overlays, setOverlays] = useState<ShareOverlays>({
    date: true,
    title: true,
    vibe: true,
    setNumber: true,
    holoSheen: true,
  });
  const [saveRawInstead, setSaveRawInstead] = useState(false);
  const [busy, setBusy] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const { cardId, setStartDate } = route.params;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cardId != null) {
        const [card, earliest] = await Promise.all([getCardById(db, cardId), getEarliestCardDate(db)]);
        if (cancelled || !card) return;
        setSubject({
          kind: 'card',
          card,
          setNumber: getSetNumberForDate(card.date, earliest ?? card.date),
        });
        setTemplate('classic');
        return;
      }
      if (setStartDate) {
        const [cards, installedAt] = await Promise.all([getAllCards(db), getInstalledAt(db)]);
        if (cancelled) return;
        const found = buildSets(cards, installedAt ?? setStartDate).find(
          (candidate) => candidate.startDate === setStartDate
        );
        if (!found) return;
        setSubject({ kind: 'set', set: found });
        setTemplate('grid');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, cardId, setStartDate]);

  const availableTemplates = useMemo(
    () => TEMPLATES.filter((entry) => entry.subject === (subject?.kind ?? 'card')),
    [subject?.kind]
  );

  /**
   * Rasterizes the export from the on-screen preview.
   *
   * This has been through three shapes, and the current one is deliberately the least clever:
   *
   *   1. A ~200pt preview upscaled via captureRef's `width`/`height`. Soft output.
   *   2. The canvas laid out at 1080 *points* and transform-scaled down for display. On a 3×
   *      device that is a 3240px-wide backing store — ~50-75MB for a 4:5 or 9:16 frame — which
   *      is enough to take the process down mid-snapshot.
   *   3. A separate copy mounted off-screen at `left: -10000`. Lighter, but snapshotting a
   *      view that is outside the window is itself unreliable: iOS's view-hierarchy drawing
   *      has no guarantee for views the compositor never had reason to render.
   *
   * Now: the canvas is laid out at `CAPTURE_LAYOUT_WIDTH` (~360pt, so `layout × pixelRatio`
   * still lands near 1080px) and shrunk for display with a transform on the captured node
   * itself. That transform is safe — both backends rasterize from the view's *layout* bounds
   * (`view.bounds` on iOS, `getWidth()/getHeight()` on Android), and a view's own transform
   * affects its frame within its parent, not the content it draws. Shape 2's mistake was the
   * 1080-point layout, not the scaling.
   *
   * `capturing` is flipped first so the subtree drops its blend layers, and a couple of frames
   * plus a short settle are yielded so that re-render commits before the snapshot.
   */
  const renderToFile = useCallback(async (): Promise<string | null> => {
    setCapturing(true);
    try {
      await nextFrame();
      await nextFrame();
      await delay(CAPTURE_SETTLE_MS);
      if (!captureViewRef.current) return null;
      const uri = await captureRef(captureViewRef, { format: 'png', quality: 1, result: 'tmpfile' });
      return uri ? toFileUri(uri) : null;
    } catch (error) {
      console.error('[share] captureRef failed', error);
      throw error;
    } finally {
      setCapturing(false);
    }
  }, []);

  async function resolveUri(): Promise<string | null> {
    if (saveRawInstead && subject?.kind === 'card') return toFileUri(subject.card.photoUri);
    return renderToFile();
  }

  async function handleSave() {
    if (busy || !subject) return;
    setBusy(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to save your image.');
        return;
      }
      const uri = await resolveUri();
      if (!uri) {
        Alert.alert('Nothing to save', 'The image could not be rendered. Please try again.');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved', 'The image was saved to your photo library.');
    } catch (error) {
      Alert.alert('Could not save', describe(error));
      console.error('[share] save failed', error);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Saves each of a Set's photos to the library as its own original file — no composition,
   * no downscale. Separate from "Save image", which produces one composed picture.
   */
  async function handleSaveEachPhoto() {
    if (busy || subject?.kind !== 'set') return;
    const photos = subject.set.cards.filter((card): card is NonNullable<typeof card> => card !== null);
    if (photos.length === 0) return;

    setBusy(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to save these photos.');
        return;
      }
      let saved = 0;
      const failures: string[] = [];
      for (const card of photos) {
        try {
          await MediaLibrary.saveToLibraryAsync(toFileUri(card.photoUri));
          saved += 1;
        } catch (error) {
          failures.push(card.date);
          console.error('[share] could not save photo', card.date, error);
        }
      }
      // Reported honestly rather than as a blanket success — a partial save is the likely
      // outcome if a photo file went missing, and silently claiming all N saved would hide it.
      Alert.alert(
        failures.length === 0 ? 'Saved' : 'Partly saved',
        failures.length === 0
          ? `${saved} ${saved === 1 ? 'photo' : 'photos'} saved to your library.`
          : `${saved} of ${photos.length} saved. Could not save: ${failures.join(', ')}.`
      );
    } catch (error) {
      Alert.alert('Could not save', describe(error));
      console.error('[share] batch save failed', error);
    } finally {
      setBusy(false);
    }
  }

  async function handleShare() {
    if (busy || !subject) return;
    setBusy(true);
    try {
      const uri = await resolveUri();
      if (!uri) {
        Alert.alert('Nothing to share', 'The image could not be rendered. Please try again.');
        return;
      }

      // expo-sharing gives the native sheet (Instagram, Messages, AirDrop…) and is the
      // preferred path. It throws if the native module isn't in this build, so RN's own
      // Share API is kept as a fallback rather than letting that surface as a crash.
      let sharedViaExpo = false;
      try {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' });
          sharedViaExpo = true;
        }
      } catch (error) {
        console.warn('[share] expo-sharing unavailable, falling back to Share API', error);
      }
      if (!sharedViaExpo) await Share.share({ url: uri, message: '' });
    } catch (error) {
      Alert.alert('Could not share', describe(error));
      console.error('[share] share failed', error);
    } finally {
      setBusy(false);
    }
  }

  if (!subject || !template) return <View style={styles.screen} />;

  const ratio = ASPECT_RATIOS[aspect];
  // Display size: as wide as fits without the preview growing taller than the stage allows —
  // a 9:16 frame has to come down a lot more than a square one.
  const previewWidth = Math.min(s(250), s(MAX_PREVIEW_HEIGHT) * ratio);
  const previewHeight = previewWidth / ratio;
  const previewScale = previewWidth / CAPTURE_LAYOUT_WIDTH;
  const isCardSubject = subject.kind === 'card';
  const canvasOverlays = saveRawInstead ? BARE_OVERLAYS : overlays;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + s(12) }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="close" size={s(18)} color={withAlpha(skin.shell.textPrimary, 0.7)} />
        </Pressable>
        <Text style={styles.headerTitle}>Share</Text>
        <Pressable onPress={handleSave} hitSlop={12} disabled={busy}>
          <Text style={styles.headerAction}>Save</Text>
        </Pressable>
      </View>

      <View style={styles.stage}>
        {/* The preview *is* the capture target — laid out at export size, scaled for display.
            See `renderToFile` for why the transform is safe. */}
        <View style={{ width: previewWidth, height: previewHeight }}>
          <View
            ref={captureViewRef}
            collapsable={false}
            style={{
              width: CAPTURE_LAYOUT_WIDTH,
              height: CAPTURE_LAYOUT_WIDTH / ratio,
              transform: [{ scale: previewScale }],
              transformOrigin: 'top left',
            }}
          >
            <CaptureProvider capturing={capturing}>
              <ShareCanvas
                subject={subject}
                template={template}
                aspect={aspect}
                width={CAPTURE_LAYOUT_WIDTH}
                overlays={canvasOverlays}
              />
            </CaptureProvider>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.controls}
        contentContainerStyle={[styles.controlsContent, { paddingBottom: insets.bottom + s(20) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={saveRawInstead ? styles.dimmed : undefined}>
          <Text style={styles.sectionLabel}>TEMPLATE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {availableTemplates.map((entry) => {
              const active = template === entry.id;
              return (
                <Pressable
                  key={entry.id}
                  disabled={saveRawInstead}
                  onPress={() => setTemplate(entry.id)}
                  style={[styles.templateChip, active && styles.templateChipActive]}
                >
                  <Text style={[styles.templateLabel, active && styles.templateLabelActive]}>{entry.label}</Text>
                  <Text style={[styles.templateHint, active && styles.templateHintActive]}>{entry.hint}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={saveRawInstead ? styles.dimmed : undefined}>
          <Text style={styles.sectionLabel}>SIZE</Text>
          <View style={styles.aspectRow}>
            {ASPECT_ORDER.map((option) => {
              const active = aspect === option;
              return (
                <Pressable
                  key={option}
                  disabled={saveRawInstead}
                  onPress={() => setAspect(option)}
                  style={[styles.aspectButton, active && styles.aspectButtonActive]}
                >
                  <Text style={[styles.aspectLabel, active && styles.aspectLabelActive]}>{option}</Text>
                  <Text style={[styles.aspectHint, active && styles.aspectHintActive]}>
                    {option === '9:16' ? 'STORY' : option === '4:5' ? 'FEED' : 'SQUARE'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={saveRawInstead ? styles.dimmed : undefined}>
          <Text style={styles.sectionLabel}>SHOW</Text>
          <View style={styles.chipWrap}>
            {OVERLAY_CHIPS.map((chip) => {
              const on = overlays[chip.key];
              return (
                <Pressable
                  key={chip.key}
                  disabled={saveRawInstead}
                  onPress={() => setOverlays((current) => ({ ...current, [chip.key]: !current[chip.key] }))}
                  style={[styles.overlayChip, on && styles.overlayChipOn]}
                >
                  <Text style={[styles.overlayChipText, on && styles.overlayChipTextOn]}>
                    {chip.label}
                    {on ? ' ✓' : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {isCardSubject ? (
          <Pressable style={styles.rawRow} onPress={() => setSaveRawInstead((value) => !value)}>
            <View style={styles.rawCopy}>
              <Text style={styles.rawTitle}>Use the raw photo instead</Text>
              <Text style={styles.rawSubtitle}>
                Unstyled, full resolution — applies to both Save and Share
              </Text>
            </View>
            <PillSwitch value={saveRawInstead} skin={skin} />
          </Pressable>
        ) : (
          <Pressable style={styles.rawRow} onPress={handleSaveEachPhoto} disabled={busy}>
            <View style={styles.rawCopy}>
              <Text style={styles.rawTitle}>Save each photo separately</Text>
              <Text style={styles.rawSubtitle}>
                {subject.set.cardCount} {subject.set.cardCount === 1 ? 'original' : 'originals'}, full
                resolution, unstyled
              </Text>
            </View>
            <Ionicons name="download-outline" size={s(20)} color={skin.shell.accent} />
          </Pressable>
        )}

        <View style={styles.buttonRow}>
          <HardButton
            label="Save image"
            variant="secondary"
            depth={0}
            height={48}
            onPress={handleSave}
            disabled={busy}
            style={styles.saveButton}
          />
          <HardButton
            label={busy ? 'Working…' : 'Share'}
            depth={4}
            height={48}
            fontSize={12.5}
            onPress={handleShare}
            disabled={busy}
            style={styles.shareButton}
          />
        </View>
      </ScrollView>
    </View>
  );
}

/** With "save raw photo" on, the preview shows the untouched photo — no overlays at all. */
const BARE_OVERLAYS: ShareOverlays = {
  date: false,
  title: false,
  vibe: false,
  setNumber: false,
  holoSheen: false,
};

/** MediaLibrary and the share sheet both want a scheme; captureRef can return a bare path. */
function toFileUri(path: string): string {
  return path.startsWith('file://') || path.startsWith('content://') || path.startsWith('ph://')
    ? path
    : `file://${path}`;
}

function describe(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Please try again.';
}

/** The mockup's 40x23 pill toggle (2h), rather than the platform Switch. */
function PillSwitch({ value, skin }: { value: boolean; skin: SkinTokens }) {
  const progress = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 180 });
  }, [value, progress]);

  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: progress.value * s(17) }] }));

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
        entering={FadeIn}
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
      ...display(15),
      color: skin.shell.textPrimary,
    },
    headerAction: {
      ...body(11, 600),
      color: skin.shell.accent,
    },
    stage: {
      flex: 1,
      minHeight: s(200),
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: s(14),
      backgroundColor: skin.shell.surface,
      marginTop: s(14),
      overflow: 'hidden',
    },
    controls: {
      flexShrink: 0,
    },
    controlsContent: {
      paddingTop: s(16),
      gap: s(14),
    },
    sectionLabel: {
      ...mono(9, 0.16),
      color: withAlpha(skin.shell.textPrimary, 0.45),
      marginBottom: s(9),
      paddingHorizontal: s(22),
    },
    chipRow: {
      gap: s(7),
      paddingHorizontal: s(22),
    },
    templateChip: {
      paddingVertical: s(9),
      paddingHorizontal: s(12),
      borderRadius: s(8),
      backgroundColor: withAlpha(skin.shell.textPrimary, 0.09),
      minWidth: s(96),
    },
    templateChipActive: {
      backgroundColor: skin.shell.accent,
    },
    templateLabel: {
      ...body(10, 600),
      letterSpacing: s(0.8),
      color: withAlpha(skin.shell.textPrimary, 0.85),
    },
    templateLabelActive: {
      color: skin.shell.onAccent,
    },
    templateHint: {
      ...body(9, 400, 1.3),
      color: withAlpha(skin.shell.textPrimary, 0.4),
      marginTop: s(3),
    },
    templateHintActive: {
      color: withAlpha(skin.shell.onAccent, 0.75),
    },
    aspectRow: {
      flexDirection: 'row',
      gap: s(7),
      paddingHorizontal: s(22),
    },
    aspectButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: s(9),
      borderRadius: s(6),
      backgroundColor: withAlpha(skin.shell.textPrimary, 0.09),
    },
    aspectButtonActive: {
      backgroundColor: skin.shell.accent,
    },
    aspectLabel: {
      ...mono(11, 0.06),
      color: withAlpha(skin.shell.textPrimary, 0.85),
    },
    aspectLabelActive: {
      color: skin.shell.onAccent,
    },
    aspectHint: {
      ...mono(7.5, 0.12),
      color: withAlpha(skin.shell.textPrimary, 0.4),
      marginTop: s(3),
    },
    aspectHintActive: {
      color: withAlpha(skin.shell.onAccent, 0.7),
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: s(7),
      paddingHorizontal: s(22),
    },
    overlayChip: {
      paddingVertical: s(8),
      paddingHorizontal: s(11),
      borderRadius: s(16),
      backgroundColor: withAlpha(skin.shell.textPrimary, 0.08),
    },
    overlayChipOn: {
      backgroundColor: withAlpha(skin.shell.accent, 0.16),
      boxShadow: [
        { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: withAlpha(skin.shell.accent, 0.5), inset: true },
      ],
    },
    overlayChipText: {
      ...mono(9, 0.08),
      color: withAlpha(skin.shell.textPrimary, 0.45),
    },
    overlayChipTextOn: {
      color: skin.shell.accent,
    },
    dimmed: {
      opacity: 0.4,
    },
    rawRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: s(12),
      paddingHorizontal: s(14),
      marginHorizontal: s(22),
      borderRadius: s(8),
      backgroundColor: withAlpha(skin.shell.textPrimary, 0.06),
    },
    rawCopy: {
      flexShrink: 1,
    },
    rawTitle: {
      ...body(11.5, 600, 1.2),
      color: skin.shell.textPrimary,
    },
    rawSubtitle: {
      ...body(10, 400, 1.3),
      color: withAlpha(skin.shell.textPrimary, 0.45),
      marginTop: s(3),
    },
    buttonRow: {
      flexDirection: 'row',
      gap: s(9),
      marginTop: s(4),
      paddingHorizontal: s(22),
    },
    saveButton: {
      flex: 1,
    },
    shareButton: {
      flex: 1.3,
    },
  });
}
