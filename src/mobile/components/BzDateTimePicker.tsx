// ============================================================
// BzDateTimePicker — calendrier + heure maison, langage design kit
// (remplace les <input type="datetime-local"> natifs, impossibles
// à styler et incohérents entre navigateurs).
//
// Anatomie (transposée du kit Figma « Simple Design System ») :
//   ‹  Août 2026 ▾  ›     ← chevrons + libellé tapable (vue mois/année)
//   lu ma me je ve sa di
//   grille de jours       ← sélection = carré plein accent, aujourd'hui
//                            = anneau, hors-mois/futur = estompé
//   🕐 [HH] : [MM]  [Maintenant]
//
// Valeur échangée au format datetime-local (YYYY-MM-DDTHH:mm) pour
// rester plug-compatible avec les wizards existants.
// ============================================================
import { useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT } from '@/mobile/designKit';

export const DAY_LABELS = ['lu', 'ma', 'me', 'je', 've', 'sa', 'di'];
export const MONTH_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];
export const pad = (n: number) => String(n).padStart(2, '0');

function parseValue(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Les 42 cases (6 semaines, lundi premier) du mois affiché. */
export function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // getDay(): 0 = dimanche → 0 = lundi
  const start = new Date(year, month, 1 - lead);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

interface BzDateTimePickerProps {
  /** Valeur au format datetime-local (YYYY-MM-DDTHH:mm) ou ''. */
  value: string;
  onChange: (value: string) => void;
  /** Couleur d'accent du module (violet paiements, vert dépôts). */
  accent: string;
  /** Interdit les jours après aujourd'hui (défaut true — antidatage). */
  disableFuture?: boolean;
}

export function BzDateTimePicker({ value, onChange, accent, disableFuture = true }: BzDateTimePickerProps) {
  const now = new Date();
  const selected = parseValue(value);
  const anchor = selected ?? now;
  const [view, setView] = useState<{ year: number; month: number }>({
    year: anchor.getFullYear(),
    month: anchor.getMonth(),
  });
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);

  const days = useMemo(() => monthGrid(view.year, view.month), [view]);

  // Aujourd'hui inclus ; seuls les jours STRICTEMENT futurs sont interdits.
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const commitDay = (day: Date) => {
    const base = selected ?? now;
    let next = new Date(day.getFullYear(), day.getMonth(), day.getDate(), base.getHours(), base.getMinutes());
    // Jour = aujourd'hui mais heure conservée future → rabat sur maintenant.
    if (disableFuture && next.getTime() > now.getTime() && sameDay(day, now)) next = now;
    onChange(toValue(next));
    setView({ year: day.getFullYear(), month: day.getMonth() });
  };

  const commitTime = (hours: number, minutes: number) => {
    const base = selected ?? now;
    let next = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hours, minutes);
    if (disableFuture && next.getTime() > now.getTime() && sameDay(base, now)) next = now;
    onChange(toValue(next));
  };

  const shiftMonth = (delta: number) => {
    const d = new Date(view.year, view.month + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  };

  // Le mois affiché peut-il avancer ? (pas au-delà du mois courant si futur interdit)
  const nextDisabled =
    disableFuture && (view.year > now.getFullYear() || (view.year === now.getFullYear() && view.month >= now.getMonth()));

  const navBtnCls = cn(
    'flex h-9 w-9 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-30',
    SURFACE.holder,
  );

  return (
    <div>
      {/* ── En-tête : ‹ Mois Année ▾ › ─────────────────────── */}
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Mois précédent" onClick={() => shiftMonth(-1)} className={navBtnCls}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setMonthPickerOpen((o) => !o)}
          className={cn('rounded-full px-3.5 py-1.5 text-[13px] font-bold transition active:scale-95', TEXT.strong)}
        >
          {MONTH_LABELS[view.month]} {view.year}
          <span className={cn('ml-1 text-[10px]', TEXT.muted)}>▾</span>
        </button>
        <button type="button" aria-label="Mois suivant" onClick={() => shiftMonth(1)} disabled={nextDisabled} className={navBtnCls}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {monthPickerOpen ? (
        /* ── Vue mois/année (12 tuiles + steppers année) ───── */
        <div className="mt-2">
          <div className="mb-2 flex items-center justify-center gap-3">
            <button type="button" aria-label="Année précédente" onClick={() => setView((v) => ({ ...v, year: v.year - 1 }))} className={navBtnCls}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className={cn('min-w-[64px] text-center text-[15px] font-extrabold tabular-nums', TEXT.strong)}>{view.year}</span>
            <button
              type="button"
              aria-label="Année suivante"
              onClick={() => setView((v) => ({ ...v, year: v.year + 1 }))}
              disabled={disableFuture && view.year >= now.getFullYear()}
              className={navBtnCls}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {MONTH_LABELS.map((label, m) => {
              const isCurrent = m === view.month;
              const disabled = disableFuture && (view.year > now.getFullYear() || (view.year === now.getFullYear() && m > now.getMonth()));
              return (
                <button
                  type="button"
                  key={label}
                  disabled={disabled}
                  onClick={() => { setView((v) => ({ ...v, month: m })); setMonthPickerOpen(false); }}
                  className={cn(
                    'rounded-xl py-2.5 text-[12px] font-bold transition active:scale-95 disabled:opacity-30',
                    isCurrent ? 'text-white' : cn(SURFACE.canvas, TEXT.strong),
                  )}
                  style={isCurrent ? { background: accent } : undefined}
                >
                  {label.slice(0, 4)}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* ── Grille des jours ──────────────────────────────── */
        <div className="mt-1.5">
          <div className="grid grid-cols-7">
            {DAY_LABELS.map((d) => (
              <div key={d} className={cn('py-1 text-center text-[11px] font-semibold', TEXT.muted)}>
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {days.map((day) => {
              const inMonth = day.getMonth() === view.month;
              const isToday = sameDay(day, now);
              const isSelected = !!selected && sameDay(day, selected);
              const disabled = disableFuture && day.getTime() > endOfToday.getTime();
              return (
                <button
                  type="button"
                  key={day.toISOString()}
                  disabled={disabled}
                  onClick={() => commitDay(day)}
                  className={cn(
                    'mx-auto flex h-9 w-9 items-center justify-center rounded-xl text-[13px] font-semibold transition active:scale-95',
                    isSelected ? 'text-white' : TEXT.strong,
                    !isSelected && !inMonth && 'opacity-35',
                    disabled && 'opacity-20',
                    !isSelected && !disabled && 'hover:bg-black/[0.05] dark:hover:bg-white/[0.07]',
                  )}
                  style={{
                    background: isSelected ? accent : undefined,
                    boxShadow: !isSelected && isToday ? `inset 0 0 0 1.5px ${accent}` : undefined,
                  }}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Heure ─────────────────────────────────────────── */}
      <div className="mt-2.5 flex items-center gap-2 border-t border-black/[0.06] pt-2.5 dark:border-white/[0.08]">
        <Clock className={cn('h-4 w-4 shrink-0', TEXT.muted)} />
        <input
          aria-label="Heure"
          className={cn('h-10 w-14 rounded-xl text-center text-[15px] font-extrabold tabular-nums outline-none', SURFACE.canvas, TEXT.strong, 'focus:ring-2 focus:ring-[#C9C2F0] dark:focus:ring-[#4A4660]')}
          value={selected ? pad(selected.getHours()) : '--'}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const h = parseInt(e.target.value.replace(/\D/g, '').slice(-2), 10);
            if (!Number.isNaN(h) && h >= 0 && h <= 23) commitTime(h, (selected ?? now).getMinutes());
          }}
          type="tel"
          inputMode="numeric"
        />
        <span className={cn('text-[15px] font-extrabold', TEXT.muted)}>:</span>
        <input
          aria-label="Minutes"
          className={cn('h-10 w-14 rounded-xl text-center text-[15px] font-extrabold tabular-nums outline-none', SURFACE.canvas, TEXT.strong, 'focus:ring-2 focus:ring-[#C9C2F0] dark:focus:ring-[#4A4660]')}
          value={selected ? pad(selected.getMinutes()) : '--'}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const m = parseInt(e.target.value.replace(/\D/g, '').slice(-2), 10);
            if (!Number.isNaN(m) && m >= 0 && m <= 59) commitTime((selected ?? now).getHours(), m);
          }}
          type="tel"
          inputMode="numeric"
        />
        <button
          type="button"
          onClick={() => { onChange(toValue(new Date())); setView({ year: now.getFullYear(), month: now.getMonth() }); setMonthPickerOpen(false); }}
          className={cn('ml-auto rounded-full px-3.5 py-2 text-[12px] font-bold transition active:scale-95', SURFACE.holder)}
        >
          Maintenant
        </button>
      </div>
    </div>
  );
}

/** « 19/08/2026 à 03:50 » pour le déclencheur du champ replié. */
function formatValueLabel(value: string): string | null {
  const d = parseValue(value);
  if (!d) return null;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} à ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface BzDateTimeFieldProps {
  /** Valeur au format datetime-local (YYYY-MM-DDTHH:mm) ou ''. */
  value: string;
  onChange: (value: string) => void;
  accent: string;
  disableFuture?: boolean;
  placeholder?: string;
}

/**
 * Variante « champ » compacte : un déclencheur qui affiche la date
 * choisie et déplie le BzDateTimePicker en dessous — pour les
 * formulaires denses (trésorerie, taux) où le calendrier ne doit pas
 * occuper l'écran en permanence.
 */
export function BzDateTimeField({ value, onChange, accent, disableFuture = true, placeholder = 'Choisir une date' }: BzDateTimeFieldProps) {
  const [open, setOpen] = useState(false);
  const label = formatValueLabel(value);
  return (
    <div className={cn('rounded-2xl', SURFACE.canvas)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-full items-center gap-2.5 px-3.5"
      >
        <CalendarDays className="h-4 w-4 shrink-0" style={{ color: accent }} />
        <span className={cn('flex-1 text-left text-[14px] font-semibold', label ? TEXT.strong : TEXT.muted)}>
          {label ?? placeholder}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', TEXT.muted, open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-3 pb-3">
          <div className={cn('rounded-2xl p-3', SURFACE.card)}>
            <BzDateTimePicker value={value} onChange={onChange} accent={accent} disableFuture={disableFuture} />
          </div>
        </div>
      )}
    </div>
  );
}
