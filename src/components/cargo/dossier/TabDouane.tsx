/**
 * Onglet Douane & arrivée — les étapes camerounaises.
 *
 * Aucun armateur ne publie ces dates : elles sont saisies depuis l'avis
 * d'arrivée et les papiers de douane. La fin de franchise est la seule qui
 * coûte de l'argent à l'heure près — elle est donc mise en avant.
 */
import { differenceInCalendarDays } from 'date-fns';
import { AlertTriangle, CheckCircle2, Circle } from 'lucide-react';
import { DateField, TextField } from '@/components/form';
import { useUpdateCargoShipment } from '@/hooks/useCargo';
import { Fact, Facts, Section } from '@/components/cargo/dossier/kit';
import { ARRIVAL_STEPS, fmtDayFull } from '@/lib/cargo/model';
import type { CargoShipment } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { TEXT } from '@/desktop/designKit';

/** Une date de jalon : lecture si on ne peut pas écrire, champ sinon. */
function StepRow({
  label, hint, value, isDay, canManage, onChange,
}: {
  label: string; hint: string; value: string | null; isDay: boolean; canManage: boolean;
  onChange: (iso: string | null) => void;
}) {
  const done = !!value;
  const asDay = value ? value.slice(0, 10) : '';
  return (
    <div className="flex items-start justify-between gap-4 border-t border-black/[0.06] py-3 first:border-t-0 first:pt-0 dark:border-white/[0.06]">
      <div className="flex min-w-0 items-start gap-2.5">
        {done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> : <Circle className={cn('mt-0.5 h-4 w-4 shrink-0', TEXT.muted)} />}
        <div className="min-w-0">
          <div className={cn('text-[13px] font-semibold', done ? TEXT.strong : TEXT.body)}>{label}</div>
          <p className={cn('mt-0.5 text-[11.5px]', TEXT.muted)}>{hint}</p>
        </div>
      </div>
      <div className="w-[170px] shrink-0">
        {canManage ? (
          <DateField
            id={`cargo-step-${label.replace(/\W+/g, '-').toLowerCase()}`}
            size="sm"
            value={asDay}
            onChange={(e) => {
              const v = e.target.value;
              onChange(v ? (isDay ? v : `${v}T12:00:00Z`) : null);
            }}
          />
        ) : (
          <div className={cn('text-right text-[13px] font-semibold tabular-nums', TEXT.strong)}>{value ? fmtDayFull(new Date(value)) : '—'}</div>
        )}
      </div>
    </div>
  );
}

export function TabDouane({ shipment: s, canManage }: { shipment: CargoShipment; canManage: boolean }) {
  const update = useUpdateCargoShipment();
  const patch = (p: Record<string, unknown>) => update.mutate({ id: s.id, patch: p });

  const freeTime = s.free_time_ends_on ? new Date(s.free_time_ends_on + 'T12:00:00') : null;
  const daysLeft = freeTime ? differenceInCalendarDays(freeTime, new Date()) : null;
  const overdue = daysLeft != null && daysLeft < 0 && !s.gate_out_at;
  const soon = daysLeft != null && daysLeft >= 0 && daysLeft <= 3 && !s.gate_out_at;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-5 max-lg:grid-cols-1">
      <Section
        title="Étapes au Cameroun"
        meta={canManage ? 'saisie manuelle' : undefined}
      >
        {ARRIVAL_STEPS.map((st) => (
          <StepRow
            key={st.key}
            label={st.label}
            hint={st.hint}
            value={(s[st.key] as string | null) ?? null}
            isDay={st.key === 'free_time_ends_on'}
            canManage={canManage}
            onChange={(iso) => patch({ [st.key]: iso })}
          />
        ))}
      </Section>

      <div className="space-y-5">
        {(overdue || soon) && (
          <div className={cn('flex items-start gap-2.5 rounded-[14px] px-4 py-3', overdue ? 'bg-destructive/10' : 'bg-amber-500/10')}>
            <AlertTriangle className={cn('mt-0.5 h-4 w-4 shrink-0', overdue ? 'text-destructive' : 'text-amber-700 dark:text-amber-400')} />
            <div>
              <p className={cn('text-[13px] font-bold', overdue ? 'text-destructive' : 'text-amber-800 dark:text-amber-300')}>
                {overdue ? `Franchise dépassée de ${-daysLeft!} jour${-daysLeft! > 1 ? 's' : ''}` : `Franchise finie dans ${daysLeft} jour${daysLeft! > 1 ? 's' : ''}`}
              </p>
              <p className={cn('mt-0.5 text-[12px]', TEXT.body)}>
                {overdue ? 'Les surestaries et le stockage courent chaque jour. Sortir la boîte est prioritaire.' : 'Au-delà, les surestaries commencent à courir.'}
              </p>
            </div>
          </div>
        )}

        <Section title="Références">
          {canManage ? (
            <div className="space-y-3">
              <div>
                <div className={cn('mb-1.5 text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>Numéro BESC</div>
                <TextField id="cargo-besc" size="sm" defaultValue={s.besc_number ?? ''} onBlur={(e) => { const v = e.target.value.trim(); if (v !== (s.besc_number ?? '')) patch({ besc_number: v || null }); }} placeholder="BESC-…" />
              </div>
              <div>
                <div className={cn('mb-1.5 text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>Déclaration en douane</div>
                <TextField id="cargo-decl" size="sm" defaultValue={s.customs_declaration_ref ?? ''} onBlur={(e) => { const v = e.target.value.trim(); if (v !== (s.customs_declaration_ref ?? '')) patch({ customs_declaration_ref: v || null }); }} placeholder="n° de déclaration" />
              </div>
            </div>
          ) : (
            <Facts cols={2}>
              <Fact label="BESC" value={s.besc_number ?? '—'} />
              <Fact label="Déclaration" value={s.customs_declaration_ref ?? '—'} />
            </Facts>
          )}
        </Section>

        <Section title="Ce que le Cameroun exige">
          <p className={cn('text-[12.5px] leading-relaxed', TEXT.body)}>
            Le <b>BESC</b> doit être ouvert avant l'arrivée : sans lui, la déclaration est refusée et une pénalité s'applique.
            La <b>franchise</b> accordée par l'armateur court à partir du déchargement ; passée cette date, surestaries
            (armateur) et stockage (port) se cumulent. Le <b>bon à enlever</b> n'est délivré qu'une fois la douane liquidée
            et les frais de port réglés.
          </p>
        </Section>
      </div>
    </div>
  );
}
