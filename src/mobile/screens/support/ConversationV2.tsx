/**
 * Une conversation client — refonte v2 (maquettes 06/02 à 06/05).
 *
 * En-tête : retour, initiales, nom, « BZ-4821 · à Nelson » (ou « écrit… »),
 * « … ». Fil blanc : bulles grises du client, bulles encre de l'équipe.
 * Bas : bouton éclair (réponses types), champ avec appareil photo, envoyer
 * (maintenir sans texte = vocal). Tant que personne n'a pris la
 * conversation, le bas est un seul bouton noir « Je prends ».
 * « … » : Fiche client · Assigner · Envoyer un fichier · Clore (confirmé) /
 * Rouvrir. Appui long sur une bulle : répondre, réagir, copier.
 *
 * Mêmes hooks et RPC que l'écran d'avant (useAdminChat, useAdminChatTools) ;
 * session `supabaseAdmin` seulement.
 */
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, isSameDay, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowUp, Camera, CheckCheck, ChevronLeft, CircleCheck, Contact, Loader2, Paperclip, RotateCcw, Trash2, UserCheck, UserPlus, X, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { ViewportShell } from '@/components/layout/ViewportShell';
import { ChatImage } from '@/components/support/ChatImage';
import { VideoMessage } from '@/components/support/VideoMessage';
import { VoiceMessage } from '@/components/support/VoiceMessage';
import { FileMessage } from '@/components/support/FileMessage';
import { QuotedMessage } from '@/components/support/QuotedMessage';
import { ReactionPills } from '@/components/support/ReactionPills';
import { MessageContextMenu } from '@/components/support/MessageContextMenu';
import { VoiceRecorder, type InlineRecorderState } from '@/components/support/VoiceRecorder';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { supabaseAdmin } from '@/integrations/supabase/client';
import {
  useAdminChatMessages, useAdminConversation, useMarkConversationReadAdmin, useSendAdminFile, useSendAdminImage, useSendAdminMessage,
  useSendAdminVideo, useSendAdminVoice,
} from '@/hooks/useAdminChat';
import {
  useAssignConversation, useClaimConversation, useCloseConversation, useReopenConversation, useSupportAdmins,
} from '@/hooks/useAdminChatTools';
import { useCannedResponses } from '@/hooks/useCannedResponses';
import { useReactionsForMessages } from '@/hooks/useMessageReactions';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { notifyAssignment } from '@/lib/notify-assignment';
import { substituteTemplateVars } from '@/lib/template-vars';
import { formatDuration } from '@/lib/voice-recording';
import { cn } from '@/lib/utils';
import type { ChatMessage, ChatMessageReaction } from '@/types/chat';
import {
  ActionSheet, BigButton, BottomSheet, ConfirmSheet, EmptyLine, FOCUS_RING, Initials, MoreButton, SURFACE, TEXT, useSheet,
} from '@/mobile/designKit';

const IMAGE_MIME = 'image/jpeg,image/png,image/webp';
const ANY_FILE = [
  IMAGE_MIME, 'video/mp4', 'video/quicktime', 'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword', 'application/vnd.ms-excel', '.pdf', '.doc', '.docx', '.xls', '.xlsx',
].join(',');
const MAX_LEN = 2000;

