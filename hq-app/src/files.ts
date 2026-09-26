// ============================================================
// Ce que l'app fait des fichiers que la page lui confie (voir bridge.ts).
//
// Un fichier devient un VRAI fichier dans le cache de l'app, puis part par
// la feuille de partage du téléphone : « Enregistrer dans Fichiers »,
// « Enregistrer l'image », WhatsApp, WeChat, e-mail, imprimante… C'est le
// geste que le personnel connaît déjà, sur iPhone comme sur Android.
// ============================================================
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Alert, Share } from 'react-native';
import type { BridgeMessage } from './bridge';

/** Un nom de fichier sûr (le site en donne de bons, mais on ne lui fait pas une confiance aveugle). */
export function safeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/^\.+/, '').trim();
  return (cleaned || 'document').slice(0, 120);
}

/** Type iOS (UTI) pour que la feuille de partage propose les bonnes actions. */
function utiFor(mime: string): string | undefined {
  if (mime === 'application/pdf') return 'com.adobe.pdf';
  if (mime === 'image/png') return 'public.png';
  if (mime === 'image/jpeg') return 'public.jpeg';
  if (mime === 'text/csv') return 'public.comma-separated-values-text';
  return undefined;
}

function writeToCache(name: string, base64: string): File {
  const file = new File(Paths.cache, safeFileName(name));
  if (file.exists) file.delete();
  file.create();
  file.write(base64, { encoding: 'base64' });
  return file;
}

async function shareFile(file: File, mime: string, title: string) {
  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert('Partage indisponible', 'Ce téléphone ne permet pas de partager ce fichier.');
    return;
  }
  await Sharing.shareAsync(file.uri, { mimeType: mime, UTI: utiFor(mime), dialogTitle: title });
}

export async function handleBridgeMessage(msg: BridgeMessage, openUrl: (url: string) => void): Promise<void> {
  switch (msg.type) {
    case 'file': {
      const file = writeToCache(msg.name, msg.base64);
      await shareFile(file, msg.mime, msg.name);
      return;
    }
    case 'files': {
      // La feuille de partage native ne prend qu'un fichier à la fois : on les enchaîne.
      for (const f of msg.files) await shareFile(writeToCache(f.name, f.base64), f.mime, msg.title || f.name);
      return;
    }
    case 'download-url':
      openUrl(msg.url);
      return;
    case 'share-text':
      await Share.share({ message: msg.text, title: msg.title || undefined });
      return;
    case 'clipboard-image':
      await Clipboard.setImageAsync(msg.base64);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    case 'clipboard-text':
      await Clipboard.setStringAsync(msg.text);
      return;
    case 'theme':
      return; // géré par l'écran (couleur des bords)
    case 'error':
      Alert.alert('Fichier', 'Le fichier n’a pas pu être préparé. Réessayez.');
      return;
  }
}
