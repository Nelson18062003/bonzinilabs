/**
 * Sélecteur date + heure — Calendar et Popover shadcn.
 *
 * Remplace, sur les écrans admin desktop, le `OccurredAtField` maison (fond
 * lilas, pastille arrondie, géométrie tactile) : c'était le dernier composant
 * hors design system. Ici tout vient de `@/components/ui` — le calendrier est
 * react-day-picker via `Calendar`, la surface est un `Popover`.
 *
 * Contrat conservé de l'ancien champ : valeur ISO en entrée/sortie, bouton
 * « Maintenant », et interdiction du futur pour une date d'opération (on ne
 * saisit pas une opération qui n'a pas eu lieu).
 */
import * as React from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarIcon, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function DateTimePicker({
  value,
  onChange,
  disableFuture = true,
  id,
  className,
}: {
  /** ISO 8601. */
  value: string;
  onChange: (iso: string) => void;
  disableFuture?: boolean;
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const parsed = React.useMemo(() => {
    const d = parseISO(value);
    return isValid(d) ? d : new Date();
  }, [value]);

  /** Recompose l'ISO en gardant l'heure quand on change le jour, et l'inverse. */
  const commit = (next: Date) => onChange(next.toISOString());

  // Le champ heure garde sa propre chaîne pendant la frappe (« 1 », « 14: »…)
  // et se recale sur la valeur au blur.
  const [timeText, setTimeText] = React.useState(() => format(parsed, 'HH:mm'));
  React.useEffect(() => {
    setTimeText(format(parsed, 'HH:mm'));
  }, [parsed]);

  const onPickDay = (day: Date | undefined) => {
    if (!day) return;
    const next = new Date(day);
    next.setHours(parsed.getHours(), parsed.getMinutes(), 0, 0);
    commit(next);
  };

  const onPickTime = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return;
    const next = new Date(parsed);
    next.setHours(h, m, 0, 0);
    commit(next);
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} variant="outline" size="compact" className="flex-1 justify-start font-normal">
            <CalendarIcon className="mr-2 opacity-60" />
            {format(parsed, 'd MMMM yyyy', { locale: fr })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={parsed}
            onSelect={(d) => {
              onPickDay(d);
              setOpen(false);
            }}
            disabled={disableFuture ? { after: new Date() } : undefined}
            defaultMonth={parsed}
            locale={fr}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      <div className="relative">
        <Clock className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 opacity-60" />
        {/* Champ texte HH:mm plutôt que `input type="time"` : le rendu natif
            suit la locale du NAVIGATEUR, pas celle de la page — une session
            en anglais affichait « 03:43 AM » au milieu d'une interface
            entièrement française. Ici le format 24 h est le même partout. */}
        <Input
          inputMode="numeric"
          aria-label="Heure de l'opération (24 h, HH:mm)"
          placeholder="HH:mm"
          value={timeText}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^\d:]/g, '').slice(0, 5);
            setTimeText(raw);
            if (/^([01]\d|2[0-3]):[0-5]\d$/.test(raw)) onPickTime(raw);
          }}
          onBlur={() => setTimeText(format(parsed, 'HH:mm'))}
          className="w-[104px] pl-8 tabular-nums"
        />
      </div>

      <Button
        type="button"
        variant="ghost"
        size="compact"
        onClick={() => commit(new Date())}
        title="Mettre à maintenant"
      >
        Maintenant
      </Button>
    </div>
  );
}
