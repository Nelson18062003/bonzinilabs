// ============================================================
// RÉCEPTION — le retour. La flèche ‹ fait la même chose que le geste retour
// du téléphone : elle ramène là d'où l'on vient. Seulement si l'on est
// arrivé sans historique (lien, scan, notification, page rechargée), elle
// mène au parent logique de l'écran, EN REMPLAÇANT l'entrée — jamais en
// l'empilant : c'est ce push qui créait les boucles Accueil → Nouveau →
// Accueil et les fiches en double.
// `window.history.state.idx` : la position que BrowserRouter (react-router 6)
// tient dans l'historique ; 0 = première page de la visite.
//
// Après un envoi (réseau lent), l'écran a pu être quitté entre-temps (geste
// retour, onglet) : le retour ou l'étape suivante ne partent alors PAS — sinon
// un second navigate(-1) renverrait encore un écran plus loin, ou un replace
// écraserait la page où l'on était revenu. `useStillHere` dit si l'écran qui
// a lancé l'envoi est encore affiché.
// ============================================================
import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export function canGoBack(): boolean {
  try {
    return ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;
  } catch {
    return false;
  }
}

/** Vrai tant que l'écran qui appelle est monté (à tester après chaque `await`, avant de naviguer). */
export function useStillHere(): () => boolean {
  const here = useRef(true);
  useEffect(() => {
    here.current = true;
    return () => { here.current = false; };
  }, []);
  return useCallback(() => here.current, []);
}

export function useReceptionBack() {
  const navigate = useNavigate();
  const stillHere = useStillHere();
  return useCallback((fallback: string) => {
    if (!stillHere()) return; // l'écran a déjà été quitté : ne pas reculer une seconde fois
    if (canGoBack()) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [navigate, stillHere]);
}
