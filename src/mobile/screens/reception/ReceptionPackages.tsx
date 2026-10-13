// ============================================================
// RÉCEPTION — Onglet Paquets : les paquets avion du bureau (32 kg au plus
// chacun). Le geste principal suit le terrain : on prend son carton et on y
// met les colis disponibles — « Continuer PQ-… · reste X kg » s'il y a un
// paquet en cours (celui touché en dernier, le sien d'abord), sinon
// « Nouveau paquet ». Dessous, en une ligne, ce qui attend un paquet (→ la
// liste des colis à emballer, à cocher par client). Puis une boîte de scan
// pour rouvrir un paquet par son étiquette (PQ-…), et les paquets qui n'ont
// pas encore quitté le bureau, rangés par ce qu'il reste à en faire — qu'ils
// aient été ouverts ici ou depuis l'ordinateur. À l'entrepôt (bateau), un
// mot le dit : les paquets avion se font au bureau.
// L'app BONZINI HQ ouvre /r/paquets?code=PQ-… après un scan natif : on
// retrouve le paquet et on va droit à sa fiche.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, ListChecks, PackageOpen, PackagePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { formatKg } from '@/lib/reception';
import { packageQueue, parsePackageCode, sumParcelKg, waitingCount, weightGauge, type PackableParcel, type PackageQueue } from '@/lib/airPackage';
import { useAirPackages, useCreateAirPackage, useFindAirPackage, usePackableParcels } from '@/hooks/useAirPackages';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { ParcelScanBox, scanFeedback, type ScanResult } from '@/mobile/components/cargo/ParcelScanBox';
import { SURFACE, TEXT, TONE_PILL, TONE_TEXT, TYPE, Card, PrimaryPill, ScreenError, ScreenLoader, SoftPill } from '@/mobile/designKit';
import { PackageRow } from '@/mobile/components/reception/packageBits';
import { usePackageText, useScanTexts } from '@/mobile/components/reception/packageText';
import { useStillHere } from '@/mobile/components/reception/useReceptionBack';
import { useReceptionLocation } from './useReceptionLocation';

/** Une étiquette de colis (RC-000123-01) n'est pas un paquet, même si elle contenait « PQ ». */
const PARCEL_LABEL = /RC[^0-9]{0,3}\d{6}/i;

type GroupKey = Exclude<PackageQueue, 'gone'>;
const GROUPS: GroupKey[] = ['open', 'refused', 'ready', 'assigned'];

