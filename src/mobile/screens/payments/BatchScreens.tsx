/**
 * Les lots de paiements, v2 (maquettes 02-operations/15 et 16).
 *   · BatchListScreen — nouvelle liste (elle n'existait nulle part) : le
 *     client, le nombre de fournisseurs, la date, le total ¥ et « 3/6 payés »
 *     ou « Payé ». « + » ouvre un nouveau paiement groupé.
 *   · BatchDetailScreen — le total, le client et le XAF débité, l'avancement
 *     (barre 3 sur 6), les lignes (un appui ouvre la fiche paiement) et UN
 *     bouton noir « Payer le suivant · ¥ 18 200 ».
 * Lecture seule : usePaymentBatches / usePaymentBatch, plus l'avancement
 * (useBatchProgress). L'ordinateur garde BulkPaymentDetail (prop desktop).
 */
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { Plus, StickyNote, UserRound } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { usePaymentBatch, usePaymentBatches } from '@/hooks/usePaymentBatches';
import { useAllClients } from '@/hooks/useAdminDeposits';
import { cn } from '@/lib/utils';
import {
  BigButton, BigFigure, Chip, Dock, EmptyLine, Initials, ItemList, ItemRow, MethodCircle, MoreButton, RoundButton, ScreenTop, TEXT,
  toMethodKey, useSheet, PAYMENT_METHOD,
} from '@/mobile/designKit';
import { SkeletonListScreen } from '@/mobile/components/ui/SkeletonCard';
import { MenuSheet } from '@/mobile/screens/operations/parts';
import { n0, paymentTag, shortWhen, yuan } from '@/mobile/screens/operations/opsLabels';
import { useBatchProgress } from '@/mobile/screens/operations/opsQueries';

type Filter = 'open' | 'paid' | 'all';

