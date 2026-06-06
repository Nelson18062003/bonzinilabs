import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Camera, Loader2 } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { validateUploadFile } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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
    <div className="flex flex-col min-h-full">
      <MobileHeader title="Mon profil" showBack />

      <div className="flex-1 px-4 py-6 space-y-6">
        {/* Avatar */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="relative w-24 h-24 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center text-2xl font-semibold text-primary"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Photo de profil" className="w-full h-full object-cover" />
            ) : (
              <span>{initials}</span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 active:opacity-100 transition-opacity">
              {uploading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white" />}
            </span>
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="mt-3 text-sm text-primary font-medium disabled:opacity-50"
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
          <div>
            <label className="text-sm font-medium mb-1.5 block">Prénom *</label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Votre prénom"
              className="w-full h-12 rounded-xl border border-border bg-background px-3 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Nom</label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Votre nom"
              className="w-full h-12 rounded-xl border border-border bg-background px-3 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Email</label>
            <input
              value={currentUser?.email ?? ''}
              disabled
              className="w-full h-12 rounded-xl border border-border bg-muted px-3 text-sm text-muted-foreground"
            />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving || uploading} className="w-full h-12">
          {saving ? (
            <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…</span>
          ) : (
            'Enregistrer'
          )}
        </Button>
      </div>
    </div>
  );
}
