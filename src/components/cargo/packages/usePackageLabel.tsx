// ============================================================
// L'étiquette d'un paquet avion (airPackageLabelCanvas) : son QR invisible
// à monter (`nodes`), puis l'aperçu, le PDF 100 × 150 mm (une page) ou
// l'image PNG. Les fichiers partent par les API standard du navigateur
// (téléchargement, partage) : l'app BONZINI HQ les intercepte.
// ============================================================
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

  return {
    /** Le QR invisible, à monter quelque part. */
    nodes: qrs.nodes,
    /** Le QR est peint : on peut produire. */
    ready: !!pkg && qrs.ready,
    render,
    pdfFile,
    pngFile,
  };
}
