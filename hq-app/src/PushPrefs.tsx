// ============================================================
// « Ce que je reçois » (écran Moi) — un interrupteur par type de
// notification, seulement ceux qui concernent le rôle de la personne
// (liste et libellés fournis par le serveur : staff_push_prefs_get).
// Le choix vaut pour tous ses téléphones ; le serveur filtre à l'envoi.
// ============================================================
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';
import { db } from './supabase';
import { C } from './theme';

interface Kind {
  kind: string;
  label: string;
  hint: string;
  enabled: boolean;
}

export function PushPrefs() {
  const [kinds, setKinds] = useState<Kind[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    void db.rpc('staff_push_prefs_get').then(({ data, error: e }) => {
      if (!alive) return;
      const r = data as { success?: boolean; kinds?: Kind[] } | null;
      if (e || !r?.success) setError(true);
      else setKinds(r.kinds ?? []);
    });
    return () => {
      alive = false;
    };
  }, []);

  const toggle = (kind: string, enabled: boolean) => {
    setKinds((ks) => ks?.map((k) => (k.kind === kind ? { ...k, enabled } : k)) ?? ks);
    void db.rpc('staff_push_set_pref', { p_kind: kind, p_enabled: enabled }).then(({ data, error: e }) => {
      const r = data as { success?: boolean } | null;
      // Refusé : on remet l'interrupteur comme avant.
      if (e || !r?.success) setKinds((ks) => ks?.map((k) => (k.kind === kind ? { ...k, enabled: !enabled } : k)) ?? ks);
    });
  };

  if (error) return <Text style={styles.note}>Réglages indisponibles pour le moment.</Text>;
  if (!kinds) return <ActivityIndicator style={{ marginVertical: 16 }} color={C.faint} />;
  if (kinds.length === 0) return <Text style={styles.note}>Aucune notification prévue pour votre rôle.</Text>;

  return (
    <View style={styles.card}>
      {kinds.map((k, i) => (
        <View key={k.kind}>
          {i > 0 && <View style={styles.sep} />}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{k.label}</Text>
              <Text style={styles.hint}>{k.hint}</Text>
            </View>
            <Switch value={k.enabled} onValueChange={(v) => toggle(k.kind, v)} accessibilityLabel={k.label} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 10 },
  title: { fontSize: 17, fontWeight: '600', color: C.text },
  hint: { fontSize: 14, color: C.muted, marginTop: 2 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: C.border },
  note: { fontSize: 15, color: C.muted, marginVertical: 8 },
});
