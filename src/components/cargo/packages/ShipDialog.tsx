// ============================================================
// « Mettre sur un vol » / « Nouvelle expédition » — une seule fenêtre, deux
// portes d'entrée, la même anatomie que « Mettre en paquet » :
//   · depuis Paquets avion (paquets cochés) : SUR QUEL VOL ? un vol en
//     préparation, ou une nouvelle expédition ouverte ici même ;
//   · depuis Cargo › Avion, « Nouvelle expédition » : la fiche du vol (LTA ou
//     « pas encore connue », compagnie, vol, dates) ;
// et dans les deux cas, LES PAQUETS À EMBARQUER : les paquets fermés du bureau
// (et ceux refusés par l'aéroport, à renvoyer), à cocher. Un paquet encore
// ouvert est écarté : il se ferme (pesée) d'abord.
// Écriture : un vol existant — canReceiveParcels ou canManageCargo
// (air_package_assign) ; un nouveau vol — canManageCargo (cargo_air_create).
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { Check, Plane, PlaneTakeoff } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAirPackages } from '@/hooks/useAirPackages';
import { useAirShipments, useShipPackages, type ShipResult } from '@/hooks/useAirShipments';
import { isAssignable, packageKg, packagesTotals, type AirPackage } from '@/lib/airPackage';
import { awbLabel, cleanAwb, flightSentence, fmtDay, isAwbValid, parseFreightUsd } from '@/lib/airShipment';
import { formatKg } from '@/lib/reception';
import { plural } from '@/lib/cargo/plain';
import { cn } from '@/lib/utils';
import { FormDialog, TEXT, TextInput } from '@/desktop/designKit';
import { Btn, ChoiceCard, Excluded, Tick } from './bits';
import { toggleId } from './selection';

/** Pourquoi un paquet coché ne peut pas monter dans un vol. */
function notShippable(k: AirPackage): string {
  if (k.status === 'open') return 'encore ouvert : fermez-le (pesée) pour qu’il parte';
  if (k.air_shipment_id) return 'déjà sur un vol';
  return 'déjà parti';
}

const field = 'h-10 rounded-md px-3 text-[13.5px]';

