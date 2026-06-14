/**
 * DEV-ONLY maquette — module CLIENT « Wallet / Accueil » (refonte).
 * Langage validé (paiements/dépôts) appliqué à l'accueil :
 *   · salutation · carte SOLDE premium (charbon, sans dégradé, œil masquer)
 *   · actions rapides (Déposer / Payer / Bénéficiaires / Historique)
 *   · taux du jour (4 méthodes, vrais logos) · activité récente (crédit/débit)
 * Harness: ?screen=cwallet-home | cwallet-home-hidden
 */
import { SURFACE, TEXT } from '@/mobile/designKit/tokens';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';
import {
  ArrowDownToLine, Send, Users, Clock, Eye, EyeOff, ChevronRight,
  ArrowDownLeft, ArrowUpRight, Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const GREEN = '#2E7D52', AMBER = '#E8932A';

function Caption({ children, action }: { children: React.ReactNode; action?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between px-1">
      <h2 className={cn('text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>{children}</h2>
      {action && <span className="text-[12px] font-bold text-[#5B4CC4] dark:text-[#B5AAF0]">{action}</span>}
    </div>
  );
}

const ACTIONS = [
  { icon: ArrowDownToLine, label: 'Déposer' },
  { icon: Send, label: 'Payer' },
  { icon: Users, label: 'Bénéficiaires' },
  { icon: Clock, label: 'Historique' },
];

const RATES: { k: 'alipay' | 'wechat' | 'bank_transfer' | 'cash'; label: string; rate: string }[] = [
  { k: 'alipay', label: 'Alipay', rate: '11 480' },
  { k: 'wechat', label: 'WeChat', rate: '11 350' },
  { k: 'bank_transfer', label: 'Virement', rate: '11 200' },
  { k: 'cash', label: 'Cash', rate: '11 530' },
];

const OPS = [
  { credit: true, label: 'Dépôt validé · Cash agence', date: '13 juin · 14:20', amount: '1 000 000' },
  { credit: false, label: 'Paiement · Guangzhou Textile', date: '12 juin · 09:14', amount: '2 500 000' },
  { credit: true, label: 'Dépôt validé · Orange Money', date: '9 juin · 16:40', amount: '500 000' },
];

function WalletHome({ hidden = false }: { hidden?: boolean }) {
  return (
    <div className={cn('mx-auto min-h-screen max-w-[420px]', SURFACE.canvas)}>
      {/* Barre d'app simplifiée (logo + cloche) */}
      <div className="flex items-center justify-between px-4 pb-1 pt-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[#1C1B22] dark:bg-[#F2F1F7]" />
          <span className={cn('text-[16px] font-black', TEXT.strong)}>Bonzini</span>
        </div>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', SURFACE.card, SURFACE.shadow)}>
          <Bell className={cn('h-5 w-5', TEXT.strong)} />
        </div>
      </div>

      <div className="space-y-6 p-4 pt-3">
        {/* Salutation */}
        <div className="px-1">
          <h1 className={cn('text-[24px] font-black leading-tight', TEXT.strong)}>Bonsoir Papa 👋</h1>
          <p className={cn('mt-0.5 text-[13px]', TEXT.muted)}>Voici votre compte Bonzini</p>
        </div>

        {/* Carte SOLDE — premium charbon, sans dégradé */}
        <div className="rounded-[26px] bg-[#1C1B22] p-6 shadow-[0_14px_40px_-16px_rgba(28,27,34,0.55)] dark:bg-[#211F2B] dark:ring-1 dark:ring-white/[0.06]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-white/65">Solde disponible</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
              {hidden ? <Eye className="h-4 w-4 text-white/80" /> : <EyeOff className="h-4 w-4 text-white/80" />}
            </div>
          </div>
          {hidden ? (
            <div className="mt-3 text-[40px] font-black leading-none text-white">• • • • •</div>
          ) : (
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-[44px] font-black leading-none tracking-tight tabular-nums text-white">4 250 000</span>
              <span className="text-[18px] font-extrabold" style={{ color: AMBER }}>XAF</span>
            </div>
          )}
          <div className="mt-4 text-[12px] text-white/45">Mis à jour à l'instant</div>
        </div>

        {/* Actions rapides */}
        <div className="grid grid-cols-4 gap-2.5">
          {ACTIONS.map((a) => (
            <button key={a.label} className={cn('flex flex-col items-center gap-2 rounded-[20px] p-3', SURFACE.card, SURFACE.shadow)}>
              <div className={cn('flex h-11 w-11 items-center justify-center rounded-full', SURFACE.holder)}>
                <a.icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <span className={cn('text-[11px] font-semibold', TEXT.strong)}>{a.label}</span>
            </button>
          ))}
        </div>

        {/* Taux du jour */}
        <section>
          <Caption action="Voir les taux">Taux du jour</Caption>
          <div className={cn('rounded-[22px] p-2', SURFACE.card, SURFACE.shadow)}>
            {RATES.map((r, i) => (
              <div key={r.k} className={cn('flex items-center gap-3 px-3 py-2.5', i < RATES.length - 1 && 'border-b border-black/[0.05] dark:border-white/[0.07]')}>
                <PaymentMethodLogo method={r.k} size={34} />
                <span className={cn('flex-1 text-[14px] font-bold', TEXT.strong)}>{r.label}</span>
                <span className={cn('text-[14px] font-black tabular-nums', TEXT.strong)}>{r.rate} <span className="text-[12px] font-bold" style={{ color: AMBER }}>¥</span></span>
              </div>
            ))}
            <div className={cn('px-3 pb-1 pt-2 text-[11px]', TEXT.muted)}>Pour 1 000 000 XAF · mis à jour aujourd'hui</div>
          </div>
        </section>

        {/* Activité récente */}
        <section>
          <Caption action="Voir tout">Activité récente</Caption>
          <div className="space-y-2.5">
            {OPS.map((op) => (
              <div key={op.label} className={cn('flex items-center gap-3 rounded-[18px] p-3.5', SURFACE.card, SURFACE.shadow)}>
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{ background: op.credit ? `${GREEN}1F` : 'rgba(0,0,0,0.05)' }}
                >
                  {op.credit ? <ArrowDownLeft className="h-5 w-5" style={{ color: GREEN }} /> : <ArrowUpRight className={cn('h-5 w-5', TEXT.muted)} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={cn('truncate text-[14px] font-bold', TEXT.strong)}>{op.label}</div>
                  <div className={cn('mt-0.5 text-[12px]', TEXT.muted)}>{op.date}</div>
                </div>
                <div className={cn('shrink-0 text-right text-[14px] font-black tabular-nums', op.credit ? '' : TEXT.strong)} style={op.credit ? { color: GREEN } : undefined}>
                  {op.credit ? '+' : '−'} {op.amount}
                  <div className={cn('text-[10px] font-semibold', TEXT.muted)}>XAF</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export function WalletHomeShown() {
  return <WalletHome />;
}
export function WalletHomeHidden() {
  return <WalletHome hidden />;
}
