// ============================================================
// L'ACCUEIL NATIF (administration, opérations, support, trésorerie).
// Ce qui attend une action, en gros chiffres, lu directement dans Supabase
// (mêmes requêtes que le badge « Opérations » du site : lib/actionable.ts),
// puis les raccourcis de SON rôle. Tirer vers le bas pour rafraîchir.
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { db, hasFreshToken } from './supabase';
import { DEPOSITS_TO_PROCESS, PAYMENTS_TO_PROCESS } from './statuses';
import { can, firstName, ROLE_LABEL, type StaffUser } from './roles';
import { C } from './theme';
import type { IconName } from './tabs';


interface Counts { deposits: number | null; payments: number | null }

interface Shortcut { key: string; label: string; icon: IconName; path: string; color: string; show: boolean }

function shortcuts(user: StaffUser): Shortcut[] {
  const r = user.role;
  const all: Shortcut[] = [
    { key: 'ops', label: 'Opérations', icon: 'swap-horizontal', path: '/m/ops', color: C.violet, show: can(r, 'viewPayments') },
    { key: 'pay', label: 'Nouveau paiement', icon: 'arrow-up-circle', path: '/m/payments/new', color: C.orange, show: r === 'super_admin' || r === 'ops' },
    { key: 'dep', label: 'Nouveau dépôt', icon: 'arrow-down-circle', path: '/m/deposits/new', color: C.green, show: r === 'super_admin' || r === 'ops' || r === 'customer_success' },
    { key: 'clients', label: 'Clients', icon: 'people', path: '/m/clients', color: C.ink, show: can(r, 'viewClients') },
    { key: 'mola', label: 'Mola', icon: 'sparkles', path: '/m/assistant', color: C.violet, show: r !== 'treasurer' && r !== 'commercial' },
    { key: 'cargo', label: 'Cargo', icon: 'boat', path: '/m/cargo', color: C.ink, show: can(r, 'viewCargo') },
    { key: 'rates', label: 'Taux du jour', icon: 'trending-up', path: '/m/more/rates', color: C.amber, show: can(r, 'manageRates') },
    { key: 'treasury', label: 'Trésorerie', icon: 'wallet', path: '/m/more/treasury', color: C.green, show: can(r, 'viewTreasury') },
    { key: 'support', label: 'Messagerie', icon: 'chatbubbles', path: '/m/support', color: C.violet, show: can(r, 'supportChat') },
    { key: 'details', label: 'Coordonnées de paiement', icon: 'card', path: '/m/more/payment-details', color: C.orange, show: r !== 'treasurer' && r !== 'commercial' },
  ];
  return all.filter((s) => s.show);
}

function today(): string {
  const d = new Date();
  const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

export function HomeScreen({ user, onOpen }: { user: StaffUser; onOpen: (path: string) => void }) {
  const [counts, setCounts] = useState<Counts>({ deposits: null, payments: null });
  const [refreshing, setRefreshing] = useState(false);
  const showCounts = can(user.role, 'viewDeposits') || can(user.role, 'viewPayments');

  const load = useCallback(async () => {
    if (!showCounts || !hasFreshToken()) return;
    const [d, p] = await Promise.all([
      db.from('deposits').select('id', { count: 'exact', head: true }).in('status', DEPOSITS_TO_PROCESS),
      db.from('payments').select('id', { count: 'exact', head: true }).in('status', PAYMENTS_TO_PROCESS),
    ]);
    setCounts({ deposits: d.error ? null : d.count ?? 0, payments: p.error ? null : p.count ?? 0 });
  }, [showCounts]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.ink} />}>
      <Text style={styles.date}>{today()}</Text>
      <Text style={styles.hello}>Bonjour {firstName(user)}</Text>
      <View style={styles.role}><Text style={styles.roleText}>{ROLE_LABEL[user.role]}</Text></View>

      {showCounts && (
        <View style={styles.counts}>
          <Count label="Dépôts à valider" value={counts.deposits} color={C.green} onPress={() => onOpen('/m/deposits')} />
          <Count label="Paiements à traiter" value={counts.payments} color={C.orange} onPress={() => onOpen('/m/payments')} />
        </View>
      )}

      <Text style={styles.section}>Raccourcis</Text>
      <View style={styles.grid}>
        {shortcuts(user).map((s) => (
          <Pressable key={s.key} onPress={() => onOpen(s.path)} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.8 }]} accessibilityRole="button">
            <View style={[styles.tileIcon, { backgroundColor: s.color }]}>
              <Ionicons name={s.icon} size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.tileLabel} numberOfLines={2}>{s.label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function Count({ label, value, color, onPress }: { label: string; value: number | null; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.count, pressed && { opacity: 0.85 }]} accessibilityRole="button">
      <Text style={[styles.countValue, { color: value ? color : C.faint }]}>{value ?? '—'}</Text>
      <Text style={styles.countLabel}>{label}</Text>
      <Ionicons name="arrow-forward" size={18} color={C.muted} style={{ marginTop: 6 }} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.canvas },
  content: { padding: 20, paddingBottom: 40 },
  date: { color: C.muted, fontSize: 15, textTransform: 'capitalize' },
  hello: { color: C.text, fontSize: 30, fontWeight: '800', marginTop: 2, letterSpacing: -0.5 },
  role: { alignSelf: 'flex-start', backgroundColor: C.inset, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginTop: 10 },
  roleText: { color: C.body, fontSize: 14, fontWeight: '600' },
  counts: { flexDirection: 'row', gap: 12, marginTop: 22 },
  count: { flex: 1, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16 },
  countValue: { fontSize: 38, fontWeight: '800', letterSpacing: -1 },
  countLabel: { color: C.body, fontSize: 15, fontWeight: '600', marginTop: 2 },
  section: { color: C.text, fontSize: 18, fontWeight: '700', marginTop: 28, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { width: '31%', flexGrow: 1, minWidth: 100, borderRadius: 18, backgroundColor: C.inset, padding: 14, gap: 10 },
  tileIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { color: C.text, fontSize: 15, fontWeight: '700' },
});
