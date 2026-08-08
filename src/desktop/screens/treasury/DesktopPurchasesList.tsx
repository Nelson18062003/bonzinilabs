/**
 * Achats USDT — the purchase ledger of the treasury module.
 *
 * Rebuilt onto the desktop dimensional contract (`@/desktop/ui`). The screen
 * previously ran a second control vocabulary borrowed from the mobile treasury
 * kit — a 36px `Pill` beside a ~39px `Segmented`, a 40px header pill and a
 * hand-rolled 26px title — none of which sits on the console's
 * 24/28/32 ladder. Every control now comes from the primitives, which read
 * their geometry from the container they sit in (`Toolbar` → 28px,
 * `ScreenHead` → 32px, table row → 24px), so nothing can disagree again.
 *
 * Two structural moves beyond the swap, both taken from the deposits screen:
 *  · the rows were cards in a 2-column grid, but they are a table — one
 *    counterparty, one date, two amounts and a rate per row. `DataTable` gives
 *    them a sticky header, keyboard navigation, zebra rows and column sorting
 *    for free, and the "Trier par" select disappears into the column headers
 *    it was duplicating.
 *  · a failed query renders an **error** state, never "aucun achat" — telling
 *    a treasurer the ledger is empty when the backend is down is the worst
 *    possible lie in a money product.
 *
 * Data layer is untouched (`useTreasuryOperations`, `useCounterparties`,
 * `VoidOperationDialog`), so mobile and desktop still agree on what an achat is.
 */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowDownToLine, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { VoidOperationDialog } from '@/components/treasury/VoidOperationDialog';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCounterparties, useTreasuryOperations, type OperationRow } from '@/hooks/useTreasury';
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
type PurchaseOp = Extract<OperationRow, { kind: 'purchase' }>;

const CHANNEL_LABELS: Record<string, string> = {
  bank_transfer: 'Virement',
  mobile_money: 'Mobile Money',
  cash: 'Cash',
  other: 'Autre',
};

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

