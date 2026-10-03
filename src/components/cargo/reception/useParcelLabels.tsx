// ============================================================
// L'étiquette interne (入库标签) côté console : un colis, tout un dépôt, ou
// une sélection de colis de plusieurs dépôts — le même peintre que la
// feuille mobile (warehouseLabelCanvas), les mêmes QR. Chaque étiquette
// porte le contexte de SON dépôt (client, fournisseur, date, « 3 / 10 »).
//
// `nodes` (les QR invisibles) est à monter quelque part ; `ready` dit quand
// on peut peindre. Un dépôt sans client n'a pas d'étiquette : le QR porte le
// code client. On l'attribue d'abord.
// ============================================================
import { jsPDF } from 'jspdf';
import type { ShippingSettings } from '@/lib/customerCode';
import { depositDate, depositSupplier, labelPosition, type Deposit, type Parcel } from '@/lib/reception';
import { parcelQrPayload, renderWarehouseLabel, type WarehouseLabelData } from '@/lib/warehouseLabelCanvas';
import { useParcelQrCanvases } from '@/components/customer-code/useParcelQrCanvases';

export interface LabelItem {
  parcel: Parcel;
  deposit: Deposit;
}

const canvasToBlob = (c: HTMLCanvasElement) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob a échoué'))), 'image/png'));

export function labelData(it: LabelItem, settings: ShippingSettings): WarehouseLabelData {
  const d = it.deposit;
  return {
    destination: d.location, settings, parcel: it.parcel, count: d.parcels.length, position: labelPosition(d.parcels, it.parcel.id),
    depositNo: d.deposit_no, client: d.client, supplier: depositSupplier(d), receivedAt: depositDate(d), receivedByName: d.received_by_name,
  };
}

export function useParcelLabels(items: ReadonlyArray<LabelItem>, settings: ShippingSettings, active = true) {
  const labelable = items.filter((it) => it.deposit.client);
  const qrs = useParcelQrCanvases(active ? labelable.map((it) => ({ id: it.parcel.id, value: parcelQrPayload(it.deposit.client!.customer_code, it.parcel.parcel_no) })) : []);
  const byId = new Map(labelable.map((it) => [it.parcel.id, it]));

  const render = async (parcelId: string, scale = 3): Promise<HTMLCanvasElement> => {
    const it = byId.get(parcelId);
    if (!it) throw new Error('Attribuez d\'abord ce dépôt à un client');
    return renderWarehouseLabel(labelData(it, settings), qrs.get(parcelId), scale);
  };

  /** Un PDF, une page 100 × 150 mm par colis, dans l'ordre donné. */
  const pdfFile = async (parcelIds: string[], name: string): Promise<File> => {
    const ids = parcelIds.filter((id) => byId.has(id));
    if (ids.length === 0) throw new Error('Aucune étiquette à produire : ces colis n\'ont pas de client');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [100, 150] });
    for (let k = 0; k < ids.length; k++) {
      const canvas = await render(ids[k], 3);
      if (k > 0) pdf.addPage([100, 150], 'portrait');
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 100, 150, undefined, 'FAST');
    }
    return new File([pdf.output('blob')], name.endsWith('.pdf') ? name : `${name}.pdf`, { type: 'application/pdf' });
  };

  const pngFile = async (parcelId: string): Promise<File> => {
    const it = byId.get(parcelId);
    const canvas = await render(parcelId, 3);
    return new File([await canvasToBlob(canvas)], `bonzini-etiquette-${it?.parcel.parcel_no ?? parcelId}.png`, { type: 'image/png' });
  };

  return {
    nodes: qrs.nodes,
    /** Les QR des colis étiquetables sont peints : on peut produire. */
    ready: labelable.length > 0 && qrs.ready,
    /** Ce colis peut-il avoir une étiquette (son dépôt a un client) ? */
    has: (parcelId: string) => byId.has(parcelId),
    /** Les colis sans étiquette possible (dépôt sans client). */
    skipped: items.length - labelable.length,
    render,
    pdfFile,
    pngFile,
  };
}

/** Ouvre un PDF dans un nouvel onglet, prêt à imprimer (Ctrl+P) — sans le télécharger. */
export function openForPrint(file: File): boolean {
  const url = URL.createObjectURL(file);
  const w = window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return !!w;
}
