import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Loader2, Trash2, Archive, AlertTriangle, ArchiveRestore } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { PhoneInputWithCountry, TextField } from '@/components/form';
import { PrimaryPill, SOFT_CARD } from '@/components/treasury/ui';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  useCounterparties,
  useDeleteCounterparty,
  useUpdateCounterparty,
} from '@/hooks/useTreasury';
import { cn } from '@/lib/utils';

export function MobileCounterpartyEdit({ desktop = false }: { desktop?: boolean } = {}) {
  const { counterpartyId } = useParams<{ counterpartyId: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();

  // Pull from both supplier and buyer lists (includes archived).
  const suppliers = useCounterparties('usdt_supplier', true);
  const buyers = useCounterparties('cny_buyer', true);
  const all = [...(suppliers.data ?? []), ...(buyers.data ?? [])];
  const cp = all.find((c) => c.id === counterpartyId);

  const update = useUpdateCounterparty();
  const del = useDeleteCounterparty();

  const [displayName, setDisplayName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const [wechat, setWechat] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (cp) {
      setDisplayName(cp.display_name);
      setLegalName(cp.legal_name ?? '');
      setPhone(cp.phone ?? null);
      setWechat(cp.wechat_id ?? '');
      setNotes(cp.notes ?? '');
    }
  }, [cp]);

  if (!hasPermission('canManageTreasury')) {
    return <Navigate to="/m/more" replace />;
  }

  const isLoading = suppliers.isLoading || buyers.isLoading;

  if (isLoading) {
    return (
      <div className={desktop ? 'mx-auto max-w-2xl' : 'flex flex-col min-h-full bg-background'}>
        {desktop ? <h2 className="mb-4 text-[24px] font-extrabold tracking-tight text-foreground">Contrepartie</h2> : <MobileHeader title="Contrepartie" showBack />}
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!cp) {
    return (
      <div className={desktop ? 'mx-auto max-w-2xl' : 'flex flex-col min-h-full bg-background'}>
        {desktop ? <h2 className="mb-4 text-[24px] font-extrabold tracking-tight text-foreground">Contrepartie</h2> : <MobileHeader title="Contrepartie" showBack />}
        <div className="py-8 text-center text-muted-foreground">Introuvable.</div>
      </div>
    );
  }

  const isSupplier = cp.type === 'usdt_supplier';
  const toneBadge = isSupplier ? 'bg-violet-500/10 text-bonzini-violet' : 'bg-amber-500/10 text-bonzini-amber';
  const nameValid = displayName.trim().length >= 2;

  const handleSave = async () => {
    if (!nameValid) return;
    const result = await update.mutateAsync({
      id: cp.id,
      display_name: displayName.trim(),
      legal_name: legalName.trim() || null,
      phone: phone || null,
      wechat_id: wechat.trim() || null,
      notes: notes.trim() || null,
    });
    if (result.success) navigate('/m/more/treasury/counterparties');
  };

  const handleToggleActive = async () => {
    await update.mutateAsync({ id: cp.id, is_active: !cp.is_active });
  };

  const handleDelete = async () => {
    const result = await del.mutateAsync(cp.id);
    if (result.success) {
      setConfirmDelete(false);
      navigate('/m/more/treasury/counterparties');
    }
  };

  return (
    <div className={desktop ? 'mx-auto max-w-2xl' : 'flex flex-col min-h-full bg-background'}>
      {desktop ? (
        <header className="mb-5">
          <h2 className="text-[24px] font-extrabold tracking-tight text-foreground">{cp.display_name}</h2>
          <p className="mt-0.5 text-[14px] text-muted-foreground">Modifier la contrepartie</p>
        </header>
      ) : (
        <MobileHeader title={cp.display_name} showBack backTo="/m/more/treasury/counterparties" />
      )}

      <div className={desktop ? 'space-y-4' : 'px-5 py-5 space-y-4'}>
        {/* Header */}
        <div className={cn(SOFT_CARD, 'flex items-center justify-between p-4')}>
          <div>
            <span className={cn('inline-block rounded-lg px-2 py-1 text-[11px] font-bold', toneBadge)}>{cp.short_id}</span>
            <div className="mt-1.5 text-[11px] text-muted-foreground">{isSupplier ? 'Fournisseur USDT' : 'Acheteur CNY'}</div>
          </div>
          {!cp.is_active && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground">
              <Archive className="h-3 w-3" />
              Archivée
            </span>
          )}
        </div>

        {/* Form */}
        <div className="space-y-3">
          <TextField label="Nom" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <TextField label="Entreprise" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
          <PhoneInputWithCountry label="Téléphone" value={phone} onValueChange={setPhone} defaultDialCode={isSupplier ? '+237' : '+86'} />
          {!isSupplier && <TextField label="WeChat ID" value={wechat} onChange={(e) => setWechat(e.target.value)} />}
          <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <PrimaryPill onClick={handleSave} disabled={!nameValid} loading={update.isPending}>
          Enregistrer les modifications
        </PrimaryPill>

        {/* Archive / Reactivate */}
        <button
          onClick={handleToggleActive}
          disabled={update.isPending}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-muted text-[14px] font-bold text-foreground transition active:scale-[0.99] disabled:opacity-50"
        >
          {cp.is_active ? (
            <>
              <Archive className="h-4 w-4" />
              Archiver (masquer des listes)
            </>
          ) : (
            <>
              <ArchiveRestore className="h-4 w-4" />
              Réactiver
            </>
          )}
        </button>

        {/* Delete section */}
        {confirmDelete ? (
          <div className="space-y-3 rounded-2xl bg-red-500/10 p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <span className="text-[13px] font-bold text-red-700 dark:text-red-300">Supprimer définitivement ?</span>
            </div>
            <p className="text-[12px] leading-snug text-red-700 dark:text-red-300">
              Suppression possible uniquement si aucune opération n’est liée. Sinon, archive plutôt.
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => setConfirmDelete(false)}
                className="h-12 flex-1 rounded-2xl bg-muted text-[14px] font-bold text-foreground transition active:scale-[0.99]"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={del.isPending}
                className={cn(
                  'flex h-12 flex-1 items-center justify-center rounded-2xl text-[14px] font-bold transition active:scale-[0.99]',
                  del.isPending ? 'bg-muted text-muted-foreground' : 'bg-red-600 text-white hover:bg-red-700',
                )}
              >
                {del.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Supprimer'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-red-500/10 text-[14px] font-bold text-red-600 transition active:scale-[0.99] dark:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
            Supprimer définitivement
          </button>
        )}
      </div>
    </div>
  );
}
