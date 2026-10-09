// ============================================================
// Tableau de bord des ventes — où en sont les prospects ajoutés sur la
// plage : en cours (à contacter, contactés, intéressés) → à vérifier (la
// direction doit trancher) → devenus clients ; à part, perdus.
//
// En tête, le taux de conversion (devenus clients / ajoutés) ; dessous, la
// répartition en une barre (une partie du tout : les statuts ACTUELS des
// prospects de la plage), puis une ligne par étape avec son nombre et sa part.
// Couleurs ordinales : un seul bleu, plus soutenu à mesure qu'on avance ;
// perdus en gris.
// ============================================================
import type { SalesFunnel } from '@/hooks/useSales';
import { cn } from '@/lib/utils';
import { conversionRate, formatRate, funnelStages, num, plural, type FunnelStageKey } from '@/lib/salesSeries';
import { EmptyState } from './primitives';

const STAGE_COLOR: Record<FunnelStageKey, string> = {
  open: 'var(--sd-ord-1)',
  to_verify: 'var(--sd-ord-2)',
  won: 'var(--sd-ord-3)',
  lost: 'var(--sd-lost)',
};

export interface ProspectFunnelProps {
  funnel: SalesFunnel;
  /** Le détail de « En cours » sous la ligne (à contacter · contactés · intéressés) ; défaut : oui. */
  showOpenDetail?: boolean;
  /** Une étape touchée (ouvrir la liste filtrée, par exemple) ; sans elle, les lignes ne sont pas cliquables. */
  onStageClick?: (stage: FunnelStageKey) => void;
  className?: string;
}

export function ProspectFunnel({ funnel, showOpenDetail = true, onStageClick, className }: ProspectFunnelProps) {
  const total = num(funnel?.total);
  if (total === 0) {
    return (
      <EmptyState title="Aucun prospect ajouté sur cette période" className={className}>
        Les prospects saisis apparaîtront ici, avec ce qu’ils sont devenus.
      </EmptyState>
    );
  }
  const stages = funnelStages(funnel);
  const rate = conversionRate(funnel);
  const won = num(funnel.won);

  return (
    <div className={cn('sd min-w-0', className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <p className="text-[14px] font-medium text-muted-foreground">Taux de conversion</p>
          <p className="mt-1 text-[34px] font-semibold leading-none tracking-[-0.02em] text-foreground">{formatRate(rate)}</p>
        </div>
        <p className="pb-0.5 text-[14px] text-muted-foreground">
          {plural(won, 'devenu client', 'devenus clients')} sur {plural(total, 'prospect ajouté', 'prospects ajoutés')}
        </p>
      </div>

      {/* La répartition : une barre, 2 px de vide entre les parts. */}
      <div className="mt-4 flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={stages.map((s) => `${s.label} : ${s.count}`).join(', ')}>
        {stages
          .filter((s) => s.count > 0)
          .map((s) => (
            <span key={s.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ flexGrow: s.count, flexBasis: 0, minWidth: 4, backgroundColor: STAGE_COLOR[s.key] }} />
          ))}
      </div>

      <ul className="mt-4 divide-y divide-border/60">
        {stages.map((s) => {
          const content = (
            <>
              <span aria-hidden className="mt-[6px] h-2.5 w-2.5 shrink-0 self-start rounded-[3px]" style={{ backgroundColor: STAGE_COLOR[s.key] }} />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium text-foreground">{s.label}</span>
                {s.key === 'open' && showOpenDetail && s.count > 0 && (
                  <span className="block text-[13px] leading-snug text-muted-foreground">
                    {[
                      num(funnel.new) && `${num(funnel.new)} à contacter`,
                      num(funnel.contacted) && plural(num(funnel.contacted), 'contacté', 'contactés'),
                      num(funnel.interested) && plural(num(funnel.interested), 'intéressé', 'intéressés'),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                )}
                {s.key === 'to_verify' && s.count > 0 && <span className="block text-[13px] text-muted-foreground">La direction doit trancher</span>}
              </span>
              <span className="shrink-0 self-start text-right tabular-nums">
                <span className="text-[15px] font-semibold text-foreground">{s.count}</span>
                <span className="ml-2 inline-block w-11 text-[14px] text-muted-foreground">{formatRate(s.share)}</span>
              </span>
            </>
          );
          return (
            <li key={s.key} className={cn(s.count === 0 && 'opacity-60')}>
              {onStageClick ? (
                <button type="button" onClick={() => onStageClick(s.key)} className="sd-press -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-2.5 text-left">
                  {content}
                </button>
              ) : (
                <div className="flex items-center gap-3 py-2.5">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
