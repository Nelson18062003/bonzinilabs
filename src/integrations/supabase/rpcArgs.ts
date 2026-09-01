/**
 * `null` dans les arguments d'une RPC.
 *
 * `supabase gen types` déclare les paramètres optionnels d'une fonction en
 * `T | undefined`. L'application, elle, envoie délibérément `null` : ce n'est
 * PAS équivalent. `undefined` disparaît du corps JSON, donc PostgREST laisse
 * jouer le DEFAULT de la fonction ; `null` écrit vraiment un SQL NULL. Sur
 * `update_payment_beneficiary` ou `create_payment`, la différence est celle
 * entre « efface ce champ » et « ne touche pas à ce champ ».
 *
 * Ce helper autorise donc `null` sur chaque argument, en gardant la
 * vérification des NOMS et des TYPES de paramètres (c'est tout l'intérêt par
 * rapport à un `as never` qui les désactiverait). Aucun effet à l'exécution.
 */
import type { Database } from './types';

type Fn = keyof Database['public']['Functions'];
type ArgsOf<F extends Fn> = Database['public']['Functions'][F]['Args'];
type WithNulls<T> = { [K in keyof T]: T[K] | null };

export function rpcArgs<F extends Fn>(args: WithNulls<ArgsOf<F>>): ArgsOf<F> {
  return args as ArgsOf<F>;
}
