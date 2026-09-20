/**
 * Desktop admin — Cargo › Réception : la deuxième partie du module, le
 * workbench de l'entrepôt (la barre d'onglets en haut ramène à Container).
 *
 * Même archétype que Container (02-foundation §2.A) : en-tête avec
 * compteurs, files en chips, table, et un dépôt qui s'ouvre en dialogue.
 * Trois choses, dans l'ordre où le fondateur les regarde :
 *   1. ce qui ATTEND à l'entrepôt et au bureau, par client — ce qu'il reste
 *      à mettre dans un conteneur ;
 *   2. les réceptions de la période, avec la file « À attribuer » ;
 *   3. le travail de chaque réceptionnaire, en colonne de droite.
 * La route /m/cargo/reception/:depositId porte la sélection (lien profond).
 */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Download } from 'lucide-react';
import { DesktopCargoParts } from '@/components/cargo/CargoParts';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useReceptionOverview, useReceptionStock } from '@/hooks/useReception';
import { clientFullName, formatCbm, formatKg, initials, type Deposit, type ReceptionLocation } from '@/lib/reception';
import { exportToCSV } from '@/lib/exportCSV';
import { LocationMark, formatDateTime, useReceptionLabels } from '@/mobile/components/reception/bits';
import { DepositQuickView } from '@/components/cargo/reception/DepositQuickView';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, SOFT_PILL, Card, CardHeader, Chip, Holder, KV, ScreenLoader, StatusPill, Th, Td } from '@/desktop/designKit';

type Period = 'today' | 'week' | 'month';
type Queue = 'all' | 'pending' | 'incomplete';

function periodRange(p: Period): { from: Date; to: Date } {
  const to = new Date(); to.setHours(23, 59, 59, 999);
  const from = new Date(); from.setHours(0, 0, 0, 0);
  if (p === 'week') from.setDate(from.getDate() - 6);
  if (p === 'month') from.setDate(from.getDate() - 29);
  return { from, to };
}

const isIncomplete = (d: Deposit) => d.parcels.some((p) => p.weight_kg == null || p.cbm == null || !p.photo_path);

