/**
 * Mobile admin — Cargo : ce qui brûle, en quatre lignes par conteneur.
 *
 * Pour quelqu'un de 50–60 ans, debout, au soleil (05-simplicite.md) :
 * rien sous 16 px, texte foncé, aucune coupure, une idée par ligne —
 *   1. le client, et l'état en un mot
 *   2. « Arrive à Kribi le 11 octobre, dans 28 jours »
 *   3. « Retard de 14 jours » — seulement s'il y en a un
 *   4. « À faire : régler le fret au transitaire » — la prochaine, une seule
 * Le numéro de boîte n'apparaît que si le client a plusieurs boîtes.
 */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ChevronRight, Map as MapIcon, Search as SearchIcon } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCargoShipments } from '@/hooks/useCargo';
import { ALERT, ALERT_ORDER, alertLevel, alertTally, type AlertLevel } from '@/lib/cargo/palette';
import { arrivalSentence, delaySentence, nextActionSentence, plural } from '@/lib/cargo/plain';
import { bestEta } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { TEXT, TYPE, Button, IconButton, ScreenLoader, StatusPill, SURFACE, type Tone } from '@/mobile/designKit';

const TONE_OF: Record<AlertLevel, Tone> = { late: 'danger', watch: 'pending', ok: 'success', done: 'neutral' };

export function MobileCargoScreen() {
  const { hasPermission } = useAdminAuth();
  const navigate = useNavigate();
  const { data, isLoading } = useCargoShipments();
  const [filter, setFilter] = useState<AlertLevel | 'all'>('all');

  const all = useMemo(() => data ?? [], [data]);
  const tally = useMemo(() => alertTally(all), [all]);
  // Trois cartes « PRC » identiques ne se distinguent pas : quand un client a
  // plusieurs boîtes, on écrit le numéro de boîte sous son nom.
  const dupes = useMemo(() => {
    const n = new Map<string, number>();
    for (const s of all) n.set(s.client_label, (n.get(s.client_label) ?? 0) + 1);
    return n;
  }, [all]);
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
        subtitle={all.length > 0 ? `${plural(all.length, 'conteneur')}${tally.late > 0 ? ` · ${tally.late} en retard` : ''}` : undefined}
        rightElement={
          <>
            <IconButton icon={MapIcon} variant="subtle" onClick={() => navigate('/m/cargo/map')} ariaLabel="Voir la carte des navires" />
            <IconButton icon={SearchIcon} variant="primary" onClick={() => navigate('/m/cargo/track')} ariaLabel="Chercher une référence" />
          </>
        }
      />

      {/* Les filtres : gros, à 40 px, avec le compte dans le mot. */}
      <div className="scrollbar-hide flex gap-2 overflow-x-auto px-4 pt-3">
        {([['all', 'Tous', all.length], ...ALERT_ORDER.map((k) => [k, ALERT[k].label, tally[k]] as const)] as const).map(([k, label, n]) => {
          const active = filter === k;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(active && k !== 'all' ? 'all' : (k as AlertLevel | 'all'))}
              className={cn(
                'inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-[16px] font-semibold transition-colors',
                active ? 'bg-[#2C2C2C] text-[#F5F5F5] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]' : 'bg-[#F5F5F5] text-[#1E1E1E] dark:bg-[#383838] dark:text-[#F5F5F5]',
              )}
            >
              {label}<span className={cn('tabular-nums', active ? 'opacity-70' : TEXT.muted)}>{n}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-3 px-4 pt-3">
        {isLoading && <ScreenLoader />}
        {rows.map((s) => {
          const level = alertLevel(s);
          const delay = delaySentence(s);
          const next = nextActionSentence(s);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => navigate(`/m/cargo/${s.id}`)}
              className={cn('flex w-full items-center gap-3 rounded-lg p-4 text-left transition-colors active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.card, SURFACE.shadow)}
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className={cn('break-words', TYPE.title, TEXT.strong)}>{s.client_label}</span>
                  <StatusPill tone={TONE_OF[level]} label={ALERT[level].label} />
                </div>
                {(dupes.get(s.client_label) ?? 0) > 1 && <p className={cn('text-[16px] leading-snug tabular-nums', TEXT.muted)}>{s.container_number}</p>}
                <p className={cn('text-[16px] leading-snug', TEXT.strong)}>{arrivalSentence(s)}</p>
                {delay && <p className="text-[16px] font-semibold leading-snug text-[#975102] dark:text-[#E8B931]">{delay}</p>}
                {next && <p className={cn('text-[16px] leading-snug', level === 'late' ? 'text-[#C00F0C] dark:text-[#EC221F]' : TEXT.muted)}>{next}</p>}
              </div>
              <ChevronRight className={cn('h-6 w-6 shrink-0', TEXT.muted)} />
            </button>
          );
        })}

        {!isLoading && rows.length === 0 && (
          <div className="flex flex-col items-center py-12 text-center">
            <p className={cn(TYPE.lead, TEXT.strong)}>{filter === 'all' ? 'Aucun conteneur suivi' : 'Aucun conteneur dans cet état'}</p>
            <p className={cn('mt-2 max-w-xs text-[16px]', TEXT.muted)}>
              {filter === 'all' ? 'Un numéro de bill of lading ou de conteneur suffit pour commencer.' : 'Bonne nouvelle. Touche « Tous » pour revoir la flotte.'}
            </p>
            {filter === 'all' && (
              <Button className="mt-4" onClick={() => navigate('/m/cargo/track')}>
                <SearchIcon /> Chercher une référence
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
