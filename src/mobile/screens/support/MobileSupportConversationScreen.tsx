import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, ExternalLink, UserPlus, UserCheck, Lock, Unlock, MoreVertical } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { ChatThread } from '@/components/support/ChatThread';
import { MessageInput } from '@/components/support/MessageInput';
import { TypingIndicator } from '@/components/support/TypingIndicator';
import { ClosedBanner } from '@/components/support/ClosedBanner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { supabaseAdmin } from '@/integrations/supabase/client';
import {
  useAdminConversation,
  useAdminChatMessages,
  useSendAdminMessage,
  useSendAdminImage,
  useSendAdminVoice,
  useSendAdminVideo,
  useSendAdminFile,
  useMarkConversationReadAdmin,
} from '@/hooks/useAdminChat';
import {
  useClaimConversation,
  useAssignConversation,
  useCloseConversation,
  useReopenConversation,
  useSupportAdmins,
} from '@/hooks/useAdminChatTools';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ChatMessage } from '@/types/chat';

export function MobileSupportConversationScreen() {
  const { t } = useTranslation('support');
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { hasPermission, currentUser } = useAdminAuth();
  const canAccess = hasPermission('canAccessSupportChat');

  const { data: conversation, isLoading: isLoadingConv } =
    useAdminConversation(conversationId);
  const { data: messages, isLoading: isLoadingMsgs } =
    useAdminChatMessages(conversationId ?? null);

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
  const { data: admins } = useSupportAdmins();

  const [adminId, setAdminId] = useState<string | null>(currentUser?.id ?? null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  useEffect(() => {
    setAdminId(currentUser?.id ?? null);
  }, [currentUser?.id]);

  const { otherIsTyping, notifyTyping, notifyStop } = useTypingIndicator({
    client: supabaseAdmin,
    conversationId: conversationId ?? null,
    selfSenderType: 'admin',
    selfSenderId: adminId,
  });

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
  const replyToId = replyTo?.id ?? null;

  // L'admin assigné est-il moi ?
  const myUserRoleId = admins?.find((a) => a.user_id === adminId)?.id;
  const isAssignedToMe = conversation?.assigned_admin_id === myUserRoleId;
  const assignedAdmin = admins?.find((a) => a.id === conversation?.assigned_admin_id);
  const assignedName = assignedAdmin
    ? `${assignedAdmin.first_name ?? ''} ${assignedAdmin.last_name ?? ''}`.trim() || 'Admin'
    : null;

  const handleClaim = async () => {
    if (!conversationId) return;
    try {
      await claim.mutateAsync(conversationId);
      toast.success(t('admin.actions.claimed'));
    } catch (e) {
      toast.error(t('errors.sendFailed'));
      console.error(e);
    }
  };

  const handleAssign = async (adminUserRoleId: string | null) => {
    if (!conversationId) return;
    try {
      await assign.mutateAsync({ conversationId, adminUserRoleId });
      setAssignOpen(false);
      toast.success(t('admin.actions.assigned'));
    } catch (e) {
      toast.error(t('errors.sendFailed'));
      console.error(e);
    }
  };

  const handleClose = async () => {
    if (!conversationId) return;
    try {
      await close.mutateAsync(conversationId);
      setMenuOpen(false);
      toast.success(t('admin.actions.closed'));
    } catch (e) {
      toast.error(t('errors.sendFailed'));
      console.error(e);
    }
  };

  const handleReopen = async () => {
    if (!conversationId) return;
    try {
      await reopen.mutateAsync(conversationId);
      setMenuOpen(false);
      toast.success(t('admin.actions.reopened'));
    } catch (e) {
      toast.error(t('errors.sendFailed'));
      console.error(e);
    }
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <MobileHeader
        title={clientName || t('admin.noClientName')}
        subtitle={conversation?.subject ?? conversation?.client_phone ?? undefined}
        showBack
        onBack={() => navigate('/m/support')}
        rightElement={
          conversation && (
            <div className="relative flex items-center gap-1">
              {!isAssignedToMe && !conversation.assigned_admin_id && (
                <button
                  type="button"
                  onClick={handleClaim}
                  className="flex h-9 items-center gap-1.5 rounded-full bg-bonzini-violet px-3 text-xs font-semibold text-white"
                  aria-label={t('admin.actions.claim')}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  {t('admin.actions.claim')}
                </button>
              )}
              {conversation.assigned_admin_id && !isAssignedToMe && assignedName && (
                <span className="flex h-7 items-center gap-1 rounded-full bg-bonzini-amber/20 px-2 text-[11px] font-medium text-bonzini-amber">
                  <UserCheck className="h-3 w-3" />
                  {assignedName}
                </span>
              )}
              {isAssignedToMe && (
                <span className="flex h-7 items-center gap-1 rounded-full bg-bonzini-violet/20 px-2 text-[11px] font-medium text-bonzini-violet">
                  <UserCheck className="h-3 w-3" />
                  {t('admin.actions.assignedToMe')}
                </span>
              )}
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
                aria-label="Menu"
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 flex w-56 flex-col gap-0.5 rounded-2xl border border-border bg-popover p-1 shadow-xl">
                  <MenuButton
                    icon={ExternalLink}
                    label={t('admin.clientLink')}
                    onClick={() => {
                      setMenuOpen(false);
                      navigate(`/m/clients/${conversation.client_id}`);
                    }}
                  />
                  <MenuButton
                    icon={UserPlus}
                    label={t('admin.actions.assignTo')}
                    onClick={() => {
                      setMenuOpen(false);
                      setAssignOpen(true);
                    }}
                  />
                  {conversation.status === 'open' ? (
                    <MenuButton
                      icon={Lock}
                      label={t('admin.actions.close')}
                      onClick={handleClose}
                    />
                  ) : (
                    <MenuButton
                      icon={Unlock}
                      label={t('admin.actions.reopen')}
                      onClick={handleReopen}
                    />
                  )}
                </div>
              )}
            </div>
          )
        }
      />

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
            onReply={setReplyTo}
            conversationId={conversationId ?? null}
            clientForReactions={supabaseAdmin}
            selfReactorId={adminId}
            selfReactorType="admin"
          />
        )}
      </div>

      {conversation?.status === 'closed' && (
        <ClosedBanner message={t('admin.closedHint')} />
      )}

      {otherIsTyping && <TypingIndicator who="client" />}

      {conversationId && (
        <MessageInput
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          showCannedResponses
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

      {/* Modal d'assignation */}
      {assignOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end bg-black/40 sm:items-center sm:justify-center"
          onClick={() => setAssignOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl bg-background p-4 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-base font-semibold">{t('admin.actions.assignTo')}</h3>
            <button
              type="button"
              onClick={() => handleAssign(null)}
              className="mb-1 flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-left text-sm hover:bg-muted"
            >
              <span>{t('admin.actions.unassign')}</span>
            </button>
            {(admins ?? []).map((a) => {
              const name = `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || 'Admin';
              const isCurrent = a.id === conversation?.assigned_admin_id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => handleAssign(a.id as string)}
                  className={cn(
                    'mb-1 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm',
                    isCurrent
                      ? 'border-bonzini-violet bg-bonzini-violet/10 text-bonzini-violet'
                      : 'border-border hover:bg-muted'
                  )}
                >
                  <span>{name}</span>
                  {isCurrent && <UserCheck className="h-4 w-4" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface MenuButtonProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}
function MenuButton({ icon: Icon, label, onClick }: MenuButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted"
    >
      <Icon className="h-4 w-4 text-bonzini-violet" />
      <span>{label}</span>
    </button>
  );
}
