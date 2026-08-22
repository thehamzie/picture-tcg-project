import { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';

import { getOnboardingComplete } from '../db/settingsRepository';
import CameraScreen from '../screens/CameraScreen';
import CardDetailScreen from '../screens/CardDetailScreen';
import DevelopScreen from '../screens/DevelopScreen';
import ExportScreen from '../screens/ExportScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import PermissionsScreen from '../screens/PermissionsScreen';
import RevealScreen from '../screens/RevealScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SkinSelectorScreen from '../screens/SkinSelectorScreen';
import TabNavigator from './TabNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const db = useSQLiteContext();
  const [initialRouteName, setInitialRouteName] = useState<'Onboarding' | 'Main' | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOnboardingComplete(db).then((complete) => {
      if (!cancelled) setInitialRouteName(complete ? 'Main' : 'Onboarding');
    });
    return () => {
      cancelled = true;
    };
  }, [db]);

  if (initialRouteName === null) {
    return null;
  }

  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Permissions" component={PermissionsScreen} />
      <Stack.Screen name="Main" component={TabNavigator} />
      <Stack.Screen name="Camera" component={CameraScreen} options={{ presentation: 'fullScreenModal' }} />
      {/* Camera replaces itself with Develop, so the camera unmounts and its capture session
          is released before the develop screen starts doing GPU work. */}
      <Stack.Screen name="Develop" component={DevelopScreen} />
      <Stack.Screen name="Reveal" component={RevealScreen} />
      <Stack.Screen name="CardDetail" component={CardDetailScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Export" component={ExportScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="SkinSelector" component={SkinSelectorScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
