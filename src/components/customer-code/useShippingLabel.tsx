// ============================================================
// L'étiquette colis côté React : un QR invisible (canvas) que le peintre
// recopie, un aperçu (l'image EXACTE qui sera exportée, à ×2) et `render`
// pour produire le fichier à ×3.
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { cn } from '@/lib/utils';
import { customerQrPayload, renderShippingLabel, LABEL_W, LABEL_H, type LabelData } from '@/lib/shippingLabelCanvas';

export function useShippingLabel(data: LabelData): { preview: string | null; render: (scale?: number) => Promise<HTMLCanvasElement>; qr: ReactNode } {
  // Le canvas du QR arrive par une ref-fonction : tant qu'il n'est pas monté
  // (feuille fermée), il n'y a pas d'aperçu à peindre ; dès qu'il l'est, on
  // repeint — sinon l'étiquette partait sans QR quand la feuille s'ouvrait
  // après le montage du composant.
  const [qrEl, setQrEl] = useState<HTMLCanvasElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const key = JSON.stringify(data);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stable = useMemo(() => data, [key]);

  // L'export ×3 est PRÉ-PEINT dès que l'aperçu est prêt : au tap sur « Envoyer »,
  // il ne reste que toBlob → navigator.share, dans le geste de la personne.
  // Sinon, sur iOS Safari, les secondes de peinture et de chargement des
  // polices faisaient expirer l'activation, et la feuille de partage refusait.
  const exportRef = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(null);
  useEffect(() => {
    if (!qrEl) return;
    let alive = true;
    setPreview(null);
    exportRef.current = null;
    // Le QR se peint dans l'effet de son propre composant (déjà passé quand
    // la ref-fonction a déclenché ce rendu) ; une image de délai par prudence.
    const id = requestAnimationFrame(() => {
      renderShippingLabel(stable, qrEl, 2)
        .then((c) => { if (alive) setPreview(c.toDataURL('image/png')); })
        .then(() => renderShippingLabel(stable, qrEl, 3))
        .then((c) => { if (alive) exportRef.current = { key, canvas: c }; })
        .catch((err) => console.error('shipping label preview', err));
    });
    return () => { alive = false; cancelAnimationFrame(id); };
  }, [stable, qrEl]);

  const render = useCallback(async (scale = 3) => {
    const cached = exportRef.current;
    if (scale === 3 && cached && cached.key === key) return cached.canvas;
    return renderShippingLabel(stable, qrEl, scale);
  }, [stable, qrEl, key]);

  const qr = (
    <div aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
      <QRCodeCanvas ref={setQrEl} value={customerQrPayload(data.code)} size={600} level="H" marginSize={0} />
    </div>
  );
  return { preview, render, qr };
}

/** L'aperçu : l'image de l'étiquette, à la largeur disponible, aux proportions de la feuille. */
export function ShippingLabelPreview({ src, className }: { src: string | null; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-lg bg-white ring-1 ring-black/[0.08] dark:ring-white/[0.1]', className)} style={{ aspectRatio: `${LABEL_W} / ${LABEL_H}` }}>
      {src ? (
        <img src={src} alt="Étiquette colis" className="block h-full w-full" draggable={false} />
      ) : (
        <div className="h-full w-full animate-pulse bg-[#F5F5F5] dark:bg-[#383838]" />
      )}
    </div>
  );
}
