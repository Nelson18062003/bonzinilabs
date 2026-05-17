import { useTranslation } from 'react-i18next';
import { MessageCircleHeart } from 'lucide-react';
import { ResponseTimeBadge } from './ResponseTimeBadge';
import { useClientQuickReplies } from '@/hooks/useClientQuickReplies';

interface EmptyChatStateProps {
  onQuickReply?: (content: string) => void;
}

export function EmptyChatState({ onQuickReply }: EmptyChatStateProps) {
  const { t } = useTranslation('support');
  const { data: quickReplies } = useClientQuickReplies();
  const replies = quickReplies ?? [];

  return (
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-bonzini-violet/10">
        <MessageCircleHeart className="h-10 w-10 text-bonzini-violet" />
      </div>
      <h2 className="mb-2 text-lg font-semibold text-foreground">
        {t('empty.title')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">{t('empty.subtitle')}</p>
      <ResponseTimeBadge />

      {onQuickReply && replies.length > 0 && (
        <div className="mt-6 w-full">
          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
            {t('empty.quickRepliesTitle')}
          </p>
          <div className="flex flex-col gap-2">
            {replies.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onQuickReply(r.content)}
                className="w-full rounded-xl border border-bonzini-violet/30 bg-bonzini-violet/5 px-4 py-2.5 text-left text-sm font-medium text-bonzini-violet transition-colors hover:bg-bonzini-violet/10"
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
