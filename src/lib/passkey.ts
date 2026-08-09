// ============================================================
// Clés d'accès (passkeys) — côté navigateur.
//
// Deux appels seulement côté écran : `registerPasskey()` après une connexion
// réussie, et `authenticateWithPasskey()` sur l'écran de connexion. Le reste
// est de la plomberie avec l'Edge Function `passkey`.
//
// POURQUOI fetch() ET NON supabaseAdmin.functions.invoke() :
// invoke() échoue avec « Invalid JWT » sur le client admin (conflit entre les
// deux instances GoTrueClient) — cf. .claude/rules/supabase-clients.md. On
// construit donc la requête à la main.
//
// La biométrie (Face ID, Touch ID, empreinte ou déverrouillage facial Android)
// est choisie par le téléphone, pas par nous : le même code couvre tous les cas.
// ============================================================
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY } from '@/lib/env';

const FUNCTION_URL = `${VITE_SUPABASE_URL}/functions/v1/passkey`;

export interface PasskeyResult {
  success: boolean;
  error?: string;
}

/**
 * Message unique pour « le service n'a pas répondu ».
 *
 * Il ne parle PAS de connexion internet : dans la quasi-totalité des cas
 * l'appareil est parfaitement en ligne et c'est l'Edge Function `passkey` qui
 * n'est pas déployée (voir docs/deploiement-passkeys.md, étape 3). Le texte
 * oriente donc vers l'autre moyen de connexion, immédiatement disponible.
 */
const SERVICE_UNAVAILABLE =
  "La connexion par appareil n'est pas encore disponible. Utilisez le code par email.";

// Marqueur local : « une clé d'accès a été enrôlée sur CET appareil ». Sert
// uniquement à décider si l'écran de connexion met le bouton en avant — sans
// lui, on proposerait Face ID à quelqu'un qui n'a rien enrôlé, et la feuille
// système s'ouvrirait vide. Ce n'est pas un secret et ça n'autorise rien.
const DEVICE_FLAG = 'bonzini-admin-passkey';

export function hasPasskeyOnThisDevice(): boolean {
  try {
    return localStorage.getItem(DEVICE_FLAG) === '1';
  } catch {
    return false;
  }
}

function markPasskeyOnThisDevice(value: boolean) {
  try {
    if (value) localStorage.setItem(DEVICE_FLAG, '1');
    else localStorage.removeItem(DEVICE_FLAG);
  } catch {
    /* stockage indisponible — le bouton sera simplement moins proactif */
  }
}

/** L'utilisateur a fermé la feuille système : ce n'est pas une erreur à afficher. */
export function isUserCancellation(error: unknown): boolean {
  return error instanceof Error && (error.name === 'NotAllowedError' || error.name === 'AbortError');
}

/**
 * Cet appareil sait-il créer/utiliser une clé d'accès ?
 * Sert à n'afficher le bouton que là où il fonctionne.
 */
export async function isPasskeySupported(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

async function call<T>(
  action: string,
  body?: unknown,
  accessToken?: string,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  let response: Response;
  try {
    response = await fetch(`${FUNCTION_URL}?action=${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${accessToken ?? VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    // fetch ne rejette que sur réseau/CORS. Le cas de loin le plus fréquent
    // n'est PAS une panne d'internet : c'est la fonction `passkey` pas encore
    // déployée — le navigateur n'obtient alors pas d'en-tête CORS et jette.
    // Accuser le réseau enverrait chercher au mauvais endroit.
    return { ok: false, error: SERVICE_UNAVAILABLE };
  }

  // 404 = la fonction n'existe pas sur le projet ; 401/403 sur une route
  // publique = la fonction est déployée avec `verify_jwt = true`. Ces deux-là
  // se règlent au déploiement, pas par l'utilisateur : autant le dire.
  if (response.status === 404) return { ok: false, error: SERVICE_UNAVAILABLE };

  let payload: { success?: boolean; error?: string } & Record<string, unknown>;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, error: SERVICE_UNAVAILABLE };
  }

  if (!response.ok || payload.success === false) {
    return { ok: false, error: payload.error ?? 'Erreur inattendue.' };
  }
  return { ok: true, data: payload as T };
}

async function currentAccessToken(): Promise<string | null> {
  const { data } = await supabaseAdmin.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Enrôle cet appareil. L'admin doit être DÉJÀ connecté : une clé d'accès
 * accélère un compte prouvé, elle ne prouve pas une identité à elle seule.
 */
export async function registerPasskey(): Promise<PasskeyResult> {
  const token = await currentAccessToken();
  if (!token) return { success: false, error: 'Session expirée. Reconnecte-toi.' };

  const start = await call<{ options: PublicKeyCredentialCreationOptionsJSON }>(
    'register/start',
    {},
    token,
  );
  if (!start.ok) return { success: false, error: start.error };

  let attestation;
  try {
    attestation = await startRegistration({ optionsJSON: start.data.options });
  } catch (error) {
    if (isUserCancellation(error)) return { success: false };
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Impossible de créer la clé d\'accès.',
    };
  }

  const finish = await call<Record<string, unknown>>(
    'register/finish',
    { challenge: start.data.options.challenge, response: attestation },
    token,
  );
  if (!finish.ok) return { success: false, error: finish.error };

  markPasskeyOnThisDevice(true);
  return { success: true };
}

/**
 * Connecte l'admin avec sa clé d'accès et installe la session renvoyée.
 * Aucun email n'est demandé : la clé est « découvrable », c'est le téléphone
 * qui annonce le compte.
 */
export async function authenticateWithPasskey(): Promise<PasskeyResult> {
  const start = await call<{ options: PublicKeyCredentialRequestOptionsJSON }>('login/start');
  if (!start.ok) return { success: false, error: start.error };

  let assertion;
  try {
    assertion = await startAuthentication({ optionsJSON: start.data.options });
  } catch (error) {
    if (isUserCancellation(error)) return { success: false };
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connexion par clé d\'accès impossible.',
    };
  }

  const finish = await call<{ session: { access_token: string; refresh_token: string } }>(
    'login/finish',
    { challenge: start.data.options.challenge, response: assertion },
  );
  if (!finish.ok) return { success: false, error: finish.error };

  const { error } = await supabaseAdmin.auth.setSession(finish.data.session);
  if (error) return { success: false, error: error.message };

  markPasskeyOnThisDevice(true);
  return { success: true };
}
