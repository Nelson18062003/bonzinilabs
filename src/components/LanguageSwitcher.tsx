import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { supportedLanguages, languageNames, type SupportedLanguage } from '@/i18n';
import { cn } from '@/lib/utils';

const languageFlags: Record<SupportedLanguage, string> = {
  fr: '\ud83c\uddeb\ud83c\uddf7',
  en: '\ud83c\uddec\ud83c\udde7',
  zh: '\ud83c\udde8\ud83c\uddf3',
};

interface LanguageSwitcherProps {
  /** "default" uses shadcn ghost button, "landing" forces white icon for dark backgrounds */
  variant?: 'default' | 'landing';
  className?: string;
}

export function LanguageSwitcher({ variant = 'default', className }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();
  const currentLang = (i18n.language?.slice(0, 2) ?? 'fr') as SupportedLanguage;

  if (variant === 'landing') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-full border border-white/20 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer',
              className
            )}
            style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: '#8b82a0' }}
          >
            <Globe className="h-4 w-4" />
            <span>{languageFlags[currentLang]}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-[#1a1428] border-[#3d3555] text-white min-w-[140px]">
          {supportedLanguages.map((lang) => (
            <DropdownMenuItem
              key={lang}
              onClick={() => i18n.changeLanguage(lang)}
              className={cn(
                'text-white/80 hover:text-white focus:text-white cursor-pointer',
                currentLang === lang && 'bg-white/10 text-white'
              )}
            >
              <span className="mr-2">{languageFlags[lang]}</span>
              {languageNames[lang]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={cn('h-9 gap-1.5 px-2.5', className)}>
          <Globe className="h-4 w-4" />
          <span className="text-xs">{languageFlags[currentLang]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {supportedLanguages.map((lang) => (
          <DropdownMenuItem
            key={lang}
            onClick={() => i18n.changeLanguage(lang)}
            className={cn('cursor-pointer', currentLang === lang && 'bg-accent')}
          >
            <span className="mr-2">{languageFlags[lang]}</span>
            {languageNames[lang]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
