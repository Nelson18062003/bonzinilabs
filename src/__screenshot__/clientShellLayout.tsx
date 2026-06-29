/**
 * DEV-ONLY maquette — module CLIENT « SHELL & navigation » (refonte, DERNIER module).
 * Remplace la « liquid glass » (blur + bruit + dégradé + pilule animée teintée
 * primary) par une nav SOBRE designKit : barre flottante carte blanche + ombre
 * douce, onglet actif = pastille lilas (langage « sélection » de l'app : chips
 * #8B5CF6). En-tête sobre (canvas, logo, langue, cloche en holder carte).
 * NB : la vraie LiquidTabBar est PARTAGÉE avec l'admin → on ne la touche pas ;
 * le client recevra son propre ClientTabBar.
 * Harness : ?screen=cshell-home | cshell-payments
 */
import { SURFACE, TEXT } from '@/mobile/designKit/tokens';
import { BonziniLogo } from '@/components/BonziniLogo';
import {
  Wallet, ArrowDownToLine, Send, History, MessageCircle, User,
  Bell, Globe, Eye, Plus, ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { icon: Wallet, label: 'Wallet' },
  { icon: ArrowDownToLine, label: 'Dépôts' },
  { icon: Send, label: 'Paiements' },
  { icon: History, label: 'Historique', badge: 2 },
  { icon: MessageCircle, label: 'Support', badge: 1 },
  { icon: User, label: 'Profil' },
];

/* ===================== EN-TÊTE (app bar sobre) ===================== */
function Header() {
  return (
    <header className={cn('sticky top-0 z-40', SURFACE.canvas)}>
      <div className="flex h-16 items-center justify-between px-4">
        <BonziniLogo size="sm" showText textPosition="right" />
        <div className="flex items-center gap-2">
          <span className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-2 text-[12px] font-bold', SURFACE.holder)}>
            <Globe className="h-3.5 w-3.5" /> FR
          </span>
          <button className={cn('relative flex h-10 w-10 items-center justify-center rounded-full', SURFACE.card, SURFACE.shadow)}>
            <Bell className={cn('h-5 w-5', TEXT.strong)} />
            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#C0504D] px-1 text-[10px] font-bold text-white">3</span>
          </button>
        </div>
      </div>
    </header>
  );
}

