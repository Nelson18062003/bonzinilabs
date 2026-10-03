// ============================================================
// Mobile admin — Cargo › Avion › ouvrir ou corriger une expédition.
//
// La LTA d'abord (c'est le seul champ obligatoire), puis la compagnie, le
// vol, les dates, le fret. Un seul bouton. Le même écran corrige la fiche
// (/modifier) — la LTA ne change plus une fois l'avion parti.
// ============================================================
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Plane } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAirShipment, useCreateAirShipment, useUpdateAirShipment } from '@/hooks/useAirShipments';
import { formatAwb } from '@/lib/airShipment';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Card, FormField, PrimaryPill, ScreenLoader, TextInput } from '@/mobile/designKit';
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
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!existing || seeded) return;
    setAwb(formatAwb(existing.awb_number)); setAirline(existing.airline ?? ''); setFlight(existing.flight_no ?? '');
    setEtd(existing.etd ?? ''); setEta(existing.eta ?? ''); setFreight(existing.freight_usd != null ? String(existing.freight_usd) : ''); setNotes(existing.notes ?? '');
    setSeeded(true);
  }, [existing, seeded]);

  if (!hasPermission('canManageCargo')) return <Navigate to="/m/cargo/avion" replace />;
  if (airId && isLoading) return <ScreenLoader className="min-h-[100dvh]" />;

  const editing = !!existing;
  const locked = editing && existing.status !== 'PLANNED';
  const valid = awb.replace(/\s|-/g, '').length >= 4;
  const pending = create.isPending || update.isPending;

  const submit = async () => {
    if (!valid || pending) return;
    const freightUsd = freight.trim() ? Number(freight.replace(',', '.')) : null;
    const input = { awbNumber: locked ? undefined : awb.replace(/\s|-/g, ''), airline: airline.trim(), flightNo: flight.trim(), etd: etd || null, eta: eta || null, freightUsd: Number.isFinite(freightUsd as number) ? freightUsd : null, notes: notes.trim() };
    const s = editing ? await update.mutateAsync({ id: existing.id, ...input }) : await create.mutateAsync(input);
    navigate(`/m/cargo/avion/${s.id}`, { replace: true });
  };

  return (
    <div className={desktop ? 'mx-auto max-w-2xl' : cn('flex min-h-full flex-col', SURFACE.canvas)}>
      {!desktop && <MobileHeader title={editing ? 'Corriger la fiche' : 'Nouvelle expédition'} subtitle="Air cargo · Guangzhou → Douala" showBack backTo={editing ? `/m/cargo/avion/${existing.id}` : '/m/cargo/avion'} />}
      <div className={cn('space-y-5 px-4 pb-32 pt-4', desktop && 'px-0')}>
        <Card className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#C8102E] text-white"><Plane className="h-5 w-5" /></span>
            <p className={cn(TYPE.small, TEXT.muted)}>La LTA (lettre de transport aérien) identifie l'expédition. Le reste peut se compléter plus tard.</p>
          </div>
          <FormField label="Numéro de LTA" htmlFor="air-awb" hint={locked ? "L'avion est parti : la LTA ne change plus." : '3 chiffres de la compagnie, puis 8 — comme sur le document.'}>
            <TextInput id="air-awb" value={awb} onChange={(e) => setAwb(e.target.value)} placeholder="071-12345675" inputMode="numeric" autoFocus={!editing} disabled={locked} className="h-14 text-[20px] font-semibold tabular-nums" />
          </FormField>
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
            <FormField label="Compagnie" htmlFor="air-airline"><TextInput id="air-airline" value={airline} onChange={(e) => setAirline(e.target.value)} placeholder="Ethiopian, Turkish…" className="h-12" /></FormField>
            <FormField label="Vol" htmlFor="air-flight"><TextInput id="air-flight" value={flight} onChange={(e) => setFlight(e.target.value)} placeholder="ET 607" className="h-12 uppercase" /></FormField>
          </div>
        </Card>
        <Card className="space-y-4">
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
            <FormField label="Départ prévu" htmlFor="air-etd"><TextInput id="air-etd" type="date" value={etd} onChange={(e) => setEtd(e.target.value)} className="h-12" /></FormField>
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
}
