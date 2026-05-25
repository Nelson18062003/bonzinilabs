import * as React from 'react';
import { Clock } from 'lucide-react';
import { DateField } from './DateField';
import { cn } from '@/lib/utils';

interface OccurredAtFieldProps {
  label?: string;
  /** ISO string (UTC). */
  value: string;
  onChange: (iso: string) => void;
}

/** ISO (UTC) → "YYYY-MM-DDTHH:mm" in the browser's local time, for datetime-local. */
function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "YYYY-MM-DDTHH:mm" local → ISO (UTC). */
function localInputToIso(local: string): string {
  if (!local) return new Date().toISOString();
  return new Date(local).toISOString();
}

/**
 * Date + time picker for the moment an operation occurred. Defaults to now,
 * with a one-tap "Maintenant" reset and a native datetime-local picker so
 * the operator can back-date a purchase/sale to its real timestamp.
 */
export function OccurredAtField({ label = "Date / heure de l'opération", value, onChange }: OccurredAtFieldProps) {
  const localValue = isoToLocalInput(value);
  const nowLocal = isoToLocalInput(new Date().toISOString());
  const isNow = Math.abs(new Date(value).getTime() - Date.now()) < 60_000; // within 1 min

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[13px] font-semibold">{label}</label>
        <button
          type="button"
          onClick={() => onChange(new Date().toISOString())}
          className={cn(
            'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border-2 transition-colors',
            isNow
              ? 'border-violet-600 bg-violet-50 text-violet-700'
              : 'border-border bg-white text-muted-foreground',
          )}
        >
          <Clock className="w-3 h-3" />
          Maintenant
        </button>
      </div>
      <DateField
        dateType="datetime-local"
        value={localValue}
        max={nowLocal}
        onChange={(e) => onChange(localInputToIso(e.target.value))}
      />
    </div>
  );
}
