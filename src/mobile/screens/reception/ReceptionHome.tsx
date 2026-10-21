// ============================================================
// RÉCEPTION — Aujourd'hui (refonte v2, maquette 04/10).
// Le lieu en pastille en haut (bureau = avion, entrepôt = bateau ; un
// toucher pour le changer), le chiffre du jour (les colis reçus, les dépôts,
// les kilos), quatre gros ronds — Nouveau dépôt · Scanner · Paquets · Sans
// client —, puis les dépôts du jour ; « Hier » remonte jour par jour.
// La langue et la déconnexion sont dans Plus ; « Comment ça marche » s'ouvre
// depuis Plus (`/r?aide=1`).
// ============================================================
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Package, Plane, Plus, ScanLine, Ship, UserRound } from 'lucide-react';
import { getCurrentLocale } from '@/i18n';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { clientFullName, formatKg, type Deposit, type ReceptionLocation } from '@/lib/reception';
import { useReceptionDay } from '@/hooks/useReception';
import {
  ActionCircles, BigButton, BottomSheet, EmptyLine, FOCUS_RING, HeroFigure, Initials, ItemList, ItemRow, ScreenLoader, SectionHead, SURFACE, TabTop, TEXT,
} from '@/mobile/designKit';
import { LocationMark, formatTime, useReceptionLabels } from '@/mobile/components/reception/bits';
import { TopIcon } from '@/mobile/components/cargo/v2';
import { useReceptionLocation } from './useReceptionLocation';