export function ReceptionPackages() {
  const navigate = useNavigate();
  const stillHere = useStillHere();
  const { t } = useLanguage();
  const { t: ti } = useTranslation('agent');
  const [params, setParams] = useSearchParams();
  const { data, isLoading, error, refetch } = useAirPackages('bureau');
  const create = useCreateAirPackage();
  const find = useFindAirPackage();
  const { currentUser } = useAdminAuth();
  const { location } = useReceptionLocation();
  const atOffice = location !== 'warehouse';
  const todo = usePackableParcels(atOffice);
  // Ce qui attend un paquet : prêts et à compléter — un colis de plus de 32 kg part seul, il ne compte pas.
  const count = todo.data ? waitingCount(todo.data) : null;
  const scanTexts = useScanTexts(t('rc_pk_find_hint'));
  const tx = usePackageText();
  const [codeError, setCodeError] = useState<string | null>(null);

  const groupTitle: Record<GroupKey, string> = {
    open: t('rc_pk_group_open'),
    refused: t('rc_pk_group_refused'),
    ready: t('rc_pk_group_ready'),
    assigned: t('rc_pk_group_assigned'),
  };
  // Le paquet à continuer : celui touché en dernier, le mien d'abord.
  const current = useMemo(() => {
    const open = (data ?? []).filter((p) => p.status === 'open');
    const pool = open.some((p) => p.created_by === currentUser?.id) ? open.filter((p) => p.created_by === currentUser?.id) : open;
    return [...pool].sort((a, b) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0))[0] ?? null;
  }, [data, currentUser?.id]);
  const groups = useMemo(
    () => GROUPS.map((key) => ({ key, items: (data ?? []).filter((p) => packageQueue(p) === key) })).filter((g) => g.items.length > 0),
    [data],
  );

  /** Un code lu ou tapé → la fiche du paquet. `replace` : on vient d'un lien (?code=), pas d'un geste. */
  const openCode = async (text: string, replace = false): Promise<ScanResult> => {
    const code = PARCEL_LABEL.test(text) ? null : parsePackageCode(text);
    if (!code) return { outcome: 'unknown', text: PARCEL_LABEL.test(text) ? t('rc_pk_is_parcel') : t('rc_pk_not_package') };
    try {
      const pkg = await find.mutateAsync(code);
      setCodeError(null);
      if (stillHere()) navigate(`/r/paquets/${pkg.id}`, { replace }); // l'onglet quitté pendant la recherche : on n'y revient pas
      return { outcome: 'ok', text: ti('rc_pk_opening', { no: pkg.package_no }) };
    } catch (e) {
      return { outcome: 'refused', text: `${code} · ${(e as Error).message}` };
    }
  };

  // ?code=PQ-… (scan natif de l'app HQ) : une seule fois par code, puis le lien s'efface.
  const code = params.get('code');
  const handled = useRef<string | null>(null);
  useEffect(() => {
    // Le lien effacé (après un échec) réarme : un nouveau scan du même code se retente.
    if (!code) { handled.current = null; return; }
    if (handled.current === code) return;
    handled.current = code;
    void openCode(code, true).then((r) => {
      if (r.outcome === 'ok') return;
      scanFeedback(r.outcome);
      setCodeError(r.text);
      setParams({}, { replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const onCreate = () => {
    if (create.isPending) return;
    create.mutate(undefined, { onSuccess: (pkg) => navigate(`/r/paquets/${pkg.id}`) });
  };

  return (
    <div className={cn('min-h-[100dvh]', SURFACE.canvas)}>
      <MobileHeader title={t('rc_pk_title')} subtitle={t('rc_pk_subtitle')} alignStart />
      <div className="space-y-6 px-5 pb-8 pt-5">
        {!atOffice ? (
          <p className={cn('rounded-lg px-4 py-3', TYPE.body, TONE_PILL.info)}>{t('rc_pk_warehouse_note')}</p>
        ) : (
          <div className="space-y-3">
            {/* Le geste principal : continuer le carton en cours, sinon en ouvrir un. */}
            {current ? (
              <>
                <PrimaryPill onClick={() => navigate(`/r/paquets/${current.id}`)} ariaLabel={ti('rc_pk_continue', { no: current.package_no, left: formatKg(weightGauge(current).left) })} className="h-auto min-h-16 w-full py-2.5 text-[18px] [&_svg]:h-6 [&_svg]:w-6">
                  <PackageOpen />
                  <span className="flex flex-col items-start leading-tight">
                    <span className="tabular-nums">{ti('rc_pk_continue_no', { no: current.package_no })}</span>
                    <span className="text-[14px] font-medium tabular-nums opacity-80">{tx.left(weightGauge(current))}</span>
                  </span>
                </PrimaryPill>
                <SoftPill onClick={onCreate} disabled={create.isPending} className="h-12 w-full"><PackagePlus /> {t('rc_pk_new')}</SoftPill>
              </>
            ) : (
              <PrimaryPill onClick={onCreate} loading={create.isPending} disabled={create.isPending} className="h-16 w-full text-[18px] [&_svg]:h-6 [&_svg]:w-6">
                <PackagePlus /> {t('rc_pk_new')}
              </PrimaryPill>
            )}
            {/* Ce qui attend un paquet, en une ligne : la liste à cocher, par client. */}
            {todo.data && count && count.total > 0 && (
              <TodoLine ready={todo.data.ready} toFix={count.toFix} onOpen={() => navigate('/r/paquets/emballer')} />
            )}
          </div>
        )}

        <div className="space-y-2">
          <ParcelScanBox onScan={(text) => openCode(text)} placeholder={t('rc_pk_find_ph')} texts={scanTexts} keepFocus={false} />
          {codeError && <p role="alert" className={cn('rounded-lg px-4 py-2.5', TYPE.bodyStrong, TONE_PILL.danger)}>{codeError}</p>}
        </div>

        {isLoading ? (
          <ScreenLoader />
        ) : error ? (
          <ScreenError title={t('error')} description={(error as Error).message} retryLabel={t('rc_retry')} onRetry={() => void refetch()} />
        ) : groups.length === 0 ? (
          <Card className={cn('text-center', SURFACE.inset, 'border-0')}>
            <p className={cn(TYPE.body, TEXT.muted)}>{t('rc_pk_empty')}</p>
          </Card>
        ) : (
          groups.map((g) => {
            const kg = g.items.reduce((s, p) => s + (Number(p.gross_weight_kg ?? p.net_weight_kg) || 0), 0);
            return (
              <section key={g.key}>
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 className={cn(TYPE.lead, g.key === 'refused' ? 'text-[#C00F0C] dark:text-[#FCB3AD]' : TEXT.strong)}>{groupTitle[g.key]}</h2>
                  <span className={cn('shrink-0 tabular-nums', TYPE.smallStrong, TEXT.muted)}>{g.items.length} · {formatKg(kg)}</span>
                </div>
                <Card className="py-0 [&>*]:border-b [&>*]:border-[#D9D9D9] [&>*:last-child]:border-b-0 dark:[&>*]:border-[#444444]">
                  {g.items.map((p) => <PackageRow key={p.id} pkg={p} onClick={() => navigate(`/r/paquets/${p.id}`)} />)}
                </Card>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}

/** Ce qui attend un paquet, en une ligne : combien, quels kilos, combien à compléter — et la liste. */
function TodoLine({ ready, toFix, onOpen }: { ready: PackableParcel[]; toFix: number; onOpen: () => void }) {
  const { t: ti } = useTranslation('agent');
  const tx = usePackageText();
  const clients = new Set(ready.map((it) => it.deposit.client?.user_id)).size;
  return (
    <button type="button" onClick={onOpen} className={cn('flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left', SURFACE.card, SURFACE.shadow, 'active:bg-[#F5F5F5] dark:active:bg-[#383838]')}>
      <ListChecks className={cn('h-6 w-6 shrink-0', TEXT.strong)} />
      <span className="min-w-0 flex-1">
        <span className={cn('block tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{ti('rc_pk_todo_count', { count: ready.length + toFix })}</span>
        <span className={cn('block tabular-nums', TYPE.small, TEXT.muted)}>
          {ready.length > 0 && `${formatKg(sumParcelKg(ready))} · ${tx.clients(clients)}`}
          {toFix > 0 && <span className={TONE_TEXT.pending}>{ready.length > 0 ? ' · ' : ''}{ti('rc_pk_todo_blocked_count', { count: toFix })}</span>}
        </span>
      </span>
      <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
    </button>
  );
}
