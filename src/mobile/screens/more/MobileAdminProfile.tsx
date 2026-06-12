import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Camera, Loader2 } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { validateUploadFile, cn } from '@/lib/utils';
import { SURFACE, TEXT, FormField, TextInput, PrimaryPill } from '@/mobile/designKit';

/**
 * Profil admin éditable par soi-même : nom, prénom, photo de profil.
 * - Photo → bucket Storage 'avatars' (dossier = user_id) → URL publique.
 * - Enregistrement via la RPC update_my_admin_profile (SECURITY DEFINER).
 */
export function MobileAdminProfile() {
  const navigate = useNavigate();
  const { currentUser, profile, refreshProfile } = useAdminAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const initials = `${(firstName[0] ?? '').toUpperCase()}${(lastName[0] ?? '').toUpperCase()}` || '?';

  const handlePickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permet de re-sélectionner le même fichier
    if (!file || !currentUser) return;

    try {
      validateUploadFile(file); // MIME + 10 Mo (règle sécurité)
    } catch (err) {
      toast.error((err as Error).message);
      return;
    }

    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${currentUser.id}/avatar_${Date.now()}.${ext}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data } = supabaseAdmin.storage.from('avatars').getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      toast.success('Photo téléchargée');
    } catch (err) {
      toast.error("Échec du téléchargement de la photo.");
      console.error('[avatar upload]', err);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!firstName.trim()) {
      toast.error('Le prénom est requis.');
      return;
    }
    setSaving(true);
    const { data, error } = await supabaseAdmin.rpc('update_my_admin_profile', {
      p_first_name: firstName.trim(),
      p_last_name: lastName.trim(),
      p_avatar_url: avatarUrl || null,
    });
    setSaving(false);

    if (error || (data && (data as { success?: boolean }).success === false)) {
      toast.error("Échec de l'enregistrement. Réessayez.");
      return;
    }
    await refreshProfile();
    toast.success('Profil mis à jour 🎉');
    navigate('/m/more');
  };

  return (
    <div className="flex min-h-full flex-col">
      <MobileHeader title="Mon profil" showBack />

      <div className={cn('flex-1 space-y-6 px-4 py-6', SURFACE.canvas)}>
        {/* Avatar */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className={cn('relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full text-2xl font-bold', SURFACE.holder)}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Photo de profil" className="h-full w-full object-cover" />
            ) : (
              <span>{initials}</span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity active:opacity-100">
              {uploading ? <Loader2 className="h-6 w-6 animate-spin text-white" /> : <Camera className="h-6 w-6 text-white" />}
            </span>
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="mt-3 text-[13px] font-semibold text-[#6B5BD2] disabled:opacity-50 dark:text-[#A99BF0]"
          >
            {uploading ? 'Téléchargement…' : 'Changer la photo'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePickFile}
            className="hidden"
          />
        </div>

        {/* Champs */}
        <div className="space-y-4">
          <FormField label="Prénom *" htmlFor="firstName">
            <TextInput
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Votre prénom"
            />
          </FormField>
          <FormField label="Nom" htmlFor="lastName">
            <TextInput
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Votre nom"
            />
          </FormField>
          <FormField label="Email" htmlFor="email">
            <TextInput
              id="email"
              value={currentUser?.email ?? ''}
              disabled
              className={cn('opacity-70', TEXT.muted)}
            />
          </FormField>
        </div>

        <PrimaryPill
          onClick={handleSave}
          disabled={saving || uploading}
          loading={saving}
          className="w-full"
        >
          Enregistrer
        </PrimaryPill>
      </div>
    </div>
  );
}
