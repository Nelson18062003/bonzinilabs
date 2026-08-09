// ============================================================
// « Connexion rapide » — gestion des clés d'accès (passkeys) de l'admin.
//
// Un appareil enrôlé ici permet de se connecter en regardant son téléphone,
// sans mot de passe ni code. On peut le révoquer à tout moment — c'est ce
// qu'on fait en cas de perte ou de vol.
// ============================================================
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { isPasskeySupported, registerPasskey } from '@/lib/passkey';
import { SURFACE, TEXT, Card, SectionTitle, PrimaryPill } from '@/mobile/designKit';
import { Fingerprint, Trash2, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PasskeyRow {
  id: string;
  device_label: string | null;
  backed_up: boolean;
  created_at: string;
  last_used_at: string | null;
}

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

export function MobilePasskeysScreen({ desktop = false }: { desktop?: boolean } = {}) {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    void isPasskeySupported().then(setSupported);
  }, []);

  const { data: passkeys, isLoading } = useQuery({
    queryKey: ['admin-passkeys'],
    queryFn: async (): Promise<PasskeyRow[]> => {
      const { data, error } = await supabaseAdmin
        .from('webauthn_credentials')
        .select('id, device_label, backed_up, created_at, last_used_at')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const result = await registerPasskey();
      // `success: false` sans message = l'utilisateur a fermé la feuille système.
      if (!result.success && result.error) throw new Error(result.error);
      return result.success;
    },
    onSuccess: (added) => {
      if (!added) return;
      toast.success(t('passkeyAdded', { defaultValue: 'Connexion rapide activée sur cet appareil' }));
      void queryClient.invalidateQueries({ queryKey: ['admin-passkeys'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabaseAdmin.rpc('admin_revoke_passkey', { p_credential: id });
      if (error) throw new Error(error.message);
      const result = data as { success?: boolean; error?: string };
      if (!result?.success) throw new Error(result?.error ?? 'Révocation impossible');
    },
    onSuccess: () => {
      toast.success(t('passkeyRevoked', { defaultValue: 'Appareil révoqué' }));
      void queryClient.invalidateQueries({ queryKey: ['admin-passkeys'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className={desktop ? 'mx-auto max-w-2xl' : 'flex min-h-full flex-col'}>
      {desktop ? (
        <header className="mb-6">
          <h2 className={cn('text-[24px] font-extrabold tracking-tight', TEXT.strong)}>
            {t('quickSignIn', { defaultValue: 'Connexion rapide' })}
          </h2>
          <p className={cn('mt-0.5 text-[14px]', TEXT.muted)}>
            {t('quickSignInSubtitle', { defaultValue: 'Vos appareils autorisés à se connecter sans mot de passe' })}
          </p>
        </header>
      ) : (
        <MobileHeader title={t('quickSignIn', { defaultValue: 'Connexion rapide' })} showBack />
      )}

      <div className={cn(desktop ? 'space-y-5' : 'flex-1 space-y-5 px-4 py-5', !desktop && SURFACE.canvas)}>
        <Card>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EDEAFA] text-[#5B4CC4] dark:bg-[#2F2C3D] dark:text-[#B5AAF0]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <p className={cn('text-[13px] leading-relaxed', TEXT.muted)}>
              {t('passkeyExplainer', {
                defaultValue:
                  "Votre téléphone garde une clé secrète qu'il ne partage jamais — même avec nous. Face ID, empreinte ou code de déverrouillage servent uniquement à la débloquer.",
              })}
            </p>
          </div>
        </Card>

        <div>
          <SectionTitle>{t('myDevices', { defaultValue: 'Mes appareils' })}</SectionTitle>
          <Card>
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className={cn('h-5 w-5 animate-spin', TEXT.muted)} />
              </div>
            ) : !passkeys?.length ? (
              <p className={cn('py-3 text-[13.5px]', TEXT.muted)}>
                {t('noPasskeyYet', { defaultValue: "Aucun appareil pour l'instant." })}
              </p>
            ) : (
              <ul className="divide-y divide-black/5 dark:divide-white/5">
                {passkeys.map((passkey) => (
                  <li key={passkey.id} className="flex items-center gap-3 py-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EDEAFA] text-[#2C2740] dark:bg-[#2F2C3D] dark:text-[#E7E5F0]">
                      <Fingerprint className="h-[18px] w-[18px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn('truncate text-[14px] font-semibold', TEXT.strong)}>
                        {passkey.device_label ?? t('device', { defaultValue: 'Appareil' })}
                      </p>
                      <p className={cn('text-[12px]', TEXT.muted)}>
                        {passkey.last_used_at
                          ? t('lastUsedOn', { defaultValue: 'Dernière utilisation le {{date}}', date: formatDate(passkey.last_used_at) })
                          : t('addedOn', { defaultValue: 'Ajouté le {{date}}', date: formatDate(passkey.created_at) })}
                        {passkey.backed_up && ` · ${t('synced', { defaultValue: 'synchronisé' })}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => revokeMutation.mutate(passkey.id)}
                      disabled={revokeMutation.isPending}
                      aria-label={t('revokeDevice', { defaultValue: 'Révoquer cet appareil' })}
                      className="shrink-0 rounded-full p-2 text-[#C0504D] transition hover:bg-[#FBE7E7] disabled:opacity-50 dark:text-[#E79A9A] dark:hover:bg-[#3A2526]"
                    >
                      <Trash2 className="h-[18px] w-[18px]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {supported === false ? (
          <p className={cn('px-1 text-[12.5px]', TEXT.muted)}>
            {t('passkeyUnsupported', {
              defaultValue:
                "Cet appareil ne gère pas les clés d'accès. Essayez depuis votre téléphone.",
            })}
          </p>
        ) : (
          <PrimaryPill
            onClick={() => addMutation.mutate()}
            loading={addMutation.isPending || supported === null}
            className="w-full"
          >
            <Fingerprint className="h-[17px] w-[17px]" />
            {t('addThisDevice', { defaultValue: 'Ajouter cet appareil' })}
          </PrimaryPill>
        )}
      </div>
    </div>
  );
}
