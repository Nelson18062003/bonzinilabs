// La racine : l'état partagé, puis la pile d'écrans. L'écran principal (la
// WebView + les onglets natifs) reste monté sous le scanner et « Moi ».
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { HQProvider } from '../store';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <HQProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="scanner" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="me" options={{ presentation: 'modal' }} />
        </Stack>
      </HQProvider>
    </SafeAreaProvider>
  );
}
