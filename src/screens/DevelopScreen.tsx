import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Canvas,
  ColorMatrix,
  Fill,
  FractalNoise,
  Image as SkiaImage,
  RadialGradient,
  Rect,
  vec,
  type SkImage,
} from '@shopify/react-native-skia';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GRAIN_FREQUENCY,
  GRAIN_OCTAVES,
  grainColorMatrix,
  prepareEditableImage,
} from '../camera/develop';
import {
  buildDevelopMatrix,
  FILTERS,
  getFilter,
  NEUTRAL_RECIPE,
  recipeReadouts,
  totalGrain,
  totalVignette,
  type DevelopRecipe,
} from '../camera/filters';
import HardButton from '../components/HardButton';
import Slider from '../components/Slider';
import type { RootStackParamList } from '../navigation/types';
import { withAlpha } from '../theme/color';
import { placeholderHatch } from '../theme/gradients';
import type { SkinTokens } from '../theme/skins';
import { useSkin } from '../theme/SkinContext';
import { body, display, mono, s } from '../theme/typography';
import { todayDateKey } from '../utils/date';
import * as haptics from '../utils/haptics';
import { saveCardPhoto } from '../utils/photoStorage';

// Develop — the step between the shutter and the reveal.
//
// This screen exists because of a hard platform limit, and it is worth writing down so nobody
// tries the shortcut again. A filtered *live viewfinder* cannot be built on top of expo-camera:
//
//   * A translucent overlay can tint the preview but can never desaturate it, so monochrome
//     presets are impossible and everything else reads as a coloured sheet.
//   * `mixBlendMode` composites unreliably over a native preview layer, and when it silently
//     falls back to plain alpha an opaque black "saturation" layer is a black viewfinder.
//   * React Native's `filter` prop forces the view it is on into an offscreen layer. Put it on
//     an ancestor of a `CameraView` and the native preview goes black, freezes, or composites
//     only part of the frame. Tested on device; this is what broke the camera.
//
// Filtering live frames needs frame processors, which means react-native-vision-camera. Until
// that swap happens, the honest place to show a filter is on a still — where the *real* pipeline
// runs and what you see is what gets saved.
//
// The preview here is not an approximation. It is the same colour matrix, the same grain shader
// and the same vignette that `developPhoto` bakes in, drawn by Skia on a downscaled but
// otherwise identical copy of the capture. Confirming re-runs it at full resolution.

type DevelopNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Develop'>;
type DevelopRouteProp = RouteProp<RootStackParamList, 'Develop'>;

type DevelopKey = 'exposure' | 'contrast' | 'saturation' | 'warmth' | 'grain';

const DEVELOP_CONTROLS: { key: DevelopKey; label: string }[] = [
  { key: 'exposure', label: 'EXPOSURE' },
  { key: 'contrast', label: 'CONTRAST' },
  { key: 'saturation', label: 'SATURATION' },
  { key: 'warmth', label: 'WARMTH' },
  { key: 'grain', label: 'GRAIN' },
];

