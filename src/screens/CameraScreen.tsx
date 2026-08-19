import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions, type CameraType, type FlashMode } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import HardButton from '../components/HardButton';
import type { RootStackParamList } from '../navigation/types';
import { withAlpha } from '../theme/color';
import { placeholderHatch } from '../theme/gradients';
import type { SkinTokens } from '../theme/skins';
import { useSkin } from '../theme/SkinContext';
import { body, display, mono, s } from '../theme/typography';
import { todayDateKey } from '../utils/date';
import { saveCardPhoto } from '../utils/photoStorage';

// Camera, auto-first — mockup 2b. "Full viewfinder, live filter strip, one shutter. Manual
// lives behind the small pill."
//
// The camera chrome deliberately stays fixed dark/cream rather than skin-tinted: it sits on
// top of a live camera feed, and some skin accents (Scrapbook Sun's light orange) wouldn't
// read as a translucent scrim over arbitrary photo content. Only the accent-colored bits
// (mode pill, shutter fill, AF box) follow the skin.

type CameraNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Camera'>;

// Cosmetic-only preview filters — confirmed final for MVP (see AGENTS.md). expo-camera has no
// live filter pipeline on this stack, so these tint the viewfinder for feel and the saved
// photo is always the raw capture. Swatch colors are the mockup's own.
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

export default function CameraScreen() {
  const navigation = useNavigation<CameraNavigationProp>();
  const { skin } = useSkin();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(skin), [skin]);
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraRef, setCameraRef] = useState<CameraView | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterIndex, setFilterIndex] = useState(0);
  const [flash, setFlash] = useState<FlashMode>('off');
  const [facing, setFacing] = useState<CameraType>('back');

  const today = todayDateKey();
  const activeFilter = FILTERS[filterIndex];

  async function handleCapturedPhoto(sourceUri: string) {
    try {
      const savedUri = saveCardPhoto(sourceUri, today);
      navigation.replace('Reveal', { photoUri: savedUri });
    } catch (error) {
      Alert.alert('Something went wrong', "Could not save today's card. Please try again.");
      console.error(error);
    }
  }

  async function takePhoto() {
    if (!cameraRef || saving) return;
    setSaving(true);
    try {
      const photo = await cameraRef.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) await handleCapturedPhoto(photo.uri);
    } finally {
      setSaving(false);
    }
  }

  async function pickFromLibrary() {
    const permissionResponse = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResponse.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to import a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.9 });
    if (result.canceled || !result.assets[0]) return;
    await handleCapturedPhoto(result.assets[0].uri);
  }

  if (!permission) {
    return <View style={[styles.gate, { backgroundColor: skin.shell.background }]} />;
  }

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
      {/* Unmounted whenever this screen isn't focused, so the manual camera can never hold a
          second native capture session at the same time. See ManualCameraScreen. */}
      {isFocused && (
        <CameraView
          ref={setCameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          flash={flash}
          active={isFocused}
        />
      )}
      {activeFilter.tint && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: activeFilter.tint }]} />
      )}

      <View style={[styles.chrome, { paddingTop: insets.top + s(10), paddingBottom: insets.bottom + s(8) }]}>
        <View style={styles.topBar}>
          <Pressable style={styles.circleButton} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="close" size={s(17)} color="#F4ECDC" />
          </Pressable>
          <View style={styles.modePill}>
            <Text style={styles.modePillText}>AUTO</Text>
          </View>
          <View style={styles.topBarRight}>
            <Pressable
              style={styles.circleButton}
              hitSlop={8}
              onPress={() => setFlash(FLASH_SEQUENCE[(FLASH_SEQUENCE.indexOf(flash) + 1) % FLASH_SEQUENCE.length])}
            >
              <Ionicons name={FLASH_ICONS[flash]} size={s(15)} color={flash === 'off' ? '#F4ECDC' : skin.shell.accent} />
            </Pressable>
            <View style={styles.circleButton}>
              <Text style={styles.ratioText}>1:1</Text>
            </View>
          </View>
        </View>

        <View style={styles.viewfinder}>
          <View style={[styles.thirdLine, styles.thirdVertical, { left: '33.3%' }]} />
          <View style={[styles.thirdLine, styles.thirdVertical, { left: '66.6%' }]} />
          <View style={[styles.thirdLine, styles.thirdHorizontal, { top: '33.3%' }]} />
          <View style={[styles.thirdLine, styles.thirdHorizontal, { top: '66.6%' }]} />
          {/* The "1:1" badge is literal: the card crops to this square, so it's drawn. */}
          <View style={styles.cropGuide}>
            <Text style={styles.cropGuideLabel}>CARD CROP · 1:1</Text>
          </View>
        </View>

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

        <View style={styles.bottomBar}>
          {/* `replace`, not `navigate`: it keeps exactly one camera screen in the stack, so
              the two can never be mounted together. */}
          <Pressable onPress={() => navigation.replace('ManualCamera')} hitSlop={10} style={styles.manualButton}>
            <Text style={styles.manualText}>MANUAL</Text>
            <Text style={styles.manualCaret}>▲</Text>
          </Pressable>

          <Pressable onPress={takePhoto} disabled={saving} style={styles.shutterRing}>
            <Animated.View
              entering={FadeIn}
              style={[styles.shutterFill, { backgroundColor: skin.shell.accent }, saving && styles.shutterBusy]}
            />
          </Pressable>

          <View style={styles.bottomRight}>
            <Pressable style={styles.circleButtonSmall} onPress={pickFromLibrary} hitSlop={8}>
              <Ionicons name="images-outline" size={s(16)} color="#F4ECDC" />
            </Pressable>
            <Pressable
              style={styles.circleButtonSmall}
              onPress={() => setFacing((current) => (current === 'back' ? 'front' : 'back'))}
              hitSlop={8}
            >
              <Ionicons name="camera-reverse-outline" size={s(17)} color="#F4ECDC" />
            </Pressable>
          </View>
        </View>
      </View>
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
    modePillText: {
      ...mono(9, 0.16),
      color: skin.shell.accent,
    },
    viewfinder: {
      flex: 1,
      marginHorizontal: s(18),
      marginVertical: s(14),
      borderRadius: s(6),
      borderWidth: 1,
      borderColor: 'rgba(244,236,220,0.18)',
      overflow: 'hidden',
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
    cropGuide: {
      position: 'absolute',
      top: '50%',
      left: 0,
      right: 0,
      aspectRatio: 1,
      transform: [{ translateY: '-50%' }],
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
      paddingBottom: s(20),
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
    shutterFill: {
      flex: 1,
      borderRadius: s(38),
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
