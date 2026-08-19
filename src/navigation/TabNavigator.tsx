import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import BinderScreen from '../screens/BinderScreen';
import SetsScreen from '../screens/SetsScreen';
import TodayScreen from '../screens/TodayScreen';
import DailyPullTabBar from './DailyPullTabBar';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

export default function TabNavigator() {
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
