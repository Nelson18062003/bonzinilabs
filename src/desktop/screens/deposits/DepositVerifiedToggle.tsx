/**
 * « VÉRIFIÉ EN BANQUE » — une case à cocher, pas un statut de plus.
 *
 * Besoin réel : « les gens déposent sur nos différents comptes, et parfois je
 * paie avant d'avoir vérifié. Je crée un dépôt et je le valide ; plus tard,
 * en fin de journée, j'appelle mon partenaire et on regarde le compte : est-ce
 * que c'est bien arrivé ? »
 *
 * Ce sont donc DEUX questions, et il faut deux réponses distinctes :
 *   · le STATUT du dépôt dit si le portefeuille du client a été crédité ;
 *   · CE marqueur dit si l'argent a été constaté sur le compte bancaire.
 *
 * Les fondre en une seule échelle obligerait à inventer « validé-vérifié » et
 * « validé-non-vérifié », et rendrait un dépôt rejeté « non vérifié » alors
 * qu'il est simplement hors sujet. D'où une colonne à part, sur son axe.
 *
 * Le composant est PRÉSENTATIONNEL : il ne connaît ni la requête ni le cache.
 * C'est ce qui permet de le rendre seul dans un test, sans monter l'écran.
 */
import { CheckCircle, Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EMERALD_PILL, SOFT_PILL, TEXT } from '@/desktop/designKit';

/** Le libellé d'un état de vérification, et sa valeur cible au clic. */
export function verifiedState(verifiedAt: string | null | undefined) {
  const verified = !!verifiedAt;
  return {
    verified,
    label: verified ? 'Vérifié' : 'À vérifier',
    /** Ce que le clic demandera : l'inverse de l'état courant. */
    next: !verified,
  };
}

/** « Vérifié le 7 sept. 2026 à 14:30 » — l'infobulle, quand la date existe. */
export function verifiedTitle(verifiedAt: string | null | undefined): string {
  if (!verifiedAt) return "Pas encore constaté sur le compte bancaire — cliquer pour marquer vérifié";
  const d = new Date(verifiedAt);
  if (Number.isNaN(d.getTime())) return 'Vérifié en banque — cliquer pour retirer';
  const date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `Vérifié en banque le ${date} à ${time} — cliquer pour retirer`;
}

export function DepositVerifiedToggle({
  verifiedAt,
  onToggle,
  pending = false,
  /** Sans le droit de traiter les dépôts : on montre l'état, pas le bouton. */
  readOnly = false,
  compact = false,
}: {
  verifiedAt: string | null | undefined;
  onToggle: (next: boolean) => void;
  pending?: boolean;
  readOnly?: boolean;
  compact?: boolean;
}) {
  const { verified, label, next } = verifiedState(verifiedAt);
  const Icon = verified ? CheckCircle : Circle;
  const title = verifiedTitle(verifiedAt);

  const shape = cn(
    'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold',
    compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1 text-[11.5px]',
    verified ? EMERALD_PILL : cn(SOFT_PILL, TEXT.muted),
  );

  if (readOnly) {
    return (
      <span className={shape} title={verified ? title.replace(' — cliquer pour retirer', '') : 'Pas encore vérifié en banque'}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      // La ligne ouvre la fiche : sans cet arrêt, cocher « vérifié » ferait
      // aussi basculer l'écran sur le détail du dépôt.
      onClick={(e) => {
        e.stopPropagation();
        if (!pending) onToggle(next);
      }}
      disabled={pending}
      aria-pressed={verified}
      aria-label={verified ? `Retirer la vérification bancaire (${label})` : `Marquer vérifié en banque`}
      title={title}
      className={cn(shape, 'transition disabled:opacity-60', !pending && 'hover:brightness-95')}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}
