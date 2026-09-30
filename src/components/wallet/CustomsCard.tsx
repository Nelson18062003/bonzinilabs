import { Landmark, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT } from '@/mobile/designKit';

/**
 * « Combien à la douane ? » — l'entrée du module Douane depuis le portefeuille.
 * Elle vit ici parce que c'est avant de payer le fournisseur que le client doit
 * savoir ce que la sortie de sa marchandise va coûter.
 */
export function CustomsCard() {
  const navigate = useNavigate();
  const { t } = useTranslation('customs');
  return (
    <button
      type="button"
      onClick={() => navigate('/douane/simulateur')}
      className={cn('flex w-full items-center gap-3 rounded-[20px] p-4 text-left transition active:scale-[0.99]', SURFACE.card, SURFACE.shadow)}
    >
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', SURFACE.holder)}>
        <Landmark className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[15px] font-bold', TEXT.strong)}>{t('hub.walletCardTitle')}</span>
        <span className={cn('block text-[13px] leading-snug', TEXT.muted)}>{t('hub.walletCardDesc')}</span>
      </span>
      <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
    </button>
  );
}
