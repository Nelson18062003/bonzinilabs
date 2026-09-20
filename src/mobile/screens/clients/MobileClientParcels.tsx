// ============================================================
// Mobile admin — fiche client › ses colis reçus, dépôt par dépôt, avec où
// en est chaque colis : à l'entrepôt, ou chargé dans telle boîte. C'est
// aussi ce que le client verra dans son app.
// ============================================================
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useClientDeposits } from '@/hooks/useReception';
import { clientFullName, depositStage, formatCbm, formatKg } from '@/lib/reception';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Card, ScreenLoader, StatCard, StatusPill } from '@/mobile/designKit';
import { LocationMark, formatDateTime } from '@/mobile/components/reception/bits';

export function MobileClientParcels() {
  const navigate = useNavigate();
  const { clientId } = useParams<{ clientId: string }>();
  const { hasPermission } = useAdminAuth();
  const { data: deposits, isLoading } = useClientDeposits(clientId);

  if (!hasPermission('canViewCargo') && !hasPermission('canViewClients')) return <Navigate to="/m" replace />;
  if (isLoading || !deposits) return <ScreenLoader className="min-h-[100dvh]" />;

  const client = deposits.find((d) => d.client)?.client ?? null;
  const parcels = deposits.flatMap((d) => d.parcels);
  const waiting = parcels.filter((p) => !p.shipment_id);
  const kg = parcels.reduce((s, p) => s + Number(p.weight_kg ?? 0), 0);
  const cbm = parcels.reduce((s, p) => s + Number(p.cbm ?? 0), 0);

  return (
    <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
      <MobileHeader title="Colis reçus" subtitle={client ? clientFullName(client) : undefined} showBack backTo={`/m/clients/${clientId}`} />
      <div className="space-y-6 px-4 pb-10 pt-4">
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Colis" value={parcels.length} hint={waiting.length > 0 ? `${waiting.length} à l'entrepôt` : undefined} />
          <StatCard label="Poids" value={formatKg(kg)} />
          <StatCard label="Volume" value={formatCbm(cbm)} />
        </div>

        {deposits.length === 0 ? (
          <Card className={cn('text-center', SURFACE.inset, 'border-0')}>
            <p className={cn(TYPE.body, TEXT.muted)}>Aucun colis reçu pour ce client.</p>
          </Card>
        ) : (
          deposits.map((d) => {
            const st = depositStage(d.parcels);
            return (
              <button key={d.id} type="button" onClick={() => navigate(`/m/cargo/reception/${d.id}`)} className={cn('block w-full rounded-lg p-4 text-left', SURFACE.card, SURFACE.shadow)}>
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 whitespace-nowrap"><LocationMark location={d.location} size={26} /><span className={cn('tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{d.deposit_no}</span></span>
                  <StatusPill tone={st.tone} label={st.label} className="h-7 text-[14px]" />
                </span>
                <span className={cn('mt-2 block tabular-nums', TYPE.body, TEXT.strong)}>{d.parcels.length} colis · {formatKg(d.total_weight_kg)} · {formatCbm(d.total_cbm)}</span>
                <span className={cn('mt-1 block', TYPE.small, TEXT.muted)}>{formatDateTime(d.closed_at ?? d.opened_at)}{d.received_by_name ? ` · reçu par ${d.received_by_name}` : ''}</span>
                {d.parcels.some((p) => p.description) && (
                  <span className={cn('mt-1 block truncate', TYPE.small, TEXT.muted)}>{d.parcels.map((p) => p.description).filter(Boolean).slice(0, 3).join(' · ')}</span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
