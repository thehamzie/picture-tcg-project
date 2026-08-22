import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useThumbnailBackfill } from '../hooks/useThumbnailBackfill';
import BinderScreen from '../screens/BinderScreen';
import SetsScreen from '../screens/SetsScreen';
import TodayScreen from '../screens/TodayScreen';
import DailyPullTabBar from './DailyPullTabBar';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

export default function TabNavigator() {
  // Mounted here rather than in App.tsx so it starts only once the user is past onboarding and
  // there is actually a collection to work through.
  useThumbnailBackfill();

  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <DailyPullTabBar {...props} />}
    >
      <Tab.Screen name="Today" component={TodayScreen} options={{ tabBarLabel: 'TODAY' }} />
      <Tab.Screen name="Binder" component={BinderScreen} options={{ tabBarLabel: 'BINDER' }} />
      <Tab.Screen name="Sets" component={SetsScreen} options={{ tabBarLabel: 'SETS' }} />
    </Tab.Navigator>
  );
}
