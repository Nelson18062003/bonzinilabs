import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Loader2,
  Trash2,
  Edit3,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { MobileEmptyState } from '@/mobile/components/ui/MobileEmptyState';
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
      <div className="p-6 text-center text-sm text-muted-foreground">
        Vous n'avez pas accès au support chat.
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      <MobileHeader
        title={t('quickReplies.screenTitle')}
        showBack
        onBack={() => navigate('/m/more')}
        rightElement={
          isSuperAdmin ? (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-bonzini-violet text-white hover:bg-bonzini-violet/90"
              aria-label={t('quickReplies.create')}
            >
              <Plus className="h-4 w-4" />
            </button>
          ) : undefined
        }
      />

      <div className="border-b border-border bg-bonzini-violet/5 p-3 text-xs text-muted-foreground">
        {t('quickReplies.hint')}
      </div>

      {!isSuperAdmin && (
        <div className="border-b border-border bg-bonzini-amber/10 p-3 text-xs text-bonzini-amber">
          {t('quickReplies.readOnlyHint')}
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (replies ?? []).length === 0 ? (
        <MobileEmptyState
          icon={Sparkles}
          title={t('quickReplies.empty')}
          description={isSuperAdmin ? t('quickReplies.emptyHint') : undefined}
        />
      ) : (
        <ul className="divide-y divide-border">
          {(replies ?? []).map((qr, idx) => (
            <li key={qr.id} className={cn('p-4', !qr.active && 'opacity-60')}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{qr.label}</p>
                  {!qr.active && (
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t('quickReplies.inactive')}
                    </span>
                  )}
                </div>
                {isSuperAdmin && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => move(idx, 'up')}
                      disabled={idx === 0}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-30"
                      aria-label="Up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(idx, 'down')}
                      disabled={idx === (replies ?? []).length - 1}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-30"
                      aria-label="Down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => update.mutate({ id: qr.id, active: !qr.active })}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                      aria-label={qr.active ? 'Hide' : 'Show'}
                    >
                      {qr.active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(qr)}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                      aria-label="Edit"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(t('quickReplies.confirmDelete'))) {
                          del.mutate(qr.id);
                        }
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <p className="whitespace-pre-wrap text-xs text-muted-foreground">{qr.content}</p>
            </li>
          ))}
        </ul>
      )}

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
    <div
      className="fixed inset-0 z-40 flex items-end bg-black/40 sm:items-center sm:justify-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-background p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-base font-semibold">
          {initial ? t('quickReplies.editTitle') : t('quickReplies.createTitle')}
        </h3>

        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {t('quickReplies.labelField')}
        </label>
        {/* eslint-disable-next-line no-restricted-syntax */}
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={40}
          placeholder={t('quickReplies.labelPlaceholder')}
          className="mb-3 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-bonzini-violet/40"
        />

        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {t('quickReplies.contentField')}
        </label>
        {/* eslint-disable-next-line no-restricted-syntax */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder={t('quickReplies.contentPlaceholder')}
          className="mb-3 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-bonzini-violet/40"
        />

        <label className="mb-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-bonzini-violet"
          />
          {t('quickReplies.activeLabel')}
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-border px-3 py-2.5 text-sm"
          >
            {t('list.cancel')}
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={async () => {
              setSaving(true);
              try {
                await onSubmit({ label, content, active });
              } finally {
                setSaving(false);
              }
            }}
            className={cn(
              'flex-1 rounded-xl bg-bonzini-violet px-3 py-2.5 text-sm font-medium text-white',
              !canSave && 'opacity-50'
            )}
          >
            {saving ? '…' : t('templates.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
