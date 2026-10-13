// ============================================================
// Desktop admin — Cargo › Réception › Paquets avion : la mise en paquets de
// 32 kg, depuis l'ordinateur du bureau de Guangzhou.
//   · à gauche, les paquets qui n'ont pas encore quitté le bureau, rangés par
//     ce qu'il reste à en faire (en cours, refusés à l'aéroport, fermés et
//     prêts, affectés à un vol) ; « Nouveau paquet », ou un paquet retrouvé
//     par son numéro (douchette sur l'étiquette PQ-…) ;
//   · à droite, les colis avion qui attendent d'être emballés, par client —
//     « Emballer » commence un paquet pour ce client — et ceux qui ne le
//     peuvent pas encore (sans client, pas pesés).
// Un clic sur un paquet ouvre sa fiche (PackageWorkbench), où on le remplit.
// Seul un paquet FERMÉ apparaît ensuite dans « Ajouter des paquets » d'une
// expédition (Cargo › Avion).
// ============================================================
import { useMemo, useState } from 'react';
import { PackagePlus, PlaneTakeoff, ScanLine } from 'lucide-react';
import { useCreateAirPackage, useFindAirPackage } from '@/hooks/useAirPackages';
import {
  PACK_BLOCK_LABEL, expeditionLine, isAssignable, packableGroups, packageQueue, packageStatusMeta, packagesTotals, sumParcelKg,
  type AirPackage, type PackableParcel, type PackageQueue,
} from '@/lib/airPackage';
import { clientFullName, depositMatches, formatKg, initials, listDate } from '@/lib/reception';
import { parseWarehouseScan } from '@/lib/warehouse';
import { plural } from '@/lib/cargo/plain';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/mobile/components/reception/bits';
import { MiniGauge } from './PackageGauge';
import { PackDialog } from './PackDialog';
import { ShipDialog } from './ShipDialog';
import { Btn, GroupTick, SelectionBar, Tick } from './bits';
import { toggleId } from './selection';
import { filterPackages, knownClientCodes, type PackageScope, type usePackingBoard } from './usePackingBoard';
import { SURFACE, TEXT, SOFT_PILL, PRIMARY_PILL, Card, Holder, KV, ScreenLoader, StatusPill, TextInput, Th, Td } from '@/desktop/designKit';

/** Les groupes de la liste, dans l'ordre de ce qu'il reste à faire ; « partis » seulement sur les 300 derniers. */
const GROUP_TITLE: Record<PackageQueue, string> = {
  open: 'En cours de remplissage',
  refused: "Refusés à l'aéroport",
  ready: 'Fermés, prêts à partir',
  assigned: 'Affectés à une expédition',
  gone: 'Partis du bureau',
};
const GROUP_ORDER: PackageQueue[] = ['open', 'refused', 'ready', 'assigned', 'gone'];

