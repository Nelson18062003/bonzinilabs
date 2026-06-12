import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Trash2,
  Edit3,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Eye,
  EyeOff,
  Check,
} from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  useAdminAllQuickReplies,
  useCreateQuickReply,
  useUpdateQuickReply,
  useDeleteQuickReply,
  useReorderQuickReplies,
} from '@/hooks/useAdminQuickReplies';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ChatClientQuickReply } from '@/types/chat';
import {
  SURFACE,
  TEXT,
  PRIMARY_PILL,
  Card,
  Holder,
  StatusPill,
  FormField,
  TextInput,
  PrimaryPill,
  SoftPill,
  BottomSheet,
  ScreenLoader,
} from '@/mobile/designKit';

// Textarea matched to the TextInput gabarit (card surface, ring) — no kit textarea.
const textareaClass = cn(
  'w-full rounded-2xl px-4 py-3 text-[16px] outline-none transition',
  SURFACE.card,
  SURFACE.shadow,
  TEXT.strong,
  'placeholder:text-[#9B98AD] focus:ring-2 focus:ring-[#C9C2F0] dark:focus:ring-[#4A4660]',
);

export function MobileQuickRepliesScreen() {
  const { t } = useTranslation('support');
  const navigate = useNavigate();
  const { currentUser, hasPermission } = useAdminAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const canAccess = hasPermission('canAccessSupportChat');
  const { data: replies, isLoading } = useAdminAllQuickReplies();
  const create = useCreateQuickReply();
  const update = useUpdateQuickReply();
  const del = useDeleteQuickReply();
  const reorder = useReorderQuickReplies();

  const [editing, setEditing] = useState<ChatClientQuickReply | null>(null);
  const [creating, setCreating] = useState(false);

  const move = (index: number, dir: 'up' | 'down') => {
    if (!replies) return;
    const newList = [...replies];
    const swap = dir === 'up' ? index - 1 : index + 1;
    if (swap < 0 || swap >= newList.length) return;
    [newList[index], newList[swap]] = [newList[swap], newList[index]];
    reorder.mutate(newList.map((r) => r.id));
  };

  if (!canAccess) {
    return (
      <div className={cn('flex min-h-[100dvh] flex-col items-center justify-center p-6 text-center', SURFACE.canvas)}>
        <Holder icon={Sparkles} size="lg" />
        <p className={cn('mt-4 text-[14px]', TEXT.muted)}>
          Vous n'avez pas accès au support chat.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <MobileHeader
        title={t('quickReplies.screenTitle')}
        showBack
        onBack={() => navigate('/m/more')}
        rightElement={
          isSuperAdmin ? (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className={cn('flex h-9 w-9 items-center justify-center rounded-full transition active:scale-95', PRIMARY_PILL)}
              aria-label={t('quickReplies.create')}
            >
              <Plus className="h-4 w-4" />
            </button>
          ) : undefined
        }
      />

      <div className="space-y-3 px-4 py-4">
        <div className="rounded-2xl bg-[#EAE7FA] px-3.5 py-3 text-[12px] text-[#5B4CC4] dark:bg-[#272252] dark:text-[#B5AAF0]">
          {t('quickReplies.hint')}
        </div>

        {!isSuperAdmin && (
          <div className="rounded-2xl bg-[#F8EFD8] px-3.5 py-3 text-[12px] text-[#9A6B12] dark:bg-[#372D14] dark:text-[#E7C083]">
            {t('quickReplies.readOnlyHint')}
          </div>
        )}

        {isLoading ? (
          <ScreenLoader />
        ) : (replies ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Holder icon={Sparkles} size="lg" />
            <p className={cn('mt-4 text-[14px] font-medium', TEXT.muted)}>{t('quickReplies.empty')}</p>
            {isSuperAdmin && (
              <p className={cn('mt-1 max-w-xs text-[13px]', TEXT.muted)}>{t('quickReplies.emptyHint')}</p>
            )}
          </div>
        ) : (
          (replies ?? []).map((qr, idx) => (
            <Card key={qr.id} className={cn(!qr.active && 'opacity-60')}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className={cn('text-[14px] font-bold', TEXT.strong)}>{qr.label}</p>
                  {!qr.active && (
                    <StatusPill tone="neutral" label={t('quickReplies.inactive')} className="mt-1" />
                  )}
                </div>
                {isSuperAdmin && (
                  <div className="flex gap-1">
                    <Holder icon={ArrowUp} size="sm" onClick={idx === 0 ? undefined : () => move(idx, 'up')} className={cn('h-7 w-7', idx === 0 && 'pointer-events-none opacity-30')} />
                    <Holder icon={ArrowDown} size="sm" onClick={idx === (replies ?? []).length - 1 ? undefined : () => move(idx, 'down')} className={cn('h-7 w-7', idx === (replies ?? []).length - 1 && 'pointer-events-none opacity-30')} />
                    <Holder
                      icon={qr.active ? EyeOff : Eye}
                      size="sm"
                      onClick={() => update.mutate({ id: qr.id, active: !qr.active })}
                      className="h-7 w-7"
                    />
                    <Holder icon={Edit3} size="sm" onClick={() => setEditing(qr)} className="h-7 w-7" />
                    <Holder
                      icon={Trash2}
                      tone="danger"
                      size="sm"
                      onClick={() => {
                        if (confirm(t('quickReplies.confirmDelete'))) {
                          del.mutate(qr.id);
                        }
                      }}
                      className="h-7 w-7"
                    />
                  </div>
                )}
              </div>
              <p className={cn('whitespace-pre-wrap text-[12px]', TEXT.muted)}>{qr.content}</p>
            </Card>
          ))
        )}
      </div>

      {(creating || editing) && isSuperAdmin && (
        <QuickReplyEditor
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={async (input) => {
            try {
              if (editing) {
                await update.mutateAsync({ id: editing.id, ...input });
                toast.success(t('quickReplies.updated'));
              } else {
                await create.mutateAsync(input);
                toast.success(t('quickReplies.created'));
              }
              setCreating(false);
              setEditing(null);
            } catch (e) {
              toast.error(t('errors.sendFailed'));
              console.error(e);
            }
          }}
        />
      )}
    </div>
  );
}

interface QuickReplyEditorProps {
  initial: ChatClientQuickReply | null;
  onClose: () => void;
  onSubmit: (input: { label: string; content: string; active?: boolean }) => Promise<void> | void;
}
function QuickReplyEditor({ initial, onClose, onSubmit }: QuickReplyEditorProps) {
  const { t } = useTranslation('support');
  const [label, setLabel] = useState(initial?.label ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [active, setActive] = useState(initial?.active ?? true);
  const [saving, setSaving] = useState(false);

  const canSave = label.trim().length > 0 && content.trim().length > 0 && !saving;

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={initial ? t('quickReplies.editTitle') : t('quickReplies.createTitle')}
    >
      <div className="space-y-3">
        <FormField label={t('quickReplies.labelField')} htmlFor="qr-label">
          <TextInput
            id="qr-label"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={40}
            placeholder={t('quickReplies.labelPlaceholder')}
          />
        </FormField>

        <FormField label={t('quickReplies.contentField')} htmlFor="qr-content">
          {/* eslint-disable-next-line no-restricted-syntax */}
          <textarea
            id="qr-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder={t('quickReplies.contentPlaceholder')}
            className={textareaClass}
          />
        </FormField>

        {/* Active toggle */}
        <button
          type="button"
          onClick={() => setActive((a) => !a)}
          className={cn('flex w-full items-center gap-3 rounded-2xl p-3 text-left transition active:scale-[0.99]', SURFACE.canvas)}
        >
          <span
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors',
              active ? 'bg-[#6B5BD2] text-white dark:bg-[#A99BF0] dark:text-[#1B1A24]' : 'bg-black/10 dark:bg-white/10',
            )}
          >
            {active && <Check className="h-4 w-4" />}
          </span>
          <span className={cn('text-[14px] font-medium', TEXT.strong)}>{t('quickReplies.activeLabel')}</span>
        </button>
      </div>

      <div className="mt-5 flex gap-2">
        <SoftPill onClick={onClose} className="flex-1">
          {t('list.cancel')}
        </SoftPill>
        <PrimaryPill
          disabled={!canSave}
          loading={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSubmit({ label, content, active });
            } finally {
              setSaving(false);
            }
          }}
          className="flex-1"
        >
          {t('templates.save')}
        </PrimaryPill>
      </div>
    </BottomSheet>
  );
}
