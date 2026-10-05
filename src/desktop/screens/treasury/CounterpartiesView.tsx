/**
 * Trésorerie — Contreparties : les fournisseurs d'USDT et les acheteurs de
 * CNY, et la fiche de chacun.
 *
 * L'identifiant lisible (F-003, A-001) précède toujours le nom : deux
 * « Nana » ne se confondent plus. Les chiffres de la liste et de la fiche
 * portent sur la PÉRIODE choisie, et le disent.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, ArchiveRestore, Pencil, Trash2, UserPlus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeText } from '@/lib/clientSearch';
import { DateRangePicker } from '@/components/analytics/DateRangePicker';
import { formatRangeLabel } from '@/lib/analytics/dateRange';
import {
  useCounterparties,
  useDeleteCounterparty,
  useTreasuryOperations,
  useUpdateCounterparty,
  type TreasuryCounterparty,
} from '@/hooks/useTreasury';
import { BTN, TK } from './tstyle';
import { BackLink, Card, CardHead, Confirm, Empty, ErrorState, IdTag, Loading, Money, RowButton, SearchInput, Segmented, Stat, StatusPill, Td, Th } from './tkit';
import { useTreasuryBounds } from './treasuryPeriod';
import { useTreasuryActions } from './treasuryActions';
import { treasuryPaths, type CounterpartyFilter } from './treasuryNav';
import { fmtNum, fmtWhen } from './treasuryFormat';
import { totalsOf, viewOperation, type OperationView } from './operationView';
import { KindBadge } from './KindBadge';

const TYPE_TEXT: Record<CounterpartyFilter, { many: string; one: string; add: string; counter: 'XAF' | 'CNY'; unit: string; decimals: number }> = {
  usdt_supplier: { many: 'Fournisseurs USDT', one: 'Fournisseur USDT', add: 'Nouveau fournisseur', counter: 'XAF', unit: 'XAF / USDT', decimals: 2 },
  cny_buyer: { many: 'Acheteurs CNY', one: 'Acheteur CNY', add: 'Nouvel acheteur', counter: 'CNY', unit: 'CNY / USDT', decimals: 4 },
};

/** Les opérations actives de la période, rangées par contrepartie. */
function useOpsByCounterparty() {
  const { fromIso, toIso } = useTreasuryBounds();
  const ops = useTreasuryOperations(fromIso, toIso);
  const byCp = useMemo(() => {
    const m = new Map<string, OperationView[]>();
    for (const op of ops.data ?? []) {
      const v = viewOperation(op);
      if (!v.counterpartyId) continue;
      const list = m.get(v.counterpartyId) ?? [];
      list.push(v);
      m.set(v.counterpartyId, list);
    }
    return m;
  }, [ops.data]);
  return { ops, byCp };
}

export function CounterpartiesView({ filter, counterpartyId }: { filter: CounterpartyFilter; counterpartyId: string | null }) {
  if (counterpartyId) return <CounterpartyDetail id={counterpartyId} />;
  return <CounterpartyList filter={filter} />;
}

