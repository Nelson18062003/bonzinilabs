import { useRef, type ChangeEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Paperclip, FileText, Plus, Loader2 } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useDocuments, useUploadProof } from '@/hooks/useProcurement';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { signStored } from '@/lib/signedUrls';
import type { ProcDocumentEntity } from '@/integrations/supabase/procurement';
import { SectionTitle } from '@/components/treasury/ui';
import { cn } from '@/lib/utils';

/** Pièces jointes (preuves) d'une entité procurement : upload + miniatures signées. */
export function ProcProofs({ entityType, entityId }: { entityType: ProcDocumentEntity; entityId: string }) {
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission('canManageProcurement');
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadProof();
  const { data } = useDocuments(entityType, entityId);
  const documents = data?.documents ?? [];

  // URLs signées (bucket privé) — via la session admin. Re-signées < 1h.
  const { data: signed } = useQuery({
    queryKey: ['procurement', 'signed', entityType, entityId, documents.map((d) => d.id).join(',')],
    enabled: documents.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const map: Record<string, string | null> = {};
      await Promise.all(documents.map(async (d) => {
        map[d.id] = await signStored(supabaseAdmin.storage, d.file_url);
      }));
      return map;
    },
  });

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) upload.mutate({ entityType, entityId, file: f });
    e.target.value = '';
  };

  return (
    <section className="space-y-3">
      <SectionTitle
        action={canManage ? { label: upload.isPending ? '…' : '+ Preuve', onClick: () => inputRef.current?.click() } : undefined}
      >
        Preuves ({documents.length})
      </SectionTitle>
      <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onPick} />

      {documents.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-muted/50 py-5 text-[12px] text-muted-foreground">
          <Paperclip className="h-4 w-4" /> Aucune preuve jointe
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {documents.map((d) => {
            const url = signed?.[d.id] ?? null;
            const isImage = (d.file_type ?? '').startsWith('image/');
            return (
              <a
                key={d.id}
                href={url ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-muted/60"
              >
                {isImage && url ? (
                  <img src={url} alt={d.file_name ?? 'preuve'} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 p-2 text-center text-muted-foreground">
                    <FileText className="h-6 w-6" />
                    <span className="line-clamp-2 text-[9px]">{d.file_name ?? 'Fichier'}</span>
                  </div>
                )}
              </a>
            );
          })}
        </div>
      )}

      {upload.isPending && (
        <div className="flex items-center justify-center gap-2 text-[12px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Envoi en cours…
        </div>
      )}
      {canManage && documents.length === 0 && (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-muted/60 py-2.5 text-[12px] font-semibold text-foreground active:scale-95 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Joindre une preuve
        </button>
      )}
    </section>
  );
}
