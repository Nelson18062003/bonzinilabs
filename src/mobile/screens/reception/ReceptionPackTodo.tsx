// ============================================================
// RÉCEPTION — Colis à emballer : les colis avion du bureau qui ne sont dans
// aucun paquet, rangés par client (on garde les colis d'un client ensemble).
// On touche les colis (ou un client entier), puis « Mettre en paquet » : le
// paquet en cours est proposé d'office, le reste se découpe tout seul en
// paquets de 32 kg (PackSheet). Dessous, ce qui n'est pas encore prêt, avec
// quoi faire : attribuer le dépôt, peser le colis.
// Lecture : air_package_packable (canReceiveParcels).
// Refonte v2 (gabarit 10/39) : les colis par client, avec leur photo et une
// case ; « Mettre N colis en paquet · X kg » en bas.
// ============================================================
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { clientFullName, formatKg, type ParcelKind } from '@/lib/reception';
import { packableGroups, sumParcelKg } from '@/lib/airPackage';
import { usePackableParcels } from '@/hooks/useAirPackages';
import { BigButton, Dock, EmptyLine, ScreenLoader, ScreenTop, SURFACE, TEXT, TONE_TEXT } from '@/mobile/designKit';
import { ParcelLine, useReceptionLabels } from '@/mobile/components/reception/bits';
import { CapsLabel, RowButton } from '@/mobile/components/cargo/v2';
import { TickBox } from '@/mobile/components/reception/packageBits';
import { usePackFix, usePackageText } from '@/mobile/components/reception/packageText';
import { useReceptionBack } from '@/mobile/components/reception/useReceptionBack';
import { PackSheet } from '@/mobile/components/reception/PackSheet';

export function ReceptionPackTodo() {
  const navigate = useNavigate();
  const back = useReceptionBack();
  const { t } = useLanguage();
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

  const fixFor = usePackFix();
  // À compléter (attribuer, peser, terminer le dépôt) ; à part, les plus de 32 kg, qui partent seuls.
  const toFix = useMemo(() => (data?.blocked ?? []).filter((b) => b.reason !== 'too_heavy'), [data]);
  const alone = useMemo(() => (data?.blocked ?? []).filter((b) => b.reason === 'too_heavy'), [data]);

  const head = (label: string) => <CapsLabel as="h2" className="pt-5">{label}</CapsLabel>;
  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <ScreenTop
        title={t('rc_pk_todo_title')}
        onBack={() => back('/r/paquets')}
        right={ready.length > 0 ? <RowButton link onClick={() => setPicked(all ? new Set() : new Set(ready.map((it) => it.parcel.id)))}>{all ? t('rc_pk_todo_none') : t('rc_pk_todo_all')}</RowButton> : undefined}
      />

      <div className="flex-1 px-5 pb-6">
        {isLoading ? <ScreenLoader /> : error || !data ? (
          <EmptyLine action={{ label: t('rc_retry'), onClick: () => void refetch() }}>{t('rc_pk_todo_unavailable')}</EmptyLine>
        ) : ready.length === 0 && toFix.length === 0 && alone.length === 0 ? (
          <EmptyLine>{t('rc_pk_todo_empty')}</EmptyLine>
        ) : (
          <>
            {groups.map((g) => {
              const ids = g.items.map((it) => it.parcel.id);
              const n = ids.filter((id) => picked.has(id)).length;
              return (
                <section key={g.key}>
                  {/* Toucher le client coche tous ses colis. */}
                  <button type="button" role="checkbox" aria-checked={n === 0 ? false : n === ids.length ? true : 'mixed'} onClick={() => toggle(ids)} className="flex min-h-11 w-full items-center gap-3 pt-5 text-left">
                    <TickBox on={n === ids.length} mixed={n > 0 && n < ids.length} />
                    <CapsLabel as="h2" className="min-w-0 flex-1 truncate">{g.client ? clientFullName(g.client) : t('rc_unknown_client')} · {labels.parcels(g.items.length)}</CapsLabel>
                    <span className={cn('shrink-0 text-[15px] font-semibold tabular-nums', TEXT.muted)}>{formatKg(g.kg)}</span>
                  </button>
                  {g.items.map((it) => (
                      <ParcelLine
                        key={it.parcel.id}
                        parcel={it.parcel}
                        leading={<TickBox on={picked.has(it.parcel.id)} />}
                        title={it.parcel.parcel_no}
                        subtitle={`${it.parcel.description || labels.kind(it.parcel.kind as ParcelKind)} · ${formatKg(it.parcel.weight_kg)}`}
                        onClick={() => toggle([it.parcel.id])}
                        showVolume={false}
                      />
                  ))}
                </section>
              );
            })}

            {toFix.length > 0 && (
              <section>
                {head(t('rc_pk_todo_blocked'))}
                {toFix.map((it) => {
                  const { path, note } = fixFor(it);
                  return (
                    <ParcelLine
                      key={it.parcel.id}
                      parcel={it.parcel}
                      title={it.parcel.parcel_no}
                      subtitle={<><span className={TONE_TEXT.pending}>{tx.why(it.reason)}</span>{note ? ` · ${note}` : ` · ${it.deposit.client?.customer_code ?? t('rc_unknown_client')}`}</>}
                      onClick={path ? () => navigate(path) : undefined}
                      right={path ? <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} aria-hidden="true" /> : undefined}
                      showVolume={false}
                    />
                  );
                })}
              </section>
            )}

            {alone.length > 0 && (
              <section>
                {head(t('rc_pk_todo_alone'))}
                {alone.map((it) => (
                  <ParcelLine key={it.parcel.id} parcel={it.parcel} title={it.parcel.parcel_no} subtitle={`${it.deposit.client?.customer_code ?? t('rc_unknown_client')} · ${formatKg(it.parcel.weight_kg)}`} showVolume={false} />
                ))}
              </section>
            )}

            {data.truncated && <p className={cn('pt-4 text-center text-[15px]', TEXT.muted)}>{t('rc_pk_todo_truncated')}</p>}
          </>
        )}
      </div>

      {/* Le seul geste : mettre en paquet ce qui est coché. */}
      {ready.length > 0 && (
        <Dock>
          <BigButton onClick={() => setSheet(true)} disabled={chosen.length === 0}>
            {chosen.length > 0 ? `${t('rc_pk_pack')} · ${labels.parcels(chosen.length)} · ${formatKg(sumParcelKg(chosen))}` : t('rc_pk_todo_pick')}
          </BigButton>
        </Dock>
      )}

      <PackSheet open={sheet} onClose={() => setSheet(false)} items={chosen} onDone={() => setPicked(new Set())} />
    </div>
  );
}
