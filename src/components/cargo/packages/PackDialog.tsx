// ============================================================
// « Mettre en paquet » — la même fenêtre depuis la Réception (colis ou dépôts
// cochés) et depuis Paquets avion (colis à emballer cochés).
//   1. Ce qui est coché, et ce qui est écarté avec la raison (entrepôt =
//      bateau, déjà dans un paquet, sans client, pas pesé…).
//   2. Dans quel paquet : un paquet EN COURS à compléter (proposé d'office
//      quand un colis y tient : on finit le carton entamé) — ce qui n'y tient
//      pas part dans un nouveau —, ou un NOUVEAU (découpé tout seul en paquets
//      de 32 kg au plus).
//   3. Le plan, paquet par paquet ; puis le résultat, avec « Ouvrir » sur
//      chaque paquet (le fermer, l'étiquette).
// Écriture : canReceiveParcels (la base revérifie chaque colis).
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, PackageOpen, PackagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { MAX_PACK_PARCELS, useAirPackages, usePackParcels, type PackRunResult } from '@/hooks/useAirPackages';
import {
  PACKAGE_MAX_KG, defaultPackTarget, openPackagesByRoom, packRefusal, packRefusalLabel, planPacking, sumParcelKg, weightGauge,
  type PackableParcel, type PackBin,
} from '@/lib/airPackage';
import { clientFullName, formatKg } from '@/lib/reception';
import { plural } from '@/lib/cargo/plain';
import { cn } from '@/lib/utils';
import { FormDialog, TEXT } from '@/desktop/designKit';
import { MiniGauge } from './PackageGauge';
import { Btn, ChoiceCard, Excluded } from './bits';

const codesOf = (its: readonly PackableParcel[]) => [...new Set(its.map((i) => i.deposit.client?.customer_code).filter(Boolean))] as string[];

