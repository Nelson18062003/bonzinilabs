/**
 * Ventes USDT → CNY — the sales ledger of the treasury module.
 *
 * Rebuilt onto the desktop dimensional contract (`@/desktop/ui`), the same way
 * and for the same reason as the achats screen: the mobile treasury kit put a
 * 36px `Pill` next to a ~39px `Segmented` under a 40px header pill and a
 * hand-rolled 26px title, none of it on the console's 24/28/32 ladder.
 * Controls now inherit their geometry from `Toolbar` (28px), `ScreenHead`
 * (32px) and the table row (24px).
 *
 * The card grid becomes a `DataTable` — these rows are a table (contrepartie,
 * date, two amounts, a rate) and gain a sticky header, keyboard navigation and
 * column sorting, which is where the old "Trier par" select now lives. A failed
 * query renders an error state rather than "aucune vente", because an empty
 * ledger and an unreadable one are different facts.
 *
 * Data layer untouched (`useTreasuryOperations`, `useCounterparties`,
 * `useTreasuryAccounts`, `VoidOperationDialog`).
 */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowUpFromLine, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { VoidOperationDialog } from '@/components/treasury/VoidOperationDialog';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  useCounterparties,
  useTreasuryAccounts,
  useTreasuryOperations,
  type OperationRow,
} from '@/hooks/useTreasury';
import { cn } from '@/lib/utils';
import { DFG } from '@/desktop/ui/tokens';
import {
  Badge,
  Button,
  Chip,
  EmptyState,
  Figure,
  IconButton,
  Input,
  Metric,
  Segment,
  Select,
} from '@/desktop/ui/primitives';
import { FilterPopover, type FilterAxis } from '@/desktop/ui/Popover';
import { DataTable, type Column, type SortState } from '@/desktop/ui/DataTable';
import { ScreenHead, Toolbar, Workbench } from '@/desktop/ui/layout';

type Preset = '7d' | '30d' | '90d' | 'all' | 'custom';
type SortKey = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';
type SaleOp = Extract<OperationRow, { kind: 'sale' }>;

/** Sentinel for "sale credited to no Bonzini account" — a real filter value. */
const NO_ACCOUNT = 'none';

const PERIOD_OPTIONS: { value: Preset; label: string }[] = [
  { value: '7d', label: '7 j' },
  { value: '30d', label: '30 j' },
  { value: '90d', label: '90 j' },
  { value: 'all', label: 'Tout' },
  { value: 'custom', label: 'Perso' },
];

