/**
 * Dossier conteneur — la navigation du dossier, en un seul endroit.
 *
 * Même règle que la Trésorerie (docs/admin-redesign) : **l'URL est l'état**.
 * Un onglet = une route `/m/cargo/:id/:tab`, donc le bouton Retour, le
 * rafraîchissement et un lien envoyé par message tombent tous au bon endroit.
 */
export type DossierTab = 'apercu' | 'suivi' | 'documents' | 'douane' | 'couts' | 'client' | 'notes';

export interface DossierTabDef {
  key: DossierTab;
  label: string;
  /** Phrase courte : ce que l'onglet sert à faire. */
  purpose: string;
}

export const DOSSIER_TABS: readonly DossierTabDef[] = [
  { key: 'apercu', label: "Aperçu", purpose: 'Où il est, quand il arrive, ce qu’il reste à faire' },
  { key: 'suivi', label: 'Suivi', purpose: 'Les jalons de l’armateur, du booking à l’arrivée' },
  { key: 'documents', label: 'Documents', purpose: 'B/L, facture, packing list, télex, BESC, douane' },
  { key: 'douane', label: 'Douane & arrivée', purpose: 'Les étapes camerounaises et la franchise' },
  { key: 'couts', label: 'Coûts', purpose: 'Le prix de revient réel du conteneur' },
  { key: 'client', label: 'Client', purpose: 'Le client Bonzini et ses autres conteneurs' },
  { key: 'notes', label: 'Notes', purpose: 'Ce que l’équipe doit savoir' },
] as const;

export const DEFAULT_TAB: DossierTab = 'apercu';

export function isDossierTab(v: string | undefined): v is DossierTab {
  return !!v && DOSSIER_TABS.some((t) => t.key === v);
}

export function dossierPath(shipmentId: string, tab: DossierTab = DEFAULT_TAB): string {
  return tab === DEFAULT_TAB ? `/m/cargo/${shipmentId}` : `/m/cargo/${shipmentId}/${tab}`;
}
