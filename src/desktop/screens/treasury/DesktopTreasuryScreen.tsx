/**
 * Trésorerie desktop — la coquille du module (refonte d'octobre 2026).
 *
 * Maquettes validées : docs/tresorerie/maquettes. Diagnostic de l'ancien
 * module : docs/tresorerie/02-DIAGNOSTIC.md.
 *
 *   · un en-tête unique (fil d'Ariane, titre de la rubrique, actions) ;
 *   · six rubriques, du quotidien au contrôle, pilotées par l'URL ;
 *   · « Nouvel achat » et « Nouvelle vente » toujours au même endroit ;
 *   · toutes les fenêtres de saisie vivent ICI : une vue demande
 *     (`useTreasuryActions`), la coquille ouvre. La vue derrière reste
 *     montée — période, filtres et ligne ouverte survivent à une saisie.
 */
import { useRef, useState, type ElementType } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  BarChart3,
  ClipboardCheck,
  Home,
  MoreHorizontal,
  ShieldCheck,
  SlidersHorizontal,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { DateRangeProvider } from '@/lib/analytics/DateRangeContext';
import { BTN } from './tstyle';
import {
  TREASURY_SECTIONS,
  parseTreasuryLocation,
  treasuryPaths,
  type CounterpartyFilter,
  type OperationKind,
  type TreasurySection,
} from './treasuryNav';
import { TreasuryActionsContext, type TreasuryActions } from './treasuryActions';
import { TREASURY_DEFAULT_PRESET } from './treasuryPeriod';
import { OverviewView } from './OverviewView';
import { OperationsView } from './OperationsView';
import { AccountsView } from './AccountsView';
import { CounterpartiesView } from './CounterpartiesView';
import { TreasuryAnalysisView } from './TreasuryAnalysisView';
import { ControlView } from './ControlView';
import { PurchaseForm } from './PurchaseForm';
import { SaleForm } from './SaleForm';
import { AdjustForm, InventoryForm } from './AccountForms';
import { CounterpartyForm } from './CounterpartyForm';
import { VoidForm } from './VoidForm';

const ICONS: Record<TreasurySection, ElementType> = {
  overview: Home,
  operations: ArrowLeftRight,
  accounts: Wallet,
  counterparties: Users,
  analysis: BarChart3,
  control: ShieldCheck,
};