export function ShipDialog({ open, mode, preselected = [], onClose, onDone }: {
  open: boolean;
  /** `ship` : choisir un vol (ou en ouvrir un) ; `create` : ouvrir une expédition. */
  mode: 'ship' | 'create';
  /** Les paquets cochés avant d'ouvrir la fenêtre. */
  preselected?: readonly string[];
  onClose: () => void;
  /** Le vol est prêt : l'écran l'ouvre (sa fiche, ses paquets, le scan au départ). */
  onDone: (r: ShipResult) => void;
}) {
  const { hasPermission } = useAdminAuth();
  const canCreate = hasPermission('canManageCargo');
  const bureau = useAirPackages('bureau', null, open);
  const flights = useAirShipments(open && mode === 'ship');
  const ship = useShipPackages();

  const [dest, setDest] = useState<'new' | string>(mode === 'create' ? 'new' : '');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [awb, setAwb] = useState('');
  const [awbUnknown, setAwbUnknown] = useState(false);
  const [airline, setAirline] = useState('');
  const [flightNo, setFlightNo] = useState('');
  const [etd, setEtd] = useState('');
  const [eta, setEta] = useState('');
  const [freight, setFreight] = useState('');
  const [notes, setNotes] = useState('');

  const planned = useMemo(() => (flights.data ?? []).filter((a) => a.status === 'PLANNED')
    .sort((a, b) => (a.etd ?? '9999').localeCompare(b.etd ?? '9999')), [flights.data]);
  const shippable = useMemo(() => (bureau.data ?? []).filter(isAssignable), [bureau.data]);
  const stillOpen = useMemo(() => (bureau.data ?? []).filter((k) => k.status === 'open'), [bureau.data]);

  // À l'ouverture : les paquets cochés avant (s'ils peuvent partir), le vol en préparation le plus proche.
  useEffect(() => {
    if (!open) return;
    setPicked(new Set(preselected));
    setDest(mode === 'create' ? 'new' : '');
    setAwb(''); setAwbUnknown(false); setAirline(''); setFlightNo(''); setEtd(''); setEta(''); setFreight(''); setNotes('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    if (open && mode === 'ship' && dest === '' && flights.data) setDest(planned[0]?.id ?? (canCreate ? 'new' : ''));
  }, [open, mode, dest, flights.data, planned, canCreate]);

  const chosen = shippable.filter((k) => picked.has(k.id));
  const excluded = (bureau.data ?? []).filter((k) => picked.has(k.id) && !isAssignable(k))
    .map((k) => ({ key: k.id, label: k.package_no, reason: notShippable(k) }));
  const { kg, parcels } = packagesTotals(chosen);

  // Le vol choisi peut être parti entre-temps : il n'est plus une destination.
  const target = dest === 'new' ? (canCreate ? 'new' : '') : planned.some((a) => a.id === dest) ? dest : '';
  const isNew = target === 'new';
  const flightValid = !isNew || (awbUnknown ? !!etd : isAwbValid(awb));
  const canSubmit = !!target && flightValid && (isNew || chosen.length > 0);
  const toggle = (id: string) => setPicked((s) => toggleId(s, id));
  const allOn = shippable.length > 0 && shippable.every((k) => picked.has(k.id));

  const submit = async () => {
    if (!canSubmit || ship.isPending) return;
    try {
      const r = await ship.mutateAsync({
        airId: isNew ? null : target,
        create: isNew ? { awbNumber: awbUnknown ? '' : cleanAwb(awb), airline: airline.trim(), flightNo: flightNo.trim(), etd: etd || null, eta: eta || null, freightUsd: parseFreightUsd(freight), notes: notes.trim() } : undefined,
        packageIds: chosen.map((k) => k.id),
      });
      if (r.assignError) toast.warning('Expédition ouverte, mais les paquets n’y sont pas montés', { description: r.assignError });
      else if (r.created) toast.success('Expédition ouverte', { description: r.assigned > 0 ? `${plural(r.assigned, 'paquet')} · ${plural(r.parcels, 'colis', 'colis')} à bord` : 'Ajoutez-y les paquets fermés quand ils sont prêts.' });
      else toast.success(`${plural(r.assigned, 'paquet')} sur le vol`, { description: `${plural(r.parcels, 'colis', 'colis')}${r.skipped.length ? ` · non affectés : ${r.skipped.join(', ')}` : ''}` });
      onDone(r);
    } catch {
      /* le hook affiche le refus du serveur ; la fenêtre reste ouverte */
    }
  };

  const flightForm = (
    <div className="space-y-3">
      {!awbUnknown && (
        <label className="block">
          <span className={cn('mb-1 block text-[12.5px] font-semibold', TEXT.strong)}>Numéro de LTA</span>
          <TextInput value={awb} onChange={(e) => setAwb(e.target.value)} placeholder="071-12345675" inputMode="numeric" data-autofocus={mode === 'create' ? true : undefined} className={cn(field, 'font-semibold tabular-nums')} />
        </label>
      )}
      <label className="flex cursor-pointer items-center gap-2.5">
        <Tick on={awbUnknown} label="LTA pas encore connue" onChange={() => setAwbUnknown((v) => !v)} />
        <span className={cn('text-[12.5px]', TEXT.body)}><span className={cn('font-semibold', TEXT.strong)}>LTA pas encore connue</span> — elle se saisira plus tard ; la date de départ prévue suffit.</span>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className={cn('mb-1 block text-[12.5px] font-semibold', TEXT.strong)}>Compagnie</span><TextInput value={airline} onChange={(e) => setAirline(e.target.value)} placeholder="Ethiopian, Turkish…" className={field} /></label>
        <label className="block"><span className={cn('mb-1 block text-[12.5px] font-semibold', TEXT.strong)}>Vol</span><TextInput value={flightNo} onChange={(e) => setFlightNo(e.target.value)} placeholder="ET 607" className={cn(field, 'uppercase')} /></label>
        <label className="block"><span className={cn('mb-1 block text-[12.5px] font-semibold', TEXT.strong)}>Départ prévu{awbUnknown ? ' (obligatoire)' : ''}</span><TextInput type="date" value={etd} onChange={(e) => setEtd(e.target.value)} className={field} /></label>
        <label className="block"><span className={cn('mb-1 block text-[12.5px] font-semibold', TEXT.strong)}>Arrivée prévue</span><TextInput type="date" value={eta} onChange={(e) => setEta(e.target.value)} className={field} /></label>
        {mode === 'create' && (
          <>
            <label className="block"><span className={cn('mb-1 block text-[12.5px] font-semibold', TEXT.strong)}>Fret payé à la compagnie (USD)</span><TextInput value={freight} onChange={(e) => setFreight(e.target.value)} inputMode="decimal" placeholder="Facultatif" className={cn(field, 'tabular-nums')} /></label>
            <label className="block"><span className={cn('mb-1 block text-[12.5px] font-semibold', TEXT.strong)}>Notes</span><TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Transitaire, contact à l’aéroport…" className={field} /></label>
          </>
        )}
      </div>
      {!flightValid && (awbUnknown ? etd === '' : awb.trim() !== '') && (
        <p className="text-[12px] font-semibold text-amber-700 dark:text-amber-400">{awbUnknown ? 'Sans LTA, indiquez la date de départ prévue.' : 'Saisissez la LTA (4 caractères au moins), ou cochez « LTA pas encore connue ».'}</p>
      )}
    </div>
  );

  const label = isNew
    ? chosen.length > 0 ? `Ouvrir l’expédition avec ${plural(chosen.length, 'paquet')}` : 'Ouvrir l’expédition'
    : `Mettre ${plural(chosen.length, 'paquet')} sur ce vol`;

  return (
    <FormDialog
      open={open}
      onClose={ship.isPending ? () => undefined : onClose}
      onConfirm={() => void submit()}
      width={720}
      title={mode === 'create' ? 'Nouvelle expédition' : 'Mettre sur un vol'}
      subtitle={chosen.length > 0
        ? `${plural(chosen.length, 'paquet')} · ${formatKg(kg)} · ${plural(parcels, 'colis', 'colis')}`
        : mode === 'create' ? 'Air cargo · Guangzhou → Douala. Les paquets fermés au bureau peuvent monter tout de suite.' : 'Cochez les paquets à embarquer.'}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Btn onClick={onClose} disabled={ship.isPending}>Annuler</Btn>
          <Btn kind="primary" onClick={() => void submit()} disabled={!canSubmit} loading={ship.isPending}><PlaneTakeoff /> {label}</Btn>
        </div>
      }
    >
      <div className="space-y-5">
        <Excluded title={`${plural(excluded.length, 'paquet écarté', 'paquets écartés')}`} rows={excluded} />

        {mode === 'ship' ? (
          <section>
            <h3 className={cn('mb-2 text-[13px] font-bold', TEXT.strong)}>Sur quel vol ?</h3>
            <div role="radiogroup" aria-label="Vol" className="space-y-2">
              {planned.map((a) => (
                <ChoiceCard
                  key={a.id}
                  on={target === a.id}
                  onClick={() => setDest(a.id)}
                  icon={<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#C8102E] text-white"><Plane className="h-3.5 w-3.5" /></span>}
                  title={<>{awbLabel(a)} <span className={cn('text-[12px] font-semibold', TEXT.muted)}>· {flightSentence(a)}</span></>}
                  meta={`${a.etd ? `départ prévu ${fmtDay(a.etd)}` : 'départ à préciser'} · ${(a.package_count ?? 0) > 0 ? `${plural(Number(a.package_count), 'paquet')} déjà à bord · ${formatKg(a.total_weight_kg)}` : 'encore vide'}`}
                />
              ))}
              {canCreate && (
                <ChoiceCard on={isNew} onClick={() => setDest('new')} title="Nouvelle expédition" meta="Un vol ouvert ici même, avec ces paquets à bord">
                  {flightForm}
                </ChoiceCard>
              )}
              {flights.isLoading && <p className={cn('text-[13px]', TEXT.muted)}>Les vols en préparation…</p>}
              {flights.error && <p className="text-[13px] font-semibold text-destructive">{(flights.error as Error).message}</p>}
              {flights.isSuccess && planned.length === 0 && !canCreate && <p className={cn('text-[13px]', TEXT.muted)}>Aucun vol en préparation. L’équipe cargo en ouvre un dans Cargo › Avion.</p>}
            </div>
          </section>
        ) : (
          <section className="rounded-lg border border-border px-4 py-4">{flightForm}</section>
        )}

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className={cn('text-[13px] font-bold', TEXT.strong)}>Les paquets à embarquer <span className={cn('font-normal tabular-nums', TEXT.muted)}>· {chosen.length} / {shippable.length}</span></h3>
            {shippable.length > 1 && (
              <button type="button" onClick={() => setPicked(allOn ? new Set() : new Set(shippable.map((k) => k.id)))} className={cn('text-[12.5px] font-semibold underline-offset-2 hover:underline', TEXT.strong)}>
                {allOn ? 'Tout décocher' : 'Tout cocher'}
              </button>
            )}
          </div>
          {shippable.length === 0 ? (
            <p className={cn('rounded-lg border border-dashed border-border px-4 py-5 text-center text-[13px]', TEXT.muted)}>
              Aucun paquet fermé au bureau.{stillOpen.length > 0 ? ` ${plural(stillOpen.length, 'paquet')} encore ouvert${stillOpen.length > 1 ? 's' : ''} : fermez-le${stillOpen.length > 1 ? 's' : ''} (pesée) dans Réception › Paquets avion.` : ' Préparez-les dans Réception › Paquets avion.'}
            </p>
          ) : (
            <ul className="max-h-[300px] divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {shippable.map((k) => {
                const on = picked.has(k.id);
                return (
                  <li key={k.id}>
                    <label className={cn('flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40', on && 'bg-accent/50')}>
                      <Tick on={on} label={`Embarquer ${k.package_no}`} onChange={() => toggle(k.id)} />
                      <span className="min-w-0 flex-1">
                        <span className={cn('block font-mono text-[13px] font-bold', TEXT.strong)}>{k.package_no}</span>
                        <span className={cn('block truncate text-[12px] tabular-nums', TEXT.muted)}>
                          {plural(Number(k.parcel_count), 'colis', 'colis')} · {plural(Number(k.client_count), 'client')}
                          {k.status === 'refused' && <span className="font-semibold text-destructive"> · refusé à l’aéroport{k.refusal_reason ? ` : ${k.refusal_reason}` : ''}</span>}
                        </span>
                      </span>
                      <span className={cn('shrink-0 text-[13px] font-semibold tabular-nums', TEXT.strong)}>{formatKg(packageKg(k))}</span>
                      {on && <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </FormDialog>
  );
}
