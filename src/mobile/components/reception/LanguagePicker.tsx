// ============================================================
// La langue de l'app réception, changeable sur place : une pastille qui dit
// la langue courante, une feuille avec les trois choix — Français, English,
// 中文 — chacun écrit dans sa propre langue, pour qu'un employé chinois
// trouve la sienne sans lire le français. Le choix est mémorisé sur
// l'appareil (i18next, clé « bonzini-language ») : il tient d'une session à
// l'autre et vaut pour toute l'app.
// ============================================================
import { useState } from 'react';
import { Check, Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { languageNames, supportedLanguages, type SupportedLanguage } from '@/i18n';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, BottomSheet } from '@/mobile/designKit';

/** Ce qu'on lit sur la pastille : court, dans la langue elle-même. */
const SHORT: Record<SupportedLanguage, string> = { fr: 'FR', en: 'EN', zh: '中文' };
/** Le titre de la feuille, dans les trois langues à la fois : on ne sait pas encore laquelle est la bonne. */
const SHEET_TITLE = 'Langue · Language · 语言';

export function LanguagePicker({ className, variant = 'pill' }: { className?: string; variant?: 'pill' | 'glass' }) {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const current = (supportedLanguages.includes(language as SupportedLanguage) ? language : 'fr') as SupportedLanguage;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={SHEET_TITLE}
        className={cn(
          'inline-flex h-11 items-center gap-2 rounded-full px-4 text-[15px] font-semibold transition-colors',
          variant === 'pill' ? cn(SURFACE.holder, TEXT.strong) : 'border border-border/50 bg-card/80 text-muted-foreground backdrop-blur-sm hover:text-foreground',
          className,
        )}
      >
        <Globe className="h-5 w-5" />
        {SHORT[current]}
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={SHEET_TITLE}>
        <div className="space-y-2">
          {supportedLanguages.map((lang) => {
            const active = lang === current;
            return (
              <button
                key={lang}
                type="button"
                onClick={() => { setLanguage(lang); setOpen(false); }}
                className={cn('flex min-h-[60px] w-full items-center gap-4 rounded-lg px-4 text-left transition-colors', SURFACE.card, SURFACE.shadow, active && 'ring-2 ring-[#2C2C2C] dark:ring-[#E3E3E3]')}
              >
                <span className={cn('w-12 shrink-0 text-center tabular-nums', TYPE.bodyStrong, TEXT.muted)}>{SHORT[lang]}</span>
                <span className={cn('flex-1', TYPE.bodyStrong, TEXT.strong)}>{languageNames[lang]}</span>
                {active && <Check className="h-5 w-5 shrink-0" />}
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
}
