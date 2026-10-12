// ============================================================
// L'étiquette d'un paquet avion (airPackageLabelCanvas) : son QR invisible
// à monter (`nodes`), puis l'aperçu, le PDF 100 × 150 mm (une page) ou
// l'image PNG. Les fichiers partent par les API standard du navigateur
// (téléchargement, partage) : l'app BONZINI HQ les intercepte.
// ============================================================
import { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import type { AirPackage } from '@/lib/airPackage';
import { packageQrPayload } from '@/lib/airPackage';
import { packageLabelData, renderPackageLabel } from '@/lib/airPackageLabelCanvas';
import { useParcelQrCanvases } from '@/components/customer-code/useParcelQrCanvases';
import { canvasToBlob } from '@/components/customer-code/exportShippingLabel';

export function packageLabelFileName(packageNo: string, ext: 'pdf' | 'png'): string {
  return `bonzini-paquet-${packageNo}.${ext}`;
}

export function usePackageLabel(pkg: AirPackage | null | undefined, active = true) {
  const qrs = useParcelQrCanvases(active && pkg ? [{ id: pkg.id, value: packageQrPayload(pkg.package_no) }] : []);
  const [preview, setPreview] = useState<string | null>(null);

  const render = async (scale = 3): Promise<HTMLCanvasElement> => {
    if (!pkg) throw new Error('Paquet introuvable');
    return renderPackageLabel(packageLabelData(pkg), qrs.get(pkg.id), scale);
  };

  /** Le PDF d'une page 100 × 150 mm — le format de l'imprimante d'étiquettes 4 pouces. */
  const pdfFile = async (): Promise<File> => {
    const canvas = await render(3);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [100, 150] });
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 100, 150, undefined, 'FAST');
    return new File([pdf.output('blob')], packageLabelFileName(pkg?.package_no ?? 'paquet', 'pdf'), { type: 'application/pdf' });
  };

  const pngFile = async (): Promise<File> => {
    const canvas = await render(3);
    return new File([await canvasToBlob(canvas)], packageLabelFileName(pkg?.package_no ?? 'paquet', 'png'), { type: 'image/png' });
  };

  // L'aperçu, repeint quand le QR est prêt ou que le paquet change (pesée, expédition) ; effacé hors de l'écran.
  const ready = !!pkg && qrs.ready;
  useEffect(() => {
    if (!active) { setPreview(null); return; }
    if (!ready) return;
    let alive = true;
    render(1.5).then((c) => { if (alive) setPreview(c.toDataURL('image/png')); }).catch(() => { if (alive) setPreview(null); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ready, pkg?.id, pkg?.updated_at]);

  return {
    /** L'aperçu (image) de l'étiquette, une fois le QR peint. */
    preview,
    /** Le QR invisible, à monter quelque part. */
    nodes: qrs.nodes,
    /** Le QR est peint : on peut produire. */
    ready,
    render,
    pdfFile,
    pngFile,
  };
}
