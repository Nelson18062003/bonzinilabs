// ============================================================
// Mobile admin — Cargo › Avion › ouvrir ou corriger une expédition.
//
// La LTA d'abord (c'est le seul champ obligatoire), puis la compagnie, le
// vol, les dates, le fret. Un seul bouton. Le même écran corrige la fiche
// (/modifier) — la LTA ne change plus une fois l'avion parti.
//
// LTA pas encore connue : on ouvre quand même l'expédition (la base lui
// donne une LTA provisoire, jamais montrée) — la date de départ prévue
// devient alors obligatoire. La vraie LTA se saisit ensuite, même l'avion
// parti, tant que la LTA est provisoire.
//
// Refonte v2 (maquette 10/38), sur téléphone : champs à libellé en
// capitales, « LTA pas encore connue » en interrupteur, et à la création
// les paquets fermés du bureau à cocher (ils montent dans l'avion ouvert).
// L'ordinateur (`desktop`) rend exactement comme avant.
// ============================================================
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Check, Plane } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAirShipment, useCreateAirShipment, useShipPackages, useUpdateAirShipment } from '@/hooks/useAirShipments';
import { useAirPackages } from '@/hooks/useAirPackages';
import { fmtKg1, isAssignable, packageKg } from '@/lib/airPackage';
import { cleanAwb, formatAwb, isAwbValid, isProvisionalAwb, parseFreightUsd } from '@/lib/airShipment';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, BigButton, Card, Dock, FormField, PrimaryPill, ScreenLoader, ScreenTop, TextArea as MTextArea, TextInput } from '@/mobile/designKit';
import { CapsLabel, UnitField } from '@/mobile/components/cargo/v2';
import { TickBox } from '@/mobile/components/reception/packageBits';
import { TextArea } from '@/components/form';

