// ============================================================
// ENTREPÔT — C'est fait. Le bon de retrait : combien de colis, à qui, la
// signature, et « Bon de retrait (PDF) » à envoyer au client (WhatsApp).
// Le détail des colis est replié. « Client suivant » relance le scan.
// Un bon se rouvre depuis l'accueil (« Remis aujourd'hui »).
// ============================================================
import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Check, FileText, Home, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useRelease, useSignatureUrl } from '@/hooks/useWarehouse';
import { deliverReleaseNotePdf } from '@/lib/releaseNotePdf';
import { nParcels } from '@/lib/warehouse';
import { clientFullName, formatKg } from '@/lib/reception';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Card, Fold, PrimaryPill, Row, ScreenLoader, SoftPill } from '@/mobile/designKit';
import { formatDateTime } from '@/mobile/components/reception/bits';
import { ParcelLine } from '@/mobile/components/warehouse/bits';

async function toDataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = reject; r.readAsDataURL(blob); });
}

export function WarehouseReleaseDone() {
  const navigate = useNavigate();
  const { releaseId } = useParams<{ releaseId: string }>();
  const { state } = useLocation() as { state?: { signature?: string | null } };
  const { data: r, isLoading } = useRelease(releaseId);
  const { data: sigUrl } = useSignatureUrl(r?.signature_path);
  const [open, setOpen] = useState(false);
  if (isLoading || !r) return <ScreenLoader className="min-h-[100dvh]" />;
  const name = r.client ? clientFullName(r.client) : r.picked_by_name;
  const kg = r.parcels.reduce((s, p) => s + Number(p.weight_kg ?? 0), 0);
  const signature = state?.signature ?? sigUrl ?? null;

  const pdf = async () => {
    try {
      const sig = state?.signature ?? (sigUrl ? await toDataUrl(sigUrl).catch(() => null) : null);
      if ((await deliverReleaseNotePdf(r, sig)) === 'downloaded') toast.success('Bon de retrait téléchargé');
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
      <MobileHeader title={r.release_no} subtitle="Bon de retrait" showBack backTo="/w" />
      <div className="space-y-5 px-4 pb-10 pt-4">
        <div className="flex flex-col items-center py-4 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#14AE5C] text-white"><Check className="h-10 w-10" strokeWidth={3} /></span>
          <p className={cn('mt-4', TYPE.heading, TEXT.strong)}>{nParcels(r.parcel_count)} remis</p>
          <p className={cn('mt-1', TYPE.body, TEXT.muted)}>à {r.picked_by_name}{r.client && r.picked_by_name !== name ? ` pour ${name}` : ''} · {formatDateTime(r.released_at)}</p>
        </div>
        <PrimaryPill onClick={() => void pdf()} className="h-14 w-full text-[17px]"><FileText /> Bon de retrait (PDF)</PrimaryPill>
        <p className={cn('text-center', TYPE.small, TEXT.muted)}>À envoyer au client sur WhatsApp : c'est sa preuve.</p>
        {signature && (
          <Card className="space-y-2">
            <p className={cn(TYPE.small, TEXT.muted)}>Signature de {r.picked_by_name}</p>
            <img src={signature} alt="Signature" className="h-28 w-full rounded-md bg-white object-contain" />
          </Card>
        )}
        <Fold title={`Le détail · ${formatKg(kg)}`} open={open} onToggle={() => setOpen((o) => !o)}>
          <div className="space-y-1 pb-2">
            <Row label="Client" value={`${name}${r.client?.customer_code ? ` · ${r.client.customer_code}` : ''}`} />
            <Row label="Emporté par" value={`${r.picked_by_name}${r.picked_by_phone ? ` · ${r.picked_by_phone}` : ''}`} />
            <Row label="Remis par" value={r.released_by_name ?? '—'} />
            {r.note && <Row label="Remarque" value={r.note} />}
          </div>
          {r.parcels.map((p) => <ParcelLine key={p.id} parcel={p} withTransport />)}
        </Fold>
        <div className="grid grid-cols-2 gap-2">
          <SoftPill onClick={() => navigate('/w/remise')} className="h-12 text-[15px]"><ScanLine /> Client suivant</SoftPill>
          <SoftPill onClick={() => navigate('/w')} className="h-12 text-[15px]"><Home /> Accueil</SoftPill>
        </div>
      </div>
    </div>
  );
}
