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
  const qrRef = useRef<HTMLCanvasElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const key = JSON.stringify(data);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stable = useMemo(() => data, [key]);

  useEffect(() => {
    let alive = true;
    // Le QR se peint dans l'effet de son propre composant (enfant, donc avant
    // celui-ci) ; une image de délai par prudence.
    const id = requestAnimationFrame(() => {
      renderShippingLabel(stable, qrRef.current, 2)
        .then((c) => { if (alive) setPreview(c.toDataURL('image/png')); })
        .catch((err) => console.error('shipping label preview', err));
    });
    return () => { alive = false; cancelAnimationFrame(id); };
  }, [stable]);

  const render = useCallback((scale = 3) => renderShippingLabel(stable, qrRef.current, scale), [stable]);

  const qr = (
    <div aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
      <QRCodeCanvas ref={qrRef} value={customerQrPayload(data.code)} size={600} level="H" marginSize={0} />
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
