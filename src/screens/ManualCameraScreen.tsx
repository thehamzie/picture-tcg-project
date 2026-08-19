import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions, type FocusMode } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { SlideInDown } from 'react-native-reanimated';

import HardButton from '../components/HardButton';
import Slider from '../components/Slider';
import type { RootStackParamList } from '../navigation/types';
import { withAlpha } from '../theme/color';
import type { SkinTokens } from '../theme/skins';
import { useSkin } from '../theme/SkinContext';
import { body, display, mono, s } from '../theme/typography';
import { todayDateKey } from '../utils/date';
import { saveCardPhoto } from '../utils/photoStorage';

// Manual camera — mockup 2c, "marked post-MVP; auto still shoots underneath."
//
// Which of these are real controls, unchanged from the earlier build's findings:
//   ZOOM     real — CameraView's `zoom` prop (0..1), supported on both platforms.
//   FOCUS    real but binary — expo-camera exposes autofocus only as an on/off `FocusMode`,
//            not a manual focus distance, so the slider reads as a lock past its midpoint.
//   EXPOSURE / ISO  NOT real — expo-camera's native CameraView has no exposure-compensation
//            or ISO prop in its public API (the field names only exist in a web-only,
//            docs-hidden `WebCameraSettings` type). Both are labelled "VISUAL ONLY" in the
//            UI rather than silently pretending to work. This is a library limitation, not a
//            scoping choice — confirmed by reading expo-camera's Camera.types.d.ts.
//
// The sliders are now real drag sliders (see components/Slider.tsx), which is what both
// PLAN.md and the mockup call for; the previous build used discrete tap-stops.

type ManualCameraNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ManualCamera'>;

const EXPOSURE_STOPS = ['-2.0', '-1.0', '0.0', '+0.3', '+1.0', '+2.0'];
const ISO_STOPS = ['100', '200', '400', '800', '1600'];