type AdminRow = { id: string; user_id: string; first_name: string | null; last_name: string | null };
const adminLabel = (a: AdminRow | undefined) => (a ? (a.first_name || `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || 'Admin') : null);

export function ConversationV2() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { hasPermission, currentUser } = useAdminAuth();
  const canAccess = hasPermission('canAccessSupportChat');

  const { data: conv, isLoading: loadingConv } = useAdminConversation(conversationId);
  const { data: messages, isLoading: loadingMsgs } = useAdminChatMessages(conversationId ?? null);
  const { data: admins } = useSupportAdmins();
  const sendText = useSendAdminMessage();
  const sendImage = useSendAdminImage();
  const sendVoice = useSendAdminVoice();
  const sendVideo = useSendAdminVideo();
  const sendFile = useSendAdminFile();
  const markRead = useMarkConversationReadAdmin();
  const claim = useClaimConversation();
  const assign = useAssignConversation();
  const close = useCloseConversation();
  const reopen = useReopenConversation();

  const more = useSheet();
  const assignSheet = useSheet();
  const closeSheet = useSheet();
  const cannedSheet = useSheet();
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const adminId = currentUser?.id ?? null;

  // Le code client (BZ-…) : une lecture de plus, la fiche conversation ne le porte pas.
  const code = useQuery({
    queryKey: ['support-client-code', conv?.client_id],
    enabled: !!conv?.client_id,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabaseAdmin.from('clients').select('customer_code').eq('id', conv!.client_id).maybeSingle();
      return (data?.customer_code as string | null) ?? null;
    },
  });

  const { otherIsTyping, notifyTyping, notifyStop } = useTypingIndicator({
    client: supabaseAdmin,
    conversationId: conversationId ?? null,
    selfSenderType: 'admin',
    selfSenderId: adminId,
  });

  // Lu à l'ouverture, puis à chaque message du client.
  useEffect(() => {
    if (conversationId && conv && conv.unread_count_admin > 0) markRead.mutate(conversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, conv?.id]);
  useEffect(() => {
    if (!conversationId || !messages?.length) return;
    const last = messages[messages.length - 1];
    if (last.sender_type === 'client' && !last.read_at) markRead.mutate(conversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages?.length, conversationId]);

  // Collé au bas : à l'arrivée d'un message et quand le clavier bouge.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages?.length, otherIsTyping]);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const stick = () => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; };
    vv.addEventListener('resize', stick);
    return () => vv.removeEventListener('resize', stick);
  }, []);

  if (!canAccess) {
    return <EmptyLine action={{ label: 'Retour', onClick: () => navigate('/m/more') }}>Réservé à l'équipe des messages.</EmptyLine>;
  }

  const name = conv ? `${conv.client_first_name ?? ''} ${conv.client_last_name ?? ''}`.trim() || 'Client' : '';
  const first = conv?.client_first_name ?? name.split(' ')[0] ?? '';
  const myRoleId = admins?.find((a) => a.user_id === adminId)?.id ?? null;
  const assigned = admins?.find((a) => a.id === conv?.assigned_admin_id) as AdminRow | undefined;
  const assignedName = adminLabel(assigned);
  const closed = conv?.status === 'closed';
  const toTake = !!conv && !closed && !conv.assigned_admin_id;
  const replyId = replyTo?.id ?? null;
  const openedAt = messages?.[0]?.created_at ?? conv?.created_at ?? null;

  const subline = otherIsTyping
    ? 'écrit…'
    : [code.data, assignedName ? `à ${assignedName}` : toTake ? 'à prendre' : null].filter(Boolean).join(' · ');

  const after = () => setReplyTo(null);
  const fail = (e: unknown) => { console.error(e); toast.error("L'envoi a échoué. Réessayez."); };

  const submitText = async () => {
    const v = text.trim();
    if (!v || !conversationId || busy) return;
    if (v.length > MAX_LEN) { toast.error('Message trop long.'); return; }
    setBusy(true);
    notifyStop();
    try {
      await sendText.mutateAsync({ conversationId, content: v, replyToMessageId: replyId });
      setText('');
      after();
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  /** Une photo, une vidéo ou un document : le bon envoi selon le type du fichier. */
  const sendAny = async (file: File) => {
    if (!conversationId) return;
    setBusy(true);
    try {
      if (file.type.startsWith('image/')) await sendImage.mutateAsync({ conversationId, file, replyToMessageId: replyId });
      else if (file.type.startsWith('video/')) await sendVideo.mutateAsync({ conversationId, file, replyToMessageId: replyId });
      else await sendFile.mutateAsync({ conversationId, file, replyToMessageId: replyId });
      after();
    } catch (e) {
      const msg = (e as Error)?.message ?? '';
      toast.error(msg && /format|volumineu|large|longue|invalide/i.test(msg) ? msg : "L'envoi a échoué. Réessayez.");
    } finally { setBusy(false); }
  };
  const onPicked = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) void sendAny(f);
  };

  const doClaim = async () => {
    if (!conversationId || !adminId) return;
    try {
      await claim.mutateAsync(conversationId);
      toast.success('Conversation prise');
      void notifyAssignment({ conversation_id: conversationId, event_type: 'claim', new_admin_user_role_id: myRoleId, changed_by_admin_user_id: adminId });
    } catch (e) { fail(e); }
  };
  const doAssign = async (roleId: string | null) => {
    if (!conversationId || !adminId) return;
    try {
      await assign.mutateAsync({ conversationId, adminUserRoleId: roleId });
      assignSheet.hide();
      toast.success(roleId ? 'Conversation assignée' : 'Plus personne sur la conversation');
      void notifyAssignment({ conversation_id: conversationId, event_type: roleId ? 'assign' : 'unassign', new_admin_user_role_id: roleId, changed_by_admin_user_id: adminId });
    } catch (e) { fail(e); }
  };
  const doClose = async () => {
    if (!conversationId) return;
    try { await close.mutateAsync(conversationId); closeSheet.hide(); toast.success('Conversation close'); } catch (e) { fail(e); }
  };
  const doReopen = async () => {
    if (!conversationId) return;
    try { await reopen.mutateAsync(conversationId); toast.success('Conversation rouverte'); } catch (e) { fail(e); }
  };

  const header = (
    <header className={cn('border-b pt-[env(safe-area-inset-top)]', SURFACE.canvas, SURFACE.divider)}>
      <div className="flex h-[72px] items-center gap-2 pl-1.5 pr-3">
        <button type="button" onClick={() => navigate('/m/support')} aria-label="Retour" className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-[#F5F5F5] dark:active:bg-[#383838]', FOCUS_RING, TEXT.strong)}>
          <ChevronLeft className="h-7 w-7" strokeWidth={2} />
        </button>
        {conv && <Initials name={name} size={48} />}
        <div className="ml-1 min-w-0 flex-1">
          <h1 className={cn('truncate text-[19px] font-semibold leading-tight', TEXT.strong)}>{name}</h1>
          {subline && <p className={cn('truncate text-[16px]', TEXT.muted)}>{subline}</p>}
        </div>
        {conv && <MoreButton onClick={more.show} />}
      </div>
    </header>
  );

  const footer = !conv ? null : toTake ? (
    <div className={cn('border-t px-5 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-3', SURFACE.canvas, SURFACE.divider)}>
      <BigButton onClick={() => void doClaim()} loading={claim.isPending}>Je prends</BigButton>
    </div>
  ) : (
    <div className={cn('border-t pb-[calc(env(safe-area-inset-bottom,0px)+10px)] pt-2.5', SURFACE.canvas, SURFACE.divider)}>
      {closed && (
        <div className="flex items-center justify-between gap-3 px-5 pb-2.5">
          <span className={cn('text-[16px]', TEXT.muted)}>Fermée · se rouvre si le client écrit</span>
          <button type="button" onClick={() => void doReopen()} className={cn('h-11 shrink-0 rounded text-[16px] font-semibold underline underline-offset-[3px]', FOCUS_RING, TEXT.strong)}>Rouvrir</button>
        </div>
      )}
      {replyTo && (
        <div className="px-4 pb-2">
          <QuotedMessage message={replyTo} variant="in-input" accent="white" onCancel={() => setReplyTo(null)} />
        </div>
      )}
      <div className="flex items-end gap-2.5 px-4">
        {!recording && (
          <button type="button" onClick={cannedSheet.show} disabled={busy} aria-label="Réponses types" className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] active:bg-[#E6E6E6] disabled:opacity-40 dark:bg-[#383838]', FOCUS_RING, TEXT.strong)}>
            <Zap className="h-6 w-6" strokeWidth={2} />
          </button>
        )}
        {!recording && (
          <div className={cn('flex min-h-14 min-w-0 flex-1 items-end rounded-[28px] border pl-5 pr-1.5', SURFACE.field, SURFACE.card)}>
            {/* eslint-disable-next-line no-restricted-syntax -- composeur de chat : auto-hauteur, 17 px (pas de zoom iOS) */}
            <textarea
              value={text}
              rows={1}
              maxLength={MAX_LEN}
              placeholder="Message"
              disabled={busy}
              onChange={(e) => { setText(e.target.value); if (e.target.value) notifyTyping(); else notifyStop(); }}
              onInput={(e) => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 120)}px`; }}
              className={cn('max-h-[120px] min-w-0 flex-1 resize-none bg-transparent py-[15px] text-[17px] leading-[1.35] outline-none placeholder:text-[#757575]', TEXT.strong)}
            />
            <button type="button" onClick={() => photoRef.current?.click()} disabled={busy} aria-label="Envoyer une photo" className={cn('mb-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full disabled:opacity-40', FOCUS_RING, TEXT.muted)}>
              <Camera className="h-6 w-6" strokeWidth={1.9} />
            </button>
          </div>
        )}
        {text.trim() ? (
          <button type="button" onClick={() => void submitText()} disabled={busy} aria-label="Envoyer" className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#2C2C2C] text-[#F5F5F5] active:bg-[#1E1E1E] disabled:opacity-50 dark:bg-[#E3E3E3] dark:text-[#1E1E1E]', FOCUS_RING)}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-7 w-7" strokeWidth={2.25} />}
          </button>
        ) : (
          <VoiceRecorder
            onSend={async (p) => {
              if (!conversationId) return;
              try { await sendVoice.mutateAsync({ conversationId, ...p, replyToMessageId: replyId }); after(); } catch (e) { fail(e); }
            }}
            onRecordingChange={setRecording}
            disabled={busy}
            recordingColor="#2C2C2C"
            renderInline={(s) => <RecordingLine state={s} />}
            className="h-14 w-14 bg-[#2C2C2C] text-[#F5F5F5] shadow-none dark:bg-[#E3E3E3] dark:text-[#1E1E1E]"
          />
        )}
      </div>
      <input ref={photoRef} type="file" accept={IMAGE_MIME} capture="environment" className="hidden" onChange={onPicked} />
      <input ref={fileRef} type="file" accept={ANY_FILE} className="hidden" onChange={onPicked} />
    </div>
  );

  return (
    <>
      <ViewportShell header={header} footer={footer} scrollRef={scrollRef} className={SURFACE.canvas}>
        {loadingConv || loadingMsgs ? (
          <div className="flex h-full items-center justify-center"><Loader2 className={cn('h-6 w-6 animate-spin', TEXT.muted)} /></div>
        ) : !conv ? (
          <EmptyLine action={{ label: 'Retour aux messages', onClick: () => navigate('/m/support') }}>Conversation introuvable.</EmptyLine>
        ) : (
          <Thread messages={messages ?? []} conversationId={conversationId ?? null} adminId={adminId} onReply={setReplyTo} typing={otherIsTyping} />
        )}
      </ViewportShell>

      {conv && (
        <>
          <ActionSheet
            open={more.open}
            onClose={more.hide}
            title={<>{name}<span className={cn('mt-1 block text-[17px] font-normal', TEXT.muted)}>{[code.data, openedAt ? `ouverte depuis ${sinceLabel(openedAt)}` : null].filter(Boolean).join(' · ')}</span></>}
            actions={[
              { label: 'Fiche client', icon: Contact, onClick: () => navigate(`/m/clients/${conv.client_id}`) },
              { label: 'Assigner', hint: assignedName ?? 'Personne', icon: UserPlus, onClick: assignSheet.show },
              { label: 'Envoyer un fichier', icon: Paperclip, onClick: () => fileRef.current?.click(), hidden: toTake },
              closed
                ? { label: 'Rouvrir la conversation', icon: RotateCcw, onClick: () => void doReopen() }
                : { label: 'Clore la conversation', icon: CircleCheck, onClick: closeSheet.show },
            ]}
          />

          <BottomSheet open={assignSheet.open} onClose={assignSheet.hide} title="Assigner à">
            <div>
              {(admins ?? []).map((a) => {
                const on = a.id === conv.assigned_admin_id;
                return (
                  <button key={a.id} type="button" disabled={assign.isPending} onClick={() => void doAssign(a.id as string)} className={cn('flex min-h-[56px] w-full items-center gap-3.5 border-b py-2.5 text-left', SURFACE.divider, FOCUS_RING, 'active:bg-[#F5F5F5] dark:active:bg-[#383838]')}>
                    <Initials name={`${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || 'A'} size={44} />
                    <span className={cn('min-w-0 flex-1 truncate text-[17px] font-semibold', TEXT.strong)}>{`${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || 'Admin'}</span>
                    {on && <UserCheck className={cn('h-5 w-5', TEXT.strong)} />}
                  </button>
                );
              })}
              <button type="button" disabled={assign.isPending || !conv.assigned_admin_id} onClick={() => void doAssign(null)} className={cn('flex min-h-[56px] w-full items-center gap-3.5 py-2.5 text-left disabled:opacity-40', FOCUS_RING)}>
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F5F5F5] dark:bg-[#383838]"><X className={cn('h-5 w-5', TEXT.strong)} /></span>
                <span className={cn('text-[17px] font-semibold', TEXT.strong)}>Personne</span>
              </button>
            </div>
          </BottomSheet>

          <ConfirmSheet
            open={closeSheet.open}
            onClose={closeSheet.hide}
            title="Clore la conversation ?"
            subtitle={`Elle se rouvre si ${first || 'le client'} écrit.`}
            rows={[{ label: 'Client', value: name }, { label: 'Assignée à', value: assignedName ?? 'Personne' }]}
            confirmLabel="Clore"
            cancelLabel="Garder ouverte"
            loading={close.isPending}
            onConfirm={() => void doClose()}
          />

          <CannedSheet
            open={cannedSheet.open}
            onClose={cannedSheet.hide}
            context={{ clientFirstName: conv.client_first_name, clientLastName: conv.client_last_name, clientPhone: conv.client_phone, conversationSubject: conv.subject, adminFirstName: currentUser?.firstName }}
            onPick={(v) => { setText(v); notifyTyping(); }}
            onManage={() => navigate('/m/more/canned-responses')}
          />
        </>
      )}
    </>
  );
}

