// Support module — design previews (dev-only, not wired into the app).
// Rendered via preview.html → src/dev/previewMain.tsx with ?v=sup-<screen>.
// Mirrors the real chat model (ChatConversation / ChatMessage in
// src/types/chat.ts) and the FR copy from src/i18n/locales/fr/support.json.
// Client side: client ↔ "Équipe Bonzini". Accent = violet (bonzini-violet).
import {
  ChevronRight, Plus, Search, Zap, Headset,
  Home, ArrowDownToLine, Send, History, MessageCircle, User,
} from 'lucide-react';
import { fontStack } from './walletFixtures';

const ACCENT = 'hsl(258 100% 60%)';

/* ── conversations fixtures (FR, paying-suppliers context) ────────── */
const conversations: {
  subject: string; preview: string; time: string; unread: number; closed?: boolean; fromAdmin?: boolean;
}[] = [
  { subject: 'Question sur un paiement', preview: 'Votre paiement vers Shenzhen Tech a bien été réglé ✅', time: '09:42', unread: 2, fromAdmin: true },
  { subject: 'Taux du jour', preview: 'Vous : Le taux Alipay est-il encore valable ?', time: 'Hier', unread: 0 },
  { subject: 'Dépôt non crédité', preview: 'Merci, tout est rentré dans l\'ordre 🙏', time: '12 mai', unread: 0, closed: true },
  { subject: 'Discussion générale', preview: 'Équipe Bonzini : Bonjour, comment pouvons-nous aider ?', time: '8 mai', unread: 0, fromAdmin: true },
];

/* ── client quick replies (shown when starting a new conversation) ── */
const quickReplies = [
  'Mon paiement est en retard',
  'Question sur le taux du jour',
  'Mon dépôt n\'est pas crédité',
  'Comment payer un fournisseur ?',
];

const tabs = [
  { Icon: Home, label: 'Accueil' }, { Icon: ArrowDownToLine, label: 'Dépôts' },
  { Icon: Send, label: 'Paiements' }, { Icon: History, label: 'Historique' },
  { Icon: MessageCircle, label: 'Support', active: true }, { Icon: User, label: 'Profil' },
];

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] bg-[#0A0C12] text-slate-100" style={{ fontFamily: fontStack }}>{children}</div>;
}
function NavBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0A0C12]/95 backdrop-blur-xl" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}>
      <ul className="mx-auto flex max-w-[480px] items-stretch justify-between px-2 pt-2">
        {tabs.map((t) => (
          <li key={t.label} className="min-w-0 flex-1">
            <div className="flex flex-col items-center gap-1 py-1.5" style={t.active ? { color: ACCENT } : undefined}>
              <t.Icon className={`h-[21px] w-[21px] ${t.active ? '' : 'text-slate-400'}`} strokeWidth={t.active ? 2.4 : 1.9} />
              <span className={`max-w-full truncate text-[9.5px] ${t.active ? 'font-bold' : 'font-medium text-slate-400'}`}>{t.label}</span>
            </div>
          </li>
        ))}
      </ul>
    </nav>
  );
}
/* Bonzini team avatar — violet gradient with headset glyph */
function TeamAvatar({ size = 48 }: { size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full text-white shadow-sm" style={{ width: size, height: size, background: 'linear-gradient(135deg, hsl(258 100% 64%), hsl(268 84% 50%))' }}>
      <Headset style={{ width: size * 0.5, height: size * 0.5 }} />
    </span>
  );
}
function ResponseTimeBadge() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2">
      <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
      <span className="text-[12.5px] text-slate-300">Réponse moyenne aujourd'hui · <span className="font-bold text-emerald-300">2 min</span></span>
    </div>
  );
}

/* ── list ──────────────────────────────────────────────────── */
function ListScreen() {
  return (
    <Shell>
      <div className="mx-auto max-w-[480px] px-5 pb-28" style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)' }}>
        <header className="pt-2">
          <h1 className="text-[26px] font-extrabold tracking-tight">Support</h1>
          <p className="mt-0.5 text-[13.5px] text-slate-400">Équipe Bonzini · nous sommes là pour vous aider</p>
        </header>

        <div className="mt-3"><ResponseTimeBadge /></div>

        {/* new conversation CTA */}
        <button className="relative mt-4 flex w-full items-center gap-4 overflow-hidden rounded-[24px] p-4 text-left text-white" style={{ background: 'linear-gradient(145deg, hsl(258 100% 64%) 0%, hsl(262 90% 54%) 60%, hsl(268 84% 46%) 100%)', boxShadow: '0 20px 46px -20px hsl(258 90% 50% / 0.7)' }}>
          <span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-white/20"><Plus className="h-6 w-6" /></span>
          <div className="relative flex-1"><p className="text-[16px] font-bold leading-tight">Nouvelle conversation</p><p className="mt-0.5 text-[12.5px] text-white/85">Sur un sujet spécifique</p></div>
          <ChevronRight className="relative h-6 w-6 text-white/80" />
        </button>

        {/* search */}
        <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <Search className="h-[18px] w-[18px] text-slate-500" />
          <span className="text-[14px] text-slate-500">Rechercher une conversation…</span>
        </div>

        {/* conversations */}
        <ul className="mt-3 divide-y divide-white/[0.06]">
          {conversations.map((c, i) => (
            <li key={i}>
              <button className="flex w-full items-center gap-3.5 py-3.5 text-left">
                <TeamAvatar />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[15px] font-semibold leading-tight">{c.subject}</p>
                    <span className="shrink-0 text-[11.5px] text-slate-500">{c.time}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <p className={`min-w-0 flex-1 truncate text-[13px] ${c.unread ? 'font-medium text-slate-200' : 'text-slate-400'}`}>{c.preview}</p>
                    {c.unread > 0 && <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 text-[11px] font-bold text-white" style={{ background: ACCENT }}>{c.unread}</span>}
                  </div>
                  {c.closed && <span className="mt-1.5 inline-block rounded-full bg-white/[0.06] px-2 py-0.5 text-[10.5px] font-medium text-slate-400">Conversation fermée</span>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <NavBar />
    </Shell>
  );
}

/* ── empty ─────────────────────────────────────────────────── */
function EmptyScreen() {
  return (
    <Shell>
      <div className="mx-auto flex min-h-[100dvh] max-w-[480px] flex-col px-5 pb-28" style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)' }}>
        <header className="pt-2">
          <h1 className="text-[26px] font-extrabold tracking-tight">Support</h1>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <TeamAvatar size={76} />
          <p className="mt-5 text-[18px] font-bold">L'équipe Bonzini est là pour vous aider</p>
          <p className="mx-auto mt-1.5 max-w-[300px] text-[13.5px] leading-snug text-slate-400">Posez vos questions sur un paiement, un taux ou autre. On vous répond rapidement.</p>
          <div className="mt-4"><ResponseTimeBadge /></div>

          {/* quick replies */}
          <div className="mt-8 w-full">
            <p className="mb-3 text-left text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500">Démarrer rapidement</p>
            <div className="space-y-2.5">
              {quickReplies.map((q) => (
                <button key={q} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-left">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: 'hsl(258 100% 60% / 0.14)', color: ACCENT }}><Zap className="h-[17px] w-[17px]" /></span>
                  <span className="flex-1 text-[14px] font-medium">{q}</span>
                  <ChevronRight className="h-[18px] w-[18px] text-slate-500" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <NavBar />
    </Shell>
  );
}

export default function SupportPreviews({ screen = 'list' }: { screen?: string }) {
  if (screen === 'empty') return <EmptyScreen />;
  return <ListScreen />;
}
