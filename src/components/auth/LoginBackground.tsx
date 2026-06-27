import { cn } from '@/lib/utils';
import { SURFACE } from '@/mobile/designKit';

interface LoginBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Cadre des écrans d'auth — refonte « Direction A ».
 * Canvas calme du designKit (plus de dégradé violet ni de halos animés).
 */
export function LoginBackground({ children, className }: LoginBackgroundProps) {
  return (
    <div className={cn('flex min-h-screen flex-col', SURFACE.canvas, className)}>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