export default function DevelopScreen() {
  const navigation = useNavigation<DevelopNavigationProp>();
  const route = useRoute<DevelopRouteProp>();
  const { skin } = useSkin();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(skin), [skin]);

  const { sourceUri, sourceWidth, sourceHeight } = route.params;
  const reportedSize = useMemo(
    () => ({ width: sourceWidth, height: sourceHeight }),
    [sourceWidth, sourceHeight]
  );

  const [image, setImage] = useState<SkImage | null>(null);
  const [stageBox, setStageBox] = useState({ width: 0, height: 0 });
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [recipe, setRecipe] = useState<DevelopRecipe>(NEUTRAL_RECIPE);

  // Held in a ref as well as state so the cleanup runs against whatever is current, not against
  // the value captured when the effect first ran.
  const imageRef = useRef<SkImage | null>(null);

  useEffect(() => {
    let cancelled = false;
    prepareEditableImage(sourceUri, reportedSize)
      .then((prepared) => {
        if (cancelled) {
          prepared.dispose?.();
          return;
        }
        imageRef.current = prepared;
        setImage(prepared);
      })
      .catch((error) => {
        console.error('[develop] could not prepare the photo', error);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      imageRef.current?.dispose?.();
      imageRef.current = null;
    };
  }, [sourceUri, reportedSize]);

  const matrix = useMemo(() => buildDevelopMatrix(recipe), [recipe]);
  const grain = totalGrain(recipe);
  const vignette = totalVignette(recipe);

  // Fit the photo inside whatever the stage actually measures, by whichever axis binds first.
  // A portrait capture is taller than it is wide, so sizing from the width alone would push the
  // bottom of the image off the screen.
  const aspect = image ? image.width() / image.height() : 3 / 4;
  const { width: stageWidth, height: stageHeight } = fitInside(stageBox, aspect);

  function setDevelop(key: DevelopKey, value: number) {
    setRecipe((current) => ({ ...current, [key]: value }));
  }

  function reset() {
    haptics.tap();
    setRecipe((current) => ({ ...NEUTRAL_RECIPE, filterId: current.filterId }));
  }

  async function keep() {
    if (saving) return;
    setSaving(true);
    try {
      // Re-runs the same recipe at full resolution against the original capture — the preview
      // above is a smaller copy, never the file that gets stored.
      const stored = await saveCardPhoto(sourceUri, todayDateKey(), recipe, reportedSize);
      haptics.success();
      navigation.replace('Reveal', {
        photoUri: stored.photoUri,
        thumbUri: stored.thumbUri,
        filterId: recipe.filterId,
      });
    } catch (error) {
      haptics.failure();
      Alert.alert('Something went wrong', "Could not save today's card. Please try again.");
      console.error('[develop] save failed', error);
      setSaving(false);
    }
  }

  if (failed) {
    return (
      <View style={[styles.screen, styles.centred, { paddingTop: insets.top + s(24) }]}>
        <Text style={styles.errorTitle}>That photo couldn&apos;t be opened</Text>
        <Text style={styles.errorBody}>Go back and take another one.</Text>
        <HardButton label="Back to camera" onPress={() => navigation.goBack()} style={styles.errorButton} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + s(10) }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Discard and go back to the camera"
        >
          <Ionicons name="close" size={s(19)} color={skin.shell.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Develop</Text>
        <Pressable
          onPress={reset}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Reset all adjustments"
        >
          <Ionicons name="refresh-outline" size={s(18)} color={skin.shell.textSecondary} />
        </Pressable>
      </View>

      <View
        style={styles.stage}
        onLayout={(event) =>
          setStageBox({
            width: event.nativeEvent.layout.width,
            height: event.nativeEvent.layout.height,
          })
        }
      >
        <View
          style={[
            styles.canvasFrame,
            { width: stageWidth, height: stageHeight },
            placeholderHatch(withAlpha(skin.shell.textPrimary, 0.08)),
          ]}
        >
          {image && stageWidth > 0 && (
            <Canvas style={{ width: stageWidth, height: stageHeight }}>
              <SkiaImage image={image} x={0} y={0} width={stageWidth} height={stageHeight} fit="cover">
                <ColorMatrix matrix={matrix} />
              </SkiaImage>

              {vignette > 0 && (
                <Rect x={0} y={0} width={stageWidth} height={stageHeight}>
                  {/* Circular here, elliptical in the bake. At these strengths (under 0.17
                      alpha at the corners) the difference isn't visible; the bake keeps the
                      ellipse because it is correct on a tall frame. */}
                  <RadialGradient
                    c={vec(stageWidth / 2, stageHeight / 2)}
                    r={Math.max(stageWidth, stageHeight) * 0.62}
                    colors={['rgba(0,0,0,0)', `rgba(0,0,0,${(vignette * 0.55).toFixed(3)})`]}
                    positions={[0.45, 1]}
                  />
                </Rect>
              )}

              {/* Exactly what the bake draws: strength carried in the colour matrix's alpha
                  and composited with soft-light. The previous version pinned alpha to 1 and
                  put the strength in `opacity`, which rendered opaque noise over the whole
                  photo — the "static" this screen was showing. Most presets carry some grain of
                  their own, which is why it looked like every filter was broken. */}
              {grain > 0 && (
                <Fill blendMode="softLight">
                  <ColorMatrix matrix={grainColorMatrix(grain)} />
                  <FractalNoise freqX={GRAIN_FREQUENCY} freqY={GRAIN_FREQUENCY} octaves={GRAIN_OCTAVES} />
                </Fill>
              )}
            </Canvas>
          )}
        </View>
      </View>

      {/* Named tabs rather than an icon: this is the one place in the app where a filter can
          be chosen, so it should be obvious that both halves are here. */}
      <View style={styles.tabs}>
        {(
          [
            { key: false, label: 'FILTERS' },
            { key: true, label: 'ADJUST' },
          ] as const
        ).map((tab) => {
          const active = showControls === tab.key;
          return (
            <Pressable
              key={tab.label}
              onPress={() => {
                haptics.selection();
                setShowControls(tab.key);
              }}
              style={[styles.tab, active && styles.tabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={tab.label}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {showControls ? (
        <ScrollView
          style={styles.controls}
          contentContainerStyle={styles.controlsContent}
          showsVerticalScrollIndicator={false}
        >
          {DEVELOP_CONTROLS.map((control) => {
            const readout = recipeReadouts[control.key](recipe[control.key]);
            return (
              <View key={control.key} style={styles.control}>
                <View style={styles.controlLabelRow}>
                  <Text style={styles.controlLabel}>{control.label}</Text>
                  <Text style={styles.controlValue}>{readout}</Text>
                </View>
                <Slider
                  value={recipe[control.key]}
                  onChange={(next) => setDevelop(control.key, next)}
                  label={control.label}
                  valueText={readout}
                />
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterStrip}
        >
          {FILTERS.map((filter) => {
            const active = filter.id === recipe.filterId;
            return (
              <Pressable
                key={filter.id}
                style={styles.filterItem}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${filter.label} filter`}
                onPress={() => {
                  haptics.selection();
                  setRecipe((current) => ({ ...current, filterId: filter.id }));
                }}
              >
                <View
                  style={[
                    styles.filterSwatch,
                    { backgroundColor: filter.swatch },
                    active && {
                      boxShadow: [
                        { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 2, color: skin.shell.accent },
                      ],
                    },
                  ]}
                />
                <Text style={[styles.filterLabel, active && { color: skin.shell.accent }]}>
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + s(16) }]}>
        <Text style={styles.footerNote}>
          {getFilter(recipe.filterId).label === 'NONE'
            ? 'No filter — the photo as taken'
            : `${getFilter(recipe.filterId).label} · applied when you keep it`}
        </Text>
        <HardButton
          label={saving ? 'Developing…' : 'Keep this photo'}
          height={52}
          onPress={keep}
          disabled={saving || !image}
        />
      </View>
    </View>
  );
}

/** Largest box of the given aspect ratio that fits inside `box`. Zero until the stage measures. */
function fitInside(box: { width: number; height: number }, aspect: number) {
  if (box.width <= 0 || box.height <= 0) return { width: 0, height: 0 };
  const byWidth = { width: box.width, height: box.width / aspect };
  return byWidth.height <= box.height ? byWidth : { width: box.height * aspect, height: box.height };
}

function createStyles(skin: SkinTokens) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: skin.shell.background,
    },
    centred: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: s(10),
      paddingHorizontal: s(30),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: s(20),
    },
    headerTitle: {
      ...display(15),
      color: skin.shell.textPrimary,
    },
    stage: {
      flex: 1,
      minHeight: 0,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: s(14),
      paddingHorizontal: s(18),
    },
    canvasFrame: {
      borderRadius: s(6),
      overflow: 'hidden',
      backgroundColor: skin.cardstock.photoPlaceholder,
    },
    // A ScrollView defaults to `flexGrow: 1`. Left alone, both of these would fight the image
    // stage for vertical space instead of sitting under it at their natural height.
    filterScroll: {
      flexGrow: 0,
      flexShrink: 0,
    },
    filterStrip: {
      flexDirection: 'row',
      gap: s(8),
      paddingHorizontal: s(20),
      paddingBottom: s(6),
    },
    filterItem: {
      width: s(52),
    },
    filterSwatch: {
      height: s(52),
      borderRadius: s(6),
      overflow: 'hidden',
    },
    filterLabel: {
      ...mono(7.5, 0.1),
      color: withAlpha(skin.shell.textPrimary, 0.55),
      textAlign: 'center',
      marginTop: s(5),
    },
    controls: {
      flexGrow: 0,
      flexShrink: 0,
      maxHeight: s(230),
    },
    controlsContent: {
      paddingHorizontal: s(20),
      gap: s(6),
      paddingBottom: s(6),
    },
    control: {
      gap: s(2),
    },
    controlLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    controlLabel: {
      ...mono(8.5, 0.12),
      color: withAlpha(skin.shell.textPrimary, 0.6),
    },
    controlValue: {
      ...mono(8.5, 0.12),
      color: skin.shell.textPrimary,
    },
    tabs: {
      flexDirection: 'row',
      alignSelf: 'center',
      gap: s(4),
      padding: s(3),
      marginBottom: s(12),
      borderRadius: s(18),
      backgroundColor: withAlpha(skin.shell.textPrimary, 0.08),
    },
    tab: {
      paddingVertical: s(7),
      paddingHorizontal: s(16),
      borderRadius: s(15),
    },
    tabActive: {
      backgroundColor: skin.shell.accent,
    },
    tabText: {
      ...mono(9, 0.14),
      color: withAlpha(skin.shell.textPrimary, 0.55),
    },
    tabTextActive: {
      color: skin.shell.onAccent,
    },
    footer: {
      paddingHorizontal: s(20),
      paddingTop: s(14),
      gap: s(10),
    },
    footerNote: {
      ...mono(8.5, 0.12),
      color: withAlpha(skin.shell.textPrimary, 0.45),
      textAlign: 'center',
    },
    errorTitle: {
      ...display(18, 1.15),
      color: skin.shell.textPrimary,
      textAlign: 'center',
    },
    errorBody: {
      ...body(12.5, 400, 1.4),
      color: skin.shell.textSecondary,
      textAlign: 'center',
    },
    errorButton: {
      alignSelf: 'stretch',
      marginTop: s(8),
    },
  });
}
