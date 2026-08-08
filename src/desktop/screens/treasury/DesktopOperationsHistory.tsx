/**
 * Historique des opérations — achats et ventes de trésorerie, un seul registre.
 *
 * Rebuilt onto the desktop dimensional contract (`@/desktop/ui`): the mobile
 * treasury `Segmented` (~39px) and `Pill` (36px) that used to share this
 * screen's filter row are now a `Segment` and `Chip` inside a `Toolbar`, which
 * declares the 28px step for everything in it, and the hand-rolled 26px
 * heading is the `ScreenHead` title (20px `DT.display`).
 *
 * The two-column card grid becomes the console's `DataTable`. This list mixes
 * achats (XAF → USDT) and ventes (USDT → CNY), so the conversion stays in one
 * column rendered per row — the two directions cannot share a numeric column
 * honestly, and pretending otherwise would align figures in different currencies.
 *
 * Data layer untouched (`useTreasuryOperations`).
 */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AlertTriangle, History, RefreshCw } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useTreasuryOperations, type OperationRow } from '@/hooks/useTreasury';
import { cn } from '@/lib/utils';
import { DT, DFG } from '@/desktop/ui/tokens';
import { Badge, Button, Chip, EmptyState, Figure, Segment } from '@/desktop/ui/primitives';
import { DataTable, type Column } from '@/desktop/ui/DataTable';
import { ScreenHead, Toolbar, Workbench } from '@/desktop/ui/layout';

type Filter = 'all' | 'purchase' | 'sale' | 'voided';
type Preset = '7d' | '30d' | '90d';

const PERIOD_OPTIONS: { value: Preset; label: string }[] = [
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: '90d', label: '90 jours' },
];

const KIND_FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Tout' },
  { value: 'purchase', label: 'Achats' },
  { value: 'sale', label: 'Ventes' },
  { value: 'voided', label: 'Annulées' },
];

function getRange(preset: Preset): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to);
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  from.setDate(to.getDate() - days);
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

/** The two legs of an operation, in the direction the money actually moved. */
function legs(op: OperationRow) {
  return op.kind === 'purchase'
    ? {
        from: { v: Number(op.xaf_amount), u: 'XAF', d: 0 },
        to: { v: Number(op.usdt_amount), u: 'USDT', d: 2 },
        rateUnit: 'XAF/USDT',
      }
    : {
        from: { v: Number(op.usdt_amount), u: 'USDT', d: 2 },
        to: { v: Number(op.cny_amount), u: 'CNY', d: 2 },
        rateUnit: 'CNY/USDT',
      };
}

export function DesktopOperationsHistory() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const [preset, setPreset] = useState<Preset>('30d');
  const [filter, setFilter] = useState<Filter>('all');
  const range = useMemo(() => getRange(preset), [preset]);
  const { data, isLoading, isError, isFetching, refetch } = useTreasuryOperations(
    range.from.toISOString(),
    range.to.toISOString(),
  );

  if (!hasPermission('canViewTreasury')) {
    return <Navigate to="/m" replace />;
  }

  const all = data ?? [];
  const filtered = all.filter((op) => {
    if (filter === 'all') return true;
    if (filter === 'voided') return !!op.voided_at;
    return op.kind === filter;
  });

  /* Each bucket counts the rows it would actually return, so a bucket showing
     "0" is a promise and not a guess. `null` while the query is in flight —
     `Chip` draws "unknown" and "known-empty" differently on purpose. */
  const countFor = (k: Filter): number | null => {
    if (isLoading || isError) return null;
    if (k === 'all') return all.length;
    if (k === 'voided') return all.filter((op) => !!op.voided_at).length;
    return all.filter((op) => op.kind === k).length;
  };

  const columns: Column<OperationRow>[] = [
    {
      key: 'kind',
      header: 'Type',
      width: '110px',
      cell: (op) =>
        op.voided_at ? (
          <Badge tone="danger">Annulée</Badge>
        ) : (
          <Badge tone={op.kind === 'purchase' ? 'info' : 'pending'}>{op.kind === 'purchase' ? 'Achat' : 'Vente'}</Badge>
        ),
    },
    {
      key: 'occurred_at',
      header: 'Date',
      width: '150px',
      cell: (op) => <span className={cn('whitespace-nowrap', DFG.muted)}>{fmtDateTime(op.occurred_at)}</span>,
    },
    {
      key: 'counterparty',
      header: 'Contrepartie',
      cell: (op) => (
        <span className={cn('truncate font-semibold', DFG.strong)}>
          {(op.kind === 'purchase' ? op.supplier?.display_name : op.buyer?.display_name) ?? '—'}
        </span>
      ),
    },
    {
      key: 'conversion',
      header: 'Conversion',
      align: 'right',
      width: '260px',
      cell: (op) => {
        const { from, to } = legs(op);
        return (
          <span className="inline-flex items-baseline gap-2 whitespace-nowrap">
            <Figure value={fmt(from.v, from.d)} unit={from.u} />
            <span className={DFG.faint} aria-label="converti en">→</span>
            <Figure value={fmt(to.v, to.d)} unit={to.u} />
          </span>
        );
      },
    },
    {
      key: 'implicit_rate',
      header: 'Taux',
      align: 'right',
      width: '170px',
      hideBelow: 1100,
      cell: (op) => (
        <span className={cn('whitespace-nowrap tabular-nums', DFG.muted)}>
          {fmt(Number(op.implicit_rate), 4)} {legs(op).rateUnit}
        </span>
      ),
    },
  ];

  return (
    <Workbench
      head={
        <ScreenHead
          title="Historique des opérations"
          subtitle={`${filtered.length} opération${filtered.length > 1 ? 's' : ''} sur la période`}
        />
      }
      toolbar={
        <Toolbar>
          <Segment value={preset} onChange={setPreset} options={PERIOD_OPTIONS} />
          {KIND_FILTERS.map((f) => (
            <Chip
              key={f.value}
              active={filter === f.value}
              count={countFor(f.value)}
              // Never disable the bucket in force, or the operator is trapped.
              disabled={countFor(f.value) === 0 && filter !== f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Chip>
          ))}
        </Toolbar>
      }
    >
      <DataTable
        label="Historique des opérations de trésorerie"
        rows={filtered}
        columns={columns}
        getRowId={(op) => `${op.kind}-${op.id}`}
        onRowClick={(op) =>
          navigate(op.kind === 'purchase' ? `/m/more/treasury/purchases/${op.id}` : `/m/more/treasury/sales/${op.id}`)
        }
        isLoading={isLoading}
        empty={
          isError ? (
            <EmptyState
              icon={AlertTriangle}
              title="Impossible de charger l'historique"
              hint="La requête a échoué — la période n'est pas vide, elle n'a pas pu être lue."
              action={
                <Button icon={RefreshCw} loading={isFetching} onClick={() => refetch()}>
                  Réessayer
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={History}
              title="Aucune opération sur cette période."
              hint={filter !== 'all' ? 'Essayez un autre type ou une période plus large.' : undefined}
            />
          )
        }
        footer={
          <p className={cn(DT.label, DFG.muted, 'text-center')}>
            {filtered.length} opération{filtered.length > 1 ? 's' : ''} affichée
            {filtered.length > 1 ? 's' : ''} sur {all.length} enregistrée{all.length > 1 ? 's' : ''} pour la période.
          </p>
        }
      />
    </Workbench>
  );
}
