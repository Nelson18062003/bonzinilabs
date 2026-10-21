// ============================================================
// RÉCEPTION — Un paquet avion (32 kg au plus). En haut, la jauge : ce que
// pèsent ses colis, ce qu'il reste. Tant qu'il est ouvert, deux gestes pour
// le remplir : la boîte de scan (chaque étiquette lue y entre — bip aigu —
// ou est refusée avec la raison du serveur — bip grave ; trop lourd, on
// propose de le fermer et d'en commencer un autre), et la liste des colis
// prêts qui y tiennent encore (« Ajouter », les clients déjà dedans en
// tête). Le paquet peut avoir été ouvert ici ou depuis l'ordinateur.
// Les colis, rangés par client.
// En bas : fermer (pesée, dimensions, puis l'étiquette), rouvrir, imprimer,
// ou supprimer un paquet vide.
// Refonte v2 (maquette 10/48) : le poids en grand, la jauge, la douchette,
// les colis avec « Retirer » ; « Fermer le paquet (pesée) » en bas ; le rare
// (étiquette, rouvrir, supprimer, paquet suivant) dans « … ».
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useReceptionBack } from '@/mobile/components/reception/useReceptionBack';
import { Check, LockOpen, PackagePlus, Printer, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { clientFullName, formatKg, type ParcelKind } from '@/lib/reception';
import { fitsInPackage, isAssignable, packableGroups, packageClientGroups, planPacking, sealCheck, sumParcelKg, weightGauge, type AirPackage, type PackableParcel } from '@/lib/airPackage';
import {
  PackageRpcError, useAddParcelToPackage, useAirPackage, useCreateAirPackage, useDeleteAirPackage,
  usePackableParcels, usePackParcels, useRemoveParcelFromPackage, useReopenAirPackage, useSealAirPackage, type SealInput,
} from '@/hooks/useAirPackages';
import { ParcelScanBox, type ScanResult } from '@/mobile/components/cargo/ParcelScanBox';
import { PackageLabelSheet } from '@/components/cargo/packages/PackageLabelSheet';
import {
  ActionSheet, BigButton, BottomSheet, ConfirmSheet, DayLabel, Dock, EmptyLine, KVBox, MoreButton, ScreenLoader, ScreenTop, SURFACE, TEXT, TONE_PILL, TONE_TEXT, TYPE, Tag,
  useSheet,
} from '@/mobile/designKit';
import { ParcelLine, formatDateTime, useReceptionLabels } from '@/mobile/components/reception/bits';
import { CapsLabel, InkProgress, RowButton, UnitField } from '@/mobile/components/cargo/v2';
import { useOpenedBy, usePackageText, useScanTexts } from '@/mobile/components/reception/packageText';

type Sheet = 'seal' | 'label' | 'reopen' | 'delete' | null;

/** Une fiche par paquet : passer d'un paquet à l'autre repart de zéro (scan, sélection). */
export function ReceptionPackage() {
  const { id = '' } = useParams<{ id: string }>();
  return <PackageScreen key={id} id={id} />;
}

function PackageScreen({ id }: { id: string }) {
  const navigate = useNavigate();
  const back = useReceptionBack();
  const { t } = useLanguage();
  const { t: ti } = useTranslation('agent');
  const tx = usePackageText();
  const labels = useReceptionLabels();
  const scanTexts = useScanTexts(t('rc_pk_scan_hint'));
  const { data: pkg, isLoading, error, refetch } = useAirPackage(id);
  const add = useAddParcelToPackage(id);
  const remove = useRemoveParcelFromPackage(id);
  const seal = useSealAirPackage(id);
  const reopen = useReopenAirPackage(id);
  const del = useDeleteAirPackage();
  const create = useCreateAirPackage();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [over, setOver] = useState(false);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [justSealed, setJustSealed] = useState(false);
  const more = useSheet();

  const groups = useMemo(() => packageClientGroups(pkg?.parcels), [pkg?.parcels]);
  const by = useOpenedBy(pkg ?? {});

  // Chargement et erreur gardent l'en-tête et sa flèche : jamais d'écran sans sortie.
  if (isLoading || error || !pkg) {
    return (
      <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
        <ScreenTop title={t('rc_pk_title')} onBack={() => back('/r/paquets')} />
        {isLoading ? <ScreenLoader /> : <EmptyLine action={{ label: t('rc_retry'), onClick: () => void refetch() }}>{(error as Error | null)?.message ?? t('rc_pk_not_found')}</EmptyLine>}
      </div>
    );
  }

  const open = pkg.status === 'open';
  const g = weightGauge(pkg);
  const st = tx.status(pkg.status);
  const expedition = tx.expedition(pkg);
  const busy = seal.isPending || reopen.isPending || del.isPending || create.isPending;

  const onScan = async (text: string): Promise<ScanResult> => {
    setOver(false);
    try {
      const r = await add.mutateAsync(text);
      if (r.already) return { outcome: 'again', text: ti('rc_pk_already', { parcel: r.parcel_no }) };
      setLastAdded(r.parcel_no);
      const who = r.client ? `${r.client.customer_code} · ${clientFullName(r.client)}` : '';
      return { outcome: 'ok', text: ti('rc_pk_added', { parcel: r.parcel_no, kg: formatKg(r.weight_kg ?? null), client: who }) };
    } catch (e) {
      if (e instanceof PackageRpcError && e.payload.over === true) setOver(true);
      return { outcome: 'refused', text: (e as Error).message };
    }
  };

  const doSeal = (v: SealInput) => {
    if (seal.isPending) return;
    seal.mutate(v, {
      onSuccess: (p) => {
        setOver(false);
        setJustSealed(true);
        setSheet('label');
        toast.success(ti('rc_pk_sealed_toast', { no: p.package_no }));
      },
    });
  };
  const doReopen = () => {
    if (reopen.isPending) return;
    reopen.mutate(undefined, { onSuccess: () => { setSheet(null); setJustSealed(false); } });
  };
  const doDelete = () => {
    if (del.isPending) return;
    del.mutate(pkg.id, { onSuccess: () => back('/r/paquets') });
  };
  const startNext = () => {
    if (create.isPending) return;
    // Le paquet suivant REMPLACE celui-ci : un seul retour ramène à l'onglet Paquets.
    create.mutate(undefined, { onSuccess: (p) => { setSheet(null); navigate(`/r/paquets/${p.id}`, { replace: true }); } });
  };

  const all = groups.flatMap((grp) => grp.parcels.map((p) => ({ p, client: grp.client })));
  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <ScreenTop title={pkg.package_no} onBack={() => back('/r/paquets')} right={<MoreButton onClick={more.show} />} />

      <div className="flex-1 space-y-5 px-5 pb-6 pt-5">
        {/* Le poids en grand : ce que pèsent les colis sur 32 kg. */}
        <div className="text-center">
          <p className={cn('text-[48px] font-bold leading-none tracking-[-0.03em] tabular-nums', TEXT.strong)}>
            {g.net.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}<span className={cn('ml-1.5 text-[22px] font-semibold tracking-normal', TEXT.muted)}>kg</span>
          </p>
          <p className={cn('mt-2 text-[16px] tabular-nums', TEXT.muted)}>
            {ti('rc_v2_out_of', { max: formatKg(g.max) })} · {labels.parcels(pkg.parcel_count)} · {open ? tx.left(g) : st.label}
          </p>
          {by && <p className={cn('mt-0.5 text-[15px]', TEXT.muted)}>{by}</p>}
        </div>
        <InkProgress value={g.net} max={g.max} label={t('rc_pk_net')} />
        {!open && <div className="text-center"><Tag tone={st.tone === 'info' ? 'neutral' : st.tone}>{st.label}</Tag></div>}
        {pkg.gross_weight_kg != null && (
          <KVBox rows={[
            { label: t('rc_pk_gross'), value: formatKg(pkg.gross_weight_kg) },
            ...(pkg.length_cm != null && pkg.width_cm != null && pkg.height_cm != null ? [{ label: t('rc_pk_dims'), value: `${pkg.length_cm} × ${pkg.width_cm} × ${pkg.height_cm} cm` }] : []),
            ...(pkg.sealed_at ? [{ label: t('rc_pk_sealed_on'), value: formatDateTime(pkg.sealed_at) }] : []),
          ]} />
        )}

        {pkg.status === 'refused' && (
          <div className={cn('space-y-1 rounded-lg px-4 py-3', TONE_PILL.danger)}>
            <p className={TYPE.bodyStrong}>{t('rc_pk_st_refused')}</p>
            {pkg.refusal_reason && <p className={cn('break-words', TYPE.body)}>{ti('rc_pk_refusal', { reason: pkg.refusal_reason })}</p>}
          </div>
        )}
        {expedition && (
          <div className={cn('space-y-1 rounded-lg px-4 py-3', TONE_PILL.info)}>
            <p className={TYPE.bodyStrong}>{t('rc_pk_group_assigned')}</p>
            <p className={cn('break-words tabular-nums', TYPE.body)}>{expedition}</p>
          </div>
        )}

        {open && (
          <div className="space-y-3">
            {/* La douchette garde le champ, sauf quand une feuille est ouverte (pesée, étiquette). */}
            <ParcelScanBox onScan={onScan} placeholder={t('rc_pk_scan_ph')} texts={scanTexts} keepFocus={sheet === null && !more.open} />
            {over && (
              <div className={cn('space-y-3 rounded-lg px-4 py-4', TONE_PILL.pending)}>
                <p className={TYPE.bodyStrong}>{t('rc_pk_over_hint')}</p>
                <BigButton onClick={() => setSheet('seal')} disabled={busy || pkg.parcel_count === 0}>{t('rc_pk_seal_and_next')}</BigButton>
              </div>
            )}
          </div>
        )}

        {/* Les colis du paquet. */}
        {all.length === 0 ? (
          <EmptyLine>{open ? t('rc_pk_empty_parcels') : '—'}</EmptyLine>
        ) : (
          <div>
            {all.map(({ p, client }) => (
              <ParcelLine
                key={p.id}
                parcel={p}
                title={<span className="inline-flex items-center gap-1.5 tabular-nums">{p.parcel_no === lastAdded && <Check className="h-4 w-4 shrink-0 text-[#009951]" aria-hidden="true" />}{p.parcel_no}</span>}
                subtitle={`${client ? clientFullName(client) : t('rc_unknown_client')} · ${formatKg(p.weight_kg)}`}
                right={open ? <RowButton link disabled={remove.isPending} onClick={() => remove.mutate(p.id)}>{t('rc_remove')}</RowButton> : <span className={cn('shrink-0 text-[17px] font-bold tabular-nums', TEXT.strong)}>{formatKg(p.weight_kg)}</span>}
              />
            ))}
          </div>
        )}

        {open && <ReadyToAdd pkg={pkg} onAdded={(no) => { setOver(false); setLastAdded(no); }} />}
      </div>

      <Dock>
        {open ? (
          pkg.parcel_count > 0
            ? <BigButton onClick={() => setSheet('seal')} disabled={busy}>{t('rc_v2_seal_weigh')}</BigButton>
            : <BigButton variant="danger" onClick={() => setSheet('delete')} disabled={busy}>{t('rc_pk_delete')}</BigButton>
        ) : (
          <BigButton onClick={() => { setJustSealed(false); setSheet('label'); }} disabled={busy}>{t('rc_pk_print')}</BigButton>
        )}
      </Dock>

      <ActionSheet
        open={more.open}
        onClose={more.hide}
        title={pkg.package_no}
        actions={[
          { label: t('rc_pk_print'), icon: Printer, onClick: () => { setJustSealed(false); setSheet('label'); }, hidden: open },
          { label: t('rc_pk_reopen'), icon: LockOpen, onClick: () => setSheet('reopen'), hidden: open || !isAssignable(pkg) },
          { label: t('rc_pk_next_package'), icon: PackagePlus, onClick: startNext, disabled: create.isPending },
          { label: t('rc_pk_delete'), icon: Trash2, danger: true, onClick: () => setSheet('delete'), hidden: !(open && pkg.parcel_count === 0) },
        ]}
      />

      <SealSheet open={sheet === 'seal'} onClose={() => setSheet(null)} pkg={pkg} pending={seal.isPending} onSeal={doSeal} />

      <PackageLabelSheet
        open={sheet === 'label'}
        onClose={() => setSheet(null)}
        pkg={pkg}
        banner={justSealed ? (
          <div className={cn('flex items-center gap-3 rounded-lg px-4 py-3', TONE_PILL.success)}>
            <Check className="h-5 w-5 shrink-0" />
            <p className={TYPE.bodyStrong}>{t('rc_pk_sealed_banner')}</p>
          </div>
        ) : undefined}
        footer={justSealed ? (
          <BigButton variant="soft" onClick={startNext} disabled={create.isPending}>{t('rc_pk_next_package')}</BigButton>
        ) : undefined}
      />

      <ConfirmSheet
        open={sheet === 'reopen'}
        onClose={() => setSheet(null)}
        title={ti('rc_pk_reopen_title', { no: pkg.package_no })}
        subtitle={t('rc_pk_reopen_hint')}
        confirmLabel={t('rc_pk_reopen')}
        cancelLabel={t('rc_cancel')}
        loading={reopen.isPending}
        onConfirm={doReopen}
      />
      <ConfirmSheet
        open={sheet === 'delete'}
        danger
        onClose={() => setSheet(null)}
        title={t('rc_pk_delete')}
        subtitle={pkg.package_no}
        confirmLabel={t('rc_pk_delete')}
        cancelLabel={t('rc_cancel')}
        loading={del.isPending}
        onConfirm={doDelete}
      />
    </div>
  );
}

