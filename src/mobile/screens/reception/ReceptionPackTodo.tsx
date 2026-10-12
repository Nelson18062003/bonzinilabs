// ============================================================
// RÉCEPTION — Colis à emballer : les colis avion du bureau qui ne sont dans
// aucun paquet, rangés par client (on garde les colis d'un client ensemble).
// On touche les colis (ou un client entier), puis « Mettre en paquet » : le
// paquet en cours est proposé d'office, le reste se découpe tout seul en
// paquets de 32 kg (PackSheet). Dessous, ce qui n'est pas encore prêt, avec
// quoi faire : attribuer le dépôt, peser le colis.
// Lecture : air_package_packable (canReceiveParcels).
// ============================================================
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, PackagePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { clientFullName, formatKg, type ParcelKind } from '@/lib/reception';
import { packableGroups, sumParcelKg } from '@/lib/airPackage';
import { usePackableParcels } from '@/hooks/useAirPackages';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { SURFACE, TEXT, TONE_TEXT, TYPE, Button, Card, PrimaryPill, ScreenError, ScreenLoader } from '@/mobile/designKit';
import { useReceptionLabels } from '@/mobile/components/reception/bits';
import { TickBox } from '@/mobile/components/reception/packageBits';
import { usePackFix, usePackageText } from '@/mobile/components/reception/packageText';
import { useReceptionBack } from '@/mobile/components/reception/useReceptionBack';
import { PackSheet } from '@/mobile/components/reception/PackSheet';

