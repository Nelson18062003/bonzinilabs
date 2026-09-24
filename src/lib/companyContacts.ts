// ============================================================
// LES NUMÉROS DE CONTACT DE LA SOCIÉTÉ — pour nous APPELER ou nous écrire
// sur WhatsApp. Ce ne sont PAS des comptes de paiement : ceux-là sont dans
// src/data/depositMethodsData.ts.
// Un seul endroit pour le site (pied de page), les pages légales, le flyer des
// taux et la carte de devis. La fonction serveur du flyer en garde une copie :
// supabase/functions/generate-flyer/index.ts (à changer en même temps).
// Aucune dépendance : ce fichier est lu par la page d'accueil publique.
// ============================================================

/** Cameroun — WhatsApp et appels. */
export const CONTACT_PHONE_CM = '+237 652 236 856';
/** Chine — WhatsApp / WeChat. */
export const CONTACT_PHONE_CN = '+86 131 3849 5598';

/** Le lien WhatsApp d'un numéro : « +237 652 236 856 » → « https://wa.me/237652236856 ». */
export function whatsappLink(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}`;
}
