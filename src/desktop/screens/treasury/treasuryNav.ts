/**
 * Trésorerie — la navigation du module, en un seul endroit (refonte 10/2026).
 *
 * Règle : **l'URL est l'état**. La rubrique, la sous-rubrique et l'objet
 * ouvert (une opération, un compte, une contrepartie) se lisent dans
 * l'adresse : Retour, marque-page, rafraîchissement et lien partagé mènent
 * tous au même écran. L'ancien module avait écrit ces aides sans jamais les
 * brancher — les liens profonds ouvraient la liste sans l'objet.
 *
 * Six rubriques, du quotidien au contrôle :
 *
 *   Vue d'ensemble   /                         ce que j'ai, ce qui s'est passé
 *   Opérations       /operations[?type=…]      achats, ventes, annulées
 *                    /operations/:kind/:id     une opération ouverte à droite
 *   Comptes          /accounts, /accounts/:id  soldes, mouvements d'un compte
 *   Contreparties    /counterparties[?type=…]  fournisseurs USDT, acheteurs CNY
 *                    /counterparties/:id       la fiche
 *   Analyse          /analysis                 indicateurs et courbes
 *   Contrôle         /ledger, /inventory, /balance-dashboard
 *
 * Les saisies (`/purchase`, `/sale`) ne sont pas des rubriques : elles
 * s'ouvrent en panneau par-dessus la dernière rubrique affichée.
 *
 * Les chemins MOBILES (`/purchases`, `/sales/:id`, `/dashboard`…) restent
 * valides : ils mènent au même endroit sur ordinateur.
 */

export const TREASURY_ROOT = '/m/more/treasury';

export type TreasurySection = 'overview' | 'operations' | 'accounts' | 'counterparties' | 'analysis' | 'control';
export type OperationKind = 'purchase' | 'sale';
export type OperationFilter = 'all' | OperationKind | 'voided';
export type CounterpartyFilter = 'usdt_supplier' | 'cny_buyer';
export type ControlView = 'ledger' | 'inventory' | 'visual';
export type TreasuryEntry = 'purchase' | 'sale';

export interface SectionDef {
  key: TreasurySection;
  label: string;
  path: string;
}

export const TREASURY_SECTIONS: readonly SectionDef[] = [
  { key: 'overview', label: 'Vue d’ensemble', path: TREASURY_ROOT },
  { key: 'operations', label: 'Opérations', path: `${TREASURY_ROOT}/operations` },
  { key: 'accounts', label: 'Comptes', path: `${TREASURY_ROOT}/accounts` },
  { key: 'counterparties', label: 'Contreparties', path: `${TREASURY_ROOT}/counterparties` },
  { key: 'analysis', label: 'Analyse', path: `${TREASURY_ROOT}/analysis` },
  { key: 'control', label: 'Contrôle', path: `${TREASURY_ROOT}/ledger` },
] as const;

export const CONTROL_VIEWS: ReadonlyArray<{ key: ControlView; label: string; path: string }> = [
  { key: 'ledger', label: 'Grand livre', path: `${TREASURY_ROOT}/ledger` },
  { key: 'inventory', label: 'Inventaires', path: `${TREASURY_ROOT}/inventory` },
  { key: 'visual', label: 'Visuel des soldes', path: `${TREASURY_ROOT}/balance-dashboard` },
];

export const treasuryPaths = {
  root: TREASURY_ROOT,
  overview: TREASURY_ROOT,
  operations: (filter: OperationFilter = 'all') =>
    filter === 'all' ? `${TREASURY_ROOT}/operations` : `${TREASURY_ROOT}/operations?type=${filter}`,
  operation: (kind: OperationKind, id: string, filter: OperationFilter = 'all') =>
    `${TREASURY_ROOT}/operations/${kind}/${id}${filter === 'all' ? '' : `?type=${filter}`}`,
  accounts: `${TREASURY_ROOT}/accounts`,
  account: (id: string) => `${TREASURY_ROOT}/accounts/${id}`,
  counterparties: (type: CounterpartyFilter = 'usdt_supplier') =>
    type === 'usdt_supplier' ? `${TREASURY_ROOT}/counterparties` : `${TREASURY_ROOT}/counterparties?type=cny_buyer`,
  counterparty: (id: string) => `${TREASURY_ROOT}/counterparties/${id}`,
  analysis: `${TREASURY_ROOT}/analysis`,
  ledger: `${TREASURY_ROOT}/ledger`,
  inventory: `${TREASURY_ROOT}/inventory`,
  visual: `${TREASURY_ROOT}/balance-dashboard`,
  newPurchase: `${TREASURY_ROOT}/purchase`,
  newSale: `${TREASURY_ROOT}/sale`,
} as const;

function parts(pathname: string): string[] {
  const rest = pathname.startsWith(TREASURY_ROOT) ? pathname.slice(TREASURY_ROOT.length) : '';
  return rest.split('/').filter(Boolean);
}

/** Ce que l'adresse demande d'afficher. `section: null` = une saisie seule. */
export interface TreasuryLocation {
  section: TreasurySection | null;
  entry: TreasuryEntry | null;
  operation: { kind: OperationKind; id: string } | null;
  operationFilter: OperationFilter;
  accountId: string | null;
  counterpartyId: string | null;
  counterpartyFilter: CounterpartyFilter;
  control: ControlView;
}

export function parseTreasuryLocation(pathname: string, search: string): TreasuryLocation {
  const p = parts(pathname);
  const q = new URLSearchParams(search);
  const typeParam = q.get('type');
  const loc: TreasuryLocation = {
    section: 'overview',
    entry: null,
    operation: null,
    operationFilter: typeParam === 'purchase' || typeParam === 'sale' || typeParam === 'voided' ? typeParam : 'all',
    accountId: null,
    counterpartyId: null,
    counterpartyFilter: typeParam === 'cny_buyer' ? 'cny_buyer' : 'usdt_supplier',
    control: 'ledger',
  };
  const [a, b, c] = p;
  if (!a) return loc;

  switch (a) {
    case 'purchase':
    case 'sale':
      if (!b) return { ...loc, section: null, entry: a };
      break;
    case 'operations':
      loc.section = 'operations';
      if ((b === 'purchase' || b === 'sale') && c) loc.operation = { kind: b, id: c };
      return loc;
    // Chemins du mobile : deux listes séparées → la table filtrée.
    case 'purchases':
    case 'sales': {
      const kind: OperationKind = a === 'purchases' ? 'purchase' : 'sale';
      loc.section = 'operations';
      if (!typeParam) loc.operationFilter = kind;
      if (b) loc.operation = { kind, id: b };
      return loc;
    }
    case 'accounts':
      loc.section = 'accounts';
      loc.accountId = b ?? null;
      return loc;
    case 'counterparties':
      loc.section = 'counterparties';
      loc.counterpartyId = b ?? null;
      return loc;
    case 'analysis':
    case 'dashboard':
      loc.section = 'analysis';
      return loc;
    case 'ledger':
      loc.section = 'control';
      loc.control = 'ledger';
      return loc;
    case 'inventory':
      loc.section = 'control';
      loc.control = 'inventory';
      return loc;
    case 'balance-dashboard':
      loc.section = 'control';
      loc.control = 'visual';
      return loc;
  }
  return loc;
}