export function DesktopPackagesView({ query, scope, canWrite, canShip, packing, onOpenPackage, onOpenDeposit, onOpenFlight }: {
  query: string;
  scope: PackageScope;
  /** Créer et remplir des paquets (canReceiveParcels). */
  canWrite: boolean;
  /** Mettre des paquets sur un vol (canReceiveParcels ou canManageCargo). */
  canShip: boolean;
  packing: ReturnType<typeof usePackingBoard>;
  /** Ouvrir la fiche d'un paquet. */
  onOpenPackage: (id: string) => void;
  onOpenDeposit: (depositId: string, parcelId?: string) => void;
  /** Ouvrir une expédition (Cargo › Avion). */
  onOpenFlight: (airId: string) => void;
}) {
  const { packages, packable, contents, truncated } = packing;
  const create = useCreateAirPackage();
  const find = useFindAirPackage();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  // Les deux sélections : des colis à emballer (→ « Mettre en paquet »), des paquets fermés (→ « Mettre sur un vol »).
  const [pickedParcels, setPickedParcels] = useState<Set<string>>(new Set());
  const [pickedPackages, setPickedPackages] = useState<Set<string>>(new Set());
  const [packItems, setPackItems] = useState<PackableParcel[] | null>(null);
  const [shipIds, setShipIds] = useState<string[] | null>(null);

  const q = query.trim();
  const list = useMemo(() => filterPackages(packages.data ?? [], contents, query), [packages.data, contents, query]);
  const groups = useMemo(() => GROUP_ORDER
    .filter((key) => key !== 'gone' || scope === 'all')
    .map((key) => ({ key, title: GROUP_TITLE[key], items: list.filter((p) => packageQueue(p) === key) }))
    .filter((g) => g.items.length > 0), [list, scope]);

  const ready = useMemo(() => (packable?.ready ?? []).filter((it) => depositMatches({ ...it.deposit, parcels: [it.parcel] }, query)), [packable?.ready, query]);
  const readyGroups = useMemo(() => packableGroups(ready), [ready]);
  const blocked = useMemo(() => (packable?.blocked ?? []).filter((it) => depositMatches({ ...it.deposit, parcels: [it.parcel] }, query)), [packable?.blocked, query]);

  const all = packages.data ?? [];
  const kpi = {
    readyN: packable?.ready.length ?? 0,
    readyKg: sumParcelKg(packable?.ready ?? []),
    blocked: packable?.blocked.length ?? 0,
    open: all.filter((p) => packageQueue(p) === 'open'),
    sealed: all.filter(isAssignable),
    assigned: all.filter((p) => packageQueue(p) === 'assigned'),
  };
  const sumKg = (xs: AirPackage[]) => packagesTotals(xs).kg;

  const newPackage = () => {
    if (create.isPending) return;
    create.mutate(undefined, { onSuccess: (p) => onOpenPackage(p.id) });
  };
  // Ce qui est coché ET encore là (une recherche, un rafraîchissement peuvent l'avoir fait sortir).
  const parcelsChosen = ready.filter((it) => pickedParcels.has(it.parcel.id));
  const packagesChosen = list.filter((k) => pickedPackages.has(k.id) && isAssignable(k));

  const openCode = async () => {
    const scan = parseWarehouseScan(code);
    if (!code.trim()) return;
    if (scan?.kind !== 'package') {
      setCodeError(scan?.kind === 'parcel' ? "C'est l'étiquette d'un colis : ouvrez d'abord un paquet, puis scannez-la dedans." : "Ce n'est pas un numéro de paquet (PQ-000000)");
      return;
    }
    const no = scan.no;
    try {
      const pkg = await find.mutateAsync(no);
      setCode(''); setCodeError(null);
      onOpenPackage(pkg.id);
    } catch (e) {
      setCodeError(`${no} · ${(e as Error).message}`);
    }
  };

  const loading = packages.isLoading;
  const newButton = (className?: string) => canWrite && (
    <button type="button" onClick={() => newPackage()} disabled={create.isPending} className={cn('inline-flex h-9 items-center gap-2 px-3.5 text-[13px] font-bold disabled:opacity-50', PRIMARY_PILL, className)}>
      <PackagePlus className="h-4 w-4" /> Nouveau paquet
    </button>
  );

  return (
    <div className="space-y-4">
      {/* ── Les chiffres de la mise en paquets ─────────────────────────── */}
      <section className="grid grid-cols-4 gap-4">
        {([
          ['À emballer', `${kpi.readyN} colis`, kpi.readyN > 0 ? `${formatKg(kpi.readyKg)} prêts au bureau` : 'aucun colis prêt', kpi.blocked > 0 ? plural(kpi.blocked, 'pas encore prêt', 'pas encore prêts') : null],
          ['En cours', plural(kpi.open.length, 'paquet'), kpi.open.length > 0 ? `${formatKg(sumKg(kpi.open))} de colis` : 'aucun paquet ouvert', null],
          ['Prêts à partir', plural(kpi.sealed.length, 'paquet'), kpi.sealed.length > 0 ? `${formatKg(sumKg(kpi.sealed))} pesés · à ajouter à un vol` : 'fermés et pesés', null],
          ['Affectés à un vol', plural(kpi.assigned.length, 'paquet'), kpi.assigned.length > 0 ? `${formatKg(sumKg(kpi.assigned))} · en attente du départ` : 'aucun pour l’instant', null],
        ] as [string, string, string, string | null][]).map(([k, v, h, warn]) => (
          <Card key={k} className="px-5 py-4">
            <KV k={k} v={<span className="text-[22px] font-bold">{loading ? '…' : v}</span>} />
            <div className={cn('mt-1 text-[12px]', TEXT.muted)}>{h}</div>
            {warn && <div className="text-[12px] font-semibold text-amber-700 dark:text-amber-400">{warn}</div>}
          </Card>
        ))}
      </section>

      <div className="grid grid-cols-[minmax(0,2.1fr)_minmax(300px,1fr)] items-start gap-5">
        {/* ── Les paquets ──────────────────────────────────────────────── */}
        <Card className="overflow-x-auto p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] px-5 py-3 dark:border-white/[0.06]">
            <span className={cn('text-[13px] font-bold', TEXT.strong)}>Les paquets <span className={cn('font-normal tabular-nums', TEXT.muted)}>· {list.length}</span></span>
            <div className="flex items-center gap-2">
              <form onSubmit={(e) => { e.preventDefault(); void openCode(); }} className="relative">
                <ScanLine className={cn('pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2', TEXT.muted)} />
                <TextInput value={code} onChange={(e) => { setCode(e.target.value); setCodeError(null); }} placeholder="Ouvrir un paquet : PQ-…" aria-label="Ouvrir un paquet par son numéro"
                  autoComplete="off" spellCheck={false} className="h-9 w-[210px] rounded-md pl-9 pr-3 text-[13px]" />
              </form>
              {newButton()}
            </div>
          </div>
          {truncated && <p className="border-b border-border bg-amber-50/70 px-5 py-2 text-[12px] font-semibold text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">Le bureau compte plus de 500 dépôts en stock : les plus anciens n'apparaissent pas dans « à emballer ».</p>}
          {codeError && <p role="alert" className="border-b border-border bg-destructive/10 px-5 py-2 text-[12.5px] font-semibold text-destructive">{codeError}</p>}
          {loading ? <ScreenLoader /> : packages.error ? (
            <p className={cn('px-5 py-12 text-center text-[13px]', TEXT.muted)}>{(packages.error as Error).message}</p>
          ) : groups.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className={cn('text-[14px] font-semibold', TEXT.strong)}>{q ? `Aucun paquet ne correspond à « ${query.trim()} ».` : 'Aucun paquet au bureau.'}</p>
              {!q && <p className={cn('mx-auto mt-1 max-w-[440px] text-[13px]', TEXT.muted)}>Un paquet regroupe des colis avion jusqu'à 32 kg. Commencez-en un, mettez-y les colis, puis fermez-le (pesée) : il pourra alors être ajouté à une expédition.</p>}
              {!q && newButton('mt-4')}
            </div>
          ) : (
            <>
            {packagesChosen.length > 0 && (
              <SelectionBar
                label={`${plural(packagesChosen.length, 'paquet sélectionné', 'paquets sélectionnés')}`}
                meta={`${formatKg(packagesTotals(packagesChosen).kg)} · ${plural(packagesTotals(packagesChosen).parcels, 'colis', 'colis')}`}
                onClear={() => setPickedPackages(new Set())}
              >
                <Btn kind="primary" size="sm" onClick={() => setShipIds(packagesChosen.map((k) => k.id))}><PlaneTakeoff /> Mettre sur un vol</Btn>
              </SelectionBar>
            )}
            <table className="w-full text-left">
              <thead className={SURFACE.card}>
                <tr><Th first className="w-[34px]" /><Th>Paquet</Th><Th>Contenu</Th><Th className="w-[150px]">Poids</Th><Th last>État · expédition</Th></tr>
              </thead>
              {groups.map((g) => {
                // Seuls les paquets fermés (ou refusés, à renvoyer) et libres se cochent : ce sont eux qui montent dans un vol.
                const shippable = canShip ? g.items.filter(isAssignable).map((k) => k.id) : [];
                return (
                <tbody key={g.key}>
                  <tr>
                    <td className="bg-muted/40 py-1.5 pl-5 pr-2">
                      {shippable.length > 0 && <GroupTick ids={shippable} selected={pickedPackages} setSelected={setPickedPackages} label={`Cocher : ${g.title}`} />}
                    </td>
                    <td colSpan={4} className={cn('bg-muted/40 px-2 py-1.5 text-[12px] font-bold', g.key === 'refused' ? 'text-destructive' : TEXT.strong)}>
                      {g.title} <span className={cn('font-normal tabular-nums', TEXT.muted)}>· {g.items.length} · {formatKg(sumKg(g.items))}</span>
                      {g.key === 'open' && <span className={cn('ml-2 font-normal', TEXT.muted)}>— fermez-les (pesée) pour qu'ils puissent partir</span>}
                    </td>
                  </tr>
                  {g.items.map((p) => {
                    const meta = packageStatusMeta(p.status);
                    const codes = knownClientCodes(p, contents)?.join(', ');
                    const open = p.status === 'open';
                    const on = pickedPackages.has(p.id);
                    return (
                      <tr key={p.id} onClick={() => onOpenPackage(p.id)} className={cn('cursor-pointer transition-colors hover:bg-muted/40', on && 'bg-accent/60')}>
                        <Td first>{canShip && isAssignable(p) && <Tick on={on} label={`Sélectionner ${p.package_no}`} onChange={() => setPickedPackages((s) => toggleId(s, p.id))} />}</Td>
                        <Td>
                          <span className={cn('block font-mono text-[13px] font-bold', TEXT.strong)}>{p.package_no}</span>
                          <span className={cn('block text-[11.5px] tabular-nums', TEXT.muted)} title={formatDateTime(p.sealed_at ?? p.created_at)}>{p.sealed_at ? `fermé ${listDate(p.sealed_at)}` : `commencé ${listDate(p.created_at)}`}</span>
                        </Td>
                        <Td>
                          <span className={cn('block text-[13px] font-semibold tabular-nums', TEXT.strong)}>{p.parcel_count} colis · {plural(Number(p.client_count), 'client')}</span>
                          {codes && <span className={cn('block max-w-[150px] truncate font-mono text-[11.5px]', TEXT.muted)} title={codes}>{codes}</span>}
                        </Td>
                        <Td>
                          <MiniGauge pkg={p} sealed={!open} />
                          <span className="mt-1 flex items-baseline justify-between gap-2 text-[12px] tabular-nums">
                            <span className={cn('font-semibold', TEXT.strong)}>{formatKg(p.net_weight_kg)} / {formatKg(p.max_weight_kg)}</span>
                            {p.gross_weight_kg != null && <span className={TEXT.muted}>pesé {formatKg(p.gross_weight_kg)}</span>}
                          </span>
                        </Td>
                        <Td last>
                          <StatusPill tone={meta.tone} label={meta.label} className="h-7 px-2 text-[12.5px]" />
                          {p.status === 'refused' && p.refusal_reason
                            ? <span className="mt-1 block max-w-[150px] truncate text-[11.5px] font-semibold text-destructive" title={p.refusal_reason}>{p.refusal_reason}</span>
                            : p.air_shipment_id && (
                              <button type="button" onClick={(e) => { e.stopPropagation(); onOpenFlight(p.air_shipment_id!); }} title={`Ouvrir l'expédition · ${expeditionLine(p)}`}
                                className={cn('mt-1 block max-w-[150px] truncate text-left text-[11.5px] tabular-nums underline-offset-2 hover:underline', TEXT.muted)}>
                                {expeditionLine(p)}
                              </button>
                            )}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
                );
              })}
            </table>
            </>
          )}
        </Card>

        {/* ── Les colis avion qui attendent d'être emballés ─────────────── */}
        <Card className="overflow-hidden p-0">
          <div className="flex items-center gap-3 border-b border-black/[0.06] px-5 py-2.5 dark:border-white/[0.06]">
            {canWrite && ready.length > 0 && <GroupTick ids={ready.map((it) => it.parcel.id)} selected={pickedParcels} setSelected={setPickedParcels} label="Tous les colis à emballer" />}
            <span className={cn('flex-1 text-[13px] font-bold', TEXT.strong)}>Colis avion à emballer</span>
            <span className={cn('text-[12px] tabular-nums', TEXT.muted)}>{ready.length} · {formatKg(sumParcelKg(ready))}</span>
          </div>
          {parcelsChosen.length > 0 && (
            <SelectionBar
              label={plural(parcelsChosen.length, 'colis', 'colis')}
              meta={formatKg(sumParcelKg(parcelsChosen))}
              onClear={() => setPickedParcels(new Set())}
            >
              <Btn kind="primary" size="sm" onClick={() => setPackItems(parcelsChosen)}><PackagePlus /> Mettre en paquet</Btn>
            </SelectionBar>
          )}
          {!packable ? <ScreenLoader /> : readyGroups.length === 0 ? (
            <p className={cn('px-5 py-10 text-center text-[13px]', TEXT.muted)}>
              {q ? `Aucun colis prêt ne correspond à « ${query.trim()} ».` : 'Aucun colis avion n\'attend d\'être emballé au bureau.'}
            </p>
          ) : (
            <ul className="max-h-[560px] overflow-y-auto">
              {readyGroups.map((g) => {
                const name = g.client ? clientFullName(g.client) : 'Sans client';
                return (
                  <li key={g.key} className="border-t border-black/[0.05] first:border-t-0 dark:border-white/[0.05]">
                    <div className="flex items-center gap-3 px-5 py-3">
                      {canWrite && <GroupTick ids={g.items.map((it) => it.parcel.id)} selected={pickedParcels} setSelected={setPickedParcels} label={`Tous les colis de ${name}`} />}
                      <Holder size="sm">{initials(name)}</Holder>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block truncate text-[13px] font-semibold', TEXT.strong)}>{name}</span>
                        <span className={cn('block text-[11.5px] tabular-nums', TEXT.muted)}><span className="font-mono">{g.client?.customer_code}</span> · {g.items.length} colis · {formatKg(g.kg)}</span>
                      </span>
                      {canWrite && (
                        <button type="button" onClick={() => setPackItems(g.items)}
                          aria-label={`Emballer les colis de ${name}`} title={`Mettre en paquet tous les colis de ${name}`} className={cn('inline-flex h-8 shrink-0 items-center gap-1.5 px-2.5 text-[12px] font-semibold', SOFT_PILL)}>
                          <PackagePlus className="h-3.5 w-3.5" /> Emballer
                        </button>
                      )}
                    </div>
                    <ul className="pb-2">
                      {g.items.map((it) => {
                        const on = pickedParcels.has(it.parcel.id);
                        return (
                          <li key={it.parcel.id} className={cn('flex items-center gap-3 px-5 py-1.5 transition-colors hover:bg-muted/40', on && 'bg-accent/60')}>
                            {canWrite && <Tick on={on} label={`Sélectionner ${it.parcel.parcel_no}`} onChange={() => setPickedParcels((s) => toggleId(s, it.parcel.id))} />}
                            <button type="button" onClick={() => onOpenDeposit(it.deposit.id, it.parcel.id)} title={`Ouvrir le dépôt ${it.deposit.deposit_no}`} className={cn('flex min-w-0 flex-1 items-center gap-3 text-left', !canWrite && 'pl-[42px]')}>
                              <span className={cn('font-mono text-[12px] font-semibold', TEXT.strong)}>{it.parcel.parcel_no}</span>
                              <span className={cn('min-w-0 flex-1 truncate text-[12px]', TEXT.muted)}>{it.parcel.description ?? ''}</span>
                              <span className={cn('shrink-0 text-[12px] tabular-nums', TEXT.body)}>{formatKg(it.parcel.weight_kg)}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
          {blocked.length > 0 && (
            <div className="border-t border-amber-200 bg-amber-50/60 px-5 py-3 dark:border-amber-900/60 dark:bg-amber-950/30">
              <p className="text-[12.5px] font-bold text-amber-800 dark:text-amber-300">Pas encore prêts · {blocked.length}</p>
              <p className={cn('mb-1.5 text-[12px]', TEXT.muted)}>Un colis entre dans un paquet une fois attribué à un client et pesé. Cliquez pour corriger son dépôt.</p>
              <ul className="space-y-0.5">
                {blocked.map((it) => (
                  <li key={it.parcel.id}>
                    <button type="button" onClick={() => onOpenDeposit(it.deposit.id, it.parcel.id)} className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-[12px] hover:bg-amber-100/60 dark:hover:bg-amber-900/30">
                      <span className={cn('font-mono font-semibold', TEXT.strong)}>{it.parcel.parcel_no}</span>
                      <span className={cn('min-w-0 flex-1 truncate', TEXT.muted)}>{it.deposit.client?.customer_code ?? 'client à attribuer'}</span>
                      <span className="shrink-0 font-semibold text-amber-800 dark:text-amber-300">{PACK_BLOCK_LABEL[it.reason]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <PackDialog
        open={!!packItems}
        items={packItems ?? []}
        onClose={() => setPackItems(null)}
        onDone={() => setPickedParcels(new Set())}
        onOpenPackage={(id) => { setPackItems(null); onOpenPackage(id); }}
      />
      <ShipDialog
        open={!!shipIds}
        mode="ship"
        preselected={shipIds ?? []}
        onClose={() => setShipIds(null)}
        onDone={(r) => { setShipIds(null); setPickedPackages(new Set()); onOpenFlight(r.airId); }}
      />
    </div>
  );
}
