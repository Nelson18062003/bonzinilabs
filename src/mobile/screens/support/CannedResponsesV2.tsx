/**
 * Réponses types — refonte v2 (maquettes 10/60 et 10/61). La liste rangée à
 * la main (poignée : monter, descendre, modifier, supprimer) et « + » ;
 * l'éditeur plein écran : libellé, texte, variables, aperçu, corbeille.
 * Écriture réservée au super admin, comme avant (le serveur refuse aussi
 * reorder_canned_responses aux autres). Mêmes hooks : useCannedResponses.
 */
import { useState } from 'react';
import { ArrowDown, ArrowUp, Menu, PenLine, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  useCannedResponses, useCreateCannedResponse, useDeleteCannedResponse, useReorderCannedResponses, useUpdateCannedResponse,
} from '@/hooks/useCannedResponses';
import { TEMPLATE_VARIABLES, previewWithExamples } from '@/lib/template-vars';
import { cn } from '@/lib/utils';
import type { ChatCannedResponse } from '@/types/chat';
import {
  ActionSheet, BigButton, ConfirmSheet, Dock, EmptyLine, FOCUS_RING, ScreenLoader, ScreenTop, SURFACE, TEXT, TextArea, TextInput, useSheet,
} from '@/mobile/designKit';
import { BIG_FIELD, CapsLabel, FieldBlock } from '@/mobile/screens/more/parts';

/** Les variables, dites comme on les lit : {{client_first_name}} → {prénom}. */
export const VAR_WORD: Record<string, string> = {
  client_first_name: 'prénom', client_last_name: 'nom', client_full_name: 'nom complet', client_phone: 'téléphone',
  conversation_subject: 'sujet', today: 'date', admin_first_name: 'mon prénom',
};
export const readable = (s: string) => s.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, k: string) => (VAR_WORD[k.toLowerCase()] ? `{${VAR_WORD[k.toLowerCase()]}}` : m));

/** Un bouton rond de 44 dans l'en-tête (« + », corbeille). */
export function HeaderIcon({ icon: Icon, label, onClick, danger }: { icon: React.ElementType; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={cn('-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-[#F5F5F5] dark:active:bg-[#383838]', FOCUS_RING, danger ? 'text-[#EC221F]' : TEXT.strong)}>
      <Icon className="h-7 w-7" strokeWidth={2} />
    </button>
  );
}

