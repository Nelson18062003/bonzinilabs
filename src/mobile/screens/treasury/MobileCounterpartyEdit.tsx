import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Loader2, Trash2, Archive, AlertTriangle, ArchiveRestore } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { Button } from '@/components/ui/button';
import { PhoneInputWithCountry, TextField } from '@/components/form';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  useCounterparties,
  useDeleteCounterparty,
  useUpdateCounterparty,
} from '@/hooks/useTreasury';
import { cn } from '@/lib/utils';

export function MobileCounterpartyEdit() {
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
      <div className="flex flex-col min-h-full bg-background">
        <MobileHeader title="Contrepartie" showBack />
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!cp) {
    return (
      <div className="flex flex-col min-h-full bg-background">
        <MobileHeader title="Contrepartie" showBack />
        <div className="text-center text-muted-foreground py-8">Introuvable.</div>
      </div>
    );
  }

  const isSupplier = cp.type === 'usdt_supplier';
  const tone = isSupplier ? 'violet' : 'amber';
  const toneClasses: Record<string, string> = {
    violet: 'bg-violet-100 text-violet-700',
    amber: 'bg-amber-100 text-amber-700',
  };

  const handleSave = async () => {
    if (!displayName.trim() || displayName.trim().length < 2) return;
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
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title={cp.display_name} showBack backTo="/m/more/treasury/counterparties" />

      <div className="px-4 py-4 space-y-4">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-border p-3.5 flex items-center justify-between">
          <div>
            <span className={cn('inline-block px-2 py-0.5 rounded-full text-[11px] font-bold', toneClasses[tone])}>
              {cp.short_id}
            </span>
            <div className="text-[11px] text-muted-foreground mt-1">
              {isSupplier ? 'Fournisseur USDT' : 'Acheteur CNY'}
            </div>
          </div>
          {!cp.is_active && (
            <span className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full inline-flex items-center gap-1">
              <Archive className="w-3 h-3" />
              Archivée
            </span>
          )}
        </div>

        {/* Form */}
        <TextField label="Nom *" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <TextField label="Entreprise" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
        <PhoneInputWithCountry
          label="Téléphone"
          value={phone}
          onValueChange={setPhone}
          defaultDialCode={isSupplier ? '+237' : '+86'}
        />
        {!isSupplier && (
          <TextField label="WeChat ID" value={wechat} onChange={(e) => setWechat(e.target.value)} />
        )}
        <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <Button
          onClick={handleSave}
          disabled={update.isPending || !displayName.trim() || displayName.trim().length < 2}
          className="w-full h-11 bg-violet-600 hover:bg-violet-700"
        >
          {update.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enregistrer les modifications'}
        </Button>

        {/* Archive / Reactivate */}
        <Button
          variant="outline"
          onClick={handleToggleActive}
          disabled={update.isPending}
          className="w-full h-10"
        >
          {cp.is_active ? (
            <>
              <Archive className="w-4 h-4 mr-2" />
              Archiver (masquer des listes)
            </>
          ) : (
            <>
              <ArchiveRestore className="w-4 h-4 mr-2" />
              Réactiver
            </>
          )}
        </Button>

        {/* Delete section */}
        <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5 mt-2">
          {confirmDelete ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-700" />
                <span className="text-[13px] font-bold text-red-700">Supprimer définitivement ?</span>
              </div>
              <p className="text-[12px] text-red-700 mb-3">
                Suppression possible uniquement si aucune opération n’est liée. Sinon, archive plutôt.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)} className="flex-1">
                  Annuler
                </Button>
                <Button
                  size="sm"
                  onClick={handleDelete}
                  disabled={del.isPending}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {del.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Supprimer'}
                </Button>
              </div>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(true)}
              className="w-full border-red-300 text-red-700 hover:bg-red-100"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Supprimer définitivement
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
