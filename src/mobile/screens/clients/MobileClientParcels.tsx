// ============================================================
// Mobile admin — fiche client › ses colis reçus, dépôt par dépôt, avec où
// en est chaque colis : à l'entrepôt, ou chargé dans telle boîte. C'est
// aussi ce que le client verra dans son app. En tête, le RELEVÉ DES COLIS en
// PDF (à Guangzhou, en route, à Douala, ce qui reste à payer), à télécharger
// ou à partager sur WhatsApp — la réponse à « quels sont mes colis chez vous ? ».
// ============================================================
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Download, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { deliverClientStatementPdf, downloadClientStatementPdf } from '@/lib/clientStatementPdf';
import { canShareFiles, prefersDownload } from '@/components/customer-code/exportShippingLabel';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useClientDeposits } from '@/hooks/useReception';
import { clientFullName, depositStage, formatCbm, formatKg } from '@/lib/reception';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Button, Card, ScreenLoader, StatCard, StatusPill } from '@/mobile/designKit';
import { LocationMark, formatDateTime } from '@/mobile/components/reception/bits';

export function MobileClientParcels() {
  const navigate = useNavigate();
  const { clientId } = useParams<{ clientId: string }>();
  const { hasPermission } = useAdminAuth();
  const { data: deposits, isLoading } = useClientDeposits(clientId);
  const [busy, setBusy] = useState<'dl' | 'share' | null>(null);
  const canShare = canShareFiles() && !prefersDownload();
  const statement = async (how: 'dl' | 'share') => {
    if (!deposits || busy) return;
    setBusy(how);
    try {
      if (how === 'dl') { await downloadClientStatementPdf(deposits); toast.success('Relevé des colis téléchargé'); }
      else if ((await deliverClientStatementPdf(deposits)) === 'downloaded') toast.success('Relevé des colis téléchargé');
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };

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

        {parcels.length > 0 && (
          <Card className="space-y-3">
            <span className="block">
              <span className={cn('block', TYPE.bodyStrong, TEXT.strong)}>Relevé des colis</span>
              <span className={cn('block', TYPE.small, TEXT.muted)}>Tout ce qui est encore chez nous — à Guangzhou, en route, à Douala — avec les photos, et ce qui reste à payer.</span>
            </span>
            <div className="flex gap-2">
              <Button variant="neutral" onClick={() => void statement('dl')} loading={busy === 'dl'} disabled={busy != null} className="min-h-12 flex-1"><Download /> Télécharger (PDF)</Button>
              {canShare && <Button variant="neutral" onClick={() => void statement('share')} loading={busy === 'share'} disabled={busy != null} ariaLabel="Partager le relevé (WhatsApp, WeChat…)" className="min-h-12 w-12 shrink-0 px-0"><Share2 /></Button>}
            </div>
          </Card>
        )}

        {deposits.length === 0 ? (
          <Card className={cn('text-center', SURFACE.inset, 'border-0')}>
            <p className={cn(TYPE.body, TEXT.muted)}>Aucun colis reçu pour ce client.</p>
          </Card>
        ) : (
          deposits.map((d) => {
            const st = depositStage(d.parcels, d.location);
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
