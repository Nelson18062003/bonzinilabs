import { ReactNode } from 'react';
import { MobileTabBar, MOBILE_TAB_BAR_HEIGHT } from './MobileTabBar';
import { AnimatedPage } from '@/components/transitions/AnimatedPage';
import { PasskeyEnrollPrompt } from '@/mobile/components/PasskeyEnrollPrompt';
import { SURFACE } from '@/mobile/designKit';
import { cn } from '@/lib/utils';

interface MobileAppShellProps {
  children: ReactNode;
  showTabBar?: boolean;
  className?: string;
}

/**
 * Coquille des écrans admin mobiles : canvas du kit (blanc), barre du bas
 * plate, et le dégagement exact pour qu'aucun contenu ne passe dessous.
 *
 * `min-h-[100dvh]` et non `min-h-screen` (100vh) : sur iOS, 100vh est le grand
 * viewport (barres repliées) — le document dépasse alors l'écran visible et
 * Safari le fait défiler à l'ouverture du clavier, même verrouillé
 * (`html.viewport-locked`). Avec la hauteur visible, il n'y a rien à défiler.
 */
export function MobileAppShell({ children, showTabBar = true, className }: MobileAppShellProps) {
  return (
    <div className={cn('flex min-h-[100dvh] w-full flex-col', SURFACE.canvas, 'max-w-lg md:max-w-2xl mx-auto', className)}>
      <main
        className="flex-1"
        style={{
          paddingBottom: showTabBar
            ? `calc(${MOBILE_TAB_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px))`
            : 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <AnimatedPage>{children}</AnimatedPage>
      </main>
      {showTabBar && <MobileTabBar />}
      {/* Se montre au plus une fois, puis se tait 14 jours (cf. composant). */}
      <PasskeyEnrollPrompt />
    </div>
  );
}
