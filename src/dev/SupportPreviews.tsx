// Support module — design previews (dev-only, not wired into the app).
// Rendered via preview.html → src/dev/previewMain.tsx with ?v=sup-<screen>.
// Mirrors the real chat model (ChatConversation / ChatMessage in
// src/types/chat.ts) and the FR copy from src/i18n/locales/fr/support.json.
// Client side: client ↔ "Équipe Bonzini". Accent = violet (bonzini-violet).
import {
  ChevronRight, ChevronLeft, Plus, Search, Zap, Headset, CheckCheck, FileText, Smile, Paperclip,
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

/* ── conversation thread ───────────────────────────────────────────
 * Mirrors ChatMessage / ChatThread: client bubbles (right, violet) vs
 * admin "Équipe Bonzini" (left, grey), date separator, read receipts
 * (Vu), emoji reactions, a quoted reply, a media (proof) message, and a
 * typing indicator. 'closed' swaps the input for the reopen banner. */
type Bubble = {
  from: 'client' | 'admin';
  text?: string;
  time: string;
  seen?: boolean;
  reactions?: string[];
  quote?: { from: 'client' | 'admin'; text: string };
  media?: { kind: 'file' | 'image'; name: string; meta: string };
};
const thread: Bubble[] = [
  { from: 'admin', text: 'Bonjour Aristide 👋 Comment pouvons-nous vous aider aujourd\'hui ?', time: '09:30' },
  { from: 'client', text: 'Bonjour, mon paiement vers Shenzhen Tech est-il bien parti ?', time: '09:38', seen: true },
  { from: 'client', media: { kind: 'file', name: 'recu-paiement.pdf', meta: 'PDF · 248 Ko' }, time: '09:38', seen: true },
  { from: 'admin', text: 'Oui, je vérifie tout de suite votre référence PAY-2024-0117.', time: '09:40' },
  { from: 'admin', text: 'C\'est réglé ✅ Votre fournisseur a bien reçu ¥ 38 236.', time: '09:41', reactions: ['👍', '🙏'],
    quote: { from: 'client', text: 'mon paiement vers Shenzhen Tech est-il bien parti ?' } },
];

function ReadReceipt() {
  return <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-white/70"><CheckCheck className="h-3 w-3" /> Vu</span>;
}
function ReactionPills({ items }: { items: string[] }) {
  return (
    <div className="mt-1 flex gap-1">
      {items.map((e) => (
        <span key={e} className="rounded-full border border-white/10 bg-[#0A0C12] px-1.5 py-0.5 text-[12px] shadow-sm">{e}</span>
      ))}
    </div>
  );
}
function ConversationScreen({ closed = false }: { closed?: boolean }) {
  return (
    <Shell>
      {/* header */}
      <header className="flex items-center gap-2.5 border-b border-white/10 px-3 py-2.5" style={{ paddingTop: 'calc(10px + max(env(safe-area-inset-top), 16px))' }}>
        <button className="grid h-9 w-9 place-items-center rounded-full text-slate-300"><ChevronLeft className="h-5 w-5" /></button>
        <TeamAvatar size={38} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold leading-tight">Équipe Bonzini</h1>
          <p className="truncate text-[11px] text-slate-400">Question sur un paiement</p>
        </div>
      </header>

      {/* messages */}
      <div className="mx-auto max-w-[480px] px-4 pb-40 pt-4">
        {/* date separator */}
        <div className="mb-4 flex justify-center"><span className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-medium text-slate-400">Aujourd'hui</span></div>

        <div className="space-y-2.5">
          {thread.map((m, i) => {
            const mine = m.from === 'client';
            return (
              <div key={i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-[14px] leading-snug ${mine ? 'rounded-br-md text-white' : 'rounded-bl-md bg-white/[0.07] text-slate-100'}`}
                    style={mine ? { background: ACCENT } : undefined}
                  >
                    {/* quoted reply */}
                    {m.quote && (
                      <div className={`mb-1.5 border-l-2 pl-2 ${mine ? 'border-white/50' : 'border-white/20'}`}>
                        <p className={`text-[11px] font-semibold ${mine ? 'text-white/80' : 'text-slate-300'}`}>{m.quote.from === 'client' ? 'Vous' : 'Équipe Bonzini'}</p>
                        <p className={`truncate text-[11.5px] ${mine ? 'text-white/70' : 'text-slate-400'}`}>{m.quote.text}</p>
                      </div>
                    )}
                    {/* media */}
                    {m.media && (
                      <div className={`mb-1 flex items-center gap-2.5 rounded-xl p-2 ${mine ? 'bg-white/15' : 'bg-white/[0.06]'}`}>
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/15"><FileText className="h-[18px] w-[18px]" /></span>
                        <div className="min-w-0"><p className="truncate text-[12.5px] font-semibold">{m.media.name}</p><p className="text-[10.5px] opacity-70">{m.media.meta}</p></div>
                      </div>
                    )}
                    {m.text && <p>{m.text}</p>}
                    <div className={`mt-0.5 flex items-center justify-end text-[10px] ${mine ? 'text-white/70' : 'text-slate-500'}`}>
                      {m.time}{mine && m.seen && <ReadReceipt />}
                    </div>
                  </div>
                  {m.reactions && <ReactionPills items={m.reactions} />}
                </div>
              </div>
            );
          })}

          {/* typing indicator */}
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-white/[0.07] px-3.5 py-3">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </div>

      {/* composer / closed banner */}
      {closed ? (
        <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-[#0A0C12]/95 px-5 py-4 backdrop-blur-xl" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 14px)' }}>
          <p className="text-center text-[13px] text-slate-400">Cette conversation est fermée. <span className="font-semibold text-slate-200">Envoyez un message pour la rouvrir.</span></p>
        </div>
      ) : (
        <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-[#0A0C12]/95 px-3 py-2.5 backdrop-blur-xl" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}>
          <div className="mx-auto flex max-w-[480px] items-center gap-2">
            <button className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-400"><Paperclip className="h-[20px] w-[20px]" /></button>
            <div className="flex flex-1 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5">
              <span className="flex-1 text-[14px] text-slate-500">Écrivez votre message…</span>
              <Smile className="h-[19px] w-[19px] text-slate-500" />
            </div>
            <button className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white" style={{ background: ACCENT }}><Send className="h-[18px] w-[18px]" /></button>
          </div>
        </div>
      )}
    </Shell>
  );
}

export default function SupportPreviews({ screen = 'list' }: { screen?: string }) {
  if (screen === 'empty') return <EmptyScreen />;
  if (screen === 'conversation') return <ConversationScreen />;
  if (screen === 'closed') return <ConversationScreen closed />;
  return <ListScreen />;
}
