// ============================================================
// Les PAQUETS de 32 kg d'une expédition aérienne, au téléphone (refonte v2,
// maquette 04/05). Le pendant mobile d'AirPackagesPanel (qui reste pour
// l'ordinateur), sur les mêmes hooks air_package_* : « Scan au départ 4 / 6 »,
// une ligne par paquet (rond vert = scanné), et, au toucher d'un paquet,
// Ouvrir · Retirer · Refusé à l'aéroport. Ajouter des paquets et le scan
// sont pilotés par la fiche (son « … » et son bouton noir).
// Écriture : canManageCargo (la base revérifie chaque RPC).
// ============================================================
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, PackageOpen, Phone, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAirPackages, useAssignAirPackages, useRefuseAirPackage, useScanPackageDeparture, useUnassignAirPackage } from '@/hooks/useAirPackages';
import { fmtKg1, isAssignable, packageKg, packageStatusMeta, parsePackageCode, type AirPackage, type AirPackageParcel } from '@/lib/airPackage';
import { packageProgress, type AirShipment } from '@/lib/airShipment';
import { clientFullName } from '@/lib/reception';
import { cn } from '@/lib/utils';
import { ActionSheet, BigButton, BottomSheet, Chip, ConfirmSheet, EmptyLine, ScreenLoader, SURFACE, TEXT, Tag, TextArea } from '@/mobile/designKit';
import { ParcelScanBox, type ScanResult } from './ParcelScanBox';
import { CapsLabel, StateCircle } from './v2';
import { TickBox } from '@/mobile/components/reception/packageBits';

const isGone = (k: Pick<AirPackage, 'status'>) => k.status === 'handed_over' || k.status === 'received' || k.status === 'opened';
const colis = (n: number | null | undefined) => `${Number(n ?? 0)} colis`;
const QUICK_REASONS = ['Batterie ou produit dangereux', 'Emballage abîmé', 'Poids ou dimensions refusés', 'Contrôle de sûreté'];

interface Refused { packageNo: string; parcels: number; clients: { key: string; name: string; code: string | null; phone: string | null }[] }
function clientsOf(parcels: readonly AirPackageParcel[] | null | undefined): Refused['clients'] {
  const by = new Map<string, Refused['clients'][number]>();
  for (const p of parcels ?? []) if (p.client && !by.has(p.client.user_id)) by.set(p.client.user_id, { key: p.client.user_id, name: clientFullName(p.client), code: p.client.customer_code ?? null, phone: p.client.phone ?? null });
  return [...by.values()];
}

/** Le compte du scan au départ, pour la fiche (bouton et titre). */
export function departureCount(a: AirShipment, scannedNow: ReadonlySet<string>) {
  const packages = a.packages ?? [];
  const prog = packageProgress(a);
  const scanned = packages.length > 0 ? packages.filter((k) => isGone(k) || scannedNow.has(k.package_no)).length : prog.scanned;
  return { scanned, total: prog.total, received: prog.received };
}

