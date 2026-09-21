// ============================================================
// ENTREPÔT — Accueil. Deux gestes, et rien d'autre à décider : « Pointer une
// arrivée » (avec ce qui reste à pointer) et « Remettre à un client » (avec
// qui attend). En dessous, la journée en quatre chiffres et ce qui a été
// remis aujourd'hui. Les listes détaillées vivent sur leurs propres écrans.
// ============================================================
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, HelpCircle, LogOut, PackageCheck, ScanLine } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useWarehouseDay } from '@/hooks/useWarehouse';
import { clientFullName } from '@/lib/reception';
import { nParcels } from '@/lib/warehouse';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Card, IconButton, ScreenLoader, StatCard } from '@/mobile/designKit';
import { formatTime } from '@/mobile/components/reception/bits';
import { HowItWorks } from '@/mobile/components/warehouse/bits';

/** Un grand geste : une icône, le verbe, et ce qui attend derrière. */
function Gesture({ icon: Icon, title, sub, onClick, count }: { icon: React.ElementType; title: string; sub: string; onClick: () => void; count: number }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-[80px] w-full items-center gap-4 rounded-lg bg-[#2C2C2C] px-4 py-3 text-left text-[#F5F5F5] transition-colors active:bg-[#1E1E1E] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 dark:bg-black/10"><Icon className="h-6 w-6" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[18px] font-semibold leading-snug">{title}</span>
        <span className="mt-0.5 block text-[14px] leading-snug opacity-80">{sub}</span>
      </span>
      {count > 0 && <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full bg-[#E8B931] px-2 text-[15px] font-bold tabular-nums text-[#401B01]">{count}</span>}
      <ChevronRight className="h-5 w-5 shrink-0 opacity-70" />
    </button>
  );
}

export function WarehouseHome() {
  const navigate = useNavigate();
  const { currentUser, logout, hasPermission } = useAdminAuth();
  const { data, isLoading } = useWarehouseDay();
  const [helpOpen, setHelpOpen] = useState(false);
  const firstName = currentUser?.firstName || '';
  const s = data?.stats;
  const waiting = data?.waiting_by_client.length ?? 0;

  return (
    <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
      <header className="flex items-start justify-between gap-4 px-5 pb-2 pt-[calc(1.25rem+env(safe-area-inset-top))]">
        <div className="min-w-0">
          <h1 className={cn(TYPE.heading, TEXT.strong)}>Bonjour{firstName ? `, ${firstName}` : ''}</h1>
          <p className={cn('mt-1', TYPE.small, TEXT.muted)}>Entrepôt de Douala · {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <IconButton icon={LogOut} ariaLabel="Se déconnecter" onClick={() => { void logout(); navigate('/w/login', { replace: true }); }} />
      </header>

      <div className="space-y-6 px-4 pb-10 pt-3">
        <div className="space-y-3">
          {hasPermission('canReceiveAtDestination') && (
            <Gesture icon={PackageCheck} title="Pointer une arrivée" sub={s ? (s.to_checkin > 0 ? `${nParcels(s.to_checkin)} à pointer` : 'Tout est pointé') : 'Un avion ou une boîte est arrivé'} count={s?.to_checkin ?? 0} onClick={() => navigate('/w/arrivees')} />
          )}
          {hasPermission('canReleaseParcels') && (
            <Gesture icon={ScanLine} title="Remettre à un client" sub={data ? (waiting > 0 ? `${waiting} client${waiting > 1 ? 's' : ''} attend${waiting > 1 ? 'ent' : ''} ${waiting > 1 ? 'leurs' : 'ses'} colis` : 'Personne n\'attend') : 'Scannez son code'} count={waiting} onClick={() => navigate('/w/remise')} />
          )}
          <button type="button" onClick={() => setHelpOpen(true)} className={cn('flex h-10 w-full items-center justify-center gap-2', TYPE.smallStrong, TEXT.muted)}>
            <HelpCircle className="h-4 w-4" /> Comment ça marche
          </button>
        </div>

        {isLoading || !data || !s ? <ScreenLoader /> : (
          <>
            <section>
              <h2 className={cn('mb-3', TYPE.lead, TEXT.strong)}>Aujourd'hui</h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="À pointer" value={s.to_checkin} tone={s.to_checkin > 0 ? 'pending' : 'neutral'} onClick={() => navigate('/w/arrivees')} />
                <StatCard label="Attendent leur client" value={s.waiting} onClick={() => navigate('/w/remise/liste')} />
                <StatCard label="Remis aujourd'hui" value={s.delivered_today} tone="success" />
                <StatCard label="Manquants" value={s.missing} tone={s.missing > 0 ? 'danger' : 'neutral'} />
              </div>
            </section>

            <section>
              <h2 className={cn('mb-2', TYPE.lead, TEXT.strong)}>Remis aujourd'hui</h2>
              {data.releases_today.length === 0 ? (
                <Card className={cn('text-center', SURFACE.inset, 'border-0')}><p className={cn(TYPE.body, TEXT.muted)}>Rien de remis pour l'instant. Chaque bon de retrait s'affichera ici.</p></Card>
              ) : (
                <Card className="py-0 [&>*]:border-b [&>*]:border-[#D9D9D9] [&>*:last-child]:border-b-0 dark:[&>*]:border-[#444444]">
                  {data.releases_today.map((r) => (
                    <button key={r.id} type="button" onClick={() => navigate(`/w/bon/${r.id}`)} className="flex w-full items-center gap-3 py-3 text-left">
                      <span className="min-w-0 flex-1">
                        <span className={cn('block break-words', TYPE.bodyStrong, TEXT.strong)}>{r.client ? clientFullName(r.client) : r.picked_by_name}</span>
                        <span className={cn('block tabular-nums', TYPE.small, TEXT.muted)}>{r.release_no} · {nParcels(r.parcel_count)} · {formatTime(r.released_at)}{r.client && r.picked_by_name !== clientFullName(r.client) ? ` · emportés par ${r.picked_by_name}` : ''}</span>
                      </span>
                      <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
                    </button>
                  ))}
                </Card>
              )}
            </section>
          </>
        )}
      </div>
      <HowItWorks open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
