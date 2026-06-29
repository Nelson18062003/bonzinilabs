/**
 * DEV-ONLY maquette — module CLIENT « Bénéficiaires » (carnet) refonte.
 * Langage validé : liste alias-first avec vrais logos de méthode, recherche,
 * filtres par mode, actions modifier/archiver · éditeur = BeneficiaryForm
 * (déjà refondu) en cadre drill-in + pied Annuler/Enregistrer.
 * Harness: ?screen=cbenef-list | cbenef-editor
 */
import { useState } from 'react';
import { SURFACE, TEXT, PRIMARY_PILL, SOFT_PILL } from '@/mobile/designKit/tokens';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';
import { BeneficiaryForm, type BeneficiaryFormValues } from '@/components/beneficiary/BeneficiaryForm';
import { Plus, Search, Pencil, Trash2, ArrowLeft, User, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type M = 'alipay' | 'wechat' | 'bank_transfer' | 'cash';
const FILTERS: { k: M | 'all'; label: string }[] = [
  { k: 'all', label: 'Tous' },
  { k: 'alipay', label: 'Alipay' },
  { k: 'wechat', label: 'WeChat' },
  { k: 'bank_transfer', label: 'Virement' },
  { k: 'cash', label: 'Cash' },
];
const LIST: { k: M; alias: string; sub: string; relation?: string }[] = [
  { k: 'alipay', alias: 'Guangzhou Textile', sub: 'gz-textile@alipay.cn', relation: 'Fournisseur' },
  { k: 'wechat', alias: 'Li Wei · tissus', sub: 'li.wei-1988' },
  { k: 'bank_transfer', alias: 'Shenzhen Electronics', sub: 'Bank of China · 6217 0000 1234' },
  { k: 'cash', alias: 'Moi-même', sub: '+237 652 236 856', relation: 'Moi' },
];

export function BenefList() {
  return (
    <div className={cn('mx-auto min-h-screen max-w-[420px]', SURFACE.canvas)}>
      <div className="space-y-4 p-4 pt-6">
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3 px-1">
          <div>
            <h1 className={cn('text-[26px] font-black leading-tight', TEXT.strong)}>Bénéficiaires</h1>
            <p className={cn('mt-0.5 text-[13px]', TEXT.muted)}>Vos destinataires en Chine</p>
          </div>
          <button className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', PRIMARY_PILL)}>
            <Plus className="h-5 w-5" strokeWidth={2.4} />
          </button>
        </div>

        {/* Recherche */}
        <label className={cn('flex items-center gap-2.5 rounded-full px-4 py-3', SURFACE.card, SURFACE.shadow)}>
          <Search className={cn('h-[18px] w-[18px] shrink-0', TEXT.muted)} />
          <span className="text-[16px] text-[#9B98AD]">Rechercher (surnom, compte…)</span>
        </label>

        {/* Filtres par mode */}
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((f, i) => (
            <button
              key={f.k}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-2 text-[12.5px] font-bold transition-colors',
                i === 0 ? 'bg-[#8B5CF6] text-white' : cn(SURFACE.card, SURFACE.shadow, TEXT.muted),
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Liste */}
        <div className="space-y-2.5">
          {LIST.map((b) => (
            <div key={b.alias} className={cn('flex items-center gap-3 rounded-[18px] p-3.5', SURFACE.card, SURFACE.shadow)}>
              <PaymentMethodLogo method={b.k} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn('truncate text-[15px] font-bold', TEXT.strong)}>{b.alias}</span>
                  {b.relation && (
                    <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold', SURFACE.holder)}>{b.relation}</span>
                  )}
                </div>
                <div className={cn('mt-0.5 truncate text-[12px]', TEXT.muted)}>{b.sub}</div>
              </div>
              <button className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', SURFACE.holder)}>
                <Pencil className="h-4 w-4" />
              </button>
              <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FBE7E7] text-[#C0504D] dark:bg-[#3A2526] dark:text-[#E79A9A]">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Aperçu état vide (sous la liste pour la maquette) */}
        <div className={cn('mt-2 rounded-[24px] p-8 text-center', SURFACE.card, SURFACE.shadow)}>
          <div className={cn('mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full', SURFACE.holder)}>
            <User className="h-6 w-6" />
          </div>
          <p className={cn('text-[14px] font-bold', TEXT.strong)}>Aucun bénéficiaire</p>
          <p className={cn('mt-1 text-[13px]', TEXT.muted)}>Enregistrez vos fournisseurs pour payer plus vite.</p>
        </div>
      </div>
    </div>
  );
}

export function BenefEditor() {
  const [values, setValues] = useState<BeneficiaryFormValues>({
    payment_method: 'alipay',
    alias: 'Guangzhou Textile',
    name: 'Guangzhou Textile Co.',
    identifier: 'gz-textile@alipay.cn',
    identifier_type: 'email',
    phone: '',
    email: '',
    bank_name: '',
    bank_account: '',
    bank_extra: '',
    relation_type: 'supplier',
    notes: '',
  });
  return (
    <div className={cn('mx-auto flex min-h-screen max-w-[420px] flex-col', SURFACE.canvas)}>
      <div className="flex items-center gap-3 px-4 pb-1 pt-4">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', SURFACE.card, SURFACE.shadow)}>
          <ArrowLeft className={cn('h-5 w-5', TEXT.strong)} />
        </div>
        <span className={cn('text-[17px] font-black', TEXT.strong)}>Nouveau bénéficiaire</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <BeneficiaryForm values={values} onChange={setValues} />
      </div>
      <div className="flex gap-2.5 px-4 pb-6 pt-2">
        <button className={cn('flex-1 py-[15px] text-[15px] font-semibold', SOFT_PILL)}>Annuler</button>
        <button className={cn('flex flex-1 items-center justify-center gap-2 py-[15px] text-[15px] font-bold', PRIMARY_PILL)}>
          <Check className="h-[17px] w-[17px]" /> Enregistrer
        </button>
      </div>
    </div>
  );
}
