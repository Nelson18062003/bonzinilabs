/**
 * DEV-ONLY maquette — module CLIENT « Taux de change » (refonte).
 * Langage validé : hero taux (sans dégradé ambre), sélecteur pays, méthodes
 * avec vrais logos, convertisseur XAF↔¥, indicateur de palier, tendance,
 * bandeau info. Harness: ?screen=crates
 */
import { SURFACE, TEXT } from '@/mobile/designKit/tokens';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';
import { ArrowLeft, ArrowUpDown, TrendingUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const GREEN = '#2E7D52', AMBER = '#E8932A', LILAC = '#8B5CF6';

const COUNTRIES = [
  { flag: '🇨🇲', label: 'Cameroun', sel: true },
  { flag: '🇬🇦', label: 'Gabon' },
  { flag: '🇹🇩', label: 'Tchad' },
  { flag: '🇨🇬', label: 'Congo' },
];
const METHODS: { k: 'alipay' | 'wechat' | 'bank_transfer' | 'cash'; label: string; rate: string; sel?: boolean }[] = [
  { k: 'alipay', label: 'Alipay', rate: '11 480' },
  { k: 'wechat', label: 'WeChat', rate: '11 350' },
  { k: 'bank_transfer', label: 'Virement', rate: '11 200' },
  { k: 'cash', label: 'Cash', rate: '11 530', sel: true },
];
const QUICK = ['100K', '250K', '500K', '1M', '2M'];

export function RatesScreen() {
  return (
    <div className={cn('mx-auto min-h-screen max-w-[420px]', SURFACE.canvas)}>
      <div className="flex items-center gap-3 px-4 pb-1 pt-4">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', SURFACE.card, SURFACE.shadow)}>
          <ArrowLeft className={cn('h-5 w-5', TEXT.strong)} />
        </div>
        <span className={cn('text-[17px] font-black', TEXT.strong)}>Taux de change</span>
      </div>

      <div className="space-y-4 p-4 pt-3">
        {/* Hero taux */}
        <div className={cn('rounded-[26px] p-6', SURFACE.card, SURFACE.shadow)}>
          <div className="flex items-center justify-between">
            <span className={cn('text-[12px] font-bold uppercase tracking-wide', TEXT.muted)}>Taux du jour · XAF → ¥</span>
            <span className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold" style={{ color: GREEN, background: `${GREEN}1F` }}>
              <TrendingUp className="h-3 w-3" /> +1,2%
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={cn('text-[30px] font-black leading-none tabular-nums', TEXT.strong)}>1 000 000</span>
            <span className="text-[14px] font-extrabold" style={{ color: AMBER }}>XAF</span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className={cn('text-[13px] font-semibold', TEXT.muted)}>=</span>
            <span className={cn('text-[30px] font-black leading-none tabular-nums', TEXT.strong)}>11 530</span>
            <span className="text-[16px] font-black text-[#C3BDD2] dark:text-[#5C5772]">¥</span>
          </div>
          <div className={cn('mt-2 text-[12px] tabular-nums', TEXT.muted)}>1 ¥ = 87 XAF · mis à jour ce matin</div>
          <div className="mt-3 flex gap-2">
            <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold', SURFACE.holder)}>🇨🇲 Cameroun</span>
            <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold', SURFACE.holder)}>Cash</span>
          </div>
        </div>

        {/* Pays */}
        <section>
          <h2 className={cn('mb-2 px-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>Pays</h2>
          <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {COUNTRIES.map((c) => (
              <button
                key={c.label}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-bold transition-colors',
                  c.sel ? 'bg-[#8B5CF6] text-white' : cn(SURFACE.card, SURFACE.shadow, TEXT.muted),
                )}
              >
                <span>{c.flag}</span> {c.label}
              </button>
            ))}
          </div>
        </section>

        {/* Mode de paiement */}
        <section>
          <h2 className={cn('mb-2 px-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>Mode de paiement</h2>
          <div className="grid grid-cols-4 gap-2">
            {METHODS.map((m) => (
              <div key={m.k} className={cn('flex flex-col items-center gap-1.5 rounded-[18px] p-2.5', SURFACE.card, SURFACE.shadow, m.sel && 'ring-2 ring-[#8B5CF6]')}>
                <PaymentMethodLogo method={m.k} size={34} />
                <span className={cn('text-[10px] font-bold', TEXT.strong)}>{m.label}</span>
                <span className={cn('text-[11px] font-black tabular-nums', m.sel ? TEXT.strong : TEXT.muted)}>{m.rate}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Convertisseur */}
        <section>
          <h2 className={cn('mb-2 px-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>Convertisseur</h2>
          <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
            <div className={cn('mb-4 flex rounded-full p-1', SURFACE.canvas)}>
              <button className="flex-1 rounded-full bg-[#8B5CF6] py-2 text-[13px] font-bold text-white">Par XAF</button>
              <button className={cn('flex-1 rounded-full py-2 text-[13px] font-bold', TEXT.muted)}>Par ¥</button>
            </div>
            <div className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>Vous envoyez</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className={cn('text-[28px] font-black tabular-nums', TEXT.strong)}>1 000 000</span>
              <span className={cn('text-[15px] font-extrabold', TEXT.muted)}>XAF</span>
            </div>
            <div className="my-3 flex justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EDEAFA] dark:bg-[#221F33]">
                <ArrowUpDown className="h-[18px] w-[18px] text-[#5B4CC4] dark:text-[#B5AAF0]" />
              </div>
            </div>
            <div className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>Vous recevez</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-[28px] font-black tabular-nums text-[#5B4CC4] dark:text-[#B5AAF0]">11 530</span>
              <span className={cn('text-[15px] font-extrabold', TEXT.muted)}>¥</span>
            </div>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {QUICK.map((q, i) => (
                <button key={q} className={cn('rounded-xl py-2 text-[12px] font-bold', i === 3 ? 'bg-[#8B5CF6] text-white' : cn(SURFACE.canvas, TEXT.muted))}>{q}</button>
              ))}
            </div>
            {/* Indicateur de palier */}
            <div className="mt-4 flex items-center justify-center gap-1.5 rounded-full py-2" style={{ background: `${GREEN}14` }}>
              <Sparkles className="h-3.5 w-3.5" style={{ color: GREEN }} />
              <span className="text-[12px] font-bold" style={{ color: GREEN }}>Meilleur taux · montant ≥ 1M</span>
            </div>
          </div>
        </section>

        {/* Tendance */}
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className={cn('text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>Tendance</h2>
            <div className="flex gap-1.5">
              {['7j', '30j', '90j'].map((p, i) => (
                <span key={p} className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold', i === 1 ? 'bg-[#8B5CF6] text-white' : cn(SURFACE.holder))}>{p}</span>
              ))}
            </div>
          </div>
          <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
            <svg viewBox="0 0 300 90" className="h-[90px] w-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={LILAC} stopOpacity="0.25" />
                  <stop offset="100%" stopColor={LILAC} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0,60 C40,55 60,40 100,42 C140,44 160,25 200,28 C240,31 270,18 300,15 L300,90 L0,90 Z" fill="url(#rg)" />
              <path d="M0,60 C40,55 60,40 100,42 C140,44 160,25 200,28 C240,31 270,18 300,15" fill="none" stroke={LILAC} strokeWidth="2.5" />
            </svg>
            <div className={cn('mt-2 flex justify-between text-[10px]', TEXT.muted)}>
              <span>15 mai</span><span>aujourd'hui</span>
            </div>
          </div>
        </section>

        {/* Bandeau info */}
        <div className="flex items-center gap-3 rounded-[20px] bg-[#EAE7FA] p-4 dark:bg-[#272252]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/60 dark:bg-black/20">
            <Sparkles className="h-5 w-5 text-[#5B4CC4] dark:text-[#B5AAF0]" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-[#5B4CC4] dark:text-[#B5AAF0]">Suivez les taux en temps réel</p>
            <p className="mt-0.5 text-[12px] text-[#6E66A8] dark:text-[#9C93D6]">Mis à jour chaque matin pour le meilleur cours.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
