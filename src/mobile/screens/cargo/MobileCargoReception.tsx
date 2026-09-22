// ============================================================
// Mobile admin — Cargo › Réception : la deuxième partie du module.
//
// La réception vit DANS Cargo, à côté de Container : c'est le début de la
// chaîne, avant la boîte. Le sélecteur en haut passe de l'une à l'autre.
// Trois choses, dans l'ordre où le fondateur les regarde :
//   1. ce qui ATTEND à l'entrepôt et au bureau (reçu, pas encore chargé),
//      par client — c'est ce qu'il reste à mettre dans un conteneur ;
//   2. ce qui reste à ATTRIBUER (colis orphelins) ;
//   3. le TRAVAIL de chaque réceptionnaire sur la période, puis les dépôts.
// ============================================================
import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ChevronRight, HelpCircle, Users } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useReceptionOverview, useReceptionStock } from '@/hooks/useReception';
import { useWarehouseDay } from '@/hooks/useWarehouse';
import { clientFullName, formatCbm, formatKg, initials, type ReceptionLocation } from '@/lib/reception';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Card, Holder, ScreenLoader, Segmented, StatCard, StatusPill } from '@/mobile/designKit';
import { DepositRow, LocationMark } from '@/mobile/components/reception/bits';
import { MobileCargoParts } from '@/components/cargo/CargoParts';

type Period = 'today' | 'week' | 'month';
const PERIOD_LABEL: Record<Period, string> = { today: "Aujourd'hui", week: '7 jours', month: '30 jours' };

function periodRange(p: Period): { from: Date; to: Date } {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  if (p === 'week') from.setDate(from.getDate() - 6);
  if (p === 'month') from.setDate(from.getDate() - 29);
  return { from, to };
}

