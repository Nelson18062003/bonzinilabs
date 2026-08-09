// ============================================================
// Gabarits SMS — 17 événements × 2 langues (FR / EN).
//
// CONTRAT : tout gabarit rendu avec des valeurs réalistes DOIT tenir en
// UN SEUL segment GSM-7 (≤ 160 caractères). Le test
// src/tests/lib/smsTemplates.test.ts le vérifie pour les 34 combinaisons,
// avec des valeurs maximales (référence longue, montants à 9 chiffres,
// motif de refus à la limite de troncature).
//
// ⚠️ PIÈGE Intl : `new Intl.NumberFormat('fr-FR').format(1500000)` renvoie
// « 1 500 000 » séparé par U+202F (espace fine insécable), qui n'est PAS
// dans la table GSM-7. Utiliser Intl tel quel ferait basculer TOUS les
// messages contenant un montant en UCS-2 — soit un doublement silencieux
// du coût sur la quasi-totalité du trafic. Les formateurs ci-dessous
// normalisent donc explicitement les séparateurs en espace ASCII.
// (send-email peut, lui, utiliser Intl directement : le HTML s'en moque.)
//
// Aucun import externe : ce module tourne sous Deno (send-sms) et sous
// vitest (test de non-régression).
// ============================================================

import { foldToGsm7, measureSms, truncateForSms, type SmsMeasure } from "./gsm7.ts";

export type SmsLocale = "fr" | "en";

export const SMS_LOCALES: readonly SmsLocale[] = ["fr", "en"] as const;

/** Longueur maximale d'un motif de refus injecté dans un gabarit. */
export const REASON_MAX_LENGTH = 60;

export interface SmsPayload {
  [key: string]: unknown;
}

export interface RenderedSms {
  text: string;
  measure: SmsMeasure;
}

// ─── Formateurs (sortie garantie GSM-7) ─────────────────────────────────────

