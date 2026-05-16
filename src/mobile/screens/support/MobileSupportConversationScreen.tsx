import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, ExternalLink, Phone } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { ChatThread } from '@/components/support/ChatThread';
import { MessageInput } from '@/components/support/MessageInput';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  useAdminConversation,
  useAdminChatMessages,
  useSendAdminMessage,
  useSendAdminImage,
  useMarkConversationReadAdmin,
} from '@/hooks/useAdminChat';

export function MobileSupportConversationScreen() {
  const { t } = useTranslation('support');
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const canAccess = hasPermission('canAccessSupportChat');

  const { data: conversation, isLoading: isLoadingConv } =
    useAdminConversation(conversationId);
  const { data: messages, isLoading: isLoadingMsgs } =
    useAdminChatMessages(conversationId ?? null);

  const sendText = useSendAdminMessage();
  const sendImage = useSendAdminImage();
  const markRead = useMarkConversationReadAdmin();

  useEffect(() => {
    if (conversationId && conversation && conversation.unread_count_admin > 0) {
      markRead.mutate(conversationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || !messages || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.sender_type === 'client' && !last.read_at) {
      markRead.mutate(conversationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages?.length, conversationId]);

  if (!canAccess) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Vous n'avez pas accès au support chat.
      </div>
    );
  }

  const clientName =
    conversation &&
    `${conversation.client_first_name ?? ''} ${conversation.client_last_name ?? ''}`.trim();

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <MobileHeader
        title={clientName || t('admin.noClientName')}
        subtitle={conversation?.client_phone ?? undefined}
        showBack
        onBack={() => navigate('/m/support')}
        rightElement={
          conversation && (
            <button
              type="button"
              onClick={() => navigate(`/m/clients/${conversation.client_id}`)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-bonzini-violet hover:bg-bonzini-violet/10"
              aria-label={t('admin.clientLink')}
            >
              <ExternalLink className="h-4 w-4" />
            </button>
          )
        }
      />

      {/* Messages scrollable area */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingConv || isLoadingMsgs ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ChatThread
            messages={messages ?? []}
            selfSenderType="admin"
            variant="admin-app"
          />
        )}
      </div>

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
  );
}
