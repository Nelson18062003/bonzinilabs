/**
 * Mon compte — refonte v2 : Mon profil (10/67), Mot de passe (10/68),
 * Clés d'accès (10/69). Mêmes appels qu'avant : update_my_admin_profile et
 * le bucket `avatars` (validateUploadFile), changeOwnPassword (10 caractères
 * au moins, sans l'ancien : la session ouverte en est la preuve),
 * webauthn_credentials + admin_revoke_passkey + registerPasskey.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Eye, EyeOff, Laptop, Lock, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { rpcArgs } from '@/integrations/supabase/rpcArgs';
import { isNativeApp } from '@/lib/nativeApp';
import { isPasskeySupported, registerPasskey } from '@/lib/passkey';
import { cn, validateUploadFile } from '@/lib/utils';
import {
  BigButton, ConfirmSheet, Dock, EmptyLine, FOCUS_RING, IconCircle, Initials, ScreenLoader, ScreenTop, SURFACE, TEXT, TextInput,
} from '@/mobile/designKit';
import { BIG_FIELD, CapsLabel, CheckLine, FieldBlock } from './parts';

/* ── Mon profil ─────────────────────────────────────────────────────────── */

export function ProfileEditV2() {
  const navigate = useNavigate();
  const { currentUser, profile, refreshProfile } = useAdminAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState(profile?.first_name ?? currentUser?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.last_name ?? currentUser?.lastName ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !currentUser) return;
    try { validateUploadFile(file); } catch (err) { toast.error((err as Error).message); return; }
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${currentUser.id}/avatar_${Date.now()}.${ext}`;
      const { error } = await supabaseAdmin.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      setAvatarUrl(supabaseAdmin.storage.from('avatars').getPublicUrl(path).data.publicUrl);
    } catch (err) {
      console.error('[avatar upload]', err);
      toast.error("La photo n'a pas pu être envoyée.");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!firstName.trim()) { toast.error('Le prénom est requis.'); return; }
    setSaving(true);
    const { data, error } = await supabaseAdmin.rpc('update_my_admin_profile', rpcArgs<'update_my_admin_profile'>({
      p_first_name: firstName.trim(),
      p_last_name: lastName.trim(),
      p_avatar_url: avatarUrl || null,
    }));
    setSaving(false);
    if (error || (data && (data as { success?: boolean }).success === false)) { toast.error("L'enregistrement a échoué. Réessayez."); return; }
    await refreshProfile();
    toast.success('Profil mis à jour');
    navigate(-1);
  };

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop title="Mon profil" />
      <div className="flex flex-col items-center px-5 pt-7">
        {avatarUrl ? <img src={avatarUrl} alt="" className="h-28 w-28 rounded-full object-cover" /> : <Initials name={`${firstName} ${lastName}`.trim() || '?'} size={112} />}
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className={cn('mt-4 inline-flex h-12 items-center gap-2 rounded-lg border bg-[#F5F5F5] px-4 text-[17px] font-semibold disabled:opacity-50 dark:bg-[#383838]', SURFACE.divider, FOCUS_RING, TEXT.strong)}>
          <Camera className="h-5 w-5" /> {uploading ? 'Envoi…' : 'Changer la photo'}
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void pick(e)} />
      </div>
      <div className="space-y-6 px-5 pt-7">
        <FieldBlock label="Prénom" htmlFor="me-first">
          <TextInput id="me-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" className={BIG_FIELD} />
        </FieldBlock>
        <FieldBlock label="Nom" htmlFor="me-last">
          <TextInput id="me-last" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" className={BIG_FIELD} />
        </FieldBlock>
        <FieldBlock label="Email · connexion" htmlFor="me-email">
          <div className={cn('flex h-14 items-center gap-3 rounded-lg border bg-[#F5F5F5] px-4 dark:bg-[#383838]', SURFACE.divider)}>
            <span id="me-email" className={cn('min-w-0 flex-1 truncate text-[17px]', TEXT.muted)}>{currentUser?.email ?? ''}</span>
            <Lock className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
          </div>
        </FieldBlock>
      </div>
      <Dock>
        <BigButton onClick={() => void save()} loading={saving} disabled={uploading}>Enregistrer</BigButton>
      </Dock>
    </div>
  );
}

/* ── Mot de passe ───────────────────────────────────────────────────────── */

const MIN_LENGTH = 10;

function SecretInput({ id, value, onChange, show, onToggle, label }: { id: string; value: string; onChange: (v: string) => void; show?: boolean; onToggle?: () => void; label: string }) {
  return (
    <div className="relative">
      <TextInput id={id} type={show ? 'text' : 'password'} autoComplete="new-password" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={cn(BIG_FIELD, onToggle && 'pr-14')} />
      {onToggle && (
        <button type="button" onClick={onToggle} aria-label={show ? 'Masquer' : 'Afficher'} className={cn('absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full', FOCUS_RING, TEXT.muted)}>
          {show ? <EyeOff className="h-6 w-6" /> : <Eye className="h-6 w-6" />}
        </button>
      )}
    </div>
  );
}

/** `doneTo` : où revenir (le commercial : « /v ») ; sinon l'écran d'où l'on vient. */
export function PasswordV2({ doneTo }: { doneTo?: string }) {
  const navigate = useNavigate();
  const { changeOwnPassword } = useAdminAuth();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const longEnough = password.length >= MIN_LENGTH;
  const same = again.length > 0 && again === password;

  const submit = async () => {
    if (!longEnough || !same || busy) return;
    setBusy(true);
    setError('');
    const r = await changeOwnPassword(password);
    setBusy(false);
    if (!r.success) { setError(r.error || 'Une erreur est survenue.'); return; }
    toast.success('Mot de passe mis à jour');
    if (doneTo) navigate(doneTo, { replace: true }); else navigate(-1);
  };

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop title="Mot de passe" />
      <form className="space-y-3 px-5 pt-6" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <CapsLabel><label htmlFor="pw-new">Nouveau mot de passe</label></CapsLabel>
        <SecretInput id="pw-new" label="Nouveau mot de passe" value={password} onChange={(v) => { setPassword(v); setError(''); }} show={show} onToggle={() => setShow(!show)} />
        <CheckLine ok={longEnough}>{MIN_LENGTH} caractères ou plus</CheckLine>
        <div className="h-4" />
        <CapsLabel><label htmlFor="pw-again">Encore une fois</label></CapsLabel>
        <SecretInput id="pw-again" label="Encore une fois" value={again} onChange={(v) => { setAgain(v); setError(''); }} show={show} />
        <CheckLine ok={same}>Les deux sont identiques</CheckLine>
        {error && <p className="pt-2 text-[16px] font-medium text-[#900B09] dark:text-[#FCB3AD]">{error}</p>}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
      <Dock>
        <BigButton onClick={() => void submit()} disabled={!longEnough || !same} loading={busy}>Enregistrer</BigButton>
      </Dock>
    </div>
  );
}

/* ── Clés d'accès ───────────────────────────────────────────────────────── */

interface PasskeyRow { id: string; device_label: string | null; backed_up: boolean; created_at: string; last_used_at: string | null }

const day = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
function used(iso: string | null): string {
  if (!iso) return 'jamais utilisée';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "aujourd'hui" : days === 1 ? 'hier' : `il y a ${days} j`;
}
const isComputer = (label: string | null) => /mac|windows|pc|linux|ordinateur|laptop|chrome os/i.test(label ?? '');

export function PasskeysV2() {
  const qc = useQueryClient();
  const native = isNativeApp();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [revoking, setRevoking] = useState<PasskeyRow | null>(null);
  useEffect(() => { void isPasskeySupported().then(setSupported); }, []);

  const list = useQuery({
    queryKey: ['admin-passkeys'],
    enabled: !native,
    queryFn: async (): Promise<PasskeyRow[]> => {
      const { data, error } = await supabaseAdmin.from('webauthn_credentials').select('id, device_label, backed_up, created_at, last_used_at').order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['admin-passkeys'] }); void qc.invalidateQueries({ queryKey: ['admin-passkeys-count'] }); };
  const add = useMutation({
    mutationFn: async () => {
      const r = await registerPasskey();
      if (!r.success && r.error) throw new Error(r.error);
      return r.success;
    },
    onSuccess: (ok) => { if (ok) { toast.success('Cet appareil est ajouté'); refresh(); } },
    onError: (e: Error) => toast.error(e.message),
  });
  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabaseAdmin.rpc('admin_revoke_passkey', { p_credential: id });
      if (error) throw new Error(error.message);
      const r = data as { success?: boolean; error?: string };
      if (!r?.success) throw new Error(r?.error ?? 'Révocation impossible');
    },
    onSuccess: () => { setRevoking(null); toast.success('Appareil révoqué'); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (native) {
    return (
      <div className="flex min-h-full flex-col">
        <ScreenTop title="Clés d'accès" />
        <EmptyLine>Les clés d'accès se gèrent sur le site.</EmptyLine>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop title="Clés d'accès" />
      {list.isLoading ? (
        <ScreenLoader />
      ) : list.isError ? (
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void list.refetch() }}>La liste n'a pas pu être chargée.</EmptyLine>
      ) : (list.data ?? []).length === 0 ? (
        <EmptyLine>Aucun appareil pour l'instant.</EmptyLine>
      ) : (
        <div className="px-5 pt-2">
          {(list.data ?? []).map((k) => (
            <div key={k.id} className={cn('flex items-center gap-3.5 border-b py-4 last:border-b-0', SURFACE.divider)}>
              <IconCircle icon={isComputer(k.device_label) ? Laptop : Smartphone} />
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate text-[18px] font-semibold', TEXT.strong)}>{k.device_label ?? 'Appareil'}</span>
                <span className={cn('block truncate text-[16px]', TEXT.muted)}>Créée le {day(k.created_at)} · {used(k.last_used_at)}</span>
              </span>
              <button type="button" onClick={() => setRevoking(k)} className={cn('h-11 shrink-0 rounded text-[17px] font-semibold underline underline-offset-[3px]', FOCUS_RING, TEXT.strong)}>Révoquer</button>
            </div>
          ))}
        </div>
      )}
      {supported === false ? (
        <p className={cn('px-5 pt-6 text-[16px]', TEXT.muted)}>Cet appareil ne gère pas les clés d'accès.</p>
      ) : (
        <Dock>
          <BigButton onClick={() => add.mutate()} loading={add.isPending || supported === null}>Ajouter cet appareil</BigButton>
        </Dock>
      )}
      <ConfirmSheet
        open={revoking != null}
        onClose={() => setRevoking(null)}
        title="Révoquer cet appareil ?"
        subtitle={revoking?.device_label ?? 'Appareil'}
        confirmLabel="Révoquer"
        danger
        loading={revoke.isPending}
        onConfirm={() => revoking && revoke.mutate(revoking.id)}
      />
    </div>
  );
}
