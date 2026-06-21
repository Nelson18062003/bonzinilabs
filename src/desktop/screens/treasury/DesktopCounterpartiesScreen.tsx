/**
 * Desktop admin — Treasury counterparties (USDT suppliers / CNY buyers).
 * Same data + create mutation as MobileCounterpartiesScreen, laid out for a
 * wide screen: tabs + archived toggle + (toggleable) create form + 2-col grid.
 */
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, Plus, Phone, MessageCircle, Archive, ChevronRight, Users } from 'lucide-react';
import { PhoneInputWithCountry, TextField } from '@/components/form';
import { Segmented } from '@/components/treasury/Segmented';
import { INSET, Pill, PrimaryPill, SOFT_CARD } from '@/components/treasury/ui';
import { PRIMARY_PILL, Holder } from '@/mobile/designKit';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCounterparties, useCreateCounterparty } from '@/hooks/useTreasury';
import { formatPhone } from '@/data/countryCodes';
import type { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type CounterpartyType = Database['public']['Enums']['treasury_counterparty_type'];

export function DesktopCounterpartiesScreen() {
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
    return <Navigate to="/m" replace />;
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
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[26px] font-extrabold tracking-tight text-foreground">Contreparties</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">Fournisseurs USDT et acheteurs CNY</p>
        </div>
        {canManage && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className={cn('inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold', PRIMARY_PILL)}
          >
            <Plus className="h-4 w-4" /> Nouvelle contrepartie
          </button>
        )}
      </header>

      {/* Tabs + archived */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full max-w-md">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'usdt_supplier', label: 'Fournisseurs USDT' },
              { value: 'cny_buyer', label: 'Acheteurs CNY' },
            ]}
          />
        </div>
        <div className="ml-auto">
          <Pill active={showArchived} onClick={() => setShowArchived((v) => !v)}>
            <Archive className="h-3.5 w-3.5" /> Archivées
          </Pill>
        </div>
      </div>

      {/* Create form */}
      {canManage && showForm && (
        <div className={cn(INSET, 'max-w-xl space-y-2.5 p-4')}>
          <div className="text-[13px] font-bold text-foreground">
            Nouvelle contrepartie {isSupplier ? '(fournisseur USDT)' : '(acheteur CNY)'}
          </div>
          <TextField label="Nom" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField label="Entreprise" value={company} onChange={(e) => setCompany(e.target.value)} />
          <PhoneInputWithCountry label="Téléphone / WhatsApp" value={phone} onValueChange={setPhone} defaultDialCode={defaultDialCode} />
          {!isSupplier && <TextField label="WeChat ID" value={wechat} onChange={(e) => setWechat(e.target.value)} />}
          <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex gap-2.5 pt-1">
            <button
              onClick={resetForm}
              className="h-[52px] flex-1 rounded-2xl bg-muted text-[15px] font-bold text-foreground transition active:scale-[0.99]"
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
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (data ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Holder icon={Users} size="lg" />
          <p className="mt-4 text-[14px] font-medium text-muted-foreground">
            Aucune contrepartie {isSupplier ? 'fournisseur' : 'acheteur'} pour l'instant.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {(data ?? []).map((c) => {
            const toneBadge = isSupplier ? 'bg-violet-500/10 text-bonzini-violet' : 'bg-amber-500/10 text-bonzini-amber';
            return (
              <button
                key={c.id}
                onClick={() => canManage && navigate(`/m/more/treasury/counterparties/${c.id}`)}
                className={cn(SOFT_CARD, 'flex w-full items-center gap-3 p-3.5 text-left', canManage && 'transition hover:-translate-y-0.5')}
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
  );
}
