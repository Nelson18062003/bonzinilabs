/**
 * Mola — refonte v2 (maquettes 06/12 et 10/63), plein écran.
 *
 * En-tête : la mascotte, « Mola · Directeur des opérations », « … »
 * (Nouvelle conversation, Historique). Le fil : vos messages à l'encre, ceux
 * de Mola en gris. Une action proposée arrive en carte « À confirmer » :
 * lignes avant / après, bandeau rouge si l'action est sensible, Annuler ou
 * Confirmer — rien ne s'exécute sans ce geste (assistant_pending_actions).
 * Bas : « + » (jusqu'à 5 images ou PDF, validateUploadFile), le champ, envoyer.
 * Toute la logique reste celle de useAdminAssistant (edge admin-assistant,
 * étiquettes @mola côté serveur).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isToday, isYesterday, format, differenceInCalendarDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowUp, BadgeDollarSign, Check, FileText, History, Loader2, Maximize2, MessageCircle, Plus, SquarePen, X } from 'lucide-react';
import { toast } from 'sonner';
import { ViewportShell } from '@/components/layout/ViewportShell';
import { MolaMascot } from '@/components/MolaMascot';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdminAssistant, useAssistantConversations, type AssistantConversationItem, type AssistantProposal } from '@/hooks/useAdminAssistant';
import { uid } from '@/lib/uid';
import { cn, validateUploadFile } from '@/lib/utils';
import {
  ActionSheet, BigButton, Dock, EmptyLine, FOCUS_RING, IconCircle, ItemList, ItemRow, MoreButton, ScreenLoader, ScreenTop, SURFACE, TEXT, useSheet,
} from '@/mobile/designKit';
import { CapsLabel, RedNotice } from '@/mobile/screens/more/parts';
import { ImagePreview, RichText } from './assistantParts';

const SUGGESTIONS = ['Volume de la semaine ?', 'Derniers dépôts en attente', 'Où en sont mes conteneurs ?', 'Taux Alipay du jour'];
const MAX_FILES = 5;
const COMPOSER_MAX_H = 128;

interface PendingFile { id: string; file: File; url: string; isPdf: boolean }

function Mascot({ size }: { size: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#D9D9D9] bg-white dark:border-[#444444]" style={{ width: size, height: size }}>
      <MolaMascot small={size < 64} alt="" className="h-full w-full object-cover" fallback={<MessageCircle className="h-1/2 w-1/2" />} />
    </span>
  );
}

export function MolaV2() {
  const [view, setView] = useState<'chat' | 'history'>('chat');
  const assistant = useAdminAssistant();
  const { loadHistory } = assistant;
  // Reprend la dernière conversation à l'ouverture, comme avant.
  useEffect(() => { void loadHistory(); }, [loadHistory]);
  if (view === 'history') {
    return (
      <MolaHistory
        onBack={() => setView('chat')}
        onOpen={(id) => { void assistant.loadHistory(id); setView('chat'); }}
        onNew={() => { assistant.reset(); setView('chat'); }}
      />
    );
  }
  return <MolaChat assistant={assistant} onHistory={() => setView('history')} />;
}

function MolaChat({ assistant, onHistory }: { assistant: ReturnType<typeof useAdminAssistant>; onHistory: () => void }) {
  const navigate = useNavigate();
  const { profile, currentUser } = useAdminAuth();
  const { messages, isLoading, sendMessage, confirmProposal, cancelProposal, reset } = assistant;
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const more = useSheet();

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const stick = () => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; };
    vv.addEventListener('resize', stick);
    return () => vv.removeEventListener('resize', stick);
  }, []);
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [messages, isLoading, pending]);
  // Les aperçus locaux sont rendus au navigateur en quittant.
  useEffect(() => () => { pending.forEach((p) => URL.revokeObjectURL(p.url)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearPending = () => { pending.forEach((p) => URL.revokeObjectURL(p.url)); setPending([]); };
  const resetArea = () => { if (areaRef.current) areaRef.current.style.height = 'auto'; };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const room = MAX_FILES - pending.length;
    if (room <= 0) { toast.error(`${MAX_FILES} fichiers au plus par message.`); return; }
    const next: PendingFile[] = [];
    for (const file of Array.from(list).slice(0, room)) {
      try { validateUploadFile(file); } catch (e) { toast.error(e instanceof Error ? e.message : 'Fichier refusé'); continue; }
      next.push({ id: uid(), file, url: URL.createObjectURL(file), isPdf: file.type === 'application/pdf' });
    }
    if (next.length) setPending((p) => [...p, ...next]);
    if (fileRef.current) fileRef.current.value = '';
  };
  const removePending = (id: string) => setPending((prev) => {
    const f = prev.find((p) => p.id === id);
    if (f) URL.revokeObjectURL(f.url);
    return prev.filter((p) => p.id !== id);
  });

  const canSend = (!!input.trim() || pending.length > 0) && !isLoading;
  const send = () => {
    if (!canSend) return;
    sendMessage(input, pending.map((p) => p.file));
    setInput('');
    resetArea();
    clearPending();
  };
  const startNew = () => { if (isLoading) return; reset(); setInput(''); resetArea(); clearPending(); };

  const header = (
    <header className={cn('border-b pt-[env(safe-area-inset-top)]', SURFACE.canvas, SURFACE.divider)}>
      <div className="flex h-[72px] items-center gap-2 pl-1.5 pr-3">
        <button type="button" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/m'))} aria-label="Retour" className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-[#F5F5F5] dark:active:bg-[#383838]', FOCUS_RING, TEXT.strong)}>
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <Mascot size={48} />
        <div className="ml-1 min-w-0 flex-1">
          <h1 className={cn('truncate text-[19px] font-semibold leading-tight', TEXT.strong)}>Mola</h1>
          <p className={cn('truncate text-[16px]', TEXT.muted)}>Directeur des opérations</p>
        </div>
        <MoreButton onClick={more.show} />
      </div>
    </header>
  );

  const composer = (
    <div className={cn('border-t px-4 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] pt-2.5', SURFACE.canvas, SURFACE.divider)}>
      {pending.length > 0 && (
        <div className="flex gap-2.5 overflow-x-auto pb-2.5">
          {pending.map((p) => (
            <div key={p.id} className="relative shrink-0">
              {p.isPdf ? (
                <div className={cn('flex h-16 w-16 flex-col items-center justify-center rounded-lg border px-1', SURFACE.divider, TEXT.muted)}>
                  <FileText className="h-6 w-6" />
                  <span className="max-w-[56px] truncate text-[14px]">PDF</span>
                </div>
              ) : (
                <button type="button" onClick={() => setPreview({ url: p.url, name: p.file.name })} aria-label={`Voir ${p.file.name}`} className={cn('block overflow-hidden rounded-lg border', SURFACE.divider, FOCUS_RING)}>
                  <img src={p.url} alt={p.file.name} className="h-16 w-16 object-cover" />
                </button>
              )}
              <button type="button" onClick={() => removePending(p.id)} aria-label="Retirer" className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#2C2C2C] text-[#F5F5F5]">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2.5">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={isLoading} aria-label="Joindre une image ou un PDF" className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] active:bg-[#E6E6E6] disabled:opacity-40 dark:bg-[#383838]', FOCUS_RING, TEXT.strong)}>
          <Plus className="h-7 w-7" strokeWidth={2} />
        </button>
        <div className={cn('flex min-h-14 min-w-0 flex-1 items-end rounded-[28px] border px-5', SURFACE.field, SURFACE.card)}>
          {/* eslint-disable-next-line no-restricted-syntax -- composeur de chat : auto-hauteur, 17 px (pas de zoom iOS) */}
          <textarea
            ref={areaRef}
            value={input}
            rows={1}
            placeholder="Écrire à Mola"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !/Mobi|Android/i.test(navigator.userAgent)) { e.preventDefault(); send(); } }}
            onInput={(e) => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_H)}px`; }}
            className={cn('max-h-32 min-w-0 flex-1 resize-none bg-transparent py-[15px] !text-[17px] leading-[1.35] outline-none placeholder:text-[#757575]', TEXT.strong)}
          />
        </div>
        <button type="button" onClick={send} disabled={!canSend} aria-label="Envoyer" className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-full', FOCUS_RING, canSend ? 'bg-[#2C2C2C] text-[#F5F5F5] active:bg-[#1E1E1E] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]' : cn('bg-[#F5F5F5] dark:bg-[#383838]', TEXT.muted))}>
          <ArrowUp className="h-7 w-7" strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );

  const firstName = profile?.first_name || currentUser?.firstName || '';

  return (
    <>
      <ViewportShell header={header} footer={composer} scrollRef={scrollRef} scrollClassName="px-3 py-4" className={SURFACE.canvas}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center px-2 pt-8 text-center">
            <Mascot size={104} />
            <h2 className={cn('mt-4 text-[24px] font-semibold', TEXT.strong)}>Bonjour {firstName}</h2>
            <div className="mt-6 w-full max-w-md text-left">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => sendMessage(s)} className={cn('flex min-h-[56px] w-full items-center border-b px-2 text-[17px] font-semibold last:border-b-0 active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.divider, FOCUS_RING, TEXT.strong)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m) => {
              const mine = m.role === 'user';
              return (
                <div key={m.id} className={cn('flex flex-col gap-2.5', mine ? 'items-end' : 'items-start')}>
                  {(m.text || m.attachments?.length) && (
                    <div className={cn('flex w-full items-end gap-2', mine ? 'justify-end' : 'justify-start')}>
                      {!mine && <Mascot size={40} />}
                      <div className={cn(
                        'max-w-[82%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-[17px] leading-[1.45]',
                        mine ? 'bg-[#2C2C2C] text-[#F5F5F5] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]'
                          : m.error ? 'bg-[#FDD3D0] text-[#900B09]' : cn('bg-[#F5F5F5] dark:bg-[#383838]', TEXT.strong),
                      )}>
                        {m.attachments?.length ? (
                          <div className="mb-2 flex flex-wrap gap-2">
                            {m.attachments.map((a, i) => a.kind === 'image' && a.url ? (
                              <button key={i} type="button" onClick={() => setPreview({ url: a.url!, name: a.name })} className={cn('overflow-hidden rounded-lg', FOCUS_RING)}>
                                <img src={a.url} alt={a.name} className="h-24 w-24 object-cover" />
                              </button>
                            ) : (
                              <span key={i} className="flex items-center gap-2 rounded-lg bg-black/10 px-3 py-2 text-[15px] dark:bg-white/10">
                                <FileText className="h-4 w-4 shrink-0" /><span className="max-w-[140px] truncate">{a.name}</span>
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {m.text && <RichText text={m.text} />}
                      </div>
                    </div>
                  )}
                  {m.images?.map((img, i) => (
                    <button key={i} type="button" onClick={() => setPreview({ url: img.url, name: img.name })} className={cn('relative ml-12 block max-w-[78%] overflow-hidden rounded-lg border text-left', SURFACE.divider, FOCUS_RING)}>
                      <img src={img.url} alt={img.name} className="h-auto w-full" />
                      <span className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white"><Maximize2 className="h-4 w-4" /></span>
                    </button>
                  ))}
                  {m.proposals?.map((p) => (
                    <div key={p.id} className="w-full pl-12">
                      <ProposalCard p={p} onConfirm={() => confirmProposal(p.id)} onCancel={() => cancelProposal(p.id)} />
                    </div>
                  ))}
                </div>
              );
            })}
            {isLoading && (
              <div className="flex items-end gap-2">
                <Mascot size={40} />
                <div className={cn('flex items-center gap-2 rounded-2xl bg-[#F5F5F5] px-4 py-3 text-[16px] dark:bg-[#383838]', TEXT.muted)}>
                  <Loader2 className="h-4 w-4 animate-spin" /> Mola réfléchit…
                </div>
              </div>
            )}
          </div>
        )}
      </ViewportShell>
      {preview && <ImagePreview image={preview} onClose={() => setPreview(null)} />}
      <ActionSheet
        open={more.open}
        onClose={more.hide}
        actions={[
          { label: 'Nouvelle conversation', icon: SquarePen, onClick: startNew, disabled: isLoading },
          { label: 'Historique', icon: History, onClick: onHistory },
        ]}
      />
    </>
  );
}

/** La carte « À confirmer » (06/12), puis son résultat une fois le geste fait. */
function ProposalCard({ p, onConfirm, onCancel }: { p: AssistantProposal; onConfirm: () => void; onCancel: () => void }) {
  const { summary, state, resultText } = p;
  if (state === 'done' || state === 'failed' || state === 'cancelled') {
    const meta = {
      done: { tone: 'bg-[#CFF7D3] text-[#02542D]', title: 'Action exécutée', Icon: Check },
      failed: { tone: 'bg-[#FDD3D0] text-[#900B09]', title: 'Échec', Icon: X },
      cancelled: { tone: 'bg-[#F5F5F5] text-[#303030]', title: 'Action annulée', Icon: X },
    }[state];
    return (
      <div className={cn('flex items-center gap-3 rounded-lg border px-4 py-3.5', SURFACE.divider)}>
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', meta.tone)}><meta.Icon className="h-5 w-5" strokeWidth={2.5} /></span>
        <span className="min-w-0">
          <span className={cn('block text-[17px] font-semibold', TEXT.strong)}>{meta.title}</span>
          {resultText && <span className={cn('block text-[16px]', TEXT.muted)}>{resultText}</span>}
        </span>
      </div>
    );
  }
  const danger = !!summary.danger;
  const executing = state === 'executing';
  return (
    <div className={cn('overflow-hidden rounded-lg border', SURFACE.divider)}>
      <div className="px-4 pb-4 pt-4">
        <CapsLabel>À confirmer</CapsLabel>
        <div className={cn('mt-1.5 text-[22px] font-semibold leading-tight', TEXT.strong)}>{summary.title}</div>
        {summary.subtitle && <div className={cn('mt-1 text-[16px]', TEXT.muted)}>{summary.subtitle}</div>}
        {summary.amount && <div className={cn('mt-3 text-[28px] font-bold tabular-nums', TEXT.strong)}>{summary.amount}</div>}
        {danger && <RedNotice className="mt-3">Action sensible</RedNotice>}
      </div>
      {summary.lines.map((l, i) => (
        <div key={i} className={cn('flex items-center justify-between gap-3 border-t px-4 py-3.5 text-[16px]', SURFACE.divider)}>
          <span className={TEXT.muted}>{l.label}</span>
          <span className={cn('min-w-0 text-right font-semibold tabular-nums', TEXT.strong)}>{l.value}</span>
        </div>
      ))}
      <div className={cn('border-t px-4 py-4', SURFACE.divider)}>
        {executing ? (
          <div className={cn('flex h-14 items-center justify-center gap-2 rounded-lg bg-[#F5F5F5] text-[17px] font-semibold dark:bg-[#383838]', TEXT.strong)}>
            <Loader2 className="h-5 w-5 animate-spin" /> Exécution…
          </div>
        ) : (
          <div className="grid grid-cols-[2fr_3fr] gap-3">
            <BigButton variant="soft" onClick={onCancel}>Annuler</BigButton>
            <BigButton variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{summary.confirmLabel || 'Confirmer'}</BigButton>
          </div>
        )}
      </div>
    </div>
  );
}

/** « Aujourd'hui », « Cette semaine », « Plus ancien ». */
function bucket(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return "Aujourd'hui";
  if (differenceInCalendarDays(new Date(), d) < 7) return 'Cette semaine';
  return 'Plus ancien';
}
function when(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Hier';
  return format(d, differenceInCalendarDays(new Date(), d) < 7 ? 'EEE' : 'd MMM', { locale: fr }).replace(/^./, (c) => c.toUpperCase());
}

function rowOf(c: AssistantConversationItem) {
  const last = c.actions[0];
  const title = c.title || last?.title || 'Conversation';
  if (!last) return { title, sub: when(c.updated_at), tag: undefined, icon: MessageCircle };
  // Statuts de assistant_pending_actions : pending · executing · executed · cancelled · failed.
  const st = last.status;
  const word = st === 'executed' ? 'action confirmée' : st === 'cancelled' ? 'action annulée' : st === 'failed' ? 'action en échec' : 'action en attente';
  return {
    title,
    sub: `${when(c.updated_at)} · ${word}`,
    tag: st === 'executed' ? { tone: 'success' as const, label: 'Fait' }
      : st === 'cancelled' ? { tone: 'neutral' as const, label: 'Annulé' }
        : st === 'failed' ? { tone: 'danger' as const, label: 'Échec' }
          : { tone: 'pending' as const, label: 'À confirmer' },
    icon: BadgeDollarSign,
  };
}

/** L'historique (10/63) : par jour, les actions faites ou annulées ; « Nouvelle conversation ». */
function MolaHistory({ onBack, onOpen, onNew }: { onBack: () => void; onOpen: (id: string) => void; onNew: () => void }) {
  const q = useAssistantConversations();
  const groups = useMemo(() => {
    const out: { label: string; items: AssistantConversationItem[] }[] = [];
    for (const c of q.data ?? []) {
      const label = bucket(c.updated_at);
      const g = out.find((x) => x.label === label);
      if (g) g.items.push(c); else out.push({ label, items: [c] });
    }
    return out;
  }, [q.data]);

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop
        title="Mola"
        onBack={onBack}
        right={
          <button type="button" onClick={onNew} aria-label="Nouvelle conversation" className={cn('-mr-2 flex h-11 w-11 items-center justify-center rounded-full active:bg-[#F5F5F5] dark:active:bg-[#383838]', FOCUS_RING, TEXT.strong)}>
            <Plus className="h-7 w-7" strokeWidth={2} />
          </button>
        }
      />
      <div className="flex justify-center pt-6"><Mascot size={104} /></div>
      {q.isLoading ? (
        <ScreenLoader className="min-h-[30vh]" />
      ) : q.isError ? (
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void q.refetch() }}>L'historique n'a pas pu être chargé.</EmptyLine>
      ) : groups.length === 0 ? (
        <EmptyLine>Aucune conversation pour l'instant.</EmptyLine>
      ) : (
        groups.map((g) => (
          <div key={g.label}>
            <CapsLabel className="px-5 pt-6">{g.label}</CapsLabel>
            <ItemList className="pt-1">
              {g.items.map((c) => {
                const r = rowOf(c);
                return <ItemRow key={c.id} leading={<IconCircle icon={r.icon} />} title={r.title} subtitle={r.sub} tag={r.tag} chevron={!r.tag} onClick={() => onOpen(c.id)} />;
              })}
            </ItemList>
          </div>
        ))
      )}
      <Dock>
        <BigButton onClick={onNew}>Nouvelle conversation</BigButton>
      </Dock>
    </div>
  );
}
