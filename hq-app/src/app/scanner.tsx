// ============================================================
// LE SCANNER NATIF — caméra du téléphone, QR ET codes-barres (bordereaux
// SF / YTO / ZTO, cartons), lampe torche, vibration à chaque lecture.
//
//   · Ouvert par un écran du site (réception, remise, chargement) : le texte
//     lu lui est rendu tel quel ; le scanner se ferme, sauf en mode
//     « continu » (chargement de cartons) où il reste ouvert.
//   · Ouvert par l'onglet central : on décide selon le code et le rôle
//     (voir scan.ts) — fiche paiement, fiche client, nouveau dépôt, remise…
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useHQ } from '../store';
import { routeScan } from '../scan';
import { C } from '../theme';

const BARCODES = ['qr', 'code128', 'code39', 'code93', 'ean13', 'ean8', 'upc_a', 'upc_e', 'itf14', 'codabar', 'datamatrix', 'pdf417', 'aztec'] as const;
/** Le même code relu dans ce délai est ignoré (la caméra lit 10 fois par seconde). */
const SAME_CODE_MS = 2500;

export default function Scanner() {
  const { scan, setScan, web, user, setNativeTab } = useHQ();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const [unknown, setUnknown] = useState<string | null>(null);
  const lastRead = useRef<{ text: string; at: number } | null>(null);
  const done = useRef(false);
  const opened = useRef(scan);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [permission, requestPermission]);

  // Le site a refermé le scanner (il a ce qu'il lui faut) : on s'en va.
  useEffect(() => {
    if (opened.current?.from === 'web' && scan === null && !done.current) {
      done.current = true;
      router.back();
    }
  }, [scan]);

  // En quittant : plus de scanner en cours.
  useEffect(() => () => setScan(null), [setScan]);

  const close = () => {
    if (done.current) return;
    done.current = true;
    router.back();
  };

  const onRead = (result: BarcodeScanningResult) => {
    const text = (result.data ?? '').trim();
    if (!text || done.current || unknown) return;
    const now = Date.now();
    if (lastRead.current && lastRead.current.text === text && now - lastRead.current.at < SAME_CODE_MS) return;
    lastRead.current = { text, at: now };
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLast(text);

    const src = opened.current;
    if (src?.from === 'web') {
      web.current?.deliverScan(text);
      if (!src.continuous) close();
      return;
    }
    if (!user) return close();
    const action = routeScan(user.role, text);
    if (action.kind === 'unknown') {
      setUnknown(text);
      return;
    }
    setNativeTab(null);
    web.current?.navigate(action.path);
    if (action.kind === 'deliver') web.current?.deliverScan(action.text);
    close();
  };

  const continuous = opened.current?.from === 'web' && opened.current.continuous;

  if (!permission) return <View style={styles.root} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        <Ionicons name="camera" size={56} color="#FFFFFF" />
        <Text style={styles.title}>Autorisez l’appareil photo</Text>
        <Text style={styles.hint}>Il sert à scanner les codes des clients, des paiements et des cartons.</Text>
        <Pressable style={styles.primary} onPress={() => (permission.canAskAgain ? void requestPermission() : void Linking.openSettings())}>
          <Text style={styles.primaryText}>{permission.canAskAgain ? 'Autoriser' : 'Ouvrir les réglages'}</Text>
        </Pressable>
        <Pressable onPress={close} style={styles.link}><Text style={styles.linkText}>Fermer</Text></Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: [...BARCODES] }}
        onBarcodeScanned={unknown ? undefined : onRead}
      />
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <View style={styles.top}>
          <Pressable onPress={close} style={styles.round} accessibilityLabel="Fermer" hitSlop={10}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
          <Pressable onPress={() => setTorch((t) => !t)} style={[styles.round, torch && { backgroundColor: '#FFFFFF' }]} accessibilityLabel="Lampe" hitSlop={10}>
            <Ionicons name={torch ? 'flashlight' : 'flashlight-outline'} size={24} color={torch ? C.ink : '#FFFFFF'} />
          </Pressable>
        </View>

        <View style={styles.frameWrap} pointerEvents="none">
          <View style={styles.frame} />
          <Text style={styles.frameHint}>
            {continuous ? 'Scannez les cartons l’un après l’autre' : 'Placez le code dans le cadre'}
          </Text>
        </View>

        <View style={styles.bottom}>
          {last && continuous ? (
            <View style={styles.readPill}><Ionicons name="checkmark-circle" size={20} color="#14AE5C" /><Text style={styles.readText} numberOfLines={1}>{last}</Text></View>
          ) : null}
          {continuous && (
            <Pressable onPress={close} style={styles.primary}><Text style={styles.primaryText}>Terminé</Text></Pressable>
          )}
        </View>
      </SafeAreaView>

      {unknown && (
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Code lu</Text>
          <Text style={styles.sheetCode} selectable>{unknown}</Text>
          <Text style={styles.sheetHint}>Ce code n’est ni un client Bonzini, ni un paiement cash.</Text>
          <Pressable style={styles.sheetButton} onPress={() => { void Clipboard.setStringAsync(unknown); void Haptics.selectionAsync(); }}>
            <Ionicons name="copy" size={18} color={C.ink} /><Text style={styles.sheetButtonText}>Copier</Text>
          </Pressable>
          <Pressable style={[styles.sheetButton, { backgroundColor: C.ink }]} onPress={() => { setUnknown(null); lastRead.current = null; }}>
            <Text style={[styles.sheetButtonText, { color: '#FFFFFF' }]}>Scanner autre chose</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'space-between' },
  top: { flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
  round: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  frameWrap: { alignItems: 'center', gap: 18 },
  frame: { width: 260, height: 260, borderRadius: 28, borderWidth: 4, borderColor: '#FFFFFF' },
  frameHint: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
  bottom: { padding: 20, gap: 12, alignItems: 'center' },
  readPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, maxWidth: '100%' },
  readText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  hint: { color: '#D6D0E0', fontSize: 16, textAlign: 'center', marginBottom: 12 },
  primary: { backgroundColor: '#FFFFFF', borderRadius: 999, height: 56, minWidth: 240, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  primaryText: { color: C.ink, fontSize: 18, fontWeight: '800' },
  link: { padding: 12 },
  linkText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, gap: 12 },
  sheetTitle: { color: C.muted, fontSize: 15, fontWeight: '600' },
  sheetCode: { color: C.text, fontSize: 22, fontWeight: '800' },
  sheetHint: { color: C.muted, fontSize: 15 },
  sheetButton: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: 999, backgroundColor: C.inset },
  sheetButtonText: { color: C.ink, fontSize: 17, fontWeight: '700' },
});
