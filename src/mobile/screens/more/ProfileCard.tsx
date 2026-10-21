/**
 * La carte « Moi » en tête de « Plus », pour TOUS les rôles (refonte v2,
 * maquette 01-navigation/01). Dans l'app BONZINI HQ, elle ouvre l'écran
 * natif Moi (Face ID, notifications, mises à jour) ; sur le site, la page
 * de profil — ou rien, pour un espace qui n'en a pas (la carte reste une
 * simple carte d'identité).
 */
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { isNativeApp } from '@/lib/nativeApp';
import { postToApp } from '@/lib/nativeBridge';
import { roleLabel } from '@/lib/team';
import { cn } from '@/lib/utils';
import { FOCUS_RING, Initials, SURFACE, TEXT } from '@/mobile/designKit';

export function ProfileCard({ webPath, className }: { webPath?: string; className?: string }) {
  const navigate = useNavigate();
  const { currentUser } = useAdminAuth();
  const name = [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(' ') || 'Mon profil';
  const native = isNativeApp();
  const clickable = native || !!webPath;
  const open = () => (native ? postToApp({ type: 'open-me' }) : webPath && navigate(webPath));
  const Wrapper = clickable ? 'button' : 'div';
  return (
    <Wrapper
      type={clickable ? 'button' : undefined}
      onClick={clickable ? open : undefined}
      className={cn('flex w-full items-center gap-3.5 rounded-lg border px-4 py-3.5 text-left', clickable && cn('active:bg-[#F5F5F5] dark:active:bg-[#383838]', FOCUS_RING), SURFACE.divider, className)}
    >
      {currentUser?.avatarUrl ? (
        <img src={currentUser.avatarUrl} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
      ) : (
        <Initials name={name} size={56} />
      )}
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[18px] font-semibold', TEXT.strong)}>{name}</span>
        <span className={cn('block truncate text-[15px]', TEXT.muted)}>{currentUser ? roleLabel(currentUser.role) : ''}</span>
      </span>
      {clickable && (
        <>
          <span className={cn('shrink-0 text-[16px] font-semibold', TEXT.strong)}>Moi</span>
          <ChevronRight className={cn('-ml-1 h-5 w-5 shrink-0', TEXT.muted)} />
        </>
      )}
    </Wrapper>
  );
}
