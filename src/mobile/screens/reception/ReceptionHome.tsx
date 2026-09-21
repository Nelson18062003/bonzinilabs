// ============================================================
// RÉCEPTION — Accueil. Un seul geste qui compte : « Nouveau dépôt ». En
// dessous, la journée du réceptionnaire : ses dépôts, ses colis, ses kilos,
// ses m³, et ce qui reste en attente d'attribution. C'est tout son tableau
// de bord — il ne voit rien d'autre de la plateforme.
// ============================================================
import { useNavigate } from 'react-router-dom';
import { Box, ChevronRight, HelpCircle, LogOut, Package, Ruler, Scale, ScanLine } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { formatCbm, formatKg, type ReceptionLocation } from '@/lib/reception';
import { useReceptionDay } from '@/hooks/useReception';
import { SURFACE, TEXT, TYPE, Card, IconButton, PrimaryPill, ScreenLoader, Segmented, StatCard } from '@/mobile/designKit';
import { DepositRow, LocationMark } from '@/mobile/components/reception/bits';
import { LanguagePicker } from '@/mobile/components/reception/LanguagePicker';
import { useReceptionLocation } from './useReceptionLocation';

export function ReceptionHome() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { t: ti } = useTranslation('agent');
  const { currentUser, logout } = useAdminAuth();
  const { location, setLocation } = useReceptionLocation();
  const { data, isLoading } = useReceptionDay();

  const firstName = currentUser?.firstName || '';
  const stats = data?.stats;
  const pending = data?.pending ?? 0;

  const locationOptions = (['warehouse', 'office'] as ReceptionLocation[]).map((l) => ({
    value: l,
    label: (
      <span className="inline-flex items-center gap-2">
        <LocationMark location={l} size={24} />
        {l === 'warehouse' ? t('rc_warehouse_short') : t('rc_office_short')}
      </span>
    ),
  }));

  // Premier lancement sur cet appareil : où est-on ? Le lieu décide du mode.
  if (!location) {
    return (
      <div className={cn('flex min-h-[100dvh] flex-col px-5 pb-10 pt-[calc(1.25rem+env(safe-area-inset-top))]', SURFACE.canvas)}>
        <div className="mb-8 flex justify-end"><LanguagePicker /></div>
        <h1 className={cn(TYPE.heading, TEXT.strong)}>{t('rc_choose_location')}</h1>
        <p className={cn('mt-3', TYPE.body, TEXT.muted)}>{t('rc_choose_location_hint')}</p>
        <div className="mt-8 flex flex-col gap-4">
          {(['warehouse', 'office'] as ReceptionLocation[]).map((l) => (
            <button key={l} type="button" onClick={() => setLocation(l)} className={cn('flex min-h-[72px] w-full items-center gap-4 rounded-lg px-4 text-left', SURFACE.card, SURFACE.shadow, 'active:bg-[#F5F5F5] dark:active:bg-[#383838]')}>
              <LocationMark location={l} size={44} />
              <span className={cn('flex-1', TYPE.bodyStrong, TEXT.strong)}>{l === 'warehouse' ? t('rc_warehouse') : t('rc_office')}</span>
              <ChevronRight className={cn('h-5 w-5', TEXT.muted)} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('min-h-[100dvh]', SURFACE.canvas)}>
      <header className="px-5 pb-2 pt-[calc(1.25rem+env(safe-area-inset-top))]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className={cn(TYPE.heading, TEXT.strong)}>{firstName ? ti('rc_hello_name', { name: firstName }) : t('rc_hello')}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LanguagePicker />
            <IconButton icon={LogOut} ariaLabel={t('logout')} onClick={() => void logout().then(() => navigate('/r/login'))} />
          </div>
        </div>
        <div className="mt-5">
          <Segmented value={location} onChange={setLocation} options={locationOptions} />
        </div>
      </header>

      <div className="space-y-6 px-5 pb-8 pt-4">
        <PrimaryPill onClick={() => navigate('/r/new')} className="h-16 w-full text-[18px] [&_svg]:h-6 [&_svg]:w-6">
          <ScanLine /> {t('rc_new_deposit')}
        </PrimaryPill>

        {pending > 0 && (
          <button type="button" onClick={() => navigate('/r/pending')} className="flex w-full items-center gap-4 rounded-lg bg-[#FFF1C2] px-4 py-4 text-left text-[#682D03] dark:bg-[#522504] dark:text-[#FFF1C2]">
            <HelpCircle className="h-6 w-6 shrink-0" />
            <span className={cn('flex-1', TYPE.bodyStrong)}>{pending} {pending > 1 ? t('rc_pending_many') : t('rc_pending_one')}</span>
            <ChevronRight className="h-5 w-5 shrink-0" />
          </button>
        )}

        <section>
          <h2 className={cn('mb-3', TYPE.lead, TEXT.strong)}>{t('rc_today')}</h2>
          {isLoading || !stats ? (
            <ScreenLoader />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={Box} label={t('rc_deposits')} value={stats.deposits} />
              <StatCard icon={Package} label={t('rc_parcels')} value={stats.parcels} />
              <StatCard icon={Scale} label={t('rc_weight')} value={formatKg(stats.weight_kg)} />
              <StatCard icon={Ruler} label={t('rc_volume')} value={formatCbm(stats.cbm)} />
            </div>
          )}
        </section>

        {data && (
          <section>
            {data.deposits.length === 0 ? (
              <Card className={cn('text-center', SURFACE.inset, 'border-0')}>
                <p className={cn(TYPE.body, TEXT.muted)}>{t('rc_no_deposit_today')}</p>
              </Card>
            ) : (
              <Card className="py-0 [&>*]:border-b [&>*]:border-[#D9D9D9] [&>*:last-child]:border-b-0 dark:[&>*]:border-[#444444]">
                {data.deposits.map((d) => (
                  <DepositRow key={d.id} deposit={d} onClick={() => navigate(d.status === 'open' ? `/r/deposit/${d.id}` : `/r/deposit/${d.id}/done`)} />
                ))}
              </Card>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
