/**
 * Les pièces communes des pages Douane (docs/douane/00-plan.md).
 *
 * Côté client, chaque page vit dans le site Douane (bonzinilabs.com/douane) :
 * même barre, même pied de page, connecté ou non — un lien partagé sur
 * WhatsApp s'ouvre sans compte. Côté équipe (variant 'admin'), la coquille
 * de l'espace équipe.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { SURFACE, TEXT, TYPE } from '@/mobile/designKit';
import { SiteLayout } from './site/SiteLayout';
import { PageIntro } from './site/ui';

export type CustomsVariant = 'client' | 'admin';

export function CustomsShell({
  title, subtitle, backTo, variant = 'client', desktop = false, children,
}: {
  title: string;
  subtitle?: string;
  backTo: string;
  variant?: CustomsVariant;
  /** Espace équipe, écran large : pas d'en-tête mobile. */
  desktop?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation('customs');

  if (variant === 'admin') {
    return (
      <div className={desktop ? 'mx-auto max-w-6xl' : 'flex min-h-full flex-col'}>
        {desktop ? (
          <header className="px-5 pb-2 pt-4">
            <h2 className={cn('text-[24px] font-bold tracking-tight', TEXT.strong)}>{title}</h2>
            {subtitle && <p className={cn(TYPE.body, TEXT.muted)}>{subtitle}</p>}
          </header>
        ) : (
          <MobileHeader title={title} showBack backTo={backTo} />
        )}
        <div className={SURFACE.canvas}>{children}</div>
      </div>
    );
  }

  // Côté client : le site Douane (bonzinilabs.com/douane), connecté ou non.
  return (
    <SiteLayout>
      <PageIntro title={title} subtitle={subtitle} back={{ to: backTo, label: backTo === '/douane' ? t('site.badge') : t('sim.back', { defaultValue: 'Retour' }) }} />
      <div className="mx-auto w-full max-w-[1200px] pb-16 sm:px-4">{children}</div>
    </SiteLayout>
  );
}

export function ConfidenceDot({ sure, className }: { sure: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', sure ? 'bg-[#14AE5C]' : 'bg-[#E8B931]', className)}
    />
  );
}
