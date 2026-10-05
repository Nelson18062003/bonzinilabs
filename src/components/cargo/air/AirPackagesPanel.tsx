// ============================================================
// Les PAQUETS de 32 kg d'une expédition aérienne — le même panneau sur la
// fiche mobile (/m/cargo/avion/:id) et dans la fenêtre desktop.
//
// Ce qui part à l'aéroport, ce sont les paquets (PQ-000123), pas les colis
// un par un : on les ajoute à l'expédition tant qu'elle est en préparation,
// on les scanne au départ (l'avion ne part qu'avec tous ses paquets
// scannés), on en retire un, ou on déclare que l'aéroport l'a refusé — avant
// ou après le départ. Après le départ, les clients ont déjà été prévenus
// « vos colis sont partis » : l'écran le rappelle en gros.
//
// Écriture : canManageCargo (la base revérifie chaque RPC air_package_*).
// ============================================================
import { useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Check, Loader2, Package, PackagePlus, ScanLine, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAirPackages, useAssignAirPackages, useRefuseAirPackage, useScanPackageDeparture, useUnassignAirPackage } from '@/hooks/useAirPackages';
import { fmtKg1, isAssignable, packageStatusMeta, parsePackageCode, type AirPackage, type AirPackageParcel } from '@/lib/airPackage';
import { packageClientsFromParcels, packageProgress, type AirShipment } from '@/lib/airShipment';
import { clientFullName } from '@/lib/reception';
import { cn } from '@/lib/utils';
import { TextArea } from '@/components/form';
import { ParcelScanBox, type ScanResult } from '@/mobile/components/cargo/ParcelScanBox';
import { Band } from '@/components/cargo/dossier/kit';
import {
  SURFACE as M_SURFACE, TEXT as M_TEXT, TYPE, BottomSheet, Button, Card, Line, ScreenLoader, StatusPill, TONE_TEXT,
} from '@/mobile/designKit';
import {
  TEXT as D_TEXT, SOFT_PILL as D_SOFT, PRIMARY_PILL as D_PRIMARY, DANGER_SOFT_PILL as D_DANGER, CenterDialog, Th, Td,
} from '@/desktop/designKit';

type Variant = 'mobile' | 'desktop';

/** Un paquet parti de Guangzhou : scanné au départ, ou déjà reçu / ouvert à Douala. */
const isGone = (k: Pick<AirPackage, 'status'>) => k.status === 'handed_over' || k.status === 'received' || k.status === 'opened';
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;
/** « 1 colis », « 3 colis » (invariable). */
const colis = (n: number | null | undefined) => `${Number(n ?? 0)} colis`;
/** Le poids pesé du paquet fermé ; à défaut, la somme de ses colis. */
const packageKg = (k: Pick<AirPackage, 'gross_weight_kg' | 'net_weight_kg'>) => Number(k.gross_weight_kg ?? k.net_weight_kg ?? 0);

const QUICK_REASONS = ['Batterie ou produit dangereux', 'Emballage abîmé', 'Poids ou dimensions refusés', 'Contrôle de sûreté'];

/* ── La pastille « PQ-000123 » d'un colis emballé ─────────────────────── */

export function PackageChip({ packageNo, variant }: { packageNo: string; variant: Variant }) {
  return (
    <span
      title={`Voyage dans le paquet ${packageNo}`}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md font-semibold tabular-nums',
        variant === 'desktop' ? 'bg-muted px-1.5 py-0.5 text-[11px] text-foreground' : cn('px-2 py-0.5 text-[14px]', M_SURFACE.holder),
      )}
    >
      <Package className={variant === 'desktop' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {packageNo}
    </span>
  );
}

/* ── Les primitives des deux variantes ────────────────────────────────── */

type ActKind = 'primary' | 'neutral' | 'danger';

