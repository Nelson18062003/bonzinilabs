import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Reply, Copy, SmilePlus } from 'lucide-react';
import { toast } from 'sonner';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cn } from '@/lib/utils';
import { useToggleReaction } from '@/hooks/useMessageReactions';
import { ALLOWED_REACTIONS, type ChatMessage, type ChatMessageReaction, type ChatReactionEmoji } from '@/types/chat';

interface MessageContextMenuProps {
  message: ChatMessage;
  side: 'left' | 'right';
  onReply?: () => void;
  // Réactions
  supabaseClient?: SupabaseClient;
  selfReactorId?: string | null;
  selfReactorType?: 'client' | 'admin';
  conversationId?: string | null;
  existingReactions?: ChatMessageReaction[];
  children: ReactNode;
}

const LONG_PRESS_MS = 450;

export function MessageContextMenu({
  message,
  side,
  onReply,
  supabaseClient,
  selfReactorId,
  selfReactorType,
  conversationId,
  existingReactions = [],
  children,
}: MessageContextMenuProps) {
  const { t } = useTranslation('support');
  const [open, setOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);

  const toggleReaction = useToggleReaction(supabaseClient as SupabaseClient);

  const canReact = !!supabaseClient && !!selfReactorId && !!selfReactorType && !!conversationId;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setShowEmojiPicker(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const startPress = () => {
    longPressTriggered.current = false;
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      setOpen(true);
      if (navigator.vibrate) navigator.vibrate(20);
    }, LONG_PRESS_MS);
  };

  const cancelPress = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(true);
  };

  const handleReply = () => {
    setOpen(false);
    setShowEmojiPicker(false);
    onReply?.();
  };

  const handleCopy = async () => {
    setOpen(false);
    setShowEmojiPicker(false);
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      toast.success(t('contextMenu.copied'));
    } catch {
      toast.error(t('contextMenu.copyFailed'));
    }
  };

  const handlePickEmoji = (emoji: ChatReactionEmoji) => {
    if (!canReact) return;
    toggleReaction.mutate({
      messageId: message.id,
      userId: selfReactorId!,
      senderType: selfReactorType!,
      emoji,
      conversationId: conversationId!,
    });
    setOpen(false);
    setShowEmojiPicker(false);
  };

  const myReactedEmojis = new Set(
    existingReactions
      .filter((r) => r.user_id === selfReactorId)
      .map((r) => r.emoji)
  );

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
      onTouchCancel={cancelPress}
      onTouchMove={cancelPress}
      onMouseDown={startPress}
      onMouseUp={cancelPress}
      onMouseLeave={cancelPress}
      onContextMenu={handleContextMenu}
    >
      {children}

      {open && (
        <div
          className={cn(
            'absolute z-30 flex w-48 flex-col gap-0.5 rounded-2xl border border-border bg-popover p-1 shadow-xl',
            'bottom-full mb-1.5',
            side === 'right' ? 'right-0' : 'left-0'
          )}
          role="menu"
        >
          {canReact && (
            <>
              {showEmojiPicker ? (
                <div className="flex items-center justify-between gap-1 p-1">
                  {ALLOWED_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handlePickEmoji(emoji)}
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-full text-lg transition-transform hover:scale-110',
                        myReactedEmojis.has(emoji) && 'bg-bonzini-violet/15'
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : (
                <MenuItem
                  icon={SmilePlus}
                  label={t('contextMenu.react')}
                  onClick={() => setShowEmojiPicker(true)}
                />
              )}
            </>
          )}
          {onReply && (
            <MenuItem icon={Reply} label={t('contextMenu.reply')} onClick={handleReply} />
          )}
          {message.content && (
            <MenuItem icon={Copy} label={t('contextMenu.copy')} onClick={handleCopy} />
          )}
        </div>
      )}
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
      <Icon className="h-4 w-4 text-bonzini-violet" />
      <span>{label}</span>
    </button>
  );
}
