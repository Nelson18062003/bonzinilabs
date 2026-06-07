import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Plus, Search, Factory, Store, HelpCircle, ChevronRight } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useSuppliers } from '@/hooks/useProcurement';
import type { ProcSupplierKind } from '@/integrations/supabase/procurement';
import { IconChip, SOFT_CARD } from '@/components/treasury/ui';
import { PROC_INPUT as INPUT } from './shared';
import { cn } from '@/lib/utils';

const KIND_META: Record<ProcSupplierKind, { label: string; icon: typeof Factory }> = {
  factory: { label: 'Usine', icon: Factory },
  trading_company: { label: 'Négociant', icon: Store },
  unknown: { label: 'À qualifier', icon: HelpCircle },
};

export function MobileSuppliersList() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useSuppliers(search);

  if (!hasPermission('canViewProcurement')) {
    return <Navigate to="/m/more" replace />;
  }

  const suppliers = data?.suppliers ?? [];
  const canManage = hasPermission('canManageProcurement');

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Fournisseurs" showBack backTo="/m/more/procurement" />

      <div className="px-5 py-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className={cn(INPUT, 'pl-11')} />
          </div>
          {canManage && (
            <button
              onClick={() => navigate('/m/more/procurement/suppliers/new')}
              aria-label="Nouveau fournisseur"
              className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-foreground text-background active:scale-95"
            >
              <Plus className="h-5 w-5" />
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-[13px] text-muted-foreground">Chargement…</div>
        ) : suppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <IconChip icon={Factory} tone="violet" size="lg" />
            <div className="text-[14px] font-semibold text-foreground">Aucun fournisseur</div>
            <div className="max-w-[260px] text-[12px] text-muted-foreground">Ajoute une usine ou un négociant pour pouvoir créer des commandes.</div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {suppliers.map((s) => {
              const meta = KIND_META[s.supplier_kind];
              return (
                <button
                  key={s.id}
                  onClick={() => navigate(`/m/more/procurement/suppliers/${s.id}`)}
                  className={cn(SOFT_CARD, 'flex w-full items-center gap-3.5 p-4 text-left active:scale-[0.99]')}
                >
                  <IconChip icon={meta.icon} tone={s.supplier_kind === 'factory' ? 'violet' : s.supplier_kind === 'trading_company' ? 'amber' : 'neutral'} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold text-foreground">{s.display_name}</div>
                    <div className="truncate text-[12px] text-muted-foreground">
                      {meta.label}{s.city ? ` · ${s.city}` : ''}{s.purchase_order_count > 0 ? ` · ${s.purchase_order_count} cmd` : ''}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
