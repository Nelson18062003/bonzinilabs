import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Loader2,
  Trash2,
  Edit3,
  MessageSquareQuote,
  ArrowUp,
  ArrowDown,
  Sparkles,
} from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { MobileEmptyState } from '@/mobile/components/ui/MobileEmptyState';
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
      <div className="p-6 text-center text-sm text-muted-foreground">
        Vous n'avez pas accès au support chat.
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      <MobileHeader
        title={t('templates.screenTitle')}
        showBack
        onBack={() => navigate('/m/more')}
        rightElement={
          isSuperAdmin ? (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-bonzini-violet text-white hover:bg-bonzini-violet/90"
              aria-label={t('templates.create')}
            >
              <Plus className="h-4 w-4" />
            </button>
          ) : undefined
        }
      />

      {!isSuperAdmin && (
        <div className="border-b border-border bg-bonzini-amber/10 p-3 text-xs text-bonzini-amber">
          {t('templates.readOnlyHint')}
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (templates ?? []).length === 0 ? (
        <MobileEmptyState
          icon={MessageSquareQuote}
          title={t('templates.empty')}
          description={isSuperAdmin ? t('templates.emptyHint') : undefined}
        />
      ) : (
        <ul className="divide-y divide-border">
          {(templates ?? []).map((tpl, idx) => (
            <li key={tpl.id} className="p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{tpl.label}</p>
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
                      disabled={idx === (templates ?? []).length - 1}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-30"
                      aria-label="Down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(tpl)}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                      aria-label="Edit"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(t('templates.confirmDelete'))) {
                          del.mutate(tpl.id);
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
              <p className="whitespace-pre-wrap text-xs text-muted-foreground">{tpl.content}</p>
              {/\{\{[a-z_]+\}\}/i.test(tpl.content) && (
                <p className="mt-2 flex items-center gap-1 text-[10px] text-bonzini-amber">
                  <Sparkles className="h-2.5 w-2.5" />
                  {t('templates.varsInside')}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

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
    <div
      className="fixed inset-0 z-40 flex items-end bg-black/40 sm:items-center sm:justify-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-background p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-base font-semibold">
          {initial ? t('templates.editTitle') : t('templates.createTitle')}
        </h3>

        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {t('templates.labelField')}
        </label>
        {/* eslint-disable-next-line no-restricted-syntax */}
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={60}
          placeholder={t('templates.labelPlaceholder')}
          className="mb-3 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-bonzini-violet/40"
        />

        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {t('templates.contentField')}
        </label>
        {/* eslint-disable-next-line no-restricted-syntax */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={2000}
          rows={5}
          placeholder={t('templates.contentPlaceholder')}
          className="mb-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-bonzini-violet/40"
        />

        <div className="mb-3">
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
            <Sparkles className="mr-1 inline h-3 w-3 text-bonzini-amber" />
            {t('templates.varsAvailable')}
          </p>
          <div className="flex flex-wrap gap-1">
            {TEMPLATE_VARIABLES.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => insertVar(v.key)}
                className="rounded-full bg-bonzini-amber/15 px-2 py-1 text-[10px] font-mono text-bonzini-amber hover:bg-bonzini-amber/25"
                title={v.label}
              >
                {`{{${v.key}}}`}
              </button>
            ))}
          </div>
        </div>

        {content && (
          <div className="mb-3 rounded-xl border border-bonzini-violet/20 bg-bonzini-violet/5 p-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-bonzini-violet">
              {t('templates.preview')}
            </p>
            <p className="whitespace-pre-wrap text-xs text-foreground">{preview}</p>
          </div>
        )}

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
                await onSubmit({ label, content });
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
