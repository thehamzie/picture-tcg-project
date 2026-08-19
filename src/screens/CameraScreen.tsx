import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions, type CameraType, type FlashMode, type FocusMode } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';

import HardButton from '../components/HardButton';
import Slider from '../components/Slider';
import type { RootStackParamList } from '../navigation/types';
import { withAlpha } from '../theme/color';
import { placeholderHatch } from '../theme/gradients';
import type { SkinTokens } from '../theme/skins';
import { useSkin } from '../theme/SkinContext';
import { body, display, mono, s } from '../theme/typography';
import { todayDateKey } from '../utils/date';
import { saveCardPhoto } from '../utils/photoStorage';

// Camera — mockups 2b (auto) and 2c (manual drawer).
//
// Auto and manual are ONE screen with one `CameraView`, not two screens. That's what the
// mockup describes ("manual drawer pulled up… auto still shoots underneath"), and it removes
// the failure mode that a separate manual screen kept reintroducing: two mounted CameraViews
// meant two native capture sessions competing for the same hardware, which crashes. There is
// now exactly one camera in the app, and it is unmounted whenever the screen isn't focused.
//
// Which manual controls are real, unchanged from earlier findings:
//   ZOOM   real — CameraView's `zoom` prop (0..1), both platforms.
//   FOCUS  real but binary — expo-camera exposes autofocus only as an on/off `FocusMode`
//          (`'on'` = focus once then lock), not a manual distance. iOS only.
//   EXPOSURE / ISO  NOT real — expo-camera's native CameraView has no exposure-compensation
//          or ISO prop in its public API. Both are labelled "VISUAL ONLY" rather than
//          silently pretending to work. Library limitation, not a scoping choice.

type CameraNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Camera'>;

// Cosmetic-only preview filters — confirmed final for MVP (see AGENTS.md). Swatches are the
// mockup's own; the saved photo is always the raw capture.
const FILTERS = [
  { key: 'none', label: 'NONE', swatch: '#C9BCA3', tint: null },
  { key: 'koda', label: 'KODA', swatch: '#C9A87F', tint: 'rgba(201,168,127,0.22)' },
  { key: 'fade', label: 'FADE', swatch: '#8FA79A', tint: 'rgba(143,167,154,0.22)' },
  { key: 'disco', label: 'DISCO', swatch: '#B98C9B', tint: 'rgba(185,140,155,0.24)' },
  { key: 'grey', label: 'GREY', swatch: '#9A937F', tint: 'rgba(120,118,110,0.35)' },
] as const;

const FLASH_SEQUENCE: FlashMode[] = ['off', 'auto', 'on'];
const FLASH_ICONS: Record<FlashMode, keyof typeof Ionicons.glyphMap> = {
  off: 'flash-off',
  auto: 'flash-outline',
  on: 'flash',
};

