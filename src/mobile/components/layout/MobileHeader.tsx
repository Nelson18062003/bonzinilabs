import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { IconButton, SURFACE, TEXT, TYPE } from '@/mobile/designKit';
import { cn } from '@/lib/utils';

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  backTo?: string;
  onBack?: () => void;
  rightElement?: ReactNode;
  /** Élément optionnel affiché juste avant le titre (ex. avatar / mascotte). */
  leading?: ReactNode;
  className?: string;
  /** `true` : titre à gauche (écran d'onglet). `false` : centré (écran de détail). */
  alignStart?: boolean;
}

/**
 * En-tête d'écran : 56 px, blanc, filet bas #D9D9D9. Retour = Icon Button
 * Subtle de 44 px. Titre Body Strong 16/600, sous-titre 14 sourd.
 */
export function MobileHeader({
  title, subtitle, showBack = false, backTo, onBack, rightElement, leading, className, alignStart,
}: MobileHeaderProps) {
  const navigate = useNavigate();
  const handleBack = () => {
    if (onBack) onBack();
    else if (backTo) navigate(backTo);
    else navigate(-1);
  };
  const start = alignStart ?? !showBack;

  return (
    <header className={cn('sticky top-0 z-40 border-b pt-[env(safe-area-inset-top)]', SURFACE.canvas, SURFACE.divider, className)}>
      <div className="flex min-h-14 items-center gap-2 px-2 py-1">
        {showBack ? (
          <IconButton icon={ChevronLeft} variant="subtle" onClick={handleBack} ariaLabel="Retour" />
        ) : (
          <div className={cn('w-2', start && 'w-2')} />
        )}
        <div className={cn('flex min-w-0 flex-1 items-center gap-2', start ? 'justify-start' : 'justify-center')}>
          {leading}
          <div className={cn('min-w-0', start ? 'text-left' : 'text-center')}>
            <h1 className={cn('break-words leading-tight', TYPE.bodyStrong, TEXT.strong)}>{title}</h1>
            {subtitle && <p className={cn('break-words text-[16px] leading-tight', TEXT.muted)}>{subtitle}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 pr-1">{rightElement ?? (showBack && !start ? <div className="w-11" /> : null)}</div>
      </div>
    </header>
  );
}