/* ── Les colis prêts qui tiennent encore : « Ajouter », sans scanner. ── */
const READY_SHOWN = 8;

/**
 * Les colis avion du bureau prêts à emballer, qui tiennent encore dans ce
 * paquet — les clients déjà dedans en tête (on garde un client ensemble).
 * « Ajouter » passe par la même RPC que le scan : le serveur revérifie.
 */
function ReadyToAdd({ pkg, onAdded }: { pkg: AirPackage; onAdded: (parcelNo: string) => void }) {
  const { t } = useLanguage();
  const { t: ti } = useTranslation('agent');
  const tx = usePackageText();
  const labels = useReceptionLabels();
  const { data } = usePackableParcels();
  const add = useAddParcelToPackage(pkg.id);
  const fillAll = usePackParcels();
  const [pending, setPending] = useState<string | null>(null);
  const [more, setMore] = useState(false);

  const g = weightGauge(pkg);
  const { groups, fit, noRoom, best } = useMemo(() => {
    // Un colis tout juste ajouté reste dans la liste lue tant qu'elle ne s'est pas relue : on l'écarte ici.
    const inside = new Set((pkg.parcels ?? []).map((p) => p.id));
    const here = new Set((pkg.parcels ?? []).map((p) => p.client?.user_id).filter(Boolean) as string[]);
    const candidates = (data?.ready ?? []).filter((it) => !inside.has(it.parcel.id));
    const ok = candidates.filter((it) => fitsInPackage(pkg, it.parcel.weight_kg));
    // « Tout ajouter » : ce qui tient encore, les plus lourds d'abord (le même calcul que « Mettre en paquet »).
    const head = planPacking(ok, pkg)[0];
    return { groups: packableGroups(ok, here), fit: ok.length, noRoom: candidates.length - ok.length, best: head?.packageId === pkg.id ? head.items : [] };
  }, [data, pkg]);

  if (!data || (fit === 0 && noRoom === 0)) return null;
  // Les premiers colis seulement (client par client), tant qu'on ne demande pas la suite.
  let budget = more ? Infinity : READY_SHOWN;
  const shown = groups.map((grp) => {
    const items = grp.items.slice(0, Math.max(0, budget));
    budget -= items.length;
    return { ...grp, items };
  }).filter((grp) => grp.items.length > 0);

  const onFillAll = async () => {
    if (pending || fillAll.isPending || best.length === 0) return;
    setPending('all');
    try {
      const r = await fillAll.mutateAsync({ bins: [{ packageId: pkg.id, packageNo: pkg.package_no, parcelNos: best.map((it) => it.parcel.parcel_no) }] });
      const row = r.packages[0];
      if (row?.added.length) { onAdded(row.added[row.added.length - 1]); toast.success(ti('rc_pk_fill_done', { count: row.added.length, no: pkg.package_no })); }
      if (row?.refused.length) toast.error(row.refused[0].error, { description: row.refused.map((x) => x.parcel_no).join(', ') });
    } catch {
      // le hook dit le refus
    } finally {
      setPending(null);
    }
  };

  const onAdd = async (it: PackableParcel) => {
    if (pending) return;
    setPending(it.parcel.id);
    try {
      const r = await add.mutateAsync(it.parcel.parcel_no);
      onAdded(r.parcel_no);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(null);
    }
  };

  return (
    <section>
      <CapsLabel>{t('rc_pk_ready_title')}</CapsLabel>
      {/* Un geste pour remplir le carton avec ce qui tient encore. */}
      {best.length > 1 && (
        <BigButton variant="soft" className="mt-3" onClick={() => void onFillAll()} disabled={pending !== null}>
          {ti('rc_pk_fill_all', { count: best.length, kg: formatKg(sumParcelKg(best)) })}
        </BigButton>
      )}
      {shown.map((grp) => (
        <div key={grp.key}>
          <DayLabel className="px-0">
            {grp.client ? `${clientFullName(grp.client)} · ${grp.client.customer_code}` : t('rc_unknown_client')}
            {grp.inPackage && <span className={cn('ml-2', TONE_TEXT.success)}>· {t('rc_pk_ready_in_package')}</span>}
          </DayLabel>
          {grp.items.map((it) => (
            <ParcelLine
              key={it.parcel.id}
              parcel={it.parcel}
              subtitle={`${it.parcel.parcel_no} · ${formatKg(it.parcel.weight_kg)}`}
              title={it.parcel.description || labels.kind(it.parcel.kind as ParcelKind)}
              right={<RowButton disabled={pending !== null} onClick={() => void onAdd(it)}>{pending === it.parcel.id ? '…' : t('rc_pk_ready_add')}</RowButton>}
            />
          ))}
        </div>
      ))}
      {fit > READY_SHOWN && (
        <BigButton variant="soft" className="mt-3" onClick={() => setMore((m) => !m)}>{more ? t('rc_pk_ready_less') : ti('rc_pk_ready_more', { count: fit - READY_SHOWN })}</BigButton>
      )}
      {noRoom > 0 && <p className={cn('mt-3 tabular-nums text-[15px]', TEXT.muted)}>{ti('rc_pk_ready_no_room', { count: noRoom, left: tx.left(g) })}</p>}
    </section>
  );
}