/** « 09:12 » aujourd'hui, sinon « hier » ou « 14 oct. ». */
function sinceLabel(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'hier';
  return format(d, 'd MMM', { locale: fr });
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return "Aujourd'hui";
  if (isYesterday(d)) return 'Hier';
  return format(d, 'd MMMM yyyy', { locale: fr });
}

/** Le fil : jours, bulles, réactions, l'heure sous chaque bulle (dans la bulle). */
function Thread({
  messages, conversationId, adminId, onReply, typing,
}: {
  messages: ChatMessage[];
  conversationId: string | null;
  adminId: string | null;
  onReply: (m: ChatMessage) => void;
  typing: boolean;
}) {
  const ids = useMemo(() => messages.map((m) => m.id), [messages]);
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const { data: reactions } = useReactionsForMessages(supabaseAdmin, conversationId, ids);
  const reactionsOf = useMemo(() => {
    const map = new Map<string, ChatMessageReaction[]>();
    for (const r of reactions ?? []) map.set(r.message_id, [...(map.get(r.message_id) ?? []), r]);
    return map;
  }, [reactions]);

  if (messages.length === 0) return <EmptyLine>Aucun message pour l'instant.</EmptyLine>;

  return (
    <div className="flex flex-col gap-2.5 px-3 py-4">
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const newDay = !prev || !isSameDay(new Date(prev.created_at), new Date(m.created_at));
        const self = m.sender_type === 'admin';
        const list = reactionsOf.get(m.id) ?? [];
        return (
          <div key={m.id} className="flex flex-col gap-1">
            {newDay && (
              <div className="my-2 flex justify-center">
                <span className={cn('rounded-lg bg-[#F5F5F5] px-3.5 py-1.5 text-[16px] font-semibold dark:bg-[#383838]', TEXT.muted)}>{dayLabel(m.created_at)}</span>
              </div>
            )}
            <div className={cn('flex w-full', self ? 'justify-end' : 'justify-start')}>
              <MessageContextMenu
                message={m}
                side={self ? 'right' : 'left'}
                onReply={() => onReply(m)}
                supabaseClient={supabaseAdmin}
                selfReactorId={adminId}
                selfReactorType="admin"
                conversationId={conversationId}
                existingReactions={list}
                className="w-fit max-w-[80%]"
              >
                <Bubble m={m} self={self} quoted={m.reply_to_message_id ? byId.get(m.reply_to_message_id) ?? null : null} />
              </MessageContextMenu>
            </div>
            {list.length > 0 && (
              <div className={cn('flex w-full', self ? 'justify-end' : 'justify-start')}>
                <ReactionPills reactions={list} selfReactorId={adminId} align={self ? 'right' : 'left'} supabaseClient={supabaseAdmin} messageId={m.id} conversationId={conversationId} selfReactorType="admin" />
              </div>
            )}
          </div>
        );
      })}
      {typing && <p className={cn('px-2 text-[16px] italic', TEXT.muted)}>écrit…</p>}
    </div>
  );
}