function getRange(preset: Preset, customFrom?: string, customTo?: string): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to);
  if (preset === 'custom') {
    return {
      from: customFrom ? new Date(customFrom + 'T00:00:00') : new Date(to.getFullYear(), to.getMonth(), 1),
      to: customTo ? new Date(customTo + 'T23:59:59') : to,
    };
  }
  if (preset === 'all') {
    from.setFullYear(2020, 0, 1);
  } else {
    const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
    from.setDate(to.getDate() - days);
  }
  return { from, to };
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export function DesktopSalesList() {
  const navigate = useNavigate();
  const { hasPermission, currentUser } = useAdminAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const [preset, setPreset] = useState<Preset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showVoided, setShowVoided] = useState(false);
  const [buyerId, setBuyerId] = useState('');
  const [cnyAccountId, setCnyAccountId] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('date_desc');
  const [confirmDelete, setConfirmDelete] = useState<OperationRow | null>(null);
  const range = useMemo(() => getRange(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const { data, isLoading, isError, isFetching, refetch } = useTreasuryOperations(
    range.from.toISOString(),
    range.to.toISOString(),
  );
  const { data: buyers } = useCounterparties('cny_buyer', true);
  const { data: cnyAccounts } = useTreasuryAccounts('CNY');

  if (!hasPermission('canViewTreasury')) {
    return <Navigate to="/m" replace />;
  }

  const hasFilters = !!buyerId || !!cnyAccountId || sortBy !== 'date_desc';
  const resetFilters = () => {
    setBuyerId('');
    setCnyAccountId('');
    setSortBy('date_desc');
  };

  let sales = (data ?? []).filter((op): op is SaleOp => {
    if (op.kind !== 'sale') return false;
    if (!showVoided && op.voided_at) return false;
    if (buyerId && op.buyer_id !== buyerId) return false;
    if (cnyAccountId) {
      if (cnyAccountId === NO_ACCOUNT && op.cny_account_id) return false;
      if (cnyAccountId !== NO_ACCOUNT && op.cny_account_id !== cnyAccountId) return false;
    }
    return true;
  });

  sales = [...sales].sort((a, b) => {
    switch (sortBy) {
      case 'date_asc':
        return (a.occurred_at ?? '').localeCompare(b.occurred_at ?? '');
      case 'amount_desc':
        return Number(b.usdt_amount) - Number(a.usdt_amount);
      case 'amount_asc':
        return Number(a.usdt_amount) - Number(b.usdt_amount);
      default:
        return (b.occurred_at ?? '').localeCompare(a.occurred_at ?? '');
    }
  });

  const live = sales.filter((s) => !s.voided_at);
  const totalUsdt = live.reduce((sum, s) => sum + Number(s.usdt_amount ?? 0), 0);
  const totalCny = live.reduce((sum, s) => sum + Number(s.cny_amount ?? 0), 0);

  /* Column sort ↔ the four sort keys the screen has always supported.
     `amount_*` is the USDT amount here, exactly as the old select sorted. */
  const sort: SortState = {
    key: sortBy.startsWith('date') ? 'occurred_at' : 'usdt_amount',
    dir: sortBy.endsWith('asc') ? 'asc' : 'desc',
  };
  const onSortChange = (s: SortState) =>
    setSortBy(`${s.key === 'occurred_at' ? 'date' : 'amount'}_${s.dir}` as SortKey);

  const accountAxis: FilterAxis<string> = {
    id: 'cny_account',
    label: 'Compte CNY crédité',
    value: cnyAccountId,
    onChange: setCnyAccountId,
    neutral: '',
    options: [
      { value: '', label: 'Tous les comptes' },
      { value: NO_ACCOUNT, label: 'Aucun compte Bonzini' },
      ...(cnyAccounts ?? []).map((a) => ({ value: a.id, label: a.label })),
    ],
  };

  const columns: Column<SaleOp>[] = [
    {
      key: 'occurred_at',
      header: 'Date',
      width: '150px',
      sortable: true,
      cell: (op) => <span className={cn('whitespace-nowrap', DFG.muted)}>{fmtDateTime(op.occurred_at)}</span>,
    },
    {
      key: 'buyer',
      header: 'Acheteur',
      cell: (op) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn('truncate font-semibold', DFG.strong)}>{op.buyer?.display_name ?? '—'}</span>
          {op.voided_at ? <Badge tone="danger">Annulée</Badge> : null}
        </span>
      ),
    },
    {
      key: 'usdt_amount',
      header: 'USDT vendus',
      align: 'right',
      width: '160px',
      sortable: true,
      cell: (op) => <Figure value={fmt(Number(op.usdt_amount), 2)} unit="USDT" />,
    },
    {
      key: 'cny_amount',
      header: 'CNY reçus',
      align: 'right',
      width: '150px',
      cell: (op) => <Figure value={fmt(Number(op.cny_amount), 2)} unit="CNY" />,
    },
    {
      key: 'implicit_rate',
      header: 'Taux',
      align: 'right',
      width: '160px',
      hideBelow: 1100,
      cell: (op) => (
        <span className={cn('whitespace-nowrap tabular-nums', DFG.muted)}>
          {fmt(Number(op.implicit_rate), 4)} CNY/USDT
        </span>
      ),
    },
    {
      key: 'cny_account',
      header: 'Compte crédité',
      width: '170px',
      hideBelow: 900,
      cell: (op) => <span className={cn('truncate', DFG.muted)}>{op.cny_account?.label ?? '—'}</span>,
    },
  ];

  if (isSuperAdmin) {
    columns.push({
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      width: '64px',
      cell: (op) =>
        op.voided_at ? null : (
          <IconButton
            icon={Trash2}
            label="Annuler cette vente"
            className="text-[#C0504D] dark:text-[#E79A9A]"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(op);
            }}
          />
        ),
    });
  }

  return (
    <>
      <Workbench
        head={
          <ScreenHead
            title="Ventes USDT"
            subtitle={`${live.length} vente${live.length > 1 ? 's' : ''} sur la période`}
            actions={
              <Button variant="primary" icon={Plus} onClick={() => navigate('/m/more/treasury/sale')}>
                Nouvelle vente
              </Button>
            }
          />
        }
        metrics={
          <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
            <Metric label="Total vendu" value={fmt(totalUsdt, 2)} unit="USDT" hint="Ventes non annulées" />
            <Metric label="Total reçu" value={fmt(totalCny, 2)} unit="CNY" hint="Ventes non annulées" />
          </div>
        }
        toolbar={
          <Toolbar>
            <Segment value={preset} onChange={setPreset} options={PERIOD_OPTIONS} />

            {preset === 'custom' ? (
              <>
                <Input
                  type="date"
                  aria-label="Date de début"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-40"
                />
                <Input
                  type="date"
                  aria-label="Date de fin"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-40"
                />
              </>
            ) : null}

            <Select
              aria-label="Acheteur"
              value={buyerId}
              onChange={(e) => setBuyerId(e.target.value)}
              className="w-56"
            >
              <option value="">Tous les acheteurs</option>
              {(buyers ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.short_id} · {b.display_name}
                </option>
              ))}
            </Select>

            <Chip active={showVoided} onClick={() => setShowVoided((v) => !v)}>
              Supprimées
            </Chip>

            <FilterPopover
              axes={[accountAxis]}
              onClear={resetFilters}
              /* The acheteur select and the column sort narrow the list without
                 touching the axis this popover owns — declared here so the
                 reset appears in those states too. */
              clearable={!!buyerId || sortBy !== 'date_desc'}
            />
          </Toolbar>
        }
      >
        <DataTable
          label="Liste des ventes USDT"
          rows={sales}
          columns={columns}
          getRowId={(op) => op.id}
          onRowClick={(op) => navigate(`/m/more/treasury/sales/${op.id}`)}
          sort={sort}
          onSortChange={onSortChange}
          isLoading={isLoading}
          empty={
            isError ? (
              <EmptyState
                icon={AlertTriangle}
                title="Impossible de charger les ventes"
                hint="La requête a échoué — le registre n'est pas vide, il n'a pas pu être lu."
                action={
                  <Button icon={RefreshCw} loading={isFetching} onClick={() => refetch()}>
                    Réessayer
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={ArrowUpFromLine}
                title="Aucune vente avec ces critères."
                hint={
                  hasFilters || showVoided || preset !== '30d'
                    ? 'Essayez de modifier ou réinitialiser vos filtres.'
                    : 'Les ventes USDT enregistrées apparaîtront ici.'
                }
              />
            )
          }
        />
      </Workbench>

      {confirmDelete && <VoidOperationDialog op={confirmDelete} onClose={() => setConfirmDelete(null)} />}
    </>
  );
}
