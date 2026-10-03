/**
 * Les parties prenantes d'un conteneur — qui fait quoi, en mots simples.
 *
 * Une PARTIE (cargo_parties) est une organisation ou une personne externe à
 * Bonzini, rangée dans un annuaire commun. Un RÔLE (cargo_shipment_parties)
 * dit ce qu'elle fait sur un conteneur donné. Le même transitaire revient
 * d'un conteneur à l'autre : on le choisit dans l'annuaire au lieu de le
 * ressaisir.
 */
import type { Database } from '@/integrations/supabase/types';

export type CargoParty = Database['public']['Tables']['cargo_parties']['Row'];
export type CargoShipmentParty = Database['public']['Tables']['cargo_shipment_parties']['Row'];
export type CargoShipmentPartyWithParty = CargoShipmentParty & { party: CargoParty };

export const PARTY_ROLES = [
  'SUPPLIER', 'WAREHOUSE', 'FORWARDER', 'SHIPPER',
  'CARRIER', 'SHIPPING_AGENT', 'INSURER',
  'DECLARANT', 'CUSTOMS_BROKER', 'BESC_AGENT', 'INSPECTION', 'EXPERT', 'TERMINAL', 'TRUCKER',
  'CONSIGNEE', 'NOTIFY', 'OTHER',
] as const;
export type PartyRole = (typeof PARTY_ROLES)[number];

export type PartyGroup = 'china' | 'sea' | 'cameroon' | 'receiver';

export const PARTY_GROUPS: { key: PartyGroup; label: string; hint: string }[] = [
  { key: 'china', label: 'En Chine', hint: 'du fournisseur jusqu’au navire' },
  { key: 'sea', label: 'Le transport', hint: 'l’armateur et ceux qui le représentent' },
  { key: 'cameroon', label: 'Au Cameroun', hint: 'du port jusqu’à la sortie de la douane' },
  { key: 'receiver', label: 'Le destinataire', hint: 'à qui la marchandise est livrée' },
];

/** Libellé, explication en une phrase, et groupe de chaque rôle. */
export const PARTY_ROLE_META: Record<PartyRole, { label: string; hint: string; group: PartyGroup }> = {
  SUPPLIER: { label: 'Fournisseur', hint: 'vend la marchandise au client et la livre à notre entrepôt', group: 'china' },
  WAREHOUSE: { label: 'Entrepôt', hint: 'reçoit, mesure les colis et remplit le conteneur', group: 'china' },
  FORWARDER: { label: 'Transitaire en Chine', hint: 'réserve la place sur le navire, fait le camion et la douane d’export', group: 'china' },
  SHIPPER: { label: 'Chargeur (sur le B/L)', hint: 'nom inscrit comme expéditeur sur le B/L ; il détient les originaux', group: 'china' },
  CARRIER: { label: 'Armateur', hint: 'la compagnie maritime qui transporte le conteneur', group: 'sea' },
  SHIPPING_AGENT: { label: 'Consignataire du navire', hint: 'représente l’armateur au port d’arrivée : avis d’arrivée, bon à délivrer', group: 'sea' },
  INSURER: { label: 'Assureur', hint: 'assure la marchandise pendant le transport', group: 'sea' },
  DECLARANT: { label: 'Déclarant en douane', hint: 'prépare et dépose la déclaration, suit la liquidation', group: 'cameroon' },
  CUSTOMS_BROKER: { label: 'Cabinet de dédouanement', hint: 'société agréée (commissionnaire en douane) qui signe la déclaration', group: 'cameroon' },
  BESC_AGENT: { label: 'Agent BESC', hint: 'délivre le bordereau électronique de suivi des cargaisons', group: 'cameroon' },
  INSPECTION: { label: 'Inspection (SGS, CIVIC)', hint: 'contrôle la valeur et l’état, délivre le CIVIC des véhicules', group: 'cameroon' },
  EXPERT: { label: 'Expert', hint: 'certifie l’identité des véhicules (certificat d’identification)', group: 'cameroon' },
  TERMINAL: { label: 'Terminal / port', hint: 'décharge et garde le conteneur au port', group: 'cameroon' },
  TRUCKER: { label: 'Transporteur', hint: 'amène le conteneur du port à l’entrepôt de Douala', group: 'cameroon' },
  CONSIGNEE: { label: 'Destinataire (sur le B/L)', hint: 'à qui la marchandise est adressée sur le B/L', group: 'receiver' },
  NOTIFY: { label: 'À notifier (notify)', hint: 'qui l’armateur prévient de l’arrivée', group: 'receiver' },
  OTHER: { label: 'Autre', hint: 'tout autre intervenant', group: 'cameroon' },
};

/** Les rôles qu'un dossier d'import devrait avoir : on propose de les remplir. */
export const KEY_ROLES: PartyRole[] = ['FORWARDER', 'SHIPPER', 'CARRIER', 'SHIPPING_AGENT', 'DECLARANT', 'CONSIGNEE'];

export function isPartyRole(v: string | null | undefined): v is PartyRole {
  return !!v && (PARTY_ROLES as readonly string[]).includes(v);
}

export function roleLabel(v: string): string {
  return isPartyRole(v) ? PARTY_ROLE_META[v].label : v;
}

/** Numéro de téléphone → lien WhatsApp (chiffres seulement, indicatif compris). */
export function whatsappUrl(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

export function telUrl(raw: string | null | undefined): string | null {
  const clean = (raw ?? '').replace(/[^\d+]/g, '');
  return clean.length >= 6 ? `tel:${clean}` : null;
}

export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean);
  return (words.length >= 2 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase();
}
