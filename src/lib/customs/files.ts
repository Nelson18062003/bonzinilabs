/**
 * Les dossiers douane d'un client : les fiches de classement (l'IA propose, le
 * commissionnaire agréé signe) et leurs pièces écrites — dont la demande de
 * décision anticipée (code des douanes CEMAC, art. 75).
 *
 * Pur : types, statuts, et génération de texte. Les données viennent des RPC
 * de la migration 20260929120000_customs_foundation.sql.
 */
import type { Tone } from '@/mobile/designKit';
import { formatHs } from './hsCode';
import { matchTerms } from './nomenclature';

export type ClassificationStatus = 'draft' | 'submitted' | 'in_review' | 'needs_info' | 'approved' | 'changed' | 'cancelled';

export interface Candidate {
  code: string;
  title: string;
  heading: string | null;
  rate_min: number | null;
  rate_max: number | null;
  confidence: number;
  reasoning: string;
  rules: string[];
}

export interface MessagePayload {
  type?: 'question' | 'proposal';
  options?: string[];
  why?: string;
  candidates?: Candidate[];
  missing_facts?: string[];
  decision?: 'approved' | 'changed' | 'needs_info';
  final_code?: string | null;
  broker_company?: string;
  broker_license_no?: string;
  model?: string;
}

export interface ClassificationMessage {
  id: string;
  author: 'client' | 'assistant' | 'broker' | 'system';
  body: string;
  payload: MessagePayload | null;
  created_at: string;
}

export interface ClientCard {
  user_id?: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  customer_code: string | null;
}

export interface Classification {
  id: string;
  ref: string;
  client_user_id: string;
  product_name: string;
  description: string | null;
  facts: Record<string, unknown>;
  photo_paths: string[];
  candidates: Candidate[];
  proposed_code: string | null;
  status: ClassificationStatus;
  submitted_at: string | null;
  final_code: string | null;
  broker_note: string | null;
  claimed_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  broker_company: string | null;
  broker_license_no: string | null;
  created_at: string;
  updated_at: string;
  client?: ClientCard | null;
  messages: ClassificationMessage[];
}

export interface ClassificationSummary {
  id: string;
  ref: string;
  product_name: string;
  status: ClassificationStatus;
  proposed_code: string | null;
  final_code: string | null;
  broker_company: string | null;
  created_at: string;
  updated_at: string;
}

export const CLASSIFICATION_STATUS: Record<ClassificationStatus, { fr: string; tone: Tone }> = {
  draft: { fr: 'En cours avec l’assistant', tone: 'neutral' },
  submitted: { fr: 'Chez le commissionnaire', tone: 'pending' },
  in_review: { fr: 'En relecture', tone: 'pending' },
  needs_info: { fr: 'Une précision est demandée', tone: 'danger' },
  approved: { fr: 'Code signé', tone: 'success' },
  changed: { fr: 'Code signé (modifié)', tone: 'success' },
  cancelled: { fr: 'Abandonnée', tone: 'neutral' },
};

/** Le client peut encore écrire, et l'IA répondre. */
export const isEditable = (s: ClassificationStatus) => s === 'draft' || s === 'needs_info';
/** Un commissionnaire a signé : c'est la référence. */
export const isSigned = (s: ClassificationStatus) => s === 'approved' || s === 'changed';

/** La dernière proposition de l'assistant dans la conversation. */
export function latestProposal(messages: ClassificationMessage[]): { message: ClassificationMessage; candidates: Candidate[] } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.author === 'assistant' && m.payload?.type === 'proposal' && m.payload.candidates?.length) {
      return { message: m, candidates: m.payload.candidates };
    }
  }
  return null;
}

/** La question de l'assistant qui attend encore une réponse (rien du client après elle). */
export function pendingQuestion(messages: ClassificationMessage[]): ClassificationMessage | null {
  const last = messages[messages.length - 1];
  return last && last.author === 'assistant' && last.payload?.type === 'question' ? last : null;
}

/** « 10 % » ou « 5–20 % » (comme le simulateur). */
export function candidateRate(c: Pick<Candidate, 'rate_min' | 'rate_max'>): string {
  if (c.rate_max == null) return '—';
  return c.rate_min != null && c.rate_min !== c.rate_max ? `${c.rate_min}–${c.rate_max} %` : `${c.rate_max} %`;
}

