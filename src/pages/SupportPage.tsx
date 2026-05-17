import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ChatThread } from '@/components/support/ChatThread';
import { MessageInput } from '@/components/support/MessageInput';
import { ResponseTimeBadge } from '@/components/support/ResponseTimeBadge';
import {
  useMyChatConversation,
  useChatMessages,
  useSendClientMessage,
  useSendClientImage,
  useMarkConversationReadClient,
} from '@/hooks/useClientChat';

const SupportPage = () => {
  const { t } = useTranslation('support');
  const { data: conversation, isLoading: isLoadingConv } = useMyChatConversation();
  const conversationId = conversation?.id ?? null;
  const { data: messages, isLoading: isLoadingMsgs } = useChatMessages(conversationId);
  const sendText = useSendClientMessage();
  const sendImage = useSendClientImage();
  const markRead = useMarkConversationReadClient();

  // Marquer comme lu à l'ouverture
  useEffect(() => {
    if (conversationId && conversation && conversation.unread_count_client > 0) {
      markRead.mutate(conversationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Marquer comme lu à chaque nouveau message admin reçu
  useEffect(() => {
    if (!conversationId || !messages || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.sender_type === 'admin' && !last.read_at) {
      markRead.mutate(conversationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages?.length, conversationId]);

  return (
    <MobileLayout>
      <div className="flex h-[calc(100dvh-3.5rem-5rem)] flex-col lg:h-[calc(100dvh-3rem)]">
        {/* Header — sticky */}
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <div>
            <h1 className="text-base font-semibold text-foreground">
              {t('page.title')}
            </h1>
            <p className="text-xs text-muted-foreground">{t('page.subtitle')}</p>
          </div>
          <ResponseTimeBadge compact />
        </header>

        {/* Zone messages — scrollable */}
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
            />
          )}
        </div>

        {/* Input — sticky bottom */}
        {conversationId && (
          <MessageInput
            onSendText={async (text) => {
              await sendText.mutateAsync({ conversationId, content: text });
            }}
            onSendImage={async (file) => {
              await sendImage.mutateAsync({ conversationId, file });
            }}
          />
        )}
      </div>
    </MobileLayout>
  );
};

export default SupportPage;
