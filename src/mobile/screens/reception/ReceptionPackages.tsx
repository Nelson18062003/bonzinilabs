// ============================================================
// RÉCEPTION — Les paquets avion du bureau (32 kg au plus chacun). Un geste
// principal : « Nouveau paquet ». Dessous, une boîte de scan pour rouvrir un
// paquet par son étiquette (PQ-…), puis les paquets qui n'ont pas encore
// quitté le bureau, rangés par ce qu'il reste à en faire : en cours,
// refusés à l'aéroport, fermés et prêts, affectés à une expédition.
// L'app BONZINI HQ ouvre /r/paquets?code=PQ-… après un scan natif : on
// retrouve le paquet et on va droit à sa fiche.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PackagePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { formatKg } from '@/lib/reception';
import { parsePackageCode, type AirPackage } from '@/lib/airPackage';
import { useAirPackages, useCreateAirPackage, useFindAirPackage } from '@/hooks/useAirPackages';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { ParcelScanBox, scanFeedback, type ScanResult } from '@/mobile/components/cargo/ParcelScanBox';
import { SURFACE, TEXT, TONE_PILL, TYPE, Card, PrimaryPill, ScreenError, ScreenLoader } from '@/mobile/designKit';
import { PackageRow } from '@/mobile/components/reception/packageBits';
import { useScanTexts } from '@/mobile/components/reception/packageText';

/** Une étiquette de colis (RC-000123-01) n'est pas un paquet, même si elle contenait « PQ ». */
const PARCEL_LABEL = /RC[^0-9]{0,3}\d{6}/i;

type GroupKey = 'open' | 'refused' | 'ready' | 'assigned';
const GROUPS: { key: GroupKey; test: (p: AirPackage) => boolean }[] = [
  { key: 'open', test: (p) => p.status === 'open' },
  { key: 'refused', test: (p) => p.status === 'refused' },
  { key: 'ready', test: (p) => p.status === 'sealed' && !p.air_shipment_id },
  { key: 'assigned', test: (p) => (p.status === 'sealed' || p.status === 'handed_over') && !!p.air_shipment_id },
];

export function ReceptionPackages() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { t: ti } = useTranslation('agent');
  const [params, setParams] = useSearchParams();
  const { data, isLoading, error, refetch } = useAirPackages('bureau');
  const create = useCreateAirPackage();
  const find = useFindAirPackage();
  const scanTexts = useScanTexts(t('rc_pk_find_hint'));
  const [codeError, setCodeError] = useState<string | null>(null);

  const groupTitle: Record<GroupKey, string> = {
    open: t('rc_pk_group_open'),
    refused: t('rc_pk_group_refused'),
    ready: t('rc_pk_group_ready'),
    assigned: t('rc_pk_group_assigned'),
  };
  const groups = useMemo(
    () => GROUPS.map((g) => ({ key: g.key, items: (data ?? []).filter(g.test) })).filter((g) => g.items.length > 0),
    [data],
  );

  /** Un code lu ou tapé → la fiche du paquet. `replace` : on vient d'un lien (?code=), pas d'un geste. */
  const openCode = async (text: string, replace = false): Promise<ScanResult> => {
    const code = PARCEL_LABEL.test(text) ? null : parsePackageCode(text);
    if (!code) return { outcome: 'unknown', text: PARCEL_LABEL.test(text) ? t('rc_pk_is_parcel') : t('rc_pk_not_package') };
    try {
      const pkg = await find.mutateAsync(code);
      setCodeError(null);
      navigate(`/r/paquets/${pkg.id}`, { replace });
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
      <MobileHeader title={t('rc_pk_title')} subtitle={t('rc_pk_subtitle')} showBack backTo="/r" />
      <div className="space-y-6 px-5 pb-8 pt-5">
        <PrimaryPill onClick={onCreate} loading={create.isPending} disabled={create.isPending} className="h-16 w-full text-[18px] [&_svg]:h-6 [&_svg]:w-6">
          <PackagePlus /> {t('rc_pk_new')}
        </PrimaryPill>

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
