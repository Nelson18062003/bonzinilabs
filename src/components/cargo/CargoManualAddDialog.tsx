/** Ajouter un conteneur sans suivi armateur — le formulaire de saisie manuelle. */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DateField, NumberField, TextField } from '@/components/form';
import { useCreateCargoShipmentManual } from '@/hooks/useCargo';
import { CARRIER_LABEL, PORTS, cleanReference, guessCarrier } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { TEXT, SOFT_PILL, PRIMARY_PILL, CenterDialog, SecLabel } from '@/desktop/designKit';

const CARRIERS = ['CMA_CGM', 'MAERSK', 'MSC', 'COSCO', 'OTHER'];
const PODS = [['CMKBI', 'Kribi'], ['CMDLA', 'Douala']] as const;

export function CargoManualAddDialog({ open, onClose, reference }: { open: boolean; onClose: () => void; reference?: string }) {
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
  const [freight, setFreight] = useState<number | null>(null);
  const [vessel, setVessel] = useState('');
  const [imo, setImo] = useState('');

  const ok = client.trim() && /^[A-Z]{4}[0-9]{7}$/.test(cleanReference(ctr)) && cleanReference(bl).length >= 6;
  const submit = () => {
    if (!ok) return;
    const podName = PODS.find(([c]) => c === pod)?.[1] ?? pod;
    create.mutate({
      clientLabel: client.trim(), carrier, blNumber: cleanReference(bl), containerNumber: cleanReference(ctr),
      podName, podUnlocode: pod, polName: pol.trim() || null, polUnlocode: pol.trim().toLowerCase() === 'nansha' ? 'CNNSA' : null,
      etdPromised: etd || null, etaPromised: eta || null, freightUsd: freight,
      vesselName: vessel.trim() || null, vesselImo: imo.replace(/\D/g, '') || null, vesselMmsi: null, voyage: null,
    }, { onSuccess: (id) => { onClose(); navigate(`/m/cargo/${id}`); } });
  };

  return (
    <CenterDialog
      open={open}
      onClose={onClose}
      onConfirm={submit}
      width={640}
      title="Ajouter sans suivi armateur"
      footer={
        <>
          <button type="button" onClick={onClose} className={cn('h-9 px-4 text-[13px] font-semibold', SOFT_PILL)}>Annuler</button>
          <button type="button" onClick={submit} disabled={!ok || create.isPending} className={cn('h-9 px-4 text-[13px] font-bold disabled:opacity-60', PRIMARY_PILL)}>{create.isPending ? 'Ajout…' : 'Ajouter à ma flotte'}</button>
        </>
      }
    >
      <p className={cn('mb-4 text-[13px]', TEXT.body)}>Le dossier existera avec les dates du transitaire ; les jalons viendront quand l'armateur sera interrogeable. Renseigne le navire si tu le connais : il sera placé sur la carte.</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div><SecLabel className="mb-1.5">Client</SecLabel><TextField id="cargo-man-client" size="sm" variant="name" value={client} onChange={(e) => setClient(e.target.value)} placeholder="GAUSS, PRC…" /></div>
        <div>
          <SecLabel className="mb-1.5">Armateur</SecLabel>
          <div className="flex flex-wrap gap-1">
            {CARRIERS.map((c) => (
              <button key={c} type="button" onClick={() => setCarrier(c)} className={cn('h-8 rounded-md px-2.5 text-[12px] font-semibold', c === carrier ? PRIMARY_PILL : SOFT_PILL)}>{CARRIER_LABEL[c]}</button>
            ))}
          </div>
        </div>
        <div><SecLabel className="mb-1.5">Bill of lading</SecLabel><TextField id="cargo-man-bl" size="sm" variant="search" value={bl} onChange={(e) => setBl(e.target.value)} className="font-mono uppercase" placeholder="GGZ3133535" /></div>
        <div><SecLabel className="mb-1.5">Conteneur</SecLabel><TextField id="cargo-man-ctr" size="sm" variant="search" value={ctr} onChange={(e) => setCtr(e.target.value)} className="font-mono uppercase" placeholder="CMAU6126032" /></div>
        <div>
          <SecLabel className="mb-1.5">Port d'arrivée</SecLabel>
          <div className="flex gap-1">
            {PODS.map(([code, name]) => (
              <button key={code} type="button" onClick={() => setPod(code)} className={cn('h-8 rounded-md px-3 text-[12px] font-semibold', code === pod ? PRIMARY_PILL : SOFT_PILL)}>{name}</button>
            ))}
          </div>
        </div>
        <div><SecLabel className="mb-1.5">Port de départ</SecLabel><TextField id="cargo-man-pol" size="sm" value={pol} onChange={(e) => setPol(e.target.value)} placeholder={PORTS.CNNSA.name} /></div>
        <div><SecLabel className="mb-1.5">Départ promis</SecLabel><DateField id="cargo-man-etd" size="sm" value={etd} onChange={(e) => setEtd(e.target.value)} /></div>
        <div><SecLabel className="mb-1.5">Arrivée promise</SecLabel><DateField id="cargo-man-eta" size="sm" value={eta} onChange={(e) => setEta(e.target.value)} /></div>
        <div><SecLabel className="mb-1.5">Fret (USD)</SecLabel><NumberField id="cargo-man-freight" size="sm" value={freight} onValueChange={setFreight} allowDecimal placeholder="6 650" /></div>
        <div />
        <div><SecLabel className="mb-1.5">Navire (si connu)</SecLabel><TextField id="cargo-man-vessel" size="sm" value={vessel} onChange={(e) => setVessel(e.target.value)} placeholder="CMA CGM ZEPHYR" /></div>
        <div><SecLabel className="mb-1.5">IMO (si connu)</SecLabel><TextField id="cargo-man-imo" size="sm" variant="numeric" value={imo} onChange={(e) => setImo(e.target.value)} placeholder="9454412" /></div>
      </div>
    </CenterDialog>
  );
}
