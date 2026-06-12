import { useTranslation } from 'react-i18next';
import { useClientQuickReplies } from '@/hooks/useClientQuickReplies';
import { ResponseTimeBadge } from './ResponseTimeBadge';

interface EmptyChatStateProps {
  onQuickReply?: (content: string) => void;
}

export function EmptyChatState({ onQuickReply }: EmptyChatStateProps) {
  const { t } = useTranslation('support');
  const { data: quickReplies } = useClientQuickReplies();
  const replies = quickReplies ?? [];

  return (
    <div className="flex w-full max-w-sm flex-col items-center px-4 py-6 text-center">
      {/* Illustration monoligne mono-couleur */}
      <svg
        className="mb-4 h-20 w-20 text-bonzini-violet opacity-90"
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M14 18 Q14 12, 20 12 L44 12 Q50 12, 50 18 L50 36 Q50 42, 44 42 L28 42 L20 50 L20 42 Q14 42, 14 36 Z"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <text
          x="32"
          y="32"
          textAnchor="middle"
          fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
          fontSize="18"
          fontWeight="700"
          fill="currentColor"
        >
          B
        </text>
      </svg>

      <h2 className="mb-2 max-w-xs text-xl font-bold tracking-tight text-foreground">
        {t('empty.title')}
      </h2>
      <p className="mb-5 max-w-[280px] text-sm leading-relaxed text-muted-foreground">
        {t('empty.subtitle')}
      </p>

      <ResponseTimeBadge />

      {onQuickReply && replies.length > 0 && (
        <div className="mt-6 w-full">
          <p className="mb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('empty.quickRepliesTitle')}
          </p>
          <div className="flex flex-col gap-1.5">
            {replies.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onQuickReply(r.content)}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-3 text-left text-sm text-foreground transition active:scale-[0.99] active:bg-muted"
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
