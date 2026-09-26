// ============================================================
// L'ÉCRAN PRINCIPAL de BONZINI HQ.
//
//   · Le site vit dans UNE WebView toujours montée ; la barre d'onglets
//     NATIVE (par rôle) y navigue sans rechargement.
//   · L'accueil natif (administration) se pose par-dessus quand son onglet
//     est choisi.
//   · Connexion NATIVE : la session obtenue est confiée au site, qui la garde
//     et la rafraîchit ; le site renvoie qui est connecté et chaque jeton.
//   · Scanner natif : ouvert par l'onglet central ou par un écran du site.
//   · Verrou Face ID / empreinte, masque dans le sélecteur d'apps, écran hors
//     connexion, couleur des bords = fond de la page.
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Image, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import NetInfo from '@react-native-community/netinfo';
import type { Session } from '@supabase/supabase-js';
import { HQWebView } from '../HQWebView';
import { LockScreen, canLock } from '../LockScreen';
import { OfflineScreen } from '../OfflineScreen';
import { LoginScreen } from '../LoginScreen';
import { HomeScreen } from '../HomeScreen';
import { TabBar } from '../TabBar';
import { RELOCK_AFTER_MS } from '../config';
import { lockWanted } from '../lockPref';
import { setAccessToken } from '../supabase';
import { isStaffRole, staffHome, type StaffUser } from '../roles';
import { tabForPath, tabsFor, type Tab } from '../tabs';
import { useHQ } from '../store';
import { C } from '../theme';
import type { BridgeMessage } from '../bridge';

/** « rgb(30, 30, 30) » → sombre ? (couleur de la barre d'état) */
function isDark(color: string): boolean {
  const m = color.match(/\d+(\.\d+)?/g);
  if (!m || m.length < 3) return false;
  const [r, g, b] = m.map(Number);
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}

const LOGIN_PATHS = ['/m/login', '/a/login', '/r/login', '/w/login', '/auth'];

