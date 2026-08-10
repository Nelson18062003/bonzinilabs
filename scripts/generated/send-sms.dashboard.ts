// ============================================================
// FICHIER GÉNÉRÉ — NE PAS MODIFIER À LA MAIN.
//
// Produit par `npm run bundle:send-sms` à partir de :
//   · supabase/functions/_shared/gsm7.ts
//   · supabase/functions/_shared/sms-templates.ts
//   · supabase/functions/send-sms/index.ts
//
// Destiné à l'éditeur de fonctions du dashboard Supabase, qui ne gère
// qu'un seul fichier. Toute correction se fait dans les sources ci-dessus,
// puis on régénère : sinon les deux versions divergent en silence.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ════════════════════════════════════════════════════════════════════════
// gsm7.ts — encodage GSM 03.38
// ════════════════════════════════════════════════════════════════════════
// ============================================================
// GSM 03.38 — encodage et découpage en segments SMS.
//
// POURQUOI CE FICHIER EXISTE : un SMS s'encode en GSM-7 (160 caractères
// par segment). UN SEUL caractère hors de cet alphabet bascule TOUT le
// message en UCS-2, qui ne tient plus que 70 caractères par segment.
// Un message de 95 caractères cesse alors d'être un message et en devient
// deux — à chaque envoi, pour toujours. Le coût double en silence.
//
// PIÈGE FRANÇAIS (vérifié contre la table réelle) : é è à ù ì ò ä ö ñ ü
// passent tous en GSM-7. Ce sont les accents circonflexes (ô ê î û â) et
// la cédille MINUSCULE (ç) qui cassent — noter que Ç majuscule EST dans la
// table alors que ç minuscule n'y est pas. Conséquence directe : « dépôt »
// et « reçu », nos deux mots les plus fréquents, font doubler le coût.
// On écrit donc « versement » et « preuve ».
//
// Aucun import : ce module doit tourner à la fois sous Deno (edge function
// send-sms) et sous vitest (test de non-régression des gabarits).
// ============================================================

/** Table de base GSM 03.38 — 1 septet par caractère. */
const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";

/** Table d'extension — 2 septets par caractère (préfixe ESC). */
const GSM7_EXTENDED = "^{}\\[~]|€";

const BASIC = new Set(Array.from(GSM7_BASIC));
const EXTENDED = new Set(Array.from(GSM7_EXTENDED));

export const GSM7_SINGLE = 160;
export const GSM7_MULTI = 153; // 7 septets consommés par l'en-tête de concaténation
export const UCS2_SINGLE = 70;
export const UCS2_MULTI = 67;

export type SmsEncoding = "GSM-7" | "UCS-2";

export interface SmsMeasure {
  encoding: SmsEncoding;
  /** Septets (GSM-7) ou unités de code UTF-16 (UCS-2). */
  length: number;
  segments: number;
  /** Caractères ayant forcé le passage en UCS-2 — vide si GSM-7. */
  offending: string[];
}

/** true si le caractère appartient à l'alphabet GSM-7 (base ou extension). */
export function isGsm7Char(ch: string): boolean {
  return BASIC.has(ch) || EXTENDED.has(ch);
}

/**
 * Mesure un message : encodage retenu, longueur et nombre de segments.
 * C'est la fonction que le test de non-régression interroge pour garantir
 * qu'aucun gabarit ne dépasse un segment.
 */
export function measureSms(text: string): SmsMeasure {
  const chars = Array.from(text);
  const offending: string[] = [];
  let septets = 0;

  for (const ch of chars) {
    if (BASIC.has(ch)) {
      septets += 1;
    } else if (EXTENDED.has(ch)) {
      septets += 2;
    } else {
      septets += 1;
      if (!offending.includes(ch)) offending.push(ch);
    }
  }

  if (offending.length > 0) {
    // Un seul caractère hors table suffit à basculer tout le message.
    const length = chars.length;
    return {
      encoding: "UCS-2",
      length,
      segments: length <= UCS2_SINGLE ? 1 : Math.ceil(length / UCS2_MULTI),
      offending,
    };
  }

  return {
    encoding: "GSM-7",
    length: septets,
    segments: septets <= GSM7_SINGLE ? 1 : Math.ceil(septets / GSM7_MULTI),
    offending: [],
  };
}

