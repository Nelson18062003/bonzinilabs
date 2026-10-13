// ============================================================
// RÉCEPTION — « Où êtes-vous ? » Au premier usage d'un appareil (ou après
// effacement de ses données), le lieu se choisit AVANT tout : l'accueil et
// un nouveau dépôt commencent par cette question. Sans elle, un réceptionnaire
// qui scannait tout de suite un client restait devant un « Continuer » grisé,
// sans savoir pourquoi. Le lieu décide du mode : bureau = avion, entrepôt =
// bateau ; il se change ensuite depuis l'accueil.
// ============================================================
import { ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import type { ReceptionLocation } from '@/lib/reception';
import { SURFACE, TEXT, TYPE } from '@/mobile/designKit';
import { LocationMark } from './bits';
import { LanguagePicker } from './LanguagePicker';

export function LocationGate({ onPick }: { onPick: (l: ReceptionLocation) => void }) {
  const { t } = useLanguage();
  return (
    <div className={cn('flex min-h-[100dvh] flex-col px-5 pb-10 pt-[calc(1.25rem+env(safe-area-inset-top))]', SURFACE.canvas)}>
      <div className="mb-8 flex justify-end"><LanguagePicker /></div>
      <h1 className={cn(TYPE.heading, TEXT.strong)}>{t('rc_choose_location')}</h1>
      <p className={cn('mt-3', TYPE.body, TEXT.muted)}>{t('rc_choose_location_hint')}</p>
      <div className="mt-8 flex flex-col gap-4">
        {(['warehouse', 'office'] as ReceptionLocation[]).map((l) => (
          <button key={l} type="button" onClick={() => onPick(l)} className={cn('flex min-h-[72px] w-full items-center gap-4 rounded-lg px-4 text-left', SURFACE.card, SURFACE.shadow, 'active:bg-[#F5F5F5] dark:active:bg-[#383838]')}>
            <LocationMark location={l} size={44} />
            <span className={cn('flex-1', TYPE.bodyStrong, TEXT.strong)}>{l === 'warehouse' ? t('rc_warehouse') : t('rc_office')}</span>
            <ChevronRight className={cn('h-5 w-5', TEXT.muted)} />
          </button>
        ))}
      </div>
    </div>
  );
}
