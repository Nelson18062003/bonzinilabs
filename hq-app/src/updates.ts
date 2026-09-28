// ============================================================
// Mises à jour « over the air » (EAS Update) de la partie native — sans
// repasser par les stores. Le site, lui, se met à jour tout seul.
//   · Au lancement : expo-updates vérifie et télécharge (appliqué au
//     lancement suivant).
//   · Au retour dans l'app (au plus toutes les 30 min) : même chose.
//   · Une mise à jour prête s'applique au prochain retour après une longue
//     absence (l'écran est de toute façon reverrouillé), ou tout de suite
//     depuis « Moi ».
// Inactif tant que `eas update:configure` n'a pas ajouté updates.url.
// ============================================================
import * as Updates from 'expo-updates';
import { C } from './theme';

export const updatesOn = Updates.isEnabled && !__DEV__;
const CHECK_EVERY_MS = 30 * 60 * 1000;

let ready = false;
let lastCheck = 0;
const listeners = new Set<(ready: boolean) => void>();

export function updateReady(): boolean {
  return ready;
}

export function onUpdateReady(l: (ready: boolean) => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Cherche et télécharge une mise à jour (sans l'appliquer). */
export async function fetchUpdate(force = false): Promise<boolean> {
  if (!updatesOn || ready) return ready;
  if (!force && Date.now() - lastCheck < CHECK_EVERY_MS) return false;
  lastCheck = Date.now();
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return false;
    const res = await Updates.fetchUpdateAsync();
    if (res.isNew) {
      ready = true;
      listeners.forEach((l) => l(true));
    }
  } catch {
    // hors ligne ou service indisponible : on réessaiera
  }
  return ready;
}

/** Redémarre sur la nouvelle version (la session est gardée par le site). */
export function applyUpdate(): void {
  if (!ready) return;
  Updates.reloadAsync({
    reloadScreenOptions: { backgroundColor: C.ink, fade: true, spinner: { enabled: true, color: '#FFFFFF', size: 'large' } },
  }).catch(() => {});
}

/** Ce qui tourne : « intégrée » (la version du store) ou l'identifiant court de la mise à jour. */
export function runningLabel(): string {
  return !updatesOn || Updates.isEmbeddedLaunch || !Updates.updateId ? 'intégrée' : Updates.updateId.slice(0, 8);
}
