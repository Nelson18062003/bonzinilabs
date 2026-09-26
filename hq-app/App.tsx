// ============================================================
// BONZINI HQ — l'app mobile du personnel Bonzini (Android + iOS).
//
// Une connexion pour tous : chacun entre avec son email (code reçu par email
// ou mot de passe) et le site l'envoie vers SON espace selon son rôle :
// administration (/m), agent cash (/a), réception Guangzhou (/r), entrepôt
// Douala (/w). Les écrans sont ceux du site : une amélioration mise en ligne
// arrive dans l'app sans republier sur les stores.
//
// Ce que l'app ajoute au site : verrou Face ID / empreinte, fichiers et
// partage natifs, écran hors connexion, masquage dans le sélecteur d'apps.
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Image, StyleSheet, View, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import NetInfo from '@react-native-community/netinfo';
import { HQWebView, type HQWebViewHandle } from './src/HQWebView';
import { LockScreen, canLock, INK } from './src/LockScreen';
import { OfflineScreen } from './src/OfflineScreen';
import { RELOCK_AFTER_MS } from './src/config';

void SplashScreen.preventAutoHideAsync();

/** « rgb(30, 30, 30) » → sombre ? (pour la couleur de la barre d'état) */
function isDark(color: string): boolean {
  const m = color.match(/\d+(\.\d+)?/g);
  if (!m || m.length < 3) return false;
  const [r, g, b] = m.map(Number);
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}

export default function App() {
  const scheme = useColorScheme();
  const web = useRef<HQWebViewHandle>(null);
  const [background, setBackground] = useState(scheme === 'dark' ? '#1E1E1E' : '#FFFFFF');
  const [offline, setOffline] = useState(false);
  // Verrou : décidé au lancement (le téléphone a-t-il Face ID / empreinte / code ?).
  const [lockEnabled, setLockEnabled] = useState<boolean | null>(null);
  const [locked, setLocked] = useState(true);
  // Masque dans le sélecteur d'apps : les soldes ne s'affichent pas en miniature.
  const [covered, setCovered] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    void canLock().then((ok) => {
      setLockEnabled(ok);
      if (!ok) setLocked(false);
    });
  }, []);

  // Écran de lancement retiré à la première page, ou au bout de 10 s au pire.
  const hideSplash = useCallback(() => { void SplashScreen.hideAsync(); }, []);
  useEffect(() => {
    const t = setTimeout(hideSplash, 10_000);
    return () => clearTimeout(t);
  }, [hideSplash]);

  // Retour dans l'app après une absence : on reverrouille.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setCovered(false);
        const away = backgroundedAt.current;
        backgroundedAt.current = null;
        if (lockEnabled && away !== null && Date.now() - away > RELOCK_AFTER_MS) setLocked(true);
      } else {
        setCovered(true);
        if (state === 'background' && backgroundedAt.current === null) backgroundedAt.current = Date.now();
      }
    });
    return () => sub.remove();
  }, [lockEnabled]);

  // Le réseau revient : on recharge la page qui avait échoué.
  useEffect(() => {
    return NetInfo.addEventListener((s) => {
      if (s.isConnected === false) setOffline(true);
      else if (s.isConnected && offline) {
        setOffline(false);
        web.current?.reload();
      }
    });
  }, [offline]);

  const dark = isDark(background);

  return (
    <SafeAreaProvider>
      <StatusBar style={locked || covered ? 'light' : dark ? 'light' : 'dark'} />
      <SafeAreaView style={[styles.root, { backgroundColor: background }]} edges={['top', 'bottom', 'left', 'right']}>
        <HQWebView
          ref={web}
          onFirstLoad={hideSplash}
          onNetworkError={() => setOffline(true)}
          onTheme={setBackground}
        />
      </SafeAreaView>
      {offline && (
        <OfflineScreen
          onRetry={() => {
            setOffline(false);
            web.current?.reload();
          }}
        />
      )}
      {lockEnabled && locked && <LockScreen onUnlock={() => setLocked(false)} />}
      {covered && !locked && (
        <View style={styles.cover}>
          <Image source={require('./assets/splash-icon.png')} style={styles.coverLogo} resizeMode="contain" />
        </View>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  cover: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' },
  coverLogo: { width: 180, height: 180 },
});