/**
 * Tronque un texte libre (motif de refus, nom de bénéficiaire…) pour qu'il
 * tienne dans le budget restant du gabarit.
 *
 * Indispensable : un motif de refus saisi par un admin est du texte libre,
 * et rien n'empêche qu'il fasse 300 caractères. Sans cette troncature, le
 * message se scinderait silencieusement en deux — le coût double sans que
 * personne ne le voie passer.
 */
export function truncateForSms(value: string, maxLength: number): string {
  const chars = Array.from(value.trim());
  if (chars.length <= maxLength) return chars.join("");
  if (maxLength <= 1) return chars.slice(0, Math.max(0, maxLength)).join("");
  // '...' plutôt que '…' : le caractère ellipse n'est pas dans la table GSM-7.
  return chars.slice(0, maxLength - 3).join("").trimEnd() + "...";
}

// N'y figurent QUE des caracteres reellement absents de la table GSM-7.
// Les accents deja couverts (e-aigu, e-grave, a-grave, u-grave, i-grave,
// o-grave, a-trema, o-trema, n-tilde, u-trema, C-cedille, E-aigu, ae) n'ont
// rien a faire ici : isGsm7Char les laisse passer avant meme de consulter
// cette table.
const FOLD_MAP: Record<string, string> = {
  // Circonflexes — aucun n'est dans la table GSM-7.
  "â": "a", "ê": "e", "î": "i", "ô": "o", "û": "u",
  "Â": "A", "Ê": "E", "Î": "I", "Ô": "O", "Û": "U",
  // Cedille minuscule (la majuscule, elle, est dans la table).
  "ç": "c",
  // Tremas absents de la table.
  "ë": "e", "ï": "i", "ÿ": "y",
  // Majuscules accentuees absentes (leurs minuscules sont dans la table).
  "À": "A", "È": "E", "Ù": "U", "Ì": "I", "Ò": "O",
  // Ligatures.
  "œ": "oe", "Œ": "OE",
  // Ponctuation typographique — substituee en silence par les editeurs.
  "‘": "'", "’": "'", "“": '"', "”": '"',
  "–": "-", "—": "-", "…": "...",
  // Espaces non-ASCII : insecable et fine insecable (frequentes dans les
  // montants formates en francais, et absentes de la table GSM-7).
  " ": " ", " ": " ",
};

/**
 * Remplace les caractères hors GSM-7 par leur équivalent le plus proche.
 * Filet de sécurité de dernier recours appliqué juste avant l'envoi : si une
 * valeur dynamique (nom de bénéficiaire translittéré, motif saisi à la main)
 * contient un « ô » ou un « ç », on préfère un message légèrement dégradé à
 * un message facturé double.
 *
 * N'est PAS appliqué aux caractères non latins (chinois, arabe) : là, l'UCS-2
 * est légitime et la dégradation détruirait le sens.
 */
export function foldToGsm7(text: string): string {
  let out = "";
  for (const ch of Array.from(text)) {
    if (isGsm7Char(ch)) {
      out += ch;
      continue;
    }
    const folded = FOLD_MAP[ch];
    // Pas de correspondance connue (idéogramme, cyrillique…) : on conserve
    // le caractère tel quel et on assume l'UCS-2.
    out += folded !== undefined ? folded : ch;
  }
  return out;
}


// ════════════════════════════════════════════════════════════════════════
// sms-templates.ts — les 17 gabarits × FR/EN
// ════════════════════════════════════════════════════════════════════════
// ============================================================
// Gabarits SMS — 16 événements × 2 langues (FR / EN).
//
// CONTRAT : tout gabarit rendu avec des valeurs réalistes DOIT tenir en
// UN SEUL segment GSM-7 (≤ 160 caractères). Le test
// src/tests/lib/smsTemplates.test.ts le vérifie pour les 32 combinaisons,
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
// VOCABULAIRE DE MARQUE (.claude/rules/frontend.md) : notre activité est le
// RÈGLEMENT DE FOURNISSEURS, pas l'envoi d'argent. « envoyer », « transfert »
// et « virement » sont proscrits ; on écrit « payer », « régler »,
// « versement ». Côté anglais, « deposit » et non « transfer ».
//
// ORDRE DES INFORMATIONS : ce que le client veut savoir en premier, c'est
// combien et où en est son argent — pas un identifiant qu'il ne connaît pas.
// La référence sert au support ; elle passe donc en dernier.

export type SmsTemplateFn = (payload: SmsPayload) => string;

