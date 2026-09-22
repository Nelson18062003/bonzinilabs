// ============================================================
// Les bons de retrait d'un dépôt : un colis remis porte l'id de son bon ;
// on retrouve les bons distincts, on montre qui a emporté quoi et quand, et
// on ré-imprime le PDF avec la signature. Même carte pour l'admin (fiche
// dépôt, mobile et desktop) et pour Douala.
// ============================================================
import { FileSignature } from 'lucide-react';
import { toast } from 'sonner';
import { useRelease, useSignatureUrl } from '@/hooks/useWarehouse';
import { deliverReleaseNotePdf } from '@/lib/releaseNotePdf';
import { nParcels } from '@/lib/warehouse';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Card, SoftPill } from '@/mobile/designKit';
import { formatDateTime } from '@/mobile/components/reception/bits';

async function toDataUrl(url: string): Promise<string> {
  const blob = await fetch(url).then((r) => r.blob());
  return new Promise((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(String(fr.result)); fr.onerror = reject; fr.readAsDataURL(blob); });
}

function ReleaseCard({ releaseId }: { releaseId: string }) {
  const { data: r } = useRelease(releaseId);
  const { data: sigUrl } = useSignatureUrl(r?.signature_path);
  if (!r) return null;
  const pdf = async () => {
    try {
      const sig = sigUrl ? await toDataUrl(sigUrl).catch(() => null) : null;
      if ((await deliverReleaseNotePdf(r, sig)) === 'downloaded') toast.success(`Bon de retrait ${r.release_no} téléchargé`);
    } catch (e) { toast.error((e as Error).message); }
  };
  return (
    <Card className="space-y-3">
      <div className="flex items-start gap-3">
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', SURFACE.holder)}><FileSignature className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className={cn('block tabular-nums', TYPE.bodyStrong, TEXT.strong)}>Bon de retrait {r.release_no}</span>
          <span className={cn('mt-0.5 block', TYPE.small, TEXT.muted)}>{nParcels(r.parcel_count)} remis à {r.picked_by_name}{r.picked_by_phone ? ` (${r.picked_by_phone})` : ''} · {formatDateTime(r.released_at)}{r.released_by_name ? ` · par ${r.released_by_name}` : ''}</span>
          {r.note && <span className={cn('mt-1 block', TYPE.small, TEXT.muted)}>{r.note}</span>}
        </span>
      </div>
      {sigUrl && <img src={sigUrl} alt="Signature du client" className="h-16 w-auto rounded-md bg-white object-contain p-1 dark:bg-[#E3E3E3]" />}
      <SoftPill onClick={() => void pdf()} className="h-11 w-full text-[15px]"><FileSignature /> Bon de retrait (PDF)</SoftPill>
    </Card>
  );
}

/** Les bons distincts d'une liste de colis (ceux qui portent un release_id). */
export function releaseIds(parcels: ReadonlyArray<{ release_id?: string | null }>): string[] {
  return [...new Set(parcels.map((p) => p.release_id).filter((x): x is string => !!x))];
}

export function DepositReleases({ parcels }: { parcels: ReadonlyArray<{ release_id?: string | null }> }) {
  const ids = releaseIds(parcels);
  if (ids.length === 0) return null;
  return <div className="space-y-3">{ids.map((id) => <ReleaseCard key={id} releaseId={id} />)}</div>;
}
