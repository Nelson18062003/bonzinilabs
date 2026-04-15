import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES, LANGUAGE_FLAGS, type SupportedLanguage } from '@/i18n';

interface LanguageSwitcherProps {
  /** 'icon' — globe icon only (for dense headers)
   *  'badge' — flag + code e.g. "🇫🇷 FR" (default)
   *  'full'  — flag + full name e.g. "🇫🇷 Français"
   */
  variant?: 'icon' | 'badge' | 'full';
  className?: string;
}

export function LanguageSwitcher({ variant = 'badge', className }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();
  const currentLang = (i18n.language?.slice(0, 2) ?? 'fr') as SupportedLanguage;
  const validLang = SUPPORTED_LANGUAGES.includes(currentLang) ? currentLang : 'fr';

  const handleChange = (lang: SupportedLanguage) => {
    i18n.changeLanguage(lang);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-9 gap-1.5 px-2 text-muted-foreground hover:text-foreground',
            'hover:bg-secondary/80 transition-colors rounded-lg',
            className
          )}
          aria-label={`Language: ${LANGUAGE_NAMES[validLang]}`}
        >
          {variant === 'icon' ? (
            <Globe className="h-4 w-4" />
          ) : (
            <>
              <span className="text-base leading-none" aria-hidden="true">
                {LANGUAGE_FLAGS[validLang]}
              </span>
              {variant === 'full' ? (
                <span className="text-sm font-medium">{LANGUAGE_NAMES[validLang]}</span>
              ) : (
                <span className="text-xs font-semibold uppercase tracking-wide">
                  {validLang}
                </span>
              )}
            </>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-[140px]">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang}
            onClick={() => handleChange(lang)}
            className={cn(
              'flex items-center gap-2.5 cursor-pointer',
              lang === validLang && 'bg-secondary font-medium text-foreground'
            )}
          >
            <span className="text-base" aria-hidden="true">{LANGUAGE_FLAGS[lang]}</span>
            <span className="flex-1">{LANGUAGE_NAMES[lang]}</span>
            {lang === validLang && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
