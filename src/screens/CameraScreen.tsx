import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions, type CameraType, type FlashMode, type FocusMode } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { runOnJS, SlideInDown, SlideOutDown, useSharedValue } from 'react-native-reanimated';

import {
  classifyLenses,
  factorForZoom,
  formatFactor,
  LN_MAX_FACTOR,
  ZOOM_STOPS,
  zoomForFactor,
} from '../camera/zoom';
import HardButton from '../components/HardButton';
import Slider from '../components/Slider';
import type { RootStackParamList } from '../navigation/types';
import { withAlpha } from '../theme/color';
import type { SkinTokens } from '../theme/skins';
import { useSkin } from '../theme/SkinContext';
import { body, display, mono, s } from '../theme/typography';
import * as haptics from '../utils/haptics';

// Camera — mockups 2b (auto) and 2c (manual drawer).
//
// Auto and manual are ONE screen with one `CameraView`, not two screens. That's what the
// mockup describes ("manual drawer pulled up… auto still shoots underneath"), and it removes
// the failure mode that a separate manual screen kept reintroducing: two mounted CameraViews
// meant two native capture sessions competing for the same hardware, which crashes. There is
// now exactly one camera in the app, and it is unmounted whenever the screen isn't focused.
//
// ---------------------------------------------------------------------------------------
// NOTHING MAY WRAP OR DRAW OVER THE CAMERA EXCEPT PLAIN TRANSLUCENT VIEWS.
//
// Three attempts at a filtered live viewfinder have failed on device, each differently, and
// each is worth naming so it isn't retried:
//
//   1. A flat alpha tint. Works, but can only ever wash the image — it cannot desaturate, so
//      the monochrome presets were impossible and the rest read as coloured sheets.
//   2. `mixBlendMode` layers. Blend modes composite unreliably over a native preview layer, and
//      when the mode is silently ignored an opaque black "saturation" layer is a black screen.
//   3. React Native's `filter` prop on a view wrapping the `CameraView`. `filter` forces its
//      view into an offscreen layer, which the native camera surface is not part of — the
//      preview went black, froze, or rendered only part of the frame. This is what broke the
//      camera, and it is why the filter strip here only *chooses* a filter.
//
// Filtering live frames needs frame processors, i.e. react-native-vision-camera. Until then the
// real filtering happens one screen later, in DevelopScreen, on the captured still — where the
// actual pipeline runs and the preview is exact rather than approximate.
// ---------------------------------------------------------------------------------------
//
// Which controls act on the sensor, and therefore live here:
//   ZOOM   CameraView's `zoom` prop (0..1), both platforms.
//   FOCUS  binary — expo-camera exposes autofocus only as an on/off `FocusMode` (`'on'` =
//          focus once then lock), not a manual distance. iOS only.
//   FLASH / TORCH  both platforms.
//
// Exposure, contrast, saturation, warmth and grain are develop controls, not sensor controls —
// expo-camera exposes neither exposure compensation nor ISO natively (its
// `exposureCompensation` and `iso` fields sit on `WebCameraSettings`, web-only, still true as
// of expo-camera 17). They live on the develop screen, where they act on a real image and
// preview exactly.
//
// True sensor exposure compensation and tap-to-focus also need vision-camera.

type CameraNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Camera'>;

const FLASH_SEQUENCE: FlashMode[] = ['off', 'auto', 'on'];
const FLASH_ICONS: Record<FlashMode, keyof typeof Ionicons.glyphMap> = {
  off: 'flash-off',
  auto: 'flash-outline',
  on: 'flash',
};

type DevelopKey = 'exposure' | 'contrast' | 'saturation' | 'warmth' | 'grain';

const DEVELOP_CONTROLS: { key: DevelopKey; label: string }[] = [
  { key: 'exposure', label: 'EXPOSURE' },
  { key: 'contrast', label: 'CONTRAST' },
  { key: 'saturation', label: 'SATURATION' },
  { key: 'warmth', label: 'WARMTH' },
  { key: 'grain', label: 'GRAIN' },
];

