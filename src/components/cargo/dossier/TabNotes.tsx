/** Onglet Notes — ce que l'équipe doit savoir, et l'état technique du dossier. */
import { useEffect, useState } from 'react';
import { TextArea } from '@/components/form';
import { useUpdateCargoShipment } from '@/hooks/useCargo';
import { Fact, Facts, Section } from '@/components/cargo/dossier/kit';
import { CARRIER_LABEL, fmtDayTime } from '@/lib/cargo/model';
import type { CargoShipment } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';

export function TabNotes({ shipment: s, canManage }: { shipment: CargoShipment; canManage: boolean }) {
  const update = useUpdateCargoShipment();
  const [notes, setNotes] = useState(s.notes ?? '');
  useEffect(() => { setNotes(s.notes ?? ''); }, [s.id, s.notes]);
  const save = () => { if ((s.notes ?? '') !== notes) update.mutate({ id: s.id, patch: { notes: notes || null } }); };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-5 max-lg:grid-cols-1">
      <Section title="Note interne" meta={canManage ? 'enregistrée en quittant le champ' : 'lecture seule'}>
        <TextArea
          id={`cargo-notes-${s.id}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={save}
          readOnly={!canManage}
          rows={10}
          placeholder="Ce qu'il faut savoir sur ce dossier : quel transitaire, quel interlocuteur, quel incident, ce qui a été promis au client…"
        />
      </Section>

      <Section title="État du dossier">
        <Facts cols={2}>
          <Fact label="Créé le" value={fmtDayTime(new Date(s.created_at))} />
          <Fact label="Modifié le" value={fmtDayTime(new Date(s.updated_at))} />
          <Fact label="Source du suivi" value={CARRIER_LABEL[s.carrier] ?? s.carrier} hint={s.carrier === 'MAERSK' ? 'API Track & Trace' : 'saisie manuelle'} />
          <Fact label="Dernière synchro" value={s.last_synced_at ? fmtDayTime(new Date(s.last_synced_at)) : 'jamais'} />
        </Facts>
        {s.sync_error && (
          <p className={cn('mt-3 border-t border-black/[0.06] pt-3 text-[12.5px] text-destructive dark:border-white/[0.06]')}>
            Dernière erreur de synchronisation : {s.sync_error}
          </p>
        )}
      </Section>
    </div>
  );
}
