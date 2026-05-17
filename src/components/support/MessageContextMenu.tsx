import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Reply, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types/chat';

interface MessageContextMenuProps {
  message: ChatMessage;
  side: 'left' | 'right';
  onReply: () => void;
  children: ReactNode;
}

const LONG_PRESS_MS = 450;

/**
 * Wraps a message bubble and exposes a context menu :
 * - Press long (mobile) → show menu
 * - Right-click (desktop) → show menu
 * - Click outside → close
 * - Menu items : Reply + Copy (texte uniquement)
 */
export function MessageContextMenu({
  message,
  side,
  onReply,
  children,
}: MessageContextMenuProps) {
  const { t } = useTranslation('support');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);

  // Click outside / Escape → close
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
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
      // Petit feedback haptique si supporté
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
    onReply();
  };

  const handleCopy = async () => {
    setOpen(false);
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      toast.success(t('contextMenu.copied'));
    } catch {
      toast.error(t('contextMenu.copyFailed'));
    }
  };

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
            'absolute z-30 flex w-44 flex-col gap-0.5 rounded-2xl border border-border bg-popover p-1 shadow-xl',
            // Position : au-dessus de la bulle, alignée du même côté
            'bottom-full mb-1.5',
            side === 'right' ? 'right-0' : 'left-0'
          )}
          role="menu"
        >
          <MenuItem icon={Reply} label={t('contextMenu.reply')} onClick={handleReply} />
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
