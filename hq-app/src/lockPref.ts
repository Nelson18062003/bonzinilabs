// Verrou Face ID / empreinte : activé par défaut, désactivable dans « Moi ».
import * as SecureStore from 'expo-secure-store';

const KEY = 'hq-lock';
export async function lockWanted(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(KEY)) !== 'off';
  } catch {
    return true;
  }
}
export async function setLockWanted(on: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, on ? 'on' : 'off');
  } catch {
    // stockage indisponible : on garde le verrou
  }
}
