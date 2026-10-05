// ============================================================
// RÉCEPTION — Un paquet avion (32 kg au plus). En haut, la jauge : ce que
// pèsent ses colis, ce qu'il reste. Tant qu'il est ouvert, la boîte de scan
// est le geste : chaque étiquette de colis lue y entre (bip aigu) ou est
// refusée avec la raison du serveur (bip grave) ; trop lourd, on propose de
// le fermer et d'en commencer un autre. Les colis, rangés par client.
// En bas : fermer (pesée, dimensions, puis l'étiquette), rouvrir, imprimer,
// ou supprimer un paquet vide.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, LockOpen, PackageCheck, PackagePlus, Printer, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { parseDecimal } from '@/lib/decimalInput';
import { clientFullName, formatKg, type ParcelKind, type ReceptionClient } from '@/lib/reception';
import { isAssignable, weightGauge, type AirPackage, type AirPackageParcel } from '@/lib/airPackage';
import {
  PackageRpcError, useAddParcelToPackage, useAirPackage, useCreateAirPackage, useDeleteAirPackage,
  useRemoveParcelFromPackage, useReopenAirPackage, useSealAirPackage, type SealInput,
} from '@/hooks/useAirPackages';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { ParcelScanBox, type ScanResult } from '@/mobile/components/cargo/ParcelScanBox';
import { PackageLabelSheet } from '@/components/cargo/packages/PackageLabelSheet';
import { SURFACE, TEXT, TONE_PILL, TONE_TEXT, TYPE, BottomSheet, Button, Card, FormField, PrimaryPill, Row, ScreenError, ScreenLoader, SoftPill, StatusPill, TextInput } from '@/mobile/designKit';
import { formatDateTime, useReceptionLabels } from '@/mobile/components/reception/bits';
import { WeightBar } from '@/mobile/components/reception/packageBits';
import { GAUGE_TONE, usePackageText, useScanTexts } from '@/mobile/components/reception/packageText';

type Sheet = 'seal' | 'label' | 'reopen' | 'delete' | null;

/** Une fiche par paquet : passer d'un paquet à l'autre repart de zéro (scan, sélection). */
export function ReceptionPackage() {
  const { id = '' } = useParams<{ id: string }>();
  return <PackageScreen key={id} id={id} />;
}

