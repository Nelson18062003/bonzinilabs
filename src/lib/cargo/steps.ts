/**
 * Les étapes camerounaises d'un conteneur, de l'avant-arrivée à la
 * restitution du vide — en mots simples.
 *
 * Une étape standard (clé BESC, CIVIC…) peut être reliée à une colonne du
 * dossier (besc_number, customs_cleared_at…) : cocher l'étape remplit la
 * colonne, pour que la liste « à faire », les alertes de la flotte et l'app
 * mobile voient la même chose.
 */
import type { CargoShipment } from '@/lib/cargo/model';
import type { DocCategory } from '@/lib/cargo/documents';
import type { Database } from '@/integrations/supabase/types';

export type CargoStep = Database['public']['Tables']['cargo_steps']['Row'];
export type StepPhase = 'before' | 'arrival' | 'clearance' | 'exit';
export type StepStatus = 'todo' | 'doing' | 'done' | 'skipped';

export const PHASES: { key: StepPhase; label: string; hint: string }[] = [
  { key: 'before', label: 'Avant l’arrivée', hint: 'ce qui doit être prêt quand le navire accoste' },
  { key: 'arrival', label: 'À l’arrivée', hint: 'le consignataire du navire et ses papiers' },
  { key: 'clearance', label: 'Dédouanement', hint: 'la déclaration, la visite, les droits' },
  { key: 'exit', label: 'Sortie', hint: 'du bon à enlever au retour du conteneur vide' },
];

/** Colonnes du dossier qu'une étape standard tient à jour. */
type DateColumn = 'arrival_notice_at' | 'customs_cleared_at' | 'delivery_order_at' | 'gate_out_at' | 'empty_returned_at';

export interface StepDef {
  key: string;
  title: string;
  phase: StepPhase;
  hint: string;
  /** Catégorie de la pièce du classeur qui porte ses fichiers. */
  docCategory?: DocCategory;
  /** Mot à chercher dans le titre d'une pièce existante pour la relier. */
  docMatch?: RegExp;
  dateColumn?: DateColumn;
  refColumn?: 'besc_number' | 'customs_declaration_ref';
  /** Étape tenue par un drapeau du dossier (télex reçu). */
  flagColumn?: 'telex_released';
  /** N'apparaît que si le conteneur transporte des véhicules. */
  vehiclesOnly?: boolean;
}

export const STANDARD_STEPS: StepDef[] = [
  {
    key: 'BESC', title: 'BESC', phase: 'before', docCategory: 'BESC', docMatch: /besc/i, refColumn: 'besc_number',
    hint: 'Bordereau électronique de suivi des cargaisons, délivré par un agent agréé du Conseil national des chargeurs. À faire avant l’arrivée : en retard, une pénalité s’ajoute.',
  },
  {
    key: 'CIVIC', title: 'CIVIC des véhicules (SGS)', phase: 'before', docCategory: 'CUSTOMS', docMatch: /civic/i, vehiclesOnly: true,
    hint: 'Inspection des véhicules d’occasion : SGS fixe la valeur en douane de chaque véhicule. Pièces : copie du B/L, carte contribuable, certificat d’identification.',
  },
  {
    key: 'TELEX', title: 'Télex release (ou B/L original endossé)', phase: 'before', docCategory: 'TELEX', docMatch: /t[ée]lex/i, flagColumn: 'telex_released',
    hint: 'L’armateur libère la marchandise. Sans lui, le consignataire ne remet pas le bon à délivrer et le conteneur reste au port.',
  },
  {
    key: 'ARRIVAL_NOTICE', title: 'Avis d’arrivée', phase: 'arrival', dateColumn: 'arrival_notice_at',
    hint: 'Le consignataire du navire annonce le déchargement et les frais locaux à payer.',
  },
  {
    key: 'CARRIER_RELEASE', title: 'Bon à délivrer du consignataire', phase: 'arrival',
    hint: 'Remis contre le B/L (ou le télex) et le paiement des frais locaux : manutention, documentation.',
  },
  {
    key: 'DECLARATION', title: 'Déclaration en douane', phase: 'clearance', docCategory: 'CUSTOMS', docMatch: /d[ée]claration/i, refColumn: 'customs_declaration_ref',
    hint: 'Déposée dans CAMCIS par la ou le déclarant : on note sa référence.',
  },
  {
    key: 'INSPECTION', title: 'Visite ou scanner', phase: 'clearance',
    hint: 'La douane contrôle la marchandise, à la main ou au scanner.',
  },
  {
    key: 'LIQUIDATION', title: 'Liquidation et paiement des droits', phase: 'clearance', dateColumn: 'customs_cleared_at',
    hint: 'Les droits et taxes sont calculés puis payés : on obtient la quittance.',
  },
  {
    key: 'BAE', title: 'Bon à enlever', phase: 'exit', dateColumn: 'delivery_order_at',
    hint: 'La douane autorise la sortie du conteneur.',
  },
  {
    key: 'GATE_OUT', title: 'Sortie du port', phase: 'exit', dateColumn: 'gate_out_at',
    hint: 'Le conteneur quitte le terminal sur camion.',
  },
  {
    key: 'EMPTY_RETURN', title: 'Restitution du vide', phase: 'exit', dateColumn: 'empty_returned_at',
    hint: 'Le conteneur vide est rendu à l’armateur : les frais de détention s’arrêtent.',
  },
];

export const STEP_DEF = Object.fromEntries(STANDARD_STEPS.map((d) => [d.key, d])) as Record<string, StepDef>;

export const STATUS_LABEL: Record<StepStatus, string> = { todo: 'à faire', doing: 'en cours', done: 'fait', skipped: 'ne s’applique pas' };

/** Ce que l'étape écrit dans le dossier quand on la coche (ou la décoche). */
export function shipmentPatchFor(def: StepDef | undefined, status: StepStatus, doneOn: string | null, reference: string | null): Partial<CargoShipment> {
  if (!def) return {};
  const patch: Partial<CargoShipment> = {};
  const done = status === 'done';
  if (def.dateColumn) (patch as Record<string, unknown>)[def.dateColumn] = done ? `${doneOn ?? new Date().toISOString().slice(0, 10)}T12:00:00Z` : null;
  if (def.flagColumn) patch[def.flagColumn] = done;
  if (def.refColumn && reference !== null) patch[def.refColumn] = reference || null;
  return patch;
}

/** Les étapes standard d'un conteneur, pré-remplies avec ce que le dossier sait déjà. */
export function seedSteps(s: CargoShipment, hasVehicles: boolean): { key: string; title: string; phase: StepPhase; status: StepStatus; done_on: string | null; reference: string | null; position: number }[] {
  return STANDARD_STEPS.filter((d) => !d.vehiclesOnly || hasVehicles).map((d, i) => {
    const date = d.dateColumn ? (s[d.dateColumn] as string | null) : null;
    const ref = d.refColumn ? (s[d.refColumn] as string | null) : null;
    const done = !!date || (d.flagColumn ? !!s[d.flagColumn] : false) || (d.key === 'BESC' && !!ref);
    return { key: d.key, title: d.title, phase: d.phase, status: done ? 'done' : 'todo', done_on: date ? date.slice(0, 10) : null, reference: ref, position: i + 1 };
  });
}
