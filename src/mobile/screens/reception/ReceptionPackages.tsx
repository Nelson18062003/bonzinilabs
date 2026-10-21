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
import { Package, Plus, ScanLine, Tag as TagIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { formatKg } from '@/lib/reception';
import { packageKg, packageQueue, parsePackageCode, waitingCount, weightGauge, type AirPackage, type PackageQueue } from '@/lib/airPackage';
import { useAirPackages, useCreateAirPackage, useFindAirPackage, usePackableParcels } from '@/hooks/useAirPackages';
import { ParcelScanBox, scanFeedback, type ScanResult } from '@/mobile/components/cargo/ParcelScanBox';
import { BigButton, DayLabel, EmptyLine, FOCUS_RING, IconCircle, ItemList, ItemRow, RoundButton, ScreenLoader, SectionHead, SURFACE, TabTop, TEXT, TONE_PILL, TYPE } from '@/mobile/designKit';
import { InkProgress } from '@/mobile/components/cargo/v2';
import { ShipSheet } from '@/mobile/components/cargo/ShipSheet';
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
  const [scanOpen, setScanOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const { hasPermission } = useAdminAuth();
  const canShip = hasPermission('canViewCargo');

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

  const ready = groups.find((g) => g.key === 'ready')?.items ?? [];
  const others = groups.filter((g) => g.key !== 'ready' && g.key !== 'open');
  const g = current ? weightGauge(current) : null;
  const row = (p: AirPackage) => {
    const st = tx.status(p.status);
    return (
      <ItemRow
        key={p.id}
        leading={<IconCircle icon={p.status === 'open' ? Package : TagIcon} />}
        title={p.package_no}
        subtitle={`${formatKg(packageKg(p))} · ${ti('rc_n_parcels', { count: p.parcel_count })} · ${tx.clients(p.client_count)}`}
        tag={{ tone: st.tone === 'info' ? 'neutral' : st.tone, label: st.label }}
        onClick={() => navigate(`/r/paquets/${p.id}`)}
      />
    );
  };

  return (
    <div className={cn('min-h-[100dvh] pb-6', SURFACE.canvas)}>
      <TabTop title={t('rc_tab_packages')} right={<RoundButton icon={ScanLine} ariaLabel={t('rc_pk_find_ph')} onClick={() => setScanOpen((v) => !v)} />} />

      {(scanOpen || codeError) && (
        <div className="space-y-2 px-5 pt-2">
          <ParcelScanBox onScan={(text) => openCode(text)} placeholder={t('rc_pk_find_ph')} texts={scanTexts} keepFocus={false} />
          {codeError && <p role="alert" className={cn('rounded-lg px-4 py-2.5', TYPE.bodyStrong, TONE_PILL.danger)}>{codeError}</p>}
        </div>
      )}

      {!atOffice ? (
        <p className={cn('mx-5 mt-3 rounded-lg px-4 py-3 text-[16px]', TONE_PILL.info)}>{t('rc_pk_warehouse_note')}</p>
      ) : (
        <>
          {/* Le carton en cours : ce qu'il pèse sur ses 32 kg. Un toucher, et on le remplit. */}
          {current && g && (
            <div className="px-5 pt-3.5">
              <button type="button" onClick={() => navigate(`/r/paquets/${current.id}`)} className={cn('block w-full rounded-lg border border-[#D9D9D9] px-[18px] pb-4 pt-[18px] text-left active:bg-[#F5F5F5] dark:border-[#444444] dark:active:bg-[#383838]', FOCUS_RING)}>
                <span className={cn('block text-[16px] font-medium tabular-nums', TEXT.muted)}>{current.package_no} · {t('rc_pk_st_open').toLowerCase()}</span>
                <span className={cn('mt-1.5 block text-[40px] font-bold leading-[1.1] tracking-[-0.02em] tabular-nums', TEXT.strong)}>
                  {g.net.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}
                  <span className={cn('ml-1.5 text-[20px] font-semibold', TEXT.muted)}>/ {g.max} kg</span>
                </span>
                <InkProgress className="mt-3" value={g.net} max={g.max} label={t('rc_pk_net')} />
                <span className={cn('mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[16px] font-medium tabular-nums', TEXT.body)}>
                  <span><b className="font-bold">{current.parcel_count}</b> {t('rc_parcels').toLowerCase()}</span>
                  <span>{tx.clients(current.client_count)}</span>
                  <span>{tx.left(g)}</span>
                </span>
              </button>
            </div>
          )}
          <ItemList className="pt-2">
            {todo.data && count && count.total > 0 && (
              <ItemRow leading={<IconCircle icon={Package} />} title={ti('rc_pk_todo_count', { count: count.total })} subtitle={t('rc_v2_pick_and_pack')} onClick={() => navigate('/r/paquets/emballer')} chevron />
            )}
            <ItemRow leading={<IconCircle icon={Plus} />} title={t('rc_pk_new')} onClick={create.isPending ? undefined : onCreate} chevron />
          </ItemList>
        </>
      )}

      {isLoading ? <ScreenLoader /> : error ? (
        <EmptyLine action={{ label: t('rc_retry'), onClick: () => void refetch() }}>{(error as Error).message}</EmptyLine>
      ) : (
        <>
          <SectionHead title={t('rc_v2_closed_ready')} link={others.length > 0 ? { label: showAll ? t('rc_v2_less') : t('rc_v2_all'), onClick: () => setShowAll((v) => !v) } : undefined} />
          {ready.length === 0 ? <EmptyLine>{t('rc_pk_empty')}</EmptyLine> : <ItemList>{ready.map(row)}</ItemList>}
          {atOffice && canShip && ready.length > 0 && (
            <div className="px-5 pt-5">
              <BigButton onClick={() => setShipOpen(true)}>{t('rc_v2_put_on_flight')} · {ti('rc_v2_n_packages', { count: ready.length })}</BigButton>
            </div>
          )}
          {showAll && others.map((gr) => (
            <div key={gr.key}>
              <DayLabel className={gr.key === 'refused' ? 'text-[#C00F0C] dark:text-[#FCB3AD]' : undefined}>{groupTitle[gr.key]}</DayLabel>
              <ItemList>{gr.items.map(row)}</ItemList>
            </div>
          ))}
        </>
      )}

      {canShip && <ShipSheet open={shipOpen} onClose={() => setShipOpen(false)} />}
    </div>
  );
}
