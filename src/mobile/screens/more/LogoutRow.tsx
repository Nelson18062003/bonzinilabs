/**
 * « Se déconnecter » en bas de Plus (sur le site seulement : dans l'app
 * BONZINI HQ, la déconnexion est dans l'écran natif Moi), avec sa feuille de
 * confirmation.
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { isNativeApp } from '@/lib/nativeApp';
import { ConfirmSheet, IconCircle, ItemRow, useSheet } from '@/mobile/designKit';

export function LogoutRow({ loginPath }: { loginPath: string }) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { logout } = useAdminAuth();
  const sheet = useSheet();
  if (isNativeApp()) return null;
  const label = t('logout', { defaultValue: 'Se déconnecter' });
  const doLogout = async () => {
    try {
      await logout();
      navigate(loginPath, { replace: true });
    } catch {
      toast.error(t('logoutFailed', { defaultValue: 'La déconnexion a échoué. Réessayez.' }));
    }
  };
  return (
    <>
      <ItemRow leading={<IconCircle icon={LogOut} tone="danger" />} title={label} onClick={sheet.show} />
      <ConfirmSheet open={sheet.open} onClose={sheet.hide} title={t('logoutConfirm', { defaultValue: 'Se déconnecter ?' })} confirmLabel={label} onConfirm={doLogout} />
    </>
  );
}
