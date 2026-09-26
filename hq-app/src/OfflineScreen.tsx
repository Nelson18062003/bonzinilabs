// Pas de réseau : un écran clair plutôt qu'une page d'erreur de navigateur.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { INK } from './LockScreen';

export function OfflineScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.root}>
      <Text style={styles.icon}>📡</Text>
      <Text style={styles.title}>Pas de connexion</Text>
      <Text style={styles.hint}>Vérifiez le Wi-Fi ou les données mobiles, puis réessayez. Rien de ce que vous avez enregistré n’est perdu.</Text>
      <Pressable onPress={onRetry} style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]} accessibilityRole="button">
        <Text style={styles.buttonText}>Réessayer</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 32 },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { color: INK, fontSize: 22, fontWeight: '700', marginBottom: 8 },
  hint: { color: '#5A5A5A', fontSize: 16, lineHeight: 22, marginBottom: 28, textAlign: 'center', maxWidth: 340 },
  button: { backgroundColor: INK, borderRadius: 999, paddingVertical: 16, paddingHorizontal: 40, minWidth: 220, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
});
