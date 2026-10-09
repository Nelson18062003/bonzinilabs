// ============================================================
// Mes équipes › « Confier à… » — un prospect passe à un autre commercial
// actif (prospect_reassign, canManageSales). Employé sur la page d'un
// commercial et sur l'écran « À vérifier » : une fiche d'un commercial
// archivé ne s'attribue pas, on la confie d'abord (07/10, relecture).
// ============================================================
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useReassignProspect, useSalesOverview, type Prospect } from '@/hooks/useSales';
import { BTN_PRIMARY, BTN_SOFT, Modal } from './TeamBits';

export function ReassignProspectDialog({
  prospect,
  month,
  onClose,
}: {
  prospect: Pick<Prospect, 'id' | 'first_name' | 'source_id'>;
  month: string;
  onClose: () => void;
}) {
  const overview = useSalesOverview(month);
  const reassign = useReassignProspect();
  const others = (overview.data ?? []).filter((c) => c.source.id !== prospect.source_id && c.source.is_active);
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <Modal
      title={`Confier ${prospect.first_name} à un autre commercial`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_SOFT}>
            Annuler
          </button>
          <button type="button" disabled={!picked || reassign.isPending} onClick={() => picked && reassign.mutate({ id: prospect.id, sourceId: picked }, { onSuccess: onClose })} className={BTN_PRIMARY}>
            {reassign.isPending ? '…' : 'Confier'}
          </button>
        </>
      }
    >
      {overview.isLoading ? (
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
      ) : others.length === 0 ? (
        <p className="text-[13.5px] text-muted-foreground">Aucun autre commercial actif.</p>
      ) : (
        <div className="space-y-1.5">
          {others.map((c) => (
            <button
              key={c.source.id}
              type="button"
              onClick={() => setPicked(c.source.id)}
              className={cn('flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left ring-1', picked === c.source.id ? 'ring-2 ring-primary' : 'ring-black/10 hover:bg-accent dark:ring-white/15')}
            >
              <span className="text-[14px] font-semibold">{c.staff?.name || c.source.label}</span>
              <span className="text-[12.5px] text-muted-foreground">{c.metrics.prospects_open} prospects en cours</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
