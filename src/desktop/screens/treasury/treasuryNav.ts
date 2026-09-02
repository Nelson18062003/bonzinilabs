/**
 * Trésorerie — la navigation du module, en un seul endroit.
 *
 * Règle unique : **l'URL est l'état**. Avant, le sélecteur de vue écrivait un
 * `useState` et onze routes différentes rendaient le même composant avec un
 * `initialView` différent. Conséquences vécues : le bouton Retour du
 * navigateur sortait du module au lieu de revenir à l'onglet précédent, un
 * rafraîchissement ramenait toujours sur Opérations, et `/purchases/:id`
 * affichait la liste en ignorant l'identifiant.
 *
 * Ici, une vue = une route. Le fil d'Ariane, les onglets et les liens entre
 * objets lisent tous cette même table, donc ils ne peuvent pas diverger.
 */

export const TREASURY_ROOT = '/m/more/treasury';

/** Les vues de premier niveau — celles qui portent un onglet. */
export type TreasuryView =
  | 'operations'
  | 'analysis'
  | 'accounts'
  | 'inventory'
  | 'counterparties'
  | 'ledger';

export interface TreasuryViewDef {
  key: TreasuryView;
  label: string;
  path: string;
  /** Phrase courte affichée sous le titre : ce que la vue sert à faire. */
  purpose: string;
  /** `true` = la vue écrit en base, donc réservée à `canManageTreasury`. */
  writes: boolean;
}

export const TREASURY_VIEWS: readonly TreasuryViewDef[] = [
  {
    key: 'operations',
    label: 'Opérations',
    path: `${TREASURY_ROOT}/operations`,
    purpose: 'Achats et ventes USDT, du plus récent au plus ancien',
    writes: false,
  },
  {
    key: 'analysis',
    label: 'Analyse',
    path: `${TREASURY_ROOT}/analysis`,
    purpose: 'Bénéfice, marge, taux de revient et taux client sur une période',
    writes: false,
  },
  {
    key: 'accounts',
    label: 'Comptes',
    path: `${TREASURY_ROOT}/accounts`,
    purpose: 'Soldes par devise et par compte',
    writes: false,
  },
  {
    key: 'inventory',
    label: 'Inventaires',
    path: `${TREASURY_ROOT}/inventory`,
    purpose: 'Comptages physiques et écarts constatés',
    writes: false,
  },
  {
    key: 'counterparties',
    label: 'Contreparties',
    path: `${TREASURY_ROOT}/counterparties`,
    purpose: 'Fournisseurs USDT et acheteurs CNY',
    writes: false,
  },
  {
    key: 'ledger',
    label: 'Grand livre',
    path: `${TREASURY_ROOT}/ledger`,
    purpose: 'Tous les mouvements, source de vérité des soldes',
    writes: false,
  },
] as const;

/* ── Liens vers un objet ──────────────────────────────────────────────
 *
 * Chaque référence affichée dans le module doit pouvoir devenir un lien.
 * C'est ce qui manquait le plus : on ne pouvait aller ni d'une opération à sa
 * contrepartie, ni d'une contrepartie à ses opérations. */

export type OperationKind = 'purchase' | 'sale';

export const treasuryPaths = {
  root: TREASURY_ROOT,
  overview: TREASURY_ROOT,
  operations: `${TREASURY_ROOT}/operations`,
  operation: (kind: OperationKind, id: string) => `${TREASURY_ROOT}/operations/${kind}/${id}`,
  accounts: `${TREASURY_ROOT}/accounts`,
  account: (id: string) => `${TREASURY_ROOT}/accounts/${id}`,
  inventory: `${TREASURY_ROOT}/inventory`,
  counterparties: `${TREASURY_ROOT}/counterparties`,
  counterparty: (id: string) => `${TREASURY_ROOT}/counterparties/${id}`,
  analysis: `${TREASURY_ROOT}/analysis`,
  ledger: `${TREASURY_ROOT}/ledger`,
  settle: `${TREASURY_ROOT}/settle`,
  newPurchase: `${TREASURY_ROOT}/purchase`,
  newSale: `${TREASURY_ROOT}/sale`,
} as const;

/**
 * Retrouve la vue de premier niveau d'une URL — y compris depuis une page de
 * détail, pour que l'onglet parent reste souligné quand on regarde une
 * opération ou une contrepartie.
 */