export function MobileCargoReception() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const [period, setPeriod] = useState<Period>('week');
  const [where, setWhere] = useState<'all' | ReceptionLocation>('all');
  const range = useMemo(() => periodRange(period), [period]);
  const stock = useReceptionStock(where === 'all' ? null : where);
  const overview = useReceptionOverview(range.from, range.to);
  const seesDouala = hasPermission('canReleaseParcels') || hasPermission('canReceiveAtDestination');
  const douala = useWarehouseDay(seesDouala);

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;

  const stats = stock.data?.stats;
  const byClient = stock.data?.by_client ?? [];
  const pendingDeposits = (overview.data?.deposits ?? []).filter((d) => !d.client);
  const deposits = overview.data?.deposits ?? [];
  const staff = overview.data?.by_receptionist ?? [];

  return (
    <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
      <MobileHeader title="Cargo" subtitle={stats ? `${stats.parcels} colis à l'entrepôt · ${formatCbm(stats.cbm)}${stats.pending > 0 ? ` · ${stats.pending} à attribuer` : ''}` : 'Réception des colis'} />
      <MobileCargoParts active="reception" />

      <div className="space-y-6 px-4 pb-10 pt-4">
        {/* 1 · Ce qui attend */}
        <section className="space-y-3">
          <Segmented
            value={where}
            onChange={setWhere}
            options={[
              { value: 'all', label: 'Partout' },
              { value: 'warehouse', label: <span className="inline-flex items-center gap-2"><LocationMark location="warehouse" size={22} />Entrepôt</span> },
              { value: 'office', label: <span className="inline-flex items-center gap-2"><LocationMark location="office" size={22} />Bureau</span> },
            ]}
          />
          {stock.isLoading || !stats ? (
            <ScreenLoader />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Colis qui attendent" value={stats.parcels} hint="reçus, pas encore chargés" />
              <StatCard label="Clients" value={stats.clients} hint="avec de la marchandise ici" />
              <StatCard label="Poids" value={formatKg(stats.weight_kg)} />
              <StatCard label="Volume" value={formatCbm(stats.cbm)} hint="à mettre en boîte" />
            </div>
          )}
          {byClient.length > 0 && (
            <Card className="py-0">
              {byClient.map((row, i) => {
                const name = row.client ? clientFullName(row.client) : 'Client à attribuer';
                return (
                  <button
                    key={`${row.client?.user_id ?? 'none'}-${row.location}-${i}`}
                    type="button"
                    onClick={() => row.client ? navigate(`/m/clients/${row.client.user_id}/parcels`) : pendingDeposits[0] && navigate(`/m/cargo/reception/${pendingDeposits[0].id}`)}
                    className={cn('flex w-full items-center gap-4 border-b py-4 text-left last:border-b-0', SURFACE.divider)}
                  >
                    <Holder size="lg" tone={row.client ? 'neutral' : 'pending'}>{row.client ? initials(name) : '?'}</Holder>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate', TYPE.bodyStrong, TEXT.strong)}>{name}</span>
                      <span className={cn('mt-0.5 flex items-center gap-2 tabular-nums', TYPE.small, TEXT.muted)}>
                        <LocationMark location={row.location} size={18} />
                        {row.parcels} colis · {formatKg(row.weight_kg)} · {formatCbm(row.cbm)}
                      </span>
                    </span>
                    <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
                  </button>
                );
              })}
            </Card>
          )}
        </section>

        {/* 1 ter · Les comptes : les gros clients qui chargent leurs propres conteneurs */}
        <button type="button" onClick={() => navigate('/m/cargo/comptes')} className={cn('flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left', SURFACE.inset)}>
          <Users className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
          <span className={cn('min-w-0 flex-1', TYPE.bodyStrong, TEXT.strong)}>Comptes cargo <span className={cn('font-normal', TEXT.muted)}>· PRC, Simon D1… et leurs clients</span></span>
          <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
        </button>

        {/* 1 bis · Douala : l'autre bout de la chaîne, pour qui peut y agir */}
        {seesDouala && douala.data && (
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className={cn(TYPE.lead, TEXT.strong)}>À Douala</h2>
              <button type="button" onClick={() => navigate('/w')} className={cn('text-[16px] font-semibold', TEXT.strong)}>Ouvrir l'app</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="À pointer" value={douala.data.stats.to_checkin} tone={douala.data.stats.to_checkin > 0 ? 'pending' : 'neutral'} />
              <StatCard label="Attendent leur client" value={douala.data.stats.waiting} />
              <StatCard label="Remis aujourd'hui" value={douala.data.stats.delivered_today} tone="success" />
              <StatCard label="Manquants" value={douala.data.stats.missing} tone={douala.data.stats.missing > 0 ? 'danger' : 'neutral'} />
            </div>
            {douala.data.waiting_by_client.length > 0 && (
              <Card className="mt-3 py-0">
                {douala.data.waiting_by_client.slice(0, 5).map((w) => {
                  const name = w.client ? clientFullName(w.client) : 'Client à attribuer';
                  return (
                    <div key={w.client?.user_id ?? 'none'} className={cn('flex items-center gap-4 border-b py-3 last:border-b-0', SURFACE.divider)}>
                      <Holder size="md" tone={w.client ? 'neutral' : 'pending'}>{w.client ? initials(name) : '?'}</Holder>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block truncate', TYPE.bodyStrong, TEXT.strong)}>{name}</span>
                        <span className={cn('block tabular-nums', TYPE.small, TEXT.muted)}>{w.parcels} colis · {formatKg(w.weight_kg)}</span>
                      </span>
                      {w.unpaid ? <StatusPill tone="pending" label="À encaisser" /> : <StatusPill tone="success" label="Payé" />}
                    </div>
                  );
                })}
              </Card>
            )}
          </section>
        )}

        {/* 2 · À attribuer */}
        {pendingDeposits.length > 0 && (
          <section>
            <div className="mb-2 flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-[#682D03] dark:text-[#FFF1C2]" />
              <h2 className={cn(TYPE.lead, TEXT.strong)}>À attribuer</h2>
              <StatusPill tone="pending" label={String(pendingDeposits.length)} className="h-7 text-[14px]" />
            </div>
            <Card className="py-0 [&>*]:border-b [&>*]:border-[#D9D9D9] [&>*:last-child]:border-b-0 dark:[&>*]:border-[#444444]">
              {pendingDeposits.map((d) => <DepositRow key={d.id} deposit={d} onClick={() => navigate(`/m/cargo/reception/${d.id}`)} />)}
            </Card>
          </section>
        )}

        {/* 3 · Le travail, sur la période */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className={cn(TYPE.lead, TEXT.strong)}>Réceptions</h2>
          </div>
          <Segmented value={period} onChange={setPeriod} options={(['today', 'week', 'month'] as Period[]).map((p) => ({ value: p, label: PERIOD_LABEL[p] }))} />
          {overview.isLoading ? (
            <ScreenLoader />
          ) : (
            <>
              {staff.length > 0 && (
                <Card className="py-0">
                  <div className={cn('py-3', TYPE.smallStrong, TEXT.muted)}>Par réceptionnaire</div>
                  {staff.map((r) => (
                    <div key={r.received_by} className={cn('flex items-center gap-4 border-t py-4', SURFACE.divider)}>
                      <Holder size="md">{initials(r.name || '?')}</Holder>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block', TYPE.bodyStrong, TEXT.strong)}>{r.name || 'Réceptionnaire'}</span>
                        <span className={cn('mt-0.5 block tabular-nums', TYPE.small, TEXT.muted)}>
                          {r.deposits} dépôts · {r.parcels} colis · {formatKg(r.weight_kg)} · {formatCbm(r.cbm)}
                        </span>
                        {(Number(r.incomplete) > 0 || Number(r.pending) > 0) && (
                          <span className="mt-2 flex flex-wrap gap-2">
                            {Number(r.incomplete) > 0 && <StatusPill tone="pending" label={`${r.incomplete} colis incomplets`} className="h-7 text-[14px]" />}
                            {Number(r.pending) > 0 && <StatusPill tone="danger" label={`${r.pending} à attribuer`} className="h-7 text-[14px]" />}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </Card>
              )}
              {deposits.length === 0 ? (
                <Card className={cn('text-center', SURFACE.inset, 'border-0')}>
                  <p className={cn(TYPE.body, TEXT.muted)}>Aucune réception sur cette période.</p>
                </Card>
              ) : (
                <Card className="py-0 [&>*]:border-b [&>*]:border-[#D9D9D9] [&>*:last-child]:border-b-0 dark:[&>*]:border-[#444444]">
                  {deposits.map((d) => <DepositRow key={d.id} deposit={d} onClick={() => navigate(`/m/cargo/reception/${d.id}`)} />)}
                </Card>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