function PackageScreen({ id }: { id: string }) {
  const navigate = useNavigate();
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

  const groups = useMemo(() => {
    const byClient = new Map<string, { client: ReceptionClient | null; parcels: AirPackageParcel[]; kg: number }>();
    for (const p of pkg?.parcels ?? []) {
      const k = p.client?.user_id ?? '—';
      const g = byClient.get(k) ?? { client: p.client, parcels: [], kg: 0 };
      g.parcels.push(p);
      g.kg += Number(p.weight_kg) || 0;
      byClient.set(k, g);
    }
    return [...byClient.values()];
  }, [pkg?.parcels]);

  if (isLoading) return <ScreenLoader className="min-h-[100dvh]" />;
  if (error || !pkg) return <ScreenError title={t('error')} description={(error as Error | null)?.message ?? t('rc_pk_not_found')} retryLabel={t('rc_retry')} onRetry={() => void refetch()} />;

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
    del.mutate(pkg.id, { onSuccess: () => navigate('/r/paquets', { replace: true }) });
  };
  const startNext = () => {
    if (create.isPending) return;
    create.mutate(undefined, { onSuccess: (p) => { setSheet(null); navigate(`/r/paquets/${p.id}`); } });
  };

  return (
    <div className={cn('flex h-[100dvh] flex-col', SURFACE.canvas)}>
      <MobileHeader title={pkg.package_no} subtitle={t('rc_pk_title')} showBack backTo="/r/paquets" />

      <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-6 pt-5">
        {/* La jauge : ce que pèsent les colis sur 32 kg, et ce qu'il reste. */}
        <Card className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={cn(TYPE.small, TEXT.muted)}>{t('rc_pk_net')}</p>
              <p className={cn('mt-1 whitespace-nowrap font-semibold leading-none tracking-[-0.02em] tabular-nums', TEXT.strong)}>
                <span className="text-[40px]">{formatKg(g.net)}</span>
                <span className={cn('ml-1 text-[20px] font-medium', TEXT.muted)}>/ {formatKg(g.max)}</span>
              </p>
            </div>
            <StatusPill tone={st.tone} label={st.label} />
          </div>
          <WeightBar gauge={g} neutral={!open} className="h-4" />
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 tabular-nums">
            <span className={cn(TYPE.body, TEXT.muted)}>{labels.parcels(pkg.parcel_count)} · {tx.clients(pkg.client_count)}</span>
            {open && <span className={cn(TYPE.lead, TONE_TEXT[GAUGE_TONE[g.tone]])}>{tx.left(g)}</span>}
          </div>
          {pkg.gross_weight_kg != null && (
            <div className={cn('divide-y border-t pt-1 dark:divide-[#444444]', SURFACE.divider, 'divide-[#D9D9D9]')}>
              <Row label={t('rc_pk_gross')} value={formatKg(pkg.gross_weight_kg)} />
              {pkg.length_cm != null && pkg.width_cm != null && pkg.height_cm != null && (
                <Row label={t('rc_pk_dims')} value={`${pkg.length_cm} × ${pkg.width_cm} × ${pkg.height_cm} cm`} />
              )}
              {pkg.sealed_at && <Row label={t('rc_pk_sealed_on')} value={formatDateTime(pkg.sealed_at)} />}
            </div>
          )}
        </Card>

        {pkg.status === 'refused' && (
          <div className={cn('space-y-1 rounded-lg px-4 py-3', TONE_PILL.danger)}>
            <p className={TYPE.bodyStrong}>{t('rc_pk_st_refused')}</p>
            {pkg.refusal_reason && <p className={cn('break-words', TYPE.body)}>{ti('rc_pk_refusal', { reason: pkg.refusal_reason })}</p>}
            <p className={TYPE.small}>{t('rc_pk_refused_hint')}</p>
          </div>
        )}

        {expedition && (
          <div className={cn('space-y-1 rounded-lg px-4 py-3', TONE_PILL.info)}>
            <p className={TYPE.bodyStrong}>{t('rc_pk_group_assigned')}</p>
            <p className={cn('break-words tabular-nums', TYPE.body)}>{expedition}</p>
            <p className={TYPE.small}>{t('rc_pk_assigned_hint')}</p>
          </div>
        )}

        {open && (
          <div className="space-y-3">
            {/* La douchette garde le champ, sauf quand une feuille est ouverte (pesée, étiquette). */}
            <ParcelScanBox onScan={onScan} placeholder={t('rc_pk_scan_ph')} texts={scanTexts} keepFocus={sheet === null} />
            {over && (
              <div className={cn('space-y-3 rounded-lg px-4 py-4', TONE_PILL.pending)}>
                <p className={TYPE.bodyStrong}>{t('rc_pk_over_hint')}</p>
                <PrimaryPill onClick={() => setSheet('seal')} disabled={busy || pkg.parcel_count === 0} className="h-12 w-full"><PackageCheck /> {t('rc_pk_seal_and_next')}</PrimaryPill>
              </div>
            )}
          </div>
        )}

        {/* Les colis, par client. */}
        <section className="space-y-3">
          <h2 className={cn(TYPE.lead, TEXT.strong)}>{t('rc_pk_parcels_by_client')}</h2>
          {groups.length === 0 ? (
            <Card className={cn('text-center', SURFACE.inset, 'border-0')}>
              <p className={cn(TYPE.body, TEXT.muted)}>{open ? t('rc_pk_empty_parcels') : '—'}</p>
            </Card>
          ) : (
            groups.map((grp) => (
              <Card key={grp.client?.user_id ?? '—'} className="py-0">
                <div className={cn('flex items-start justify-between gap-3 border-b py-3', SURFACE.divider)}>
                  <span className="min-w-0">
                    <span className={cn('block tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{grp.client?.customer_code ?? t('rc_unknown_client')}</span>
                    {grp.client && <span className={cn('block break-words', TYPE.small, TEXT.muted)}>{clientFullName(grp.client)}</span>}
                  </span>
                  <span className={cn('shrink-0 text-right tabular-nums', TYPE.smallStrong, TEXT.muted)}>{labels.parcels(grp.parcels.length)} · {formatKg(grp.kg)}</span>
                </div>
                {grp.parcels.map((p) => (
                  <div key={p.id} className={cn('-mx-4 flex items-center gap-3 border-b px-4 py-3 last:border-b-0 transition-colors', SURFACE.divider, p.parcel_no === lastAdded && 'bg-[#EBFFEE] dark:bg-[#02542D]/40')}>
                    <span className="min-w-0 flex-1">
                      <span className={cn('flex items-center gap-1.5 tabular-nums', TYPE.bodyStrong, TEXT.strong)}>
                        {p.parcel_no === lastAdded && <Check className="h-4 w-4 shrink-0 text-[#009951] dark:text-[#14AE5C]" aria-hidden="true" />}
                        {p.parcel_no}
                      </span>
                      <span className={cn('block break-words', TYPE.small, TEXT.muted)}>{p.description || labels.kind(p.kind as ParcelKind)}</span>
                    </span>
                    <span className={cn('shrink-0 tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{formatKg(p.weight_kg)}</span>
                    {open && (
                      <Button variant="neutral" onClick={() => remove.mutate(p.id)} disabled={remove.isPending} className="h-10 shrink-0 px-3 text-[15px]">
                        {t('rc_remove')}
                      </Button>
                    )}
                  </div>
                ))}
              </Card>
            ))
          )}
        </section>
      </div>

      {/* Les gestes, en bas : un seul principal selon l'état. */}
      <div className={cn('shrink-0 space-y-3 border-t px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4', SURFACE.canvas, SURFACE.divider)}>
        {open ? (
          pkg.parcel_count > 0 ? (
            <PrimaryPill onClick={() => setSheet('seal')} disabled={busy} className="h-14 w-full text-[17px]"><PackageCheck /> {t('rc_pk_seal')}</PrimaryPill>
          ) : (
            <Button variant="dangerSubtle" onClick={() => setSheet('delete')} disabled={busy} className="h-12 w-full"><Trash2 /> {t('rc_pk_delete')}</Button>
          )
        ) : (
          <>
            <PrimaryPill onClick={() => { setJustSealed(false); setSheet('label'); }} disabled={busy} className="h-14 w-full text-[17px]"><Printer /> {t('rc_pk_print')}</PrimaryPill>
            {isAssignable(pkg) && (
              <SoftPill onClick={() => setSheet('reopen')} disabled={busy} className="h-12 w-full"><LockOpen /> {t('rc_pk_reopen')}</SoftPill>
            )}
          </>
        )}
      </div>

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
          <SoftPill onClick={startNext} disabled={create.isPending} className="h-14 w-full text-[17px]"><PackagePlus /> {t('rc_pk_next_package')}</SoftPill>
        ) : undefined}
      />

      <BottomSheet open={sheet === 'reopen'} onClose={() => setSheet(null)} title={ti('rc_pk_reopen_title', { no: pkg.package_no })}>
        <div className="space-y-5">
          <p className={cn(TYPE.body, TEXT.muted)}>{t('rc_pk_reopen_hint')}</p>
          <PrimaryPill onClick={doReopen} loading={reopen.isPending} className="h-14 w-full text-[17px]"><LockOpen /> {t('rc_pk_reopen')}</PrimaryPill>
          <SoftPill onClick={() => setSheet(null)} className="h-12 w-full">{t('rc_cancel')}</SoftPill>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === 'delete'} onClose={() => setSheet(null)} title={t('rc_pk_delete')}>
        <div className="space-y-5">
          <p className={cn(TYPE.body, TEXT.muted)}>{ti('rc_pk_delete_hint', { no: pkg.package_no })}</p>
          <PrimaryPill danger onClick={doDelete} loading={del.isPending} className="h-14 w-full text-[17px]"><Trash2 /> {t('rc_pk_delete')}</PrimaryPill>
          <SoftPill onClick={() => setSheet(null)} className="h-12 w-full">{t('rc_cancel')}</SoftPill>
        </div>
      </BottomSheet>
    </div>
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
  const kg = parseDecimal(gross);
  const cm = dims.map((v) => (v.trim() ? parseDecimal(v) : null));
  const grossError = !gross.trim() ? null
    : !(kg > 0) ? t('rc_pk_gross_required')
    : kg > g.max ? ti('rc_pk_gross_over', { max: formatKg(g.max) })
    : kg < g.net - 0.5 ? ti('rc_pk_gross_under', { kg: formatKg(g.net) })
    : null;
  const dimsError = cm.some((v) => v != null && !(v > 0 && v <= 400)) ? t('rc_pk_dims_invalid') : null;
  const valid = gross.trim() !== '' && kg > 0 && !grossError && !dimsError;
  const round = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10);

  const submit = () => {
    if (!valid || pending) return;
    onSeal({ grossWeightKg: Math.round(kg * 100) / 100, lengthCm: round(cm[0]), widthCm: round(cm[1]), heightCm: round(cm[2]) });
  };
  const dimLabels = [t('rc_pk_length'), t('rc_pk_width'), t('rc_pk_height')];

  return (
    <BottomSheet open={open} onClose={onClose} title={t('rc_pk_seal')}>
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <p className={cn(TYPE.body, TEXT.muted)}>{t('rc_pk_seal_help')}</p>
        <FormField label={t('rc_pk_gross_label')} htmlFor="pk-gross" error={grossError} hint={ti('rc_pk_gross_hint', { kg: formatKg(g.net), max: formatKg(g.max) })}>
          <div className="relative">
            <TextInput
              id="pk-gross"
              value={gross}
              onChange={(e) => setGross(e.target.value)}
              inputMode="decimal"
              enterKeyHint="done"
              placeholder={String(Math.round(g.net * 10) / 10)}
              className="h-20 pr-16 text-[40px] font-semibold tabular-nums"
            />
            <span className={cn('pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[20px] font-semibold', TEXT.muted)}>kg</span>
          </div>
        </FormField>
        <FormField label={t('rc_pk_dims_label')} error={dimsError}>
          <div className="flex items-center gap-2">
            {dimLabels.map((label, i) => (
              <span key={label} className="contents">
                {i > 0 && <span className={cn('shrink-0 text-[18px]', TEXT.muted)} aria-hidden="true">×</span>}
                <TextInput
                  value={dims[i]}
                  onChange={(e) => setDims((d) => { const n = [...d] as [string, string, string]; n[i] = e.target.value; return n; })}
                  inputMode="decimal"
                  placeholder={label}
                  aria-label={label}
                  className="h-14 min-w-0 flex-1 text-center text-[18px] font-semibold tabular-nums"
                />
              </span>
            ))}
          </div>
        </FormField>
        <PrimaryPill type="submit" loading={pending} disabled={!valid || pending} className="h-14 w-full text-[17px]"><PackageCheck /> {t('rc_pk_seal_confirm')}</PrimaryPill>
        <SoftPill onClick={onClose} className="h-12 w-full">{t('rc_cancel')}</SoftPill>
      </form>
    </BottomSheet>
  );
}
