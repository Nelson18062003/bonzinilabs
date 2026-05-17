import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, ChevronLeft } from 'lucide-react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ChatThread } from '@/components/support/ChatThread';
import { MessageInput } from '@/components/support/MessageInput';
import { ResponseTimeBadge } from '@/components/support/ResponseTimeBadge';
import { TypingIndicator } from '@/components/support/TypingIndicator';
import { ClosedBanner } from '@/components/support/ClosedBanner';
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

  const replyToId = replyTo?.id ?? null;
  const headerTitle = conversation?.subject || t('list.defaultSubject');

  return (
    <MobileLayout>
      <div className="flex h-[calc(100dvh-3.5rem-5rem)] flex-col lg:h-[calc(100dvh-3rem)]">
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur">
          <button
            type="button"
            onClick={() => navigate('/support')}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
            aria-label={t('detail.back')}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold text-foreground">{headerTitle}</h1>
            <p className="truncate text-xs text-muted-foreground">{t('detail.bonziniTeam')}</p>
          </div>
          <ResponseTimeBadge compact />
        </header>

        <div className="flex-1 overflow-y-auto">
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
            />
          )}
        </div>

        {conversation?.status === 'closed' && (
          <ClosedBanner message={t('detail.closedHint')} />
        )}

        {otherIsTyping && <TypingIndicator who="admin" />}

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
      </div>
    </MobileLayout>
  );
};

export default SupportPage;
