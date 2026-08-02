import { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';

import { getOnboardingComplete } from '../db/settingsRepository';
import EmptyFirstRunScreen from '../screens/EmptyFirstRunScreen';
import LookBackScreen from '../screens/LookBackScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import PermissionsScreen from '../screens/PermissionsScreen';
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
      <Stack.Screen name="EmptyFirstRun" component={EmptyFirstRunScreen} />
      <Stack.Screen name="LookBack" component={LookBackScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
