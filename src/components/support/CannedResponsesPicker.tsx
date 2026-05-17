import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Search, Sparkles } from 'lucide-react';
import { useCannedResponses } from '@/hooks/useCannedResponses';
import { substituteTemplateVars, type TemplateContext } from '@/lib/template-vars';
import { getDateFnsLocale } from '@/i18n';
import { cn } from '@/lib/utils';
import type { Locale } from 'date-fns';

interface CannedResponsesPickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (content: string) => void;
  /** Contexte pour substituer les variables {{...}} avant injection */
  context?: TemplateContext;
}

export function CannedResponsesPicker({
  open,
  onClose,
  onPick,
  context,
}: CannedResponsesPickerProps) {
  const { t } = useTranslation('support');
  const { data: templates, isLoading } = useCannedResponses();
  const [query, setQuery] = useState('');
  const [locale, setLocale] = useState<Locale | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getDateFnsLocale().then((l) => !cancelled && setLocale(l));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!open) return null;

  const filtered = (templates ?? []).filter((tpl) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return tpl.label.toLowerCase().includes(q) || tpl.content.toLowerCase().includes(q);
  });

  const resolve = (content: string): string => {
    return substituteTemplateVars(content, {
      ...(context ?? {}),
      dateLocale: locale,
      defaultSubject: t('list.defaultSubject'),
    });
  };

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
            filtered.map((tpl) => {
              const resolved = resolve(tpl.content);
              const hasUnresolvedVars = /\{\{[a-z_]+\}\}/i.test(resolved);
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    onPick(resolved);
                    onClose();
                  }}
                  className="w-full rounded-xl border border-border bg-background p-3 text-left transition-colors hover:bg-muted"
                >
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-foreground">{tpl.label}</p>
                    {hasUnresolvedVars && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-0.5 rounded-full bg-bonzini-amber/20',
                          'px-1.5 py-0.5 text-[10px] font-medium text-bonzini-amber'
                        )}
                        title={t('templates.unresolvedVars')}
                      >
                        <Sparkles className="h-2.5 w-2.5" />
                        {t('templates.varsHint')}
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{resolved}</p>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
