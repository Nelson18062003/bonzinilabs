// ============================================================
// ENTREPÔT — Journée (refonte v2, maquette 04/14). Le chiffre du jour (les
// colis à pointer, ceux qui attendent leur client, les manquants), quatre
// gros ronds — Pointer · Scanner · Remettre · Bons —, puis les arrivées
// (conteneur, vols) avec ce qui reste à pointer. Les bons du jour s'ouvrent
// en feuille ; « Comment ça marche » par le rond « ? » ; la déconnexion est
// dans Plus.
// ============================================================
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, HandHelping, HelpCircle, Plane, ScanLine, Ship, SquareCheckBig } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useWarehouseDay } from '@/hooks/useWarehouse';
import { clientFullName } from '@/lib/reception';
import { nParcels, type WarehouseArrival } from '@/lib/warehouse';
import { cn } from '@/lib/utils';
import {
  ActionCircles, BottomSheet, EmptyLine, HeroFigure, IconCircle, ItemList, ItemRow, RoundButton, ScreenLoader, SectionHead, SURFACE, TabTop, type CircleAction, type Tone,
} from '@/mobile/designKit';
import { formatTime } from '@/mobile/components/reception/bits';
import { HowItWorks } from '@/mobile/components/warehouse/bits';

/** L'état d'une arrivée : attendue (pas encore là), en cours de pointage, pointée. */
export function arrivalTag(a: WarehouseArrival): { tone: Tone; label: string } {
  if (!a.arrived_at) return { tone: 'neutral', label: 'Attendu' };
  if (a.expected - a.checked - a.missing <= 0) return { tone: 'success', label: 'Pointé' };
  return { tone: 'pending', label: 'En cours' };
}

export function WarehouseHome() {
  const navigate = useNavigate();
  const { currentUser, hasPermission } = useAdminAuth();
  const { data, isLoading } = useWarehouseDay();
  const [helpOpen, setHelpOpen] = useState(false);
  const [bonsOpen, setBonsOpen] = useState(false);
  const firstName = currentUser?.firstName || '';
  const s = data?.stats;
  const canCheck = hasPermission('canReceiveAtDestination');
  const canRelease = hasPermission('canReleaseParcels');

  const actions: CircleAction[] = [];
  if (canCheck) actions.push({ label: 'Pointer', icon: SquareCheckBig, onClick: () => navigate('/w/arrivees'), primary: true });
  actions.push({ label: 'Scanner', icon: ScanLine, onClick: () => navigate('/w/remise'), primary: !canCheck && actions.length === 0 });
  if (canRelease) actions.push({ label: 'Remettre', icon: HandHelping, onClick: () => navigate('/w/remise/liste'), primary: false });
  actions.push({ label: 'Bons', icon: FileText, onClick: () => setBonsOpen(true), primary: false, badge: data?.releases_today.length ?? 0 });

  return (
    <div className={cn('flex min-h-[100dvh] flex-col pb-6', SURFACE.canvas)}>
      <TabTop title={`Bonjour${firstName ? ` ${firstName}` : ''}`} right={<RoundButton icon={HelpCircle} ariaLabel="Comment ça marche" onClick={() => setHelpOpen(true)} />} />

      <div className="px-5 pt-3.5">
        <HeroFigure
          label="À pointer"
          value={isLoading || !s ? '—' : s.to_checkin}
          unit="colis"
          sub={s ? [
            <><b className="font-bold">{s.waiting}</b> attendent leur client</>,
            <><b className="font-bold">{s.missing}</b> manquant{s.missing > 1 ? 's' : ''}</>,
          ] : undefined}
          onClick={canCheck ? () => navigate('/w/arrivees') : undefined}
        />
      </div>

      <ActionCircles actions={actions} />

      <SectionHead title="Arrivées" />
      {isLoading || !data ? <ScreenLoader /> : data.arrivals.length === 0 ? (
        <EmptyLine>Rien n'est arrivé.</EmptyLine>
      ) : (
        <ItemList>
          {data.arrivals.map((a) => (
            <ItemRow
              key={`${a.kind}-${a.id}`}
              leading={<IconCircle icon={a.kind === 'air' ? Plane : Ship} />}
              title={a.label}
              subtitle={a.sub ?? nParcels(a.expected)}
              amount={a.arrived_at ? `${a.checked} / ${a.expected}` : undefined}
              tag={arrivalTag(a)}
              onClick={canCheck ? () => navigate(`/w/arrivees/${a.kind}/${a.id}`) : undefined}
            />
          ))}
        </ItemList>
      )}

      {/* Les bons du jour : ce qui a été remis, et à qui. */}
      <BottomSheet open={bonsOpen} onClose={() => setBonsOpen(false)} title="Remis aujourd'hui">
        {!data || data.releases_today.length === 0 ? <p className="py-3 text-[16px] text-[#5A5A5A]">Rien de remis pour l'instant.</p> : (
          <div>
            {data.releases_today.map((r) => (
              <ItemRow
                key={r.id}
                leading={<IconCircle icon={FileText} />}
                title={r.client ? clientFullName(r.client) : r.picked_by_name}
                subtitle={`${r.release_no} · ${nParcels(r.parcel_count)} · ${formatTime(r.released_at)}${r.client && r.picked_by_name !== clientFullName(r.client) ? ` · ${r.picked_by_name}` : ''}`}
                onClick={() => { setBonsOpen(false); navigate(`/w/bon/${r.id}`); }}
                chevron
              />
            ))}
          </div>
        )}
      </BottomSheet>
      <HowItWorks open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