export default function Main() {
  const { user, setUser, route, setRoute, web, setScan, nativeTab, setNativeTab } = useHQ();
  const [background, setBackground] = useState('#FFFFFF');
  const [offline, setOffline] = useState(false);
  const [lockEnabled, setLockEnabled] = useState<boolean | null>(null);
  const [locked, setLocked] = useState(true);
  const [covered, setCovered] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const backgroundedAt = useRef<number | null>(null);
  const splashHidden = useRef(false);
  const loginTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevUserId = useRef<string | null>(null);

  const hideSplash = useCallback(() => {
    if (splashHidden.current) return;
    splashHidden.current = true;
    void SplashScreen.hideAsync();
  }, []);

  // Verrou : si le téléphone en a un (biométrie ou code) et si la personne le veut.
  useEffect(() => {
    void Promise.all([canLock(), lockWanted()]).then(([hw, wanted]) => {
      const on = hw && wanted;
      setLockEnabled(on);
      if (!on) setLocked(false);
    });
  }, []);

  // Au pire, l'écran de lancement se retire au bout de 12 s.
  useEffect(() => {
    const t = setTimeout(hideSplash, 12_000);
    return () => clearTimeout(t);
  }, [hideSplash]);

  // Retour dans l'app après une absence : on reverrouille ; masque en arrière-plan.
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
  useEffect(() => NetInfo.addEventListener((s) => {
    if (s.isConnected === false) setOffline(true);
    else if (s.isConnected && offline) {
      setOffline(false);
      web.current?.reload();
    }
  }), [offline, web]);

  const tabs = useMemo(() => (user ? tabsFor(user.role) : []), [user]);
  const hasHome = tabs.some((t) => t.native === 'home');

  // Ce que le site dit à l'app.
  const onSiteMessage = useCallback((msg: Extract<BridgeMessage, { type: 'auth' | 'route' | 'scan-open' | 'scan-close' | 'theme' }>) => {
    switch (msg.type) {
      case 'theme':
        setBackground(msg.background);
        return;
      case 'route':
        setRoute(msg.path);
        return;
      case 'scan-open':
        setScan({ from: 'web', continuous: msg.continuous });
        router.push('/scanner');
        return;
      case 'scan-close':
        setScan(null);
        return;
      case 'auth': {
        hideSplash();
        setAccessToken(msg.accessToken, msg.expiresAt);
        const u = msg.user;
        const staff: StaffUser | null = u && isStaffRole(u.role) ? { ...u, role: u.role } : null;
        if (staff) {
          if (loginTimer.current) clearTimeout(loginTimer.current);
          setLoginBusy(false);
          setLoginError(null);
        }
        setUser(staff);
        return;
      }
    }
  }, [hideSplash, setRoute, setScan, setUser]);

  // Nouvelle personne connectée : son espace, et l'accueil natif si son rôle en a un.
  useEffect(() => {
    const id = user?.id ?? null;
    if (id === prevUserId.current) return;
    prevUserId.current = id;
    if (!user) {
      setNativeTab(null);
      return;
    }
    setNativeTab(tabsFor(user.role).some((t) => t.native === 'home') ? 'home' : null);
    if (!route || LOGIN_PATHS.some((p) => route.startsWith(p))) web.current?.navigate(staffHome(user.role));
  }, [user, route, setNativeTab, web]);

  // Connexion native réussie : la session est confiée au site, qui confirme par « auth ».
  const onSession = useCallback((session: Session) => {
    // On vient de prouver qui on est : pas de Face ID juste après.
    setLocked(false);
    setLoginBusy(true);
    setLoginError(null);
    web.current?.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
    if (loginTimer.current) clearTimeout(loginTimer.current);
    loginTimer.current = setTimeout(() => {
      setLoginBusy(false);
      setLoginError('La connexion n’a pas abouti. Vérifiez le réseau et réessayez.');
    }, 15_000);
  }, [web]);

  const open = useCallback((path: string) => {
    setNativeTab(null);
    web.current?.navigate(path);
  }, [setNativeTab, web]);

  const onTab = useCallback((t: Tab) => {
    if (t.native === 'home') setNativeTab('home');
    else if (t.native === 'scan') {
      setScan({ from: 'tab' });
      router.push('/scanner');
    } else if (t.native === 'me') router.push('/me');
    else if (t.path) open(t.path);
  }, [open, setNativeTab, setScan]);

  const activeKey = nativeTab === 'home' ? 'home' : tabForPath(tabs, route)?.key ?? null;
  const onBackAtRoot = useCallback(() => {
    if (hasHome && nativeTab !== 'home') {
      setNativeTab('home');
      return true;
    }
    return false;
  }, [hasHome, nativeTab, setNativeTab]);

  const showLogin = user === null;
  const dark = isDark(background);

  return (
    <View style={styles.root}>
      <StatusBar style={showLogin || locked || covered ? 'light' : nativeTab === 'home' ? 'dark' : dark ? 'light' : 'dark'} />
      <SafeAreaView style={[styles.root, { backgroundColor: nativeTab === 'home' ? C.canvas : background }]} edges={['top', 'left', 'right']}>
        <View style={styles.root}>
          <HQWebView
            ref={web}
            onFirstLoad={() => {}}
            onNetworkError={() => setOffline(true)}
            onSiteMessage={onSiteMessage}
            onBackAtRoot={onBackAtRoot}
          />
          {user && nativeTab === 'home' && (
            <View style={StyleSheet.absoluteFill}>
              <HomeScreen user={user} onOpen={open} />
            </View>
          )}
        </View>
      </SafeAreaView>
      {user && tabs.length > 0 && <TabBar tabs={tabs} activeKey={activeKey} onPress={onTab} />}

      {showLogin && <LoginScreen onSession={onSession} busy={loginBusy} error={loginError} />}
      {offline && (
        <OfflineScreen
          onRetry={() => {
            setOffline(false);
            web.current?.reload();
          }}
        />
      )}
      {lockEnabled && locked && !showLogin && <LockScreen onUnlock={() => setLocked(false)} />}
      {covered && !locked && (
        <View style={styles.cover}>
          <Image source={require('../../assets/splash-icon.png')} style={styles.coverLogo} resizeMode="contain" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  cover: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  coverLogo: { width: 180, height: 180 },
});
