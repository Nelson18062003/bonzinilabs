import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2, Plus, Phone, MessageCircle, Archive } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/form';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCounterparties, useCreateCounterparty } from '@/hooks/useTreasury';
import type { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type CounterpartyType = Database['public']['Enums']['treasury_counterparty_type'];

export function MobileCounterpartiesScreen() {
  const { hasPermission } = useAdminAuth();
  const [tab, setTab] = useState<CounterpartyType>('usdt_supplier');
  const { data, isLoading } = useCounterparties(tab);
  const create = useCreateCounterparty();
  const canManage = hasPermission('canManageTreasury');

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [wechat, setWechat] = useState('');
  const [notes, setNotes] = useState('');

  if (!hasPermission('canViewTreasury')) {
    return <Navigate to="/m/more" replace />;
  }

  const resetForm = () => {
    setName('');
    setCompany('');
    setPhone('');
    setWechat('');
    setNotes('');
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    const result = await create.mutateAsync({
      type: tab,
      display_name: name.trim(),
      legal_name: company.trim() || undefined,
      phone: phone.trim() || undefined,
      wechat_id: wechat.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    if (result.success) resetForm();
  };

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Contreparties" showBack backTo="/m/more/treasury" />

      {/* Tabs */}
      <div className="px-4 pt-4">
        <div className="flex bg-muted rounded-xl p-1">
          {([
            { value: 'usdt_supplier' as const, label: 'Fournisseurs USDT' },
            { value: 'cny_buyer' as const, label: 'Acheteurs CNY' },
          ]).map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                'flex-1 h-9 rounded-lg text-[13px] font-semibold transition-colors',
                tab === t.value ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* New form */}
      {canManage && (
        <div className="px-4 pt-3">
          {showForm ? (
            <div className={cn(
              'rounded-2xl border p-3 space-y-2',
              tab === 'usdt_supplier' ? 'bg-violet-50 border-violet-200' : 'bg-amber-50 border-amber-200',
            )}>
              <TextField label="Nom *" value={name} onChange={(e) => setName(e.target.value)} />
              <TextField label="Entreprise" value={company} onChange={(e) => setCompany(e.target.value)} />
              <TextField label="Téléphone / WhatsApp" value={phone} onChange={(e) => setPhone(e.target.value)} />
              {tab === 'cny_buyer' && (
                <TextField label="WeChat ID" value={wechat} onChange={(e) => setWechat(e.target.value)} />
              )}
              <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={resetForm} className="flex-1">
                  Annuler
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={create.isPending || !name.trim()}
                  className="flex-1"
                >
                  {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Créer'}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => setShowForm(true)}
              variant="outline"
              className="w-full h-11 border-dashed"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle contrepartie {tab === 'usdt_supplier' ? '(fournisseur USDT)' : '(acheteur CNY)'}
            </Button>
          )}
        </div>
      )}

      {/* List */}
      <div className="px-4 py-3 space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (data ?? []).length === 0 ? (
          <div className="text-center text-muted-foreground text-[13px] py-8">
            Aucune contrepartie {tab === 'usdt_supplier' ? 'fournisseur' : 'acheteur'} pour l’instant.
          </div>
        ) : (
          (data ?? []).map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-border p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground truncate">{c.display_name}</div>
                  {c.legal_name && (
                    <div className="text-[12px] text-muted-foreground truncate">{c.legal_name}</div>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[12px] text-muted-foreground">
                    {c.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {c.phone}
                      </span>
                    )}
                    {c.wechat_id && (
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" />
                        {c.wechat_id}
                      </span>
                    )}
                  </div>
                  {c.notes && (
                    <div className="text-[12px] text-muted-foreground italic mt-1.5">{c.notes}</div>
                  )}
                </div>
                {!c.is_active && (
                  <span className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <Archive className="w-3 h-3" />
                    Archivé
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
