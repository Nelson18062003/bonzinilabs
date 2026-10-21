/**
 * « Mettre sur un vol » (refonte v2, maquettes 04/13 et 10/37) : les paquets
 * fermés du bureau partent dans un vol en préparation, ou dans un vol ouvert
 * à l'instant (LTA, ou « pas encore connue » + date de départ). Le pendant
 * mobile de ShipDialog (ordinateur), sur le même hook (useShipPackages).
 * Lire les vols demande canViewCargo ; en ouvrir un, canManageCargo.
 */
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAirPackages } from '@/hooks/useAirPackages';
import { useAirShipments, useShipPackages, type ShipResult } from '@/hooks/useAirShipments';
import { isAssignable, packageKg, packagesTotals } from '@/lib/airPackage';
import { awbLabel, cleanAwb, fmtDay, isAwbValid } from '@/lib/airShipment';
import { formatKg } from '@/lib/reception';
import { plural } from '@/lib/cargo/plain';
import { cn } from '@/lib/utils';
import { BigButton, BottomSheet, TEXT, TextInput } from '@/mobile/designKit';
import { TickBox } from '@/mobile/components/reception/packageBits';
import { CapsLabel, RadioRow } from './v2';

export function ShipSheet({ open, onClose, preselected, onDone }: { open: boolean; onClose: () => void; preselected?: readonly string[]; onDone?: (r: ShipResult) => void }) {
  const { hasPermission } = useAdminAuth();
  const canCreate = hasPermission('canManageCargo');
  const bureau = useAirPackages('bureau', null, open);
  const flights = useAirShipments(open);
  const ship = useShipPackages();
  const [dest, setDest] = useState<string>('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [awb, setAwb] = useState('');
  const [awbUnknown, setAwbUnknown] = useState(false);
  const [airline, setAirline] = useState('');
  const [flightNo, setFlightNo] = useState('');
  const [etd, setEtd] = useState('');

  const planned = useMemo(() => (flights.data ?? []).filter((a) => a.status === 'PLANNED').sort((a, b) => (a.etd ?? '9999').localeCompare(b.etd ?? '9999')), [flights.data]);
  const shippable = useMemo(() => (bureau.data ?? []).filter(isAssignable), [bureau.data]);

  useEffect(() => {
    if (!open) return;
    setDest(''); setAwb(''); setAwbUnknown(false); setAirline(''); setFlightNo(''); setEtd('');
    setPicked(new Set(preselected ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  // Tous les paquets fermés cochés d'office, le vol en préparation le plus proche choisi d'office.
  useEffect(() => { if (open && !preselected && bureau.data) setPicked(new Set(shippable.map((k) => k.id))); }, [open, preselected, bureau.data, shippable]);
  useEffect(() => { if (open && dest === '' && flights.data) setDest(planned[0]?.id ?? (canCreate ? 'new' : '')); }, [open, dest, flights.data, planned, canCreate]);

  const chosen = shippable.filter((k) => picked.has(k.id));
  const { kg } = packagesTotals(chosen);
  const isNew = dest === 'new' && canCreate;
  const flightValid = !isNew || (awbUnknown ? !!etd : isAwbValid(awb));
  const canSubmit = (isNew || planned.some((a) => a.id === dest)) && flightValid && chosen.length > 0;
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const submit = async () => {
    if (!canSubmit || ship.isPending) return;
    try {
      const r = await ship.mutateAsync({
        airId: isNew ? null : dest,
        create: isNew ? { awbNumber: awbUnknown ? '' : cleanAwb(awb), airline: airline.trim(), flightNo: flightNo.trim(), etd: etd || null } : undefined,
        packageIds: chosen.map((k) => k.id),
      });
      if (r.assignError) toast.warning('Vol ouvert, paquets non montés', { description: r.assignError });
      else toast.success(`${plural(r.assigned, 'paquet')} sur le vol`, { description: `${plural(r.parcels, 'colis', 'colis')}${r.skipped.length ? ` · non affectés : ${r.skipped.join(', ')}` : ''}` });
      onClose();
      onDone?.(r);
    } catch { /* le hook dit le refus ; la feuille reste ouverte */ }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Mettre sur un vol">
      <div className="space-y-5">
        <section>
          <CapsLabel className="mb-1">Le vol</CapsLabel>
          <div role="radiogroup" aria-label="Le vol">
            {planned.map((a) => (
              <RadioRow key={a.id} selected={dest === a.id} onClick={() => setDest(a.id)} title={awbLabel(a)} hint={[a.flight_no, a.etd ? `départ ${fmtDay(a.etd)}` : null, `${a.package_count ?? 0} paquets`].filter(Boolean).join(' · ')} />
            ))}
            {canCreate && <RadioRow selected={dest === 'new'} onClick={() => setDest('new')} title="Nouvelle expédition" hint="LTA, compagnie, vol" />}
            {planned.length === 0 && !canCreate && <p className={cn('py-3 text-[16px]', TEXT.muted)}>Aucun vol en préparation.</p>}
          </div>
          {isNew && (
            <div className="mt-3 space-y-2.5">
              {!awbUnknown && <TextInput value={awb} onChange={(e) => setAwb(e.target.value)} placeholder="Numéro de LTA" aria-label="Numéro de LTA" inputMode="numeric" className="h-12 tabular-nums" />}
              <button type="button" onClick={() => setAwbUnknown((v) => !v)} className="flex min-h-11 items-center gap-3 text-left">
                <TickBox on={awbUnknown} />
                <span className={cn('text-[16px] font-semibold', TEXT.strong)}>LTA pas encore connue</span>
              </button>
              <div className="grid grid-cols-2 gap-2.5">
                <TextInput value={airline} onChange={(e) => setAirline(e.target.value)} placeholder="Compagnie" aria-label="Compagnie" className="h-12" />
                <TextInput value={flightNo} onChange={(e) => setFlightNo(e.target.value)} placeholder="Vol" aria-label="Vol" className="h-12 uppercase" />
              </div>
              <TextInput type="date" value={etd} onChange={(e) => setEtd(e.target.value)} aria-label="Départ prévu" className="h-12" />
            </div>
          )}
        </section>
        <section>
          <CapsLabel className="mb-1">Paquets fermés · {chosen.length} sur {shippable.length}</CapsLabel>
          {shippable.length === 0 ? <p className={cn('py-3 text-[16px]', TEXT.muted)}>Aucun paquet fermé.</p> : shippable.map((k) => (
            <button key={k.id} type="button" onClick={() => toggle(k.id)} aria-pressed={picked.has(k.id)} className="flex min-h-[56px] w-full items-center gap-3.5 border-b border-[#D9D9D9] py-2 text-left last:border-b-0 dark:border-[#444444]">
              <TickBox on={picked.has(k.id)} />
              <span className={cn('flex-1 text-[17px] font-semibold tabular-nums', TEXT.strong)}>{k.package_no}</span>
              <span className={cn('text-[16px] font-semibold tabular-nums', TEXT.strong)}>{formatKg(packageKg(k))}</span>
            </button>
          ))}
        </section>
        <BigButton disabled={!canSubmit} loading={ship.isPending} onClick={() => void submit()}>
          {chosen.length > 0 ? `Mettre ${plural(chosen.length, 'paquet')} · ${formatKg(kg)}` : 'Mettre sur un vol'}
        </BigButton>
      </div>
    </BottomSheet>
  );
}
