import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  /** Qui est en train d'écrire ; détermine le label affiché */
  who: 'admin' | 'client';
  className?: string;
}

export function TypingIndicator({ who, className }: TypingIndicatorProps) {
  const { t } = useTranslation('support');
  const label = who === 'admin' ? t('typing.adminWriting') : t('typing.clientWriting');

  return (
    <div className={cn('flex items-start px-3 py-1', className)}>
      <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-xs text-muted-foreground shadow-sm">
        <div className="flex items-center gap-1">
          <span
            className="block h-1.5 w-1.5 animate-bounce rounded-full bg-current"
            style={{ animationDelay: '0ms', animationDuration: '900ms' }}
          />
          <span
            className="block h-1.5 w-1.5 animate-bounce rounded-full bg-current"
            style={{ animationDelay: '150ms', animationDuration: '900ms' }}
          />
          <span
            className="block h-1.5 w-1.5 animate-bounce rounded-full bg-current"
            style={{ animationDelay: '300ms', animationDuration: '900ms' }}
          />
        </div>
        <span>{label}</span>
      </div>
    </div>
  );
}
