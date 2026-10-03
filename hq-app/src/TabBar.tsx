// La barre d'onglets native : grandes cibles, libellés lisibles, le scanner
// au centre en bouton rond (le geste le plus fréquent en réception et à Douala).
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { C } from './theme';
import type { Tab } from './tabs';

interface Props {
  tabs: Tab[];
  activeKey: string | null;
  onPress: (tab: Tab) => void;
  badges?: Record<string, number>;
}

export function TabBar({ tabs, activeKey, onPress, badges = {} }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist">
      {tabs.map((t) => {
        const active = t.key === activeKey;
        const badge = badges[t.key] ?? 0;
        const press = () => {
          void Haptics.selectionAsync();
          onPress(t);
        };
        if (t.native === 'scan') {
          return (
            <Pressable key={t.key} onPress={press} style={styles.item} accessibilityRole="button" accessibilityLabel={t.label}>
              <View style={styles.scan}>
                <Ionicons name="scan" size={28} color="#FFFFFF" />
              </View>
              <Text style={[styles.label, styles.scanLabel]} numberOfLines={1}>{t.label}</Text>
            </Pressable>
          );
        }
        return (
          <Pressable key={t.key} onPress={press} style={styles.item} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={t.label}>
            <View>
              <Ionicons name={active ? t.icon : (`${t.icon}-outline` as Tab['icon'])} size={25} color={active ? C.ink : C.faint} />
              {badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, { color: active ? C.ink : C.faint, fontWeight: active ? '700' : '500' }]} numberOfLines={1}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: C.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, paddingTop: 6 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', minHeight: 54, gap: 3 },
  label: { fontSize: 12, letterSpacing: -0.1 },
  scan: { width: 58, height: 58, borderRadius: 29, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', marginTop: -22, borderWidth: 4, borderColor: C.canvas, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  scanLabel: { color: C.ink, fontWeight: '700' },
  badge: { position: 'absolute', top: -4, right: -12, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
});