function Bubble({ m, self, quoted }: { m: ChatMessage; self: boolean; quoted: ChatMessage | null }) {
  const media = m.media_type;
  const mediaOnly = !!m.media_url && !m.content;
  // Vocal et fichier gardent un fond clair : leurs lecteurs sont dessinés pour lui.
  const light = !self || media === 'voice' || media === 'file';
  return (
    <div className={cn(
      'rounded-2xl text-[17px] leading-[1.45]',
      mediaOnly && (media === 'image' || media === 'video') ? 'p-2' : 'px-4 pb-2 pt-3',
      light ? 'bg-[#F5F5F5] text-[#1E1E1E] dark:bg-[#383838] dark:text-[#F5F5F5]' : 'bg-[#2C2C2C] text-[#F5F5F5] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]',
    )}>
      {quoted && <QuotedMessage message={quoted} variant="in-bubble" accent={light ? 'violet' : 'white'} className="mb-2" />}
      {media === 'image' && m.media_url && <ChatImage path={m.media_url} side={m.sender_type} variant="admin-app" className={m.content ? 'mb-2' : ''} />}
      {media === 'video' && m.media_url && <VideoMessage path={m.media_url} durationSeconds={m.media_duration_seconds} variant="admin-app" className={m.content ? 'mb-2' : ''} />}
      {media === 'voice' && m.media_url && <VoiceMessage path={m.media_url} peaks={m.media_waveform_peaks} durationSeconds={m.media_duration_seconds} perspective={self ? 'self' : 'other'} variant="admin-app" />}
      {media === 'file' && m.media_url && <FileMessage path={m.media_url} filename={m.media_filename} sizeBytes={m.media_size_bytes} perspective={self ? 'self' : 'other'} variant="admin-app" />}
      {m.content && <p className="m-0 whitespace-pre-wrap break-words">{m.content}</p>}
      <div className={cn('mt-1 flex items-center justify-end gap-1.5 text-[15px] tabular-nums', light ? TEXT.muted : 'opacity-75', mediaOnly && (media === 'image' || media === 'video') && 'px-2 pb-1')}>
        {format(new Date(m.created_at), 'HH:mm')}
        {self && <CheckCheck className={cn('h-[18px] w-[18px]', m.read_at ? '' : 'opacity-50')} aria-label={m.read_at ? 'Lu' : 'Envoyé'} />}
      </div>
    </div>
  );
}

