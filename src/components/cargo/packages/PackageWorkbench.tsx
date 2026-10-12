// ============================================================
// Desktop admin — LA fiche d'un paquet avion (PQ-000123, 32 kg au plus),
// l'établi où on le remplit :
//   · à gauche, ce qu'il contient : la jauge (une couleur par client), puis
//     ses colis rangés par client, chacun retirable tant qu'il est ouvert ;
//   · à droite, tant qu'il est ouvert, de quoi le remplir : un champ pour la
//     douchette (ou le numéro tapé), et la liste des colis avion prêts au
//     bureau — un clic les y met. Ceux qui ne tiennent plus sont grisés, le
//     survol d'« Ajouter » dessine le colis dans la jauge ;
//   · une fois fermé (pesé), l'étiquette 100 × 150 mm, à télécharger ou
//     imprimer tout de suite.
// En bas : fermer (pesée + dimensions), rouvrir, supprimer un paquet vide.
// Écriture : canReceiveParcels (la base revérifie chaque RPC air_package_*).
// ============================================================
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, FileDown, Loader2, LockOpen, PackageCheck, PackagePlus, Printer, ScanLine, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  PackageRpcError, useAddParcelToPackage, useAirPackage, useCreateAirPackage, useDeleteAirPackage,
  useRemoveParcelFromPackage, useReopenAirPackage, useSealAirPackage, type SealInput,
} from '@/hooks/useAirPackages';
import {
  PACK_BLOCK_LABEL, expeditionLine, fitsInPackage, isAssignable, packageClientGroups, packableGroups, packageStatusMeta, sealCheck, weightGauge,
  type AirPackage, type PackableBoard, type PackableParcel,
} from '@/lib/airPackage';
import { clientFullName, depositMatches, formatKg, type ParcelKind } from '@/lib/reception';
import { cn } from '@/lib/utils';
import { formatDateTime, useReceptionLabels } from '@/mobile/components/reception/bits';
import { scanFeedback, type ScanOutcome } from '@/mobile/components/cargo/ParcelScanBox';
import { downloadFile } from '@/components/customer-code/exportShippingLabel';
import { openForPrint } from '@/components/cargo/reception/useParcelLabels';
import { usePackageLabel } from './usePackageLabel';
import { GaugeLegend, PackageGauge, type GaugePreview } from './PackageGauge';
import { clientFills } from './packageColors';
import { SURFACE, TEXT, SOFT_PILL, PRIMARY_PILL, DANGER_SOFT_PILL, TONE_PILL, CenterDialog, ScreenLoader, StatusPill, TextInput, type Tone } from '@/desktop/designKit';

/** La couleur de la réponse à un scan : celle des pastilles d'état. */
const OUTCOME_TONE: Record<ScanOutcome, Tone> = { ok: 'success', again: 'neutral', unknown: 'pending', refused: 'danger' };

function Btn({ kind = 'soft', onClick, disabled, loading, children, className }: {
  /** `destroy` : la confirmation d'une suppression (rouge plein). */
  kind?: 'primary' | 'soft' | 'danger' | 'destroy'; onClick?: () => void; disabled?: boolean; loading?: boolean; children: ReactNode; className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap px-3.5 text-[13px] font-semibold disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4',
        kind === 'primary' ? cn(PRIMARY_PILL, 'font-bold') : kind === 'danger' ? DANGER_SOFT_PILL
          : kind === 'destroy' ? 'rounded-md bg-red-600 font-bold text-white hover:bg-red-700' : SOFT_PILL,
        className,
      )}
    >
      {loading ? <Loader2 className="animate-spin" /> : children}
    </button>
  );
}