function useClientNames() {
  const { data } = useAllClients();
  return useMemo(() => new Map((data ?? []).map((c) => [c.user_id, `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Client'])), [data]);
}

export function BatchListScreen() {
  const navigate = useNavigate();
  const canPay = useAdminAuth().hasPermission('canProcessPayments');
  const { data: batches, isLoading, isError, refetch } = usePaymentBatches();
  const ids = useMemo(() => (batches ?? []).map((b) => b.id), [batches]);
  const { data: progress } = useBatchProgress(ids);
  const names = useClientNames();
  const [filter, setFilter] = useState<Filter>('all');

  const isOpen = (id: string) => { const p = progress?.get(id); return !!p && p.closed < p.total; };
  const openCount = ids.filter(isOpen).length;
  const rows = (batches ?? []).filter((b) => filter === 'all' || (filter === 'open' ? isOpen(b.id) : !isOpen(b.id)));

  return (
    <div className="flex min-h-full flex-col pb-6">
      <ScreenTop title="Lots de paiements" backTo="/m/payments" right={canPay ? <RoundButton icon={Plus} ariaLabel="Nouveau lot" className="border-0" onClick={() => navigate('/m/payments/batch/new')} /> : undefined} />
      <div className="scrollbar-hide flex gap-2 overflow-x-auto px-5 pb-1 pt-3.5">
        <Chip label="En cours" count={openCount} active={filter === 'open'} onClick={() => setFilter('open')} />
        <Chip label="Payés" active={filter === 'paid'} onClick={() => setFilter('paid')} />
        <Chip label="Tous" active={filter === 'all'} onClick={() => setFilter('all')} />
      </div>
      {isLoading ? (
        <div className="px-5 pt-3"><SkeletonListScreen count={4} /></div>
      ) : isError ? (
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void refetch() }}>Les lots n'ont pas pu être chargés.</EmptyLine>
      ) : rows.length === 0 ? (
        <EmptyLine action={canPay ? { label: 'Nouveau lot', onClick: () => navigate('/m/payments/batch/new') } : undefined}>Aucun lot.</EmptyLine>
      ) : (
        <ItemList className="pt-1">
          {rows.map((b) => {
            const p = progress?.get(b.id);
            const total = p?.total ?? b.line_count;
            const done = p && p.closed >= p.total;
            const name = names.get(b.user_id) ?? 'Client';
            return (
              <ItemRow
                key={b.id}
                leading={<Initials name={name} />}
                title={name}
                subtitle={`${total} fournisseur${total > 1 ? 's' : ''} · ${shortWhen(b.created_at)}`}
                amount={yuan(b.total_amount_rmb)}
                tag={done ? { tone: 'success', label: 'Payé' } : { tone: 'pending', label: `${p?.paid ?? 0}/${total} payé${(p?.paid ?? 0) > 1 ? 's' : ''}` }}
                onClick={() => navigate(`/m/payments/batch/${b.id}`)}
              />
            );
          })}
        </ItemList>
      )}
    </div>
  );
}

export function BatchDetailScreen() {
  const canPay = useAdminAuth().hasPermission('canProcessPayments');
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = usePaymentBatch(batchId);
  const names = useClientNames();
  const more = useSheet();
  const [showNote, setShowNote] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-full flex-col">
        <ScreenTop title="Lot" backTo="/m/payments/batches" />
        <div className="px-5 pt-4"><SkeletonListScreen count={4} /></div>
      </div>
    );
  }
  if (!data?.batch) {
    return (
      <div className="flex min-h-full flex-col">
        <ScreenTop title="Lot" backTo="/m/payments/batches" />
        <EmptyLine action={{ label: 'Tous les lots', onClick: () => navigate('/m/payments/batches') }}>Lot introuvable.</EmptyLine>
      </div>
    );
  }

  const { batch, lines } = data;
  const client = names.get(batch.user_id) ?? 'Client';
  const paid = lines.filter((l) => l.status === 'completed').length;
  const total = lines.length || batch.line_count;
  const next = lines.find((l) => !['completed', 'rejected', 'cancelled_by_admin'].includes(l.status));

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop title={`Lot ${batch.reference}`} backTo="/m/payments/batches" right={<MoreButton onClick={more.show} />} />
      <div className="flex flex-col items-center px-5 pt-6 text-center">
        <BigFigure value={yuan(batch.total_amount_rmb)} center />
        <p className={cn('mt-2 text-[17px]', TEXT.body)}>{client} · {n0(batch.total_amount_xaf)} XAF</p>
        <div className="mt-4 flex w-full max-w-[240px] gap-1.5" aria-hidden>
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} className={cn('h-1.5 flex-1 rounded-full', i < paid ? 'bg-[#2C2C2C] dark:bg-[#E3E3E3]' : 'bg-[#D9D9D9] dark:bg-[#444444]')} />
          ))}
        </div>
        <p className={cn('mt-2 text-[16px] font-semibold', TEXT.strong)}>{paid} sur {total} payé{paid > 1 ? 's' : ''}</p>
        {showNote && batch.note && <p className={cn('mt-2 text-[16px]', TEXT.muted)}>{batch.note}</p>}
        <p className={cn('mt-1 text-[15px]', TEXT.muted)}>{format(new Date(batch.created_at), 'd MMM yyyy, HH:mm', { locale: fr })}</p>
      </div>
      <ItemList className="pt-3">
        {lines.map((l) => {
          const m = toMethodKey(l.method);
          const sub = [PAYMENT_METHOD[m].label, l.beneficiary_bank_name].filter(Boolean).join(' · ');
          return (
            <ItemRow
              key={l.id}
              leading={<MethodCircle method={m} />}
              title={l.beneficiary_name || (m === 'cash' ? 'Retrait au bureau' : 'Sans fournisseur')}
              subtitle={sub}
              amount={yuan(l.amount_rmb)}
              tag={paymentTag(l.status)}
              onClick={() => navigate(`/m/payments/${l.id}`)}
            />
          );
        })}
      </ItemList>
      {next ? (
        <Dock><BigButton onClick={() => navigate(`/m/payments/${next.id}`)}>Payer le suivant · {yuan(next.amount_rmb)}</BigButton></Dock>
      ) : <div className="h-8" />}
      <MenuSheet
        open={more.open}
        onClose={more.hide}
        items={[
          { label: 'Fiche du client', icon: UserRound, onClick: () => navigate(`/m/clients/${batch.user_id}`) },
          { label: showNote ? 'Masquer la note' : 'Note', icon: StickyNote, onClick: () => setShowNote(!showNote), hidden: !batch.note },
          { label: 'Nouveau lot', icon: Plus, onClick: () => navigate('/m/payments/batch/new'), hidden: !canPay },
        ]}
      />
    </div>
  );
}
