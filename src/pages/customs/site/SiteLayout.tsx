/**
 * La coquille du site Douane — bonzinilabs.com/douane.
 *
 * Direction « premium » (Apple, Wise, Revolut) : une barre blanche
 * translucide, le logo, les cinq outils en gris qui passent au noir, et une
 * seule action en pilule noire. Par écran :
 *   - téléphone : barre de 56 px, logo et menu ; le menu couvre l'écran, de
 *     grandes lignes de texte, la langue et le compte en bas ;
 *   - tablette (≥ 640 px) : l'action « Estimer mes droits » s'ajoute ;
 *   - ordinateur (≥ 1280 px) : barre de 64 px, les cinq outils en clair.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { Globe, Menu, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supportedLanguages, type SupportedLanguage } from '@/i18n';
import { persistPreferredLocale } from '@/lib/persistLocale';
import { CONTACT_PHONE_CM, whatsappLink } from '@/lib/companyContacts';
import { BonziniLogo } from '@/components/brand/BonziniLogo';
import { Container } from './ui';
import { SITE_NAV } from './nav';
import { EASE, buttonClass } from './styles';

const LANG_LABEL: Record<SupportedLanguage, string> = { fr: 'FR', en: 'EN', zh: '中文' };
const LANG_NAME: Record<SupportedLanguage, string> = { fr: 'Français', en: 'English', zh: '中文' };

function LangSwitch({ className }: { className?: string }) {
  const { i18n, t } = useTranslation('customs');
  const current = (i18n.language?.slice(0, 2) ?? 'fr') as SupportedLanguage;
  return (
    <div role="group" aria-label={t('site.language')} className={cn('flex items-center rounded-full bg-dz-soft p-0.5', className)}>
      {supportedLanguages.map((l) => (
        <button key={l} type="button" aria-pressed={current === l}
          onClick={() => { void i18n.changeLanguage(l); void persistPreferredLocale(l); }}
          className={cn('h-8 min-w-10 rounded-full px-2.5 text-[14px] font-bold transition-colors',
            current === l ? 'bg-dz-card text-dz-ink shadow-sm' : 'text-dz-ink3 hover:text-dz-ink')}>
          {LANG_LABEL[l]}
        </button>
      ))}
    </div>
  );
}

/** Barre du haut, ordinateur : la langue tient en un bouton. */
function LangMenu() {
  const { i18n, t } = useTranslation('customs');
  const current = (i18n.language?.slice(0, 2) ?? 'fr') as SupportedLanguage;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={t('site.language')}
        className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[14px] font-bold text-dz-ink2 transition-colors hover:bg-dz-soft hover:text-dz-ink">
        <Globe aria-hidden className="h-4 w-4" /> {LANG_LABEL[current]}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="dz min-w-[140px] rounded-2xl border-dz-line bg-dz-card p-1 text-dz-ink shadow-xl">
        {supportedLanguages.map((l) => (
          <DropdownMenuItem key={l} onSelect={() => { void i18n.changeLanguage(l); void persistPreferredLocale(l); }}
            className={cn('cursor-pointer rounded-lg px-3 py-2 text-[15px]', current === l && 'font-semibold text-dz-brand')}>
            {LANG_NAME[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Brand() {
  const { t } = useTranslation('customs');
  return (
    <Link to="/douane" className="flex shrink-0 items-center gap-2 whitespace-nowrap" aria-label={t('site.homeLabel')}>
      <BonziniLogo size={30} />
      <span className="text-[18px] font-bold tracking-[-0.02em] text-dz-ink">Bonzini Labs</span>
      <span className="text-[18px] font-medium tracking-[-0.02em] text-dz-mute">{t('site.badge')}</span>
    </Link>
  );
}

function Header() {
  const { t } = useTranslation('customs');
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', esc); };
  }, [open]);

  const account = user
    ? { to: '/douane/espace', label: t('site.mySpace') }
    : { to: '/auth', label: t('site.signIn') };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-dz-ink/[0.06] bg-dz-card/80 backdrop-blur-xl backdrop-saturate-150">
        <Container className="flex h-14 items-center justify-between gap-6 lg:h-16">
          <Brand />

          <nav aria-label={t('site.navLabel')} className="hidden items-center gap-1 xl:flex">
            {SITE_NAV.map((item) => (
              <NavLink key={item.key} to={item.to}
                className={({ isActive }) => cn('whitespace-nowrap rounded-full px-3 py-2 text-[15px] font-bold transition-colors',
                  isActive ? 'text-dz-ink' : 'text-dz-ink3 hover:text-dz-ink')}>
                {t(`site.nav.${item.key}`)}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-1 sm:gap-2">
            <span className="hidden xl:block"><LangMenu /></span>
            <Link to={account.to} className="hidden whitespace-nowrap rounded-full px-3 py-2 text-[15px] font-bold text-dz-ink transition-colors hover:bg-dz-soft sm:inline-flex">
              {account.label}
            </Link>
            <Link to="/douane/simulateur" className={cn(buttonClass('primary', 'sm'), 'hidden sm:inline-flex')}>{t('site.cta')}</Link>
            <button type="button" onClick={() => setOpen(true)} aria-label={t('site.menu')} aria-expanded={open}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-dz-soft text-dz-ink xl:hidden">
              <Menu aria-hidden className="h-5 w-5" />
            </button>
          </div>
        </Container>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div key="menu" role="dialog" aria-modal="true" aria-label={t('site.menu')}
            className="dz fixed inset-0 z-50 flex flex-col bg-dz-card xl:hidden"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <Container className="flex h-14 shrink-0 items-center justify-between">
              <Brand />
              <button type="button" onClick={() => setOpen(false)} aria-label={t('site.close')}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-dz-soft text-dz-ink">
                <X aria-hidden className="h-5 w-5" />
              </button>
            </Container>
            <Container className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6">
              <ul className="sm:grid sm:grid-cols-2 sm:gap-x-8">
                {SITE_NAV.map((item, i) => (
                  <motion.li key={item.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.04 * i, ease: EASE }}>
                    <NavLink to={item.to} className="group block border-b border-dz-line py-4">
                      {({ isActive }) => (
                        <>
                          <span className={cn('block text-[26px] font-black tracking-[-0.03em]', isActive ? 'text-dz-ink' : 'text-dz-ink group-hover:text-dz-brand')}>{t(`site.nav.${item.key}`)}</span>
                          <span className="mt-0.5 block text-[15px] font-medium leading-snug text-dz-ink3">{t(`site.navDesc.${item.key}`)}</span>
                        </>
                      )}
                    </NavLink>
                  </motion.li>
                ))}
              </ul>
              <div className="mt-auto space-y-3 pt-8">
                <LangSwitch className="w-fit" />
                <Link to="/douane/simulateur" className={buttonClass('primary', 'lg', 'w-full')}>{t('site.cta')}</Link>
                <Link to={account.to} className={buttonClass('secondary', 'lg', 'w-full')}>{account.label}</Link>
              </div>
            </Container>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Footer() {
  const { t } = useTranslation('customs');
  const year = new Date().getFullYear();
  return (
    <footer className="bg-dz-card">
      <Container className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:py-20">
        <div className="space-y-3">
          <Brand />
          <p className="max-w-[34ch] text-[15px] font-medium leading-relaxed text-dz-ink3">{t('site.footerTagline')}</p>
        </div>
        <FooterCol title={t('site.footerTools')}>
          {SITE_NAV.map((i) => <li key={i.key}><Link className="hover:text-dz-ink" to={i.to}>{t(`site.nav.${i.key}`)}</Link></li>)}
        </FooterCol>
        <FooterCol title="Bonzini Labs">
          <li><Link className="hover:text-dz-ink" to="/">{t('site.footerPay')}</Link></li>
          <li><Link className="hover:text-dz-ink" to="/douane/espace">{t('site.mySpace')}</Link></li>
          <li><a className="hover:text-dz-ink" href={whatsappLink(CONTACT_PHONE_CM)} target="_blank" rel="noreferrer">WhatsApp · <span className="whitespace-nowrap">{CONTACT_PHONE_CM}</span></a></li>
        </FooterCol>
        <FooterCol title={t('site.footerLegal')}>
          <li><Link className="hover:text-dz-ink" to="/confidentialite">{t('site.privacy')}</Link></li>
          <li><Link className="hover:text-dz-ink" to="/conditions">{t('site.terms')}</Link></li>
        </FooterCol>
      </Container>
      <Container className="flex flex-col gap-2 border-t border-dz-line py-6 text-[14px] font-medium text-dz-ink3 sm:flex-row sm:justify-between">
        <p>© {year} Bonzini Labs</p>
        <p>{t('site.footerNote')}</p>
      </Container>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-[15px] font-bold text-dz-ink">{title}</p>
      <ul className="space-y-2.5 text-[15px] font-medium text-dz-ink3">{children}</ul>
    </div>
  );
}

export function SiteLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <MotionConfig reducedMotion="user">
      <div className="dz flex min-h-[100dvh] flex-col bg-dz-bg text-dz-ink">
        <Header />
        <motion.main key={pathname} className="flex-1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}>
          {children}
        </motion.main>
        <Footer />
      </div>
    </MotionConfig>
  );
}
