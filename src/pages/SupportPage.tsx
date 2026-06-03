import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, ChevronLeft } from 'lucide-react';
import { ChatThread } from '@/components/support/ChatThread';
import { MessageInput } from '@/components/support/MessageInput';
import { ResponseTimeBadge } from '@/components/support/ResponseTimeBadge';
import { TypingIndicator } from '@/components/support/TypingIndicator';
import { ClosedBanner } from '@/components/support/ClosedBanner';
import { ViewportShell } from '@/components/layout/ViewportShell';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  useMyChatConversation,
  useChatMessages,
  useSendClientMessage,
  useSendClientImage,
  useSendClientVoice,
  useSendClientVideo,
  useSendClientFile,
  useMarkConversationReadClient,
} from '@/hooks/useClientChat';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import type { ChatMessage } from '@/types/chat';

// Fond de la zone de messages (identique côté admin — cohérence cross-app).
const CHAT_BG = 'bg-[hsl(30_8%_96%)] dark:bg-[hsl(220_20%_11%)]';

const SupportPage = () => {
  const { t } = useTranslation('support');
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: conversation, isLoading: isLoadingConv } = useMyChatConversation(conversationId);
  const { data: messages, isLoading: isLoadingMsgs } = useChatMessages(conversationId);
  const sendText = useSendClientMessage();
  const sendImage = useSendClientImage();
  const sendVoice = useSendClientVoice();
  const sendVideo = useSendClientVideo();
  const sendFile = useSendClientFile();
  const markRead = useMarkConversationReadClient();
  const [clientId, setClientId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setClientId((data?.id as string) ?? null));
  }, [user]);

  const { otherIsTyping, notifyTyping, notifyStop } = useTypingIndicator({
    client: supabase,
    conversationId: conversationId ?? null,
    selfSenderType: 'client',
    selfSenderId: clientId,
  });

  useEffect(() => {
    if (conversationId && conversation && conversation.unread_count_client > 0) {
      markRead.mutate(conversationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || !messages || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.sender_type === 'admin' && !last.read_at) {
      markRead.mutate(conversationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages?.length, conversationId]);

  // Garde la conversation collée au bas quand le clavier s'ouvre/se ferme
  // (le cadre suit déjà le clavier via --vvh ; ici simple scroll DOM, 0 re-render).
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const stick = () => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; };
    vv.addEventListener('resize', stick);
    return () => vv.removeEventListener('resize', stick);
  }, []);

  const replyToId = replyTo?.id ?? null;
  const headerTitle = conversation?.subject || t('list.defaultSubject');

  const header = (
    <header className="flex items-center gap-2 border-b border-border bg-background px-2 py-2.5"
            style={{ paddingTop: 'calc(10px + env(safe-area-inset-top))' }}>
      <button
        type="button"
        onClick={() => navigate('/support')}
        className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted -ml-1"
        aria-label={t('detail.back')}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bonzini-violet text-sm font-semibold text-white">
        B
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[15px] font-semibold leading-tight tracking-tight text-foreground">
          {headerTitle}
        </h1>
        <p className="truncate text-[11px] leading-tight text-muted-foreground">
          {t('detail.bonziniTeam')}
        </p>
      </div>
      <ResponseTimeBadge compact />
    </header>
  );

  const footer = (
    <>
      {conversation?.status === 'closed' && <ClosedBanner message={t('detail.closedHint')} />}
      {conversationId && (
        <MessageInput
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onSendText={async (text) => {
            notifyStop();
            await sendText.mutateAsync({ conversationId, content: text, replyToMessageId: replyToId });
            setReplyTo(null);
          }}
          onSendImage={async (file) => {
            await sendImage.mutateAsync({ conversationId, file, replyToMessageId: replyToId });
            setReplyTo(null);
          }}
          onSendVoice={async (payload) => {
            await sendVoice.mutateAsync({ conversationId, ...payload, replyToMessageId: replyToId });
            setReplyTo(null);
          }}
          onSendVideo={async (file) => {
            await sendVideo.mutateAsync({ conversationId, file, replyToMessageId: replyToId });
            setReplyTo(null);
          }}
          onSendFile={async (file) => {
            await sendFile.mutateAsync({ conversationId, file, replyToMessageId: replyToId });
            setReplyTo(null);
          }}
          onTextChange={(v) => {
            if (v.length > 0) notifyTyping();
            else notifyStop();
          }}
        />
      )}
    </>
  );

  return (
    <ViewportShell header={header} footer={footer} scrollRef={scrollRef} scrollClassName={CHAT_BG}>
      {isLoadingConv || isLoadingMsgs ? (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ChatThread
          messages={messages ?? []}
          selfSenderType="client"
          variant="client-app"
          onReply={setReplyTo}
          conversationId={conversationId ?? null}
          clientForReactions={supabase}
          selfReactorId={clientId}
          selfReactorType="client"
          typingIndicatorSlot={otherIsTyping ? <TypingIndicator who="admin" /> : null}
        />
      )}
    </ViewportShell>
  );
};

export default SupportPage;