export function MobileCargoAirForm({ desktop = false }: { desktop?: boolean } = {}) {
  const navigate = useNavigate();
  const { airId } = useParams<{ airId?: string }>();
  const { hasPermission } = useAdminAuth();
  const { data: existing, isLoading } = useAirShipment(airId);
  const create = useCreateAirShipment();
  const update = useUpdateAirShipment();

  const [awb, setAwb] = useState('');
  const [airline, setAirline] = useState('');
  const [flight, setFlight] = useState('');
  const [etd, setEtd] = useState('');
  const [eta, setEta] = useState('');
  const [freight, setFreight] = useState('');
  const [notes, setNotes] = useState('');
  /** Création seulement : « LTA pas encore connue ». */
  const [awbUnknown, setAwbUnknown] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const ship = useShipPackages();
  const bureau = useAirPackages('bureau', null, !desktop && !airId);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!existing || seeded) return;
    // Une LTA provisoire ne se montre pas : le champ reste vide, prêt pour la vraie.
    setAwb(isProvisionalAwb(existing.awb_number) ? '' : formatAwb(existing.awb_number)); setAirline(existing.airline ?? ''); setFlight(existing.flight_no ?? '');
    setEtd(existing.etd ?? ''); setEta(existing.eta ?? ''); setFreight(existing.freight_usd != null ? String(existing.freight_usd) : ''); setNotes(existing.notes ?? '');
    setSeeded(true);
  }, [existing, seeded]);

  if (!hasPermission('canManageCargo')) return <Navigate to="/m/cargo/avion" replace />;
  if (airId && isLoading) return <ScreenLoader className="min-h-[100dvh]" />;

  const editing = !!existing;
  /** L'expédition a encore sa LTA provisoire : la vraie se saisit, même l'avion parti. */
  const provisional = editing && (existing.awb_provisional ?? isProvisionalAwb(existing.awb_number));
  const locked = editing && existing.status !== 'PLANNED' && !provisional;
  const noAwb = !editing && awbUnknown;
  const awbClean = cleanAwb(awb);
  // Sans LTA (création) : la date de départ prévue est obligatoire. LTA provisoire : vide = toujours à venir.
  const valid = noAwb ? !!etd : provisional ? awbClean.length === 0 || isAwbValid(awb) : isAwbValid(awb);
  const pending = create.isPending || update.isPending;

  const submit = async () => {
    if (!valid || pending) return;
    // Vide à la création = LTA provisoire (la base la génère) ; vide en correction = on n'y touche pas.
    const awbNumber = locked ? undefined : noAwb ? '' : editing && awbClean.length === 0 ? undefined : awbClean;
    const input = { awbNumber, airline: airline.trim(), flightNo: flight.trim(), etd: etd || null, eta: eta || null, freightUsd: parseFreightUsd(freight), notes: notes.trim() };
    try {
      const s = editing ? await update.mutateAsync({ id: existing.id, ...input }) : await create.mutateAsync(input);
      navigate(`/m/cargo/avion/${s.id}`, { replace: true });
    } catch {
      /* le refus du serveur est déjà affiché (toast du hook) ; on reste sur le formulaire */
    }
  };

  if (desktop) return (
    <div className={desktop ? 'mx-auto max-w-2xl' : cn('flex min-h-full flex-col', SURFACE.canvas)}>
      {!desktop && <MobileHeader title={editing ? 'Corriger la fiche' : 'Nouvelle expédition'} subtitle="Air cargo · Guangzhou → Douala" showBack backTo={editing ? `/m/cargo/avion/${existing.id}` : '/m/cargo/avion'} />}
      <div className={cn('space-y-5 px-4 pb-32 pt-4', desktop && 'px-0')}>
        <Card className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#C8102E] text-white"><Plane className="h-5 w-5" /></span>
            <p className={cn(TYPE.small, TEXT.muted)}>{noAwb ? "Sans LTA, c'est la date de départ prévue qui identifie l'expédition en attendant." : "La LTA (lettre de transport aérien) identifie l'expédition. Le reste peut se compléter plus tard."}</p>
          </div>
          {!noAwb && (
            <FormField
              label={provisional ? 'Saisissez la vraie LTA' : 'Numéro de LTA'}
              htmlFor="air-awb"
              hint={locked ? "L'avion est parti : la LTA ne change plus." : provisional ? 'La LTA est encore « à venir ». Saisissez-la dès que le transitaire la donne — laissez vide si vous ne l’avez pas encore.' : '3 chiffres de la compagnie, puis 8 — comme sur le document.'}
            >
              <TextInput id="air-awb" value={awb} onChange={(e) => setAwb(e.target.value)} placeholder="071-12345675" inputMode="numeric" autoFocus={!editing || provisional} disabled={locked} className="h-14 text-[20px] font-semibold tabular-nums" />
            </FormField>
          )}
          {!editing && (
            <button
              type="button"
              role="switch"
              aria-checked={awbUnknown}
              onClick={() => setAwbUnknown((v) => !v)}
              className={cn('flex min-h-[56px] w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors', awbUnknown ? 'border-[#2C2C2C] bg-[#F5F5F5] dark:border-[#E3E3E3] dark:bg-[#383838]' : cn(SURFACE.card, SURFACE.divider))}
            >
              <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md border', awbUnknown ? 'border-[#2C2C2C] bg-[#2C2C2C] text-white dark:border-[#E3E3E3] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]' : 'border-[#949494]')}>
                {awbUnknown && <Check className="h-4 w-4" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block', TYPE.bodyStrong, TEXT.strong)}>LTA pas encore connue</span>
                <span className={cn('mt-0.5 block', TYPE.small, TEXT.muted)}>On ouvre l'expédition maintenant ; la LTA se saisira plus tard, même après le départ.</span>
              </span>
            </button>
          )}
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
            <FormField label="Compagnie" htmlFor="air-airline"><TextInput id="air-airline" value={airline} onChange={(e) => setAirline(e.target.value)} placeholder="Ethiopian, Turkish…" className="h-12" /></FormField>
            <FormField label="Vol" htmlFor="air-flight"><TextInput id="air-flight" value={flight} onChange={(e) => setFlight(e.target.value)} placeholder="ET 607" className="h-12 uppercase" /></FormField>
          </div>
        </Card>
        <Card className="space-y-4">
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
            <FormField label={noAwb ? 'Départ prévu (obligatoire)' : 'Départ prévu'} htmlFor="air-etd" hint={noAwb && !etd ? 'Sans LTA, indiquez au moins la date de départ prévue.' : undefined}><TextInput id="air-etd" type="date" value={etd} onChange={(e) => setEtd(e.target.value)} required={noAwb} className="h-12" /></FormField>
            <FormField label="Arrivée prévue" htmlFor="air-eta"><TextInput id="air-eta" type="date" value={eta} onChange={(e) => setEta(e.target.value)} className="h-12" /></FormField>
          </div>
          <FormField label="Fret payé à la compagnie" htmlFor="air-freight" hint="Facultatif, en dollars.">
            <div className="relative"><TextInput id="air-freight" value={freight} onChange={(e) => setFreight(e.target.value)} inputMode="decimal" placeholder="0" className="h-12 pr-14 tabular-nums" /><span className={cn('pointer-events-none absolute right-4 top-1/2 -translate-y-1/2', TYPE.small, TEXT.muted)}>USD</span></div>
          </FormField>
          <TextArea id="air-notes" label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Transitaire, contact à l'aéroport…" controlClassName="min-h-[72px]" />
        </Card>
        {desktop && (
          <PrimaryPill onClick={() => void submit()} disabled={!valid} loading={pending} className="h-12 px-6 text-[15px]">{editing ? 'Enregistrer' : 'Ouvrir l’expédition'}</PrimaryPill>
        )}
      </div>
      {!desktop && (
        <div className={cn('fixed inset-x-0 bottom-0 z-30 border-t px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3', SURFACE.canvas, SURFACE.divider)}>
          <PrimaryPill onClick={() => void submit()} disabled={!valid} loading={pending} className="h-14 w-full text-[17px]">{editing ? 'Enregistrer' : 'Ouvrir l’expédition'}</PrimaryPill>
        </div>
      )}
    </div>
  );

  // ── Téléphone (v2, maquette 10/38) ─────────────────────────────────────
  const pickable = (bureau.data ?? []).filter(isAssignable);
  const chosen = pickable.filter((k) => picked.has(k.id));
  const submitMobile = async () => {
    if (!valid || pending || ship.isPending) return;
    if (editing || chosen.length === 0) { await submit(); return; }
    // Création avec des paquets : l'expédition s'ouvre, puis ses paquets y montent (même RPC que « Mettre sur un vol »).
    const input = { awbNumber: noAwb ? '' : awbClean, airline: airline.trim(), flightNo: flight.trim(), etd: etd || null, eta: eta || null, freightUsd: parseFreightUsd(freight), notes: notes.trim() };
    try {
      const r = await ship.mutateAsync({ create: input, packageIds: chosen.map((k) => k.id) });
      if (r.assignError) toast.error(`Expédition ouverte, paquets non affectés : ${r.assignError}`);
      else toast.success(`Expédition ouverte · ${r.assigned} paquet${r.assigned > 1 ? 's' : ''}`);
      navigate(`/m/cargo/avion/${r.airId}`, { replace: true });
    } catch { /* le hook affiche le refus */ }
  };

  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <ScreenTop title={editing ? 'Corriger la fiche' : 'Nouvelle expédition'} backTo={editing ? `/m/cargo/avion/${existing.id}` : '/m/cargo/avion'} />
      <div className="flex-1 space-y-5 px-5 pb-6 pt-5">
        {!noAwb && (
          <div>
            <CapsLabel as="label">{provisional ? 'La vraie LTA' : 'Numéro de LTA'}</CapsLabel>
            <TextInput className="mt-2 h-14 text-[20px] font-semibold tabular-nums" value={awb} onChange={(e) => setAwb(e.target.value)} placeholder="071-1234 5675" inputMode="numeric" disabled={locked} aria-label="Numéro de LTA" />
            {locked && <p className={cn('mt-1.5 text-[15px]', TEXT.muted)}>Figée : l'avion est parti</p>}
            {awbClean.length > 0 && !isAwbValid(awb) && !locked && <p className="mt-1.5 text-[15px] font-medium text-[#975102] dark:text-[#E8B931]">3 + 8 chiffres</p>}
          </div>
        )}
        {!editing && (
          <button type="button" role="switch" aria-checked={awbUnknown} onClick={() => setAwbUnknown((v) => !v)} className="flex w-full items-center justify-between gap-3 py-1 text-left">
            <span className={cn('text-[17px] font-semibold', TEXT.strong)}>LTA pas encore connue</span>
            <span className={cn('relative h-8 w-[52px] shrink-0 rounded-full transition-colors', awbUnknown ? 'bg-[#2C2C2C] dark:bg-[#E3E3E3]' : 'bg-[#D9D9D9] dark:bg-[#444444]')}>
              <span className={cn('absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all dark:bg-[#1E1E1E]', awbUnknown ? 'left-[24px]' : 'left-1')} />
            </span>
          </button>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div><CapsLabel as="label">Compagnie</CapsLabel><TextInput className="mt-2 h-14" value={airline} onChange={(e) => setAirline(e.target.value)} placeholder="Ethiopian" aria-label="Compagnie" /></div>
          <div><CapsLabel as="label">Vol</CapsLabel><TextInput className="mt-2 h-14 uppercase" value={flight} onChange={(e) => setFlight(e.target.value)} placeholder="ET 607" aria-label="Vol" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><CapsLabel as="label">Départ prévu</CapsLabel><TextInput type="date" className="mt-2 h-14" value={etd} onChange={(e) => setEtd(e.target.value)} required={noAwb} aria-label="Départ prévu" /></div>
          <div><CapsLabel as="label">Arrivée prévue</CapsLabel><TextInput type="date" className="mt-2 h-14" value={eta} onChange={(e) => setEta(e.target.value)} aria-label="Arrivée prévue" /></div>
        </div>
        {noAwb && !etd && <p className="-mt-2 text-[15px] font-medium text-[#975102] dark:text-[#E8B931]">Sans LTA : la date de départ</p>}
        <div><CapsLabel as="label">Fret</CapsLabel><UnitField className="mt-2" unit="USD" value={freight} onChange={(e) => setFreight(e.target.value)} placeholder="0" aria-label="Fret payé à la compagnie" /></div>
        <div><CapsLabel as="label">Notes</CapsLabel><MTextArea className="mt-2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Transitaire, contact à l'aéroport…" rows={2} aria-label="Notes" /></div>

        {!editing && pickable.length > 0 && (
          <div>
            <CapsLabel>Paquets fermés · {chosen.length} sur {pickable.length}</CapsLabel>
            <div className="mt-1">
              {pickable.map((k) => {
                const on = picked.has(k.id);
                return (
                  <button key={k.id} type="button" role="checkbox" aria-checked={on} onClick={() => setPicked((s) => { const n = new Set(s); if (n.has(k.id)) n.delete(k.id); else n.add(k.id); return n; })}
                    className={cn('flex w-full items-center gap-3.5 border-b py-3.5 text-left last:border-b-0', SURFACE.divider)}>
                    <TickBox on={on} />
                    <span className={cn('min-w-0 flex-1 text-[17px] font-semibold tabular-nums', TEXT.strong)}>{k.package_no}</span>
                    <span className={cn('text-[17px] font-semibold tabular-nums', TEXT.strong)}>{fmtKg1(packageKg(k))}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <Dock>
        <BigButton onClick={() => void submitMobile()} disabled={!valid} loading={pending || ship.isPending}>{editing ? 'Enregistrer' : 'Ouvrir l’expédition'}</BigButton>
      </Dock>
    </div>
  );
}