function Act({ variant, kind = 'neutral', onClick, disabled, loading, children, className, size = 'md' }: {
  variant: Variant; kind?: ActKind; onClick?: () => void; disabled?: boolean; loading?: boolean; children: ReactNode; className?: string; size?: 'md' | 'sm';
}) {
  if (variant === 'mobile') {
    return (
      <Button variant={kind === 'primary' ? 'primary' : kind === 'danger' ? 'dangerSubtle' : 'neutral'} size={size} onClick={onClick} disabled={disabled} loading={loading} className={className}>
        {children}
      </Button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50 [&_svg]:h-3.5 [&_svg]:w-3.5',
        size === 'sm' ? 'h-7 px-2.5 text-[11.5px] font-semibold' : 'h-9 px-3.5 text-[13px] font-semibold',
        kind === 'primary' ? cn(D_PRIMARY, 'font-bold') : kind === 'danger' ? D_DANGER : D_SOFT,
        className,
      )}
    >
      {loading ? <Loader2 className="animate-spin" /> : children}
    </button>
  );
}

/** Une confirmation : feuille basse sur mobile, fenêtre centrée sur ordinateur (empilée sur la fiche). */
function Sheet({ variant, open, onClose, onConfirm, title, children, footer, width }: {
  variant: Variant; open: boolean; onClose: () => void; onConfirm?: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: number;
}) {
  if (variant === 'desktop') {
    return <CenterDialog open={open} onClose={onClose} onConfirm={onConfirm} title={title} footer={footer} width={width}>{children}</CenterDialog>;
  }
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        {children}
        {footer && <div className="flex gap-2">{footer}</div>}
      </div>
    </BottomSheet>
  );
}

/** Une phrase du panneau, à la bonne taille selon l'écran. */
function Say({ variant, tone, children, className }: { variant: Variant; tone?: 'warn' | 'bad' | 'good'; children: ReactNode; className?: string }) {
  if (variant === 'mobile') return <Line tone={tone} className={className}>{children}</Line>;
  return (
    <p className={cn('text-[13px] leading-relaxed', D_TEXT.body,
      tone === 'warn' && 'font-semibold text-amber-700 dark:text-amber-400',
      tone === 'bad' && 'font-semibold text-destructive',
      tone === 'good' && 'font-semibold text-emerald-700 dark:text-emerald-400', className)}>
      {children}
    </p>
  );
}

/** La case à cocher d'une liste (paquets à ajouter). */
function Tick({ on, variant }: { on: boolean; variant: Variant }) {
  return (
    <span className={cn('flex shrink-0 items-center justify-center border',
      variant === 'desktop' ? 'h-5 w-5 rounded' : 'h-7 w-7 rounded-md',
      on ? (variant === 'desktop' ? 'border-foreground bg-foreground text-background' : 'border-[#2C2C2C] bg-[#2C2C2C] text-white dark:border-[#E3E3E3] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]') : (variant === 'desktop' ? 'border-muted-foreground' : 'border-[#949494]'))}>
      {on && <Check className={variant === 'desktop' ? 'h-3.5 w-3.5' : 'h-4 w-4'} strokeWidth={3} />}
    </span>
  );
}

interface RefuseOutcome {
  packageNo: string;
  parcels: number;
  toldDeparted: boolean;
  clients: { key: string; name: string; code: string | null; phone: string | null }[];
}

function clientsOf(parcels: readonly AirPackageParcel[] | null | undefined): RefuseOutcome['clients'] {
  const by = new Map<string, RefuseOutcome['clients'][number]>();
  for (const p of parcels ?? []) {
    if (!p.client) continue;
    if (!by.has(p.client.user_id)) by.set(p.client.user_id, { key: p.client.user_id, name: clientFullName(p.client), code: p.client.customer_code ?? null, phone: p.client.phone ?? null });
  }
  return [...by.values()];
}

/* ── Le panneau ───────────────────────────────────────────────────────── */