/**
 * Retrouve la vue de premier niveau d'une URL.
 *
 * Deux jeux d'URL coexistent volontairement. Le MOBILE a ses propres écrans
 * par route (`/purchases`, `/sales`, `/purchases/:id`…) et il est validé : on
 * n'y touche pas. Le DESKTOP, lui, rend un seul écran et déduit la vue de la
 * route — y compris depuis ces chemins mobiles, pour que le même lien mène au
 * bon endroit sur les deux surfaces.
 */
const PATH_TO_VIEW: Record<string, TreasuryView> = {
  operations: 'operations',
  // Le mobile sépare achats et ventes en deux listes ; le desktop les montre
  // dans une seule table filtrable, donc les trois chemins mènent ici.
  purchases: 'operations',
  sales: 'operations',
  analysis: 'analysis',
  dashboard: 'analysis',
  accounts: 'accounts',
  inventory: 'inventory',
  counterparties: 'counterparties',
  ledger: 'ledger',
};

export function viewFromPath(pathname: string): TreasuryView | null {
  const rest = pathname.startsWith(TREASURY_ROOT) ? pathname.slice(TREASURY_ROOT.length) : '';
  const segment = rest.split('/').filter(Boolean)[0];
  if (!segment) return null;
  return PATH_TO_VIEW[segment] ?? null;
}

/** Le chemin d'une vue de premier niveau. */
export function pathForView(view: TreasuryView): string {
  return TREASURY_VIEWS.find((v) => v.key === view)?.path ?? TREASURY_ROOT;
}

/* ── Saisies ──────────────────────────────────────────────────────────
 *
 * `/purchase` et `/sale` ne sont PAS des vues : elles s'ouvrent en fenêtre
 * PAR-DESSUS la vue courante, qui reste visible derrière un voile. C'est
 * pourquoi `viewFromPath` renvoie `null` pour elles — l'écran garde alors la
 * dernière vue affichée, et y revient quand la fenêtre se ferme. */

export type TreasuryEntry = 'purchase' | 'sale';

export function entryFromPath(pathname: string): TreasuryEntry | null {
  const rest = pathname.startsWith(TREASURY_ROOT) ? pathname.slice(TREASURY_ROOT.length) : '';
  const parts = rest.split('/').filter(Boolean);
  // `/operations/purchase/<id>` est une opération, pas une saisie.
  if (parts.length !== 1) return null;
  return parts[0] === 'purchase' || parts[0] === 'sale' ? parts[0] : null;
}

/**
 * L'identifiant d'opération présent dans l'URL, quelle que soit sa forme :
 * `/operations/purchase/<id>` (desktop) ou `/purchases/<id>` et
 * `/sales/<id>` (mobile). C'est ce qui rendait les liens profonds morts :
 * l'identifiant était dans l'URL et personne ne le lisait.
 */
export function operationFromPath(
  pathname: string,
): { kind: OperationKind; id: string } | null {
  const rest = pathname.startsWith(TREASURY_ROOT) ? pathname.slice(TREASURY_ROOT.length) : '';
  const parts = rest.split('/').filter(Boolean);
  if (parts[0] === 'operations' && (parts[1] === 'purchase' || parts[1] === 'sale') && parts[2]) {
    return { kind: parts[1], id: parts[2] };
  }
  if (parts[0] === 'purchases' && parts[1]) return { kind: 'purchase', id: parts[1] };
  if (parts[0] === 'sales' && parts[1]) return { kind: 'sale', id: parts[1] };
  return null;
}

/** L'identifiant de contrepartie dans `/counterparties/<id>`. */
export function counterpartyFromPath(pathname: string): string | null {
  const rest = pathname.startsWith(TREASURY_ROOT) ? pathname.slice(TREASURY_ROOT.length) : '';
  const parts = rest.split('/').filter(Boolean);
  return parts[0] === 'counterparties' && parts[1] ? parts[1] : null;
}

/** Un maillon de fil d'Ariane. Le dernier n'a pas de lien : c'est la page. */
export interface Crumb {
  label: string;
  to?: string;
}

/**
 * Fil d'Ariane d'une page de détail. `Trésorerie` reste toujours le premier
 * maillon : c'est le repère qui manquait sur les pages de saisie, où seule
 * une flèche disait qu'on pouvait revenir — sans dire vers quoi.
 */
export function crumbsFor(view: TreasuryView | null, leaf?: string): Crumb[] {
  const crumbs: Crumb[] = [{ label: 'Trésorerie', to: TREASURY_ROOT }];
  if (view) {
    const def = TREASURY_VIEWS.find((v) => v.key === view);
    if (def) crumbs.push({ label: def.label, to: leaf ? def.path : undefined });
  }
  if (leaf) crumbs.push({ label: leaf });
  return crumbs;
}
