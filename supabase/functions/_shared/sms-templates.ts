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

/**
 * Longueur maximale d'un motif de refus injecté dans un gabarit.
 *
 * Calibrée sur le pire cas mesuré par le test : prénom composé long +
 * montant à 9 chiffres + référence longue + motif au maximum. Au-delà,
 * deposit_rejected passe à deux segments et double son coût.
 * « preuve illisible », « montant non conforme » tiennent largement.
 */
export const REASON_MAX_LENGTH = 26;

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

const ref = (p: SmsPayload): string => safeText(p.reference, 20, "non communiquee");
const reason = (p: SmsPayload): string => safeText(p.reason, REASON_MAX_LENGTH, "non precise");
const when = (p: SmsPayload): string => safeText(p.when ?? p.changed_at ?? p.occurred_at, 20, "recemment");
const code = (p: SmsPayload): string => safeText(p.code, 10, "------");

/**
 * Ouverture du message.
 *
 * Le prénom est le seul élément qui distingue un message écrit pour
 * quelqu'un d'un message produit par une machine. Quand il manque, on
 * ouvre par une salutation neutre plutôt que d'attaquer en minuscule —
 * un SMS qui commence par « votre versement… » a l'air tronqué.
 *
 * Plafonné à 14 caractères : un prénom composé ne doit pas manger le
 * budget du montant et de la référence.
 */
const greetFr = (p: SmsPayload): string => {
  const name = safeText(p.first_name, 12, "");
  return name ? `${name}, ` : "Bonjour, ";
};

const greetEn = (p: SmsPayload): string => {
  const name = safeText(p.first_name, 12, "");
  return name ? `Hi ${name}, ` : "Hello, ";
};

// ─── Registre des gabarits ──────────────────────────────────────────────────
//
// REGISTRE D'ÉCRITURE : celui du mobile money, que nos clients lisent déjà
// tous les jours. Une phrase complète, le montant avant tout le reste, le
// solde ensuite, la référence à la fin. Pas de style télégraphique — un
// « versement BZ-DP-2026-0042 validé » se lit comme une ligne de journal,
// pas comme une nouvelle qu'on annonce à quelqu'un.
//
// PLUS DE PRÉFIXE « Bonzini: ». Vérifié en production : l'expéditeur affiché
// est déjà BONZINI. Le répéter en tête de message coûtait 9 caractères pour
// dire deux fois la même chose, et donnait au message son air de notification
// automatique. La marque revient là où elle a un sens dans la phrase.
//
// ORDRE DES INFORMATIONS : ce que le client veut savoir en premier, c'est
// combien et où en est son argent — pas un identifiant qu'il ne connaît pas.
// La référence sert au support ; elle passe donc en dernier.

export type SmsTemplateFn = (payload: SmsPayload) => string;

