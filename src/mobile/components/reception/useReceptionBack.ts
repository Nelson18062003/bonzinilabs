// ============================================================
// RÉCEPTION — le retour. La flèche ‹ fait la même chose que le geste retour
// du téléphone : elle ramène là d'où l'on vient. Seulement si l'on est
// arrivé sans historique (lien, scan, notification, page rechargée), elle
// mène au parent logique de l'écran, EN REMPLAÇANT l'entrée — jamais en
// l'empilant : c'est ce push qui créait les boucles Accueil → Nouveau →
// Accueil et les fiches en double.
// `window.history.state.idx` : la position que BrowserRouter (react-router 6)
// tient dans l'historique ; 0 = première page de la visite.
// ============================================================
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export function canGoBack(): boolean {
  try {
    return ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;
  } catch {
    return false;
  }
}

export function useReceptionBack() {
  const navigate = useNavigate();
  return useCallback((fallback: string) => {
    if (canGoBack()) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [navigate]);
}
