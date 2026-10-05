// ============================================================
// L'étiquette d'un paquet avion, en feuille basse : l'aperçu exact, puis
// TÉLÉCHARGER le PDF (une page 100 × 150 mm, pour l'imprimante d'étiquettes)
// ou l'image ; le partage / AirPrint en second. Même geste que l'étiquette
// interne d'un dépôt (InternalLabelSheet). `banner` s'affiche au-dessus de
// l'aperçu (« paquet fermé »), `footer` sous les boutons (« nouveau paquet »).
// ============================================================
import { useEffect, useState, type ReactNode } from 'react';
import { Download, FileDown, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { AirPackage } from '@/lib/airPackage';
import { canShareFiles, deliverFile, downloadFile } from '@/components/customer-code/exportShippingLabel';
import { SURFACE, TEXT, TYPE, BottomSheet, Button, PrimaryPill } from '@/mobile/designKit';
import { usePackageLabel } from './usePackageLabel';

export function PackageLabelSheet({ open, onClose, pkg, banner, footer }: { open: boolean; onClose: () => void; pkg: AirPackage; banner?: ReactNode; footer?: ReactNode }) {
  const { t } = useTranslation('agent');
  const maker = usePackageLabel(pkg, open);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<'pdf' | 'png' | 'share' | null>(null);

  // L'aperçu, repeint quand le QR est prêt ou que le paquet change (pesée, expédition).
  useEffect(() => {
    if (!open || !maker.ready) return;
    let alive = true;
    maker.render(1.5).then((c) => { if (alive) setPreview(c.toDataURL('image/png')); }).catch(() => { if (alive) setPreview(null); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, maker.ready, pkg.id, pkg.updated_at]);
  useEffect(() => { if (!open) setPreview(null); }, [open]);

  const run = async (what: 'pdf' | 'png' | 'share') => {
    if (busy) return;
    setBusy(what);
    try {
      if (what === 'pdf') { downloadFile(await maker.pdfFile()); toast.success(t('rc_pk_label_done_pdf')); }
      else if (what === 'png') { downloadFile(await maker.pngFile()); toast.success(t('rc_pk_label_done_png')); }
      else if ((await deliverFile(await maker.pdfFile(), pkg.package_no)) === 'downloaded') toast.success(t('rc_pk_label_done_pdf'));
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };

  return (
    <>
      {maker.nodes}
      <BottomSheet open={open} onClose={onClose} title={t('rc_pk_label_title', { no: pkg.package_no })}>
        <div className="space-y-4">
          {banner}
          <div className={cn('overflow-hidden rounded-lg', SURFACE.inset)}>
            {preview
              ? <img src={preview} alt={pkg.package_no} className="mx-auto block max-h-[46vh] w-auto" />
              : <div className={cn('flex h-64 items-center justify-center', TYPE.small, TEXT.muted)}>{t('rc_pk_label_preparing')}</div>}
          </div>
          <div className="space-y-2">
            <PrimaryPill onClick={() => void run('pdf')} loading={busy === 'pdf'} disabled={!maker.ready || busy !== null} className="h-14 w-full text-[17px]"><FileDown /> {t('rc_pk_label_pdf')}</PrimaryPill>
            <Button variant="neutral" onClick={() => void run('png')} loading={busy === 'png'} disabled={!maker.ready || busy !== null} className="h-12 w-full text-[16px]"><Download /> {t('rc_pk_label_png')}</Button>
            {canShareFiles() && <Button variant="subtle" onClick={() => void run('share')} loading={busy === 'share'} disabled={!maker.ready || busy !== null} className="h-12 w-full text-[16px]"><Share2 /> {t('rc_pk_label_share')}</Button>}
          </div>
          <p className={cn(TYPE.small, TEXT.muted)}>{t('rc_pk_label_hint')}</p>
          {footer}
        </div>
      </BottomSheet>
    </>
  );
}
