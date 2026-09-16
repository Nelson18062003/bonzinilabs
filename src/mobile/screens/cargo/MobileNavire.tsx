/**
 * « Renseigner le navire » — pour un armateur muet (CMA CGM, MSC…) : on
 * recopie le navire lu sur son site, en cinq questions dans une feuille
 * basse. Avec l'IMO, l'AIS suit la position et la boîte apparaît sur la carte.
 */
import { useEffect, useState } from 'react';
import { useUpdateCargoShipment } from '@/hooks/useCargo';
import type { CargoShipment } from '@/lib/cargo/model';
import { TEXT, BottomSheet, Button, FormField, Line, TextInput } from '@/mobile/designKit';

export function MobileNavireSheet({ shipment: s, open, onClose }: { shipment: CargoShipment; open: boolean; onClose: () => void }) {
  const update = useUpdateCargoShipment();
  const [name, setName] = useState(s.vessel_name ?? '');
  const [imo, setImo] = useState(s.vessel_imo ?? '');
  const [mmsi, setMmsi] = useState(s.vessel_mmsi ?? '');
  const [voyage, setVoyage] = useState(s.voyage ?? '');
  const [eta, setEta] = useState(s.eta_carrier ? s.eta_carrier.slice(0, 10) : '');
  useEffect(() => {
    if (!open) return;
    setName(s.vessel_name ?? ''); setImo(s.vessel_imo ?? ''); setMmsi(s.vessel_mmsi ?? ''); setVoyage(s.voyage ?? ''); setEta(s.eta_carrier ? s.eta_carrier.slice(0, 10) : '');
  }, [open, s]);

  const submit = () => {
    update.mutate({
      id: s.id,
      patch: {
        vessel_name: name.trim() || null, vessel_imo: imo.replace(/\D/g, '') || null, vessel_mmsi: mmsi.replace(/\D/g, '') || null,
        voyage: voyage.trim() || null, eta_carrier: eta ? `${eta}T12:00:00Z` : null,
        // Un navire renseigné sur une boîte « sans suivi » : elle est en mer, on la place sur la carte.
        status: s.status === 'UNKNOWN' && name.trim() ? 'AT_SEA' : s.status,
      },
    }, { onSuccess: onClose });
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={s.vessel_name ? 'Le navire' : 'Renseigner le navire'}>
      <div className="space-y-4">
        <Line className={TEXT.muted}>Ce que vous lisez sur le site de l'armateur. Avec le numéro IMO, la position du navire est suivie et la boîte apparaît sur la carte.</Line>
        <FormField label="Le nom du navire" htmlFor="cargo-vessel-name">
          <TextInput id="cargo-vessel-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="CMA CGM ZEPHYR" autoCapitalize="characters" autoComplete="off" />
        </FormField>
        <FormField label="Son numéro IMO (7 chiffres)" htmlFor="cargo-vessel-imo">
          <TextInput id="cargo-vessel-imo" inputMode="numeric" value={imo} onChange={(e) => setImo(e.target.value.replace(/\D/g, ''))} placeholder="9454412" className="tabular-nums" />
        </FormField>
        <FormField label="Son MMSI (facultatif)" htmlFor="cargo-vessel-mmsi">
          <TextInput id="cargo-vessel-mmsi" inputMode="numeric" value={mmsi} onChange={(e) => setMmsi(e.target.value.replace(/\D/g, ''))} placeholder="215930000" className="tabular-nums" />
        </FormField>
        <FormField label="Le voyage (facultatif)" htmlFor="cargo-vessel-voyage">
          <TextInput id="cargo-vessel-voyage" value={voyage} onChange={(e) => setVoyage(e.target.value)} placeholder="631W" autoCapitalize="characters" autoComplete="off" />
        </FormField>
        <FormField label="L'arrivée annoncée par l'armateur (facultatif)" htmlFor="cargo-vessel-eta">
          <TextInput id="cargo-vessel-eta" type="date" value={eta} onChange={(e) => setEta(e.target.value)} />
        </FormField>
        <div className="flex gap-2">
          <Button variant="neutral" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button className="flex-1" onClick={submit} loading={update.isPending} disabled={!name.trim() && !imo}>Enregistrer</Button>
        </div>
      </div>
    </BottomSheet>
  );
}