/**
 * Les pistes du vocabulaire du marché pour l'assistant : « régulateur » →
 * 85.04, « okada » → 87.11… Le libellé officiel ne connaît pas ces mots ; on
 * les envoie avec la demande, et l'assistant les vérifie dans le tarif.
 */
export function marketHints(text: string, max = 8): { code: string; tip?: string }[] {
  const out = new Map<string, { code: string; tip?: string }>();
  for (const term of matchTerms(text)) {
    for (const code of term.codes) {
      if (!out.has(code)) out.set(code, { code, ...(term.tip ? { tip: term.tip } : {}) });
    }
  }
  return [...out.values()].slice(0, max);
}

const dateFr = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '……';

/**
 * La demande de décision anticipée (art. 75), rédigée à partir d'une fiche
 * signée. Les champs que la plateforme ne connaît pas (NIU, RCCM, adresse)
 * restent en pointillés : on ne les invente pas.
 */
export function advanceRulingLetter(c: Classification, today = new Date()): string {
  const code = c.final_code ?? c.proposed_code ?? '';
  const chosen = c.candidates.find((x) => x.code === code.slice(0, 6)) ?? c.candidates[0] ?? null;
  const others = c.candidates.filter((x) => x.code !== chosen?.code);
  const client = c.client;
  const who = client?.company_name || [client?.first_name, client?.last_name].filter(Boolean).join(' ') || '……………………';
  const facts = Object.entries(c.facts ?? {}).map(([k, v]) => `- ${k} : ${typeof v === 'string' ? v : JSON.stringify(v)}`);
  const signed = isSigned(c.status) && c.broker_company;

  return [
    `**${who}**`,
    'NIU : ……………… · RCCM : ……………… · Adresse : ………………',
    '',
    `Le ${today.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    '',
    "**À l'attention de Monsieur le Directeur Général des Douanes**",
    'Direction Générale des Douanes — Ministère des Finances',
    '(sous couvert du service chargé de la tarification et de la législation)',
    '',
    `**Objet : demande de décision anticipée sur le classement tarifaire — ${c.product_name} — article 75 du Code des douanes CEMAC**`,
    '',
    'Monsieur le Directeur Général,',
    '',
    "En application de l'article 75 du Code des douanes CEMAC, qui dispose que les autorités douanières rendent, sur demande écrite, des décisions anticipées portant notamment sur le classement tarifaire d'une marchandise, j'ai l'honneur de solliciter une décision anticipée relative à la marchandise décrite ci-après, avant son importation.",
    '',
    '## 1. La marchandise',
    `- Désignation : ${c.product_name}`,
    c.description ? `- Description : ${c.description}` : null,
    ...facts,
    `- Photographies : ${c.photo_paths.length ? `${c.photo_paths.length} jointe(s)` : 'à joindre'}`,
    '',
    '## 2. Le classement que nous proposons',
    chosen
      ? `**${formatHs(code || chosen.code)}** — ${chosen.title}${chosen.heading ? ` (position ${formatHs(chosen.code.slice(0, 4))} : ${chosen.heading})` : ''}.`
      : `**${formatHs(code)}**.`,
    chosen?.reasoning ? `Motifs : ${chosen.reasoning}` : null,
    chosen?.rules.length ? `Règles appliquées : ${chosen.rules.join(', ')}.` : null,
    signed
      ? `Ce classement a été examiné et validé le ${dateFr(c.reviewed_at)} par ${c.broker_company}, commissionnaire agréé en douane (agrément ${c.broker_license_no}).${c.broker_note ? ` Observations : ${c.broker_note}` : ''}`
      : null,
    others.length ? '' : null,
    others.length ? '## 3. Les autres classements envisagés, exposés loyalement' : null,
    ...others.map((o) => `- ${formatHs(o.code)} — ${o.title}. ${o.reasoning}`),
    '',
    `## ${others.length ? '4' : '3'}. Pièces jointes`,
    '- fiche technique du fabricant ;',
    '- photographies de la marchandise et de sa plaque signalétique ;',
    '- facture proforma du fournisseur.',
    '',
    "Nous restons à la disposition de vos services pour tout complément d'information et vous prions d'agréer, Monsieur le Directeur Général, l'expression de notre haute considération.",
    '',
    `Référence Bonzini : ${c.ref}`,
  ].filter((l) => l !== null).join('\n');
}
