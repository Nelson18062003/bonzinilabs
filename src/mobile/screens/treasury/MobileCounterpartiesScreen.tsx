import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, Plus, Phone, MessageCircle, Archive, ChevronRight } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { PhoneInputWithCountry, TextField } from '@/components/form';
import { Segmented } from '@/components/treasury/Segmented';
import { INSET, Pill, PrimaryPill, SOFT_CARD } from '@/components/treasury/ui';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCounterparties, useCreateCounterparty } from '@/hooks/useTreasury';
import { formatPhone } from '@/data/countryCodes';
import type { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type CounterpartyType = Database['public']['Enums']['treasury_counterparty_type'];

export function MobileCounterpartiesScreen() {
  const { hasPermission } = useAdminAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<CounterpartyType>('usdt_supplier');
  const [showArchived, setShowArchived] = useState(false);
  const { data, isLoading } = useCounterparties(tab, showArchived);
  const create = useCreateCounterparty();
  const canManage = hasPermission('canManageTreasury');

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const [wechat, setWechat] = useState('');
  const [notes, setNotes] = useState('');

  if (!hasPermission('canViewTreasury')) {
    return <Navigate to="/m/more" replace />;
  }

  const resetForm = () => {
    setName('');
    setCompany('');
    setPhone(null);
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
      phone: phone ?? undefined,
      wechat_id: wechat.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    if (result.success) resetForm();
  };

  const defaultDialCode = tab === 'usdt_supplier' ? '+237' : '+86';
  const isSupplier = tab === 'usdt_supplier';

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Contreparties" showBack backTo="/m/more/treasury" />

      <div className="px-5 py-4 space-y-3">
        {/* Tabs */}
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'usdt_supplier', label: 'Fournisseurs USDT' },
            { value: 'cny_buyer', label: 'Acheteurs CNY' },
          ]}
        />

        {/* Archived toggle */}
        <div className="flex">
          <Pill active={showArchived} onClick={() => setShowArchived((v) => !v)}>
            <Archive className="h-3.5 w-3.5" /> Archivées
          </Pill>
        </div>

        {/* New form */}
        {canManage &&
          (showForm ? (
            <div className={cn(INSET, 'space-y-2.5 p-3.5')}>
              <TextField label="Nom" value={name} onChange={(e) => setName(e.target.value)} />
              <TextField label="Entreprise" value={company} onChange={(e) => setCompany(e.target.value)} />
              <PhoneInputWithCountry label="Téléphone / WhatsApp" value={phone} onValueChange={setPhone} defaultDialCode={defaultDialCode} />
              {!isSupplier && <TextField label="WeChat ID" value={wechat} onChange={(e) => setWechat(e.target.value)} />}
              <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <div className="flex gap-2.5 pt-1">
                <button
                  onClick={resetForm}
                  className="h-[52px] flex-1 rounded-full bg-muted text-[15px] font-bold text-foreground transition active:scale-[0.99]"
                >
                  Annuler
                </button>
                <div className="flex-1">
                  <PrimaryPill onClick={handleCreate} disabled={!name.trim()} loading={create.isPending}>
                    Créer
                  </PrimaryPill>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-muted/60 text-[13px] font-semibold text-muted-foreground transition active:scale-[0.99]"
            >
              <Plus className="h-4 w-4" />
              Nouvelle contrepartie {isSupplier ? '(fournisseur USDT)' : '(acheteur CNY)'}
            </button>
          ))}

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (data ?? []).length === 0 ? (
          <div className="py-8 text-center text-[13px] text-muted-foreground">
            Aucune contrepartie {isSupplier ? 'fournisseur' : 'acheteur'} pour l’instant.
          </div>
        ) : (
          <div className="space-y-2.5">
            {(data ?? []).map((c) => {
              const toneBadge = isSupplier
                ? 'bg-violet-500/10 text-bonzini-violet'
                : 'bg-amber-500/10 text-bonzini-amber';
              return (
                <button
                  key={c.id}
                  onClick={() => canManage && navigate(`/m/more/treasury/counterparties/${c.id}`)}
                  className={cn(SOFT_CARD, 'flex w-full items-center gap-3 p-3.5 text-left', canManage && 'transition active:scale-[0.99]')}
                >
                  <span className={cn('shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold', toneBadge)}>{c.short_id}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-semibold text-foreground">{c.display_name}</span>
                      {!c.is_active && (
                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                          <Archive className="h-3 w-3" />
                          Archivée
                        </span>
                      )}
                    </div>
                    {c.legal_name && <div className="truncate text-[12px] text-muted-foreground">{c.legal_name}</div>}
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      {c.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {formatPhone(c.phone)}
                        </span>
                      )}
                      {c.wechat_id && (
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          {c.wechat_id}
                        </span>
                      )}
                    </div>
                  </div>
                  {canManage && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
