import { useEffect, useRef, useState, useCallback, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Paperclip,
  Send,
  Loader2,
  Image as ImageIcon,
  Video as VideoIcon,
  FileText,
  X,
  MessageSquareQuote,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { VoiceRecorder, VoiceRecorderInline, type VoiceBlobPayload } from './VoiceRecorder';
import { QuotedMessage } from './QuotedMessage';
import { CannedResponsesPicker } from './CannedResponsesPicker';
import type { ChatMessage } from '@/types/chat';
import type { TemplateContext } from '@/lib/template-vars';

interface MessageInputProps {
  onSendText: (text: string) => Promise<void> | void;
  onSendImage: (file: File) => Promise<void> | void;
  onSendVoice?: (payload: VoiceBlobPayload) => Promise<void> | void;
  onSendVideo?: (file: File) => Promise<void> | void;
  onSendFile?: (file: File) => Promise<void> | void;
  onTextChange?: (value: string) => void;
  replyTo?: ChatMessage | null;
  onCancelReply?: () => void;
  showCannedResponses?: boolean;
  cannedContext?: TemplateContext;
  initialText?: string;
  disabled?: boolean;
  className?: string;
}

const VIDEO_MIME = 'video/mp4,video/quicktime';
const FILE_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.ms-excel',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
].join(',');

