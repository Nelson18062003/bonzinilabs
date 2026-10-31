// ============================================================
// Cargo (mobile v2) — « Ajouter sans suivi armateur » : la même saisie que
// le dialogue de l'ordinateur (CargoManualAddDialog), dans une feuille.
// Le dossier existe avec les dates du transitaire ; le navire, s'il est
// connu, le place sur la carte.
// ============================================================
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateCargoShipmentManual } from '@/hooks/useCargo';
import { CARRIER_LABEL, cleanReference, guessCarrier } from '@/lib/cargo/model';
import { BigButton, BottomSheet, Chip, TextInput } from '@/mobile/designKit';
import { CapsLabel, UnitField } from '@/mobile/components/cargo/v2';

const CARRIERS = ['CMA_CGM', 'MAERSK', 'MSC', 'COSCO', 'OTHER'];
const PODS = [['CMKBI', 'Kribi'], ['CMDLA', 'Douala']] as const;

export function ManualAddSheet({ open, onClose, reference }: { open: boolean; onClose: () => void; reference?: string }) {
  const navigate = useNavigate();
  const create = useCreateCargoShipmentManual();
  const guess = reference ? guessCarrier(reference) : null;
  const [client, setClient] = useState('');
  const [carrier, setCarrier] = useState(guess?.carrier && guess.carrier !== 'UNKNOWN' ? guess.carrier : 'CMA_CGM');
  const [bl, setBl] = useState(guess?.type === 'BL' ? cleanReference(reference ?? '') : '');
  const [ctr, setCtr] = useState(guess?.type === 'CONTAINER' ? cleanReference(reference ?? '') : '');
  const [pod, setPod] = useState<string>('CMKBI');
  const [pol, setPol] = useState('Nansha');
  const [etd, setEtd] = useState('');
  const [eta, setEta] = useState('');
  const [freight, setFreight] = useState('');
  const [vessel, setVessel] = useState('');
  const [imo, setImo] = useState('');

  const f = freight.trim() === '' ? null : Number(freight.replace(/\s/g, '').replace(',', '.'));
  const freightOk = f === null || (Number.isFinite(f) && f >= 0);
  const ok = !!client.trim() && /^[A-Z]{4}[0-9]{7}$/.test(cleanReference(ctr)) && cleanReference(bl).length >= 6 && freightOk;
  const submit = () => {
    if (!ok) return;
    const podName = PODS.find(([c]) => c === pod)?.[1] ?? pod;
    create.mutate({
      clientLabel: client.trim(), carrier, blNumber: cleanReference(bl), containerNumber: cleanReference(ctr),
      podName, podUnlocode: pod, polName: pol.trim() || null, polUnlocode: pol.trim().toLowerCase() === 'nansha' ? 'CNNSA' : null,
      etdPromised: etd || null, etaPromised: eta || null, freightUsd: f,
      vesselName: vessel.trim() || null, vesselImo: imo.replace(/\D/g, '') || null, vesselMmsi: null, voyage: null,
    }, { onSuccess: (id) => { onClose(); navigate(`/m/cargo/${id}`); } });
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Ajouter sans suivi">
      <div className="space-y-4">
        <div><CapsLabel as="label">Client</CapsLabel><TextInput className="mt-2 h-14" value={client} onChange={(e) => setClient(e.target.value)} placeholder="GAUSS, PRC…" aria-label="Client" /></div>
        <div>
          <CapsLabel>Armateur</CapsLabel>
          <div className="mt-2 flex flex-wrap gap-2">{CARRIERS.map((c) => <Chip key={c} active={c === carrier} onClick={() => setCarrier(c)} label={CARRIER_LABEL[c]} />)}</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><CapsLabel as="label">B/L</CapsLabel><TextInput className="mt-2 h-14 uppercase" value={bl} onChange={(e) => setBl(e.target.value)} placeholder="GGZ3133535" aria-label="Bill of lading" /></div>
          <div><CapsLabel as="label">Conteneur</CapsLabel><TextInput className="mt-2 h-14 uppercase" value={ctr} onChange={(e) => setCtr(e.target.value)} placeholder="CMAU6126032" aria-label="Conteneur" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><CapsLabel as="label">Départ de</CapsLabel><TextInput className="mt-2 h-14" value={pol} onChange={(e) => setPol(e.target.value)} placeholder="Nansha" aria-label="Port de départ" /></div>
          <div>
            <CapsLabel>Arrivée à</CapsLabel>
            <div className="mt-2 flex h-14 items-center gap-2">{PODS.map(([code, name]) => <Chip key={code} active={code === pod} onClick={() => setPod(code)} label={name} />)}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><CapsLabel as="label">Départ promis</CapsLabel><TextInput type="date" className="mt-2 h-14" value={etd} onChange={(e) => setEtd(e.target.value)} aria-label="Départ promis" /></div>
          <div><CapsLabel as="label">Arrivée promise</CapsLabel><TextInput type="date" className="mt-2 h-14" value={eta} onChange={(e) => setEta(e.target.value)} aria-label="Arrivée promise" /></div>
        </div>
        <div><CapsLabel as="label">Fret</CapsLabel><UnitField className="mt-2" unit="USD" value={freight} onChange={(e) => setFreight(e.target.value)} placeholder="6 650" invalid={!freightOk} aria-label="Fret (USD)" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><CapsLabel as="label">Navire</CapsLabel><TextInput className="mt-2 h-14 uppercase" value={vessel} onChange={(e) => setVessel(e.target.value)} placeholder="Si connu" aria-label="Navire" /></div>
          <div><CapsLabel as="label">IMO</CapsLabel><TextInput className="mt-2 h-14" inputMode="numeric" value={imo} onChange={(e) => setImo(e.target.value)} placeholder="Si connu" aria-label="IMO" /></div>
        </div>
        <BigButton onClick={submit} disabled={!ok} loading={create.isPending}>Ajouter à ma flotte</BigButton>
      </div>
    </BottomSheet>
  );
}