export function PackageWorkbench({ packageId, packable, initialFilter = '', onClose, onOpenPackage, onOpenDeposit }: {
  packageId: string;
  /** Les colis avion du bureau (reception_board, en stock) : ceux qu'on peut y mettre. */
  packable: PackableBoard | null;
  /** Le filtre de la liste à l'ouverture (« emballer ce client »). */
  initialFilter?: string;
  onClose: () => void;
  /** Ouvrir un autre paquet (le suivant, juste créé). */
  onOpenPackage: (id: string) => void;
  onOpenDeposit: (depositId: string, parcelId?: string) => void;
}) {
  const { hasPermission } = useAdminAuth();
  const canWrite = hasPermission('canReceiveParcels');
  const labels = useReceptionLabels();
  const { data: pkg, error, refetch, isLoading } = useAirPackage(packageId);
  const add = useAddParcelToPackage(packageId);
  const remove = useRemoveParcelFromPackage(packageId);
  const seal = useSealAirPackage(packageId);
  const reopen = useReopenAirPackage(packageId);
  const del = useDeleteAirPackage();
  const create = useCreateAirPackage();

  const [sub, setSub] = useState<'seal' | 'reopen' | 'delete' | null>(null);
  const [scan, setScan] = useState('');
  const [result, setResult] = useState<{ outcome: ScanOutcome; text: string } | null>(null);
  const [over, setOver] = useState(false);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [justSealed, setJustSealed] = useState(false);
  const [filter, setFilter] = useState(initialFilter);
  const [hover, setHover] = useState<PackableParcel | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  // La douchette peut lire plus vite que le serveur ne répond : les codes attendent leur tour, aucun ne se perd.
  const queue = useRef<{ code: string; fromScan: boolean }[]>([]);
  const draining = useRef(false);

  const groups = useMemo(() => packageClientGroups(pkg?.parcels), [pkg?.parcels]);
  const fills = useMemo(() => clientFills(groups.map((g) => g.key)), [groups]);
  const inPackage = useMemo(() => new Set(groups.map((g) => g.key)), [groups]);
  const inside = useMemo(() => new Set((pkg?.parcels ?? []).map((p) => p.id)), [pkg?.parcels]);
  // Ce qui peut y entrer : les colis prêts du bureau, moins ceux qui viennent d'y entrer (la liste se rafraîchit après).
  const ready = useMemo(
    () => (packable?.ready ?? []).filter((it) => !inside.has(it.parcel.id) && (!filter.trim() || depositMatches({ ...it.deposit, parcels: [it.parcel] }, filter))),
    [packable?.ready, inside, filter],
  );
  const readyGroups = useMemo(() => packableGroups(ready, inPackage), [ready, inPackage]);

  const open = pkg?.status === 'open';
  const editable = open && canWrite;
  // La douchette tape dans le champ : il prend le focus à l'ouverture et le reprend après chaque geste.
  // Jamais pendant une fenêtre par-dessus (la pesée, une confirmation) : les chiffres tapés iraient dans le scan.
  const subRef = useRef(sub);
  subRef.current = sub;
  const refocus = () => { window.setTimeout(() => { if (editable && !subRef.current) scanRef.current?.focus({ preventScroll: true }); }, 0); };
  const closeSub = () => { setSub(null); subRef.current = null; refocus(); };
  useEffect(() => { refocus(); }, [editable]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading || !pkg) {
    return (
      <CenterDialog open onClose={onClose} width={1120} title="Paquet avion">
        {error ? (
          <div className="space-y-3 py-6 text-center">
            <p className={cn('text-[14px]', TEXT.muted)}>{(error as Error).message || 'Paquet introuvable'}</p>
            <Btn onClick={() => void refetch()}>Réessayer</Btn>
          </div>
        ) : <ScreenLoader />}
      </CenterDialog>
    );
  }

  const g = weightGauge(pkg);
  const meta = packageStatusMeta(pkg.status);
  const expedition = expeditionLine(pkg);
  const busy = seal.isPending || reopen.isPending || del.isPending || create.isPending;
  const preview: GaugePreview | null = editable && hover ? { kg: Number(hover.parcel.weight_kg) || 0, fits: fitsInPackage(pkg, hover.parcel.weight_kg) } : null;

  /** Un colis entre (scan, numéro tapé, ou clic dans la liste) : le serveur décide, l'écran dit pourquoi. */
  const addOne = async (text: string, fromScan: boolean) => {
    setOver(false);
    let res: { outcome: ScanOutcome; text: string };
    try {
      const r = await add.mutateAsync(text);
      if (r.already) res = { outcome: 'again', text: `${r.parcel_no} est déjà dans ce paquet` };
      else {
        setLastAdded(r.parcel_no);
        res = { outcome: 'ok', text: `${r.parcel_no} ajouté (${formatKg(r.weight_kg ?? null)})${r.client ? ` · ${r.client.customer_code} · ${clientFullName(r.client)}` : ''}` };
      }
    } catch (e) {
      if (e instanceof PackageRpcError && e.payload.over === true) setOver(true);
      res = { outcome: 'refused', text: (e as Error).message };
    }
    setResult(res);
    if (fromScan) scanFeedback(res.outcome);
    setHover(null);
    refocus();
  };
  /** Les codes passent un par un, dans l'ordre où ils ont été lus. */
  const addCode = (code: string, fromScan: boolean) => {
    const text = code.trim();
    if (!text) return;
    queue.current.push({ code: text, fromScan });
    if (draining.current) return;
    draining.current = true;
    void (async () => {
      try {
        for (let next = queue.current.shift(); next; next = queue.current.shift()) await addOne(next.code, next.fromScan);
      } finally {
        draining.current = false;
      }
    })();
  };

  const doReopen = () => { if (!reopen.isPending) reopen.mutate(undefined, { onSuccess: () => { setSub(null); setJustSealed(false); } }); };
  const doDelete = () => { if (!del.isPending) del.mutate(pkg.id, { onSuccess: () => { setSub(null); toast.success(`Paquet ${pkg.package_no} supprimé`); onClose(); } }); };

  const startNext = () => {
    if (create.isPending) return;
    create.mutate(undefined, { onSuccess: (p) => onOpenPackage(p.id) });
  };

  const sealedAt = pkg.sealed_at ? formatDateTime(pkg.sealed_at) : null;
  const dims = pkg.length_cm != null && pkg.width_cm != null && pkg.height_cm != null ? `${pkg.length_cm} × ${pkg.width_cm} × ${pkg.height_cm} cm` : null;

  /* ── À gauche : ce que contient le paquet ─────────────────────────── */
  const left = (
    <section className="min-w-0 space-y-4">
      <div className={cn('space-y-3 rounded-xl p-4', SURFACE.inset)}>
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <p className={cn('whitespace-nowrap font-bold leading-none tracking-[-0.02em] tabular-nums', TEXT.strong)}>
            <span className="text-[34px]">{formatKg(g.net)}</span>
            <span className={cn('ml-1.5 text-[16px] font-semibold', TEXT.muted)}>sur {formatKg(g.max)}</span>
          </p>
          {open ? (
            <p className={cn('text-[14px] font-bold tabular-nums', g.tone === 'full' ? 'text-destructive' : g.tone === 'near' ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400')}>
              {g.left <= 0 ? 'Plein' : `reste ${formatKg(g.left)}`}
            </p>
          ) : pkg.gross_weight_kg != null && (
            <p className={cn('text-[13px] font-semibold tabular-nums', TEXT.body)}>pesé fermé : {formatKg(pkg.gross_weight_kg)}</p>
          )}
        </div>
        <PackageGauge pkg={pkg} groups={groups} preview={preview} />
        {preview && (
          <p className={cn('text-[12px] font-semibold tabular-nums', preview.fits ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive')}>
            {hover?.parcel.parcel_no} · {formatKg(preview.kg)} → {preview.fits ? `il resterait ${formatKg(Math.max(0, g.max - g.net - preview.kg))}` : `${formatKg(g.net + preview.kg - g.max)} de trop`}
          </p>
        )}
        <GaugeLegend groups={groups} />
      </div>

      {pkg.status === 'refused' && (
        <div className="rounded-lg bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
          <p className="font-bold">Refusé à l'aéroport</p>
          {pkg.refusal_reason && <p className="mt-0.5 break-words">Motif : {pkg.refusal_reason}</p>}
          <p className="mt-1 text-[12.5px]">Rouvrez-le pour changer son contenu, ou laissez-le fermé : il pourra partir par une autre expédition.</p>
        </div>
      )}
      {expedition && (
        <div className="rounded-lg bg-indigo-50 px-4 py-3 text-[13px] text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300">
          <p className="font-bold">Affecté à une expédition</p>
          <p className="mt-0.5 tabular-nums">{expedition}</p>
          <p className="mt-1 text-[12.5px]">Pour le modifier, retirez-le d'abord de l'expédition (Cargo › Avion).</p>
        </div>
      )}
      {over && editable && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 px-4 py-3 text-[13px] text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
          <p className="font-semibold">Ce colis ne tient plus : fermez ce paquet et commencez-en un autre.</p>
          <Btn kind="primary" onClick={() => setSub('seal')} disabled={busy || pkg.parcel_count === 0}><PackageCheck /> Fermer ce paquet</Btn>
        </div>
      )}

      <div>
        <h3 className={cn('mb-2 text-[13px] font-bold', TEXT.strong)}>
          Dans le paquet <span className={cn('font-normal tabular-nums', TEXT.muted)}>· {pkg.parcel_count} colis · {pkg.client_count} client{pkg.client_count > 1 ? 's' : ''}</span>
        </h3>
        {groups.length === 0 ? (
          <p className={cn('rounded-lg border border-dashed border-border px-4 py-8 text-center text-[13px]', TEXT.muted)}>
            {editable ? 'Paquet vide. Scannez l\'étiquette d\'un colis, ou choisissez-le dans la liste à droite.' : 'Paquet vide.'}
          </p>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {groups.map((grp) => (
              <div key={grp.key}>
                <div className="flex items-center gap-2.5 bg-muted/40 px-3.5 py-2">
                  <span aria-hidden="true" className={cn('h-2.5 w-2.5 shrink-0 rounded-sm', fills.get(grp.key))} />
                  <span className="min-w-0 flex-1 truncate text-[12.5px]">
                    <span className={cn('font-mono font-bold', TEXT.strong)}>{grp.client?.customer_code ?? 'Sans client'}</span>
                    {grp.client && <span className={TEXT.muted}> · {clientFullName(grp.client)}</span>}
                  </span>
                  <span className={cn('shrink-0 text-[12px] font-semibold tabular-nums', TEXT.muted)}>{grp.parcels.length} colis · {formatKg(grp.kg)}</span>
                </div>
                {grp.parcels.map((p) => (
                  <div key={p.id} className={cn('flex items-center gap-3 border-t border-border/60 px-3.5 py-2 transition-colors', p.parcel_no === lastAdded && 'bg-emerald-50 dark:bg-emerald-950/40')}>
                    <span className="min-w-0 flex-1">
                      <span className={cn('flex items-center gap-1.5 font-mono text-[12.5px] font-bold', TEXT.strong)}>
                        {p.parcel_no === lastAdded && <Check className="h-3.5 w-3.5 text-emerald-600" aria-label="Ajouté à l'instant" />}
                        {p.parcel_no}
                      </span>
                      <span className={cn('block truncate text-[12px]', TEXT.muted)}>{p.description || labels.kind(p.kind as ParcelKind)}</span>
                    </span>
                    <span className={cn('shrink-0 text-[13px] font-semibold tabular-nums', TEXT.strong)}>{formatKg(p.weight_kg)}</span>
                    {editable && (
                      <Btn onClick={() => remove.mutate(p.id, { onSuccess: () => { setResult(null); setOver(false); refocus(); } })} disabled={remove.isPending} className="h-8 px-2.5 text-[12px]">Retirer</Btn>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );

  /* ── À droite : le remplir, ou son étiquette ──────────────────────── */
  const right = editable ? (
    <section className="flex min-w-0 flex-col gap-3">
      <form onSubmit={(e) => { e.preventDefault(); const v = scan; setScan(''); addCode(v, true); }}>
        <label htmlFor="pk-scan" className={cn('mb-1.5 block text-[13px] font-bold', TEXT.strong)}>Ajouter un colis</label>
        <div className="relative">
          <ScanLine className={cn('pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2', TEXT.muted)} />
          <TextInput
            id="pk-scan"
            ref={scanRef}
            data-autofocus
            value={scan}
            onChange={(e) => setScan(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="Scannez l'étiquette ou tapez le n° (RC-000123-01), puis Entrée"
            className="h-10 rounded-md pl-9 pr-3 text-[13.5px] tabular-nums"
          />
        </div>
      </form>
      {result ? (
        <p role="status" aria-live="polite" className={cn('rounded-md px-3 py-2 text-[12.5px] font-semibold', TONE_PILL[OUTCOME_TONE[result.outcome]])}>{result.text}</p>
      ) : (
        <p className={cn('text-[12px]', TEXT.muted)}>Douchette, numéro tapé, ou un clic sur « Ajouter » dans la liste ci-dessous.</p>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <h3 className={cn('text-[13px] font-bold', TEXT.strong)}>
          Colis avion prêts au bureau <span className={cn('font-normal tabular-nums', TEXT.muted)}>· {ready.length}</span>
        </h3>
        <div className="relative w-[190px]">
          <Search className={cn('pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2', TEXT.muted)} />
          <TextInput value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Client, colis…" aria-label="Filtrer les colis prêts"
            className="h-8 rounded-md pl-8 pr-2 text-[12.5px]" />
        </div>
      </div>

      <div className="max-h-[46vh] min-h-[160px] overflow-y-auto rounded-lg border border-border">
        {!packable ? <ScreenLoader /> : readyGroups.length === 0 ? (
          <p className={cn('px-4 py-8 text-center text-[13px]', TEXT.muted)}>
            {filter.trim() ? `Aucun colis prêt ne correspond à « ${filter.trim()} ».` : 'Aucun autre colis avion n\'attend au bureau.'}
          </p>
        ) : readyGroups.map((grp) => (
          <div key={grp.key} className="border-b border-border last:border-b-0">
            <div className="sticky top-0 z-[1] flex items-center gap-2 bg-card/95 px-3.5 py-2 backdrop-blur">
              <span className="min-w-0 flex-1 truncate text-[12.5px]">
                <span className={cn('font-mono font-bold', TEXT.strong)}>{grp.client?.customer_code}</span>
                {grp.client && <span className={TEXT.muted}> · {clientFullName(grp.client)}</span>}
              </span>
              {grp.inPackage && <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">déjà dans le paquet</span>}
              <span className={cn('shrink-0 text-[12px] tabular-nums', TEXT.muted)}>{grp.items.length} · {formatKg(grp.kg)}</span>
            </div>
            {grp.items.map((it) => {
              const fits = fitsInPackage(pkg, it.parcel.weight_kg);
              return (
                <div key={it.parcel.id} className={cn('flex items-center gap-3 border-t border-border/60 px-3.5 py-2', hover?.parcel.id === it.parcel.id && 'bg-accent/60')}>
                  <button type="button" onClick={() => onOpenDeposit(it.deposit.id, it.parcel.id)} className="min-w-0 flex-1 text-left" title={`Ouvrir le dépôt ${it.deposit.deposit_no}`}>
                    <span className={cn('block font-mono text-[12.5px] font-bold', TEXT.strong)}>{it.parcel.parcel_no}</span>
                    <span className={cn('block truncate text-[12px]', TEXT.muted)}>{it.parcel.description || labels.kind(it.parcel.kind)}</span>
                  </button>
                  <span className={cn('shrink-0 text-[13px] font-semibold tabular-nums', fits ? TEXT.strong : 'text-destructive')}>{formatKg(it.parcel.weight_kg)}</span>
                  <span onMouseEnter={() => setHover(it)} onMouseLeave={() => setHover((h) => (h?.parcel.id === it.parcel.id ? null : h))}
                    onFocus={() => setHover(it)} onBlur={() => setHover((h) => (h?.parcel.id === it.parcel.id ? null : h))} className="shrink-0">
                    <Btn
                      kind={fits ? 'primary' : 'soft'}
                      onClick={() => addCode(it.parcel.parcel_no, false)}
                      disabled={!fits || add.isPending}
                      className="h-8 w-[92px] px-2.5 text-[12px]"
                    >
                      {fits ? 'Ajouter' : 'Trop lourd'}
                    </Btn>
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {(packable?.blocked.length ?? 0) > 0 && (
        <details className="rounded-lg border border-amber-200 bg-amber-50/60 px-3.5 py-2.5 text-[12.5px] dark:border-amber-900/60 dark:bg-amber-950/30">
          <summary className="cursor-pointer font-semibold text-amber-800 dark:text-amber-300">
            {packable!.blocked.length} colis du bureau pas encore prêt{packable!.blocked.length > 1 ? 's' : ''} : à corriger dans leur dépôt
          </summary>
          <ul className="mt-2 space-y-1">
            {packable!.blocked.map((it) => (
              <li key={it.parcel.id}>
                <button type="button" onClick={() => onOpenDeposit(it.deposit.id, it.parcel.id)} className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-amber-100/60 dark:hover:bg-amber-900/30">
                  <span className={cn('font-mono font-bold', TEXT.strong)}>{it.parcel.parcel_no}</span>
                  <span className={cn('min-w-0 flex-1 truncate', TEXT.muted)}>{it.deposit.client ? it.deposit.client.customer_code : it.deposit.deposit_no}</span>
                  <span className="shrink-0 font-semibold text-amber-800 dark:text-amber-300">{PACK_BLOCK_LABEL[it.reason]}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  ) : (
    <section className="min-w-0 space-y-4">
      {justSealed && (
        <div className="flex items-center gap-2.5 rounded-lg bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
          <Check className="h-4 w-4 shrink-0" /> Paquet fermé : imprimez son étiquette et collez-la sur le dessus.
        </div>
      )}
      {open && !canWrite && (
        <p className={cn('rounded-lg px-4 py-3 text-[13px]', SURFACE.inset, TEXT.muted)}>Ce paquet est en cours de remplissage par l'équipe de réception (Guangzhou). Vous le voyez en lecture seule.</p>
      )}
      {!open && (
        <>
          <dl className="grid grid-cols-3 gap-3">
            {([['Pesé fermé', pkg.gross_weight_kg != null ? formatKg(pkg.gross_weight_kg) : '—'], ['Dimensions', dims ?? '—'], ['Fermé le', sealedAt ?? '—']] as const).map(([k, v]) => (
              <div key={k} className={cn('rounded-lg px-3 py-2.5', SURFACE.inset)}>
                <dt className={cn('text-[11.5px] font-semibold', TEXT.muted)}>{k}</dt>
                <dd className={cn('mt-0.5 text-[13px] font-bold tabular-nums', TEXT.strong)}>{v}</dd>
              </div>
            ))}
          </dl>
          <LabelPanel pkg={pkg} />
        </>
      )}
    </section>
  );

  /* ── En bas : un geste principal selon l'état ─────────────────────── */
  const footer = (
    <>
      {editable && pkg.parcel_count === 0 && <Btn kind="danger" onClick={() => setSub('delete')} disabled={busy}><Trash2 /> Supprimer ce paquet vide</Btn>}
      {canWrite && !open && isAssignable(pkg) && <Btn onClick={() => setSub('reopen')} disabled={busy}><LockOpen /> Rouvrir</Btn>}
      <span className="flex-1" />
      <Btn onClick={onClose}>Fermer la fiche</Btn>
      {editable && <Btn kind="primary" onClick={() => setSub('seal')} disabled={busy || pkg.parcel_count === 0}><PackageCheck /> Fermer le paquet (pesée)</Btn>}
      {canWrite && justSealed && <Btn kind="primary" onClick={startNext} loading={create.isPending}><PackagePlus /> Commencer un nouveau paquet</Btn>}
    </>
  );

  return (
    <>
      <CenterDialog
        open
        onClose={onClose}
        width={1120}
        footer={footer}
        title={
          <div className="flex items-center gap-3">
            <span className={cn('font-mono text-[20px] font-extrabold tracking-[-0.01em]', TEXT.strong)}>{pkg.package_no}</span>
            <StatusPill tone={meta.tone} label={meta.label} />
            <span className={cn('min-w-0 truncate text-[12.5px]', TEXT.muted)}>Paquet avion · 32 kg au plus · commencé le {formatDateTime(pkg.created_at)}</span>
          </div>
        }
      >
        <div className="grid grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-6 max-lg:grid-cols-1">
          {left}
          {right}
        </div>
      </CenterDialog>

      <SealDialog
        open={sub === 'seal'}
        pkg={pkg}
        pending={seal.isPending}
        onClose={closeSub}
        onSeal={(input) => seal.mutate(input, {
          onSuccess: (p) => { setSub(null); setOver(false); setResult(null); setJustSealed(true); toast.success(`Paquet ${p.package_no} fermé`, { description: 'Son étiquette est prête à imprimer.' }); },
        })}
      />

      <CenterDialog
        open={sub === 'reopen'}
        onClose={closeSub}
        onConfirm={doReopen}
        width={460}
        title={`Rouvrir ${pkg.package_no} ?`}
        footer={<>
          <Btn onClick={closeSub} className="flex-1">Annuler</Btn>
          <Btn kind="primary" onClick={doReopen} loading={reopen.isPending} className="flex-1"><LockOpen /> Rouvrir</Btn>
        </>}
      >
        <p className={cn('text-[13.5px]', TEXT.body)}>Le paquet redevient modifiable. Il faudra le repeser et réimprimer son étiquette.</p>
      </CenterDialog>

      <CenterDialog
        open={sub === 'delete'}
        onClose={closeSub}
        onConfirm={doDelete}
        width={460}
        title={`Supprimer ${pkg.package_no} ?`}
        footer={<>
          <Btn onClick={closeSub} className="flex-1">Garder</Btn>
          <Btn kind="destroy" onClick={doDelete} loading={del.isPending} className="flex-1"><Trash2 /> Supprimer</Btn>
        </>}
      >
        <p className={cn('text-[13.5px]', TEXT.body)}>Le paquet est vide : il disparaît de la liste. Son numéro n'est pas réutilisé.</p>
      </CenterDialog>
    </>
  );
}

/* ── Fermer le paquet : la pesée (obligatoire), les dimensions (facultatives) ── */

function SealDialog({ open, pkg, pending, onClose, onSeal }: {
  open: boolean; pkg: AirPackage; pending: boolean; onClose: () => void;
  onSeal: (input: SealInput) => void;
}) {
  const [gross, setGross] = useState('');
  const [dims, setDims] = useState<[string, string, string]>(['', '', '']);
  useEffect(() => { if (open) { setGross(''); setDims(['', '', '']); } }, [open]);
  const g = weightGauge(pkg);
  const check = sealCheck(gross, dims, pkg);
  const grossMsg = check.grossError === 'required' ? 'Indiquez le poids pesé'
    : check.grossError === 'over' ? `Plus de ${formatKg(g.max)} : retirez un colis`
    : check.grossError === 'under' ? `Moins que les colis (${formatKg(g.net)}) : vérifiez la pesée`
    : null;
  const submit = () => { if (check.input && !pending) onSeal(check.input); };
  const field = 'h-10 rounded-md px-3 text-[14px] tabular-nums';
  const dimLabels = ['Longueur', 'Largeur', 'Hauteur'] as const;

  return (
    <CenterDialog
      open={open}
      onClose={onClose}
      onConfirm={submit}
      width={480}
      title={`Fermer ${pkg.package_no}`}
      footer={<>
        <Btn onClick={onClose} className="flex-1">Annuler</Btn>
        <Btn kind="primary" onClick={submit} disabled={!check.valid} loading={pending} className="flex-1"><PackageCheck /> Fermer et préparer l'étiquette</Btn>
      </>}
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <p className={cn('text-[13.5px]', TEXT.body)}>Pesez le paquet fermé, carton compris. Ses colis pèsent {formatKg(g.net)} ; {formatKg(g.max)} au plus.</p>
        <div>
          <label htmlFor="pk-gross" className={cn('mb-1.5 block text-[13px] font-bold', TEXT.strong)}>Poids pesé</label>
          <div className="relative">
            <TextInput id="pk-gross" data-autofocus value={gross} onChange={(e) => setGross(e.target.value)} inputMode="decimal" placeholder={String(Math.round(g.net * 10) / 10).replace('.', ',')}
              aria-invalid={!!grossMsg} className={cn(field, 'h-14 pr-12 text-[26px] font-bold', grossMsg && 'border-destructive')} />
            <span className={cn('pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[15px] font-semibold', TEXT.muted)}>kg</span>
          </div>
          {grossMsg && <p className="mt-1 text-[12.5px] font-semibold text-destructive">{grossMsg}</p>}
        </div>
        <div>
          <p className={cn('mb-1.5 text-[13px] font-bold', TEXT.strong)}>Dimensions en cm <span className={cn('font-normal', TEXT.muted)}>(facultatif)</span></p>
          <div className="flex items-center gap-2">
            {dimLabels.map((label, i) => (
              <span key={label} className="contents">
                {i > 0 && <span aria-hidden="true" className={TEXT.muted}>×</span>}
                <TextInput value={dims[i]} onChange={(e) => setDims((d) => { const n = [...d] as [string, string, string]; n[i] = e.target.value; return n; })}
                  inputMode="decimal" placeholder={label} aria-label={`${label} (cm)`} className={cn(field, 'min-w-0 flex-1 text-center', check.dimsError && 'border-destructive')} />
              </span>
            ))}
          </div>
          {check.dimsError && <p className="mt-1 text-[12.5px] font-semibold text-destructive">Dimensions invalides : 400 cm au plus</p>}
        </div>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </CenterDialog>
  );
}

/* ── L'étiquette du paquet fermé : l'aperçu exact, le PDF, l'impression ── */

function LabelPanel({ pkg }: { pkg: AirPackage }) {
  const maker = usePackageLabel(pkg, true);
  const preview = maker.preview;
  const [busy, setBusy] = useState<'pdf' | 'print' | 'png' | null>(null);

  const run = async (what: 'pdf' | 'print' | 'png') => {
    if (busy) return;
    setBusy(what);
    try {
      if (what === 'png') { downloadFile(await maker.pngFile()); toast.success('Image téléchargée'); return; }
      const file = await maker.pdfFile();
      if (what === 'print' && openForPrint(file)) return;
      downloadFile(file);
      toast.success('PDF téléchargé', { description: `Étiquette ${pkg.package_no} · 100 × 150 mm` });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      {maker.nodes}
      <div className="flex items-start gap-4">
        <div className={cn('flex h-[300px] w-[200px] shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ring-border', SURFACE.inset)}>
          {preview ? <img src={preview} alt={`Étiquette ${pkg.package_no}`} className="h-full w-full object-contain" /> : <Loader2 className={cn('h-5 w-5 animate-spin', TEXT.muted)} />}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className={cn('text-[13px] font-bold', TEXT.strong)}>L'étiquette du paquet</p>
          <p className={cn('text-[12.5px] leading-relaxed', TEXT.muted)}>100 × 150 mm, à coller sur le dessus. Le PDF s'imprime tel quel sur l'imprimante d'étiquettes 4 pouces ; le QR se scanne au départ et à Douala.</p>
          <div className="flex flex-col gap-2 pt-1">
            <Btn kind="primary" onClick={() => void run('pdf')} disabled={!maker.ready || busy !== null} loading={busy === 'pdf'}><FileDown /> Télécharger le PDF</Btn>
            <Btn onClick={() => void run('print')} disabled={!maker.ready || busy !== null} loading={busy === 'print'}><Printer /> Imprimer</Btn>
            <Btn onClick={() => void run('png')} disabled={!maker.ready || busy !== null} loading={busy === 'png'}>Image (PNG)</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
