/**
 * Dossier conteneur — la navigation du dossier, en un seul endroit.
 *
 * Même règle que la Trésorerie (docs/admin-redesign) : **l'URL est l'état**.
 * Un onglet = une route `/m/cargo/:id/:tab`, donc le bouton Retour, le
 * rafraîchissement et un lien envoyé par message tombent tous au bon endroit.
 */
export type DossierTab = 'apercu' | 'suivi' | 'chargement' | 'documents' | 'douane' | 'couts' | 'client' | 'intervenants' | 'notes';

export interface DossierTabDef {
  key: DossierTab;
  label: string;
  /** Phrase courte : ce que l'onglet sert à faire. */
  purpose: string;
}

export const DOSSIER_TABS: readonly DossierTabDef[] = [
  { key: 'apercu', label: "Aperçu", purpose: 'Où il est, quand il arrive, ce qu’il reste à faire' },
  { key: 'suivi', label: 'Suivi', purpose: 'Les escales du voyage, les jalons de l’armateur et les arrivées confrontées' },
  { key: 'chargement', label: 'Chargement', purpose: 'Ce qu’il y a dans la boîte, et la place qu’il reste' },
  { key: 'documents', label: 'Documents', purpose: 'Le classeur : les pièces du dossier et leurs fichiers' },
  { key: 'douane', label: 'Douane & arrivée', purpose: 'Les étapes camerounaises et la franchise' },
  { key: 'couts', label: 'Coûts', purpose: 'Le prix de revient réel du conteneur' },
  { key: 'client', label: 'Client', purpose: 'Le client Bonzini et ses autres conteneurs' },
  { key: 'intervenants', label: 'Intervenants', purpose: 'Les parties prenantes externes : transitaire, chargeur, déclarant, armateur…' },
  { key: 'notes', label: 'Notes', purpose: 'Ce que l’équipe doit savoir' },
] as const;

export const DEFAULT_TAB: DossierTab = 'apercu';

export function isDossierTab(v: string | undefined): v is DossierTab {
  return !!v && DOSSIER_TABS.some((t) => t.key === v);
}

export function dossierPath(shipmentId: string, tab: DossierTab = DEFAULT_TAB): string {
  return tab === DEFAULT_TAB ? `/m/cargo/${shipmentId}` : `/m/cargo/${shipmentId}/${tab}`;
}
