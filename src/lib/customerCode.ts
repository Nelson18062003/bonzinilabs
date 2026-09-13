// ============================================================
// IDENTIFIANT CLIENT — `BZ-NNNNNN`, un code par client, pour toujours.
//
// Le même code sert deux métiers de Bonzini :
//   · PAIEMENT — le client l'écrit dans le libellé de son virement bancaire ;
//     au rapprochement, on retrouve le dépôt sans deviner à partir d'un nom.
//   · CARGO — le fournisseur chinois colle l'étiquette (QR + code) sur chaque
//     carton ; à l'entrepôt, un scan suffit pour rattacher le colis au client,
//     sans taper un nom que l'équipe chinoise ne sait pas orthographier.
//
// Le code est attribué côté base (déclencheur `assign_customer_code`) et
// immuable. Ici ne vivent que le format, la lecture tolérante et le contenu
// du QR — partagés par l'app client (qui l'affiche) et l'app admin (qui le
// scanne). Miroir de `find_client_by_customer_code` en SQL.
// ============================================================

/** Forme canonique stockée en base. */
export const CUSTOMER_CODE_PATTERN = /^BZ-[1-9][0-9]{5}$/;

/**
 * Le QR encode une URL, pas le code nu : n'importe quel appareil photo
 * l'ouvre sur notre site, et l'app admin sait en extraire le code. L'hôte est
 * figé — une étiquette imprimée depuis un environnement de test doit rester
 * lisible en production.
 */
export const CUSTOMER_QR_BASE_URL = 'https://bonzinilabs.com/c/';

/**
 * Ramène une saisie ou un scan à `BZ-NNNNNN`, ou `null`.
 * Tolère la casse, les espaces, un tiret oublié et l'URL du QR :
 *   « bz 482913 » · « BZ-482913 » · « https://bonzinilabs.com/c/BZ-482913 »
 * Six chiffres seuls (« 482913 ») sont acceptés aussi : c'est ce qu'un agent
 * recopie depuis un relevé bancaire quand le préfixe a sauté.
 */
export function normalizeCustomerCode(input: string | null | undefined): string | null {
  if (!input) return null;
  const upper = input.toUpperCase();
  const withPrefix = upper.match(/BZ[^0-9]{0,3}([1-9][0-9]{5})(?![0-9])/);
  if (withPrefix) return `BZ-${withPrefix[1]}`;
  const bare = upper.trim().match(/^([1-9][0-9]{5})$/);
  if (bare) return `BZ-${bare[1]}`;
  return null;
}

export function isCustomerCode(value: string | null | undefined): value is string {
  return !!value && CUSTOMER_CODE_PATTERN.test(value);
}

/** Contenu encodé dans le QR code du client. */
export function customerQrPayload(code: string): string {
  return `${CUSTOMER_QR_BASE_URL}${code}`;
}

/**
 * Adresses de réception en Chine, imprimées sur l'étiquette colis.
 * À COMPLÉTER par l'équipe : tant qu'une ligne est entre crochets, l'étiquette
 * n'affiche pas le bloc (on n'imprime pas un placeholder chez un fournisseur).
 */
export interface ChinaReceivingAddress {
  /** Libellé court, bilingue. */
  label: { fr: string; zh: string; en: string };
  /** Adresse complète en chinois — c'est ce que lit le livreur. */
  addressZh: string;
  /** Nom du destinataire à écrire sur le colis (收件人). */
  recipientZh: string;
  /** Téléphone joignable en Chine. */
  phone: string;
}

export const CHINA_RECEIVING_ADDRESSES: ChinaReceivingAddress[] = [
  {
    label: { fr: 'Entrepôt', zh: '仓库', en: 'Warehouse' },
    addressZh: '[ADRESSE ENTREPÔT CHINE — à compléter]',
    recipientZh: '[DESTINATAIRE ENTREPÔT — à compléter]',
    phone: '[TÉLÉPHONE ENTREPÔT — à compléter]',
  },
  {
    label: { fr: 'Bureau', zh: '办公室', en: 'Office' },
    addressZh: '[ADRESSE BUREAU CHINE — à compléter]',
    recipientZh: '[DESTINATAIRE BUREAU — à compléter]',
    phone: '[TÉLÉPHONE BUREAU — à compléter]',
  },
];

export function isAddressConfigured(a: ChinaReceivingAddress): boolean {
  return ![a.addressZh, a.recipientZh, a.phone].some((v) => /^\[.*\]$/.test(v.trim()));
}
