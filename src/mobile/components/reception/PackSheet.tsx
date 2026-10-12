// ============================================================
// RÉCEPTION — « Mettre en paquet » sur le téléphone : la même mise en paquet
// que l'ordinateur (PackDialog), dans une feuille, pour le pouce.
//   1. Ce qui est choisi ; ce qui est écarté, avec quoi faire (pesez-le…).
//   2. Dans quel paquet : le paquet EN COURS est proposé d'office quand un
//      colis y tient (on finit le carton entamé — le sien ou celui préparé
//      depuis l'ordinateur) ; sinon un NOUVEAU, découpé tout seul en paquets
//      de 32 kg au plus.
//   3. Ce qui va où, paquet par paquet ; puis le résultat, avec « Ouvrir »
//      (le fermer après la pesée, l'étiquette).
// Ouverte depuis « Dépôt terminé » (les colis du dépôt) et « Colis à
// emballer » (les colis cochés). La base revérifie chaque colis.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Check, PackageOpen, PackagePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { formatKg } from '@/lib/reception';
import {
  PACKAGE_MAX_KG, defaultPackTarget, openPackagesByRoom, packRefusal, planPacking, sumParcelKg, weightGauge,
  type AirPackage, type PackableParcel, type PackBin,
} from '@/lib/airPackage';
import { MAX_PACK_PARCELS, useAirPackages, usePackParcels, type PackRunResult } from '@/hooks/useAirPackages';
import { SURFACE, TEXT, TONE_PILL, TONE_TEXT, TYPE, BottomSheet, Holder, PrimaryPill, SoftPill } from '@/mobile/designKit';
import { useReceptionLabels } from './bits';
import { ChoiceRow, WeightBar } from './packageBits';
import { useOpenedBy, usePackageText } from './packageText';

const codesOf = (its: readonly PackableParcel[]) => [...new Set(its.map((i) => i.deposit.client?.customer_code).filter(Boolean))] as string[];

