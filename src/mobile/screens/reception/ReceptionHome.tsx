// ============================================================
// RÉCEPTION — Accueil. Un seul geste qui compte : « Nouveau dépôt ». En
// dessous, la journée du réceptionnaire : ses dépôts, ses colis, ses kilos,
// ses m³, et ce qui reste en attente d'attribution. Chaque dépôt ouvre SA
// fiche (en cours ou terminé). Les paquets avion ont leur onglet.
// Le lieu (bureau = avion, entrepôt = bateau) se lit en haut, et se change
// par « Changer » (confirmation) — plus d'interrupteur qu'on touche par
// mégarde. Le premier choix du lieu se fait dans la coquille (LocationGate).
// ============================================================
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Check, ChevronLeft, ChevronRight, HelpCircle, LogOut, Package, Ruler, Scale, ScanLine } from 'lucide-react';
import { getCurrentLocale } from '@/i18n';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { formatCbm, formatKg, type ReceptionLocation } from '@/lib/reception';
import { useReceptionDay } from '@/hooks/useReception';
import { SURFACE, TEXT, TYPE, BottomSheet, Card, IconButton, PrimaryPill, ScreenError, ScreenLoader, SoftPill, StatCard } from '@/mobile/designKit';
import { DepositRow, LocationMark } from '@/mobile/components/reception/bits';
import { LanguagePicker } from '@/mobile/components/reception/LanguagePicker';
import { useReceptionLocation } from './useReceptionLocation';

export function ReceptionHome() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { t: ti } = useTranslation('agent');
  const { currentUser, logout } = useAdminAuth();
  const { location, setLocation } = useReceptionLocation();
  // La journée, puis les précédentes : ‹ › sous le titre. 0 = aujourd'hui.
  const [back, setBack] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const day = (() => { const d = new Date(); d.setDate(d.getDate() - back); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const { data, isLoading, error, refetch } = useReceptionDay(back === 0 ? undefined : day);
  const dayLabel = back === 0 ? t('rc_today') : back === 1 ? t('rc_yesterday') : new Date(`${day}T12:00:00`).toLocaleDateString(getCurrentLocale(), { weekday: 'short', day: '2-digit', month: '2-digit' });

  const firstName = currentUser?.firstName || '';
  const stats = data?.stats;
  const pending = data?.pending ?? 0;

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
        {/* Le lieu : une information, pas un interrupteur. Il décide du mode des prochains dépôts. */}
        {location && (
          <button type="button" onClick={() => setPlaceOpen(true)} className={cn('mt-4 flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left', SURFACE.inset)}>
            <LocationMark location={location} size={32} />
            <span className={cn('min-w-0 flex-1', TYPE.bodyStrong, TEXT.strong)}>{location === 'warehouse' ? t('rc_warehouse') : t('rc_office')}</span>
            <span className={cn('shrink-0', TYPE.smallStrong, TEXT.muted)}>{t('rc_change')}</span>
          </button>
        )}
      </header>

      <div className="space-y-6 px-5 pb-8 pt-4">
        <div className="space-y-2">
          <PrimaryPill onClick={() => navigate('/r/new')} className="h-16 w-full text-[18px] [&_svg]:h-6 [&_svg]:w-6">
            <ScanLine /> {t('rc_new_deposit')}
          </PrimaryPill>
          <button type="button" onClick={() => setHelpOpen(true)} className={cn('flex h-10 w-full items-center justify-center gap-2', TYPE.smallStrong, TEXT.muted)}>
            <HelpCircle className="h-4 w-4" /> {t('rc_how_it_works')}
          </button>
        </div>

        {pending > 0 && (
          <button type="button" onClick={() => navigate('/r/pending')} className="flex w-full items-center gap-4 rounded-lg bg-[#FFF1C2] px-4 py-4 text-left text-[#682D03] dark:bg-[#522504] dark:text-[#FFF1C2]">
            <HelpCircle className="h-6 w-6 shrink-0" />
            <span className={cn('flex-1', TYPE.bodyStrong)}>{pending} {pending > 1 ? t('rc_pending_many') : t('rc_pending_one')}</span>
            <ChevronRight className="h-5 w-5 shrink-0" />
          </button>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className={cn(TYPE.lead, TEXT.strong)}>{dayLabel}</h2>
            <span className="flex items-center gap-1">
              <IconButton icon={ChevronLeft} variant="subtle" ariaLabel={t('rc_day_prev')} onClick={() => setBack((b) => b + 1)} />
              <IconButton icon={ChevronRight} variant="subtle" ariaLabel={t('rc_day_next')} onClick={() => setBack((b) => Math.max(0, b - 1))} disabled={back === 0} />
            </span>
          </div>
          {isLoading ? (
            <ScreenLoader />
          ) : error || !stats ? (
            <ScreenError title={t('error')} description={(error as Error | null)?.message ?? ''} retryLabel={t('rc_retry')} onRetry={() => void refetch()} />
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
                <p className={cn(TYPE.body, TEXT.muted)}>{back === 0 ? t('rc_no_deposit_today') : t('rc_no_deposit_day')}</p>
              </Card>
            ) : (
              <Card className="py-0 [&>*]:border-b [&>*]:border-[#D9D9D9] [&>*:last-child]:border-b-0 dark:[&>*]:border-[#444444]">
                {data.deposits.map((d) => (
                  <DepositRow key={d.id} deposit={d} onClick={() => navigate(`/r/deposit/${d.id}`)} />
                ))}
              </Card>
            )}
          </section>
        )}

      </div>

      {/* Changer de lieu : un choix explicite, confirmé d'un toucher. */}
      <BottomSheet open={placeOpen} onClose={() => setPlaceOpen(false)} title={t('rc_choose_location')}>
        <p className={cn('mb-4', TYPE.body, TEXT.muted)}>{t('rc_choose_location_hint')}</p>
        <div className="flex flex-col gap-3">
          {(['warehouse', 'office'] as ReceptionLocation[]).map((l) => (
            <button key={l} type="button" onClick={() => { setLocation(l); setPlaceOpen(false); }} className={cn('flex min-h-[64px] w-full items-center gap-4 rounded-lg border px-4 text-left', l === location ? 'border-[#2C2C2C] dark:border-[#E3E3E3]' : SURFACE.divider)}>
              <LocationMark location={l} size={40} />
              <span className={cn('flex-1', TYPE.bodyStrong, TEXT.strong)}>{l === 'warehouse' ? t('rc_warehouse') : t('rc_office')}</span>
              {l === location && <Check className={cn('h-5 w-5', TEXT.strong)} />}
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* La pédagogie tient en quatre lignes, à portée de main, jamais imposée. */}
      <BottomSheet open={helpOpen} onClose={() => setHelpOpen(false)} title={t('rc_how_it_works')}>
        <ol className="space-y-4">
          {(['rc_how_1', 'rc_how_2', 'rc_how_3', 'rc_how_4'] as const).map((k, i) => (
            <li key={k} className="flex items-start gap-4">
              <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[16px] font-bold', 'bg-[#2C2C2C] text-[#F5F5F5] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]')}>{i + 1}</span>
              <span className={cn('pt-1.5', TYPE.body, TEXT.strong)}>{t(k)}</span>
            </li>
          ))}
        </ol>
        <SoftPill onClick={() => setHelpOpen(false)} className="mt-6 h-14 w-full text-[17px]">{t('rc_got_it')}</SoftPill>
      </BottomSheet>
    </div>
  );
}

