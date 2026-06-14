import { useTranslation } from 'react-i18next';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAdminAuth, ADMIN_ROLE_LABELS, type AppRole } from '@/contexts/AdminAuthContext';
import { Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, Card, Row, SectionTitle, StatusPill, roleMeta } from '@/mobile/designKit';

export function MobileSettingsScreen({ desktop = false }: { desktop?: boolean } = {}) {
  const { t } = useTranslation('common');
  const { profile } = useAdminAuth();
  const role = profile?.role;

  return (
    <div className={desktop ? 'mx-auto max-w-2xl' : 'flex min-h-full flex-col'}>
      {desktop ? (
        <header className="mb-6">
          <h2 className={cn('text-[24px] font-extrabold tracking-tight', TEXT.strong)}>
            {t('settings', { defaultValue: 'Paramètres' })}
          </h2>
          <p className={cn('mt-0.5 text-[14px]', TEXT.muted)}>Apparence, compte et informations</p>
        </header>
      ) : (
        <MobileHeader title={t('settings', { defaultValue: 'Paramètres' })} showBack />
      )}

      <div className={cn(desktop ? 'space-y-5' : 'flex-1 space-y-5 px-4 py-5', !desktop && SURFACE.canvas)}>
        {/* Apparence */}
        <div>
          <SectionTitle>{t('appearance', { defaultValue: 'Apparence' })}</SectionTitle>
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <Palette className={cn('h-4 w-4', TEXT.muted)} />
              <p className={cn('text-[14px] font-semibold', TEXT.strong)}>
                {t('appTheme', { defaultValue: "Thème de l'application" })}
              </p>
            </div>
            <ThemeToggle />
            <p className={cn('mt-3 text-[12px]', TEXT.muted)}>
              {t('systemModeNote', { defaultValue: "Le mode Système s'adapte automatiquement aux préférences de votre appareil." })}
            </p>
          </Card>
        </div>

        {/* Compte */}
        <div>
          <SectionTitle>{t('account', { defaultValue: 'Compte' })}</SectionTitle>
          <Card>
            <Row
              label={t('name', { defaultValue: 'Nom' })}
              value={`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || '—'}
            />
            <div className="flex items-center justify-between gap-3 py-[7px] text-[13.5px]">
              <span className={TEXT.muted}>{t('role', { defaultValue: 'Rôle' })}</span>
              <StatusPill
                tone={role ? roleMeta(role).tone : 'neutral'}
                label={role ? (ADMIN_ROLE_LABELS[role as AppRole] || role) : 'Admin'}
              />
            </div>
          </Card>
        </div>

        {/* À propos */}
        <div>
          <SectionTitle>{t('about', { defaultValue: 'À propos' })}</SectionTitle>
          <Card>
            <Row label="Version" value="1.0.0" />
            <Row label="Plateforme" value="Bonzini Admin" />
          </Card>
        </div>
      </div>
    </div>
  );
}
