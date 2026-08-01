import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import CollectionScreen from '../screens/CollectionScreen';
import HomeScreen from '../screens/HomeScreen';
import OpenCardScreen from '../screens/OpenCardScreen';
import { theme } from '../theme/theme';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Collection" component={CollectionScreen} />
      <Tab.Screen name="Open" component={OpenCardScreen} />
    </Tab.Navigator>
  );
}
