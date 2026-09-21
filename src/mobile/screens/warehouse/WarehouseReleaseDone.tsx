// ============================================================
// ENTREPÔT — Le bon de retrait : c'est fait. Le récapitulatif, la
// signature, et « Bon de retrait (PDF) » à envoyer au client (WhatsApp).
// Un bon se rouvre depuis l'accueil (« Remis aujourd'hui »).
// ============================================================
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Check, FileText, Home, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useRelease, useSignatureUrl } from '@/hooks/useWarehouse';
import { deliverReleaseNotePdf } from '@/lib/releaseNotePdf';
import { transportLabel } from '@/lib/warehouse';
import { clientFullName, formatKg } from '@/lib/reception';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Card, PrimaryPill, Row, ScreenLoader, SoftPill } from '@/mobile/designKit';
import { formatDateTime, useReceptionLabels } from '@/mobile/components/reception/bits';

async function toDataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = reject; r.readAsDataURL(blob); });
}

export function WarehouseReleaseDone() {
  const navigate = useNavigate();
  const { releaseId } = useParams<{ releaseId: string }>();
  const { state } = useLocation() as { state?: { signature?: string | null } };
  const labels = useReceptionLabels();
  const { data: r, isLoading } = useRelease(releaseId);
  const { data: sigUrl } = useSignatureUrl(r?.signature_path);
  if (isLoading || !r) return <ScreenLoader className="min-h-[100dvh]" />;
  const name = r.client ? clientFullName(r.client) : r.picked_by_name;
  const kg = r.parcels.reduce((s, p) => s + Number(p.weight_kg ?? 0), 0);

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
          <p className={cn('mt-4', TYPE.heading, TEXT.strong)}>{r.parcel_count} colis remis</p>
          <p className={cn('mt-1', TYPE.body, TEXT.muted)}>à {r.picked_by_name}{r.client && r.picked_by_name !== name ? ` pour ${name}` : ''} · {formatDateTime(r.released_at)}</p>
        </div>
        <Card className="space-y-1">
          <Row label="Client" value={name} />
          {r.client?.customer_code && <Row label="Code" value={r.client.customer_code} />}
          <Row label="Emporté par" value={`${r.picked_by_name}${r.picked_by_phone ? ` · ${r.picked_by_phone}` : ''}`} />
          <Row label="Remis par" value={r.released_by_name ?? '—'} />
          <Row label="Poids" value={formatKg(kg)} />
          {r.note && <Row label="Remarque" value={r.note} />}
        </Card>
        <Card className="py-0">
          {r.parcels.map((p) => (
            <div key={p.id} className={cn('flex items-center gap-3 border-b py-3 last:border-b-0', SURFACE.divider)}>
              <span className="min-w-0 flex-1">
                <span className={cn('block tabular-nums', TYPE.body, TEXT.strong)}><b>{p.parcel_no}</b> · {p.description || labels.kind(p.kind)}</span>
                <span className={cn('block tabular-nums', TYPE.small, TEXT.muted)}>{formatKg(p.weight_kg)} · {transportLabel(p)}</span>
              </span>
            </div>
          ))}
        </Card>
        {(state?.signature || sigUrl) && (
          <Card className="space-y-2">
            <p className={cn(TYPE.small, TEXT.muted)}>Signature</p>
            <img src={state?.signature ?? sigUrl ?? undefined} alt="Signature" className="h-28 w-full rounded-md bg-white object-contain" />
          </Card>
        )}
        <PrimaryPill onClick={() => void pdf()} className="h-14 w-full text-[17px]"><FileText /> Bon de retrait (PDF)</PrimaryPill>
        <div className="grid grid-cols-2 gap-2">
          <SoftPill onClick={() => navigate('/w/remise')} className="h-12 text-[15px]"><ScanLine /> Client suivant</SoftPill>
          <SoftPill onClick={() => navigate('/w')} className="h-12 text-[15px]"><Home /> Accueil</SoftPill>
        </div>
      </div>
    </div>
  );
}