export function AirPackagesV2({ shipment: a, scanning, adding, onAddingChange, scannedNow, onScanned }: {
  shipment: AirShipment;
  scanning: boolean;
  adding: boolean;
  onAddingChange: (v: boolean) => void;
  scannedNow: ReadonlySet<string>;
  onScanned: (no: string, add: boolean) => void;
}) {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission('canManageCargo');
  const planned = a.status === 'PLANNED';
  const departed = a.status === 'DEPARTED';
  const arrived = a.status === 'ARRIVED' || a.status === 'DELIVERED';
  const packages = useMemo(() => a.packages ?? [], [a.packages]);

  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<AirPackage | null>(null);
  const [removing, setRemoving] = useState<AirPackage | null>(null);
  const [refusing, setRefusing] = useState<AirPackage | null>(null);
  const [reason, setReason] = useState('');
  const [refused, setRefused] = useState<Refused | null>(null);

  const bureau = useAirPackages('bureau', null, adding);
  const assign = useAssignAirPackages(a.id);
  const unassign = useUnassignAirPackage();
  const scan = useScanPackageDeparture(a.id);
  const refuse = useRefuseAirPackage();

  const assignable = useMemo(() => (bureau.data ?? []).filter(isAssignable), [bureau.data]);
  const stillOpen = (bureau.data ?? []).filter((k) => k.status === 'open').length;
  const chosen = assignable.filter((k) => picked.has(k.id));
  const chosenKg = chosen.reduce((t, k) => t + packageKg(k), 0);
  const { scanned, total, received } = departureCount(a, scannedNow);
  const isScanned = (k: AirPackage) => isGone(k) || scannedNow.has(k.package_no);

  const closeAdd = () => { onAddingChange(false); setPicked(new Set()); };
  const submitAdd = async () => {
    if (chosen.length === 0 || assign.isPending) return;
    try { await assign.mutateAsync(chosen.map((k) => k.id)); closeAdd(); } catch { /* le hook affiche le refus */ }
  };
  const onScan = async (text: string): Promise<ScanResult> => {
    const code = parsePackageCode(text);
    if (!code) return { outcome: 'unknown', text: `${text.trim()} : pas une étiquette PQ-` };
    try {
      const r = await scan.mutateAsync(code);
      onScanned(r.package_no, true);
      const done = r.scanned >= r.total ? ' · tous scannés' : '';
      return r.already ? { outcome: 'again', text: `${r.package_no} déjà scanné · ${r.scanned}/${r.total}${done}` } : { outcome: 'ok', text: `${r.package_no} scanné · ${r.scanned}/${r.total}${done}` };
    } catch (e) { return { outcome: 'refused', text: (e as Error).message }; }
  };
  const doRemove = () => {
    if (!removing || unassign.isPending) return;
    const no = removing.package_no;
    unassign.mutate(removing.id, { onSuccess: () => { onScanned(no, false); setRemoving(null); } });
  };
  const reasonOk = reason.trim().length >= 3;
  const doRefuse = async () => {
    if (!refusing || !reasonOk || refuse.isPending) return;
    try {
      const r = await refuse.mutateAsync({ packageId: refusing.id, reason });
      const out: Refused = { packageNo: refusing.package_no, parcels: r.parcels, clients: clientsOf(r.package?.parcels) };
      onScanned(out.packageNo, false); setRefusing(null); setReason('');
      if (r.clients_told_departed) setRefused(out);
      else toast.success(`Paquet ${out.packageNo} refusé`, { description: `${colis(out.parcels)} reviennent au bureau.` });
    } catch { /* le hook affiche le refus du serveur */ }
  };

  const tagOf = (k: AirPackage) => {
    if (planned) return isScanned(k) ? { tone: 'success' as const, label: 'Scanné' } : { tone: 'pending' as const, label: 'À scanner' };
    const meta = packageStatusMeta(k.status);
    return { tone: meta.tone, label: meta.label };
  };
  const canAct = (k: AirPackage) => canManage && (planned || departed) && !(k.status === 'received' || k.status === 'opened');

  if (packages.length === 0 && !planned && !refused) return null;

  return (
    <section className="pt-6">
      <div className="flex items-baseline justify-between px-5">
        <h2 className={cn('text-[20px] font-semibold', TEXT.strong)}>{arrived ? 'Reçus à Douala' : 'Scan au départ'}</h2>
        {total > 0 && <span className={cn('text-[17px] font-semibold tabular-nums', TEXT.strong)}>{arrived ? received : scanned} / {total}</span>}
      </div>
      {scanning && planned && canManage && (
        <div className="px-5 pt-3"><ParcelScanBox onScan={onScan} placeholder="PQ-…" counter={`${scanned} / ${total}`} /></div>
      )}
      {packages.length === 0 ? <EmptyLine>Aucun paquet.</EmptyLine> : (
        <div className="px-5 pt-1">
          {packages.map((k) => (
            <button key={k.id} type="button" onClick={() => setMenu(k)} className={cn('flex w-full items-center gap-3.5 border-b py-3.5 text-left last:border-b-0 active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.divider)}>
              <StateCircle state={isScanned(k) ? 'done' : 'todo'} />
              <span className="min-w-0 flex-1">
                <span className={cn('block text-[17px] font-semibold tabular-nums', TEXT.strong)}>{k.package_no}</span>
                <span className={cn('block truncate text-[15px] tabular-nums', TEXT.muted)}>{fmtKg1(k.gross_weight_kg ?? k.net_weight_kg)} · {colis(k.parcel_count)}{Number(k.client_count ?? 0) > 1 ? ` · ${k.client_count} clients` : ''}</span>
              </span>
              <Tag tone={tagOf(k).tone}>{tagOf(k).label}</Tag>
            </button>
          ))}
        </div>
      )}

      <ActionSheet
        open={!!menu}
        onClose={() => setMenu(null)}
        title={menu?.package_no}
        actions={[
          { label: 'Ouvrir le paquet', icon: PackageOpen, onClick: () => { const id = menu!.id; setMenu(null); navigate(`/m/cargo/reception?${new URLSearchParams({ paquet: id }).toString()}`); } },
          { label: 'Retirer de l’expédition', icon: Undo2, hidden: !menu || !canAct(menu) || !planned, onClick: () => { setRemoving(menu); setMenu(null); } },
          { label: 'Refusé à l’aéroport', icon: AlertTriangle, danger: true, hidden: !menu || !canAct(menu), onClick: () => { setReason(''); setRefusing(menu); setMenu(null); } },
        ]}
      />

      <BottomSheet open={adding} onClose={closeAdd} title="Ajouter des paquets">
        {!bureau.data ? <ScreenLoader className="min-h-[120px]" /> : assignable.length === 0 ? (
          <div className="space-y-3">
            <p className={cn('text-[16px]', TEXT.muted)}>Aucun paquet fermé au bureau.{stillOpen > 0 ? ` ${stillOpen} encore ouvert${stillOpen > 1 ? 's' : ''}.` : ''}</p>
            {hasPermission('canReceiveParcels') && <BigButton variant="soft" onClick={() => { closeAdd(); navigate('/r/paquets'); }}>Paquets du bureau</BigButton>}
          </div>
        ) : (
          <div className="space-y-1">
            {assignable.map((k) => {
              const on = picked.has(k.id);
              return (
                <button key={k.id} type="button" role="checkbox" aria-checked={on} onClick={() => setPicked((s) => { const n = new Set(s); if (n.has(k.id)) n.delete(k.id); else n.add(k.id); return n; })}
                  className={cn('flex w-full items-center gap-3.5 border-b py-3 text-left last:border-b-0', SURFACE.divider)}>
                  <TickBox on={on} />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-[17px] font-semibold tabular-nums', TEXT.strong)}>{k.package_no}</span>
                    <span className={cn('block truncate text-[15px] tabular-nums', TEXT.muted)}>{fmtKg1(packageKg(k))} · {colis(k.parcel_count)}{k.status === 'refused' && k.refusal_reason ? ` · refusé : ${k.refusal_reason}` : ''}</span>
                  </span>
                  {k.status === 'refused' && <Tag tone="danger">Refusé</Tag>}
                </button>
              );
            })}
            <BigButton className="mt-4" onClick={() => void submitAdd()} disabled={chosen.length === 0} loading={assign.isPending}>
              {chosen.length > 0 ? `Ajouter ${chosen.length} paquet${chosen.length > 1 ? 's' : ''} · ${fmtKg1(chosenKg)}` : 'Ajouter'}
            </BigButton>
          </div>
        )}
      </BottomSheet>

      <ConfirmSheet
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={removing ? `Retirer ${removing.package_no} ?` : ''}
        rows={removing ? [{ label: 'Colis', value: colis(removing.parcel_count) }, { label: 'Retour', value: 'au bureau' }] : []}
        confirmLabel="Retirer"
        cancelLabel="Garder"
        onConfirm={doRemove}
        loading={unassign.isPending}
      />

      <BottomSheet open={!!refusing} onClose={() => setRefusing(null)} title={refusing ? `${refusing.package_no} refusé ?` : ''}>
        {refusing && (
          <div className="space-y-4">
            {departed && <p className="text-[16px] font-semibold text-[#C00F0C] dark:text-[#FCB3AD]">Clients déjà prévenus du départ</p>}
            <div>
              <CapsLabel as="label">Motif</CapsLabel>
              <TextArea className="mt-2" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ce que l'aéroport a dit…" maxLength={300} rows={3} aria-label="Motif du refus" />
            </div>
            <div className="flex flex-wrap gap-2">{QUICK_REASONS.map((r) => <Chip key={r} active={reason === r} onClick={() => setReason(r)} label={r} />)}</div>
            <BigButton variant="danger" onClick={() => void doRefuse()} disabled={!reasonOk} loading={refuse.isPending}>Déclarer le refus</BigButton>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={!!refused} onClose={() => setRefused(null)} title="Prévenez les clients">
        {refused && (
          <div className="space-y-3">
            <p className={cn('text-[16px]', TEXT.body)}>{refused.packageNo} · {colis(refused.parcels)} revenus au bureau, pas dans l'avion.</p>
            {refused.clients.map((c) => (
              <div key={c.key} className={cn('flex items-center gap-3 border-b py-3 last:border-b-0', SURFACE.divider)}>
                <span className={cn('min-w-0 flex-1 text-[17px] font-semibold', TEXT.strong)}>{c.name}{c.code && <span className={cn('ml-2 text-[15px] font-normal tabular-nums', TEXT.muted)}>{c.code}</span>}</span>
                {c.phone && <a href={`tel:${c.phone}`} className={cn('flex h-11 items-center gap-2 rounded-full px-3 text-[15px] font-semibold', SURFACE.holder, TEXT.strong)}><Phone className="h-4 w-4" />{c.phone}</a>}
              </div>
            ))}
            <BigButton onClick={() => setRefused(null)}>Compris</BigButton>
          </div>
        )}
      </BottomSheet>
    </section>
  );
}
