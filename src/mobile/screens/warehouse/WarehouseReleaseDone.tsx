// ============================================================
// ENTREPÔT — C'est fait. Le bon de retrait : combien de colis, à qui, et
// « Bon de retrait (PDF) » à envoyer au client (WhatsApp). Refonte v2
// (maquette 04/17) : « Remis », « Client suivant · <le prochain qui
// attend> » en noir ; la signature et le détail des colis dans une feuille.
// Un bon se rouvre depuis l'accueil (« Bons »).
// ============================================================
import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FileSignature, Home } from 'lucide-react';
import { toast } from 'sonner';
import { useRelease, useSignatureUrl, useWarehouseDay } from '@/hooks/useWarehouse';
import { deliverReleaseNotePdf } from '@/lib/releaseNotePdf';
import { nParcels } from '@/lib/warehouse';
import { clientFullName, formatKg } from '@/lib/reception';
import { cn } from '@/lib/utils';
import { BottomSheet, IconCircle, ItemList, ItemRow, KVBox, ScreenLoader, SuccessView, SURFACE, TEXT } from '@/mobile/designKit';
import { formatDateTime } from '@/mobile/components/reception/bits';
import { ParcelLine } from '@/mobile/components/warehouse/bits';
import { writeReleaseDraft } from './releaseDraft';

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
  const { data: day } = useWarehouseDay();
  const [open, setOpen] = useState(false);
  if (isLoading || !r) return <ScreenLoader className="min-h-[100dvh]" />;
  const name = r.client ? clientFullName(r.client) : r.picked_by_name;
  const kg = r.parcels.reduce((s, p) => s + Number(p.weight_kg ?? 0), 0);
  const signature = state?.signature ?? sigUrl ?? null;
  // Le prochain qui attend : un autre client que celui qu'on vient de servir.
  const next = (day?.waiting_by_client ?? []).find((w) => w.client && w.client.user_id !== r.client?.user_id)?.client ?? null;

  const pdf = async () => {
    try {
      const sig = state?.signature ?? (sigUrl ? await toDataUrl(sigUrl).catch(() => null) : null);
      if ((await deliverReleaseNotePdf(r, sig)) === 'downloaded') toast.success('Bon de retrait téléchargé');
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className={cn('min-h-[100dvh]', SURFACE.canvas)}>
      <SuccessView
        title="Remis"
        subtitle={<>{nParcels(r.parcel_count)} à {r.picked_by_name}{r.client && r.picked_by_name !== name ? ` pour ${name}` : ''}<br />Bon {r.release_no}</>}
        primary={next
          ? { label: `Client suivant · ${clientFullName(next)}`, onClick: () => { writeReleaseDraft(null); navigate(`/w/remise/${next.customer_code}`); } }
          : { label: 'Client suivant', onClick: () => navigate('/w/remise') }}
        secondary={{ label: 'Bon de retrait (PDF)', onClick: () => void pdf() }}
      >
        <ItemList className="-mx-5 mt-8">
          <ItemRow leading={<IconCircle icon={FileSignature} />} title="Le détail" subtitle={`${formatKg(kg)} · ${formatDateTime(r.released_at)}`} onClick={() => setOpen(true)} chevron />
          <ItemRow leading={<IconCircle icon={Home} />} title="Accueil" onClick={() => navigate('/w')} chevron />
        </ItemList>
      </SuccessView>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={r.release_no}>
        <KVBox rows={[
          { label: 'Client', value: [name, r.client?.customer_code].filter(Boolean).join(' · ') },
          { label: 'Emporté par', value: [r.picked_by_name, r.picked_by_phone].filter(Boolean).join(' · ') },
          { label: 'Remis par', value: r.released_by_name ?? '—' },
          ...(r.note ? [{ label: 'Remarque', value: r.note }] : []),
        ]} />
        {signature && (
          <div className="mt-4">
            <p className={cn('text-[15px]', TEXT.muted)}>Signature de {r.picked_by_name}</p>
            <img src={signature} alt="Signature" className="mt-2 h-28 w-full rounded-lg border border-[#D9D9D9] bg-white object-contain dark:border-[#444444]" />
          </div>
        )}
        <div className="mt-4">
          {r.parcels.map((p) => <ParcelLine key={p.id} parcel={p} withTransport />)}
        </div>
      </BottomSheet>
    </div>
  );
}