export function PackDialog({ open, items, onClose, onDone, onOpenPackage, onShowPackages }: {
  open: boolean;
  /** Les colis cochés (avec leur dépôt) — ceux qui ne peuvent pas entrer sont écartés ici, avec la raison. */
  items: readonly PackableParcel[];
  onClose: () => void;
  /** Des colis sont entrés : la sélection d'origine peut se vider. */
  onDone?: () => void;
  /** Ouvrir la fiche d'un paquet (le fermer, l'étiquette). */
  onOpenPackage: (id: string) => void;
  /** Aller à la vue Paquets avion (absent : on y est déjà). */
  onShowPackages?: () => void;
}) {
  const bureau = useAirPackages('bureau', null, open);
  const pack = usePackParcels();
  // 'auto' : le paquet en cours proposé d'office (defaultPackTarget), tant qu'on n'a rien choisi.
  const [dest, setDest] = useState<'auto' | 'new' | string>('auto');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<PackRunResult | null>(null);

  useEffect(() => { if (open) { setDest('auto'); setProgress(null); setResult(null); } }, [open]);

  const ready = useMemo(() => items.filter((it) => packRefusal(it.parcel, it.deposit) === null), [items]);
  const excluded = useMemo(() => items
    .map((it) => ({ it, reason: packRefusal(it.parcel, it.deposit) }))
    .filter((x) => x.reason !== null)
    .map(({ it, reason }) => ({ key: it.parcel.id, label: it.parcel.parcel_no, reason: packRefusalLabel(reason!, it.parcel) })), [items]);
  // Les paquets en cours, ceux qui ont le plus de place d'abord.
  const openPackages = useMemo(() => openPackagesByRoom(bureau.data ?? []), [bureau.data]);
  const proposed = useMemo(() => defaultPackTarget(openPackages, ready), [openPackages, ready]);
  // Le paquet choisi peut avoir été fermé entre-temps : la destination retombe alors sur « nouveau », visiblement.
  const target = dest === 'auto' ? proposed : dest === 'new' ? null : openPackages.find((k) => k.id === dest) ?? null;
  const chosen = target ? target.id : 'new';
  const plan = useMemo(() => planPacking(ready, target), [ready, target]);
  const filled = plan.filter((b) => b.items.length > 0);
  const newBins = plan.filter((b) => b.packageId === null);
  const moving = filled.reduce((t, b) => t + b.items.length, 0);
  const tooMany = moving > MAX_PACK_PARCELS;
  const running = progress !== null && result === null;

  const run = async () => {
    if (running || moving === 0 || tooMany) return;
    setProgress({ done: 0, total: moving });
    try {
      const r = await pack.mutateAsync({
        bins: filled.map((b) => ({ packageId: b.packageId, packageNo: b.packageNo, parcelNos: b.items.map((i) => i.parcel.parcel_no) })),
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setResult(r);
      const added = r.packages.reduce((t, p) => t + p.added.length, 0);
      if (added > 0) {
        onDone?.();
        toast.success(`${plural(added, 'colis', 'colis')} mis en paquet`, { description: r.packages.filter((p) => p.added.length > 0).map((p) => p.package_no).join(' · ') });
      }
    } catch {
      setProgress(null); // le hook affiche le refus
    }
  };

  const binTitle = (b: PackBin) => b.packageId ? `${b.packageNo} · en cours` : newBins.length > 1 ? `Nouveau paquet ${newBins.indexOf(b) + 1}` : 'Nouveau paquet';

  /* ── Le résultat ─────────────────────────────────────────────────── */
  if (result) {
    const done = result.packages.filter((p) => p.added.length > 0);
    // Un paquet créé resté vide que la base n'a pas laissé supprimer : à supprimer à la main.
    const leftEmpty = result.packages.filter((p) => p.created && !p.dropped && p.added.length === 0 && p.id);
    const failed = result.packages.filter((p) => p.error);
    const refused = result.packages.flatMap((p) => p.refused);
    return (
      <FormDialog
        open={open}
        onClose={onClose}
        width={640}
        title={done.length > 0 ? 'Colis mis en paquet' : 'Aucun colis n’a pu entrer'}
        subtitle={done.length > 0 ? 'Mettez ces colis dans leur carton, pesez-le, puis fermez le paquet dans sa fiche : son étiquette sort aussitôt.' : 'Le serveur a refusé chaque colis : la raison est donnée ci-dessous.'}
        footer={
          <div className="flex items-center justify-end gap-2">
            {onShowPackages && <Btn onClick={onShowPackages}>Voir les paquets</Btn>}
            <Btn kind="primary" onClick={onClose}>Terminer</Btn>
          </div>
        }
      >
        <ul className="space-y-2">
          {done.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"><Check className="h-4 w-4" strokeWidth={3} /></span>
              <span className="min-w-0 flex-1">
                <span className={cn('block font-mono text-[14px] font-bold', TEXT.strong)}>{p.package_no}{p.created ? '' : ' (complété)'}</span>
                <span className={cn('block truncate text-[12px] tabular-nums', TEXT.muted)}>{plural(p.added.length, 'colis', 'colis')} : {p.added.join(', ')}</span>
              </span>
              <Btn size="sm" onClick={() => onOpenPackage(p.id)}><PackageOpen /> Ouvrir</Btn>
            </li>
          ))}
          {leftEmpty.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-lg border border-amber-200 px-4 py-3 dark:border-amber-900/60">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
              <span className={cn('min-w-0 flex-1 text-[12.5px]', TEXT.body)}><span className="font-mono font-bold">{p.package_no}</span> a été créé mais reste vide : ouvrez-le pour le supprimer.</span>
              <Btn size="sm" onClick={() => onOpenPackage(p.id)}><PackageOpen /> Ouvrir</Btn>
            </li>
          ))}
          {failed.map((p, i) => (
            <li key={`f-${i}`} className="flex items-center gap-3 rounded-lg border border-destructive/40 px-4 py-3 text-[12.5px] text-destructive">
              <AlertTriangle className="h-5 w-5 shrink-0" /> Un nouveau paquet n'a pas pu être créé ({p.error}) : ses colis n'ont pas bougé.
            </li>
          ))}
        </ul>
        {refused.length > 0 && (
          <div className="mt-3">
            <Excluded title={`${plural(refused.length, 'colis refusé', 'colis refusés')} par le serveur`} rows={refused.map((r) => ({ key: r.parcel_no, label: r.parcel_no, reason: r.error }))} />
          </div>
        )}
      </FormDialog>
    );
  }

  /* ── Le choix et le plan ─────────────────────────────────────────── */
  return (
    <FormDialog
      open={open}
      onClose={running ? () => undefined : onClose}
      onConfirm={() => void run()}
      width={720}
      title="Mettre en paquet"
      subtitle={ready.length > 0
        ? `${plural(ready.length, 'colis', 'colis')} · ${formatKg(sumParcelKg(ready))} · ${plural(codesOf(ready).length, 'client')} — ${PACKAGE_MAX_KG} kg au plus par paquet`
        : 'Aucun des colis choisis ne peut entrer dans un paquet.'}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className={cn('text-[12.5px] tabular-nums', TEXT.muted)}>
            {running ? `${progress!.done} / ${progress!.total} colis…` : tooMany ? <span className="font-semibold text-amber-700 dark:text-amber-400">{MAX_PACK_PARCELS} colis au plus à la fois : allégez la sélection</span> : moving > 0 ? `${plural(moving, 'colis', 'colis')} → ${plural(filled.length, 'paquet')}` : ''}
          </span>
          <span className="flex gap-2">
            <Btn onClick={onClose} disabled={running}>Annuler</Btn>
            <Btn kind="primary" onClick={() => void run()} disabled={moving === 0 || tooMany} loading={running}>
              <PackagePlus /> {moving === 0 ? 'Mettre en paquet' : filled.length > 1 ? `Répartir en ${filled.length} paquets` : `Mettre ${plural(moving, 'colis', 'colis')} en paquet`}
            </Btn>
          </span>
        </div>
      }
    >
      <div className="space-y-5">
        <Excluded title={`${plural(excluded.length, 'colis écarté', 'colis écartés')}`} rows={excluded} />

        {ready.length > 0 && (
          <section>
            <h3 className={cn('mb-2 text-[13px] font-bold', TEXT.strong)}>Dans quel paquet ?</h3>
            <div role="radiogroup" aria-label="Paquet de destination" className="space-y-2">
              {openPackages.map((k) => {
                const g = weightGauge(k);
                return (
                  <ChoiceCard
                    key={k.id}
                    on={chosen === k.id}
                    onClick={() => setDest(k.id)}
                    title={<span className="font-mono">{k.package_no} <span className={cn('font-sans text-[12px] font-semibold', TEXT.muted)}>· en cours</span></span>}
                    meta={`${formatKg(g.net)} / ${formatKg(g.max)} · reste ${formatKg(g.left)} · ${plural(Number(k.parcel_count), 'colis', 'colis')} · ${plural(Number(k.client_count), 'client')}${k.created_by_name ? ` · ouvert par ${k.created_by_name}` : ''}${proposed?.id === k.id ? ' · proposé : on finit le carton entamé' : ''}`}
                  />
                );
              })}
              <ChoiceCard
                on={chosen === 'new'}
                onClick={() => setDest('new')}
                title="Nouveau paquet"
                meta={newBins.length > 1 && chosen === 'new'
                  ? `${formatKg(sumParcelKg(ready))} : ${newBins.length} paquets de ${PACKAGE_MAX_KG} kg au plus, créés tout seuls`
                  : 'Un paquet tout neuf, créé maintenant'}
              />
            </div>
          </section>
        )}

        {moving > 0 && (
          <section>
            <h3 className={cn('mb-2 text-[13px] font-bold', TEXT.strong)}>Le plan</h3>
            <ul className="space-y-2">
              {plan.map((b, i) => {
                const codes = codesOf(b.items);
                return (
                  <li key={b.packageId ?? `new-${i}`} className="rounded-lg border border-border px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className={cn('text-[13px] font-bold', TEXT.strong)}>{binTitle(b)}</span>
                      <span className={cn('text-[12.5px] font-semibold tabular-nums', TEXT.strong)}>{formatKg(b.kg)} <span className={cn('font-normal', TEXT.muted)}>/ {formatKg(PACKAGE_MAX_KG)}</span></span>
                    </div>
                    <div className="mt-2"><MiniGauge pkg={{ net_weight_kg: b.kg, max_weight_kg: PACKAGE_MAX_KG }} sealed={false} /></div>
                    {b.items.length === 0 ? (
                      <p className="mt-2 text-[12.5px] font-semibold text-amber-700 dark:text-amber-400">Aucun des colis choisis n'y tient : ils partent dans un nouveau paquet.</p>
                    ) : (
                      <p className={cn('mt-2 text-[12.5px]', TEXT.body)}>
                        +{plural(b.items.length, 'colis', 'colis')} ({formatKg(sumParcelKg(b.items))}) · {codes.join(', ')}
                        <span className={cn('mt-0.5 block font-mono text-[11.5px]', TEXT.muted)}>{b.items.map((it) => it.parcel.parcel_no).join('  ')}</span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
            {codesOf(ready).length === 1 && ready[0].deposit.client && (
              <p className={cn('mt-2 text-[12px]', TEXT.muted)}>Un seul client : {clientFullName(ready[0].deposit.client)}.</p>
            )}
          </section>
        )}
      </div>
    </FormDialog>
  );
}