export function DesktopPurchasesList() {
  const navigate = useNavigate();
  const { hasPermission, currentUser } = useAdminAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const [preset, setPreset] = useState<Preset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showVoided, setShowVoided] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [channel, setChannel] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('date_desc');
  const [confirmDelete, setConfirmDelete] = useState<OperationRow | null>(null);
  const range = useMemo(() => getRange(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const { data, isLoading, isError, isFetching, refetch } = useTreasuryOperations(
    range.from.toISOString(),
    range.to.toISOString(),
  );
  const { data: suppliers } = useCounterparties('usdt_supplier', true);

  if (!hasPermission('canViewTreasury')) {
    return <Navigate to="/m" replace />;
  }

  const hasFilters = !!supplierId || !!channel || sortBy !== 'date_desc';
  const resetFilters = () => {
    setSupplierId('');
    setChannel('');
    setSortBy('date_desc');
  };

  let purchases = (data ?? []).filter((op): op is PurchaseOp => {
    if (op.kind !== 'purchase') return false;
    if (!showVoided && op.voided_at) return false;
    if (supplierId && op.supplier_id !== supplierId) return false;
    if (channel && op.channel !== channel) return false;
    return true;
  });

  purchases = [...purchases].sort((a, b) => {
    switch (sortBy) {
      case 'date_asc':
        return (a.occurred_at ?? '').localeCompare(b.occurred_at ?? '');
      case 'amount_desc':
        return Number(b.xaf_amount) - Number(a.xaf_amount);
      case 'amount_asc':
        return Number(a.xaf_amount) - Number(b.xaf_amount);
      default:
        return (b.occurred_at ?? '').localeCompare(a.occurred_at ?? '');
    }
  });

  const live = purchases.filter((p) => !p.voided_at);
  const totalUsdt = live.reduce((s, p) => s + Number(p.usdt_amount ?? 0), 0);
  const totalXaf = live.reduce((s, p) => s + Number(p.xaf_amount ?? 0), 0);

  /* The sort lives on the column headers now, so the two representations have
     to stay in sync: `date_*` ↔ the Date column, `amount_*` ↔ Montant XAF —
     which is the amount the previous "Trier par" select sorted on. */
  const sort: SortState = {
    key: sortBy.startsWith('date') ? 'occurred_at' : 'xaf_amount',
    dir: sortBy.endsWith('asc') ? 'asc' : 'desc',
  };
  const onSortChange = (s: SortState) =>
    setSortBy(`${s.key === 'occurred_at' ? 'date' : 'amount'}_${s.dir}` as SortKey);

  const channelAxis: FilterAxis<string> = {
    id: 'channel',
    label: 'Canal de paiement',
    value: channel,
    onChange: setChannel,
    neutral: '',
    options: [
      { value: '', label: 'Tous les canaux' },
      ...Object.entries(CHANNEL_LABELS).map(([value, label]) => ({ value, label })),
    ],
  };

  const columns: Column<PurchaseOp>[] = [
    {
      key: 'occurred_at',
      header: 'Date',
      width: '150px',
      sortable: true,
      cell: (op) => <span className={cn('whitespace-nowrap', DFG.muted)}>{fmtDateTime(op.occurred_at)}</span>,
    },
    {
      key: 'supplier',
      header: 'Fournisseur',
      cell: (op) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn('truncate font-semibold', DFG.strong)}>{op.supplier?.display_name ?? '—'}</span>
          {op.voided_at ? <Badge tone="danger">Annulée</Badge> : null}
        </span>
      ),
    },
    {
      key: 'xaf_amount',
      header: 'Montant payé',
      align: 'right',
      width: '170px',
      sortable: true,
      cell: (op) => <Figure value={fmt(Number(op.xaf_amount), 0)} unit="XAF" />,
    },
    {
      key: 'usdt_amount',
      header: 'USDT reçus',
      align: 'right',
      width: '150px',
      cell: (op) => <Figure value={fmt(Number(op.usdt_amount), 2)} unit="USDT" />,
    },
    {
      key: 'implicit_rate',
      header: 'Taux',
      align: 'right',
      width: '160px',
      hideBelow: 1100,
      cell: (op) => (
        <span className={cn('whitespace-nowrap tabular-nums', DFG.muted)}>
          {fmt(Number(op.implicit_rate), 4)} XAF/USDT
        </span>
      ),
    },
    {
      key: 'channel',
      header: 'Canal',
      width: '140px',
      hideBelow: 900,
      cell: (op) => <span className={DFG.muted}>{CHANNEL_LABELS[op.channel ?? ''] ?? '—'}</span>,
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
            label="Annuler cet achat"
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
            title="Achats USDT"
            subtitle={`${live.length} achat${live.length > 1 ? 's' : ''} sur la période`}
            actions={
              <Button variant="primary" icon={Plus} onClick={() => navigate('/m/more/treasury/purchase')}>
                Nouvel achat
              </Button>
            }
          />
        }
        metrics={
          <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
            <Metric label="Total payé" value={fmt(totalXaf, 0)} unit="XAF" hint="Achats non annulés" />
            <Metric label="Total acheté" value={fmt(totalUsdt, 2)} unit="USDT" hint="Achats non annulés" />
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
              aria-label="Fournisseur"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-56"
            >
              <option value="">Tous les fournisseurs</option>
              {(suppliers ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.short_id} · {s.display_name}
                </option>
              ))}
            </Select>

            <Chip active={showVoided} onClick={() => setShowVoided((v) => !v)}>
              Supprimées
            </Chip>

            <FilterPopover
              axes={[channelAxis]}
              onClear={resetFilters}
              /* The fournisseur select and the column sort narrow the list
                 without touching the axis this popover owns, so the reset has
                 to be declared here or it never appears in the states an
                 operator most wants one. */
              clearable={!!supplierId || sortBy !== 'date_desc'}
            />
          </Toolbar>
        }
      >
        <DataTable
          label="Liste des achats USDT"
          rows={purchases}
          columns={columns}
          getRowId={(op) => op.id}
          onRowClick={(op) => navigate(`/m/more/treasury/purchases/${op.id}`)}
          sort={sort}
          onSortChange={onSortChange}
          isLoading={isLoading}
          empty={
            isError ? (
              <EmptyState
                icon={AlertTriangle}
                title="Impossible de charger les achats"
                hint="La requête a échoué — le registre n'est pas vide, il n'a pas pu être lu."
                action={
                  <Button icon={RefreshCw} loading={isFetching} onClick={() => refetch()}>
                    Réessayer
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={ArrowDownToLine}
                title="Aucun achat avec ces critères."
                hint={
                  hasFilters || showVoided || preset !== '30d'
                    ? 'Essayez de modifier ou réinitialiser vos filtres.'
                    : 'Les achats USDT enregistrés apparaîtront ici.'
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
