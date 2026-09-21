// ============================================================
// ENTREPÔT — Accueil. Deux gestes : « Pointer une arrivée » et « Remettre
// à un client ». En dessous, la journée : ce qui reste à pointer, ce qui
// attend son client (avec « à encaisser » quand le devis n'est pas soldé),
// ce qui a été remis aujourd'hui.
// ============================================================
import { useNavigate } from 'react-router-dom';
import { ChevronRight, LogOut, PackageCheck, Plane, ScanLine, Ship } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useWarehouseDay } from '@/hooks/useWarehouse';
import { clientFullName, formatKg, initials } from '@/lib/reception';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Card, Holder, IconButton, PrimaryPill, ScreenLoader, SoftPill, StatCard, StatusPill } from '@/mobile/designKit';
import { formatDateTime, formatTime } from '@/mobile/components/reception/bits';

export function WarehouseHome() {
  const navigate = useNavigate();
  const { currentUser, logout, hasPermission } = useAdminAuth();
  const { data, isLoading } = useWarehouseDay();
  const firstName = currentUser?.firstName || '';
  const s = data?.stats;

  return (
    <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
      <header className="flex items-center justify-between px-5 pb-2 pt-5">
        <div>
          <h1 className={cn(TYPE.heading, TEXT.strong)}>Bonjour{firstName ? `, ${firstName}` : ''}</h1>
          <p className={cn(TYPE.small, TEXT.muted)}>Entrepôt de Douala · {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <IconButton icon={LogOut} variant="subtle" ariaLabel="Se déconnecter" onClick={() => { void logout(); navigate('/w/login', { replace: true }); }} />
      </header>

      <div className="space-y-6 px-4 pb-10 pt-3">
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          {hasPermission('canReceiveAtDestination') && (
            <PrimaryPill onClick={() => navigate('/w/arrivees')} className="h-16 w-full text-[17px]"><PackageCheck /> Pointer une arrivée</PrimaryPill>
          )}
          {hasPermission('canReleaseParcels') && (
            <PrimaryPill onClick={() => navigate('/w/remise')} className="h-16 w-full text-[17px]"><ScanLine /> Remettre à un client</PrimaryPill>
          )}
        </div>

        {isLoading || !data ? <ScreenLoader /> : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="À pointer" value={s!.to_checkin} hint="arrivés, pas encore vus" tone={s!.to_checkin > 0 ? 'pending' : 'neutral'} onClick={() => navigate('/w/arrivees')} />
              <StatCard label="Attendent leur client" value={s!.waiting} hint="pointés, pas remis" />
              <StatCard label="Remis aujourd'hui" value={s!.delivered_today} tone="success" />
              <StatCard label="Manquants" value={s!.missing} tone={s!.missing > 0 ? 'danger' : 'neutral'} hint={s!.missing > 0 ? 'signalés à Guangzhou' : undefined} />
            </div>

            {data.arrivals.length > 0 && (
              <section>
                <h2 className={cn('mb-2', TYPE.lead, TEXT.strong)}>Ce qui est arrivé</h2>
                <Card className="py-0 [&>*]:border-b [&>*]:border-[#D9D9D9] [&>*:last-child]:border-b-0 dark:[&>*]:border-[#444444]">
                  {data.arrivals.map((a) => {
                    const left = a.expected - a.checked;
                    return (
                      <button key={`${a.kind}-${a.id}`} type="button" onClick={() => navigate(`/w/arrivees/${a.kind}/${a.id}`)} className="flex w-full items-center gap-3 py-3 text-left">
                        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white', a.kind === 'air' ? 'bg-[#C8102E]' : 'bg-[#0B5FA5]')}>{a.kind === 'air' ? <Plane className="h-5 w-5" /> : <Ship className="h-5 w-5" />}</span>
                        <span className="min-w-0 flex-1">
                          <span className={cn('block tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{a.label}</span>
                          <span className={cn('block', TYPE.small, TEXT.muted)}>{a.sub}{a.arrived_at ? ` · ${formatDateTime(a.arrived_at)}` : ''}</span>
                        </span>
                        {left > 0 ? <StatusPill tone="pending" label={`${left} à pointer`} /> : <StatusPill tone="success" label="Tout pointé" />}
                        <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
                      </button>
                    );
                  })}
                </Card>
              </section>
            )}

            <section>
              <h2 className={cn('mb-2', TYPE.lead, TEXT.strong)}>Attendent leur client</h2>
              {data.waiting_by_client.length === 0 ? (
                <p className={cn(TYPE.body, TEXT.muted)}>Rien n'attend : tout ce qui a été pointé a été remis.</p>
              ) : (
                <Card className="py-0 [&>*]:border-b [&>*]:border-[#D9D9D9] [&>*:last-child]:border-b-0 dark:[&>*]:border-[#444444]">
                  {data.waiting_by_client.map((w) => {
                    const name = w.client ? clientFullName(w.client) : 'Client à attribuer';
                    return (
                      <button key={w.client?.user_id ?? 'none'} type="button" disabled={!w.client} onClick={() => w.client && navigate(`/w/remise/${w.client.customer_code}`)} className="flex w-full items-center gap-3 py-3 text-left">
                        <Holder size="md" tone={w.client ? 'neutral' : 'pending'}>{w.client ? initials(name) : '?'}</Holder>
                        <span className="min-w-0 flex-1">
                          <span className={cn('block', TYPE.bodyStrong, TEXT.strong)}>{name}</span>
                          <span className={cn('block tabular-nums', TYPE.small, TEXT.muted)}>{w.client?.customer_code ? `${w.client.customer_code} · ` : ''}{w.parcels} colis · {formatKg(w.weight_kg)} · depuis le {formatDateTime(w.since).slice(0, 5)}</span>
                        </span>
                        {w.unpaid ? <StatusPill tone="pending" label="À encaisser" /> : <StatusPill tone="success" label="Payé" />}
                        <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
                      </button>
                    );
                  })}
                </Card>
              )}
            </section>

            {data.releases_today.length > 0 && (
              <section>
                <h2 className={cn('mb-2', TYPE.lead, TEXT.strong)}>Remis aujourd'hui</h2>
                <Card className="py-0 [&>*]:border-b [&>*]:border-[#D9D9D9] [&>*:last-child]:border-b-0 dark:[&>*]:border-[#444444]">
                  {data.releases_today.map((r) => (
                    <button key={r.id} type="button" onClick={() => navigate(`/w/bon/${r.id}`)} className="flex w-full items-center gap-3 py-3 text-left">
                      <span className="min-w-0 flex-1">
                        <span className={cn('block', TYPE.bodyStrong, TEXT.strong)}>{r.client ? clientFullName(r.client) : r.picked_by_name}</span>
                        <span className={cn('block tabular-nums', TYPE.small, TEXT.muted)}>{r.release_no} · {r.parcel_count} colis · {formatTime(r.released_at)}{r.client && r.picked_by_name !== clientFullName(r.client) ? ` · emportés par ${r.picked_by_name}` : ''}</span>
                      </span>
                      <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
                    </button>
                  ))}
                </Card>
              </section>
            )}
            <SoftPill onClick={() => navigate('/w/remise')} className="h-12 w-full text-[16px]"><ScanLine /> Chercher un client ou un colis</SoftPill>
          </>
        )}
      </div>
    </div>
  );
}