export const SMS_TEMPLATES: Record<string, Record<SmsLocale, SmsTemplateFn>> = {
  // ── Palier 1 : mouvements d'argent ───────────────────────────────────────
  deposit_created: {
    fr: (p) => `${greetFr(p)}Bonzini a bien enregistré votre versement de ${formatXaf(p.amount_xaf)} XAF. Nous le vérifions sous 24h. Ref: ${ref(p)}`,
    en: (p) => `${greetEn(p)}Bonzini has received your transfer of ${formatXaf(p.amount_xaf)} XAF. We are checking it within 24h. Ref: ${ref(p)}`,
  },
  deposit_validated: {
    fr: (p) => `${greetFr(p)}votre versement de ${formatXaf(p.amount_xaf)} XAF est validé. Nouveau solde Bonzini: ${formatXaf(p.new_balance)} XAF. Ref: ${ref(p)}`,
    en: (p) => `${greetEn(p)}your transfer of ${formatXaf(p.amount_xaf)} XAF is approved. New Bonzini balance: ${formatXaf(p.new_balance)} XAF. Ref: ${ref(p)}`,
  },
  deposit_rejected: {
    fr: (p) => `${greetFr(p)}votre versement de ${formatXaf(p.amount_xaf)} XAF est refusé. Motif: ${reason(p)}. Renvoyez la preuve dans l'app Bonzini. Ref: ${ref(p)}`,
    en: (p) => `${greetEn(p)}your transfer of ${formatXaf(p.amount_xaf)} XAF was declined. Reason: ${reason(p)}. Send it again in the Bonzini app. Ref: ${ref(p)}`,
  },
  deposit_correction_needed: {
    fr: (p) => `${greetFr(p)}votre versement de ${formatXaf(p.amount_xaf)} XAF demande une correction. Ouvrez l'app Bonzini pour la faire. Ref: ${ref(p)}`,
    en: (p) => `${greetEn(p)}your transfer of ${formatXaf(p.amount_xaf)} XAF needs a correction. Open the Bonzini app to fix it. Ref: ${ref(p)}`,
  },
  payment_created: {
    fr: (p) => `${greetFr(p)}votre paiement de ${formatRmb(p.amount_rmb)} RMB est enregistré. Nouveau solde Bonzini: ${formatXaf(p.new_balance)} XAF. Ref: ${ref(p)}`,
    en: (p) => `${greetEn(p)}your payment of ${formatRmb(p.amount_rmb)} RMB is registered. New Bonzini balance: ${formatXaf(p.new_balance)} XAF. Ref: ${ref(p)}`,
  },
  payment_processing: {
    fr: (p) => `${greetFr(p)}Bonzini exécute votre paiement de ${formatRmb(p.amount_rmb)} RMB vers votre fournisseur. Ref: ${ref(p)}`,
    en: (p) => `${greetEn(p)}Bonzini is sending your payment of ${formatRmb(p.amount_rmb)} RMB to your supplier. Ref: ${ref(p)}`,
  },
  payment_completed: {
    fr: (p) => `${greetFr(p)}votre fournisseur a bien été payé: ${formatRmb(p.amount_rmb)} RMB envoyés. Preuve dans l'app Bonzini. Ref: ${ref(p)}`,
    en: (p) => `${greetEn(p)}your supplier has been paid: ${formatRmb(p.amount_rmb)} RMB sent. Proof in the Bonzini app. Ref: ${ref(p)}`,
  },
  payment_rejected: {
    fr: (p) => `${greetFr(p)}votre paiement de ${formatRmb(p.amount_rmb)} RMB est annulé. ${formatXaf(p.amount_xaf)} XAF sont revenus sur votre solde Bonzini. Ref: ${ref(p)}`,
    en: (p) => `${greetEn(p)}your payment of ${formatRmb(p.amount_rmb)} RMB is cancelled. ${formatXaf(p.amount_xaf)} XAF are back on your Bonzini balance. Ref: ${ref(p)}`,
  },

  // ── Palier 2 : sécurité du compte ────────────────────────────────────────
  //
  // Le code d'abord, sans salutation : c'est ce que le client cherche des
  // yeux, et c'est ce que le remplissage automatique du téléphone attrape.
  phone_verification: {
    fr: (p) => `${code(p)} est votre code Bonzini. Il expire dans 10 minutes. Ne le communiquez à personne.`,
    en: (p) => `${code(p)} is your Bonzini code. It expires in 10 minutes. Never share it with anyone.`,
  },
  password_changed: {
    fr: (p) => `${greetFr(p)}le mot de passe de votre compte Bonzini a été modifié le ${when(p)}. Si ce n'est pas vous, appelez-nous vite.`,
    en: (p) => `${greetEn(p)}the password of your Bonzini account was changed on ${when(p)}. If this was not you, call us now.`,
  },
  new_device_login: {
    fr: (p) => `${greetFr(p)}une nouvelle connexion a eu lieu sur votre compte Bonzini le ${when(p)}. Si ce n'est pas vous, appelez-nous.`,
    en: (p) => `${greetEn(p)}a new sign-in happened on your Bonzini account on ${when(p)}. If this was not you, call us.`,
  },
  kyc_required: {
    fr: (p) => `${greetFr(p)}votre compte Bonzini demande une pièce d'identité pour rester actif. Ajoutez-la dans l'app.`,
    en: (p) => `${greetEn(p)}your Bonzini account needs an ID document to stay active. Please upload it in the app.`,
  },
  kyc_approved: {
    fr: (p) => `${greetFr(p)}votre identité est vérifiée. Votre compte Bonzini est actif, vous pouvez payer vos fournisseurs.`,
    en: (p) => `${greetEn(p)}your identity is verified. Your Bonzini account is active and you can pay your suppliers.`,
  },

  // ── Palier 3 : relance et engagement ─────────────────────────────────────
  deposit_awaiting_proof: {
    fr: (p) => `${greetFr(p)}votre versement de ${formatXaf(p.amount_xaf)} XAF attend sa preuve. Ajoutez-la dans l'app Bonzini. Ref: ${ref(p)}`,
    en: (p) => `${greetEn(p)}your transfer of ${formatXaf(p.amount_xaf)} XAF is missing its proof. Add it in the Bonzini app. Ref: ${ref(p)}`,
  },
  payment_awaiting_beneficiary: {
    fr: (p) => `${greetFr(p)}votre paiement de ${formatRmb(p.amount_rmb)} RMB attend les infos de votre fournisseur. Completez dans l'app Bonzini. Ref: ${ref(p)}`,
    en: (p) => `${greetEn(p)}your payment of ${formatRmb(p.amount_rmb)} RMB is waiting for your supplier details. Complete it in the Bonzini app. Ref: ${ref(p)}`,
  },
  cash_payment_ready: {
    fr: (p) => `${greetFr(p)}votre retrait Bonzini en espèces est disponible en agence. Présentez la référence: ${ref(p)}`,
    en: (p) => `${greetEn(p)}your Bonzini cash withdrawal is ready at the branch. Show this reference: ${ref(p)}`,
  },
  // ⚠️ NE PAS écrire « Répondez STOP » : l'expéditeur alphanumérique est à
  // sens unique, le client ne peut pas répondre. Le retrait passe par l'app.
  daily_rate_alert: {
    fr: (p) => `Taux Bonzini du jour: 1 RMB = ${formatRate(p.rate)} XAF. Pour ne plus recevoir ces alertes, désactivez-les dans l'app.`,
    en: (p) => `Bonzini rate today: 1 RMB = ${formatRate(p.rate)} XAF. To stop these alerts, turn them off in the app.`,
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
