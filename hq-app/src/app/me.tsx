// ============================================================
// « MOI » — la personne connectée, ses réglages sur ce téléphone, la
// déconnexion. Natif pour tous les rôles (réception, Douala et agent cash
// n'ont pas d'autre écran de profil).
// ============================================================
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useHQ } from '../store';
import { ROLE_LABEL, staffHome } from '../roles';
import { APP_VERSION } from '../config';
import { canLock } from '../LockScreen';
import { lockWanted, setLockWanted } from '../lockPref';
import { pushState, registerForPush, unregisterPush, type PushState } from '../push';
import { applyUpdate, fetchUpdate, onUpdateReady, runningLabel, updateReady, updatesOn } from '../updates';
import { C } from '../theme';

export default function Me() {
  const { user, web, setNativeTab } = useHQ();
  const [lockOn, setLockOn] = useState(true);
  const [lockPossible, setLockPossible] = useState(false);
  const [push, setPush] = useState<PushState | null>(pushState());
  const [update, setUpdate] = useState(updateReady());
  const [checking, setChecking] = useState(false);

  useEffect(() => onUpdateReady(setUpdate), []);

  useEffect(() => {
    void Promise.all([canLock(), lockWanted()]).then(([hw, wanted]) => {
      setLockPossible(hw);
      setLockOn(wanted);
    });
  }, []);

  if (!user) return <View style={styles.root} />;
  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || user.email[0]?.toUpperCase();
  const isAdminSpace = staffHome(user.role) === '/m';

  const openSite = (path: string) => {
    setNativeTab(null);
    web.current?.navigate(path);
    router.back();
  };

  const logout = () => {
    Alert.alert('Se déconnecter ?', 'Il faudra vous reconnecter pour utiliser l’app.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Se déconnecter',
        style: 'destructive',
        onPress: () => {
          // Ce téléphone ne recevra plus les notifications de la personne.
          void unregisterPush().finally(() => web.current?.logout());
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Moi</Text>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Fermer">
          <Ionicons name="close-circle" size={30} color={C.faint} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.identity}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
          <Text style={styles.name}>{`${user.firstName} ${user.lastName}`.trim() || user.email}</Text>
          <Text style={styles.email}>{user.email}</Text>
          <View style={styles.role}><Text style={styles.roleText}>{ROLE_LABEL[user.role]}</Text></View>
        </View>

        <Text style={styles.section}>Sur ce téléphone</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="finger-print" size={24} color={C.ink} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Verrouiller l’app</Text>
              <Text style={styles.rowHint}>{lockPossible ? 'Face ID, empreinte ou code à l’ouverture' : 'Activez un code ou Face ID / empreinte dans les réglages du téléphone'}</Text>
            </View>
            <Switch
              value={lockPossible && lockOn}
              disabled={!lockPossible}
              onValueChange={(v) => {
                setLockOn(v);
                void setLockWanted(v);
              }}
            />
          </View>
          <View style={styles.sep} />
          <Pressable
            onPress={() => {
              if (push === 'denied') void Linking.openSettings();
              else if (push !== 'ok') void registerForPush().then(setPush);
            }}
            disabled={push === 'ok'}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
          >
            <Ionicons name="notifications" size={24} color={C.ink} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Notifications</Text>
              <Text style={styles.rowHint}>{PUSH_HINT[push ?? 'pending']}</Text>
            </View>
            <Ionicons
              name={push === 'ok' ? 'checkmark-circle' : push === 'denied' ? 'open-outline' : 'refresh'}
              size={22}
              color={push === 'ok' ? C.green : C.faint}
            />
          </Pressable>
        </View>

        {isAdminSpace && (
          <>
            <Text style={styles.section}>Mon compte</Text>
            <View style={styles.card}>
              <Row icon="person" title="Mon profil" onPress={() => openSite('/m/more/profile')} />
              <View style={styles.sep} />
              <Row icon="lock-closed" title="Mon mot de passe" onPress={() => openSite('/m/more/password')} />
              <View style={styles.sep} />
              <Row icon="settings" title="Réglages" onPress={() => openSite('/m/more/settings')} />
            </View>
          </>
        )}

        {updatesOn && (
          <>
            <Text style={styles.section}>Application</Text>
            <View style={styles.card}>
              <Pressable
                onPress={() => {
                  if (update) applyUpdate();
                  else {
                    setChecking(true);
                    void fetchUpdate(true).finally(() => setChecking(false));
                  }
                }}
                disabled={checking}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
              >
                <Ionicons name={update ? 'rocket' : 'cloud-download'} size={24} color={update ? C.violet : C.ink} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{update ? 'Nouvelle version prête' : 'Mises à jour'}</Text>
                  <Text style={styles.rowHint}>{update ? 'Toucher pour redémarrer l’app dessus' : checking ? 'Recherche…' : 'Toucher pour chercher une nouvelle version'}</Text>
                </View>
                {update && <View style={styles.pill}><Text style={styles.pillText}>Redémarrer</Text></View>}
              </Pressable>
            </View>
          </>
        )}

        <Pressable onPress={logout} style={({ pressed }) => [styles.logout, pressed && { opacity: 0.85 }]} accessibilityRole="button">
          <Ionicons name="log-out" size={20} color={C.red} />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </Pressable>

        <Text style={styles.version}>BONZINI HQ · version {APP_VERSION} · {runningLabel()}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const PUSH_HINT: Record<PushState | 'pending', string> = {
  ok: 'Activées : dépôts, paiements, messages, arrivées',
  denied: 'Refusées — toucher pour les autoriser dans les réglages',
  unavailable: 'Pas encore disponibles sur ce téléphone — toucher pour réessayer',
  pending: 'Vérification…',
};

function Row({ icon, title, onPress }: { icon: 'person' | 'lock-closed' | 'settings'; title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]} accessibilityRole="button">
      <Ionicons name={icon} size={22} color={C.ink} />
      <Text style={[styles.rowTitle, { flex: 1 }]}>{title}</Text>
      <Ionicons name="chevron-forward" size={20} color={C.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.canvas },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: C.text },
  content: { padding: 20, paddingTop: 4, paddingBottom: 40 },
  identity: { alignItems: 'center', gap: 4, marginBottom: 12 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  avatarText: { color: '#FFFFFF', fontSize: 30, fontWeight: '800' },
  name: { fontSize: 22, fontWeight: '800', color: C.text, textAlign: 'center' },
  email: { fontSize: 15, color: C.muted },
  role: { backgroundColor: C.inset, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginTop: 6 },
  roleText: { color: C.body, fontSize: 14, fontWeight: '600' },
  section: { fontSize: 16, fontWeight: '700', color: C.muted, marginTop: 22, marginBottom: 8 },
  card: { borderRadius: 18, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 10 },
  rowTitle: { fontSize: 17, fontWeight: '600', color: C.text },
  rowHint: { fontSize: 14, color: C.muted, marginTop: 2 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: C.border },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56, borderRadius: 999, borderWidth: 1, borderColor: '#F3B8B4', marginTop: 28 },
  logoutText: { color: C.red, fontSize: 17, fontWeight: '700' },
  pill: { backgroundColor: C.violet, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  pillText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  version: { textAlign: 'center', color: C.faint, fontSize: 13, marginTop: 20 },
});
