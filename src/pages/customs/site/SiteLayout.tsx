/**
 * La coquille du site Douane — bonzinilabs.com/douane.
 *
 * Par écran :
 *   - téléphone : barre de 56 px, logo et menu ; le menu couvre l'écran, une
 *     grande ligne par outil, la langue et le compte en bas, à portée du pouce ;
 *   - tablette (≥ 640 px) : le bouton du compte s'ajoute dans la barre ;
 *   - ordinateur (≥ 1280 px) : barre de 64 px, les cinq outils en clair, la
 *     langue (un bouton) et le compte à droite.
 * Sur la bande sombre de l'accueil (`hero`), la barre est transparente et
 * passe au clair dès qu'on défile.
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

function LangSwitch({ night, className }: { night?: boolean; className?: string }) {
  const { i18n, t } = useTranslation('customs');
  const current = (i18n.language?.slice(0, 2) ?? 'fr') as SupportedLanguage;
  return (
    <div role="group" aria-label={t('site.language')} className={cn('flex items-center rounded-full p-0.5', night ? 'bg-white/10' : 'bg-dz-soft', className)}>
      {supportedLanguages.map((l) => (
        <button key={l} type="button" aria-pressed={current === l}
          onClick={() => { void i18n.changeLanguage(l); void persistPreferredLocale(l); }}
          className={cn('h-8 min-w-10 rounded-full px-2.5 text-[14px] font-semibold transition-colors',
            current === l
              ? night ? 'bg-white text-[#130d1e]' : 'bg-dz-card text-dz-ink shadow-sm'
              : night ? 'text-white/70 hover:text-white' : 'text-dz-ink3 hover:text-dz-ink')}>
          {LANG_LABEL[l]}
        </button>
      ))}
    </div>
  );
}

/** Barre du haut, ordinateur : la langue tient en un bouton. */
function LangMenu({ night }: { night?: boolean }) {
  const { i18n, t } = useTranslation('customs');
  const current = (i18n.language?.slice(0, 2) ?? 'fr') as SupportedLanguage;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={t('site.language')}
        className={cn('inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[14px] font-semibold transition-colors',
          night ? 'text-white/80 hover:bg-white/10 hover:text-white' : 'text-dz-ink2 hover:bg-dz-soft hover:text-dz-ink')}>
        <Globe aria-hidden className="h-4 w-4" /> {LANG_LABEL[current]}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="dz min-w-[140px] rounded-xl border-dz-line bg-dz-card p-1 text-dz-ink">
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

function Brand({ night }: { night?: boolean }) {
  const { t } = useTranslation('customs');
  return (
    <Link to="/douane" className="flex shrink-0 items-center gap-2.5 whitespace-nowrap" aria-label={t('site.homeLabel')}>
      <BonziniLogo size={30} />
      <span className={cn('text-[17px] font-bold tracking-tight', night ? 'text-white' : 'text-dz-ink')}>Bonzini Labs</span>
      <span className={cn('rounded-md px-1.5 py-0.5 text-[13px] font-semibold', night ? 'bg-white/10 text-white/80' : 'bg-dz-brand-soft text-dz-brand')}>{t('site.badge')}</span>
    </Link>
  );
}

function Header({ night }: { night: boolean }) {
  const { t } = useTranslation('customs');
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', esc); };
  }, [open]);

  const dark = night && !scrolled;
  const account = user
    ? { to: '/douane/espace', label: t('site.mySpace') }
    : { to: '/auth', label: t('site.signIn') };

  return (
    <>
      <header className={cn('sticky top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-300',
        dark ? 'border-b border-transparent bg-transparent' : 'border-b border-dz-line/80 bg-dz-bg/85 backdrop-blur-xl backdrop-saturate-150')}>
        <Container className="flex h-14 items-center justify-between gap-4 lg:h-16">
          <Brand night={dark} />

          <nav aria-label={t('site.navLabel')} className="hidden items-center gap-0.5 xl:flex">
            {SITE_NAV.map((item) => (
              <NavLink key={item.key} to={item.to}
                className={({ isActive }) => cn('relative whitespace-nowrap rounded-full px-3 py-2 text-[15px] font-medium transition-colors',
                  dark ? (isActive ? 'text-white' : 'text-white/70 hover:text-white') : (isActive ? 'text-dz-ink' : 'text-dz-ink3 hover:text-dz-ink'))}>
                {({ isActive }) => (
                  <>
                    {t(`site.nav.${item.key}`)}
                    {isActive && <motion.span layoutId="dz-nav-active" className={cn('absolute inset-x-3 -bottom-[13px] h-[2px] rounded-full', dark ? 'bg-white' : 'bg-dz-brand')} />}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden xl:block"><LangMenu night={dark} /></span>
            <Link to={account.to} className={cn(buttonClass(dark ? 'secondary' : 'primary', 'sm'), 'hidden sm:inline-flex', dark && 'border-white/20 bg-white/10 text-white hover:bg-white/15')}>
              {account.label}
            </Link>
            <button type="button" onClick={() => setOpen(true)} aria-label={t('site.menu')} aria-expanded={open}
              className={cn('flex h-11 w-11 items-center justify-center rounded-full xl:hidden', dark ? 'text-white hover:bg-white/10' : 'text-dz-ink hover:bg-dz-soft')}>
              <Menu aria-hidden className="h-6 w-6" />
            </button>
          </div>
        </Container>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div key="menu" role="dialog" aria-modal="true" aria-label={t('site.menu')}
            className="dz fixed inset-0 z-50 flex flex-col bg-dz-bg xl:hidden"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <Container className="flex h-14 shrink-0 items-center justify-between">
              <Brand />
              <button type="button" onClick={() => setOpen(false)} aria-label={t('site.close')}
                className="flex h-11 w-11 items-center justify-center rounded-full text-dz-ink hover:bg-dz-soft">
                <X aria-hidden className="h-6 w-6" />
              </button>
            </Container>
            <Container className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
              <ul className="space-y-1 sm:grid sm:grid-cols-2 sm:gap-2 sm:space-y-0">
                {SITE_NAV.map((item, i) => (
                  <motion.li key={item.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.04 * i, ease: EASE }}>
                    <NavLink to={item.to} className={({ isActive }) => cn('flex items-center gap-4 rounded-2xl p-3 transition-colors', isActive ? 'bg-dz-soft' : 'hover:bg-dz-soft')}>
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-dz-brand-soft text-dz-brand"><item.icon aria-hidden className="h-5 w-5" /></span>
                      <span className="min-w-0">
                        <span className="block text-[17px] font-semibold text-dz-ink">{t(`site.nav.${item.key}`)}</span>
                        <span className="block text-[14px] leading-snug text-dz-ink3">{t(`site.navDesc.${item.key}`)}</span>
                      </span>
                    </NavLink>
                  </motion.li>
                ))}
              </ul>
              <div className="mt-auto space-y-4 pt-8">
                <LangSwitch className="w-fit" />
                <Link to={account.to} className={buttonClass('primary', 'lg', 'w-full')}>{account.label}</Link>
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
    <footer className="border-t border-dz-line bg-dz-soft">
      <Container className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:py-16">
        <div className="space-y-3">
          <Brand />
          <p className="max-w-[34ch] text-[15px] leading-relaxed text-dz-ink3">{t('site.footerTagline')}</p>
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
      <Container className="flex flex-col gap-2 border-t border-dz-line py-6 text-[14px] text-dz-ink3 sm:flex-row sm:justify-between">
        <p>© {year} Bonzini Labs</p>
        <p>{t('site.footerNote')}</p>
      </Container>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-[14px] font-semibold uppercase tracking-[0.1em] text-dz-ink">{title}</p>
      <ul className="space-y-2.5 text-[15px] text-dz-ink3">{children}</ul>
    </div>
  );
}

export function SiteLayout({ children, hero }: { children: ReactNode; hero?: ReactNode }) {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  const night = !!hero;
  return (
    <MotionConfig reducedMotion="user">
      <div className="dz flex min-h-[100dvh] flex-col bg-dz-bg text-dz-ink">
        <Header night={night} />
        {/* La bande sombre de l'accueil remonte sous la barre, transparente à cet endroit. */}
        {hero && <div className="dz-night -mt-14 pt-14 lg:-mt-16 lg:pt-16">{hero}</div>}
        <motion.main key={pathname} className="flex-1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}>
          {children}
        </motion.main>
        <Footer />
      </div>
    </MotionConfig>
  );
}
