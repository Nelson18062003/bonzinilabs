/**
 * « La douane et l'arrivée » — six étapes camerounaises, en phrases.
 *
 * Aucun armateur ne publie ces dates : c'est l'admin qui les note, souvent
 * depuis le port. Donc un geste par étape : « C'est fait aujourd'hui », et
 * une date si c'était un autre jour. La fin de franchise est la seule qui
 * coûte de l'argent chaque jour : elle est dite en clair, en ambre puis en
 * rouge.
 */
import { useState } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { CheckCircle2, Circle } from 'lucide-react';
import { useUpdateCargoShipment } from '@/hooks/useCargo';
import { ARRIVAL_STEPS } from '@/lib/cargo/model';
import type { CargoShipment } from '@/lib/cargo/model';
import { fmtDayLong, plural } from '@/lib/cargo/plain';
import { cn } from '@/lib/utils';
import { TEXT, SURFACE, Button, FormField, TextInput } from '@/mobile/designKit';

/** Ce que chaque étape veut dire, en une phrase. */
const WHY: Record<string, string> = {
  arrival_notice_at: "Le consignataire prévient que le conteneur est déchargé. À partir de là, tout commence.",
  free_time_ends_on: "Jusqu'à cette date, le port et l'armateur ne facturent rien. Après, chaque jour coûte.",
  customs_cleared_at: 'La déclaration est acceptée et les droits sont payés.',
  delivery_order_at: 'Le port autorise la sortie du conteneur.',
  gate_out_at: 'Le conteneur est sorti du port, sur un camion.',
  empty_returned_at: "Le conteneur vide est rendu à l'armateur. Plus rien ne court.",
};

export function MobileDouane({ shipment: s, canManage }: { shipment: CargoShipment; canManage: boolean }) {
  const update = useUpdateCargoShipment();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const patch = (p: Record<string, unknown>) => update.mutate({ id: s.id, patch: p });
  const today = new Date().toISOString().slice(0, 10);

  const freeTime = s.free_time_ends_on ? new Date(s.free_time_ends_on + 'T12:00:00') : null;
  const daysLeft = freeTime ? differenceInCalendarDays(freeTime, new Date()) : null;
  const overdue = daysLeft != null && daysLeft < 0 && !s.gate_out_at;
  const soon = daysLeft != null && daysLeft >= 0 && daysLeft <= 3 && !s.gate_out_at;

  return (
    <div className="space-y-5">
      {overdue && (
        <p className="rounded-lg bg-[#FDD3D0] p-3 text-[16px] font-semibold leading-snug text-[#900B09] dark:bg-[#900B09] dark:text-[#FDD3D0]">
          La franchise est dépassée depuis {plural(-daysLeft!, 'jour')} : chaque jour au port coûte. Sortir le conteneur est la priorité.
        </p>
      )}
      {soon && (
        <p className="rounded-lg bg-[#FFF1C2] p-3 text-[16px] font-semibold leading-snug text-[#682D03] dark:bg-[#522504] dark:text-[#FFF1C2]">
          La franchise finit {daysLeft === 0 ? "aujourd'hui" : `dans ${plural(daysLeft!, 'jour')}`}. Après, les surestaries commencent.
        </p>
      )}

      <ul className="space-y-5">
        {ARRIVAL_STEPS.map((st) => {
          const value = (s[st.key] as string | null) ?? null;
          const isDay = st.key === 'free_time_ends_on';
          const done = !!value;
          const date = value ? new Date(isDay ? value + 'T12:00:00' : value) : null;
          const isEditing = editing === st.key;
          const save = (day: string) => { if (!day) return; patch({ [st.key]: isDay ? day : `${day}T12:00:00Z` }); setEditing(null); };
          return (
            <li key={st.key} className={cn('space-y-2 border-t pt-4 first:border-t-0 first:pt-0', SURFACE.divider)}>
              <div className="flex items-start gap-3">
                {done
                  ? <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-[#009951] dark:text-[#14AE5C]" />
                  : <Circle className="mt-0.5 h-6 w-6 shrink-0 text-[#B3B3B3]" />}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className={cn('text-[18px] font-semibold leading-snug', TEXT.strong)}>
                    {st.label}{date ? ` — le ${fmtDayLong(date)}` : isDay ? ' — date inconnue' : ' — pas encore'}
                  </p>
                  <p className={cn('text-[16px] leading-relaxed', TEXT.muted)}>{WHY[st.key] ?? st.hint}</p>
                </div>
              </div>

              {canManage && (
                <div className="ml-9 space-y-2">
                  {isEditing ? (
                    <div className="space-y-2">
                      <FormField label={isDay ? 'Dernier jour de franchise' : 'Quel jour ?'} htmlFor={`step-${st.key}`}>
                        <TextInput id={`step-${st.key}`} type="date" value={draft} onChange={(e) => setDraft(e.target.value)} />
                      </FormField>
                      <div className="flex gap-2">
                        <Button variant="neutral" className="flex-1" onClick={() => setEditing(null)}>Annuler</Button>
                        <Button className="flex-1" disabled={!draft} loading={update.isPending} onClick={() => save(draft)}>Enregistrer</Button>
                      </div>
                    </div>
                  ) : done ? (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="subtle" size="sm" onClick={() => { setDraft(value!.slice(0, 10)); setEditing(st.key); }}>Changer la date</Button>
                      {!isDay && <Button variant="dangerSubtle" size="sm" onClick={() => patch({ [st.key]: null })}>Ce n'est pas fait</Button>}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {!isDay && <Button variant="neutral" onClick={() => save(today)} loading={update.isPending}>C'est fait aujourd'hui</Button>}
                      <Button variant="subtle" onClick={() => { setDraft(isDay ? '' : today); setEditing(st.key); }}>{isDay ? 'Noter la date' : 'Un autre jour'}</Button>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className={cn('space-y-3 border-t pt-4', SURFACE.divider)}>
        <p className={cn('text-[16px] leading-relaxed', TEXT.body)}>
          Numéro de BESC : <b>{s.besc_number ?? 'pas encore noté'}</b>. Déclaration en douane : <b>{s.customs_declaration_ref ?? 'pas encore notée'}</b>.
        </p>
        {canManage && (
          <div className="grid grid-cols-1 gap-3">
            <FormField label="Numéro de BESC" htmlFor="cargo-besc">
              <TextInput id="cargo-besc" defaultValue={s.besc_number ?? ''} placeholder="BESC-…" onBlur={(e) => { const v = e.target.value.trim(); if (v !== (s.besc_number ?? '')) patch({ besc_number: v || null }); }} />
            </FormField>
            <FormField label="Numéro de la déclaration en douane" htmlFor="cargo-decl">
              <TextInput id="cargo-decl" defaultValue={s.customs_declaration_ref ?? ''} placeholder="n° de déclaration" onBlur={(e) => { const v = e.target.value.trim(); if (v !== (s.customs_declaration_ref ?? '')) patch({ customs_declaration_ref: v || null }); }} />
            </FormField>
          </div>
        )}
      </div>

      <p className={cn('text-[16px] leading-relaxed', TEXT.muted)}>
        Le BESC doit être ouvert avant l'arrivée, sinon la déclaration est refusée et une pénalité s'ajoute. Le bon à enlever n'est donné qu'une fois la douane payée et les frais de port réglés.
      </p>
    </div>
  );
}
