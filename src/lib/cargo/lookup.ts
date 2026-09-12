/**
 * L'état d'une recherche de référence — et surtout : quand décider qu'elle
 * ne répondra plus.
 *
 * Le chemin est asynchrone et en trois temps : la RPC `request_cargo_lookup`
 * écrit une ligne `pending`, déclenche l'edge function `cargo-lookup` par
 * pg_net, et rend la main tout de suite. L'edge function interroge l'armateur
 * puis repasse la ligne en `done` ou `error`. L'écran sonde la ligne.
 *
 * Le trou : `net.http_post` est un TIR SANS RETOUR. Si l'edge function n'est
 * pas déployée, pg_net reçoit un 404 et personne ne le voit — la ligne reste
 * `pending` à jamais et l'écran tourne indéfiniment. C'est exactement ce qui
 * s'est produit en production le 12/09/2026 sur le B/L 271875389 : la
 * référence était bonne, l'API armateur répondait, mais rien ne revenait.
 *
 * On ne peut pas corriger ça côté base sans un veilleur périodique. On le
 * corrige donc là où ça compte pour la personne : au bout d'un délai, l'écran
 * arrête d'attendre, dit ce qui bloque, et propose la saisie manuelle. Une
 * recherche qui n'aboutit pas doit être une RÉPONSE, jamais un sablier.
 */
import type { CargoLookup } from '@/lib/cargo/model';

/** Au-delà, on cesse de prétendre que ça va arriver. */
export const LOOKUP_STALLED_MS = 45_000;
/** Au-delà, on arrête aussi de sonder : plus personne ne viendra. */
export const LOOKUP_GIVE_UP_MS = 180_000;

export type LookupState = 'pending' | 'stalled' | 'done' | 'error' | 'unsupported';

export function lookupAgeMs(lookup: Pick<CargoLookup, 'created_at'>, now = Date.now()): number {
  return now - new Date(lookup.created_at).getTime();
}

/**
 * L'état réel, délai compris. `stalled` n'existe pas en base : c'est une
 * lecture de l'écran, parce que la base n'a aucun moyen de savoir qu'un appel
 * parti chez pg_net n'arrivera jamais.
 */
export function lookupState(
  lookup: Pick<CargoLookup, 'status' | 'created_at'> | null | undefined,
  now = Date.now(),
): LookupState | null {
  if (!lookup) return null;
  if (lookup.status !== 'pending') return lookup.status as LookupState;
  return lookupAgeMs(lookup, now) > LOOKUP_STALLED_MS ? 'stalled' : 'pending';
}

/** Faut-il continuer à sonder la ligne ? */
export function shouldPollLookup(
  lookup: Pick<CargoLookup, 'status' | 'created_at'> | null | undefined,
  now = Date.now(),
): boolean {
  if (!lookup || lookup.status !== 'pending') return false;
  return lookupAgeMs(lookup, now) < LOOKUP_GIVE_UP_MS;
}

/**
 * Ce qu'on affiche quand ça ne répond pas. On nomme les causes réelles dans
 * l'ordre de probabilité, parce qu'un « une erreur est survenue » n'aide
 * personne à réparer quoi que ce soit.
 */
export const STALLED_TITLE = 'L’armateur ne nous a pas répondu';
export const STALLED_BODY =
  'La demande est partie mais rien n’est revenu. Ce n’est pas la référence : c’est la chaîne de recherche côté serveur.';
export const STALLED_CAUSES = [
  'la fonction « cargo-lookup » n’est pas déployée — c’est la cause la plus fréquente, et elle est silencieuse : la base envoie la demande sans jamais savoir qu’elle tombe dans le vide',
  'la clé Maersk (MAERSK_CONSUMER_KEY) n’est pas renseignée côté serveur',
  'le quota de l’armateur est atteint — la clé d’essai est limitée à 20 appels par heure',
] as const;