/** Espaces fines/insécables → espace ASCII. Voir l'avertissement Intl ci-dessus. */
function asciiSpaces(value: string): string {
  return value.replace(/[\u00a0\u202f\u2009\u2007]/g, " ");
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Groupe les milliers par espace ASCII, sans dépendre d'Intl. */
function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatXaf(value: unknown): string {
  const n = toNumber(value);
  if (n === null) return "0";
  const rounded = Math.round(Math.abs(n));
  const sign = n < 0 ? "-" : "";
  return sign + asciiSpaces(groupThousands(String(rounded)));
}

export function formatRmb(value: unknown): string {
  const n = toNumber(value);
  if (n === null) return "0.00";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const [int, dec = "00"] = abs.toFixed(2).split(".");
  return sign + asciiSpaces(groupThousands(int)) + "." + dec;
}

export function formatRate(value: unknown): string {
  const n = toNumber(value);
  if (n === null) return "0.00";
  return n.toFixed(2);
}

/**
 * Champ texte libre (référence, motif, horodatage) : replié en GSM-7 puis
 * tronqué. Toute valeur venant de la base passe obligatoirement par ici.
 */
function safeText(value: unknown, maxLength: number, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  const raw = typeof value === "string" ? value : String(value);
  const folded = foldToGsm7(raw).replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ");
  const trimmed = folded.trim();
  if (trimmed === "") return fallback;
  return truncateForSms(trimmed, maxLength);
}

const ref = (p: SmsPayload): string => safeText(p.reference, 24, "votre operation");
const reason = (p: SmsPayload): string => safeText(p.reason, REASON_MAX_LENGTH, "non precise");
const when = (p: SmsPayload): string => safeText(p.when ?? p.changed_at ?? p.occurred_at, 24, "recemment");
const code = (p: SmsPayload): string => safeText(p.code, 10, "------");

// ─── Registre des gabarits ──────────────────────────────────────────────────
//
// Le préfixe « Bonzini: » est répété volontairement dans chaque gabarit :
// sur les réseaux où l'expéditeur alphanumérique est réécrit (Chine, US,
// Canada, Afrique du Sud, Brésil, Mexique), c'est la SEULE chose qui
// identifie l'émetteur pour le client.

export type SmsTemplateFn = (payload: SmsPayload) => string;

export const SMS_TEMPLATES: Record<string, Record<SmsLocale, SmsTemplateFn>> = {
  // ── Palier 1 : mouvements d'argent (déjà câblés sur notifications) ────────
  deposit_created: {
    fr: (p) => `Bonzini: demande de versement ${ref(p)} enregistrée. Montant ${formatXaf(p.amount_xaf)} XAF. Vérification sous 24h.`,
    en: (p) => `Bonzini: deposit request ${ref(p)} received. Amount ${formatXaf(p.amount_xaf)} XAF. Review within 24h.`,
  },
  deposit_validated: {
    fr: (p) => `Bonzini: versement ${ref(p)} validé. ${formatXaf(p.amount_xaf)} XAF crédités. Nouveau solde ${formatXaf(p.new_balance)} XAF.`,
    en: (p) => `Bonzini: deposit ${ref(p)} approved. ${formatXaf(p.amount_xaf)} XAF credited. New balance ${formatXaf(p.new_balance)} XAF.`,
  },
  deposit_rejected: {
    fr: (p) => `Bonzini: versement ${ref(p)} refusé. Motif: ${reason(p)}. Ouvrez l'app pour la renvoyer.`,
    en: (p) => `Bonzini: deposit ${ref(p)} declined. Reason: ${reason(p)}. Open the app to resend it.`,
  },
  deposit_correction_needed: {
    fr: (p) => `Bonzini: votre versement ${ref(p)} demande une correction. Ouvrez l'app pour compléter.`,
    en: (p) => `Bonzini: your deposit ${ref(p)} needs a correction. Open the app to complete it.`,
  },
  payment_created: {
    fr: (p) => `Bonzini: paiement ${ref(p)} créé. ${formatRmb(p.amount_rmb)} RMB réservés. Solde ${formatXaf(p.new_balance)} XAF.`,
    en: (p) => `Bonzini: payment ${ref(p)} created. ${formatRmb(p.amount_rmb)} RMB reserved. Balance ${formatXaf(p.new_balance)} XAF.`,
  },
  payment_processing: {
    fr: (p) => `Bonzini: paiement ${ref(p)} en cours d'exécution vers votre fournisseur.`,
    en: (p) => `Bonzini: payment ${ref(p)} is being sent to your supplier.`,
  },
  payment_completed: {
    fr: (p) => `Bonzini: paiement ${ref(p)} de ${formatRmb(p.amount_rmb)} RMB effectué. Preuve disponible dans l'app.`,
    en: (p) => `Bonzini: payment ${ref(p)} of ${formatRmb(p.amount_rmb)} RMB completed. Proof available in the app.`,
  },
  payment_rejected: {
    fr: (p) => `Bonzini: paiement ${ref(p)} annulé. ${formatXaf(p.amount_xaf)} XAF remboursés sur votre solde.`,
    en: (p) => `Bonzini: payment ${ref(p)} cancelled. ${formatXaf(p.amount_xaf)} XAF refunded to your balance.`,
  },

  // ── Palier 2 : sécurité du compte ────────────────────────────────────────
  phone_verification: {
    fr: (p) => `Bonzini: votre code de vérification est ${code(p)}. Valable 10 minutes. Ne le partagez jamais.`,
    en: (p) => `Bonzini: your verification code is ${code(p)}. Valid for 10 minutes. Never share it.`,
  },
  password_changed: {
    fr: (p) => `Bonzini: mot de passe modifié le ${when(p)}. Si ce n'est pas vous, contactez-nous vite.`,
    en: (p) => `Bonzini: password changed on ${when(p)}. If this was not you, contact us immediately.`,
  },
  new_device_login: {
    fr: (p) => `Bonzini: nouvelle connexion à votre compte le ${when(p)}. Si ce n'est pas vous, alertez-nous.`,
    en: (p) => `Bonzini: new sign-in to your account on ${when(p)}. If this was not you, alert us.`,
  },
  kyc_required: {
    fr: () => `Bonzini: votre compte demande une pièce d'identité pour rester actif. Ajoutez-la dans l'app.`,
    en: () => `Bonzini: your account needs an ID document to stay active. Upload it in the app.`,
  },
  kyc_approved: {
    fr: () => `Bonzini: identité vérifiée. Votre compte est actif, vous pouvez payer vos fournisseurs.`,
    en: () => `Bonzini: identity verified. Your account is active, you can now pay your suppliers.`,
  },

  // ── Palier 3 : relance et engagement ─────────────────────────────────────
  deposit_awaiting_proof: {
    fr: (p) => `Bonzini: votre versement ${ref(p)} attend sa preuve. Ajoutez-la pour recevoir votre crédit.`,
    en: (p) => `Bonzini: deposit ${ref(p)} is still missing its proof. Add it to receive your credit.`,
  },
  payment_awaiting_beneficiary: {
    fr: (p) => `Bonzini: paiement ${ref(p)} en attente des infos du bénéficiaire. Complétez dans l'app.`,
    en: (p) => `Bonzini: payment ${ref(p)} is waiting for beneficiary details. Complete it in the app.`,
  },
  cash_payment_ready: {
    fr: (p) => `Bonzini: retrait espèces ${ref(p)} disponible. Présentez votre code en agence.`,
    en: (p) => `Bonzini: cash pickup ${ref(p)} is ready. Show your code at the branch.`,
  },
  daily_rate_alert: {
    fr: (p) => `Bonzini: taux du jour 1 RMB = ${formatRate(p.rate)} XAF. Répondez STOP pour ne plus recevoir.`,
    en: (p) => `Bonzini: today's rate 1 RMB = ${formatRate(p.rate)} XAF. Reply STOP to unsubscribe.`,
  },
};

export const SMS_TEMPLATE_KEYS = Object.keys(SMS_TEMPLATES);

// ─── Rendu ──────────────────────────────────────────────────────────────────

/** Normalise une langue arbitraire (profil client, code pays) vers fr | en. */
export function resolveLocale(input: unknown): SmsLocale {
  const raw = typeof input === "string" ? input.trim().toLowerCase() : "";
  if (raw.startsWith("fr")) return "fr";
  if (raw.startsWith("en")) return "en";
  return "fr"; // le cœur du portefeuille est francophone
}

/**
 * Rend un gabarit. Renvoie null si le gabarit est inconnu — l'appelant
 * marque alors la ligne d'outbox en 'skipped' plutôt que d'envoyer un
 * message vide ou de faire tomber tout le lot.
 */
export function renderSms(
  template: string,
  locale: SmsLocale,
  payload: SmsPayload,
): RenderedSms | null {
  const entry = SMS_TEMPLATES[template];
  if (!entry) return null;

  const fn = entry[locale] ?? entry.fr;
  const text = fn(payload ?? {});
  return { text, measure: measureSms(text) };
}
