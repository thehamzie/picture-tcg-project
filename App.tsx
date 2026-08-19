import { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { NavigationContainer, type Theme } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { migrateDbIfNeeded } from './src/db/schema';
import RootNavigator from './src/navigation/RootNavigator';
import { SkinProvider, useSkin } from './src/theme/SkinContext';
import { fonts, FONT_ASSETS } from './src/theme/typography';

// The splash is held until Archivo / Archivo Black / DM Mono are resident, so no screen ever
// renders a frame in the system fallback face — the heavy-caps display type is load-bearing
// enough that a swap would be visible.
SplashScreen.preventAutoHideAsync().catch(() => {
  /* Already hidden, or unavailable on this platform — not fatal. */
});

export default function App() {
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);

  const onLayout = useCallback(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (fontError) console.warn('Font loading failed, falling back to system faces:', fontError);
  }, [fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayout}>
      <SafeAreaProvider>
        <SQLiteProvider databaseName="dailypull.db" onInit={migrateDbIfNeeded}>
          <SkinProvider>
            <ThemedNavigation />
          </SkinProvider>
        </SQLiteProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Lives inside SkinProvider so navigation's own chrome (the flash between screens, the
 * modal backdrop) uses the active skin's shell instead of React Navigation's white default,
 * which otherwise flashes on every push.
 */
function ThemedNavigation() {
  const { skin } = useSkin();

  const navigationTheme: Theme = {
    dark: true,
    colors: {
      primary: skin.shell.accent,
      background: skin.shell.background,
      card: skin.shell.surface,
      text: skin.shell.textPrimary,
      border: skin.shell.border,
      notification: skin.shell.accent,
    },
    fonts: {
      regular: { fontFamily: fonts.body, fontWeight: '400' },
      medium: { fontFamily: fonts.bodyMedium, fontWeight: '500' },
      bold: { fontFamily: fonts.bodySemi, fontWeight: '600' },
      heavy: { fontFamily: fonts.display, fontWeight: '400' },
    },
  };

  return (
    <View style={{ flex: 1, backgroundColor: skin.shell.background }}>
      <NavigationContainer theme={navigationTheme}>
        <RootNavigator />
      </NavigationContainer>
      <StatusBar style={skin.id === 'scrapbookSun' ? 'dark' : 'light'} />
    </View>
  );
}
