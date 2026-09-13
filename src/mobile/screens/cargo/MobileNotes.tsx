/** « Les notes » — ce que l'équipe doit savoir, et d'où vient le suivi. */
import { useEffect, useState } from 'react';
import { TextArea } from '@/components/form';
import { useUpdateCargoShipment } from '@/hooks/useCargo';
import { CARRIER_LABEL, fmtDayTime } from '@/lib/cargo/model';
import type { CargoShipment } from '@/lib/cargo/model';
import { whenSentence } from '@/lib/plainTime';
import { TEXT, Line } from '@/mobile/designKit';

export function MobileNotes({ shipment: s, canManage }: { shipment: CargoShipment; canManage: boolean }) {
  const update = useUpdateCargoShipment();
  const [notes, setNotes] = useState(s.notes ?? '');
  useEffect(() => { setNotes(s.notes ?? ''); }, [s.id, s.notes]);
  const save = () => { if ((s.notes ?? '') !== notes) update.mutate({ id: s.id, patch: { notes: notes || null } }); };

  return (
    <div className="space-y-4">
      <TextArea
        id={`cargo-notes-${s.id}`}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={save}
        readOnly={!canManage}
        rows={6}
        placeholder="Quel transitaire, quel interlocuteur, quel incident, ce qui a été promis au client…"
      />
      <Line className={TEXT.muted}>{canManage ? 'La note s\'enregistre toute seule quand vous quittez le champ.' : 'Vous pouvez lire la note, pas la modifier.'}</Line>

      <Line>
        Dossier ouvert le {fmtDayTime(new Date(s.created_at))}
        {s.updated_at !== s.created_at ? `, modifié ${whenSentence(s.updated_at)}.` : '.'}
      </Line>
      <Line>
        {s.carrier === 'MAERSK'
          ? <>Le suivi vient de <b className={TEXT.strong}>Maersk</b>, mis à jour automatiquement{s.last_synced_at ? `, la dernière fois ${whenSentence(s.last_synced_at)}` : ', jamais encore'}.</>
          : <>Le suivi est saisi à la main pour <b className={TEXT.strong}>{CARRIER_LABEL[s.carrier] ?? s.carrier}</b>.</>}
      </Line>
      {s.sync_error && <Line tone="bad">La dernière mise à jour automatique a échoué : {s.sync_error}</Line>}
    </div>
  );
}