/* ── Fermer le paquet : la pesée (obligatoire), les dimensions (facultatives). ── */
function SealSheet({ open, onClose, pkg, pending, onSeal }: { open: boolean; onClose: () => void; pkg: AirPackage; pending: boolean; onSeal: (v: SealInput) => void }) {
  const { t } = useLanguage();
  const { t: ti } = useTranslation('agent');
  const [gross, setGross] = useState('');
  const [dims, setDims] = useState<[string, string, string]>(['', '', '']);
  useEffect(() => { if (open) { setGross(''); setDims(['', '', '']); } }, [open]);

  const g = weightGauge(pkg);
  // Le même contrôle que l'ordinateur et que le serveur (air_package_seal), valeurs arrondies d'abord.
  const check = sealCheck(gross, dims, pkg);
  const grossError = check.grossError === 'required' ? t('rc_pk_gross_required')
    : check.grossError === 'over' ? ti('rc_pk_gross_over', { max: formatKg(g.max) })
    : check.grossError === 'under' ? ti('rc_pk_gross_under', { kg: formatKg(g.net) })
    : null;
  const dimsError = check.dimsError ? t('rc_pk_dims_invalid') : null;
  const valid = check.valid;

  const submit = () => {
    if (!check.input || pending) return;
    onSeal(check.input);
  };
  const dimLabels = [t('rc_pk_length'), t('rc_pk_width'), t('rc_pk_height')];

  return (
    <BottomSheet open={open} onClose={onClose} title={t('rc_pk_seal')}>
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="space-y-2">
          <CapsLabel as="label">{t('rc_pk_gross_label')}</CapsLabel>
          <UnitField big unit="kg" value={gross} onChange={(e) => setGross(e.target.value)} enterKeyHint="done" placeholder={String(Math.round(g.net * 10) / 10)} invalid={!!grossError && gross !== ''} aria-label={t('rc_pk_gross_label')} />
          <p className={cn('text-[15px]', grossError && gross !== '' ? 'text-[#900B09] dark:text-[#FCB3AD]' : TEXT.muted)}>{grossError && gross !== '' ? grossError : ti('rc_pk_gross_hint', { kg: formatKg(g.net), max: formatKg(g.max) })}</p>
        </div>
        <div className="space-y-2">
          <CapsLabel>{t('rc_pk_dims_label')}</CapsLabel>
          <div className="grid grid-cols-3 gap-2.5">
            {dimLabels.map((label, i) => (
              <UnitField key={label} unit="cm" value={dims[i]} onChange={(e) => setDims((d) => { const n = [...d] as [string, string, string]; n[i] = e.target.value; return n; })} placeholder="0" aria-label={label} />
            ))}
          </div>
          {dimsError && <p className="text-[15px] text-[#900B09] dark:text-[#FCB3AD]">{dimsError}</p>}
        </div>
        <BigButton type="submit" loading={pending} disabled={!valid || pending}>{t('rc_pk_seal_confirm')}</BigButton>
        <BigButton variant="soft" onClick={onClose}>{t('rc_cancel')}</BigButton>
      </form>
    </BottomSheet>
  );
}
