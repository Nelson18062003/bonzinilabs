/**
 * Les pièces communes des pages Douane (docs/douane/00-plan.md).
 *
 * Le simulateur est public, comme celui de Flexport : un lien partagé sur
 * WhatsApp doit s'ouvrir sans compte. Le même écran vit donc dans deux
 * coquilles — celle de l'app client quand on est connecté, une coquille nue
 * avec « Se connecter » sinon — et dans l'espace équipe (variant 'admin').
 */
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAuth } from '@/contexts/AuthContext';
import { IconButton, Button, SURFACE, TEXT, TYPE } from '@/mobile/designKit';

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
  const navigate = useNavigate();
  const { user } = useAuth();
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

  const header = (
    <div className="flex items-center gap-3 px-4 pb-1 pt-4">
      <IconButton icon={ArrowLeft} ariaLabel={t('sim.back', { defaultValue: 'Retour' })} onClick={() => navigate(backTo)} size="sm" />
      <div className="min-w-0 flex-1">
        <h1 className={cn('text-[18px] font-semibold leading-tight', TEXT.strong)}>{title}</h1>
        {subtitle && <p className={cn('text-[14px]', TEXT.muted)}>{subtitle}</p>}
      </div>
      {!user && (
        <Button size="sm" variant="neutral" onClick={() => navigate('/auth')} className="shrink-0 px-3">
          {t('hub.signIn', { defaultValue: 'Se connecter' })}
        </Button>
      )}
    </div>
  );

  if (user) {
    return (
      <MobileLayout showNav={false} showHeader={false}>
        <div className={cn('min-h-[100dvh]', SURFACE.canvas)}>
          {header}
          {children}
        </div>
      </MobileLayout>
    );
  }
  return (
    <div className={cn('min-h-[100dvh]', SURFACE.canvas)}>
      <div className="mx-auto w-full max-w-5xl">
        {header}
        {children}
      </div>
    </div>
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

/** Un titre de section numéroté, comme une question posée au client. */
export function StepTitle({ n, children }: { n: number; children: ReactNode }) {
  return (
    <h2 className={cn('flex items-baseline gap-2', TYPE.lead, TEXT.strong)}>
      <span className={cn('tabular-nums', TEXT.muted)}>{n}.</span>
      <span>{children}</span>
    </h2>
  );
}
