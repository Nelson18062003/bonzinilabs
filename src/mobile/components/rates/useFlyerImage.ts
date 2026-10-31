// useFlyerImage — le flyer du jour photographié en PNG (2160×2700).
//
// Sorti tel quel de RateFlyerSheet pour servir aussi l'écran « Flyer du
// jour » du mobile v2 : le flyer est dessiné hors écran (RateFlyer,
// 1080×1350, dans le nœud `nodeRef`), photographié, et c'est CETTE IMAGE
// qu'on affiche, copie, télécharge ou partage. Une nouvelle photo est prise
// quand le flyer change (pays, langue, taux) ; les photos passent l'une après
// l'autre ; « Réessayer » (`retry`) relance après un échec.
import { useEffect, useRef, useState } from 'react';
import { flyerPngFile } from '@/lib/exportFlyer';
import type { FlyerData } from '@/lib/rateFlyer';

export interface FlyerImage { key: string; file: File; url: string }

export function useFlyerImage(flyer: FlyerData | null) {
  // Ce que montre le flyer, en une clé : l'image est refaite quand elle change.
  const flyerKey = flyer ? JSON.stringify(flyer) : '';
  const nodeRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<FlyerImage | null>(null);
  const [failed, setFailed] = useState(false);
  // « Réessayer » après un échec (réseau coupé au chargement de la police…).
  const [attempt, setAttempt] = useState(0);
  const imageRef = useRef<FlyerImage | null>(null);
  imageRef.current = image;
  useEffect(() => () => { if (imageRef.current) URL.revokeObjectURL(imageRef.current.url); }, []);
  // Les photos passent l'une après l'autre : deux captures du même nœud en même temps se mélangeraient.
  const captures = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    const node = nodeRef.current;
    if (!flyer || !node) return;
    const key = flyerKey;
    const countryKey = flyer.country.key;
    const flyerLang = flyer.lang;
    let cancelled = false;
    setFailed(false);
    // Un court délai : en passant vite d'un pays à l'autre, seul le dernier est photographié.
    const timer = window.setTimeout(() => {
      captures.current = captures.current
        .then(async () => {
          if (cancelled) return;
          // Le navigateur pose d'abord le flyer (et son drapeau).
          await new Promise((r) => requestAnimationFrame(r));
          if (cancelled) return;
          const file = await flyerPngFile(node, countryKey, flyerLang);
          if (cancelled) return;
          const url = URL.createObjectURL(file);
          setImage((prev) => { if (prev) URL.revokeObjectURL(prev.url); return { key, file, url }; });
        })
        .catch(() => { if (!cancelled) setFailed(true); });
    }, 150);
    return () => { cancelled = true; window.clearTimeout(timer); };
    // flyerKey résume flyer : pas besoin de l'objet dans les dépendances.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyerKey, attempt]);

  const ready = !!image && image.key === flyerKey;
  return { nodeRef, image, ready, failed, flyerKey, retry: () => setAttempt((a) => a + 1) };
}