export default function CameraScreen() {
  const navigation = useNavigation<CameraNavigationProp>();
  const { skin } = useSkin();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(skin), [skin]);
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraRef, setCameraRef] = useState<CameraView | null>(null);
  const [saving, setSaving] = useState(false);

  const [manual, setManual] = useState(false);
  const [flash, setFlash] = useState<FlashMode>('off');
  const [torch, setTorch] = useState(false);
  const [facing, setFacing] = useState<CameraType>('back');
  const [zoom, setZoom] = useState(0);
  const [focusLocked, setFocusLocked] = useState(false);
  const [showGuides, setShowGuides] = useState(true);
  const [lens, setLens] = useState<string | null>(null);
  const [lenses, setLenses] = useState<string[]>([]);

  const focusMode: FocusMode = focusLocked ? 'on' : 'off';
  const { ultraWide, standard } = useMemo(() => classifyLenses(lenses), [lenses]);

  // The pinch runs on the UI thread and needs its own copy of the zoom to accumulate against;
  // `applyZoom` keeps that copy and React's in step whichever end the change came from.
  const zoomShared = useSharedValue(0);
  const pinchStart = useSharedValue(0);

  const applyZoom = useCallback(
    (next: number) => {
      setZoom(next);
      zoomShared.value = next;
    },
    [zoomShared]
  );

  /**
   * Pinch to zoom, mapped so the magnification scales with the fingers rather than the
   * underlying 0..1 prop — pinching to twice the spread doubles the magnification, at any point
   * in the range. That falls out of expo-camera's `factor = max ^ zoom`: multiplying the factor
   * means *adding* to the zoom, by `log(scale) / log(max)`.
   *
   * Only numbers, `Math` and `runOnJS` cross into this worklet. `LN_MAX_FACTOR` is precomputed
   * on the JS thread precisely so nothing here calls an imported function — that is the crash
   * this codebase has already paid for once.
   */
  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .onBegin(() => {
          'worklet';
          pinchStart.value = zoomShared.value;
        })
        .onChange((event) => {
          'worklet';
          const next = Math.min(1, Math.max(0, pinchStart.value + Math.log(event.scale) / LN_MAX_FACTOR));
          zoomShared.value = next;
          runOnJS(applyZoom)(next);
        }),
    [applyZoom, pinchStart, zoomShared]
  );

  /** Jumps to a named magnification. 0.5× is a lens change; the rest are zoom. */
  function goToStop(factor: number) {
    haptics.selection();
    if (factor < 1) {
      // Below 1× is not a zoom at all — it is a wider lens, or it is nothing.
      if (ultraWide) setLens(ultraWide);
      applyZoom(0);
      return;
    }
    if (lens === ultraWide) setLens(standard);
    applyZoom(zoomForFactor(factor));
  }

  // The ultra-wide lens is roughly half the standard lens's focal length, and zoom multiplies
  // whichever lens is active — so magnification is the lens's own factor times the zoom's.
  const onUltraWide = ultraWide !== null && lens === ultraWide;
  const currentFactor = (onUltraWide ? 0.5 : 1) * factorForZoom(zoom);

  const isStopActive = (factor: number) => Math.abs(currentFactor - factor) < factor * 0.08;

  // Asked for once the camera exists, and again when the facing changes, since the front and
  // back cameras have different lenses. An effect rather than `onCameraReady` because that
  // event can fire against a render where the ref hadn't been captured yet.
  useEffect(() => {
    if (!cameraRef) return;
    let cancelled = false;
    cameraRef
      .getAvailableLensesAsync()
      .then((available) => {
        if (!cancelled) setLenses(available);
      })
      .catch(() => {
        // Android has no lens picker; an empty list simply hides the 0.5× stop.
        if (!cancelled) setLenses([]);
      });
    return () => {
      cancelled = true;
    };
  }, [cameraRef, facing]);

  /** A lens chosen for the back camera means nothing to the front one. */
  function flipFacing() {
    haptics.selection();
    setLens(null);
    applyZoom(0);
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  }

  function resetManual() {
    haptics.tap();
    applyZoom(0);
    setFocusLocked(false);
    setLens(standard);
  }

  /**
   * Hands the capture to the develop screen, which owns everything from here to the reveal.
   *
   * The reported size travels with it because the develop pass needs to compare it against the
   * decoded pixel size to decide whether the photo needs turning.
   */
  function handleCapturedPhoto(sourceUri: string, sourceWidth: number, sourceHeight: number) {
    navigation.replace('Develop', { sourceUri, sourceWidth, sourceHeight });
  }

  async function takePhoto() {
    if (!cameraRef || saving) return;
    haptics.thud();
    setSaving(true);
    try {
      const photo = await cameraRef.takePictureAsync({ quality: 0.95 });
      if (photo?.uri) handleCapturedPhoto(photo.uri, photo.width, photo.height);
    } catch (error) {
      haptics.failure();
      Alert.alert('Could not take the photo', 'Please try again.');
      console.error('[camera] capture failed', error);
    } finally {
      setSaving(false);
    }
  }

  async function pickFromLibrary() {
    if (saving) return;
    try {
      const permissionResponse = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResponse.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to import a photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.95 });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      handleCapturedPhoto(asset.uri, asset.width, asset.height);
    } catch (error) {
      Alert.alert('Could not open your library', 'Please try again.');
      console.error('[camera] library import failed', error);
    }
  }

  if (!permission) return <View style={styles.screen} />;

  if (!permission.granted) {
    return (
      <View style={[styles.gate, { paddingTop: insets.top + s(24), paddingBottom: insets.bottom + s(24) }]}>
        <Text style={styles.gateTitle}>Camera access needed</Text>
        <Text style={styles.gateBody}>
          Daily Pull only opens the camera when you pull a card. Nothing is captured in the background.
        </Text>
        <HardButton label="Grant access" onPress={requestPermission} style={styles.gateButton} />
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.gateCancel}>NOT NOW</Text>
        </Pressable>
      </View>
    );
  }

  return (
    // The pinch lives at the root so it can start anywhere on the preview. It takes two fingers,
    // so single-finger taps and the drawer's sliders reach their own handlers untouched.
    <GestureDetector gesture={pinch}>
      <View style={styles.screen}>
        {/* The app's only CameraView, and only while this screen is focused.
            Nothing wraps it and nothing draws on top of it but plain translucent views. That is
            a hard rule now, not a style choice — see the note at the top of this file. */}
        {isFocused && (
          <CameraView
            ref={setCameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            flash={flash}
            enableTorch={torch}
            zoom={zoom}
            selectedLens={lens ?? undefined}
            autofocus={focusMode}
            active={isFocused}
          />
        )}
      {/* Framing aids, full-bleed and centred on the frame itself.
          They used to live inside an inset "viewfinder" box, which made the crop guide wrong as
          well as off-centre: the preview fills the screen, the capture is cropped to the
          preview's aspect, and CardFace then centre-crops that to a square — so the part of the
          picture that survives onto the card is the centre square of the *whole screen*. The
          two scrims mark exactly what gets cut, and the toggle in the top bar takes them away
          when you'd rather see the whole frame. */}
      {showGuides && (
        <View style={styles.frameAids} pointerEvents="none">
          <View style={styles.outsideCrop} />
          <View style={styles.cropGuide}>
            <View style={[styles.thirdLine, styles.thirdVertical, { left: '33.33%' }]} />
            <View style={[styles.thirdLine, styles.thirdVertical, { left: '66.66%' }]} />
            <View style={[styles.thirdLine, styles.thirdHorizontal, { top: '33.33%' }]} />
            <View style={[styles.thirdLine, styles.thirdHorizontal, { top: '66.66%' }]} />
            <Text style={styles.cropGuideLabel}>
              {manual
                ? `CARD CROP · ZOOM ${Math.round(zoom * 100)}% · ${focusLocked ? 'AF LOCK' : 'AF'}`
                : 'CARD CROP · 1:1'}
            </Text>
          </View>
          <View style={styles.outsideCrop} />
        </View>
      )}

      <View style={[styles.chrome, { paddingTop: insets.top + s(10) }]}>
        <View style={styles.topBar}>
          <Pressable
            style={styles.circleButton}
            onPress={() => navigation.goBack()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close the camera"
          >
            <Ionicons name="close" size={s(17)} color={CHROME_TEXT} />
          </Pressable>

          {/* The mode pill is the toggle — tapping it swaps the drawer in and out. */}
          <Pressable
            onPress={() => {
              haptics.selection();
              setManual((value) => !value);
            }}
            hitSlop={8}
            accessibilityRole="switch"
            accessibilityState={{ checked: manual }}
            accessibilityLabel="Manual controls"
            accessibilityHint={manual ? 'Hides the manual controls' : 'Shows exposure, contrast and grain'}
          >
            <View style={[styles.modePill, manual && styles.modePillActive]}>
              <Text style={[styles.modePillText, manual && styles.modePillTextActive]}>
                {manual ? 'MANUAL' : 'AUTO'}
              </Text>
            </View>
          </Pressable>

          <View style={styles.topBarRight}>
            <Pressable
              style={styles.circleButton}
              hitSlop={8}
              accessibilityRole="switch"
              accessibilityState={{ checked: showGuides }}
              accessibilityLabel="Crop guide and grid"
              accessibilityHint={showGuides ? 'Hides them to show the whole frame' : 'Shows what the card will keep'}
              onPress={() => {
                haptics.selection();
                setShowGuides((value) => !value);
              }}
            >
              <Ionicons
                name={showGuides ? 'grid' : 'grid-outline'}
                size={s(15)}
                color={showGuides ? skin.shell.accent : CHROME_TEXT}
              />
            </Pressable>
            <Pressable
              style={styles.circleButton}
              hitSlop={8}
              accessibilityRole="switch"
              accessibilityState={{ checked: torch }}
              accessibilityLabel="Torch"
              onPress={() => {
                haptics.selection();
                setTorch((value) => !value);
              }}
            >
              <Ionicons
                name={torch ? 'flashlight' : 'flashlight-outline'}
                size={s(15)}
                color={torch ? skin.shell.accent : CHROME_TEXT}
              />
            </Pressable>
            <Pressable
              style={styles.circleButton}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Flash ${flash}`}
              accessibilityHint="Cycles between off, auto and on"
              onPress={() => {
                haptics.selection();
                setFlash(FLASH_SEQUENCE[(FLASH_SEQUENCE.indexOf(flash) + 1) % FLASH_SEQUENCE.length]);
              }}
            >
              <Ionicons
                name={FLASH_ICONS[flash]}
                size={s(15)}
                color={flash === 'off' ? CHROME_TEXT : skin.shell.accent}
              />
            </Pressable>
          </View>
        </View>

        {/* Everything above the drawer dismisses it. Sits between the top bar and the drawer in
            the column, so it fills the gap without covering either. */}
        {manual && (
          <Pressable
            style={styles.dismissArea}
            onPress={() => {
              haptics.selection();
              setManual(false);
            }}
            accessibilityRole="button"
            accessibilityLabel="Close camera controls"
          />
        )}

        {manual ? (
          <Animated.View
            entering={SlideInDown.duration(280)}
            exiting={SlideOutDown.duration(200)}
            style={[styles.drawer, { paddingBottom: insets.bottom + s(16) }]}
          >
            <View style={styles.grabHandle} />
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>CAMERA CONTROLS</Text>
              <Text style={styles.drawerBadge}>SENSOR</Text>
            </View>

            <ControlSlider
              styles={styles}
              label="ZOOM"
              value={formatFactor(currentFactor)}
              progress={zoom}
              onChange={applyZoom}
            />
            <ControlSlider
              styles={styles}
              label="FOCUS"
              value={focusLocked ? 'LOCKED' : 'AUTO'}
              progress={focusLocked ? 1 : 0}
              onChange={(next) => setFocusLocked(next > 0.5)}
              steps={2}
            />

            {/* Says where the rest went, rather than leaving someone hunting for the sliders
                that used to be here. */}
            <Text style={styles.drawerNote}>
              Exposure, contrast, warmth and grain come after the shutter, where you can see them
              on the actual photo.
            </Text>

            <View style={styles.drawerFooter}>
              <Pressable onPress={resetManual} hitSlop={10}>
                <Text style={styles.footerAction}>RESET</Text>
              </Pressable>
              <Pressable
                onPress={takePhoto}
                disabled={saving}
                style={styles.shutterRingSmall}
                accessibilityRole="button"
                accessibilityLabel="Take today's photo"
              >
                <View style={[styles.shutterFill, saving && styles.shutterBusy]} />
              </Pressable>
              <Pressable
                onPress={() => {
                  haptics.selection();
                  setManual(false);
                }}
                hitSlop={10}
              >
                <Text style={[styles.footerAction, styles.footerActionRight]}>AUTO</Text>
              </Pressable>
            </View>
          </Animated.View>
        ) : (
          <View style={styles.bottomGroup}>
            <View style={styles.zoomRow}>
              {ZOOM_STOPS.filter((stop) => !stop.needsUltraWide || ultraWide).map((stop) => {
                const active = isStopActive(stop.factor);
                return (
                  <Pressable
                    key={stop.label}
                    onPress={() => goToStop(stop.factor)}
                    style={[styles.zoomPill, active && styles.zoomPillActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Zoom ${stop.label} times`}
                  >
                    <Text style={[styles.zoomPillText, active && styles.zoomPillTextActive]}>
                      {active ? `${stop.label}×` : stop.label}
                    </Text>
                  </Pressable>
                );
              })}
              {/* Pinching lands between the stops, so the live magnification is worth showing. */}
              {!ZOOM_STOPS.some((stop) => isStopActive(stop.factor)) && (
                <View style={styles.zoomPill}>
                  <Text style={styles.zoomPillTextActive}>{formatFactor(currentFactor)}</Text>
                </View>
              )}
            </View>

            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + s(20) }]}>
              <Pressable
                onPress={() => {
                  haptics.selection();
                  setManual(true);
                }}
                hitSlop={10}
                style={styles.manualButton}
              >
                <Text style={styles.manualText}>MANUAL</Text>
                <Text style={styles.manualCaret}>▲</Text>
              </Pressable>

              <Pressable
                onPress={takePhoto}
                disabled={saving}
                style={styles.shutterRing}
                accessibilityRole="button"
                accessibilityLabel="Take today's photo"
              >
                <View style={[styles.shutterFill, saving && styles.shutterBusy]} />
              </Pressable>

              <View style={styles.bottomRight}>
                <Pressable
                  style={styles.circleButtonSmall}
                  onPress={pickFromLibrary}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Choose a photo from your library"
                >
                  <Ionicons name="images-outline" size={s(16)} color={CHROME_TEXT} />
                </Pressable>
                <Pressable
                  style={styles.circleButtonSmall}
                  onPress={flipFacing}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={facing === 'back' ? 'Switch to the front camera' : 'Switch to the back camera'}
                >
                  <Ionicons name="camera-reverse-outline" size={s(17)} color={CHROME_TEXT} />
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </View>

        {saving && (
          <View style={styles.developingScrim} pointerEvents="auto">
            <Text style={styles.developingText}>DEVELOPING…</Text>
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

function ControlSlider({
  styles,
  label,
  value,
  progress,
  onChange,
  steps,
}: {
  styles: ReturnType<typeof createStyles>;
  label: string;
  value: string;
  progress: number;
  onChange: (next: number) => void;
  steps?: number;
}) {
  return (
    <View style={styles.control}>
      <View style={styles.controlLabelRow}>
        <Text style={styles.controlLabel}>{label}</Text>
        <Text style={styles.controlValue}>{value}</Text>
      </View>
      <Slider value={progress} onChange={onChange} steps={steps} label={label} valueText={value} />
    </View>
  );
}

const SCRIM = 'rgba(23,19,15,0.55)';
const CHROME_TEXT = '#F4ECDC';

function createStyles(skin: SkinTokens) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: '#000',
    },
    chrome: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'space-between',
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: s(18),
    },
    topBarRight: {
      flexDirection: 'row',
      gap: s(8),
    },
    circleButton: {
      width: s(34),
      height: s(34),
      borderRadius: s(17),
      backgroundColor: SCRIM,
      alignItems: 'center',
      justifyContent: 'center',
    },
    circleButtonSmall: {
      width: s(40),
      height: s(40),
      borderRadius: s(20),
      backgroundColor: SCRIM,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modePill: {
      paddingVertical: s(8),
      paddingHorizontal: s(12),
      borderRadius: s(20),
      backgroundColor: SCRIM,
    },
    modePillActive: {
      backgroundColor: skin.shell.accent,
    },
    modePillText: {
      ...mono(9, 0.16),
      color: skin.shell.accent,
    },
    modePillTextActive: {
      color: skin.shell.onAccent,
    },
    // Two flexible scrims with the square between them: the square lands dead centre of the
    // screen whatever the device, and the scrims are literally the parts of the frame that get
    // cut from the card.
    frameAids: {
      ...StyleSheet.absoluteFillObject,
    },
    outsideCrop: {
      flex: 1,
      // Enough to read as "this gets cut" without hiding what you're framing against.
      backgroundColor: 'rgba(23,19,15,0.38)',
    },
    cropGuide: {
      width: '100%',
      aspectRatio: 1,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: withAlpha(skin.shell.accent, 0.55),
      justifyContent: 'flex-end',
      padding: s(8),
    },
    thirdLine: {
      position: 'absolute',
      backgroundColor: 'rgba(244,236,220,0.14)',
    },
    thirdVertical: {
      top: 0,
      bottom: 0,
      width: 1,
    },
    thirdHorizontal: {
      left: 0,
      right: 0,
      height: 1,
    },
    cropGuideLabel: {
      ...mono(8, 0.1),
      color: skin.shell.accent,
    },
    bottomGroup: {
      // One child of `chrome`, so `space-between` has exactly two things to push apart.
      flexGrow: 0,
      flexShrink: 0,
    },
    // Takes the whole gap between the top bar and the drawer, so a tap anywhere on the preview
    // closes the controls.
    dismissArea: {
      flex: 1,
    },
    zoomRow: {
      flexDirection: 'row',
      alignSelf: 'center',
      alignItems: 'center',
      gap: s(6),
      marginBottom: s(12),
      padding: s(4),
      borderRadius: s(20),
      backgroundColor: SCRIM,
    },
    zoomPill: {
      minWidth: s(34),
      height: s(30),
      paddingHorizontal: s(8),
      borderRadius: s(15),
      alignItems: 'center',
      justifyContent: 'center',
    },
    zoomPillActive: {
      backgroundColor: 'rgba(244,236,220,0.16)',
    },
    zoomPillText: {
      ...mono(10, 0.04),
      color: 'rgba(244,236,220,0.7)',
    },
    zoomPillTextActive: {
      ...mono(10, 0.04),
      color: skin.shell.accent,
    },
    bottomBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: s(24),
      paddingTop: s(18),
    },
    manualButton: {
      alignItems: 'center',
      width: s(88),
    },
    manualText: {
      ...mono(9, 0.12),
      color: 'rgba(244,236,220,0.6)',
    },
    manualCaret: {
      ...mono(9),
      color: 'rgba(244,236,220,0.6)',
    },
    shutterRing: {
      width: s(76),
      height: s(76),
      borderRadius: s(38),
      borderWidth: 3,
      borderColor: CHROME_TEXT,
      padding: s(5),
    },
    shutterRingSmall: {
      width: s(64),
      height: s(64),
      borderRadius: s(32),
      borderWidth: 3,
      borderColor: CHROME_TEXT,
      padding: s(5),
    },
    shutterFill: {
      flex: 1,
      borderRadius: s(38),
      backgroundColor: skin.shell.accent,
    },
    shutterBusy: {
      opacity: 0.4,
    },
    bottomRight: {
      flexDirection: 'row',
      gap: s(8),
      width: s(88),
      justifyContent: 'flex-end',
    },
    drawer: {
      borderTopLeftRadius: s(16),
      borderTopRightRadius: s(16),
      backgroundColor: 'rgba(23,19,15,0.94)',
      paddingTop: s(14),
      paddingHorizontal: s(18),
      gap: s(10),
    },
    grabHandle: {
      width: s(42),
      height: s(4),
      borderRadius: s(2),
      backgroundColor: 'rgba(244,236,220,0.28)',
      alignSelf: 'center',
    },
    drawerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    drawerTitle: {
      ...mono(9, 0.14),
      color: skin.shell.accent,
    },
    drawerBadge: {
      ...mono(8, 0.12),
      color: 'rgba(244,236,220,0.4)',
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
      color: 'rgba(244,236,220,0.65)',
    },
    drawerNote: {
      ...body(10, 400, 1.4),
      color: 'rgba(244,236,220,0.4)',
    },
    controlValue: {
      ...mono(8.5, 0.12),
      color: CHROME_TEXT,
    },
    drawerFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    footerAction: {
      ...mono(9, 0.12),
      color: 'rgba(244,236,220,0.55)',
      width: s(48),
    },
    footerActionRight: {
      textAlign: 'right',
    },
    developingScrim: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(23,19,15,0.55)',
    },
    developingText: {
      ...mono(11, 0.24),
      color: skin.shell.accent,
    },
    gate: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: s(14),
      paddingHorizontal: s(28),
      backgroundColor: skin.shell.background,
    },
    gateTitle: {
      ...display(20, 1.1),
      color: skin.shell.textPrimary,
      textAlign: 'center',
    },
    gateBody: {
      ...body(12.5, 400, 1.45),
      color: skin.shell.textSecondary,
      textAlign: 'center',
    },
    gateButton: {
      alignSelf: 'stretch',
      marginTop: s(6),
    },
    gateCancel: {
      ...mono(9, 0.14),
      color: skin.shell.textSecondary,
      marginTop: s(10),
    },
  });
}
