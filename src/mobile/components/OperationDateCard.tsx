// ============================================================
// OperationDateCard — « Date de l'opération » pour les wizards
// admin (nouveau dépôt / nouveau paiement).
//
// Par défaut l'opération est datée de « maintenant » ; le toggle
// ouvre un champ datetime-local pour antidater une opération
// enregistrée après coup (ex. dépôt reçu il y a quelques jours).
// Le futur est bloqué ici (attribut max) ET à la soumission via
// resolveOperationDate — le champ seul ne suffit pas, la page
// peut rester ouverte au-delà du max affiché.
// ============================================================
import { cn } from '@/lib/utils';
import { TEXT, Card } from '@/mobile/designKit';
import { BzDateTimePicker } from '@/mobile/components/BzDateTimePicker';

/** Date → valeur locale pour <input type="datetime-local"> (YYYY-MM-DDTHH:mm). */
export function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Valide et résout la date d'opération choisie.
 * Retourne `undefined` quand on garde « maintenant », la Date choisie
 * sinon, ou une erreur affichable si elle est invalide / dans le futur.
 */
export function resolveOperationDate(
  enabled: boolean,
  value: string,
): { date?: Date; error?: string } {
  if (!enabled || !value) return {};
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { error: "Date d'opération invalide." };
  if (date.getTime() > Date.now() + 60_000) {
    return { error: "La date de l'opération ne peut pas être dans le futur." };
  }
  return { date };
}

interface OperationDateCardProps {
  enabled: boolean;
  value: string;
  onToggle: (enabled: boolean, defaultValue: string) => void;
  onChange: (value: string) => void;
  /** Couleur d'accent du module (violet paiements, vert dépôts). */
  accent: string;
  className?: string;
}

export function OperationDateCard({ enabled, value, onToggle, onChange, accent, className }: OperationDateCardProps) {
  const nowLocal = toDatetimeLocal(new Date());
  return (
    <Card className={cn('p-3.5', className)}>
      <div className="flex items-center justify-between">
        <div>
          <div className={cn('text-[13px] font-bold', TEXT.strong)}>Date de l&apos;opération</div>
          {!enabled && (
            <div className={cn('mt-0.5 text-[11px]', TEXT.muted)}>
              Maintenant — activez pour antidater
            </div>
          )}
        </div>
        <button
          onClick={() => onToggle(!enabled, nowLocal)}
          aria-label="Choisir la date de l'opération"
          className="relative h-[26px] w-11 shrink-0 rounded-full transition-colors"
          style={{ background: enabled ? accent : 'rgba(0,0,0,0.18)' }}
        >
          <span
            className="absolute top-0.5 h-[22px] w-[22px] rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,.18)] transition-all"
            style={{ left: enabled ? 20 : 2 }}
          />
        </button>
      </div>

      {enabled && (
        <div className="mt-2.5 border-t border-black/[0.06] pt-2.5 dark:border-white/[0.08]">
          <BzDateTimePicker value={value} onChange={onChange} accent={accent} />
          <p className={cn('mt-2 text-[11px]', TEXT.muted)}>
            L&apos;opération sera enregistrée à cette date (passée uniquement).
          </p>
        </div>
      )}
    </Card>
  );
}
