import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useSQLiteContext } from 'expo-sqlite';

import { insertCard } from '../db/cardsRepository';
import { useCards } from '../hooks/useCards';
import { theme } from '../theme/theme';
import { todayDateKey } from '../utils/date';
import { saveCardPhoto } from '../utils/photoStorage';

export default function OpenCardScreen() {
  const db = useSQLiteContext();
  const { cards, refresh } = useCards();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cameraRef, setCameraRef] = useState<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const today = todayDateKey();
  const todaysCard = cards.find((card) => card.date === today);

  async function handleCapturedPhoto(sourceUri: string) {
    setSaving(true);
    try {
      const savedUri = saveCardPhoto(sourceUri, today);
      await insertCard(db, { date: today, photoUri: savedUri });
      await refresh();
      setCameraOpen(false);
    } catch (error) {
      Alert.alert('Something went wrong', 'Could not save today\'s card. Please try again.');
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  async function takePhoto() {
    if (!cameraRef || saving) return;
    setSaving(true);
    try {
      const photo = await cameraRef.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) {
        await handleCapturedPhoto(photo.uri);
      }
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
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    await handleCapturedPhoto(result.assets[0].uri);
  }

  if (todaysCard) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: todaysCard.photoUri }} style={styles.preview} />
        <Text style={styles.title}>Today's card is captured</Text>
        <Text style={styles.subtitle}>Come back tomorrow for the next one.</Text>
      </View>
    );
  }

  if (cameraOpen) {
    if (!permission) {
      return <View style={styles.container} />;
    }

    if (!permission.granted) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Camera access needed</Text>
          <Pressable style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>Grant access</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => setCameraOpen(false)}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={setCameraRef} style={styles.camera} facing="back" />
        <View style={styles.cameraControls}>
          <Pressable style={styles.secondaryButton} onPress={() => setCameraOpen(false)}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.captureButton} onPress={takePhoto} disabled={saving} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Today's card is waiting</Text>
      <Pressable style={styles.primaryButton} onPress={() => setCameraOpen(true)} disabled={saving}>
        <Text style={styles.primaryButtonText}>Take Photo</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={pickFromLibrary} disabled={saving}>
        <Text style={styles.secondaryButtonText}>Choose from Library</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: theme.colors.background,
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  preview: {
    width: 200,
    aspectRatio: theme.cardShape.aspectRatio,
    borderRadius: theme.cardShape.radiusFull,
    backgroundColor: theme.colors.cardMuted,
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: theme.cardShape.radiusFull,
  },
  primaryButtonText: {
    color: theme.colors.surface,
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  secondaryButtonText: {
    color: theme.colors.textSecondary,
    fontWeight: '500',
    fontSize: 15,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.surface,
    borderWidth: 4,
    borderColor: theme.colors.accent,
  },
});