/** La ligne d'un dépôt de la journée : rond (initiales, ou « ? » sans client), RC, colis, kilos ; l'heure et l'état à droite. */
export function DayDepositRow({ d, onClick }: { d: Deposit; onClick: () => void }) {
  const { t } = useLanguage();
  const labels = useReceptionLabels();
  const st = labels.status(d);
  const name = d.client ? clientFullName(d.client) : t('rc_v2_no_client');
  return (
    <ItemRow
      leading={d.client ? <Initials name={name} /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] text-[18px] font-semibold text-[#1E1E1E] dark:bg-[#383838] dark:text-[#F5F5F5]">?</span>}
      title={name}
      subtitle={`${d.deposit_no} · ${labels.parcels(d.parcel_count)} · ${formatKg(d.total_weight_kg)}`}
      amount={formatTime(d.opened_at)}
      tag={{ tone: st.tone === 'info' ? 'pending' : st.tone, label: st.label }}
      onClick={onClick}
    />
  );
}

export function ReceptionHome() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { t } = useLanguage();
  const { t: ti } = useTranslation('agent');
  const { currentUser } = useAdminAuth();
  const { location, setLocation } = useReceptionLocation();
  // La journée, puis les précédentes. 0 = aujourd'hui.
  const [back, setBack] = useState(0);
  const [placeOpen, setPlaceOpen] = useState(false);
  const helpOpen = params.get('aide') === '1';
  const closeHelp = () => setParams((p) => { const n = new URLSearchParams(p); n.delete('aide'); return n; }, { replace: true });
  const day = (() => { const d = new Date(); d.setDate(d.getDate() - back); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const { data, isLoading, error, refetch } = useReceptionDay(back === 0 ? undefined : day);
  const dayLabel = back === 0 ? t('rc_today') : back === 1 ? t('rc_yesterday') : new Date(`${day}T12:00:00`).toLocaleDateString(getCurrentLocale(), { weekday: 'short', day: '2-digit', month: '2-digit' });

  const firstName = currentUser?.firstName || '';
  const stats = data?.stats;
  const pending = data?.pending ?? 0;

  return (
    <div className={cn('min-h-[100dvh] pb-6', SURFACE.canvas)}>
      <TabTop
        title={firstName ? ti('rc_hello_name', { name: firstName }).replace(',', '') : t('rc_hello')}
        right={location && (
          <button type="button" onClick={() => setPlaceOpen(true)} className={cn('flex h-11 items-center gap-2 rounded-lg border px-3.5 text-[17px] font-semibold active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.divider, FOCUS_RING, TEXT.strong)}>
            {location === 'office' ? <Plane className="h-5 w-5" /> : <Ship className="h-5 w-5" />}
            {location === 'office' ? t('rc_office_short') : t('rc_warehouse_short')}
          </button>
        )}
      />

      <div className="px-5 pt-3.5">
        <HeroFigure
          label={back === 0 ? t('rc_v2_received_today') : `${t('rc_parcels')} · ${dayLabel}`}
          value={isLoading || !stats ? '—' : stats.parcels}
          sub={stats ? [
            <><b className="font-bold">{stats.deposits}</b> {t('rc_deposits').toLowerCase()}</>,
            <b className="font-bold">{formatKg(stats.weight_kg)}</b>,
          ] : undefined}
        />
      </div>

      <ActionCircles
        actions={[
          { label: t('rc_new_deposit'), icon: Plus, onClick: () => navigate('/r/new') },
          { label: t('rc_v2_scanner'), icon: ScanLine, onClick: () => navigate('/r/new') },
          { label: t('rc_tab_packages'), icon: Package, onClick: () => navigate('/r/paquets') },
          { label: t('rc_v2_no_client'), icon: UserRound, onClick: () => navigate('/r/pending'), badge: pending },
        ]}
      />

      {back === 0 ? (
        <SectionHead title={t('rc_v2_today_deposits')} link={{ label: t('rc_yesterday'), onClick: () => setBack(1) }} />
      ) : (
        <div className="flex items-center justify-between gap-2 px-5 pb-1.5 pt-[22px]">
          <h2 className={cn('text-[20px] font-semibold', TEXT.strong)}>{dayLabel}</h2>
          <span className="flex items-center">
            <TopIcon icon={ChevronLeft} ariaLabel={t('rc_day_prev')} onClick={() => setBack((b) => b + 1)} />
            <TopIcon icon={ChevronRight} ariaLabel={t('rc_day_next')} onClick={() => setBack((b) => Math.max(0, b - 1))} />
          </span>
        </div>
      )}

      {isLoading ? <ScreenLoader /> : error || !data ? (
        <EmptyLine action={{ label: t('rc_retry'), onClick: () => void refetch() }}>{(error as Error | null)?.message ?? t('error')}</EmptyLine>
      ) : data.deposits.length === 0 ? (
        <EmptyLine>{back === 0 ? t('rc_v2_no_deposit_today') : t('rc_no_deposit_day')}</EmptyLine>
      ) : (
        <ItemList>
          {data.deposits.map((d) => <DayDepositRow key={d.id} d={d} onClick={() => navigate(`/r/deposit/${d.id}`)} />)}
        </ItemList>
      )}

      {/* Changer de lieu : un choix explicite, confirmé d'un toucher. */}
      <BottomSheet open={placeOpen} onClose={() => setPlaceOpen(false)} title={t('rc_choose_location')}>
        <div className="flex flex-col gap-3">
          {(['warehouse', 'office'] as ReceptionLocation[]).map((l) => (
            <button key={l} type="button" onClick={() => { setLocation(l); setPlaceOpen(false); }} className={cn('flex min-h-[64px] w-full items-center gap-4 rounded-lg border px-4 text-left', l === location ? 'border-2 border-[#2C2C2C] dark:border-[#E3E3E3]' : SURFACE.divider)}>
              <LocationMark location={l} size={40} />
              <span className={cn('flex-1 text-[17px] font-semibold', TEXT.strong)}>{l === 'warehouse' ? t('rc_warehouse') : t('rc_office')}</span>
              {l === location && <Check className={cn('h-5 w-5', TEXT.strong)} />}
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Comment ça marche : quatre lignes, ouvertes depuis Plus. */}
      <BottomSheet open={helpOpen} onClose={closeHelp} title={t('rc_how_it_works')}>
        <ol className="space-y-4">
          {(['rc_how_1', 'rc_how_2', 'rc_how_3', 'rc_how_4'] as const).map((k, i) => (
            <li key={k} className="flex items-start gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2C2C2C] text-[16px] font-bold text-[#F5F5F5] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]">{i + 1}</span>
              <span className={cn('pt-1.5 text-[16px]', TEXT.strong)}>{t(k)}</span>
            </li>
          ))}
        </ol>
        <BigButton variant="soft" className="mt-6" onClick={closeHelp}>{t('rc_got_it')}</BigButton>
      </BottomSheet>
    </div>
  );
}
