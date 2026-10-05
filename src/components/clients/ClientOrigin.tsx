// ============================================================
// L'origine d'un client sur sa fiche (desktop et mobile) : qui l'a apporté,
// et — selon les droits — le moyen de la renseigner ou de la corriger.
//
//   · canEditClients : peut changer l'origine (c'est elle qui décide à quel
//     commercial revient le client) ;
//   · canRegisterClients seul : peut la renseigner si elle est vide ;
//   · sinon : lecture seule.
// Le serveur (`set_client_source`) applique la même règle.
// ============================================================
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useClientOrigin, useSetClientSource } from '@/hooks/useClientSources';
import { ClientSourcePicker } from '@/components/clients/ClientSourcePicker';

export function ClientOrigin({ userId, utmSource, className }: { userId: string; utmSource?: string | null; className?: string }) {
  const { t } = useTranslation('common');
  const { hasPermission } = useAdminAuth();
  const origin = useClientOrigin(userId);
  const setSource = useSetClientSource();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);

  const src = origin.data?.source ?? null;
  const canChange = hasPermission('canEditClients') || (hasPermission('canRegisterClients') && !src);
  const label = !src ? null : src.kind === 'unknown' ? t('clientForm.sourceUnknown') : `${t(`clientForm.sourceKinds.${src.kind}`, { defaultValue: src.kind })} · ${src.label}`;

  if (editing) {
    return (
      <div className={cn('space-y-2', className)}>
        <ClientSourcePicker value={draft ?? src?.id ?? null} onChange={setDraft} />
        <div className="flex gap-2">
          <button type="button" onClick={() => setEditing(false)} className="h-10 flex-1 rounded-xl bg-muted text-[14px] font-semibold hover:bg-accent">
            {t('clientForm.sourceCancel')}
          </button>
          <button
            type="button"
            disabled={!draft || draft === src?.id || setSource.isPending}
            onClick={() => draft && setSource.mutate({ userId, sourceId: draft }, { onSuccess: () => setEditing(false) })}
            className="h-10 flex-[1.4] rounded-xl bg-primary text-[14px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {setSource.isPending ? '…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-2 gap-y-0.5', className)}>
      {origin.isLoading ? (
        <span className="text-muted-foreground">…</span>
      ) : label ? (
        <span className="font-medium">{label}</span>
      ) : (
        <span className="text-amber-700 dark:text-amber-400">Non renseignée</span>
      )}
      {utmSource && (
        <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
          <Link2 className="h-3 w-3" /> lien suivi : {utmSource}
        </span>
      )}
      {canChange && (
        <button
          type="button"
          onClick={() => {
            setDraft(src?.id ?? null);
            setEditing(true);
          }}
          className="text-[13px] font-semibold text-primary hover:underline"
        >
          {src ? 'Modifier' : 'Renseigner'}
        </button>
      )}
    </span>
  );
}