export default function ManualCameraScreen() {
  const navigation = useNavigation<ManualCameraNavigationProp>();
  const { skin } = useSkin();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(skin), [skin]);
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraRef, setCameraRef] = useState<CameraView | null>(null);
  const [saving, setSaving] = useState(false);

  const [zoom, setZoom] = useState(0);
  const [exposure, setExposure] = useState(0.4);
  const [iso, setIso] = useState(0.5);
  const [focus, setFocus] = useState(0);

  const today = todayDateKey();
  const focusLocked = focus > 0.5;
  // expo-camera's FocusMode reads backwards from the label: `on` means "autofocus once, then
  // lock", `off` means "refocus automatically whenever needed".
  const focusMode: FocusMode = focusLocked ? 'on' : 'off';
  const exposureLabel = EXPOSURE_STOPS[Math.round(exposure * (EXPOSURE_STOPS.length - 1))];
  const isoLabel = ISO_STOPS[Math.round(iso * (ISO_STOPS.length - 1))];

  function reset() {
    setZoom(0);
    setExposure(0.4);
    setIso(0.5);
    setFocus(0);
  }

  async function takePhoto() {
    if (!cameraRef || saving) return;
    setSaving(true);
    try {
      const photo = await cameraRef.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) {
        const savedUri = saveCardPhoto(photo.uri, today);
        navigation.replace('Reveal', { photoUri: savedUri });
      }
    } catch (error) {
      Alert.alert('Something went wrong', "Could not save today's card. Please try again.");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  if (!permission) return <View style={styles.screen} />;

  if (!permission.granted) {
    return (
      <View style={[styles.gate, { paddingTop: insets.top + s(24), paddingBottom: insets.bottom + s(24) }]}>
        <Text style={styles.gateTitle}>Camera access needed</Text>
        <HardButton label="Grant access" onPress={requestPermission} style={styles.gateButton} />
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.gateCancel}>NOT NOW</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Only ever mount the camera while this screen is the focused one. Two CameraViews
          alive at once means two native capture sessions competing for the hardware, which
          hard-crashes on both platforms — and native-stack keeps the screen underneath
          mounted, so navigating here from the auto camera did exactly that. `active` alone
          isn't enough: it's iOS-only, so Android needs the view genuinely unmounted. */}
      {isFocused && (
        <CameraView
          ref={setCameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          zoom={zoom}
          autofocus={focusMode}
          active={isFocused}
        />
      )}

      <View style={[styles.chrome, { paddingTop: insets.top + s(10) }]}>
        <View style={styles.topBar}>
          <Pressable style={styles.circleButton} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="close" size={s(17)} color={CHROME_TEXT} />
          </Pressable>
          <View style={styles.modePill}>
            <Text style={styles.modePillText}>MANUAL</Text>
          </View>
          <Text style={styles.rawLabel}>RAW+</Text>
        </View>

        <View style={styles.viewfinder}>
          {/* The quick vertical slider from the mockup, wired to zoom — the one control here
              that genuinely reaches the hardware, so it earns the always-visible spot. */}
          <View style={styles.quickSlider}>
            <Slider value={zoom} onChange={setZoom} orientation="vertical" />
          </View>
          <Text style={styles.readout}>
            {`ZOOM ${Math.round(zoom * 100)}%\nISO ${isoLabel} · ${exposureLabel}EV`}
          </Text>
        </View>

        <Animated.View entering={SlideInDown.duration(320)} style={[styles.drawer, { paddingBottom: insets.bottom + s(22) }]}>
          <View style={styles.grabHandle} />
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>MANUAL CONTROLS</Text>
            <Text style={styles.drawerBadge}>POST-MVP</Text>
          </View>

          <ControlSlider
            styles={styles}
            label="ZOOM"
            value={`${Math.round(zoom * 100)}%`}
            progress={zoom}
            onChange={setZoom}
          />
          <ControlSlider
            styles={styles}
            label="EXPOSURE"
            value={`${exposureLabel} EV`}
            note="VISUAL ONLY"
            progress={exposure}
            onChange={setExposure}
            steps={EXPOSURE_STOPS.length}
          />
          <ControlSlider
            styles={styles}
            label="ISO"
            value={isoLabel}
            note="VISUAL ONLY"
            progress={iso}
            onChange={setIso}
            steps={ISO_STOPS.length}
          />
          <ControlSlider
            styles={styles}
            label="FOCUS"
            value={focusLocked ? 'LOCKED' : 'AUTO'}
            progress={focus}
            onChange={setFocus}
            steps={2}
          />

          <View style={styles.drawerFooter}>
            <Pressable onPress={reset} hitSlop={10}>
              <Text style={styles.footerAction}>RESET</Text>
            </Pressable>
            <Pressable onPress={takePhoto} disabled={saving} style={styles.shutterRing}>
              <View style={[styles.shutterFill, saving && styles.shutterBusy]} />
            </Pressable>
            <Pressable onPress={() => navigation.replace('Camera')} hitSlop={10}>
              <Text style={styles.footerAction}>AUTO</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

function ControlSlider({
  styles,
  label,
  value,
  note,
  progress,
  onChange,
  steps,
}: {
  styles: ReturnType<typeof createStyles>;
  label: string;
  value: string;
  note?: string;
  progress: number;
  onChange: (next: number) => void;
  steps?: number;
}) {
  return (
    <View style={styles.control}>
      <View style={styles.controlLabelRow}>
        <View style={styles.controlLabelGroup}>
          <Text style={styles.controlLabel}>{label}</Text>
          {note && <Text style={styles.controlNote}>{note}</Text>}
        </View>
        <Text style={styles.controlValue}>{value}</Text>
      </View>
      <Slider value={progress} onChange={onChange} steps={steps} />
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
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: s(18),
    },
    circleButton: {
      width: s(34),
      height: s(34),
      borderRadius: s(17),
      backgroundColor: SCRIM,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modePill: {
      paddingVertical: s(8),
      paddingHorizontal: s(12),
      borderRadius: s(20),
      backgroundColor: skin.shell.accent,
    },
    modePillText: {
      ...mono(9, 0.16),
      color: skin.shell.onAccent,
    },
    rawLabel: {
      ...mono(9, 0.12),
      color: 'rgba(244,236,220,0.7)',
      width: s(34),
      textAlign: 'right',
    },
    viewfinder: {
      flex: 1,
      marginHorizontal: s(18),
      marginTop: s(14),
      marginBottom: s(8),
      borderRadius: s(6),
      borderWidth: 1,
      borderColor: 'rgba(244,236,220,0.18)',
    },
    quickSlider: {
      position: 'absolute',
      right: s(6),
      top: s(10),
      bottom: s(10),
    },
    readout: {
      ...mono(8, 0.1),
      lineHeight: s(13),
      color: skin.shell.accent,
      position: 'absolute',
      left: s(10),
      bottom: s(10),
    },
    drawer: {
      borderTopLeftRadius: s(16),
      borderTopRightRadius: s(16),
      backgroundColor: 'rgba(23,19,15,0.94)',
      paddingTop: s(14),
      paddingHorizontal: s(18),
      gap: s(13),
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
    controlLabelGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s(6),
    },
    controlLabel: {
      ...mono(8.5, 0.12),
      color: 'rgba(244,236,220,0.65)',
    },
    controlNote: {
      ...mono(7, 0.1),
      color: 'rgba(244,236,220,0.32)',
    },
    controlValue: {
      ...mono(8.5, 0.12),
      color: CHROME_TEXT,
    },
    drawerFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: s(4),
    },
    footerAction: {
      ...mono(9, 0.12),
      color: 'rgba(244,236,220,0.55)',
      width: s(48),
    },
    shutterRing: {
      width: s(68),
      height: s(68),
      borderRadius: s(34),
      borderWidth: 3,
      borderColor: CHROME_TEXT,
      padding: s(5),
    },
    shutterFill: {
      flex: 1,
      borderRadius: s(34),
      backgroundColor: skin.shell.accent,
    },
    shutterBusy: {
      opacity: 0.4,
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
    gateButton: {
      alignSelf: 'stretch',
    },
    gateCancel: {
      ...mono(9, 0.14),
      color: skin.shell.textSecondary,
    },
    // `body` and `withAlpha` are used by the gate copy on narrow layouts.
    gateBody: {
      ...body(12.5, 400, 1.45),
      color: withAlpha(skin.shell.textPrimary, 0.5),
      textAlign: 'center',
    },
  });
}