const ROW = cn('flex w-full items-center gap-3 border-b px-4 py-3 text-left last:border-b-0 active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.divider);

export function ReceptionPackTodo() {
  const navigate = useNavigate();
  const back = useReceptionBack();
  const { t } = useLanguage();
  const { t: ti } = useTranslation('agent');
  const tx = usePackageText();
  const labels = useReceptionLabels();
  const { data, isLoading, error, refetch } = usePackableParcels();
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [sheet, setSheet] = useState(false);

  const ready = useMemo(() => data?.ready ?? [], [data]);
  const groups = useMemo(() => packableGroups(ready), [ready]);
  // La sélection ne garde que ce qui est encore prêt (un colis emballé ailleurs entre-temps en sort).
  const chosen = useMemo(() => ready.filter((it) => picked.has(it.parcel.id)), [ready, picked]);
  const all = ready.length > 0 && chosen.length === ready.length;

  const toggle = (ids: string[]) => setPicked((cur) => {
    const s = new Set(cur);
    const every = ids.every((id) => s.has(id));
    for (const id of ids) { if (every) s.delete(id); else s.add(id); }
    return s;
  });

  const fixPath = usePackFix();
  // À compléter (attribuer, peser, terminer le dépôt) ; à part, les plus de 32 kg, qui partent seuls.
  const toFix = useMemo(() => (data?.blocked ?? []).filter((b) => b.reason !== 'too_heavy'), [data]);
  const alone = useMemo(() => (data?.blocked ?? []).filter((b) => b.reason === 'too_heavy'), [data]);

  return (
    <div className={cn('flex h-[100dvh] flex-col', SURFACE.canvas)}>
      <MobileHeader title={t('rc_pk_todo_title')} subtitle={t('rc_pk_subtitle')} showBack onBack={() => back('/r/paquets')} />

      <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-6 pt-5">
        {isLoading ? (
          <ScreenLoader />
        ) : error || !data ? (
          <ScreenError title={t('error')} description={t('rc_pk_todo_unavailable')} retryLabel={t('rc_retry')} onRetry={() => void refetch()} />
        ) : ready.length === 0 && toFix.length === 0 && alone.length === 0 ? (
          <Card className={cn('text-center', SURFACE.inset, 'border-0')}>
            <p className={cn(TYPE.body, TEXT.muted)}>{t('rc_pk_todo_empty')}</p>
          </Card>
        ) : (
          <>
            {ready.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <h2 className={cn(TYPE.lead, TEXT.strong)}>{t('rc_pk_todo_ready')}</h2>
                    <span className={cn('block tabular-nums', TYPE.small, TEXT.muted)}>{labels.parcels(ready.length)} · {formatKg(sumParcelKg(ready))} · {tx.clients(groups.length)}</span>
                  </span>
                  <Button variant="neutral" onClick={() => setPicked(all ? new Set() : new Set(ready.map((it) => it.parcel.id)))} className="h-11 shrink-0 px-4">
                    {all ? t('rc_pk_todo_none') : t('rc_pk_todo_all')}
                  </Button>
                </div>
                {groups.map((g) => {
                  const ids = g.items.map((it) => it.parcel.id);
                  const n = ids.filter((id) => picked.has(id)).length;
                  return (
                    <Card key={g.key} className="overflow-hidden p-0">
                      <button type="button" role="checkbox" aria-checked={n === 0 ? false : n === ids.length ? true : 'mixed'} onClick={() => toggle(ids)} className={cn(ROW, SURFACE.inset)}>
                        <TickBox on={n === ids.length} mixed={n > 0 && n < ids.length} />
                        <span className="min-w-0 flex-1">
                          <span className={cn('block tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{g.client?.customer_code ?? t('rc_unknown_client')}</span>
                          {g.client && <span className={cn('block break-words', TYPE.small, TEXT.muted)}>{clientFullName(g.client)}</span>}
                        </span>
                        <span className={cn('shrink-0 text-right tabular-nums', TYPE.smallStrong, TEXT.muted)}>{labels.parcels(g.items.length)}<span className="block">{formatKg(g.kg)}</span></span>
                      </button>
                      {g.items.map((it) => (
                        <button key={it.parcel.id} type="button" role="checkbox" aria-checked={picked.has(it.parcel.id)} onClick={() => toggle([it.parcel.id])} className={ROW}>
                          <TickBox on={picked.has(it.parcel.id)} />
                          <span className="min-w-0 flex-1">
                            <span className={cn('block tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{it.parcel.parcel_no}</span>
                            <span className={cn('block break-words', TYPE.small, TEXT.muted)}>{it.parcel.description || labels.kind(it.parcel.kind as ParcelKind)}</span>
                          </span>
                          <span className={cn('shrink-0 tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{formatKg(it.parcel.weight_kg)}</span>
                        </button>
                      ))}
                    </Card>
                  );
                })}
              </section>
            )}

            {toFix.length > 0 && (
              <section className="space-y-3">
                <span className="block">
                  <h2 className={cn(TYPE.lead, TEXT.strong)}>{t('rc_pk_todo_blocked')}</h2>
                  <span className={cn('block', TYPE.small, TEXT.muted)}>{t('rc_pk_todo_blocked_hint')}</span>
                </span>
                <Card className="overflow-hidden p-0">
                  {toFix.map((it) => {
                    const path = fixPath(it);
                    const body = (
                      <>
                        <span className="min-w-0 flex-1">
                          <span className={cn('block tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{it.parcel.parcel_no}</span>
                          <span className={cn('block break-words', TYPE.smallStrong, TONE_TEXT.pending)}>{tx.why(it.reason)}</span>
                          <span className={cn('block break-words tabular-nums', TYPE.small, TEXT.muted)}>{it.deposit.client?.customer_code ?? t('rc_unknown_client')} · {it.deposit.deposit_no}</span>
                          {!path && it.deposit.received_by_name && <span className={cn('block break-words', TYPE.small, TEXT.muted)}>{ti('rc_pk_todo_by', { name: it.deposit.received_by_name })}</span>}
                        </span>
                        <span className={cn('shrink-0 tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{formatKg(it.parcel.weight_kg)}</span>
                        {path && <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} aria-hidden="true" />}
                      </>
                    );
                    return path
                      ? <button key={it.parcel.id} type="button" onClick={() => navigate(path)} className={ROW}>{body}</button>
                      : <div key={it.parcel.id} className={cn(ROW, 'active:bg-transparent dark:active:bg-transparent')}>{body}</div>;
                  })}
                </Card>
              </section>
            )}

            {alone.length > 0 && (
              <section className="space-y-3">
                <span className="block">
                  <h2 className={cn(TYPE.lead, TEXT.strong)}>{t('rc_pk_todo_alone')}</h2>
                  <span className={cn('block', TYPE.small, TEXT.muted)}>{t('rc_pk_todo_alone_hint')}</span>
                </span>
                <Card className="overflow-hidden p-0">
                  {alone.map((it) => (
                    <div key={it.parcel.id} className={cn(ROW, 'active:bg-transparent dark:active:bg-transparent')}>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{it.parcel.parcel_no}</span>
                        <span className={cn('block break-words tabular-nums', TYPE.small, TEXT.muted)}>{it.deposit.client?.customer_code ?? t('rc_unknown_client')} · {it.deposit.deposit_no}</span>
                      </span>
                      <span className={cn('shrink-0 tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{formatKg(it.parcel.weight_kg)}</span>
                    </div>
                  ))}
                </Card>
              </section>
            )}

            {data.truncated && <p className={cn('text-center', TYPE.small, TEXT.muted)}>{t('rc_pk_todo_truncated')}</p>}
          </>
        )}
      </div>

      {/* Ce qui est choisi, et le seul geste : le mettre en paquet. */}
      {ready.length > 0 && (
        <div className={cn('shrink-0 space-y-2 border-t px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3', SURFACE.canvas, SURFACE.divider)}>
          <p className={cn('text-center tabular-nums', TYPE.smallStrong, chosen.length > 0 ? TEXT.strong : TEXT.muted)}>
            {chosen.length > 0 ? `${labels.parcels(chosen.length)} · ${formatKg(sumParcelKg(chosen))}` : t('rc_pk_todo_pick')}
          </p>
          <PrimaryPill onClick={() => setSheet(true)} disabled={chosen.length === 0} className="h-14 w-full text-[17px]">
            <PackagePlus /> {t('rc_pk_pack')}
          </PrimaryPill>
        </div>
      )}

      <PackSheet open={sheet} onClose={() => setSheet(false)} items={chosen} onDone={() => setPicked(new Set())} />
    </div>
  );
}