export function DesktopTreasuryScreen() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { hasPermission, currentUser } = useAdminAuth();

  const loc = parseTreasuryLocation(pathname, search);
  // Une saisie s'ouvre PAR-DESSUS la dernière rubrique affichée ; arrivé
  // directement sur `/purchase`, c'est la vue d'ensemble qui sert de fond.
  const lastPath = useRef<string>(treasuryPaths.overview);
  const sawSection = useRef(false);
  if (loc.section) {
    lastPath.current = pathname + search;
    sawSection.current = true;
  }
  const bg = loc.section ? loc : parseTreasuryLocation(lastPath.current.split('?')[0], lastPath.current.includes('?') ? `?${lastPath.current.split('?')[1]}` : '');
  const section = bg.section ?? 'overview';

  const [adjustFor, setAdjustFor] = useState<string | null | undefined>(undefined);
  const [inventoryFor, setInventoryFor] = useState<string | null | undefined>(undefined);
  const [cpEdit, setCpEdit] = useState<{ type: CounterpartyFilter; id?: string } | null>(null);
  const [voiding, setVoiding] = useState<{ kind: OperationKind; id: string; label: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  if (!hasPermission('canViewTreasury')) return <Navigate to="/m" replace />;

  const canManage = hasPermission('canManageTreasury');
  const actions: TreasuryActions = {
    canManage,
    canVoid: currentUser?.role === 'super_admin',
    newPurchase: () => navigate(treasuryPaths.newPurchase),
    newSale: () => navigate(treasuryPaths.newSale),
    adjust: (id) => setAdjustFor(id ?? null),
    inventory: (id) => setInventoryFor(id ?? null),
    editCounterparty: (args) => setCpEdit(args),
    voidOperation: (op) => setVoiding(op),
  };
  // Fermer une saisie revient en ARRIÈRE : ouverte depuis une rubrique, on
  // dépile l'entrée (Retour ne rouvre pas le formulaire, et l'historique ne
  // garde pas deux fois la rubrique) ; ouverte par lien direct, on remplace
  // l'adresse par la rubrique de fond.
  const closeEntry = () => {
    if (sawSection.current && (window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate(lastPath.current, { replace: true });
  };

  const current = TREASURY_SECTIONS.find((s) => s.key === section)!;
  const menuItems: Array<{ icon: ElementType; label: string; run: () => void }> = [
    { icon: SlidersHorizontal, label: 'Ajuster le solde d’un compte', run: () => actions.adjust() },
    { icon: ClipboardCheck, label: 'Faire un inventaire', run: () => actions.inventory() },
    { icon: UserPlus, label: 'Nouveau fournisseur USDT', run: () => actions.editCounterparty({ type: 'usdt_supplier' }) },
    { icon: UserPlus, label: 'Nouvel acheteur CNY', run: () => actions.editCounterparty({ type: 'cny_buyer' }) },
  ];

  return (
    <TreasuryActionsContext.Provider value={actions}>
      <DateRangeProvider defaultPreset={TREASURY_DEFAULT_PRESET}>
        <div className="space-y-5 text-foreground">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <nav aria-label="Fil d’Ariane" className="text-[13px] text-muted-foreground">
                {section === 'overview' ? (
                  'Trésorerie'
                ) : (
                  <>
                    <button type="button" onClick={() => navigate(treasuryPaths.overview)} className="hover:text-foreground hover:underline">
                      Trésorerie
                    </button>
                    <span className="mx-1.5">›</span>
                    {current.label}
                  </>
                )}
              </nav>
              <h1 className="mt-0.5 text-[26px] font-extrabold tracking-tight">{section === 'overview' ? 'Trésorerie' : current.label}</h1>
            </div>
            {canManage && (
              <div className="flex items-center gap-2">
                <div className="relative" onKeyDown={(e) => e.key === 'Escape' && setMenuOpen(false)}>
                  <button type="button" className={BTN.icon} aria-label="Autres actions" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {menuOpen && (
                    <>
                      <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={() => setMenuOpen(false)} />
                      <div className="absolute right-0 z-50 mt-1.5 w-[280px] overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-lg">
                        {menuItems.map((m) => (
                          <button
                            key={m.label}
                            type="button"
                            onClick={() => {
                              setMenuOpen(false);
                              m.run();
                            }}
                            className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13.5px] hover:bg-accent"
                          >
                            <m.icon className="h-4 w-4 text-muted-foreground" /> {m.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <button type="button" onClick={actions.newPurchase} className={BTN.soft}>
                  <ArrowDownToLine className="h-4 w-4" /> Nouvel achat
                </button>
                <button type="button" onClick={actions.newSale} className={BTN.primary}>
                  <ArrowUpFromLine className="h-4 w-4" /> Nouvelle vente
                </button>
              </div>
            )}
          </header>

          <nav aria-label="Rubriques de la trésorerie" className="flex items-center gap-1 overflow-x-auto border-b border-border">
            {TREASURY_SECTIONS.map((s) => {
              const Icon = ICONS[s.key];
              const active = s.key === section;
              return (
                <button
                  key={s.key}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => navigate(s.path)}
                  className={cn(
                    '-mb-px flex h-11 shrink-0 items-center gap-2 border-b-2 px-3.5 text-[14px] transition-colors',
                    active ? 'border-foreground font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" /> {s.label}
                </button>
              );
            })}
          </nav>

          {section === 'overview' && <OverviewView />}
          {section === 'operations' && <OperationsView filter={bg.operationFilter} open={bg.operation} />}
          {section === 'accounts' && <AccountsView accountId={bg.accountId} />}
          {section === 'counterparties' && <CounterpartiesView filter={bg.counterpartyFilter} counterpartyId={bg.counterpartyId} />}
          {section === 'analysis' && <TreasuryAnalysisView />}
          {section === 'control' && <ControlView view={bg.control} />}
        </div>

        {canManage && (
          <>
            <PurchaseForm open={loc.entry === 'purchase'} onClose={closeEntry} />
            <SaleForm open={loc.entry === 'sale'} onClose={closeEntry} />
            <AdjustForm open={adjustFor !== undefined} accountId={adjustFor ?? null} onClose={() => setAdjustFor(undefined)} />
            <InventoryForm open={inventoryFor !== undefined} accountId={inventoryFor ?? null} onClose={() => setInventoryFor(undefined)} />
            <CounterpartyForm open={!!cpEdit} type={cpEdit?.type ?? 'usdt_supplier'} counterpartyId={cpEdit?.id} onClose={() => setCpEdit(null)} />
          </>
        )}
        {actions.canVoid && <VoidForm operation={voiding} onClose={() => setVoiding(null)} />}
      </DateRangeProvider>
    </TreasuryActionsContext.Provider>
  );
}
