// ============================================================
// RÉCEPTION — « Qui apporte le colis ? » Quatre cas du terrain, quatre
// grandes cartes : un transporteur, le client lui-même (retour du marché),
// quelqu'un pour lui (nom + téléphone), Bonzini qui est allé le chercher.
// Puis on ouvre le dépôt. La flèche ramène à la caméra (ou à la fiche du
// client si l'on vient de là, `?from=client`). Si l'appareil ne sait pas
// encore où il est (bureau ou entrepôt), on le demande ICI : jamais un
// « Continuer » grisé sans raison.
// Refonte v2 (maquette 10/43) : le client en carte, quatre grands choix.
// ============================================================
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { BROUGHT_BY, type BroughtBy } from '@/lib/reception';
import { useOpenDeposit } from '@/hooks/useReception';
import type { ReceptionLocation } from '@/lib/reception';
import { BigButton, Dock, Initials, ScreenTop, SURFACE, TEXT, TextInput, WhoCard } from '@/mobile/designKit';
import { LocationMark } from '@/mobile/components/reception/bits';
import { CapsLabel, OptionCard } from '@/mobile/components/cargo/v2';
import { useReceptionBack, useStillHere } from '@/mobile/components/reception/useReceptionBack';
import { useReceptionLocation } from './useReceptionLocation';

export function ReceptionBroughtBy() {
  const navigate = useNavigate();
  const back = useReceptionBack();
  const stillHere = useStillHere();
  const [params] = useSearchParams();
  const { t } = useLanguage();
  const { location, setLocation } = useReceptionLocation();
  const open = useOpenDeposit();

  const clientId = params.get('client');
  const clientName = params.get('name') ?? '';
  const clientCode = params.get('code') ?? '';
  const [choice, setChoice] = useState<BroughtBy | null>(null);
  const [repName, setRepName] = useState('');
  const [repPhone, setRepPhone] = useState('');
  const fromCard = params.get('from') === 'client';
  /** Revenir au choix du client : la caméra (en remplaçant cette étape), ou la fiche d'où l'on est parti. */
  const leave = () => (fromCard && clientId ? back(`/r/clients/${clientId}`) : navigate('/r/new', { replace: true }));

  const canOpen = !!location && !!choice && (choice !== 'representative' || repName.trim().length > 0);

  const submit = async () => {
    if (!location || !choice || open.isPending) return;
    const dep = await open.mutateAsync({
      location,
      clientUserId: clientId,
      broughtBy: choice,
      representativeName: choice === 'representative' ? repName : undefined,
      representativePhone: choice === 'representative' ? repPhone : undefined,
    }).catch(() => null); // le hook dit le refus ; on reste sur l'étape, rien de perdu
    if (dep && stillHere()) navigate(`/r/deposit/${dep.id}/supplier`, { replace: true }); // quitté pendant l'envoi : le dépôt attend dans Aujourd'hui
  };

  const placeLabel = location === 'office' ? t('rc_office_short') : location === 'warehouse' ? t('rc_warehouse_short') : null;
  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <ScreenTop title={t('rc_new_deposit')} step="2/4" onBack={leave} />

      <div className="flex-1 space-y-5 px-5 pb-6 pt-4">
        {/* Le client, en une carte : on sait pour qui on travaille ; un toucher pour le changer. */}
        <WhoCard
          leading={clientId ? <Initials name={clientName} /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] text-[18px] font-semibold text-[#1E1E1E] dark:bg-[#383838] dark:text-[#F5F5F5]">?</span>}
          name={clientId ? clientName : t('rc_unknown_client')}
          line={[clientCode, placeLabel].filter(Boolean).join(' · ') || undefined}
          onClick={leave}
        />

        {!location && (
          <div className="space-y-2.5">
            <CapsLabel>{t('rc_choose_location')}</CapsLabel>
            <div className="grid grid-cols-2 gap-2.5">
              {(['warehouse', 'office'] as ReceptionLocation[]).map((l) => (
                <button key={l} type="button" onClick={() => setLocation(l)} className={cn('flex min-h-[56px] items-center justify-center gap-2 rounded-lg border px-3 text-[17px] font-semibold', SURFACE.divider, TEXT.strong)}>
                  <LocationMark location={l} size={24} /> {l === 'warehouse' ? t('rc_warehouse_short') : t('rc_office_short')}
                </button>
              ))}
            </div>
          </div>
        )}

        <h2 className={cn('text-[24px] font-semibold leading-tight tracking-[-0.01em]', TEXT.strong)}>{t('rc_brought_title')}</h2>
        <div className="flex flex-col gap-2.5" role="radiogroup" aria-label={t('rc_brought_title')}>
          {BROUGHT_BY.map((b) => (
            <OptionCard key={b} selected={choice === b} onClick={() => setChoice(b)} title={t(`rc_by_${b}`)} hint={t(`rc_by_${b}_hint`)}>
              {b === 'representative' ? (
                <>
                  <TextInput value={repName} onChange={(e) => setRepName(e.target.value)} autoCapitalize="words" placeholder={t('rc_rep_name')} aria-label={t('rc_rep_name')} className="h-12" />
                  <TextInput value={repPhone} onChange={(e) => setRepPhone(e.target.value)} inputMode="tel" placeholder={t('rc_rep_phone')} aria-label={t('rc_rep_phone')} className="h-12" />
                </>
              ) : undefined}
            </OptionCard>
          ))}
        </div>
      </div>

      <Dock>
        {!canOpen && choice && <p className={cn('text-center text-[15px]', TEXT.muted)}>{!location ? t('rc_need_location') : t('rc_need_rep_name')}</p>}
        <BigButton onClick={() => void submit()} disabled={!canOpen} loading={open.isPending}>{t('rc_continue_next')}</BigButton>
      </Dock>
    </div>
  );
}