/** Pendant le vocal : à la place du champ, le temps qui passe et l'annulation. */
function RecordingLine({ state }: { state: InlineRecorderState }) {
  return (
    <div className={cn('flex min-h-14 flex-1 items-center gap-3 rounded-[28px] border px-4', state.isCancelArmed ? 'border-[#EC221F] bg-[#FDD3D0]' : cn(SURFACE.field, SURFACE.card))}>
      {state.isLocked ? (
        <button type="button" onClick={state.onCancel} aria-label="Annuler le vocal" className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FDD3D0] text-[#900B09]', FOCUS_RING)}>
          <Trash2 className="h-5 w-5" />
        </button>
      ) : (
        <span className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-[#EC221F]" />
      )}
      <span className={cn('text-[17px] font-semibold tabular-nums', TEXT.strong)}>{formatDuration(state.elapsedSeconds)}</span>
      <span className={cn('min-w-0 flex-1 truncate text-[15px]', state.isCancelArmed ? 'text-[#900B09]' : TEXT.muted)}>
        {state.isLocked ? 'Toucher envoyer' : state.isCancelArmed ? 'Relâcher pour annuler' : 'Glisser pour annuler'}
      </span>
      {state.isLocked && (
        <button type="button" onClick={state.onLockedSend} aria-label="Envoyer le vocal" className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#2C2C2C] text-[#F5F5F5]', FOCUS_RING)}>
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

/** Les réponses types (06/03) : le prénom déjà rempli ; toucher insère dans le champ. */
function CannedSheet({
  open, onClose, context, onPick, onManage,
}: {
  open: boolean;
  onClose: () => void;
  context: Parameters<typeof substituteTemplateVars>[1];
  onPick: (content: string) => void;
  onManage: () => void;
}) {
  const { data: templates, isLoading } = useCannedResponses();
  const resolve = (c: string) => substituteTemplateVars(c, { ...context, dateLocale: fr });
  return (
    <BottomSheet open={open} onClose={onClose}>
      <h3 className={cn('mb-1 text-[24px] font-semibold', TEXT.strong)}>Réponses types</h3>
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className={cn('h-5 w-5 animate-spin', TEXT.muted)} /></div>
      ) : (templates ?? []).length === 0 ? (
        <p className={cn('py-6 text-[16px]', TEXT.muted)}>Aucune réponse type.</p>
      ) : (
        <div>
          {(templates ?? []).map((tpl) => {
            const v = resolve(tpl.content);
            return (
              <button key={tpl.id} type="button" onClick={() => { onPick(v); onClose(); }} className={cn('block w-full border-b py-4 text-left last:border-b-0 active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.divider, FOCUS_RING)}>
                <span className={cn('block text-[18px] font-semibold', TEXT.strong)}>{tpl.label}</span>
                <span className={cn('mt-1 block truncate text-[16px]', TEXT.muted)}>{v}</span>
              </button>
            );
          })}
        </div>
      )}
      <BigButton variant="soft" className="mt-4" onClick={() => { onClose(); onManage(); }}>Gérer les réponses</BigButton>
    </BottomSheet>
  );
}
