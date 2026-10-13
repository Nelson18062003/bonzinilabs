// ============================================================
// RÉCEPTION — attribuer un dépôt en attente à son client (?assign=<dépôt>).
// Le même parcours sert trois écrans (caméra, recherche, nouveau client) et
// trois points de départ : En attente, « Dépôt terminé », la fiche du dépôt.
// Partie de la fiche (`&from=deposit`), l'attribution y REVIENT : « Voir le
// dépôt » et la fin du parcours reculent vers elle au lieu d'en empiler une
// seconde copie (la flèche ‹ demandait alors deux touches).
// ============================================================
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useReceptionBack } from './useReceptionBack';

export function useAssignFlow() {
  const navigate = useNavigate();
  const back = useReceptionBack();
  const [params] = useSearchParams();
  const assignId = params.get('assign');
  const fromDeposit = !!assignId && params.get('from') === 'deposit';
  /** La suite de l'URL à garder d'un écran à l'autre du parcours. */
  const qs = assignId ? `?assign=${assignId}${fromDeposit ? '&from=deposit' : ''}` : '';
  /** Là d'où l'on vient quand il n'y a pas d'historique. */
  const home = fromDeposit ? `/r/deposit/${assignId}` : '/r/pending';
  return {
    assignId,
    fromDeposit,
    qs,
    /** Réussi ou abandonné : retour là d'où l'on venait. */
    leave: () => back(home),
    /** « Voir le dépôt » : revenir à la fiche si l'on en vient, sinon la montrer à la place de cet écran. */
    seeDeposit: () => (fromDeposit ? back(home) : navigate(`/r/deposit/${assignId}`, { replace: true })),
  };
}
