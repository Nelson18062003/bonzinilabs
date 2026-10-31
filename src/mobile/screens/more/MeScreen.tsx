/**
 * Moi, version site — refonte v2 (maquettes 01/02 et 01/04). L'identité,
 * « Modifier mon profil », puis Mon compte : mot de passe, clés d'accès
 * (site seulement, comme avant), langue ; « Se déconnecter » confirmé par une
 * feuille. Face ID, notifications push et mises à jour vivent dans l'écran
 * natif Moi de l'app BONZINI HQ : dans l'app, une ligne y mène.
 */
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Globe, KeyRound, Lock, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { languageNames } from '@/i18n';
import { isNativeApp } from '@/lib/nativeApp';
import { postToApp } from '@/lib/nativeBridge';
import { roleLabel } from '@/lib/team';
import { cn } from '@/lib/utils';
import { BigButton, BottomSheet, ConfirmSheet, FOCUS_RING, Initials, ScreenTop, SURFACE, TEXT, useSheet } from '@/mobile/designKit';
import { CapsLabel, SettingRow } from './parts';
import { LanguageTiles, useLanguage } from './SettingsV2';

export function MeScreen() {
  const navigate = useNavigate();
  const { currentUser, profile, logout } = useAdminAuth();
  const native = isNativeApp();
  const { lang } = useLanguage();
  const langSheet = useSheet();
  const logoutSheet = useSheet();
  const keys = useQuery({
    queryKey: ['admin-passkeys-count'],
    enabled: !native,
    staleTime: 60_000,
    queryFn: async () => {
      const { count, error } = await supabaseAdmin.from('webauthn_credentials').select('id', { count: 'exact', head: true });
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  });

  const first = profile?.first_name ?? currentUser?.firstName ?? '';
  const last = profile?.last_name ?? currentUser?.lastName ?? '';
  const name = `${first} ${last}`.trim() || 'Mon profil';
  const avatar = profile?.avatar_url ?? currentUser?.avatarUrl ?? null;
  const doLogout = async () => {
    try {
      await logout();
      navigate('/m/login', { replace: true });
    } catch {
      toast.error('La déconnexion a échoué. Réessayez.');
    }
  };

  return (
    <div className="flex min-h-full flex-col pb-10">
      <ScreenTop title="Moi" />
      <div className="flex flex-col items-center px-5 pt-7 text-center">
        {avatar ? <img src={avatar} alt="" className="h-24 w-24 rounded-full object-cover" /> : <Initials name={name} size={96} />}
        <h2 className={cn('mt-4 text-[28px] font-bold leading-tight', TEXT.strong)}>{name}</h2>
        <p className={cn('mt-1 text-[17px]', TEXT.muted)}>{[currentUser ? roleLabel(currentUser.role) : null, currentUser?.email].filter(Boolean).join(' · ')}</p>
        <button type="button" onClick={() => navigate('/m/more/profile/edit')} className={cn('mt-4 h-12 rounded-lg border px-5 text-[17px] font-semibold active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.divider, FOCUS_RING, TEXT.strong)}>
          Modifier mon profil
        </button>
      </div>

      <div className="px-5 pt-8">
        {native && (
          <>
            <CapsLabel>Sur ce téléphone</CapsLabel>
            <SettingRow icon={Smartphone} label="Face ID, notifications, mise à jour" onClick={() => postToApp({ type: 'open-me' })} />
            <div className="h-6" />
          </>
        )}
        <CapsLabel>Mon compte</CapsLabel>
        <SettingRow icon={Lock} label="Mot de passe" onClick={() => navigate('/m/more/password')} />
        {!native && (
          <SettingRow icon={KeyRound} label="Clés d'accès" value={keys.data != null ? `${keys.data} appareil${keys.data > 1 ? 's' : ''}` : undefined} onClick={() => navigate('/m/more/passkeys')} />
        )}
        <SettingRow icon={Globe} label="Langue" value={languageNames[lang] ?? lang} onClick={langSheet.show} />
      </div>

      {!native && (
        <div className="px-5 pt-10">
          <BigButton variant="soft" onClick={logoutSheet.show}>Se déconnecter</BigButton>
        </div>
      )}

      <BottomSheet open={langSheet.open} onClose={langSheet.hide} title="Langue">
        <LanguageTiles />
        <BigButton className="mt-5" onClick={langSheet.hide}>Terminé</BigButton>
      </BottomSheet>
      <ConfirmSheet
        open={logoutSheet.open}
        onClose={logoutSheet.hide}
        title="Se déconnecter ?"
        confirmLabel="Se déconnecter"
        onConfirm={() => void doLogout()}
      />
    </div>
  );
}
