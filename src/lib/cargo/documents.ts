/**
 * Le classeur d'un conteneur — vocabulaire partagé (écran, liste « à faire »).
 *
 * Une PIÈCE (cargo_doc_folders) est ce que l'équipe range : « B/L originaux »,
 * « Certificats CICQ », « Photos du chargement »… Son titre est libre ; sa
 * CATÉGORIE sert à la retrouver (icône, filtre) et à cocher la liste « à
 * faire » (un fichier dans une pièce BL = le B/L est classé).
 * Un FICHIER (cargo_documents) appartient à une pièce, ou à aucune (« non
 * classé ») ; il peut aussi justifier un coût (cost_id).
 */
import type { CargoDocument } from '@/lib/cargo/model';
import type { Database } from '@/integrations/supabase/types';

export type CargoDocFolder = Database['public']['Tables']['cargo_doc_folders']['Row'];

export const DOC_CATEGORIES = [
  'BL', 'TELEX', 'PACKING_LIST', 'INVOICE', 'FREIGHT', 'BESC', 'CERTIFICATE', 'VEHICLE',
  'CUSTOMS', 'TAX', 'PHOTO', 'CORRESPONDENCE', 'COST', 'OTHER',
] as const;
export type DocCategory = (typeof DOC_CATEGORIES)[number];

export const DOC_CATEGORY_META: Record<DocCategory, { label: string; hint: string }> = {
  BL: { label: 'Bill of lading', hint: "titre de la marchandise, émis par l'armateur" },
  TELEX: { label: 'Télex release', hint: "libération du B/L : sans lui, pas de sortie du port" },
  PACKING_LIST: { label: 'Packing list', hint: 'détail des colis, poids et volumes' },
  INVOICE: { label: 'Facture commerciale', hint: 'valeur des marchandises, demandée à nos clients' },
  FREIGHT: { label: 'Facture de fret', hint: 'le prix du transport, émise par le transitaire' },
  BESC: { label: 'BESC', hint: 'bordereau électronique de suivi des cargaisons (CNCC)' },
  CERTIFICATE: { label: 'Certificat', hint: "identification, origine, inspection…" },
  VEHICLE: { label: 'Véhicule', hint: 'carte grise, dossier export, photos du châssis' },
  CUSTOMS: { label: 'Douane', hint: 'déclaration, CIVIC, quittance, bon à enlever' },
  TAX: { label: 'Fiscal', hint: "NIU, attestation d'immatriculation, carte contribuable" },
  PHOTO: { label: 'Photos', hint: 'chargement, colis, état à l’arrivée' },
  CORRESPONDENCE: { label: 'Courrier', hint: 'mails, lettres, captures de messages' },
  COST: { label: 'Justificatif de coût', hint: 'reçu, facture payée' },
  OTHER: { label: 'Autre', hint: 'tout ce qui ne rentre pas ailleurs' },
};

export function isDocCategory(v: string | null | undefined): v is DocCategory {
  return !!v && (DOC_CATEGORIES as readonly string[]).includes(v);
}

export function categoryLabel(v: string | null | undefined): string {
  return isDocCategory(v) ? DOC_CATEGORY_META[v].label : 'Autre';
}

/** Les pièces qu'on crée d'un clic sur un dossier vide. Rien n'est obligatoire. */
export const STARTER_FOLDERS: { title: string; category: DocCategory; expected_count: number | null }[] = [
  { title: 'Bill of lading (originaux)', category: 'BL', expected_count: 3 },
  { title: 'Télex release', category: 'TELEX', expected_count: 1 },
  { title: 'Packing list', category: 'PACKING_LIST', expected_count: 1 },
  { title: 'Factures commerciales des clients', category: 'INVOICE', expected_count: null },
  { title: 'Facture de fret', category: 'FREIGHT', expected_count: 1 },
  { title: 'BESC', category: 'BESC', expected_count: 1 },
  { title: 'Déclaration et quittances de douane', category: 'CUSTOMS', expected_count: null },
  { title: 'Photos du chargement', category: 'PHOTO', expected_count: null },
];

export const isImage = (d: Pick<CargoDocument, 'mime_type'>) => (d.mime_type ?? '').startsWith('image/');
export const isPdf = (d: Pick<CargoDocument, 'mime_type'>) => d.mime_type === 'application/pdf';

/** Le nom affiché d'un fichier : son titre s'il en a un, sinon le nom d'origine. */
export const docTitle = (d: Pick<CargoDocument, 'title' | 'file_name'>) => d.title?.trim() || d.file_name;

export function fileSize(n: number | null | undefined): string {
  if (n == null) return '';
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(n / 1000))} Ko`;
}

/** « 2 / 3 » : où en est une pièce. `complete` quand l'attente est remplie (ou sans attente, dès un fichier). */
export function folderProgress(folder: Pick<CargoDocFolder, 'expected_count'>, count: number): { complete: boolean; label: string } {
  if (folder.expected_count) return { complete: count >= folder.expected_count, label: `${count} / ${folder.expected_count}` };
  return { complete: count > 0, label: count === 0 ? 'vide' : `${count} fichier${count > 1 ? 's' : ''}` };
}