export function DesktopCargoReception() {
  const { hasPermission } = useAdminAuth();
  const navigate = useNavigate();
  const { depositId } = useParams<{ depositId?: string }>();
  const labels = useReceptionLabels();
  const [where, setWhere] = useState<'all' | ReceptionLocation>('all');
  const [period, setPeriod] = useState<Period>('week');
  const [queue, setQueue] = useState<Queue>('all');
  const range = useMemo(() => periodRange(period), [period]);
  const stock = useReceptionStock(where === 'all' ? null : where);
  const overview = useReceptionOverview(range.from, range.to);

  const stats = stock.data?.stats;
  const byClient = stock.data?.by_client ?? [];
  const deposits = useMemo(() => {
    const all = overview.data?.deposits ?? [];
    const scoped = where === 'all' ? all : all.filter((d) => d.location === where);
    return queue === 'pending' ? scoped.filter((d) => !d.client) : queue === 'incomplete' ? scoped.filter(isIncomplete) : scoped;
  }, [overview.data, where, queue]);
  const counts = useMemo(() => {
    const all = overview.data?.deposits ?? [];
    return { all: all.length, pending: all.filter((d) => !d.client).length, incomplete: all.filter(isIncomplete).length };
  }, [overview.data]);
  const staff = overview.data?.by_receptionist ?? [];

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;

  const exportCsv = () => exportToCSV(
    deposits.map((d) => ({ numero: d.deposit_no, date: formatDateTime(d.closed_at ?? d.opened_at), client: d.client ? clientFullName(d.client) : '', code: d.client?.customer_code ?? '', lieu: labels.location(d.location), apporte_par: labels.broughtBy(d.brought_by), colis: d.parcels.length, poids_kg: Number(d.total_weight_kg), volume_m3: Number(d.total_cbm), recu_par: d.received_by_name ?? '', etat: labels.status(d).label })),
    [{ key: 'numero', header: 'N°' }, { key: 'date', header: 'Date' }, { key: 'client', header: 'Client' }, { key: 'code', header: 'Code' }, { key: 'lieu', header: 'Lieu' }, { key: 'apporte_par', header: 'Apporté par' }, { key: 'colis', header: 'Colis' }, { key: 'poids_kg', header: 'Poids (kg)' }, { key: 'volume_m3', header: 'Volume (m³)' }, { key: 'recu_par', header: 'Reçu par' }, { key: 'etat', header: 'État' }],
    `bonzini-reception-${new Date().toISOString().slice(0, 10)}.csv`,
  );

  return (
    <div className="flex min-h-[calc(100vh-120px)] flex-col">
      {/* ── Les deux parties du module : Container · Réception (ici) ────── */}
      <DesktopCargoParts active="reception" className="mb-4" />

      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={cn('text-[15px] font-semibold', TEXT.body)}>
            {stats ? (
              <>
                <span className={TEXT.strong}>{stats.parcels} colis</span> attendent à l'entrepôt · {formatCbm(stats.cbm)} · {stats.clients} client{stats.clients > 1 ? 's' : ''}
                {stats.pending > 0 && <> · <span className="font-bold text-amber-700 dark:text-amber-400">{stats.pending} à attribuer</span></>}
              </>
            ) : 'Réception des colis'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={exportCsv} disabled={deposits.length === 0} className={cn('inline-flex h-9 items-center gap-2 px-3.5 text-[13px] font-semibold disabled:opacity-50', SOFT_PILL)}>
            <Download className="h-4 w-4" /> CSV
          </button>
        </div>
      </header>

      {/* ── Lieu + chiffres ─────────────────────────────────────────────── */}
      <section className="mt-4 flex flex-wrap items-center gap-2">
        <Chip label="Partout" active={where === 'all'} onClick={() => setWhere('all')} />
        <Chip label={<span className="inline-flex items-center gap-1.5"><LocationMark location="warehouse" size={18} /> Entrepôt · Sea cargo</span>} active={where === 'warehouse'} onClick={() => setWhere('warehouse')} />
        <Chip label={<span className="inline-flex items-center gap-1.5"><LocationMark location="office" size={18} /> Bureau · Air cargo</span>} active={where === 'office'} onClick={() => setWhere('office')} />
      </section>
      {stats && (
        <section className="mt-4 grid grid-cols-4 gap-4">
          {[['Colis qui attendent', String(stats.parcels), 'reçus, pas encore chargés'], ['Clients', String(stats.clients), 'avec de la marchandise ici'], ['Poids', formatKg(stats.weight_kg), 'à mettre en boîte'], ['Volume', formatCbm(stats.cbm), 'le Sea cargo se facture au m³']].map(([k, v, h]) => (
            <Card key={k} className="px-5 py-4">
              <KV k={k} v={<span className="text-[22px] font-bold">{v}</span>} />
              <div className={cn('mt-1 text-[12px]', TEXT.muted)}>{h}</div>
            </Card>
          ))}
        </section>
      )}

      {/* ── Tables + colonne de droite ──────────────────────────────────── */}
      <div className="mt-4 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_340px] items-start gap-5">
        <div className="flex min-h-0 flex-col gap-5">
          <Card className="overflow-hidden p-0">
            <CardHeader title="Ce qui attend, par client" meta={`${byClient.length} ligne${byClient.length > 1 ? 's' : ''}`} />
            {stock.isLoading ? <ScreenLoader /> : byClient.length === 0 ? (
              <p className={cn('px-5 py-8 text-center text-[13px]', TEXT.muted)}>Rien n'attend à l'entrepôt.</p>
            ) : (
              <table className="w-full text-left">
                <thead className={SURFACE.card}>
                  <tr>
                    <Th first>Client</Th>
                    <Th>Lieu</Th>
                    <Th align="right">Colis</Th>
                    <Th align="right">Poids</Th>
                    <Th align="right">Volume</Th>
                    <Th>Dernier dépôt</Th>
                    <Th last className="w-[36px]" />
                  </tr>
                </thead>
                <tbody>
                  {byClient.map((row, i) => {
                    const name = row.client ? clientFullName(row.client) : 'Client à attribuer';
                    return (
                      <tr key={`${row.client?.user_id ?? 'none'}-${row.location}-${i}`} onClick={() => row.client ? navigate(`/m/clients/${row.client.user_id}/parcels`) : setQueue('pending')} className="cursor-pointer transition-colors hover:bg-muted/40">
                        <Td first>
                          <div className="flex items-center gap-2.5">
                            <Holder size="sm" tone={row.client ? 'neutral' : 'pending'}>{row.client ? initials(name) : '?'}</Holder>
                            <div>
                              <div className={cn('text-[13px] font-semibold', TEXT.strong)}>{name}</div>
                              {row.client && <div className={cn('font-mono text-[11.5px]', TEXT.muted)}>{row.client.customer_code}{row.client.city ? ` · ${row.client.city}` : ''}</div>}
                            </div>
                          </div>
                        </Td>
                        <Td><span className="inline-flex items-center gap-1.5 text-[12.5px]"><LocationMark location={row.location} size={18} />{row.location === 'warehouse' ? 'Entrepôt' : 'Bureau'}</span></Td>
                        <Td align="right"><span className="text-[13px] font-semibold tabular-nums">{row.parcels}</span></Td>
                        <Td align="right"><span className="text-[13px] tabular-nums">{formatKg(row.weight_kg)}</span></Td>
                        <Td align="right"><span className="text-[13px] tabular-nums">{formatCbm(row.cbm)}</span></Td>
                        <Td><span className={cn('text-[12.5px] tabular-nums', TEXT.muted)}>{formatDateTime(row.last_at)}</span></Td>
                        <Td last><ChevronRight className={cn('h-4 w-4', TEXT.muted)} /></Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>

          <Card className="overflow-hidden p-0">
            <CardHeader
              title={
                <span className="flex items-center gap-3">
                  Réceptions
                  <span className="flex items-center gap-1.5">
                    {(['today', 'week', 'month'] as Period[]).map((p) => (
                      <button key={p} type="button" onClick={() => setPeriod(p)} className={cn('rounded-md px-2 py-0.5 text-[11.5px] font-semibold', period === p ? 'bg-foreground text-background' : cn('hover:bg-muted', TEXT.muted))}>
                        {p === 'today' ? "Aujourd'hui" : p === 'week' ? '7 jours' : '30 jours'}
                      </button>
                    ))}
                  </span>
                </span>
              }
              meta={
                <span className="flex items-center gap-1.5">
                  <Chip label="Tous" count={counts.all} active={queue === 'all'} onClick={() => setQueue('all')} />
                  <Chip label="À attribuer" count={counts.pending || null} active={queue === 'pending'} onClick={() => setQueue('pending')} />
                  <Chip label="Incomplets" count={counts.incomplete || null} active={queue === 'incomplete'} onClick={() => setQueue('incomplete')} />
                </span>
              }
            />
            {overview.isLoading ? <ScreenLoader /> : deposits.length === 0 ? (
              <p className={cn('px-5 py-8 text-center text-[13px]', TEXT.muted)}>Aucune réception sur cette période.</p>
            ) : (
              <table className="w-full text-left">
                <thead className={SURFACE.card}>
                  <tr>
                    <Th first>N°</Th>
                    <Th>Date</Th>
                    <Th>Client</Th>
                    <Th>Apporté par</Th>
                    <Th align="right">Colis</Th>
                    <Th align="right">Poids</Th>
                    <Th align="right">Volume</Th>
                    <Th>Reçu par</Th>
                    <Th>État</Th>
                    <Th last className="w-[36px]" />
                  </tr>
                </thead>
                <tbody>
                  {deposits.map((d) => {
                    const st = labels.status(d);
                    return (
                      <tr key={d.id} onClick={() => navigate(`/m/cargo/reception/${d.id}`)} className={cn('cursor-pointer transition-colors hover:bg-muted/40', depositId === d.id && 'bg-accent')}>
                        <Td first><span className="inline-flex items-center gap-2"><LocationMark location={d.location} size={18} /><span className={cn('font-mono text-[12px] font-bold', TEXT.strong)}>{d.deposit_no}</span></span></Td>
                        <Td><span className={cn('text-[12.5px] tabular-nums', TEXT.muted)}>{formatDateTime(d.closed_at ?? d.opened_at)}</span></Td>
                        <Td>
                          <div className={cn('text-[13px] font-semibold', d.client ? TEXT.strong : 'text-amber-700 dark:text-amber-400')}>{d.client ? clientFullName(d.client) : 'Client à attribuer'}</div>
                          {d.client && <div className={cn('font-mono text-[11.5px]', TEXT.muted)}>{d.client.customer_code}</div>}
                        </Td>
                        <Td><span className="text-[12.5px]">{labels.broughtBy(d.brought_by)}</span></Td>
                        <Td align="right"><span className="text-[13px] font-semibold tabular-nums">{d.parcels.length}</span></Td>
                        <Td align="right"><span className="text-[13px] tabular-nums">{formatKg(d.total_weight_kg)}</span></Td>
                        <Td align="right"><span className="text-[13px] tabular-nums">{formatCbm(d.total_cbm)}</span></Td>
                        <Td><span className="text-[12.5px]">{d.received_by_name ?? '—'}</span></Td>
                        <Td><StatusPill tone={st.tone} label={st.label} /></Td>
                        <Td last><ChevronRight className={cn('h-4 w-4', TEXT.muted)} /></Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <Card className="overflow-hidden p-0">
          <CardHeader title="Par réceptionnaire" meta={period === 'today' ? "aujourd'hui" : period === 'week' ? '7 jours' : '30 jours'} />
          {overview.isLoading ? <ScreenLoader /> : staff.length === 0 ? (
            <p className={cn('px-5 py-8 text-center text-[13px]', TEXT.muted)}>Aucune réception sur cette période.</p>
          ) : (
            <ul>
              {staff.map((r) => (
                <li key={r.received_by} className="flex items-start gap-3 border-t border-black/[0.05] px-5 py-3.5 first:border-t-0 dark:border-white/[0.05]">
                  <Holder size="md">{initials(r.name || '?')}</Holder>
                  <div className="min-w-0 flex-1">
                    <div className={cn('text-[13px] font-bold', TEXT.strong)}>{r.name || 'Réceptionnaire'}</div>
                    <div className={cn('mt-0.5 text-[12px] tabular-nums', TEXT.muted)}>{r.deposits} dépôts · {r.parcels} colis</div>
                    <div className={cn('text-[12px] tabular-nums', TEXT.muted)}>{formatKg(r.weight_kg)} · {formatCbm(r.cbm)}</div>
                    {(Number(r.incomplete) > 0 || Number(r.pending) > 0) && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {Number(r.incomplete) > 0 && <StatusPill tone="pending" label={`${r.incomplete} incomplets`} />}
                        {Number(r.pending) > 0 && <StatusPill tone="danger" label={`${r.pending} à attribuer`} />}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <DepositQuickView depositId={depositId ?? null} onClose={() => navigate('/m/cargo/reception')} />
    </div>
  );
}