export const SMS_TEMPLATES: Record<string, Record<SmsLocale, SmsTemplateFn>> = {
  // ── Palier 1 : mouvements d'argent ───────────────────────────────────────
  deposit_created: {
    fr: (p) => `${greetFr(p)}Bonzini a bien enregistré votre versement de ${formatXaf(p.amount_xaf)} XAF. Nous le vérifions rapidement. Ref: ${ref(p)}`,
    en: (p) => `${greetEn(p)}Bonzini has received your deposit of ${formatXaf(p.amount_xaf)} XAF. We will check it shortly. Ref: ${ref(p)}`,
  },
  deposit_validated: {
    fr: (p) => `${greetFr(p)}votre versement de ${formatXaf(p.amount_xaf)} XAF est validé. Nouveau solde Bonzini: ${formatXaf(p.new_balance)} XAF. Ref: ${ref(p)}`,
    en: (p) => `${greetEn(p)}your deposit of ${formatXaf(p.amount_xaf)} XAF is approved. New Bonzini balance: ${formatXaf(p.new_balance)} XAF. Ref: ${ref(p)}`,
  },
  deposit_rejected: {
    fr: (p) => `${greetFr(p)}votre versement de ${formatXaf(p.amount_xaf)} XAF est refusé. Motif: ${reason(p)}. Renvoyez la preuve dans l'app Bonzini. Ref: ${ref(p)}`,
    en: (p) => `${greetEn(p)}your deposit of ${formatXaf(p.amount_xaf)} XAF was declined. Reason: ${reason(p)}. Send it again in the Bonzini app. Ref: ${ref(p)}`,
  },
  deposit_correction_needed: {
    fr: (p) => `${greetFr(p)}votre versement de ${formatXaf(p.amount_xaf)} XAF demande une correction. Ouvrez l'app Bonzini pour la faire. Ref: ${ref(p)}`,
    en: (p) => `${greetEn(p)}your deposit of ${formatXaf(p.amount_xaf)} XAF needs a correction. Open the Bonzini app to fix it. Ref: ${ref(p)}`,
  },
  payment_created: {
    fr: (p) => `${greetFr(p)}votre paiement de ${formatRmb(p.amount_rmb)} RMB est enregistré. Nouveau solde Bonzini: ${formatXaf(p.new_balance)} XAF. Ref: ${ref(p)}`,
    en: (p) => `${greetEn(p)}your payment of ${formatRmb(p.amount_rmb)} RMB is registered. New Bonzini balance: ${formatXaf(p.new_balance)} XAF. Ref: ${ref(p)}`,
  },
  payment_processing: {
    fr: (p) => `${greetFr(p)}Bonzini exécute votre paiement de ${formatRmb(p.amount_rmb)} RMB vers votre fournisseur. Ref: ${ref(p)}`,
    en: (p) => `${greetEn(p)}Bonzini is settling your payment of ${formatRmb(p.amount_rmb)} RMB to your supplier. Ref: ${ref(p)}`,
  },
  payment_completed: {
    fr: (p) => `${greetFr(p)}votre fournisseur a bien été payé: ${formatRmb(p.amount_rmb)} RMB réglés. Preuve dans l'app Bonzini. Ref: ${ref(p)}`,
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
    en: (p) => `${greetEn(p)}your deposit of ${formatXaf(p.amount_xaf)} XAF is missing its proof. Add it in the Bonzini app. Ref: ${ref(p)}`,
  },
  payment_awaiting_beneficiary: {
    fr: (p) => `${greetFr(p)}votre paiement de ${formatRmb(p.amount_rmb)} RMB attend les infos de votre fournisseur. Complétez dans l'app Bonzini. Ref: ${ref(p)}`,
    en: (p) => `${greetEn(p)}your payment of ${formatRmb(p.amount_rmb)} RMB is waiting for your supplier details. Complete it in the Bonzini app. Ref: ${ref(p)}`,
  },
  cash_payment_ready: {
    fr: (p) => `${greetFr(p)}votre retrait Bonzini en espèces est disponible en agence. Présentez la référence: ${ref(p)}`,
    en: (p) => `${greetEn(p)}your Bonzini cash withdrawal is ready at the branch. Show this reference: ${ref(p)}`,
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


// ════════════════════════════════════════════════════════════════════════
// send-sms/index.ts — le drainer
// ════════════════════════════════════════════════════════════════════════
// ============================================================
// Drainer SMS — Edge Function, déclenchée par pg_cron toutes les minutes.
//
// Réserve un lot via claim_sms_batch(), résout l'expéditeur selon le pays de
// destination, rend le gabarit dans la langue du client, puis envoie via
// l'API Telnyx v2. Jumeau exact de send-email : mêmes garanties.
//
// GARANTIES :
//  - Découplage : hors de la transaction métier. Telnyx en panne ⇒ lignes
//    'failed' retentées ; aucun paiement ni dépôt impacté.
//  - Idempotence : contrainte UNIQUE sur sms_outbox.idempotency_key + bail
//    de 2 min posé par claim_sms_batch (aucun run concurrent ne double).
//  - Suppression : jamais d'envoi vers un numéro ayant répondu STOP. La
//    vérification a lieu AVANT l'envoi, pas après.
//  - Backoff : next_attempt_at = now() + 2^attempts minutes, plafonné.
//  - Erreurs 4xx définitives : on cesse de retenter (attempts = max) plutôt
//    que de brûler cinq tentatives sur un numéro structurellement invalide.
//
// EXPÉDITEUR : resolve_sms_sender() renvoie 'long_code' tant que l'ID
// alphanumérique n'est pas enregistré chez l'opérateur — un « Bonzini » non
// enregistré serait réécrit ou jeté (MTN Cameroun notamment). Le message
// part donc du numéro acheté et ARRIVE, ce qui est toujours préférable.
// ============================================================




const TELNYX_API = "https://api.telnyx.com/v2/messages";
const BATCH = Number(Deno.env.get("SMS_BATCH_SIZE") ?? "20");

/** Numéro Telnyx acheté — expéditeur de repli, et seul choix aux US/Canada. */
const LONG_CODE = Deno.env.get("TELNYX_PHONE_NUMBER") ?? "";
/** Obligatoire dès qu'on envoie depuis un ID alphanumérique. */
const PROFILE_ID = Deno.env.get("TELNYX_MESSAGING_PROFILE_ID") ?? "";

interface SendResult {
  ok: boolean;
  id?: string;
  parts?: number;
  error?: string;
  /** true ⇒ erreur définitive : inutile de retenter. */
  permanent?: boolean;
}

async function sendViaTelnyx(
  apiKey: string,
  from: string,
  to: string,
  text: string,
): Promise<SendResult> {
  const body: Record<string, unknown> = { to, text, type: "SMS" };

  if (from) body.from = from;
  // messaging_profile_id est requis pour un expéditeur alphanumérique ; le
  // fournir systématiquement quand il est configuré ne coûte rien.
  if (PROFILE_ID) body.messaging_profile_id = PROFILE_ID;

  let resp: Response;
  try {
    resp = await fetch(TELNYX_API, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    // Panne réseau : toujours retentable.
    return { ok: false, error: `network: ${String(e).slice(0, 200)}` };
  }

  if (resp.ok) {
    const data = await resp.json().catch(() => ({}));
    const payload = data?.data ?? {};
    return {
      ok: true,
      id: payload?.id,
      parts: typeof payload?.parts === "number" ? payload.parts : undefined,
    };
  }

  const detail = await resp.text().catch(() => "");
  // 429 et 5xx : transitoires. Les autres 4xx (numéro invalide, profil mal
  // configuré, ID d'expéditeur refusé) ne s'arrangeront pas tout seuls.
  const permanent = resp.status >= 400 && resp.status < 500 && resp.status !== 429;
  return {
    ok: false,
    permanent,
    error: `${resp.status} ${detail}`.slice(0, 500),
  };
}

/** Comparaison à temps constant — évite un canal temporel sur le secret. */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

serve(async (req) => {
  // POST uniquement : un GET ne doit jamais déclencher un run d'envoi.
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  // Auth interne obligatoire, fail-closed : sans secret configuré, on refuse.
  const secret = Deno.env.get("SMS_DRAINER_SECRET");
  if (!secret) return new Response("Missing SMS_DRAINER_SECRET", { status: 500 });
  const incoming = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!timingSafeEqual(incoming, secret)) return new Response("Unauthorized", { status: 401 });

  const apiKey = Deno.env.get("TELNYX_API_KEY");
  if (!apiKey) return new Response("Missing TELNYX_API_KEY", { status: 500 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: batch, error: claimErr } = await supabase.rpc("claim_sms_batch", { p_limit: BATCH });
  if (claimErr) {
    console.error("claim_sms_batch error:", claimErr.message);
    return new Response("claim error", { status: 500 });
  }

  const rows = (batch ?? []) as Array<Record<string, unknown>>;
  let sent = 0, failed = 0, skipped = 0;

  for (const row of rows) {
    const id = row.id as string;
    const to = ((row.recipient_phone as string) ?? "").trim();
    const country = (row.recipient_country as string) ?? "";
    const template = row.template as string;
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const attempts = Number(row.attempts ?? 0);
    const locale = resolveLocale(row.locale);

    // a. Pas de numéro exploitable.
    if (!to) {
      await supabase.from("sms_outbox")
        .update({ status: "skipped", last_error: "no phone" }).eq("id", id);
      skipped++; continue;
    }

    // b. Numéro supprimé (STOP, invalide, injoignable) → jamais d'envoi.
    const { data: supp } = await supabase
      .from("sms_suppressions").select("phone_e164").eq("phone_e164", to).maybeSingle();
    if (supp) {
      await supabase.from("sms_outbox")
        .update({ status: "skipped", last_error: "suppressed" }).eq("id", id);
      skipped++; continue;
    }

    // c. Rendu. Gabarit inconnu ⇒ on saute cette ligne sans faire tomber le lot.
    const rendered = renderSms(template, locale, payload);
    if (!rendered) {
      await supabase.from("sms_outbox")
        .update({ status: "skipped", last_error: `unknown template: ${template}` }).eq("id", id);
      skipped++; continue;
    }

    // d. Expéditeur selon le pays de destination.
    const { data: senderRows } = await supabase.rpc("resolve_sms_sender", { p_country: country });
    const sender = Array.isArray(senderRows) ? senderRows[0] : senderRows;
    const useAlpha = sender?.sender_type === "alphanumeric" && !!sender?.sender_id;
    const from = useAlpha ? String(sender.sender_id) : LONG_CODE;

    if (!from) {
      // Ni ID alphanumérique utilisable, ni numéro long configuré : rien à
      // présenter à Telnyx. Erreur de configuration, pas de donnée.
      await supabase.from("sms_outbox").update({
        status: "failed",
        attempts: Number(row.max_attempts ?? 5),
        last_error: "no sender configured (TELNYX_PHONE_NUMBER manquant)",
      }).eq("id", id);
      failed++; continue;
    }

    const result = await sendViaTelnyx(apiKey, from, to, rendered.text);

    if (result.ok) {
      const update: Record<string, unknown> = {
        status: "sent",
        sent_at: new Date().toISOString(),
        telnyx_message_id: result.id ?? null,
        sender_used: from,
        segments: result.parts ?? rendered.measure.segments,
        attempts: attempts + 1,
        last_error: null,
      };

      // Les messages de sécurité transportent un code à usage unique dans
      // leur payload. Une fois parti, ce code n'a plus aucune raison de
      // rester au repos dans une table que les admins peuvent lire : on le
      // purge, en gardant la ligne pour la traçabilité.
      if (row.category === "security") update.payload = {};

      await supabase.from("sms_outbox").update(update).eq("id", id);
      sent++;

      // Un segment > 1 signifie qu'un gabarit a basculé en UCS-2 : le coût a
      // doublé sans que personne ne l'ait décidé. On le journalise fort.
      const parts = result.parts ?? rendered.measure.segments;
      if (parts > 1) {
        console.warn(
          `send-sms ${id}: ${parts} segments (${rendered.measure.encoding}) — gabarit ${template}/${locale} à corriger`,
        );
      }
    } else {
      const nextAttempts = attempts + 1;
      const backoffMin = Math.min(2 ** nextAttempts, 120); // 2,4,8… plafonné à 2 h
      await supabase.from("sms_outbox").update({
        status: "failed",
        // Erreur définitive : on épuise le compteur pour ne plus retenter.
        attempts: result.permanent ? Number(row.max_attempts ?? 5) : nextAttempts,
        sender_used: from,
        last_error: result.error ?? "unknown",
        next_attempt_at: new Date(Date.now() + backoffMin * 60_000).toISOString(),
      }).eq("id", id);
      failed++;
      console.error(
        `send-sms ${id}: ${(result.error ?? "").replace(/[\r\n\t]/g, " ").slice(0, 200)}`,
      );
    }
  }

  const summary = { claimed: rows.length, sent, failed, skipped };
  console.log("send-sms run:", JSON.stringify(summary));
  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