export function AirPackagesPanel({ shipment: a, variant }: { shipment: AirShipment; variant: Variant }) {
  const desk = variant === 'desktop';
  const T = desk ? D_TEXT : M_TEXT;
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission('canManageCargo');
  const planned = a.status === 'PLANNED';
  const departed = a.status === 'DEPARTED';
  const arrived = a.status === 'ARRIVED' || a.status === 'DELIVERED';
  const packages = useMemo(() => a.packages ?? [], [a.packages]);
  const parcels = useMemo(() => a.parcels ?? [], [a.parcels]);

  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  /** Les paquets scannés pendant cette session : la coche s'affiche avant le retour du serveur. */
  const [scannedNow, setScannedNow] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState<AirPackage | null>(null);
  const [refusing, setRefusing] = useState<AirPackage | null>(null);
  const [reason, setReason] = useState('');
  const [refused, setRefused] = useState<RefuseOutcome | null>(null);

  const bureau = useAirPackages('bureau', null, adding);
  const assign = useAssignAirPackages(a.id);
  const unassign = useUnassignAirPackage();
  const scan = useScanPackageDeparture(a.id);
  const refuse = useRefuseAirPackage();

  const assignable = useMemo(() => (bureau.data ?? []).filter(isAssignable), [bureau.data]);
  const stillOpen = useMemo(() => (bureau.data ?? []).filter((k) => k.status === 'open').length, [bureau.data]);
  const chosen = assignable.filter((k) => picked.has(k.id));
  const chosenKg = chosen.reduce((t, k) => t + packageKg(k), 0);
  const chosenParcels = chosen.reduce((t, k) => t + Number(k.parcel_count ?? 0), 0);

  const prog = packageProgress(a);
  const isScanned = (k: AirPackage) => isGone(k) || scannedNow.has(k.package_no);
  const scannedCount = packages.length > 0 ? packages.filter(isScanned).length : prog.scanned;
  const total = prog.total;
  const allScanned = total > 0 && scannedCount >= total;

  // Rien à montrer pour une ancienne expédition sans paquet qui n'est plus en préparation.
  if (packages.length === 0 && !planned) return null;

  const summary = total === 0
    ? 'Aucun paquet pour l’instant'
    : `Paquets : ${total} · scannés au départ ${scannedCount}/${total}${arrived ? ` · reçus à Douala ${prog.received}/${total}` : ''}`;

  /* — actions — */
  const togglePick = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const closeAdd = () => { setAdding(false); setPicked(new Set()); };
  const submitAdd = async () => {
    if (chosen.length === 0) return;
    try { await assign.mutateAsync(chosen.map((k) => k.id)); closeAdd(); } catch { /* le hook affiche le refus */ }
  };

  const onScan = async (text: string): Promise<ScanResult> => {
    const code = parsePackageCode(text);
    if (!code) return { outcome: 'unknown', text: `${text.trim()} : ce n'est pas une étiquette de paquet (PQ-000000)` };
    try {
      const r = await scan.mutateAsync(code);
      setScannedNow((s) => new Set(s).add(r.package_no));
      const done = r.scanned >= r.total ? ' — tous scannés' : '';
      return r.already
        ? { outcome: 'again', text: `${r.package_no} déjà scanné · ${r.scanned}/${r.total}${done}` }
        : { outcome: 'ok', text: `${r.package_no} scanné · ${r.scanned}/${r.total}${done}` };
    } catch (e) {
      return { outcome: 'refused', text: (e as Error).message };
    }
  };

  /** Un paquet qui quitte l'expédition repart de zéro : sa coche « scanné » ne le suit pas. */
  const forget = (no: string) => setScannedNow((s) => { if (!s.has(no)) return s; const n = new Set(s); n.delete(no); return n; });

  const doRemove = () => {
    if (!removing || unassign.isPending) return;
    const no = removing.package_no;
    unassign.mutate(removing.id, { onSuccess: () => { forget(no); setRemoving(null); } });
  };

  const reasonOk = reason.trim().length >= 3;
  const doRefuse = async () => {
    if (!refusing || !reasonOk || refuse.isPending) return;
    try {
      const r = await refuse.mutateAsync({ packageId: refusing.id, reason });
      const outcome: RefuseOutcome = { packageNo: refusing.package_no, parcels: r.parcels, toldDeparted: !!r.clients_told_departed, clients: clientsOf(r.package?.parcels) };
      forget(outcome.packageNo); setRefusing(null); setReason('');
      if (outcome.toldDeparted) setRefused(outcome);
      else toast.success(`Paquet ${outcome.packageNo} refusé`, { description: `Ses ${colis(outcome.parcels)} reviennent au bureau ; le paquet pourra partir par une autre expédition.` });
    } catch { /* le hook affiche le refus du serveur */ }
  };

  /* — morceaux — */
  const clientsLine = (k: AirPackage) => {
    const codes = packageClientsFromParcels(k.id, parcels);
    return codes.length ? codes.join(', ') : plural(Number(k.client_count ?? 0), 'client');
  };
  const weightLine = (k: AirPackage) => `${k.gross_weight_kg != null ? `brut ${fmtKg1(k.gross_weight_kg)} · ` : ''}net ${fmtKg1(k.net_weight_kg)}`;
  const rowActions = (k: AirPackage) => canManage && (planned || departed) && !(k.status === 'received' || k.status === 'opened') ? (
    <>
      {planned && <Act variant={variant} size="sm" onClick={() => { setScanning(false); setRemoving(k); }}><Undo2 /> Retirer</Act>}
      <Act variant={variant} size="sm" kind="danger" onClick={() => { setScanning(false); setReason(''); setRefusing(k); }}><AlertTriangle /> Refusé à l'aéroport</Act>
    </>
  ) : null;

  const actions = canManage && planned ? (
    <>
      <Act variant={variant} kind={desk ? 'neutral' : 'primary'} size={desk ? 'sm' : 'md'} onClick={() => { setScanning(false); setAdding(true); }} className={desk ? undefined : 'h-14 w-full text-[17px]'}><PackagePlus /> Ajouter des paquets</Act>
      {total > 0 && (
        <Act variant={variant} size={desk ? 'sm' : 'md'} onClick={() => setScanning((v) => !v)} className={desk ? undefined : 'h-12 w-full'}>
          <ScanLine /> {scanning ? 'Terminer le scan' : `Scanner au départ · ${scannedCount}/${total}`}
        </Act>
      )}
    </>
  ) : null;

  const scanBox = scanning && planned && canManage ? (
    <div className={cn(desk ? 'mb-4 rounded-md border border-border p-3' : '')}>
      {desk && <p className={cn('mb-2 text-[13px] font-semibold', T.strong)}>Scan au départ — chaque paquet remis au transitaire</p>}
      <ParcelScanBox onScan={onScan} placeholder="Scannez un paquet (PQ-…)" counter={`${scannedCount} / ${total}`} />
      {allScanned && <Say variant={variant} tone="good" className="mt-2">Tous les paquets sont scannés : l'avion peut être marqué parti.</Say>}
    </div>
  ) : null;

  const statusPill = (k: AirPackage) => {
    const meta = packageStatusMeta(k.status);
    // Scanné à l'instant : la coche passe avant le rafraîchissement.
    return scannedNow.has(k.package_no) && k.status === 'sealed' ? <StatusPill tone="info" label="Remis au départ" /> : <StatusPill tone={meta.tone} label={meta.label} />;
  };

  /* — la liste — */
  const list = packages.length === 0 ? (
    desk
      ? <p className={cn('py-4 text-center text-[13px]', T.muted)}>Aucun paquet dans cette expédition.{canManage && planned ? ' Ajoutez les paquets fermés au bureau.' : ''}</p>
      : <Card className={cn('text-center', M_SURFACE.inset, 'border-0')}><p className={cn(TYPE.body, T.muted)}>Aucun paquet dans cette expédition.{canManage && planned ? ' Ajoutez les paquets fermés au bureau.' : ''}</p></Card>
  ) : desk ? (
    <div className="-mx-5 max-h-[320px] overflow-auto">
      <table className="w-full text-left">
        <thead><tr><Th first>Paquet</Th><Th>Clients</Th><Th align="right">Colis</Th><Th align="right">Poids</Th><Th>État</Th><Th last /></tr></thead>
        <tbody>
          {packages.map((k) => {
            const done = isScanned(k);
            return (
              <tr key={k.id}>
                <Td first>
                  <span className="inline-flex items-center gap-2">
                    {done
                      ? <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white" title="Scanné au départ"><Check className="h-3 w-3" strokeWidth={3} /></span>
                      : <span className="h-5 w-5 shrink-0 rounded-full border border-muted-foreground/50" title="Pas encore scanné au départ" />}
                    <span className={cn('font-mono text-[12px] font-bold', T.strong)}>{k.package_no}</span>
                  </span>
                </Td>
                <Td><span className="block max-w-[160px] truncate font-mono text-[11.5px]" title={clientsLine(k)}>{clientsLine(k)}</span></Td>
                <Td align="right"><span className="text-[12.5px] tabular-nums">{k.parcel_count}</span></Td>
                <Td align="right"><span className="text-[12.5px] tabular-nums">{k.gross_weight_kg != null ? fmtKg1(k.gross_weight_kg) : '—'}</span><div className={cn('text-[11px] tabular-nums', T.muted)}>net {fmtKg1(k.net_weight_kg)}</div></Td>
                <Td>{statusPill(k)}</Td>
                <Td last><span className="flex flex-col items-end gap-1">{rowActions(k)}</span></Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  ) : (
    <Card className="py-0">
      {packages.map((k, i) => {
        const done = isScanned(k);
        const acts = rowActions(k);
        return (
          <div key={k.id} className={cn('py-3', i > 0 && cn('border-t', M_SURFACE.divider))}>
            <div className="flex items-center gap-3">
              <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', done ? 'bg-[#CFF7D3] text-[#02542D] dark:bg-[#02542D] dark:text-[#CFF7D3]' : M_SURFACE.holder)} aria-label={done ? 'Scanné au départ' : 'Pas encore scanné'}>
                {done ? <Check className="h-5 w-5" strokeWidth={3} /> : <Package className="h-5 w-5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block tabular-nums', TYPE.bodyStrong, T.strong)}>{k.package_no}</span>
                <span className={cn('block tabular-nums', TYPE.small, T.muted)}>{colis(k.parcel_count)} · {weightLine(k)}</span>
                <span className={cn('block break-words tabular-nums', TYPE.small, T.muted)}>{clientsLine(k)}</span>
              </span>
              {statusPill(k)}
            </div>
            {acts && <div className="mt-2 flex flex-wrap justify-end gap-2">{acts}</div>}
          </div>
        );
      })}
    </Card>
  );

  /* — les fenêtres — */
  const addList = !bureau.data ? <ScreenLoader className="min-h-[120px]" /> : assignable.length === 0 ? (
    <Say variant={variant}>Aucun paquet fermé n'attend au bureau.{stillOpen > 0 ? ` ${plural(stillOpen, 'paquet')} encore ouvert${stillOpen > 1 ? 's' : ''} : fermez-le${stillOpen > 1 ? 's' : ''} (pesée) pour qu'il${stillOpen > 1 ? 's' : ''} puisse${stillOpen > 1 ? 'nt' : ''} partir.` : ''}</Say>
  ) : (
    <div className={cn('space-y-2', desk ? 'max-h-[340px] overflow-auto' : '')}>
      {assignable.map((k) => {
        const on = picked.has(k.id);
        const meta = packageStatusMeta(k.status);
        return (
          <button
            key={k.id}
            type="button"
            role="checkbox"
            aria-checked={on}
            onClick={() => togglePick(k.id)}
            className={cn('flex w-full items-center gap-3 border text-left transition-colors',
              desk ? cn('rounded-md px-3 py-2', on ? 'border-foreground bg-accent' : 'border-border hover:bg-muted/40')
                : cn('rounded-lg px-3 py-3', on ? 'border-[#2C2C2C] bg-[#F5F5F5] dark:border-[#E3E3E3] dark:bg-[#383838]' : cn(M_SURFACE.card, M_SURFACE.divider)))}
          >
            <Tick on={on} variant={variant} />
            <span className="min-w-0 flex-1">
              <span className={cn('block tabular-nums', desk ? 'font-mono text-[12.5px] font-bold' : TYPE.bodyStrong, T.strong)}>{k.package_no}</span>
              <span className={cn('block tabular-nums', desk ? 'text-[12px]' : TYPE.small, T.muted)}>{k.parcel_count} colis · {plural(Number(k.client_count ?? 0), 'client')} · {weightLine(k)}</span>
              {k.status === 'refused' && k.refusal_reason && <span className={cn('block', desk ? 'text-[12px] text-destructive' : cn(TYPE.small, TONE_TEXT.danger))}>Refusé : {k.refusal_reason}</span>}
            </span>
            <StatusPill tone={meta.tone} label={k.status === 'refused' ? 'Refusé' : meta.label} />
          </button>
        );
      })}
      {stillOpen > 0 && <Say variant={variant} className={desk ? 'pt-1 text-[12px]' : 'pt-1'}>{plural(stillOpen, 'paquet')} encore ouvert{stillOpen > 1 ? 's' : ''} au bureau : il{stillOpen > 1 ? 's' : ''} n'apparaîtra{stillOpen > 1 ? 'ont' : ''} ici qu'une fois fermé{stillOpen > 1 ? 's' : ''} et pesé{stillOpen > 1 ? 's' : ''}.</Say>}
    </div>
  );

  const dialogs = (
    <>
      <Sheet
        variant={variant}
        open={adding}
        onClose={closeAdd}
        onConfirm={() => void submitAdd()}
        width={620}
        title="Ajouter des paquets"
        footer={
          <>
            <Act variant={variant} onClick={closeAdd} className={desk ? undefined : 'flex-1'}>Annuler</Act>
            <Act variant={variant} kind="primary" onClick={() => void submitAdd()} disabled={chosen.length === 0} loading={assign.isPending} className={desk ? 'ml-auto' : 'flex-1'}>
              {chosen.length > 0 ? `Ajouter ${plural(chosen.length, 'paquet')}` : 'Ajouter'}
            </Act>
          </>
        }
      >
        <div className="space-y-3">
          <Say variant={variant}>Les paquets fermés et pesés au bureau (et ceux refusés par l'aéroport, à renvoyer). Leurs colis montent dans l'expédition avec eux.</Say>
          {addList}
          {chosen.length > 0 && (
            <div className={cn('flex items-center justify-between gap-3 rounded-md px-3 py-2', desk ? 'bg-muted/50 text-[13px]' : cn(M_SURFACE.inset, TYPE.body))}>
              <span className={T.muted}>Sélection</span>
              <span className={cn('font-semibold tabular-nums', T.strong)}>{plural(chosen.length, 'paquet')} · {chosenParcels} colis · {fmtKg1(chosenKg)}</span>
            </div>
          )}
        </div>
      </Sheet>

      <Sheet
        variant={variant}
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={doRemove}
        title={removing ? `Retirer le paquet ${removing.package_no} ?` : 'Retirer le paquet ?'}
        footer={
          <>
            <Act variant={variant} onClick={() => setRemoving(null)} className={desk ? undefined : 'flex-1'}>Garder</Act>
            <Act variant={variant} kind="primary" onClick={doRemove} loading={unassign.isPending} className={desk ? 'ml-auto' : 'flex-1'}><Undo2 /> Retirer</Act>
          </>
        }
      >
        {removing && <Say variant={variant}>Ses {colis(removing.parcel_count)} quittent l'expédition et reviennent au bureau. Le paquet reste fermé : il pourra partir avec une autre expédition.</Say>}
      </Sheet>

      <Sheet
        variant={variant}
        open={!!refusing}
        onClose={() => setRefusing(null)}
        onConfirm={() => void doRefuse()}
        width={560}
        title={refusing ? `L'aéroport a refusé ${refusing.package_no} ?` : "Refusé à l'aéroport ?"}
        footer={
          <>
            <Act variant={variant} onClick={() => setRefusing(null)} className={desk ? undefined : 'flex-1'}>Annuler</Act>
            <Act variant={variant} kind="primary" onClick={() => void doRefuse()} disabled={!reasonOk} loading={refuse.isPending} className={desk ? 'ml-auto' : 'flex-1'}>Déclarer le refus</Act>
          </>
        }
      >
        {refusing && (
          <div className="space-y-3">
            <Say variant={variant}>Le paquet sort de l'expédition avec ses {colis(refusing.parcel_count)} : ils reviennent au bureau, et le paquet pourra partir par un autre vol.</Say>
            {departed && <Say variant={variant} tone="bad">L'avion est déjà parti : les clients de ce paquet ont été prévenus que leurs colis étaient partis. Il faudra les rappeler.</Say>}
            <TextArea
              id="air-package-refusal"
              label="Motif du refus"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ce que l'aéroport a dit…"
              maxLength={300}
              rows={3}
              controlClassName="min-h-[72px]"
              hint={reason.trim().length > 0 && !reasonOk ? 'Au moins 3 caractères.' : undefined}
            />
            <div className="flex flex-wrap gap-2">
              {QUICK_REASONS.map((r) => (
                <Act key={r} variant={variant} size="sm" onClick={() => setReason(r)}>{r}</Act>
              ))}
            </div>
          </div>
        )}
      </Sheet>

      <Sheet
        variant={variant}
        open={!!refused}
        onClose={() => setRefused(null)}
        width={560}
        title={refused ? `Paquet ${refused.packageNo} refusé — prévenez les clients` : 'Prévenez les clients'}
        footer={<Act variant={variant} kind="primary" onClick={() => setRefused(null)} className={desk ? 'ml-auto' : 'flex-1'}>J'ai compris</Act>}
      >
        {refused && (
          <div className="space-y-3">
            <div className={cn('flex gap-3 rounded-lg p-3', desk ? 'bg-destructive/10' : 'bg-[#FDD3D0] dark:bg-[#900B09]/40')}>
              <AlertTriangle className={cn('mt-0.5 h-5 w-5 shrink-0', desk ? 'text-destructive' : TONE_TEXT.danger)} />
              <Say variant={variant} tone="bad">
                Ces clients ont été prévenus que leurs colis étaient partis. Ils ne sont pas dans l'avion :
                dites-leur que leurs colis partiront par un autre vol.
              </Say>
            </div>
            <Say variant={variant}>{colis(refused.parcels)} revenu{refused.parcels > 1 ? 's' : ''} au bureau dans le paquet {refused.packageNo}.</Say>
            {refused.clients.length > 0 && (
              <ul className={cn('divide-y rounded-lg border', desk ? 'border-border' : M_SURFACE.divider)}>
                {refused.clients.map((c) => (
                  <li key={c.key} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className={cn('min-w-0', desk ? 'text-[13px]' : TYPE.body, T.strong)}>{c.name}{c.code && <span className={cn('ml-2 tabular-nums', T.muted)}>{c.code}</span>}</span>
                    {c.phone && <a href={`tel:${c.phone}`} className={cn('shrink-0 tabular-nums underline-offset-2 hover:underline', desk ? 'text-[13px]' : TYPE.body, T.strong)}>{c.phone}</a>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Sheet>
    </>
  );

  if (desk) {
    return (
      <Band
        title="Les paquets"
        meta={<span className="inline-flex flex-wrap items-center justify-end gap-2"><span>{summary}</span>{actions}</span>}
      >
        {scanBox}
        {list}
        {dialogs}
      </Band>
    );
  }

  return (
    <section>
      <div className="mb-3">
        <h2 className={cn(TYPE.lead, T.strong)}>Les paquets</h2>
        <p className={cn('tabular-nums', TYPE.small, planned && total > 0 && !allScanned ? cn('font-semibold', TONE_TEXT.pending) : T.muted)}>{summary}</p>
      </div>
      {actions && <div className="mb-3 space-y-2">{actions}</div>}
      {scanBox && <Card className="mb-3">{scanBox}</Card>}
      {list}
      {dialogs}
    </section>
  );
}
