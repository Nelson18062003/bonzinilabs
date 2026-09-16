import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT } from '@/mobile/designKit';

/**
 * L'état « ça n'a pas chargé » des listes de l'app client. Avant, une
 * requête en échec tombait dans l'état vide (« Aucun dépôt ») : un client hors
 * réseau croyait n'avoir aucune opération. Ici on le dit, et on peut réessayer.
 */
export function QueryError({ what, onRetry, className }: { what: string; onRetry?: () => void; className?: string }) {
  const { t } = useTranslation('common');
  return (
    <div role="alert" className={cn('mt-4 rounded-[24px] p-8 text-center', SURFACE.card, SURFACE.shadow, className)}>
      <div className={cn('mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full', SURFACE.holder)}>
        <WifiOff className="h-7 w-7" />
      </div>
      <p className={cn('text-[16px] font-bold', TEXT.strong)}>
        {t('queryError.title', { defaultValue: 'Impossible de charger {{what}}.', what })}
      </p>
      <p className={cn('mt-1 text-[14px]', TEXT.muted)}>
        {t('queryError.hint', { defaultValue: 'Vérifiez votre connexion, puis réessayez.' })}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={cn('mt-4 inline-flex min-h-11 items-center justify-center rounded-full px-5 text-[16px] font-semibold', 'bg-[#1E1E1E] text-white dark:bg-[#F5F5F5] dark:text-[#1E1E1E]')}
        >
          {t('retry', { defaultValue: 'Réessayer' })}
        </button>
      )}
    </div>
  );
}