const EXPOSURE_STOPS = ['-2.0', '-1.0', '0.0', '+0.3', '+1.0', '+2.0'];
const ISO_STOPS = ['100', '200', '400', '800', '1600'];

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
  const [filterIndex, setFilterIndex] = useState(0);
  const [flash, setFlash] = useState<FlashMode>('off');
  const [facing, setFacing] = useState<CameraType>('back');
  const [zoom, setZoom] = useState(0);
  const [exposure, setExposure] = useState(0.4);
  const [iso, setIso] = useState(0.5);
  const [focus, setFocus] = useState(0);

  const today = todayDateKey();
  const activeFilter = FILTERS[filterIndex];
  const focusLocked = focus > 0.5;
  const focusMode: FocusMode = focusLocked ? 'on' : 'off';
  const exposureLabel = EXPOSURE_STOPS[Math.round(exposure * (EXPOSURE_STOPS.length - 1))];
  const isoLabel = ISO_STOPS[Math.round(iso * (ISO_STOPS.length - 1))];

  function resetManual() {
    setZoom(0);
    setExposure(0.4);
    setIso(0.5);
    setFocus(0);
  }

  async function handleCapturedPhoto(sourceUri: string) {
    try {
      const savedUri = saveCardPhoto(sourceUri, today);
      navigation.replace('Reveal', { photoUri: savedUri });
    } catch (error) {
      Alert.alert('Something went wrong', "Could not save today's card. Please try again.");
      console.error('[camera] save failed', error);
    }
  }

  async function takePhoto() {
    if (!cameraRef || saving) return;
    setSaving(true);
    try {
      const photo = await cameraRef.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) await handleCapturedPhoto(photo.uri);
    } catch (error) {
      Alert.alert('Could not take the photo', 'Please try again.');
      console.error('[camera] capture failed', error);
    } finally {
      setSaving(false);
    }
  }

  async function pickFromLibrary() {
    try {
      const permissionResponse = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResponse.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to import a photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.9 });
      if (result.canceled || !result.assets[0]) return;
      await handleCapturedPhoto(result.assets[0].uri);
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
    <View style={styles.screen}>
      {/* The app's only CameraView, and only while this screen is focused. */}
      {isFocused && (
        <CameraView
          ref={setCameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          flash={flash}
          zoom={zoom}
          autofocus={manual ? focusMode : 'off'}
          active={isFocused}
        />
      )}
      {activeFilter.tint && !manual && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: activeFilter.tint }]} />
      )}

      <View style={[styles.chrome, { paddingTop: insets.top + s(10) }]}>
        <View style={styles.topBar}>
          <Pressable style={styles.circleButton} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="close" size={s(17)} color={CHROME_TEXT} />
          </Pressable>

          {/* The mode pill is the toggle — tapping it swaps the drawer in and out. */}
          <Pressable onPress={() => setManual((value) => !value)} hitSlop={8}>
            <View style={[styles.modePill, manual && styles.modePillActive]}>
              <Text style={[styles.modePillText, manual && styles.modePillTextActive]}>
                {manual ? 'MANUAL' : 'AUTO'}
              </Text>
            </View>
          </Pressable>

          {manual ? (
            <Text style={styles.rawLabel}>RAW+</Text>
          ) : (
            <View style={styles.topBarRight}>
              <Pressable
                style={styles.circleButton}
                hitSlop={8}
                onPress={() => setFlash(FLASH_SEQUENCE[(FLASH_SEQUENCE.indexOf(flash) + 1) % FLASH_SEQUENCE.length])}
              >
                <Ionicons
                  name={FLASH_ICONS[flash]}
                  size={s(15)}
                  color={flash === 'off' ? CHROME_TEXT : skin.shell.accent}
                />
              </Pressable>
              <View style={styles.circleButton}>
                <Text style={styles.ratioText}>1:1</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.viewfinder}>
          <View style={[styles.thirdLine, styles.thirdVertical, { left: '33.3%' }]} />
          <View style={[styles.thirdLine, styles.thirdVertical, { left: '66.6%' }]} />
          <View style={[styles.thirdLine, styles.thirdHorizontal, { top: '33.3%' }]} />
          <View style={[styles.thirdLine, styles.thirdHorizontal, { top: '66.6%' }]} />
          {/* The "1:1" badge is literal: the card crops to this square, so it's drawn. */}
          <View style={styles.cropGuideWrap} pointerEvents="none">
            <View style={styles.cropGuide}>
              <Text style={styles.cropGuideLabel}>CARD CROP · 1:1</Text>
            </View>
          </View>
          {manual && (
            <Text style={styles.readout}>
              {`ZOOM ${Math.round(zoom * 100)}%\nISO ${isoLabel} · ${exposureLabel}EV`}
            </Text>
          )}
        </View>

        {manual ? (
          <Animated.View
            entering={SlideInDown.duration(280)}
            exiting={SlideOutDown.duration(200)}
            style={[styles.drawer, { paddingBottom: insets.bottom + s(20) }]}
          >
            <View style={styles.grabHandle} />
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>MANUAL CONTROLS</Text>
              <Text style={styles.drawerBadge}>POST-MVP</Text>
            </View>

            <ControlSlider styles={styles} label="ZOOM" value={`${Math.round(zoom * 100)}%`} progress={zoom} onChange={setZoom} />
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
              <Pressable onPress={resetManual} hitSlop={10}>
                <Text style={styles.footerAction}>RESET</Text>
              </Pressable>
              <Pressable onPress={takePhoto} disabled={saving} style={styles.shutterRingSmall}>
                <View style={[styles.shutterFill, saving && styles.shutterBusy]} />
              </Pressable>
              <Pressable onPress={() => setManual(false)} hitSlop={10}>
                <Text style={[styles.footerAction, styles.footerActionRight]}>AUTO</Text>
              </Pressable>
            </View>
          </Animated.View>
        ) : (
          <>
            <View style={styles.filterStrip}>
              {FILTERS.map((filter, index) => (
                <Pressable key={filter.key} style={styles.filterItem} onPress={() => setFilterIndex(index)}>
                  <View
                    style={[
                      styles.filterSwatch,
                      { backgroundColor: filter.swatch },
                      index === filterIndex && {
                        boxShadow: [
                          { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 2, color: skin.shell.accent },
                        ],
                      },
                      placeholderHatch('rgba(23,19,15,0.14)'),
                    ]}
                  />
                  <Text style={[styles.filterLabel, index === filterIndex && { color: skin.shell.accent }]}>
                    {filter.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + s(20) }]}>
              <Pressable onPress={() => setManual(true)} hitSlop={10} style={styles.manualButton}>
                <Text style={styles.manualText}>MANUAL</Text>
                <Text style={styles.manualCaret}>▲</Text>
              </Pressable>

              <Pressable onPress={takePhoto} disabled={saving} style={styles.shutterRing}>
                <View style={[styles.shutterFill, saving && styles.shutterBusy]} />
              </Pressable>

              <View style={styles.bottomRight}>
                <Pressable style={styles.circleButtonSmall} onPress={pickFromLibrary} hitSlop={8}>
                  <Ionicons name="images-outline" size={s(16)} color={CHROME_TEXT} />
                </Pressable>
                <Pressable
                  style={styles.circleButtonSmall}
                  onPress={() => setFacing((current) => (current === 'back' ? 'front' : 'back'))}
                  hitSlop={8}
                >
                  <Ionicons name="camera-reverse-outline" size={s(17)} color={CHROME_TEXT} />
                </Pressable>
              </View>
            </View>
          </>
        )}
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
    ratioText: {
      ...mono(10),
      color: CHROME_TEXT,
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
    rawLabel: {
      ...mono(9, 0.12),
      color: 'rgba(244,236,220,0.7)',
      width: s(34),
      textAlign: 'right',
    },
    viewfinder: {
      flex: 1,
      marginHorizontal: s(18),
      marginVertical: s(14),
      borderRadius: s(6),
      borderWidth: 1,
      borderColor: 'rgba(244,236,220,0.18)',
      overflow: 'hidden',
      justifyContent: 'center',
    },
    thirdLine: {
      position: 'absolute',
      backgroundColor: 'rgba(244,236,220,0.1)',
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
    cropGuideWrap: {
      width: '100%',
    },
    cropGuide: {
      width: '100%',
      aspectRatio: 1,
      borderWidth: 1.5,
      borderColor: withAlpha(skin.shell.accent, 0.8),
      borderRadius: s(3),
      justifyContent: 'flex-end',
      padding: s(6),
    },
    cropGuideLabel: {
      ...mono(8, 0.1),
      color: skin.shell.accent,
    },
    readout: {
      ...mono(8, 0.1),
      lineHeight: s(13),
      color: skin.shell.accent,
      position: 'absolute',
      left: s(10),
      bottom: s(10),
    },
    filterStrip: {
      flexDirection: 'row',
      gap: s(8),
      paddingHorizontal: s(18),
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
      color: 'rgba(244,236,220,0.6)',
      textAlign: 'center',
      marginTop: s(5),
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
      width: s(68),
      height: s(68),
      borderRadius: s(34),
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
      gap: s(12),
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
    footerActionRight: {
      textAlign: 'right',
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
