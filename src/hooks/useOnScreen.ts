import { useEffect, useState, useCallback } from 'react';

/** Hauteur de l'en-tête collant des fiches (56 px) : un bouton passé dessous
 *  compte comme hors écran. */
const STICKY_HEADER_PX = 56;

/**
 * Dit si un élément est à l'écran (au moins à moitié visible, et pas caché
 * sous l'en-tête collant). Sert à la barre de décision collante : tant que le
 * bouton principal de « La décision » se voit, la barre reste rangée.
 *
 * Retourne un `ref` à poser sur l'élément (callback : l'élément peut
 * apparaître ou disparaître au fil des statuts) et `onScreen`. Avant la
 * première mesure — ou sans IntersectionObserver — on répond « à l'écran »,
 * pour ne jamais montrer la barre par erreur au chargement.
 */
export function useOnScreen(enabled = true): { ref: (el: Element | null) => void; onScreen: boolean } {
  const [node, setNode] = useState<Element | null>(null);
  const [onScreen, setOnScreen] = useState(true);
  const ref = useCallback((el: Element | null) => setNode(el), []);

  useEffect(() => {
    if (!enabled || !node || typeof IntersectionObserver === 'undefined') {
      setOnScreen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const last = entries[entries.length - 1];
        if (last) setOnScreen(last.isIntersecting);
      },
      { threshold: 0.5, rootMargin: `-${STICKY_HEADER_PX}px 0px 0px 0px` },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [node, enabled]);

  return { ref, onScreen };
}