function CounterpartyList({ filter }: { filter: CounterpartyFilter }) {
  const navigate = useNavigate();
  const actions = useTreasuryActions();
  const [showArchived, setShowArchived] = useState(false);
  const [q, setQ] = useState('');
  const cps = useCounterparties(filter, true);
  const { ops, byCp } = useOpsByCounterparty();
  const t = TYPE_TEXT[filter];

  const all = cps.data ?? [];
  const archivedCount = all.filter((c) => !c.is_active).length;
  const rows = all
    .filter((c) => showArchived || c.is_active)
    .filter((c) => !q || normalizeText(`${c.short_id} ${c.display_name} ${c.legal_name ?? ''} ${c.phone ?? ''} ${c.wechat_id ?? ''}`).includes(normalizeText(q)))
    .map((c) => ({ c, s: totalsOf((byCp.get(c.id) ?? []).filter((o) => !o.voided)) }))
    .sort((a, b) => b.s.usdt - a.s.usdt || a.c.display_name.localeCompare(b.c.display_name));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          ariaLabel="Type de contrepartie"
          value={filter}
          onChange={(v) => navigate(treasuryPaths.counterparties(v), { replace: true })}
          options={[
            { value: 'usdt_supplier', label: 'Fournisseurs USDT' },
            { value: 'cny_buyer', label: 'Acheteurs CNY' },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker showGranularity={false} showCompare={false} size="sm" />
          <SearchInput value={q} onChange={setQ} placeholder="Nom, F-003, téléphone…" className="w-[240px]" />
          {actions.canManage && (
            <button type="button" className={BTN.soft} onClick={() => actions.editCounterparty({ type: filter })}>
              <UserPlus className="h-4 w-4" /> {t.add}
            </button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHead
          title={t.many}
          meta="Sur la période choisie, hors opérations annulées"
          action={
            archivedCount > 0 ? (
              <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="h-4 w-4 accent-foreground" />
                Afficher les archivés ({archivedCount})
              </label>
            ) : undefined
          }
        />
        {cps.isLoading ? (
          <Loading rows={6} />
        ) : cps.isError ? (
          <ErrorState onRetry={() => void cps.refetch()} />
        ) : rows.length === 0 ? (
          <Empty icon={Users} title={q ? 'Aucun résultat' : `Aucun ${t.one.toLowerCase()}`} />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <Th>Nom</Th>
                <Th align="right">Opérations</Th>
                <Th align="right">USDT</Th>
                <Th align="right">Taux moyen</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, s }) => (
                <RowButton key={c.id} muted={!c.is_active} onOpen={() => navigate(treasuryPaths.counterparty(c.id))} label={`Ouvrir la fiche de ${c.display_name}`}>
                  <Td>
                    <span className="block font-semibold">
                      {c.display_name}
                      {!c.is_active && <span className="ml-2 text-[12.5px] font-medium text-muted-foreground">archivé</span>}
                    </span>
                    <span className="block text-[12.5px] text-muted-foreground">
                      {c.short_id}
                      {c.phone && ` · ${c.phone}`}
                    </span>
                  </Td>
                  <Td align="right" className={TK.num}>{ops.isLoading ? '…' : s.count}</Td>
                  <Td align="right" className={cn('font-semibold', TK.num)}>{ops.isLoading ? '…' : s.count ? fmtNum(s.usdt, 2) : '—'}</Td>
                  <Td align="right" muted className={TK.num}>{s.avgRate ? `${fmtNum(s.avgRate, t.decimals)} ${t.unit}` : '—'}</Td>
                </RowButton>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

/* ── Fiche ─────────────────────────────────────────────────────────────── */

function CounterpartyDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const actions = useTreasuryActions();
  const cps = useCounterparties(undefined, true);
  const { ops, byCp } = useOpsByCounterparty();
  const { range } = useTreasuryBounds();
  const update = useUpdateCounterparty();
  const remove = useDeleteCounterparty();
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null);

  const cp: TreasuryCounterparty | undefined = (cps.data ?? []).find((c) => c.id === id);
  const type = (cp?.type ?? 'usdt_supplier') as CounterpartyFilter;
  const t = TYPE_TEXT[type];

  const back = <BackLink onClick={() => navigate(treasuryPaths.counterparties(type))}>{t.many}</BackLink>;

  if (cps.isLoading) return <div className="space-y-3">{back}<Card><Loading rows={6} /></Card></div>;
  if (cps.isError) return <div className="space-y-3">{back}<Card><ErrorState onRetry={() => void cps.refetch()} /></Card></div>;
  if (!cp) return <div className="space-y-3">{back}<Card><Empty icon={Users} title="Contrepartie introuvable" /></Card></div>;

  const list = byCp.get(cp.id) ?? [];
  const s = totalsOf(list.filter((o) => !o.voided));

  return (
    <div className="space-y-4">
      {back}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <IdTag className="h-7 px-2 text-[13px]">{cp.short_id}</IdTag>
              <h2 className="truncate text-[22px] font-extrabold tracking-tight">{cp.display_name}</h2>
              {!cp.is_active && <StatusPill tone="neutral">Archivé</StatusPill>}
            </div>
            <div className="mt-1 text-[13px] text-muted-foreground">
              {t.one}
              {cp.legal_name && <> · {cp.legal_name}</>}
            </div>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13.5px]">
              <div><dt className="inline text-muted-foreground">Téléphone </dt><dd className="inline font-medium">{cp.phone || '—'}</dd></div>
              <div><dt className="inline text-muted-foreground">WeChat </dt><dd className="inline font-medium">{cp.wechat_id || '—'}</dd></div>
            </dl>
            {cp.notes && <p className="mt-2 max-w-[640px] whitespace-pre-wrap text-[13.5px] text-foreground/85">{cp.notes}</p>}
          </div>
          {actions.canManage && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={BTN.soft} onClick={() => actions.editCounterparty({ type, id: cp.id })}>
                <Pencil className="h-4 w-4" /> Modifier
              </button>
              <button type="button" className={BTN.soft} onClick={() => setConfirm('archive')}>
                {cp.is_active ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                {cp.is_active ? 'Archiver' : 'Réactiver'}
              </button>
              <button type="button" className={BTN.danger} onClick={() => setConfirm('delete')}>
                <Trash2 className="h-4 w-4" /> Supprimer
              </button>
            </div>
          )}
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[15px] font-bold">Sur la période · {formatRangeLabel(range)}</h3>
        <DateRangePicker showGranularity={false} showCompare={false} size="sm" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Opérations">
          <span className={cn('text-[20px] font-bold', TK.num)}>{ops.isLoading ? '…' : s.count}</span>
        </Stat>
        <Stat label={type === 'usdt_supplier' ? 'USDT achetés' : 'USDT vendus'}>
          <Money value={ops.isLoading ? null : s.usdt} cur="USDT" size="lg" />
        </Stat>
        <Stat label={type === 'usdt_supplier' ? 'XAF payés' : 'CNY reçus'}>
          <Money value={ops.isLoading ? null : s.counter} cur={t.counter} size="lg" />
        </Stat>
        <Stat label="Taux moyen">
          <span className={cn('text-[20px] font-bold', TK.num)}>{s.avgRate ? fmtNum(s.avgRate, t.decimals) : '—'}</span>{' '}
          {s.avgRate ? <span className="text-[11.5px] font-semibold text-muted-foreground">{t.unit}</span> : null}
        </Stat>
      </div>

      <Card className="overflow-hidden">
        <CardHead title="Opérations" meta="Les annulées restent visibles, barrées, hors totaux" />
        {ops.isLoading ? (
          <Loading rows={5} />
        ) : ops.isError ? (
          <ErrorState onRetry={() => void ops.refetch()} />
        ) : list.length === 0 ? (
          <Empty title="Aucune opération sur cette période">Changez de période pour voir l’historique.</Empty>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Type</Th>
                <Th>Compte</Th>
                <Th align="right">USDT</Th>
                <Th align="right">Taux {t.unit}</Th>
                <Th align="right">{t.counter}</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => (
                <RowButton key={o.id} muted={o.voided} onOpen={() => navigate(treasuryPaths.operation(o.kind, o.id))} label="Ouvrir l’opération">
                  <Td muted>{fmtWhen(o.at)}</Td>
                  <Td><KindBadge kind={o.kind} voided={o.voided} /></Td>
                  <Td muted={o.accounts === '—'} className="max-w-[220px] truncate">{o.accounts}</Td>
                  <Td align="right"><span className={cn('font-semibold', TK.num, o.voided && 'line-through')}>{fmtNum(o.usdt, 2)}</span></Td>
                  <Td align="right" className={TK.num}>{fmtNum(o.rate, o.rateDecimals)}</Td>
                  <Td align="right"><Money value={o.counter} cur={o.counterCur} size="sm" showCur={false} className={o.voided ? 'line-through' : ''} /></Td>
                </RowButton>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Confirm
        open={confirm === 'archive'}
        title={cp.is_active ? `Archiver ${cp.display_name} ?` : `Réactiver ${cp.display_name} ?`}
        confirmLabel={cp.is_active ? 'Archiver' : 'Réactiver'}
        busy={update.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => update.mutate({ id: cp.id, is_active: !cp.is_active }, { onSuccess: () => setConfirm(null) })}
      >
        {cp.is_active
          ? 'Il ne sera plus proposé dans les nouvelles saisies. Son historique reste intact et vous pourrez le réactiver.'
          : 'Il sera de nouveau proposé dans les saisies.'}
      </Confirm>
      <Confirm
        open={confirm === 'delete'}
        title={`Supprimer ${cp.display_name} ?`}
        confirmLabel="Supprimer"
        danger
        busy={remove.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          remove.mutate(cp.id, {
            onSuccess: () => {
              setConfirm(null);
              navigate(treasuryPaths.counterparties(type), { replace: true });
            },
          })
        }
      >
        Seule une contrepartie SANS aucune opération peut être supprimée. Sinon, archivez-la.
      </Confirm>
    </div>
  );
}