export function MessageInput({
  onSendText,
  onSendImage,
  onSendVoice,
  onSendVideo,
  onSendFile,
  onTextChange,
  replyTo,
  onCancelReply,
  showCannedResponses = false,
  cannedContext,
  initialText,
  disabled = false,
  className,
}: MessageInputProps) {
  const { t } = useTranslation('support');
  const [text, setText] = useState(initialText ?? '');
  const [sendingText, setSendingText] = useState(false);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cannedOpen, setCannedOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialText && initialText.length > 0) setText(initialText);
  }, [initialText]);

  const sending = sendingText || sendingMedia;
  const hasText = text.trim().length > 0;
  const canSend = hasText && text.length <= 2000 && !sending && !disabled;

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (trimmed.length > 2000) {
      toast.error(t('errors.messageTooLong'));
      return;
    }
    setSendingText(true);
    try {
      await onSendText(trimmed);
      setText('');
      onTextChange?.('');
    } catch (e) {
      toast.error(t('errors.sendFailed'));
      console.error(e);
    } finally {
      setSendingText(false);
    }
  }, [text, onSendText, onTextChange, t]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    if (!isMobile && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const makeUploadHandler = useCallback(
    (
      onSend: (file: File) => Promise<void> | void,
      errorKeyByName: (name?: string) => string
    ) => async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';
      setMenuOpen(false);
      setSendingMedia(true);
      try {
        await onSend(file);
      } catch (err) {
        const msg = (err as Error)?.message ?? '';
        toast.error(errorKeyByName(msg));
        console.error(err);
      } finally {
        setSendingMedia(false);
      }
    },
    []
  );

  const handleImageChange = makeUploadHandler(onSendImage, (msg = '') => {
    if (msg.includes('Format')) return t('errors.imageWrongFormat');
    if (msg.includes('volumineuse') || msg.includes('large')) return t('errors.imageTooLarge');
    return t('errors.sendFailed');
  });
  const handleVideoChange = onSendVideo
    ? makeUploadHandler(onSendVideo, (msg = '') => {
        if (msg.includes('Format')) return t('errors.videoWrongFormat');
        if (msg.includes('volumineuse')) return t('errors.videoTooLarge');
        if (msg.includes('longue') || msg.includes('invalide')) return t('errors.videoTooLong');
        return t('errors.sendFailed');
      })
    : undefined;
  const handleFileChange = onSendFile
    ? makeUploadHandler(onSendFile, (msg = '') => {
        if (msg.includes('Format')) return t('errors.fileWrongFormat');
        if (msg.includes('volumineux')) return t('errors.fileTooLarge');
        return t('errors.sendFailed');
      })
    : undefined;

  const handleVoice = onSendVoice
    ? async (payload: VoiceBlobPayload) => {
        setSendingMedia(true);
        try { await onSendVoice(payload); }
        catch (err) { toast.error(t('errors.sendFailed')); console.error(err); }
        finally { setSendingMedia(false); }
      }
    : undefined;

  const showSendBtn = hasText && !isRecording;
  const showMicBtn = !hasText && !!handleVoice;

  return (
    <div
      className={cn('relative flex flex-col bg-background', className)}
      style={{
        // safe-area pour la home bar iPhone
        paddingBottom: 'env(safe-area-inset-bottom)',
        // Ombre élevée vers le haut — donne l'effet "panneau flottant"
        // au-dessus du chat, à la WhatsApp/iMessage. Pas de border-top
        // dur (qui faisait plat), juste la lumière qui suggère l'élévation.
        boxShadow:
          '0 -8px 24px -8px rgba(15, 23, 42, 0.08), 0 -1px 0 hsl(var(--border) / 0.5)',
      }}
    >
      {/* Reply preview */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-t border-border bg-[hsl(258_100%_97%)] dark:bg-[hsl(258_45%_16%)]"
          >
            <div className="px-3 py-2">
              <QuotedMessage
                message={replyTo}
                variant="in-input"
                onCancel={onCancelReply}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cannned responses modal */}
      {showCannedResponses && (
        <CannedResponsesPicker
          open={cannedOpen}
          onClose={() => setCannedOpen(false)}
          context={cannedContext}
          onPick={(content) => {
            setText(content);
            onTextChange?.(content);
          }}
        />
      )}

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={handleImageChange}
      />
      {handleVideoChange && (
        <input
          ref={videoInputRef}
          type="file"
          accept={VIDEO_MIME}
          capture="environment"
          className="hidden"
          onChange={handleVideoChange}
        />
      )}
      {handleFileChange && (
        <input
          ref={fileInputRef}
          type="file"
          accept={FILE_MIME}
          className="hidden"
          onChange={handleFileChange}
        />
      )}

      {/* Attach menu popover */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-[56px] left-3 z-20 flex w-48 flex-col gap-0.5 rounded-2xl border border-border bg-popover p-1 shadow-lg"
          >
            <MenuButton
              icon={ImageIcon}
              label={t('input.sendImage')}
              onClick={() => { setMenuOpen(false); imageInputRef.current?.click(); }}
            />
            {handleVideoChange && (
              <MenuButton
                icon={VideoIcon}
                label={t('input.sendVideo')}
                onClick={() => { setMenuOpen(false); videoInputRef.current?.click(); }}
              />
            )}
            {handleFileChange && (
              <MenuButton
                icon={FileText}
                label={t('input.sendFile')}
                onClick={() => { setMenuOpen(false); fileInputRef.current?.click(); }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* La barre input principale — pas de border-top : la box-shadow
          externe sur le parent fait déjà la séparation visuelle */}
      <div className="relative flex items-end gap-2 bg-background px-2 py-2">
        {/* Templates (admin uniquement) — à gauche, neutre */}
        {showCannedResponses && !isRecording && (
          <button
            type="button"
            onClick={() => setCannedOpen(true)}
            disabled={sending || disabled}
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              'text-muted-foreground hover:bg-muted active:scale-95 transition',
              'disabled:opacity-50'
            )}
            aria-label={t('templates.pickerTitle')}
          >
            <MessageSquareQuote className="h-5 w-5" />
          </button>
        )}

        {/* Bouton + attach (caché pendant recording) */}
        {!isRecording && (
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            disabled={sending || disabled}
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              'text-muted-foreground hover:bg-muted active:scale-95 transition',
              'disabled:opacity-50'
            )}
            aria-label={t('input.attachMenu')}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Paperclip className="h-5 w-5" />}
          </button>
        )}

        {/* Zone centrale : soit textarea (idle), soit voice recorder inline (recording) */}
        {!isRecording ? (
          <div className="flex flex-1 items-end rounded-full bg-muted pl-3 pr-1.5 min-h-[40px]">
            {/* eslint-disable-next-line no-restricted-syntax */}
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                onTextChange?.(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              placeholder={t('input.placeholder')}
              rows={1}
              maxLength={2000}
              disabled={sending || disabled}
              className={cn(
                'min-h-[28px] max-h-[110px] w-full resize-none bg-transparent py-1.5 text-[16px] leading-[1.35]',
                'placeholder:text-muted-foreground focus:outline-none'
              )}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 110) + 'px';
              }}
            />
          </div>
        ) : (
          // Pendant l'enregistrement, on rend l'UI inline du recorder à la place
          // (le composant VoiceRecorder s'occupe d'appeler renderInline via state)
          null
        )}

        {/* Bouton micro ou send (selon état) */}
        {handleVoice && !showSendBtn && (
          <VoiceRecorder
            onSend={handleVoice}
            onRecordingChange={setIsRecording}
            disabled={sending || disabled}
            renderInline={(state) => <VoiceRecorderInline state={state} />}
          />
        )}

        {showSendBtn && (
          <motion.button
            type="button"
            onClick={() => void handleSend()}
            disabled={!canSend}
            whileTap={{ scale: 0.92 }}
            className={cn(
              'flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full transition',
              canSend
                ? 'bg-bonzini-violet text-white shadow-[0_6px_18px_hsl(258_95%_60%/_0.22)]'
                : 'bg-muted text-muted-foreground'
            )}
            aria-label={t('input.send')}
          >
            {sendingText ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-[18px] w-[18px] -rotate-12" />
            )}
          </motion.button>
        )}
      </div>
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
      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-muted"
    >
      <Icon className="h-4 w-4 text-bonzini-violet" />
      <span>{label}</span>
    </button>
  );
}