export function CannedResponsesV2() {
  const { currentUser, hasPermission } = useAdminAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const { data: list, isLoading } = useCannedResponses();
  const reorder = useReorderCannedResponses();
  const [editing, setEditing] = useState<ChatCannedResponse | 'new' | null>(null);
  const [handle, setHandle] = useState<ChatCannedResponse | null>(null);
  const [deleting, setDeleting] = useState<ChatCannedResponse | null>(null);
  const del = useDeleteCannedResponse();

  if (!hasPermission('canAccessSupportChat')) {
    return (
      <div className="flex min-h-full flex-col">
        <ScreenTop title="Réponses types" />
        <EmptyLine>Réservé à l'équipe des messages.</EmptyLine>
      </div>
    );
  }
  if (editing) return <CannedEditor initial={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />;

  const items = list ?? [];
  const move = (tpl: ChatCannedResponse, dir: -1 | 1) => {
    const i = items.findIndex((x) => x.id === tpl.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    reorder.mutate(next.map((x) => x.id), { onError: () => toast.error("L'ordre n'a pas pu être enregistré.") });
  };
  const idx = handle ? items.findIndex((x) => x.id === handle.id) : -1;

  return (
    <div className="flex min-h-full flex-col pb-8">
      <ScreenTop title="Réponses types" right={isSuperAdmin ? <HeaderIcon icon={Plus} label="Nouvelle réponse type" onClick={() => setEditing('new')} /> : undefined} />
      {isLoading ? (
        <ScreenLoader />
      ) : items.length === 0 ? (
        <EmptyLine action={isSuperAdmin ? { label: 'Créer une réponse', onClick: () => setEditing('new') } : undefined}>Aucune réponse type.</EmptyLine>
      ) : (
        <div className="px-5 pt-2">
          {items.map((tpl) => (
            <div key={tpl.id} className={cn('flex items-center gap-3 border-b last:border-b-0', SURFACE.divider)}>
              <button type="button" disabled={!isSuperAdmin} onClick={() => setEditing(tpl)} className={cn('min-w-0 flex-1 py-4 text-left', isSuperAdmin && 'active:bg-[#F5F5F5] dark:active:bg-[#383838]', FOCUS_RING)}>
                <span className={cn('block truncate text-[18px] font-semibold', TEXT.strong)}>{tpl.label}</span>
                <span className={cn('mt-1 block truncate text-[16px]', TEXT.muted)}>{readable(tpl.content)}</span>
              </button>
              {isSuperAdmin && (
                <button type="button" onClick={() => setHandle(tpl)} aria-label={`Ranger « ${tpl.label} »`} className={cn('flex h-12 w-11 shrink-0 items-center justify-center rounded-lg', FOCUS_RING, TEXT.muted)}>
                  <Menu className="h-7 w-7" strokeWidth={1.75} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <ActionSheet
        open={handle != null}
        onClose={() => setHandle(null)}
        title={handle?.label}
        actions={handle ? [
          { label: 'Monter', icon: ArrowUp, disabled: idx <= 0, onClick: () => move(handle, -1) },
          { label: 'Descendre', icon: ArrowDown, disabled: idx >= items.length - 1, onClick: () => move(handle, 1) },
          { label: 'Modifier', icon: PenLine, onClick: () => setEditing(handle) },
          { label: 'Supprimer', icon: Trash2, danger: true, onClick: () => setDeleting(handle) },
        ] : []}
      />
      <ConfirmSheet
        open={deleting != null}
        onClose={() => setDeleting(null)}
        title="Supprimer cette réponse ?"
        subtitle={deleting?.label}
        confirmLabel="Supprimer"
        cancelLabel="Garder"
        danger
        loading={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id, {
          onSuccess: () => { setDeleting(null); toast.success('Réponse supprimée'); },
          onError: () => toast.error("La suppression a échoué."),
        })}
      />
    </div>
  );
}

function CannedEditor({ initial, onDone }: { initial: ChatCannedResponse | null; onDone: () => void }) {
  const create = useCreateCannedResponse();
  const update = useUpdateCannedResponse();
  const del = useDeleteCannedResponse();
  const confirmDelete = useSheet();
  const [label, setLabel] = useState(initial?.label ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const saving = create.isPending || update.isPending;
  const canSave = label.trim().length > 0 && content.trim().length > 0 && !saving;

  const save = async () => {
    if (!canSave) return;
    try {
      if (initial) await update.mutateAsync({ id: initial.id, label, content });
      else await create.mutateAsync({ label, content });
      toast.success(initial ? 'Réponse modifiée' : 'Réponse créée');
      onDone();
    } catch {
      toast.error("L'enregistrement a échoué.");
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop
        title="Réponse type"
        onBack={onDone}
        right={initial ? <HeaderIcon icon={Trash2} label="Supprimer" danger onClick={confirmDelete.show} /> : undefined}
      />
      <div className="space-y-6 px-5 pt-6">
        <FieldBlock label="Libellé" htmlFor="cr-label">
          <TextInput id="cr-label" value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} className={BIG_FIELD} />
        </FieldBlock>
        <FieldBlock label="Texte" htmlFor="cr-content">
          <TextArea id="cr-content" value={content} rows={4} maxLength={2000} onChange={(e) => setContent(e.target.value)} className="px-4 py-3.5 !text-[17px] leading-relaxed" />
        </FieldBlock>
        <div className="flex flex-wrap gap-2.5">
          {TEMPLATE_VARIABLES.map((v) => (
            <button key={v.key} type="button" onClick={() => setContent((c) => `${c}{{${v.key}}}`)} className={cn('h-12 rounded-lg bg-[#F5F5F5] px-4 text-[17px] font-semibold active:bg-[#E6E6E6] dark:bg-[#383838]', FOCUS_RING, TEXT.strong)}>
              {`{${VAR_WORD[v.key] ?? v.key}}`}
            </button>
          ))}
        </div>
        {content.trim() && (
          <div>
            <CapsLabel>Aperçu</CapsLabel>
            <div className="mt-2 whitespace-pre-wrap rounded-2xl bg-[#2C2C2C] px-4 py-3 text-[17px] leading-relaxed text-[#F5F5F5] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]">
              {previewWithExamples(content)}
            </div>
          </div>
        )}
      </div>
      <Dock>
        <BigButton onClick={() => void save()} disabled={!canSave} loading={saving}>Enregistrer</BigButton>
      </Dock>
      {initial && (
        <ConfirmSheet
          open={confirmDelete.open}
          onClose={confirmDelete.hide}
          title="Supprimer cette réponse ?"
          subtitle={initial.label}
          confirmLabel="Supprimer"
          cancelLabel="Garder"
          danger
          loading={del.isPending}
          onConfirm={() => del.mutate(initial.id, {
            onSuccess: () => { toast.success('Réponse supprimée'); onDone(); },
            onError: () => toast.error('La suppression a échoué.'),
          })}
        />
      )}
    </div>
  );
}