/* ===================== BARRE DE NAVIGATION (sobre) ===================== */
function TabBar({ active }: { active: number }) {
  return (
    <nav className="fixed inset-x-3 z-50" style={{ bottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }} aria-label="Navigation principale">
      <div className={cn('flex items-center justify-around rounded-[26px] px-1 py-2', SURFACE.card, SURFACE.shadow)}>
        {TABS.map((tab, i) => {
          const on = i === active;
          return (
            <div key={i} className="relative flex flex-1 flex-col items-center gap-1 py-0.5">
              <span className={cn('flex h-8 items-center justify-center rounded-full transition-all duration-300', on ? 'w-11 bg-[#8B5CF6]' : 'w-8')}>
                <tab.icon className={cn('h-[18px] w-[18px]', on ? 'text-white' : TEXT.muted)} strokeWidth={on ? 2.4 : 2} />
              </span>
              <span className={cn('text-[10px] font-bold leading-none', on ? TEXT.strong : TEXT.muted)}>{tab.label}</span>
              {tab.badge ? (
                <span className="absolute right-1.5 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#C0504D] px-1 text-[9px] font-bold text-white">{tab.badge}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

/* ===================== Corps : ACCUEIL / WALLET (contexte) ===================== */
function WalletBody() {
  return (
    <div className="space-y-5 px-4 pb-28 pt-1">
      <div>
        <p className={cn('text-[13px]', TEXT.muted)}>Bonjour 👋</p>
        <h1 className={cn('text-[26px] font-black leading-tight', TEXT.strong)}>Papa Nguemo</h1>
      </div>

      {/* Carte solde — charbon (pas de dégradé) */}
      <div className="rounded-[26px] bg-[#1C1B22] p-5 text-white dark:bg-[#211F2B] dark:ring-1 dark:ring-white/[0.06]">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium text-white/55">Solde disponible</span>
          <Eye className="h-[18px] w-[18px] text-white/55" />
        </div>
        <div className="mt-2 flex items-end gap-1.5">
          <span className="text-[34px] font-black leading-none">4 250 000</span>
          <span className="mb-1 text-[15px] font-bold text-[#E8932A]">XAF</span>
        </div>
        <div className="mt-5 flex gap-2.5">
          <button className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white/15 py-2.5 text-[13px] font-bold">
            <Plus className="h-4 w-4" /> Recharger
          </button>
          <button className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white py-2.5 text-[13px] font-bold text-[#1C1B22]">
            <Send className="h-4 w-4" /> Payer
          </button>
        </div>
      </div>

      {/* Opérations récentes */}
      <div>
        <h2 className={cn('mb-2 px-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>Activité récente</h2>
        <div className="space-y-2.5">
          {[
            { t: 'Guangzhou Textile Co.', s: 'Paiement · en cours', v: '-2 500 000', up: true, tone: '#8B5CF6' },
            { t: 'Recharge Orange Money', s: 'Dépôt · validé', v: '+1 000 000', up: false, tone: '#2E7D52' },
            { t: 'Shenzhen Electronics', s: 'Paiement · terminé', v: '-850 000', up: true, tone: '#2E7D52' },
          ].map((r, i) => (
            <div key={i} className={cn('flex items-center gap-3 rounded-[18px] p-3.5', SURFACE.card, SURFACE.shadow)}>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: r.tone === '#8B5CF6' ? '#EDEAFA' : '#DEEFE5' }}>
                <ArrowUpRight className="h-5 w-5" style={{ color: r.tone, transform: r.up ? undefined : 'rotate(180deg)' }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className={cn('truncate text-[15px] font-bold', TEXT.strong)}>{r.t}</div>
                <div className={cn('text-[12px]', TEXT.muted)}>{r.s}</div>
              </div>
              <div className={cn('shrink-0 text-[14px] font-black', TEXT.strong)}>{r.v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ===================== Corps : PAIEMENTS (contexte) ===================== */
function PaymentsBody() {
  return (
    <div className="space-y-5 px-4 pb-28 pt-1">
      <div>
        <h1 className={cn('text-[26px] font-black leading-tight', TEXT.strong)}>Paiements</h1>
        <p className={cn('mt-0.5 text-[13px]', TEXT.muted)}>Réglez vos fournisseurs en Chine</p>
      </div>
      {/* chips */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {['Tous', 'En cours', 'Terminés', 'À compléter'].map((c, i) => (
          <span key={c} className={cn('shrink-0 rounded-full px-3.5 py-2 text-[12.5px] font-bold', i === 0 ? 'bg-[#8B5CF6] text-white' : cn(SURFACE.card, SURFACE.shadow, TEXT.muted))}>{c}</span>
        ))}
      </div>
      <div className="space-y-2.5">
        {[
          { t: 'Guangzhou Textile Co.', s: 'BZ-PM-2401 · en cours', v: '¥28 825' },
          { t: 'Shenzhen Electronics', s: 'BZ-PM-2398 · terminé', v: '¥9 648' },
          { t: 'À renseigner', s: 'BZ-PM-2390 · à compléter', v: '¥44 800' },
        ].map((r, i) => (
          <div key={i} className={cn('flex items-center gap-3 rounded-[18px] p-3.5', SURFACE.card, SURFACE.shadow)}>
            <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', SURFACE.holder)}>
              <Send className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className={cn('truncate text-[15px] font-bold', TEXT.strong)}>{r.t}</div>
              <div className={cn('text-[12px]', TEXT.muted)}>{r.s}</div>
            </div>
            <div className={cn('shrink-0 text-[14px] font-black', TEXT.strong)}>{r.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===================== Écrans (shell complet) ===================== */
export function ShellHome() {
  return (
    <div className={cn('min-h-[100dvh]', SURFACE.canvas)}>
      <Header />
      <WalletBody />
      <TabBar active={0} />
    </div>
  );
}

export function ShellPayments() {
  return (
    <div className={cn('min-h-[100dvh]', SURFACE.canvas)}>
      <Header />
      <PaymentsBody />
      <TabBar active={2} />
    </div>
  );
}
