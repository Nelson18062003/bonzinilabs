import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Search } from 'lucide-react';
import { useCannedResponses } from '@/hooks/useCannedResponses';
import { cn } from '@/lib/utils';

interface CannedResponsesPickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (content: string) => void;
}

export function CannedResponsesPicker({ open, onClose, onPick }: CannedResponsesPickerProps) {
  const { t } = useTranslation('support');
  const { data: templates, isLoading } = useCannedResponses();
  const [query, setQuery] = useState('');

  if (!open) return null;

  const filtered = (templates ?? []).filter((tpl) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return tpl.label.toLowerCase().includes(q) || tpl.content.toLowerCase().includes(q);
  });

  return (
    <div
      className="fixed inset-0 z-40 flex items-end bg-black/40 sm:items-center sm:justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-background p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">{t('templates.pickerTitle')}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          {/* eslint-disable-next-line no-restricted-syntax */}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('templates.searchPlaceholder')}
            className="w-full rounded-xl border border-border bg-muted/30 pl-9 pr-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-bonzini-violet/40"
          />
        </div>

        <div className="max-h-[60vh] space-y-1 overflow-y-auto">
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">…</p>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {templates && templates.length === 0
                ? t('templates.empty')
                : t('templates.noMatch')}
            </p>
          ) : (
            filtered.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => {
                  onPick(tpl.content);
                  onClose();
                }}
                className="w-full rounded-xl border border-border bg-background p-3 text-left transition-colors hover:bg-muted"
              >
                <p className="mb-0.5 text-sm font-semibold text-foreground">{tpl.label}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{tpl.content}</p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
