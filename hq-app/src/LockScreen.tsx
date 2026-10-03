// ============================================================
// Le verrou de l'app : Face ID, empreinte ou code du téléphone.
// L'app de l'équipe ouvre des soldes, des paiements, des clients : un
// téléphone oublié sur un comptoir ne doit pas suffire. Le site reste
// chargé derrière (la session vit), seul l'écran est masqué.
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

export const INK = '#1A1028';

/** Le téléphone a-t-il un moyen de verrouillage (biométrie ou code) ? Sinon, pas de verrou. */
export async function canLock(): Promise<boolean> {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const unlock = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Ouvrir BONZINI HQ',
        cancelLabel: 'Annuler',
        disableDeviceFallback: false,
      });
      if (r.success) onUnlock();
      else setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [busy, onUnlock]);

  // On propose tout de suite Face ID / l'empreinte, sans attendre un toucher.
  useEffect(() => { void unlock(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.root}>
      <Image source={require('../assets/splash-icon.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>Application de l’équipe</Text>
      <Text style={styles.hint}>{failed ? 'Non reconnu. Réessayez.' : 'Déverrouillez pour continuer.'}</Text>
      <Pressable onPress={unlock} style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]} accessibilityRole="button">
        <Text style={styles.buttonText}>{busy ? '…' : 'Déverrouiller'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: INK, alignItems: 'center', justifyContent: 'center', padding: 32 },
  logo: { width: 180, height: 180, marginBottom: 12 },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  hint: { color: '#D6D0E0', fontSize: 16, marginBottom: 32, textAlign: 'center' },
  button: { backgroundColor: '#FFFFFF', borderRadius: 999, paddingVertical: 16, paddingHorizontal: 40, minWidth: 220, alignItems: 'center' },
  buttonText: { color: INK, fontSize: 17, fontWeight: '700' },
});
