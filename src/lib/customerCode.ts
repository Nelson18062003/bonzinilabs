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
 * Où le fournisseur expédie — DEUX destinations, une seule par étiquette.
 * Le client choisit celle qu'on lui a indiquée (entrepôt en général, bureau
 * pour certains). Chaque étiquette porte donc UNE adresse, très grande.
 *
 * Les valeurs vivent en base (platform_settings, clé « shipping »), éditables
 * depuis l'app admin ; ce qui suit est le FORMAT et le REPLI (valeurs de
 * départ, identiques à celles semées par la migration) — utilisé le temps que
 * la ligne arrive, ou si elle est absente.
 */
export type ShippingDestination = 'warehouse' | 'office';

export interface ShippingLocation {
  /** Adresse complète en chinois — la ligne que lit le livreur. Sauts de ligne permis. */
  addressZh: string;
  /** Même adresse en anglais — pour le client africain et son transitaire. */
  addressEn: string;
  /** Nom du destinataire à écrire sur le colis (收件人) : la personne sur place. */
  recipient: string;
  /** Téléphone du lieu (celui que compose le livreur). */
  phone: string;
  wechat: string;
  whatsapp: string;
  email: string;
}

export interface ShippingCompany {
  nameZh: string;
  nameEn: string;
  email: string;
  phone: string;
  wechat: string;
  whatsapp: string;
}

export interface ShippingSettings {
  company: ShippingCompany;
  warehouse: ShippingLocation;
  office: ShippingLocation;
}

export const SHIPPING_DESTINATIONS: ShippingDestination[] = ['warehouse', 'office'];

export const DESTINATION_LABEL: Record<ShippingDestination, { zh: string; en: string; fr: string }> = {
  warehouse: { zh: '仓库', en: 'Warehouse', fr: 'Entrepôt' },
  office: { zh: '广州办公室', en: 'Guangzhou office', fr: 'Bureau de Guangzhou' },
};

export const DEFAULT_SHIPPING_SETTINGS: ShippingSettings = {
  company: {
    nameZh: '',
    nameEn: 'Bonzini Labs',
    email: 'contact@bonziniapps.com',
    phone: '+86 186 6743 9286',
    wechat: '138 2229 7518',
    whatsapp: '+86 186 6743 9286',
  },
  warehouse: {
    addressZh: '广东省广州市白云区窖心街\n白云湖物流园 K栋 18档',
    addressEn: 'Unit 18, Building K, Baiyun Lake Logistics Park, Jiaoxin Street, Baiyun District, Guangzhou, Guangdong',
    recipient: 'Tina',
    phone: '199 2746 3902',
    wechat: '138 2229 7518',
    whatsapp: '+86 186 6743 9286',
    email: 'contact@bonziniapps.com',
  },
  office: {
    addressZh: '广州市广园西路219号\n客麦隆大厦二楼 259',
    addressEn: '259, 2/F, Cameroon Building, No. 219 Guangyuan West Road, Guangzhou, China',
    recipient: 'Tina',
    phone: '138 2229 7518',
    wechat: '138 2229 7518',
    whatsapp: '+86 186 6743 9286',
    email: 'contact@bonziniapps.com',
  },
};

const str = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback);

function parseLocation(raw: unknown, fallback: ShippingLocation): ShippingLocation {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    addressZh: str(r.addressZh, fallback.addressZh),
    addressEn: str(r.addressEn, fallback.addressEn),
    recipient: str(r.recipient, fallback.recipient),
    phone: str(r.phone, fallback.phone),
    wechat: str(r.wechat, fallback.wechat),
    whatsapp: str(r.whatsapp, fallback.whatsapp),
    email: str(r.email, fallback.email),
  };
}

/** Ce qui sort de la base est du jsonb libre : on le ramène au format, champ par champ. */
export function parseShippingSettings(raw: unknown): ShippingSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const c = (r.company && typeof r.company === 'object' ? r.company : {}) as Record<string, unknown>;
  const d = DEFAULT_SHIPPING_SETTINGS;
  return {
    company: {
      nameZh: str(c.nameZh, d.company.nameZh),
      nameEn: str(c.nameEn, d.company.nameEn),
      email: str(c.email, d.company.email),
      phone: str(c.phone, d.company.phone),
      wechat: str(c.wechat, d.company.wechat),
      whatsapp: str(c.whatsapp, d.company.whatsapp),
    },
    warehouse: parseLocation(r.warehouse, d.warehouse),
    office: parseLocation(r.office, d.office),
  };
}

/** Une destination sans adresse ni destinataire n'est pas proposée au client. */
export function isLocationConfigured(l: ShippingLocation): boolean {
  return l.addressZh.trim().length > 0 && l.recipient.trim().length > 0;
}
