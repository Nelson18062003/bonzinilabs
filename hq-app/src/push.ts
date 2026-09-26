// ============================================================
// Notifications push — côté app.
//
// Une fois la personne connectée : autorisation du téléphone, jeton Expo,
// enregistrement en base (RPC register_staff_push_device, membre du staff
// actif uniquement). Les envois partent de Supabase (déclencheurs sur les
// dépôts, paiements, messages support, arrivées à Douala — migration
// 20260926100000_staff_push_notifications.sql).
// Toucher une notification ouvre la page concernée (data.path).
// À la déconnexion, le téléphone est retiré : il ne reçoit plus rien.
// ============================================================
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { db, hasFreshToken } from './supabase';
import { APP_VERSION } from './config';

// App ouverte : la notification s'affiche quand même (bannière + son).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let registeredToken: string | null = null;

export type PushState = 'ok' | 'denied' | 'unavailable';

export async function registerForPush(): Promise<PushState> {
  try {
    if (!Device.isDevice) return 'unavailable';
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Bonzini — opérations',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 200, 250],
        lightColor: '#A947FE',
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return 'denied';

    // Le projet EAS (ajouté par « eas init ») : sans lui, pas de jeton Expo.
    const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
    const projectId = extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return 'unavailable';

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!hasFreshToken()) return 'unavailable';
    const { data, error } = await db.rpc('register_staff_push_device', {
      p_token: token,
      p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
      p_device_name: Device.modelName ?? null,
      p_app_version: APP_VERSION,
    });
    if (error || !(data as { success?: boolean } | null)?.success) return 'unavailable';
    registeredToken = token;
    return 'ok';
  } catch {
    return 'unavailable';
  }
}

/** À la déconnexion : ce téléphone ne reçoit plus les notifications de la personne. */
export async function unregisterPush(): Promise<void> {
  if (!registeredToken || !hasFreshToken()) return;
  try {
    await db.rpc('unregister_staff_push_device', { p_token: registeredToken });
  } catch {
    // hors ligne : la ligne sera réattribuée à la prochaine connexion sur ce téléphone
  }
  registeredToken = null;
}

/** La page à ouvrir quand on touche une notification. */
export function pathOf(response: Notifications.NotificationResponse | null | undefined): string | null {
  const path = (response?.notification.request.content.data as { path?: unknown } | undefined)?.path;
  return typeof path === 'string' && path.startsWith('/') ? path : null;
}
