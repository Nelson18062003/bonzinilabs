/**
 * Mobile admin — Cargo : ce qui brûle, puis le reste.
 *
 * L'admin sur son téléphone ne vient pas explorer la flotte : il vient savoir
 * quel conteneur a besoin de lui aujourd'hui. Donc : une bande de chips par
 * niveau d'alerte (qui filtre), les dossiers triés par gravité puis par date
 * d'arrivée, et sur chaque ligne la PROCHAINE ACTION — pas les métadonnées.
 * Aucun bouton flottant : les deux actions (carte, suivre une référence)
 * sont dans l'en-tête, à 44 px.
 */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ChevronRight, Map as MapIcon, Search as SearchIcon } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCargoShipments } from '@/hooks/useCargo';
import { ALERT, ALERT_ORDER, alertLevel, alertTally, type AlertLevel } from '@/lib/cargo/palette';
import { nextSteps } from '@/lib/cargo/todo';
import { CARRIER_LABEL, bestEta, daysUntilArrival, etaSlipDays, fmtDay } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { TEXT, TYPE, Button, Chip, IconButton, ScreenLoader, StatusPill, SURFACE, type Tone } from '@/mobile/designKit';

const TONE_OF: Record<AlertLevel, Tone> = { late: 'danger', watch: 'pending', ok: 'success', done: 'neutral' };

export function MobileCargoScreen() {
  const { hasPermission } = useAdminAuth();
  const navigate = useNavigate();
  const { data, isLoading } = useCargoShipments();
  const [filter, setFilter] = useState<AlertLevel | 'all'>('all');

  const all = useMemo(() => data ?? [], [data]);
  const tally = useMemo(() => alertTally(all), [all]);
  const rows = useMemo(() => {
    const list = filter === 'all' ? all : all.filter((s) => alertLevel(s) === filter);
    return [...list].sort((a, b) => {
      const d = ALERT[alertLevel(b)].rank - ALERT[alertLevel(a)].rank;
      if (d !== 0) return d;
      return (bestEta(a).date?.getTime() ?? Infinity) - (bestEta(b).date?.getTime() ?? Infinity);
    });
  }, [all, filter]);

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;

  return (
    <div className="flex min-h-full flex-col">
      <MobileHeader
        title="Cargo"
        subtitle={all.length > 0 ? `${all.length} conteneur${all.length > 1 ? 's' : ''} · ${tally.late} en retard` : undefined}
        rightElement={
          <>
            <IconButton icon={MapIcon} variant="subtle" onClick={() => navigate('/m/cargo/map')} ariaLabel="Carte des navires" />
            <IconButton icon={SearchIcon} variant="primary" onClick={() => navigate('/m/cargo/track')} ariaLabel="Suivre une référence" />
          </>
        }
      />

      {/* Ce qui brûle : la bande de chips filtre la liste. */}
      <div className="scrollbar-hide flex gap-2 overflow-x-auto px-4 pt-3">
        <Chip label="Tous" count={all.length} active={filter === 'all'} onClick={() => setFilter('all')} />
        {ALERT_ORDER.map((k) => (
          <Chip key={k} label={ALERT[k].label} count={tally[k]} active={filter === k} onClick={() => setFilter(filter === k ? 'all' : k)} />
        ))}
      </div>

      <div className="space-y-3 px-4 pt-3">
        {isLoading && <ScreenLoader />}
        {rows.map((s) => {
          const level = alertLevel(s);
          const eta = bestEta(s);
          const inDays = daysUntilArrival(s);
          const slip = etaSlipDays(s);
          const next = nextSteps(s).find((t) => t.level !== 'done');
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => navigate(`/m/cargo/${s.id}`)}
              className={cn('flex w-full items-center gap-3 rounded-lg p-4 text-left transition-colors active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.card, SURFACE.shadow)}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('min-w-0 truncate', TYPE.bodyStrong, TEXT.strong)}>{s.client_label}</span>
                  <StatusPill tone={TONE_OF[level]} label={ALERT[level].label} />
                </div>
                <div className={cn('mt-0.5 truncate tabular-nums', TYPE.small, TEXT.muted)}>
                  {s.container_number} · {CARRIER_LABEL[s.carrier] ?? s.carrier}
                </div>
                <div className={cn('mt-2 tabular-nums', TYPE.small, TEXT.strong)}>
                  {s.pod_name} · <b>{fmtDay(eta.date)}</b>
                  {inDays != null && <span className={TEXT.muted}> · {inDays > 0 ? `dans ${inDays} j` : inDays === 0 ? "aujourd'hui" : `il y a ${-inDays} j`}</span>}
                  {slip > 0 && <span className="text-[#975102] dark:text-[#E8B931]"> · +{slip} j</span>}
                </div>
                {next && (
                  <div className={cn('mt-1 truncate', TYPE.small, next.level === 'now' ? 'text-[#C00F0C] dark:text-[#EC221F]' : TEXT.muted)}>
                    → {next.label}
                  </div>
                )}
              </div>
              <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
            </button>
          );
        })}

        {!isLoading && rows.length === 0 && (
          <div className="flex flex-col items-center py-12 text-center">
            <p className={cn(TYPE.bodyStrong, TEXT.strong)}>{filter === 'all' ? 'Aucun conteneur suivi' : `Rien « ${ALERT[filter as AlertLevel].label.toLowerCase()} »`}</p>
            <p className={cn('mt-1 max-w-xs', TYPE.small, TEXT.muted)}>
              {filter === 'all' ? 'Un bill of lading, un booking ou un numéro de conteneur suffit pour commencer.' : 'Bonne nouvelle — change de filtre pour voir le reste.'}
            </p>
            {filter === 'all' && (
              <Button className="mt-4" onClick={() => navigate('/m/cargo/track')}>
                <SearchIcon /> Suivre une référence
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
