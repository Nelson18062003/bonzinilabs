/**
 * Suggestions aux nouveaux clients — refonte v2 (maquette 10/62). Une ligne
 * par suggestion avec son interrupteur, puis « Ce que voit le client » (les
 * puces actives, dans l'ordre). Toucher une ligne : l'éditeur (libellé,
 * texte, monter, descendre, supprimer). Écriture : super admin, comme avant.
 * Mêmes hooks : useAdminQuickReplies.
 */
import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  useAdminAllQuickReplies, useCreateQuickReply, useDeleteQuickReply, useReorderQuickReplies, useUpdateQuickReply,
} from '@/hooks/useAdminQuickReplies';
import { cn } from '@/lib/utils';
import type { ChatClientQuickReply } from '@/types/chat';
import {
  ActionSheet, BigButton, ConfirmSheet, Dock, EmptyLine, FOCUS_RING, MoreButton, ScreenLoader, ScreenTop, SURFACE, TEXT, TextArea, TextInput, useSheet,
} from '@/mobile/designKit';
import { BIG_FIELD, CapsLabel, FieldBlock, Switch } from '@/mobile/screens/more/parts';
import { HeaderIcon } from './CannedResponsesV2';

export function QuickRepliesV2() {
  const { currentUser, hasPermission } = useAdminAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const { data, isLoading } = useAdminAllQuickReplies();
  const update = useUpdateQuickReply();
  const [editing, setEditing] = useState<ChatClientQuickReply | 'new' | null>(null);

  if (!hasPermission('canAccessSupportChat')) {
    return (
      <div className="flex min-h-full flex-col">
        <ScreenTop title="Suggestions" />
        <EmptyLine>Réservé à l'équipe des messages.</EmptyLine>
      </div>
    );
  }
  const items = data ?? [];
  if (editing) return <QuickReplyEditor initial={editing === 'new' ? null : editing} all={items} onDone={() => setEditing(null)} />;
  const visible = items.filter((r) => r.active);

  return (
    <div className="flex min-h-full flex-col pb-8">
      <ScreenTop title="Suggestions" right={isSuperAdmin ? <HeaderIcon icon={Plus} label="Nouvelle suggestion" onClick={() => setEditing('new')} /> : undefined} />
      {isLoading ? (
        <ScreenLoader />
      ) : items.length === 0 ? (
        <EmptyLine action={isSuperAdmin ? { label: 'Créer une suggestion', onClick: () => setEditing('new') } : undefined}>Aucune suggestion.</EmptyLine>
      ) : (
        <>
          <div className="px-5 pt-2">
            {items.map((r) => (
              <div key={r.id} className={cn('flex items-center gap-4 border-b last:border-b-0', SURFACE.divider)}>
                <button type="button" disabled={!isSuperAdmin} onClick={() => setEditing(r)} className={cn('min-w-0 flex-1 py-4 text-left', FOCUS_RING)}>
                  <span className={cn('block truncate text-[18px] font-semibold', r.active ? TEXT.strong : TEXT.muted)}>{r.label}</span>
                  <span className={cn('mt-1 block truncate text-[16px]', TEXT.muted)}>{r.content}</span>
                </button>
                <Switch
                  label={r.active ? `Masquer « ${r.label} »` : `Montrer « ${r.label} »`}
                  checked={r.active}
                  disabled={!isSuperAdmin || update.isPending}
                  onChange={(v) => update.mutate({ id: r.id, active: v }, { onError: () => toast.error("Le changement n'a pas pu être enregistré.") })}
                />
              </div>
            ))}
          </div>
          <div className="px-5 pt-8">
            <CapsLabel>Ce que voit le client</CapsLabel>
            {visible.length === 0 ? (
              <p className={cn('mt-3 text-[16px]', TEXT.muted)}>Aucune suggestion affichée.</p>
            ) : (
              <div className="mt-3 flex flex-col items-start gap-2.5">
                {visible.map((r) => (
                  <span key={r.id} className={cn('rounded-lg border px-4 py-2.5 text-[17px] font-semibold', SURFACE.divider, TEXT.strong)}>{r.label}</span>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function QuickReplyEditor({ initial, all, onDone }: { initial: ChatClientQuickReply | null; all: ChatClientQuickReply[]; onDone: () => void }) {
  const create = useCreateQuickReply();
  const update = useUpdateQuickReply();
  const del = useDeleteQuickReply();
  const reorder = useReorderQuickReplies();
  const more = useSheet();
  const confirmDelete = useSheet();
  const [label, setLabel] = useState(initial?.label ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [active, setActive] = useState(initial?.active ?? true);
  const saving = create.isPending || update.isPending;
  const canSave = label.trim().length > 0 && content.trim().length > 0 && !saving;
  const idx = initial ? all.findIndex((r) => r.id === initial.id) : -1;

  const move = (dir: -1 | 1) => {
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= all.length) return;
    const next = [...all];
    [next[idx], next[j]] = [next[j], next[idx]];
    reorder.mutate(next.map((r) => r.id), {
      onSuccess: () => toast.success(dir < 0 ? 'Montée d’un cran' : 'Descendue d’un cran'),
      onError: () => toast.error("L'ordre n'a pas pu être enregistré."),
    });
  };

  const save = async () => {
    if (!canSave) return;
    try {
      if (initial) await update.mutateAsync({ id: initial.id, label, content, active });
      else await create.mutateAsync({ label, content, active });
      toast.success(initial ? 'Suggestion modifiée' : 'Suggestion créée');
      onDone();
    } catch {
      toast.error("L'enregistrement a échoué.");
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop title={initial ? 'Suggestion' : 'Nouvelle suggestion'} onBack={onDone} right={initial ? <MoreButton onClick={more.show} /> : undefined} />
      <div className="space-y-6 px-5 pt-6">
        <FieldBlock label="Libellé" htmlFor="qr-label">
          <TextInput id="qr-label" value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} className={BIG_FIELD} />
        </FieldBlock>
        <FieldBlock label="Texte envoyé" htmlFor="qr-content">
          <TextArea id="qr-content" value={content} rows={3} maxLength={500} onChange={(e) => setContent(e.target.value)} className="px-4 py-3.5 !text-[17px] leading-relaxed" />
        </FieldBlock>
        <div className={cn('flex items-center justify-between gap-4 border-y py-2', SURFACE.divider)}>
          <span className={cn('text-[17px] font-semibold', TEXT.strong)}>Montrée aux clients</span>
          <Switch label="Montrée aux clients" checked={active} onChange={setActive} />
        </div>
      </div>
      <Dock>
        <BigButton onClick={() => void save()} disabled={!canSave} loading={saving}>Enregistrer</BigButton>
      </Dock>
      {initial && (
        <>
          <ActionSheet
            open={more.open}
            onClose={more.hide}
            actions={[
              { label: 'Monter', icon: ArrowUp, disabled: idx <= 0, onClick: () => move(-1) },
              { label: 'Descendre', icon: ArrowDown, disabled: idx >= all.length - 1, onClick: () => move(1) },
              { label: 'Supprimer', icon: Trash2, danger: true, onClick: confirmDelete.show },
            ]}
          />
          <ConfirmSheet
            open={confirmDelete.open}
            onClose={confirmDelete.hide}
            title="Supprimer cette suggestion ?"
            subtitle={initial.label}
            confirmLabel="Supprimer"
            cancelLabel="Garder"
            danger
            loading={del.isPending}
            onConfirm={() => del.mutate(initial.id, {
              onSuccess: () => { toast.success('Suggestion supprimée'); onDone(); },
              onError: () => toast.error('La suppression a échoué.'),
            })}
          />
        </>
      )}
    </div>
  );
}
