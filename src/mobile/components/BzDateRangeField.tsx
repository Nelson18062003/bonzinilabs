// ============================================================
// BzDateRangeField — filtre « Période » (de → à) au calendrier
// design kit ; remplace les paires d'<input type="date"> natifs
// des listes (dépôts, paiements, trésorerie, analytics).
//
// Interaction : 1er tap = début, 2e tap = fin (réordonnés si
// besoin), 3e tap = nouveau début. Bornes = carrés pleins accent,
// jours intermédiaires = bandeau teinté.
//
// Valeurs échangées en 'YYYY-MM-DD' (le format des états de
// filtres existants) ; '' = non défini.
// ============================================================
import { useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT } from '@/mobile/designKit';
import { DAY_LABELS, MONTH_LABELS, monthGrid, pad, sameDay } from '@/mobile/components/BzDateTimePicker';

export interface DateRange {
  /** 'YYYY-MM-DD' ou ''. */
  from: string;
  /** 'YYYY-MM-DD' ou ''. */
  to: string;
}

function parseDay(v: string): Date | null {
  if (!v) return null;
  const [y, m, d] = v.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

const toDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const frDay = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

interface BzDateRangeFieldProps {
  value: DateRange;
  onChange: (value: DateRange) => void;
  /** Couleur d'accent du module. */
  accent: string;
  /** Interdit les jours après aujourd'hui (défaut true — on filtre du passé). */
  disableFuture?: boolean;
  placeholder?: string;
  /** Ouvre le calendrier dès le rendu (filtres déjà dans une section dédiée). */
  defaultOpen?: boolean;
}

export function BzDateRangeField({
  value,
  onChange,
  accent,
  disableFuture = true,
  placeholder = 'Choisir une période',
  defaultOpen = false,
}: BzDateRangeFieldProps) {
  const now = new Date();
  const from = parseDay(value.from);
  const to = parseDay(value.to);
  const [open, setOpen] = useState(defaultOpen);
  const [view, setView] = useState<{ year: number; month: number }>(() => {
    const anchor = to ?? from ?? now;
    return { year: anchor.getFullYear(), month: anchor.getMonth() };
  });

  const days = useMemo(() => monthGrid(view.year, view.month), [view]);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const pick = (day: Date) => {
    if (!from || (from && to)) {
      onChange({ from: toDay(day), to: '' });
      return;
    }
    // 2e borne — réordonne si l'utilisateur a tapé « à » avant « de »
    if (day.getTime() < from.getTime()) onChange({ from: toDay(day), to: toDay(from) });
    else onChange({ from: toDay(from), to: toDay(day) });
  };

  const shiftMonth = (delta: number) => {
    const d = new Date(view.year, view.month + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  };
  const nextDisabled =
    disableFuture && (view.year > now.getFullYear() || (view.year === now.getFullYear() && view.month >= now.getMonth()));

  const label =
    from && to ? `${frDay(from)} → ${frDay(to)}`
    : from ? `${frDay(from)} → …`
    : null;

  const navBtnCls = cn(
    'flex h-8 w-8 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-30',
    SURFACE.holder,
  );

  return (
    <div className={cn('rounded-2xl', SURFACE.canvas)}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex h-11 w-full items-center gap-2.5 px-3.5">
        <CalendarDays className="h-4 w-4 shrink-0" style={{ color: accent }} />
        <span className={cn('flex-1 text-left text-[13px] font-semibold', label ? TEXT.strong : TEXT.muted)}>
          {label ?? placeholder}
        </span>
        {(value.from || value.to) && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Effacer la période"
            onClick={(e) => { e.stopPropagation(); onChange({ from: '', to: '' }); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onChange({ from: '', to: '' }); } }}
            className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', SURFACE.holder)}
          >
            Effacer
          </span>
        )}
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', TEXT.muted, open && 'rotate-180')} />
      </button>

      {open && (
        <div className="px-3 pb-3">
          <div className={cn('rounded-2xl p-3', SURFACE.card)}>
            <div className="flex items-center justify-between">
              <button type="button" aria-label="Mois précédent" onClick={() => shiftMonth(-1)} className={navBtnCls}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className={cn('text-[13px] font-bold', TEXT.strong)}>
                {MONTH_LABELS[view.month]} {view.year}
              </span>
              <button type="button" aria-label="Mois suivant" onClick={() => shiftMonth(1)} disabled={nextDisabled} className={navBtnCls}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-1 grid grid-cols-7">
              {DAY_LABELS.map((d) => (
                <div key={d} className={cn('py-1 text-center text-[11px] font-semibold', TEXT.muted)}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5">
              {days.map((day) => {
                const inMonth = day.getMonth() === view.month;
                const disabled = disableFuture && day.getTime() > endOfToday.getTime();
                const isFrom = !!from && sameDay(day, from);
                const isTo = !!to && sameDay(day, to);
                const inBetween =
                  !!from && !!to && day.getTime() > from.getTime() && day.getTime() < to.getTime();
                const isEdge = isFrom || isTo;
                return (
                  <div
                    key={day.toISOString()}
                    className="relative flex justify-center"
                    style={inBetween || (isEdge && from && to && !sameDay(from, to)) ? {
                      background: `${accent}1f`,
                      borderTopLeftRadius: isFrom ? 12 : 0,
                      borderBottomLeftRadius: isFrom ? 12 : 0,
                      borderTopRightRadius: isTo ? 12 : 0,
                      borderBottomRightRadius: isTo ? 12 : 0,
                    } : undefined}
                  >
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => pick(day)}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-xl text-[12px] font-semibold transition active:scale-95',
                        isEdge ? 'text-white' : TEXT.strong,
                        !isEdge && !inMonth && 'opacity-35',
                        disabled && 'opacity-20',
                        !isEdge && !disabled && 'hover:bg-black/[0.05] dark:hover:bg-white/[0.07]',
                      )}
                      style={{
                        background: isEdge ? accent : undefined,
                        boxShadow: !isEdge && sameDay(day, now) ? `inset 0 0 0 1.5px ${accent}` : undefined,
                      }}
                    >
                      {day.getDate()}
                    </button>
                  </div>
                );
              })}
            </div>
            {from && !to && (
              <p className={cn('mt-1.5 text-center text-[11px]', TEXT.muted)}>Choisissez la date de fin</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
