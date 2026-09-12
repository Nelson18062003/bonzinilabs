/**
 * « Renseigner le navire » — pour un armateur non interrogeable : on tape le
 * navire lu sur le site de l'armateur ; la position vient ensuite de l'AIS.
 */
import { useEffect, useState } from 'react';
import { DateField, TextField } from '@/components/form';
import { useUpdateCargoShipment } from '@/hooks/useCargo';
import type { CargoShipment } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { TEXT, SOFT_PILL, PRIMARY_PILL, CenterDialog, SecLabel } from '@/desktop/designKit';

export function CargoVesselDialog({ shipment: s, open, onClose }: { shipment: CargoShipment; open: boolean; onClose: () => void }) {
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
        status: s.status === 'UNKNOWN' && name.trim() ? 'AT_SEA' : s.status,
      },
    }, { onSuccess: onClose });
  };
  return (
    <CenterDialog
      open={open}
      onClose={onClose}
      onConfirm={submit}
      title="Renseigner le navire"
      footer={
        <>
          <button type="button" onClick={onClose} className={cn('h-9 px-4 text-[13px] font-semibold', SOFT_PILL)}>Annuler</button>
          <button type="button" onClick={submit} disabled={update.isPending} className={cn('h-9 px-4 text-[13px] font-bold disabled:opacity-60', PRIMARY_PILL)}>Enregistrer</button>
        </>
      }
    >
      <p className={cn('mb-4 text-[13px]', TEXT.body)}>
        Ce que tu lis sur le site de l'armateur. Avec l'IMO (ou le MMSI), la position du navire est suivie par l'AIS et la boîte apparaît sur la carte.
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div className="col-span-2"><SecLabel className="mb-1.5">Nom du navire</SecLabel><TextField id="cargo-vessel-name" size="sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="CMA CGM ZEPHYR" /></div>
        <div><SecLabel className="mb-1.5">IMO</SecLabel><TextField id="cargo-vessel-imo" size="sm" variant="numeric" value={imo} onChange={(e) => setImo(e.target.value)} placeholder="9454412" /></div>
        <div><SecLabel className="mb-1.5">MMSI (facultatif)</SecLabel><TextField id="cargo-vessel-mmsi" size="sm" variant="numeric" value={mmsi} onChange={(e) => setMmsi(e.target.value)} placeholder="215930000" /></div>
        <div><SecLabel className="mb-1.5">Voyage</SecLabel><TextField id="cargo-vessel-voyage" size="sm" value={voyage} onChange={(e) => setVoyage(e.target.value)} placeholder="631W" /></div>
        <div><SecLabel className="mb-1.5">Arrivée annoncée par l'armateur</SecLabel><DateField id="cargo-vessel-eta" size="sm" value={eta} onChange={(e) => setEta(e.target.value)} /></div>
      </div>
    </CenterDialog>
  );
}
