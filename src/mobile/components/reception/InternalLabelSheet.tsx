// ============================================================
// L'étiquette interne (入库标签) d'un dépôt, en feuille basse : l'aperçu exact
// de chaque carton (on passe de l'un à l'autre), puis TÉLÉCHARGER — le PDF
// de toutes les étiquettes (une page 100 × 150 mm par carton), ou l'image
// PNG du carton affiché. Le partage / l'impression AirPrint restent
// disponibles, en second. Même feuille pour le réceptionnaire et l'admin.
// ============================================================
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, FileDown, Share2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ShippingSettings } from '@/lib/customerCode';
import { depositSupplier, type Deposit } from '@/lib/reception';
import { parcelQrPayload, renderWarehouseLabel } from '@/lib/warehouseLabelCanvas';
import { useParcelQrCanvases } from '@/components/customer-code/useParcelQrCanvases';
import { canShareFiles, deliverFile, downloadFile } from '@/components/customer-code/exportShippingLabel';
import { SURFACE, TEXT, TYPE, BottomSheet, Button, PrimaryPill } from '@/mobile/designKit';

const canvasToBlob = (c: HTMLCanvasElement) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob a échoué'))), 'image/png'));

export function InternalLabelSheet({ open, onClose, deposit, settings }: { open: boolean; onClose: () => void; deposit: Deposit; settings: ShippingSettings }) {
  const client = deposit.client;
  const parcels = deposit.parcels;
  const parcelQrs = useParcelQrCanvases(open && client ? parcels.map((p) => ({ id: p.id, value: parcelQrPayload(client.customer_code, p.parcel_no) })) : []);
  const [i, setI] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<'pdf' | 'png' | 'share' | null>(null);
  const receivedAt = deposit.closed_at ?? deposit.opened_at;
  const count = parcels.length;

  const data = (k: number) => ({
    destination: deposit.location, settings, parcel: parcels[k], count, depositNo: deposit.deposit_no,
    client: client!, supplier: depositSupplier(deposit), receivedAt, receivedByName: deposit.received_by_name,
  });

  // L'aperçu du carton affiché, repeint quand on change de carton ou que les QR sont prêts.
  useEffect(() => {
    if (!open || !client || !parcels[i] || !parcelQrs.ready) return;
    let alive = true;
    renderWarehouseLabel(data(i), parcelQrs.get(parcels[i].id), 1.5).then((c) => { if (alive) setPreview(c.toDataURL('image/png')); }).catch(() => { if (alive) setPreview(null); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, i, parcelQrs.ready, deposit.id]);
  useEffect(() => { if (!open) { setI(0); setPreview(null); } }, [open]);

  if (!client) return null;
  const parcel = parcels[i];
  const base = `bonzini-etiquettes-${deposit.deposit_no}-${client.customer_code}`;

  const buildPdf = async (): Promise<File> => {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [100, 150] });
    for (let k = 0; k < parcels.length; k++) {
      const canvas = await renderWarehouseLabel(data(k), parcelQrs.get(parcels[k].id), 3);
      if (k > 0) pdf.addPage([100, 150], 'portrait');
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 100, 150, undefined, 'FAST');
    }
    return new File([pdf.output('blob')], `${base}.pdf`, { type: 'application/pdf' });
  };
  const buildPng = async (): Promise<File> => {
    const canvas = await renderWarehouseLabel(data(i), parcelQrs.get(parcel.id), 3);
    return new File([await canvasToBlob(canvas)], `bonzini-etiquette-${parcel.parcel_no}.png`, { type: 'image/png' });
  };
  const run = async (what: 'pdf' | 'png' | 'share') => {
    setBusy(what);
    try {
      if (what === 'pdf') { downloadFile(await buildPdf()); toast.success(`PDF de ${count} étiquette${count > 1 ? 's' : ''} téléchargé`); }
      else if (what === 'png') { downloadFile(await buildPng()); toast.success(`Image ${parcel.parcel_no} téléchargée`); }
      else if ((await deliverFile(await buildPdf(), `${deposit.deposit_no} · ${client.customer_code}`)) === 'downloaded') toast.success('PDF téléchargé');
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };

  return (
    <>
      {parcelQrs.nodes}
      <BottomSheet open={open} onClose={onClose} title={`Étiquettes · ${deposit.deposit_no}`}>
        <div className="space-y-4">
          {/* L'aperçu : le carton affiché, tel qu'il sera imprimé. */}
          <div className={cn('relative overflow-hidden rounded-lg', SURFACE.inset)}>
            {preview ? <img src={preview} alt={`Étiquette ${parcel?.parcel_no ?? ''}`} className="mx-auto block max-h-[52vh] w-auto" /> : <div className={cn('flex h-64 items-center justify-center', TYPE.small, TEXT.muted)}>Préparation de l'aperçu…</div>}
            {count > 1 && (
              <>
                <button type="button" onClick={() => setI((k) => Math.max(0, k - 1))} disabled={i === 0} aria-label="Carton précédent" className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow disabled:opacity-30 dark:bg-[#2C2C2C]/90"><ChevronLeft className="h-5 w-5" /></button>
                <button type="button" onClick={() => setI((k) => Math.min(count - 1, k + 1))} disabled={i === count - 1} aria-label="Carton suivant" className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow disabled:opacity-30 dark:bg-[#2C2C2C]/90"><ChevronRight className="h-5 w-5" /></button>
              </>
            )}
          </div>
          <p className={cn('text-center tabular-nums', TYPE.small, TEXT.muted)}>{parcel ? `${parcel.parcel_no} · carton ${i + 1} sur ${count} · 100 × 150 mm` : ''}</p>

          <div className="space-y-2">
            <PrimaryPill onClick={() => void run('pdf')} loading={busy === 'pdf'} disabled={!parcelQrs.ready || busy !== null} className="h-14 w-full text-[17px]"><FileDown /> Télécharger le PDF ({count})</PrimaryPill>
            <Button variant="neutral" onClick={() => void run('png')} loading={busy === 'png'} disabled={!parcelQrs.ready || busy !== null} className="h-12 w-full text-[16px]"><Download /> Télécharger l'image de ce carton</Button>
            {canShareFiles() && <Button variant="subtle" onClick={() => void run('share')} loading={busy === 'share'} disabled={!parcelQrs.ready || busy !== null} className="h-12 w-full text-[16px]"><Share2 /> Partager ou imprimer (AirPrint)</Button>}
          </div>
          <p className={cn(TYPE.small, TEXT.muted)}>Une page par carton, à coller par-dessus la marque du client. Le PDF s'imprime tel quel sur une imprimante d'étiquettes 4 pouces.</p>
        </div>
      </BottomSheet>
    </>
  );
}
