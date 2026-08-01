import { createNativeStackNavigator } from '@react-navigation/native-stack';

import EmptyFirstRunScreen from '../screens/EmptyFirstRunScreen';
import LookBackScreen from '../screens/LookBackScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import PermissionsScreen from '../screens/PermissionsScreen';
import TabNavigator from './TabNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="Main" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Permissions" component={PermissionsScreen} />
      <Stack.Screen name="Main" component={TabNavigator} />
      <Stack.Screen name="EmptyFirstRun" component={EmptyFirstRunScreen} />
      <Stack.Screen name="LookBack" component={LookBackScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
