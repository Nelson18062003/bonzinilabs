import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Trash2,
  Edit3,
  MessageSquareQuote,
  ArrowUp,
  ArrowDown,
  Sparkles,
} from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  useCannedResponses,
  useCreateCannedResponse,
  useUpdateCannedResponse,
  useDeleteCannedResponse,
  useReorderCannedResponses,
} from '@/hooks/useCannedResponses';
import { TEMPLATE_VARIABLES, previewWithExamples } from '@/lib/template-vars';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ChatCannedResponse } from '@/types/chat';
import {
  SURFACE,
  TEXT,
  PRIMARY_PILL,
  Card,
  Holder,
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

export function MobileCannedResponsesScreen() {
  const { t } = useTranslation('support');
  const navigate = useNavigate();
  const { currentUser, hasPermission } = useAdminAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const canAccess = hasPermission('canAccessSupportChat');
  const { data: templates, isLoading } = useCannedResponses();
  const create = useCreateCannedResponse();
  const update = useUpdateCannedResponse();
  const del = useDeleteCannedResponse();
  const reorder = useReorderCannedResponses();

  const [editing, setEditing] = useState<ChatCannedResponse | null>(null);
  const [creating, setCreating] = useState(false);

  const move = (index: number, dir: 'up' | 'down') => {
    if (!templates) return;
    const newList = [...templates];
    const swap = dir === 'up' ? index - 1 : index + 1;
    if (swap < 0 || swap >= newList.length) return;
    [newList[index], newList[swap]] = [newList[swap], newList[index]];
    reorder.mutate(newList.map((t) => t.id));
  };

  if (!canAccess) {
    return (
      <div className={cn('flex min-h-[100dvh] flex-col items-center justify-center p-6 text-center', SURFACE.canvas)}>
        <Holder icon={MessageSquareQuote} size="lg" />
        <p className={cn('mt-4 text-[14px]', TEXT.muted)}>
          Vous n'avez pas accès au support chat.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <MobileHeader
        title={t('templates.screenTitle')}
        showBack
        onBack={() => navigate('/m/more')}
        rightElement={
          isSuperAdmin ? (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className={cn('flex h-9 w-9 items-center justify-center rounded-full transition active:scale-95', PRIMARY_PILL)}
              aria-label={t('templates.create')}
            >
              <Plus className="h-4 w-4" />
            </button>
          ) : undefined
        }
      />

      <div className="space-y-3 px-4 py-4">
        {!isSuperAdmin && (
          <div className="rounded-2xl bg-[#F8EFD8] px-3.5 py-3 text-[12px] text-[#9A6B12] dark:bg-[#372D14] dark:text-[#E7C083]">
            {t('templates.readOnlyHint')}
          </div>
        )}

        {isLoading ? (
          <ScreenLoader />
        ) : (templates ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Holder icon={MessageSquareQuote} size="lg" />
            <p className={cn('mt-4 text-[14px] font-medium', TEXT.muted)}>{t('templates.empty')}</p>
            {isSuperAdmin && (
              <p className={cn('mt-1 max-w-xs text-[13px]', TEXT.muted)}>{t('templates.emptyHint')}</p>
            )}
          </div>
        ) : (
          (templates ?? []).map((tpl, idx) => (
            <Card key={tpl.id}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className={cn('text-[14px] font-bold', TEXT.strong)}>{tpl.label}</p>
                {isSuperAdmin && (
                  <div className="flex gap-1">
                    <Holder icon={ArrowUp} size="sm" onClick={idx === 0 ? undefined : () => move(idx, 'up')} className={cn('h-7 w-7', idx === 0 && 'pointer-events-none opacity-30')} />
                    <Holder icon={ArrowDown} size="sm" onClick={idx === (templates ?? []).length - 1 ? undefined : () => move(idx, 'down')} className={cn('h-7 w-7', idx === (templates ?? []).length - 1 && 'pointer-events-none opacity-30')} />
                    <Holder icon={Edit3} size="sm" onClick={() => setEditing(tpl)} className="h-7 w-7" />
                    <Holder
                      icon={Trash2}
                      tone="danger"
                      size="sm"
                      onClick={() => {
                        if (confirm(t('templates.confirmDelete'))) {
                          del.mutate(tpl.id);
                        }
                      }}
                      className="h-7 w-7"
                    />
                  </div>
                )}
              </div>
              <p className={cn('whitespace-pre-wrap text-[12px]', TEXT.muted)}>{tpl.content}</p>
              {/\{\{[a-z_]+\}\}/i.test(tpl.content) && (
                <p className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-[#9A6B12] dark:text-[#E7C083]">
                  <Sparkles className="h-2.5 w-2.5" />
                  {t('templates.varsInside')}
                </p>
              )}
            </Card>
          ))
        )}
      </div>

      {(creating || editing) && isSuperAdmin && (
        <TemplateEditor
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={async (input) => {
            try {
              if (editing) {
                await update.mutateAsync({ id: editing.id, ...input });
                toast.success(t('templates.updated'));
              } else {
                await create.mutateAsync(input);
                toast.success(t('templates.created'));
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

interface TemplateEditorProps {
  initial: ChatCannedResponse | null;
  onClose: () => void;
  onSubmit: (input: { label: string; content: string }) => Promise<void> | void;
}
function TemplateEditor({ initial, onClose, onSubmit }: TemplateEditorProps) {
  const { t } = useTranslation('support');
  const [label, setLabel] = useState(initial?.label ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [saving, setSaving] = useState(false);

  const canSave = label.trim().length > 0 && content.trim().length > 0 && !saving;
  const preview = previewWithExamples(content);

  const insertVar = (key: string) => {
    setContent((c) => c + `{{${key}}}`);
  };

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={initial ? t('templates.editTitle') : t('templates.createTitle')}
    >
      <div className="space-y-3">
        <FormField label={t('templates.labelField')} htmlFor="tpl-label">
          <TextInput
            id="tpl-label"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={60}
            placeholder={t('templates.labelPlaceholder')}
          />
        </FormField>

        <FormField label={t('templates.contentField')} htmlFor="tpl-content">
          {/* eslint-disable-next-line no-restricted-syntax */}
          <textarea
            id="tpl-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={2000}
            rows={5}
            placeholder={t('templates.contentPlaceholder')}
            className={textareaClass}
          />
        </FormField>

        <div>
          <p className={cn('mb-1.5 flex items-center gap-1 text-[11px] font-medium', TEXT.muted)}>
            <Sparkles className="h-3 w-3 text-[#9A6B12] dark:text-[#E7C083]" />
            {t('templates.varsAvailable')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE_VARIABLES.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => insertVar(v.key)}
                className="rounded-full bg-[#F8EFD8] px-2.5 py-1 font-mono text-[10px] font-semibold text-[#9A6B12] transition active:scale-95 dark:bg-[#372D14] dark:text-[#E7C083]"
                title={v.label}
              >
                {`{{${v.key}}}`}
              </button>
            ))}
          </div>
        </div>

        {content && (
          <div className="rounded-2xl bg-[#EAE7FA] p-3 dark:bg-[#272252]">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#5B4CC4] dark:text-[#B5AAF0]">
              {t('templates.preview')}
            </p>
            <p className={cn('whitespace-pre-wrap text-[12px]', TEXT.strong)}>{preview}</p>
          </div>
        )}
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
              await onSubmit({ label, content });
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