export function PackSheet({ open, onClose, items, onDone }: {
  open: boolean;
  onClose: () => void;
  /** Les colis choisis (avec leur dépôt) ; ceux qui ne peuvent pas entrer sont écartés ici, avec la raison. */
  items: readonly PackableParcel[];
  /** Des colis sont entrés : la sélection d'origine peut se vider. */
  onDone?: () => void;
}) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { t: ti } = useTranslation('agent');
  const tx = usePackageText();
  const labels = useReceptionLabels();
  const bureau = useAirPackages('bureau', null, open);
  const pack = usePackParcels();
  // 'auto' : le paquet en cours proposé d'office, tant que rien n'est choisi à la main.
  const [dest, setDest] = useState<'auto' | 'new' | string>('auto');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<PackRunResult | null>(null);

  useEffect(() => { if (open) { setDest('auto'); setProgress(null); setResult(null); } }, [open]);

  const ready = useMemo(() => items.filter((it) => packRefusal(it.parcel, it.deposit) === null), [items]);
  const excluded = useMemo(() => items
    .map((it) => ({ it, reason: packRefusal(it.parcel, it.deposit) }))
    .filter((x) => x.reason !== null), [items]);
  const openPackages = useMemo(() => openPackagesByRoom(bureau.data ?? []), [bureau.data]);
  const proposed = useMemo(() => defaultPackTarget(openPackages, ready), [openPackages, ready]);
  // Le paquet choisi a pu être fermé entre-temps : la destination retombe alors sur « nouveau », visiblement.
  const target = dest === 'auto' ? proposed : dest === 'new' ? null : openPackages.find((k) => k.id === dest) ?? null;
  const plan = useMemo(() => planPacking(ready, target), [ready, target]);
  const filled = plan.filter((b) => b.items.length > 0);
  const newBins = plan.filter((b) => b.packageId === null);
  const moving = filled.reduce((n, b) => n + b.items.length, 0);
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
      if (r.packages.some((p) => p.added.length > 0)) onDone?.();
    } catch {
      setProgress(null); // le hook affiche le refus
    }
  };

  const goTo = (id: string) => { onClose(); navigate(`/r/paquets/${id}`); };
  const binTitle = (b: PackBin) => b.packageId
    ? ti('rc_pk_pack_bin_open', { no: b.packageNo })
    : newBins.length > 1 ? ti('rc_pk_pack_bin_new_n', { n: newBins.indexOf(b) + 1 }) : t('rc_pk_pack_bin_new');

  /* ── Le résultat ─────────────────────────────────────────────────── */
  if (result) {
    const done = result.packages.filter((p) => p.added.length > 0);
    const leftEmpty = result.packages.filter((p) => p.created && !p.dropped && p.added.length === 0 && p.id);
    const failed = result.packages.filter((p) => p.error);
    const refused = result.packages.flatMap((p) => p.refused);
    const only = done.length === 1 ? done[0] : null;
    return (
      <BottomSheet open={open} onClose={onClose} title={done.length > 0 ? t('rc_pk_pack_done') : t('rc_pk_pack_failed')}>
        <div className="space-y-5">
          <p className={cn(TYPE.body, TEXT.muted)}>{done.length > 0 ? t('rc_pk_pack_done_hint') : t('rc_pk_pack_failed_hint')}</p>
          <ul className="space-y-3">
            {done.map((p) => (
              <li key={p.id} className={cn('space-y-2 rounded-lg border px-4 py-3', SURFACE.divider)}>
                <div className="flex items-center gap-3">
                  <Holder icon={Check} tone="success" size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block whitespace-nowrap tabular-nums', TYPE.lead, TEXT.strong)}>{p.package_no}</span>
                    <span className={cn('block tabular-nums', TYPE.small, TEXT.muted)}>{labels.parcels(p.added.length)}{!p.created && ` · ${t('rc_pk_pack_completed')}`}</span>
                  </span>
                  {!only && <SoftPill onClick={() => goTo(p.id)} className="h-11 shrink-0 px-3"><PackageOpen /> {t('rc_pk_open')}</SoftPill>}
                </div>
                <ParcelNos nos={p.added} />
              </li>
            ))}
            {leftEmpty.map((p) => (
              <li key={p.id} className={cn('flex items-center gap-3 rounded-lg px-4 py-3', TONE_PILL.pending)}>
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span className={cn('min-w-0 flex-1', TYPE.small)}>{ti('rc_pk_pack_left_empty', { no: p.package_no })}</span>
                <SoftPill onClick={() => goTo(p.id)} className="h-11 shrink-0 px-3">{t('rc_pk_open')}</SoftPill>
              </li>
            ))}
            {failed.map((p, i) => (
              <li key={`f-${i}`} className={cn('flex items-start gap-3 rounded-lg px-4 py-3', TONE_PILL.danger)}>
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <span className={TYPE.small}>{ti('rc_pk_pack_create_failed', { error: p.error })}</span>
              </li>
            ))}
          </ul>
          {refused.length > 0 && (
            <Excluded title={ti('rc_pk_pack_refused', { count: refused.length })} rows={refused.map((r) => ({ key: r.parcel_no, label: r.parcel_no, reason: r.error }))} />
          )}
          <div className="space-y-3">
            {only && <PrimaryPill onClick={() => goTo(only.id)} className="h-14 w-full text-[17px]"><PackageOpen /> {ti('rc_pk_open_no', { no: only.package_no })}</PrimaryPill>}
            {only
              ? <SoftPill onClick={onClose} className="h-12 w-full">{t('rc_pk_pack_finish')}</SoftPill>
              : <PrimaryPill onClick={onClose} className="h-14 w-full text-[17px]">{t('rc_pk_pack_finish')}</PrimaryPill>}
          </div>
        </div>
      </BottomSheet>
    );
  }

  /* ── Le choix et le plan ─────────────────────────────────────────── */
  const goLabel = filled.length > 1 ? ti('rc_pk_pack_go_split', { count: filled.length }) : ti('rc_pk_pack_go', { count: moving });
  return (
    <BottomSheet open={open} onClose={running ? () => undefined : onClose} title={t('rc_pk_pack')}>
      <div className="space-y-5">
        <p className={cn('tabular-nums', TYPE.bodyStrong, TEXT.strong)}>
          {ready.length > 0
            ? `${labels.parcels(ready.length)} · ${formatKg(sumParcelKg(ready))} · ${tx.clients(codesOf(ready).length)}`
            : t('rc_pk_pack_none')}
          {ready.length > 0 && <span className={cn('block', TYPE.small, TEXT.muted)}>{t('rc_pk_subtitle')}</span>}
        </p>

        <Excluded
          title={ti('rc_pk_pack_excluded', { count: excluded.length })}
          rows={excluded.map(({ it, reason }) => ({ key: it.parcel.id, label: it.parcel.parcel_no, reason: tx.why(reason!, it.parcel) }))}
        />

        {ready.length > 0 && (
          <section>
            <h3 className={cn('mb-3', TYPE.lead, TEXT.strong)}>{t('rc_pk_pack_where')}</h3>
            <div role="radiogroup" aria-label={t('rc_pk_pack_where')} className="space-y-2">
              {openPackages.map((k) => (
                <OpenChoice key={k.id} pkg={k} on={target?.id === k.id} proposed={proposed?.id === k.id} onClick={() => setDest(k.id)} />
              ))}
              <ChoiceRow
                on={target === null}
                onClick={() => setDest('new')}
                title={t('rc_pk_new')}
                meta={target === null && newBins.length > 1
                  ? ti('rc_pk_pack_new_split', { kg: formatKg(sumParcelKg(ready)), count: newBins.length })
                  : t('rc_pk_pack_new_meta')}
              />
            </div>
          </section>
        )}

        {moving > 0 && (
          <section>
            <h3 className={cn('mb-3', TYPE.lead, TEXT.strong)}>{t('rc_pk_pack_plan')}</h3>
            <ul className="space-y-2">
              {plan.map((b, i) => (
                <li key={b.packageId ?? `new-${i}`} className={cn('space-y-2 rounded-lg px-4 py-3', SURFACE.inset)}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={cn('min-w-0 break-words', TYPE.bodyStrong, TEXT.strong)}>{binTitle(b)}</span>
                    <span className={cn('shrink-0 tabular-nums', TYPE.smallStrong, TEXT.strong)}>{formatKg(b.kg)} <span className={cn('font-normal', TEXT.muted)}>/ {formatKg(PACKAGE_MAX_KG)}</span></span>
                  </div>
                  <WeightBar gauge={weightGauge({ net_weight_kg: b.kg, max_weight_kg: PACKAGE_MAX_KG })} />
                  {b.items.length === 0 ? (
                    <p className={cn(TYPE.smallStrong, TONE_TEXT.pending)}>{t('rc_pk_pack_bin_nothing')}</p>
                  ) : (
                    <div className="space-y-1">
                      <p className={cn('break-words tabular-nums', TYPE.small, TEXT.body)}>+{labels.parcels(b.items.length)} ({formatKg(sumParcelKg(b.items))}) · {codesOf(b.items).join(', ')}</p>
                      <ParcelNos nos={b.items.map((it) => it.parcel.parcel_no)} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="space-y-3">
          {(running || tooMany) && (
            <p role="status" className={cn('text-center tabular-nums', TYPE.smallStrong, running ? TEXT.muted : TONE_TEXT.pending)}>
              {running ? ti('rc_pk_pack_progress', { done: progress!.done, total: progress!.total }) : ti('rc_pk_pack_too_many', { max: MAX_PACK_PARCELS })}
            </p>
          )}
          <PrimaryPill onClick={() => void run()} loading={running} disabled={moving === 0 || tooMany || running} className="h-14 w-full text-[17px]">
            <PackagePlus /> {moving === 0 ? t('rc_pk_pack') : goLabel}
          </PrimaryPill>
          <SoftPill onClick={onClose} disabled={running} className="h-12 w-full">{t('rc_cancel')}</SoftPill>
        </div>
      </div>
    </BottomSheet>
  );
}

/** Un paquet en cours, à compléter : sa jauge, ce qu'il reste, qui l'a ouvert. */
function OpenChoice({ pkg, on, proposed, onClick }: { pkg: AirPackage; on: boolean; proposed: boolean; onClick: () => void }) {
  const { t } = useLanguage();
  const tx = usePackageText();
  const labels = useReceptionLabels();
  const by = useOpenedBy(pkg);
  const g = weightGauge(pkg);
  return (
    <ChoiceRow
      on={on}
      onClick={onClick}
      title={<>{pkg.package_no} <span className={cn('ml-1', TYPE.smallStrong, TEXT.muted)}>{t('rc_pk_st_open')}</span></>}
      meta={[
        Number(pkg.parcel_count) === 0 ? t('rc_pk_pack_empty') : `${formatKg(g.net)} / ${formatKg(g.max)} · ${tx.left(g)} · ${labels.parcels(Number(pkg.parcel_count))} · ${tx.clients(Number(pkg.client_count))}`,
        by,
      ].filter(Boolean).join(' · ')}
    >
      <WeightBar gauge={g} className="mt-2" />
      {proposed && <span className={cn('mt-2 block', TYPE.smallStrong, TONE_TEXT.success)}>{t('rc_pk_pack_proposed')}</span>}
    </ChoiceRow>
  );
}

/** Des numéros de colis, dans l'ordre, chacun d'un bloc (jamais coupé en fin de ligne). */
function ParcelNos({ nos }: { nos: readonly string[] }) {
  return (
    <p className={cn('flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] tabular-nums', TEXT.muted)}>
      {[...nos].sort().map((no) => <span key={no} className="whitespace-nowrap">{no}</span>)}
    </p>
  );
}

/** Ce qui est écarté, et pourquoi — replié au-delà de quelques lignes. */
function Excluded({ title, rows }: { title: string; rows: { key: string; label: string; reason: string }[] }) {
  if (rows.length === 0) return null;
  const list = (
    <ul className="mt-2 space-y-1">
      {rows.map((r) => (
        <li key={r.key} className={cn('flex flex-wrap items-baseline gap-x-2', TYPE.small)}>
          <span className="font-semibold tabular-nums">{r.label}</span>
          <span className="min-w-0 break-words">{r.reason}</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className={cn('rounded-lg px-4 py-3', TONE_PILL.pending)}>
      {rows.length <= 4 ? (
        <>
          <p className={cn('flex items-center gap-2', TYPE.bodyStrong)}><AlertTriangle className="h-5 w-5 shrink-0" /> {title}</p>
          {list}
        </>
      ) : (
        <details>
          <summary className={cn('flex cursor-pointer items-center gap-2', TYPE.bodyStrong)}><AlertTriangle className="h-5 w-5 shrink-0" /> {title}</summary>
          {list}
        </details>
      )}
    </div>
  );
}
