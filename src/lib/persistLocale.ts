// ============================================================
// Enregistrement de la langue choisie par le client.
//
// POURQUOI : le sélecteur de langue ne vivait que dans le navigateur
// (localStorage, via i18next-browser-languagedetector). Le serveur, qui
// envoie les SMS, ne le voyait jamais — et devait donc deviner la langue
// d'après le pays du numéro. Or au Cameroun, pays bilingue, cette déduction
// se trompe précisément sur les clients anglophones.
//
// On enregistre donc le choix. Il devient la source de vérité pour la
// langue des SMS ; le pays ne sert plus que de repli.
// ============================================================

import { supabase } from '@/integrations/supabase/client';

/**
 * Enregistre la langue du client, au mieux.
 *
 * BEST-EFFORT DÉLIBÉRÉ : changer de langue dans l'interface doit fonctionner
 * instantanément, même hors ligne ou sans session. Un échec d'enregistrement
 * ne doit ni bloquer l'affichage, ni remonter une erreur à l'écran — la
 * langue de l'interface a déjà changé, seule celle des futurs SMS attendra
 * le prochain changement.
 *
 * Sans session, on ne fait rien : un visiteur de la page d'accueil qui
 * bascule en anglais n'a pas de fiche client à mettre à jour.
 */
export async function persistPreferredLocale(locale: string): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;

    await supabase.rpc('set_my_preferred_locale', { p_locale: locale });
  } catch {
    // Silencieux par conception : voir le commentaire ci-dessus.
  }
}
