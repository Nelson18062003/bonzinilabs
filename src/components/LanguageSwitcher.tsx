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

const languageFlags: Record<SupportedLanguage, string> = {
  fr: '\ud83c\uddeb\ud83c\uddf7',
  en: '\ud83c\uddec\ud83c\udde7',
  zh: '\ud83c\udde8\ud83c\uddf3',
};

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const currentLang = (i18n.language?.slice(0, 2) ?? 'fr') as SupportedLanguage;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Globe className="h-4 w-4" />
          <span className="sr-only">Language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {supportedLanguages.map((lang) => (
          <DropdownMenuItem
            key={lang}
            onClick={() => i18n.changeLanguage(lang)}
            className={currentLang === lang ? 'bg-accent' : ''}
          >
            <span className="mr-2">{languageFlags[lang]}</span>
            {languageNames[lang]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
