/**
 * Opérations v2 — la feuille « Filtres » (maquette 02-operations/10) :
 * Période · Moyen (tuiles à logos) · Statut (les files rares) · Trier.
 * Un deuxième appui sur « Montant » inverse le sens.
 */
import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BigButton, BottomSheet, MethodCircle, TEXT, FOCUS_RING } from '@/mobile/designKit';
import { BzDateRangeField } from '@/mobile/components/BzDateRangeField';
import { WAVE_ENABLED } from '@/data/depositMethodsData';
import { ChoiceChips, DepositRound, FieldLabel, MethodTile, TileGrid } from './parts';
import {
  DEFAULT_FILTERS,
  type DepExtra, type DepFamilyKey, type OpsFilterState, type OpsTab, type PayExtra, type PayMethodKey, type Period, type SortKey,
} from './opsFilters';

const PAY_METHODS: { key: Exclude<PayMethodKey, 'all'>; label: string }[] = [
  { key: 'alipay', label: 'Alipay' },
  { key: 'wechat', label: 'WeChat' },
  { key: 'bank_transfer', label: 'Virement' },
  { key: 'cash', label: 'Cash' },
];

const DEP_FAMILIES: { key: Exclude<DepFamilyKey, 'all'>; label: string }[] = [
  { key: 'ORANGE_MONEY', label: 'Orange' },
  { key: 'MTN_MONEY', label: 'MTN' },
  ...(WAVE_ENABLED ? [{ key: 'WAVE' as const, label: 'Wave' }] : []),
  { key: 'BANK', label: 'Banque' },
  { key: 'AGENCY_BONZINI', label: 'Agence' },
];

export function OpsFiltersSheet({ open, onClose, tab, value, onApply }: {
  open: boolean;
  onClose: () => void;
  tab: OpsTab;
  value: OpsFilterState;
  onApply: (f: OpsFilterState) => void;
}) {
  const [f, setF] = useState<OpsFilterState>(value);
  useEffect(() => { if (open) setF(value); }, [open, value]);
  const set = (patch: Partial<OpsFilterState>) => setF((p) => ({ ...p, ...patch }));

  const sortTap = (k: 'newest' | 'oldest' | 'amount') => {
    if (k === 'amount') set({ sort: f.sort === 'amount_desc' ? 'amount_asc' : 'amount_desc' });
    else set({ sort: k as SortKey });
  };
  const amountLabel = f.sort === 'amount_asc' ? 'Montant ↑' : 'Montant ↓';
  const what = tab === 'payments' ? 'les paiements' : 'les dépôts';

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className={cn('text-[22px] font-semibold', TEXT.strong)}>Filtres</h3>
        <button type="button" onClick={() => setF({ ...DEFAULT_FILTERS })} className={cn('rounded text-[16px] font-semibold underline underline-offset-[3px]', FOCUS_RING, TEXT.strong)}>
          Réinitialiser
        </button>
      </div>

      <FieldLabel>Période</FieldLabel>
      <div className="flex flex-wrap items-center gap-2">
        <ChoiceChips<Period>
          options={[{ value: 'today', label: "Aujourd'hui" }, { value: '7d', label: '7 jours' }, { value: '30d', label: '30 jours' }]}
          value={f.period}
          onChange={(p) => set({ period: f.period === p ? 'all' : p })}
          className="contents"
        />
        <button
          type="button"
          aria-label="Dates libres"
          aria-pressed={f.period === 'custom'}
          onClick={() => set({ period: f.period === 'custom' ? 'all' : 'custom' })}
          className={cn(
            'flex h-11 w-12 items-center justify-center rounded-lg',
            FOCUS_RING,
            f.period === 'custom' ? 'bg-[#2C2C2C] text-[#F5F5F5] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]' : 'bg-[#F5F5F5] text-[#1E1E1E] dark:bg-[#383838] dark:text-[#F5F5F5]',
          )}
        >
          <CalendarDays className="h-5 w-5" />
        </button>
      </div>
      {f.period === 'custom' && (
        <div className="mt-3">
          <BzDateRangeField value={{ from: f.from, to: f.to }} onChange={(r) => set({ from: r.from, to: r.to })} accent="#2C2C2C" defaultOpen />
        </div>
      )}

      <FieldLabel>Moyen</FieldLabel>
      {tab === 'payments' ? (
        <TileGrid>
          {PAY_METHODS.map((m) => (
            <MethodTile
              key={m.key}
              logo={<MethodCircle method={m.key} size={36} />}
              label={m.label}
              selected={f.payMethod === m.key}
              onClick={() => set({ payMethod: f.payMethod === m.key ? 'all' : m.key })}
            />
          ))}
        </TileGrid>
      ) : (
        <TileGrid cols={DEP_FAMILIES.length > 4 ? 3 : 4}>
          {DEP_FAMILIES.map((m) => (
            <MethodTile
              key={m.key}
              logo={<DepositRound family={m.key} size={36} />}
              label={m.label}
              selected={f.depFamily === m.key}
              onClick={() => set({ depFamily: f.depFamily === m.key ? 'all' : m.key })}
            />
          ))}
        </TileGrid>
      )}

      <FieldLabel>Statut</FieldLabel>
      {tab === 'payments' ? (
        <ChoiceChips<Exclude<PayExtra, null>>
          options={[{ value: 'waiting_beneficiary_info', label: 'Sans fournisseur' }, { value: 'rejected', label: 'Refusés' }, { value: 'cancelled_by_admin', label: 'Annulés' }]}
          value={f.payExtra}
          onChange={(v) => set({ payExtra: f.payExtra === v ? null : v })}
        />
      ) : (
        <ChoiceChips<Exclude<DepExtra, null>>
          options={[{ value: 'no_proof', label: 'Sans preuve' }, { value: 'cancelled', label: 'Annulés' }]}
          value={f.depExtra}
          onChange={(v) => set({ depExtra: f.depExtra === v ? null : v })}
        />
      )}

      <FieldLabel>Trier</FieldLabel>
      <div role="radiogroup" className="grid grid-cols-3 overflow-hidden rounded-lg border border-[#D9D9D9] dark:border-[#444444]">
        {([['newest', 'Récent'], ['oldest', 'Ancien'], ['amount', amountLabel]] as const).map(([k, label], i) => {
          const on = k === 'amount' ? f.sort.startsWith('amount') : f.sort === k;
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => sortTap(k)}
              className={cn(
                'min-h-[46px] text-[16px] font-semibold',
                i > 0 && 'border-l border-[#D9D9D9] dark:border-[#444444]',
                FOCUS_RING,
                on ? 'bg-[#2C2C2C] text-[#F5F5F5] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]' : TEXT.strong,
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <BigButton className="mt-6" onClick={() => { onApply(f); onClose(); }}>Voir {what}</BigButton>
    </BottomSheet>
  );
}
