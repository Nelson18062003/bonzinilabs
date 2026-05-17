import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, ChevronLeft, ExternalLink, UserPlus, UserCheck, Lock, Unlock, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { useViewportContainerHeight } from '@/hooks/keyboard/useViewportContainerHeight';
import { notifyAssignment } from '@/lib/notify-assignment';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ChatMessage } from '@/types/chat';
import type { TemplateContext } from '@/lib/template-vars';

export function MobileSupportConversationScreen() {
  const { t } = useTranslation('support');
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { hasPermission, currentUser } = useAdminAuth();
  const canAccess = hasPermission('canAccessSupportChat');
  const containerHeight = useViewportContainerHeight();

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

  const myUserRoleId = admins?.find((a) => a.user_id === adminId)?.id;
  const isAssignedToMe = conversation?.assigned_admin_id === myUserRoleId;
  const assignedAdmin = admins?.find((a) => a.id === conversation?.assigned_admin_id);
  const assignedName = assignedAdmin
    ? `${assignedAdmin.first_name ?? ''} ${assignedAdmin.last_name ?? ''}`.trim() || 'Admin'
    : null;

  const handleClaim = async () => {
    if (!conversationId || !currentUser) return;
    try {
      await claim.mutateAsync(conversationId);
      toast.success(t('admin.actions.claimed'));
      void notifyAssignment({
        conversation_id: conversationId,
        event_type: 'claim',
        new_admin_user_role_id: myUserRoleId ?? null,
        changed_by_admin_user_id: currentUser.id,
      });
    } catch (e) {
      toast.error(t('errors.sendFailed'));
      console.error(e);
    }
  };

  const handleAssign = async (adminUserRoleId: string | null) => {
    if (!conversationId || !currentUser) return;
    try {
      await assign.mutateAsync({ conversationId, adminUserRoleId });
      setAssignOpen(false);
      toast.success(t('admin.actions.assigned'));
      void notifyAssignment({
        conversation_id: conversationId,
        event_type: adminUserRoleId ? 'assign' : 'unassign',
        new_admin_user_role_id: adminUserRoleId,
        changed_by_admin_user_id: currentUser.id,
      });
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
    <div
      className="flex flex-col bg-background"
      style={{ height: containerHeight }}
    >
      {/* Header custom */}
      <header
        className="relative flex items-center gap-2 border-b border-border bg-background px-2 py-2.5"
        style={{ paddingTop: 'calc(10px + env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={() => navigate('/m/support')}
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted -ml-1"
          aria-label={t('detail.back')}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bonzini-violet text-sm font-semibold text-white">
          {(conversation?.client_first_name?.[0] ?? 'C').toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold leading-tight tracking-tight text-foreground">
            {clientName || t('admin.noClientName')}
          </h1>
          {(conversation?.subject || conversation?.client_phone) && (
            <p className="truncate text-[11px] leading-tight text-muted-foreground">
              {conversation?.subject || conversation?.client_phone}
            </p>
          )}
        </div>

        {conversation && !conversation.assigned_admin_id && !isAssignedToMe && (
          <button
            type="button"
            onClick={handleClaim}
            className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-bonzini-violet px-2.5 text-[11px] font-semibold text-white shadow-[0_6px_18px_hsl(258_95%_60%/_0.22)]"
            aria-label={t('admin.actions.claim')}
          >
            <UserPlus className="h-3 w-3" />
            {t('admin.actions.claim')}
          </button>
        )}
        {conversation && conversation.assigned_admin_id && !isAssignedToMe && assignedName && (
          <span className="flex h-7 shrink-0 items-center gap-1 rounded-full bg-muted px-2 text-[10px] font-medium text-muted-foreground">
            <UserCheck className="h-3 w-3" />
            {assignedName}
          </span>
        )}
        {isAssignedToMe && (
          <span className="flex h-7 shrink-0 items-center gap-1 rounded-full bg-[hsl(258_100%_97%)] px-2 text-[10px] font-medium text-bonzini-violet dark:bg-[hsl(258_45%_22%)]">
            <UserCheck className="h-3 w-3" />
            {t('admin.actions.assignedToMe')}
          </span>
        )}

        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          aria-label="Menu"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        <AnimatePresence>
          {menuOpen && conversation && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute right-2 top-full z-20 mt-1 flex w-56 flex-col gap-0.5 rounded-2xl border border-border bg-popover p-1 shadow-lg"
            >
              <MenuItem
                icon={ExternalLink}
                label={t('admin.clientLink')}
                onClick={() => {
                  setMenuOpen(false);
                  navigate(`/m/clients/${conversation.client_id}`);
                }}
              />
              <MenuItem
                icon={UserPlus}
                label={t('admin.actions.assignTo')}
                onClick={() => {
                  setMenuOpen(false);
                  setAssignOpen(true);
                }}
              />
              {conversation.status === 'open' ? (
                <MenuItem icon={Lock} label={t('admin.actions.close')} onClick={handleClose} />
              ) : (
                <MenuItem icon={Unlock} label={t('admin.actions.reopen')} onClick={handleReopen} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <div className="flex-1 overflow-y-auto bg-[hsl(30_8%_96%)] dark:bg-[hsl(220_20%_11%)]">
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
            typingIndicatorSlot={otherIsTyping ? <TypingIndicator who="client" /> : null}
          />
        )}
      </div>

      {conversation?.status === 'closed' && (
        <ClosedBanner message={t('admin.closedHint')} />
      )}

      {conversationId && (
        <MessageInput
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          showCannedResponses
          cannedContext={{
            clientFirstName: conversation?.client_first_name,
            clientLastName: conversation?.client_last_name,
            clientPhone: conversation?.client_phone,
            conversationSubject: conversation?.subject,
            adminFirstName: currentUser?.firstName,
          } satisfies TemplateContext}
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

      {/* Modal assignation */}
      <AnimatePresence>
        {assignOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 flex items-end bg-black/40 sm:items-center sm:justify-center"
            onClick={() => setAssignOpen(false)}
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
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
                        ? 'border-bonzini-violet bg-[hsl(258_100%_97%)] text-bonzini-violet dark:bg-[hsl(258_45%_22%)]'
                        : 'border-border hover:bg-muted'
                    )}
                  >
                    <span>{name}</span>
                    {isCurrent && <UserCheck className="h-4 w-4" />}
                  </button>
                );
              })}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface MenuItemProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}
function MenuItem({ icon: Icon, label, onClick }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span>{label}</span>
    </button>
  );
}
