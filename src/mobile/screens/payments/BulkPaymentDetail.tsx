// ============================================================
// MODULE PAIEMENTS — Paiement groupé (bulk) : détail du lot
//
// Vue regroupée d'un lot : en-tête (réf. + client + totaux) puis la
// liste des lignes. Chaque ligne EST un vrai paiement → un clic ouvre
// le détail paiement existant (/m/payments/:id) où l'on complète le
// bénéficiaire, ajoute les preuves, valide ou refuse (par ligne).
// i18n : namespace `payments` (réutilise method.* / statusLabels.*).
// ============================================================
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { usePaymentBatch } from '@/hooks/usePaymentBatches';
import { useAllClients } from '@/hooks/useAdminDeposits';
import { formatXAF, formatCurrencyRMB, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import {
  SURFACE,
  TEXT,
  PAYMENT_METHOD,
  Card,
  Holder,
  Avatar,
  Amount,
  Row,
  StatusPill,
  ScreenLoader,
  SectionTitle,
  paymentStatusTone,
  type Tone,
} from '@/mobile/designKit';
import type { PaymentMethodKey } from '@/types/rates';

const STATUS_FR: Record<string, string> = {
  created: 'Créé',
  waiting_beneficiary_info: 'Infos requises',
  ready_for_payment: 'À traiter',
  processing: 'En cours',
  completed: 'Terminé',
  rejected: 'Refusé',
  cash_pending: 'Cash en attente',
  cash_scanned: 'Cash scanné',
  cancelled_by_admin: 'Annulé',
};

const uiMethod = (m: string): PaymentMethodKey => (m === 'bank_transfer' ? 'virement' : (m as PaymentMethodKey));

function MethodGlyph({ method }: { method: string }) {
  const meta = PAYMENT_METHOD[uiMethod(method)] ?? PAYMENT_METHOD.cash;
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-black"
      style={{ backgroundColor: `${meta.color}1A`, color: meta.color }}
    >
      {meta.cn.slice(0, 1)}
    </span>
  );
}

export function BulkPaymentDetail({ desktop = false }: { desktop?: boolean } = {}) {
  const navigate = useNavigate();
  const { t } = useTranslation('payments');
  const { batchId } = useParams<{ batchId: string }>();
  const { data, isLoading } = usePaymentBatch(batchId);
  const { data: clients = [] } = useAllClients();

  if (isLoading) return <ScreenLoader />;

  const batch = data?.batch;
  const lines = data?.lines ?? [];
  const client = batch ? clients.find((c) => c.user_id === batch.user_id) : undefined;
  const completed = lines.filter((l) => l.status === 'completed').length;

  const methodLabel = (m: string) => t(`method.${m}`, { defaultValue: PAYMENT_METHOD[uiMethod(m)]?.label ?? m });
  const statusLabel = (s: string) => t(`statusLabels.${s}`, { defaultValue: STATUS_FR[s] ?? s });

  return (
    <div className={cn('min-h-full', SURFACE.canvas)}>
      <div className={cn('mx-auto w-full max-w-3xl px-4 pb-16', desktop ? 'pt-8' : 'pt-6')}>
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Holder
            icon={ChevronLeft}
            size="sm"
            onClick={() => navigate('/m/payments')}
            ariaLabel={t('bulk.back', { defaultValue: 'Retour' })}
          />
          <div className="min-w-0">
            <h1 className={cn('truncate text-[22px] font-extrabold tracking-tight', TEXT.strong)}>
              {batch?.reference ?? t('bulk.title', { defaultValue: 'Paiement groupé' })}
            </h1>
            <p className={cn('text-[13px]', TEXT.muted)}>
              {batch
                ? t('bulk.detailSubtitle', {
                    count: batch.line_count,
                    done: completed,
                    total: lines.length,
                    defaultValue: `${batch.line_count} bénéficiaire(s) · ${completed}/${lines.length} terminé(s)`,
                  })
                : '—'}
            </p>
          </div>
        </div>

        {!batch ? (
          <Card className="flex flex-col items-center py-12 text-center">
            <Holder icon={Users} size="lg" tone="danger" />
            <p className={cn('mt-3 text-[14px] font-medium', TEXT.muted)}>
              {t('bulk.notFound', { defaultValue: 'Lot introuvable.' })}
            </p>
          </Card>
        ) : (
          <>
            {/* Summary */}
            <Card className="mb-6">
              <div className="mb-3 flex items-center gap-3">
                <Avatar name={`${client?.first_name ?? ''} ${client?.last_name ?? ''}`} tone="info" />
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate text-[15px] font-bold', TEXT.strong)}>
                    {client ? `${client.first_name ?? ''} ${client.last_name ?? ''}` : '—'}
                  </p>
                  <p className={cn('text-[12px]', TEXT.muted)}>{formatDate(batch.created_at, 'datetime')}</p>
                </div>
                <Amount value={formatCurrencyRMB(batch.total_amount_rmb)} size="md" />
              </div>
              <Row label={t('bulk.totalDebited', { defaultValue: 'Total débité' })} value={formatXAF(batch.total_amount_xaf)} />
              {batch.note && <Row label={t('detail.fields.notes', { defaultValue: 'Note' })} value={batch.note} />}
            </Card>

            {/* Lines */}
            <SectionTitle>{t('bulk.beneficiaries', { defaultValue: 'Bénéficiaires' })}</SectionTitle>
            <div className="space-y-2.5">
              {lines.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => navigate(`/m/payments/${l.id}`)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-[22px] p-3.5 text-left transition hover:-translate-y-0.5',
                    SURFACE.card,
                    SURFACE.shadow,
                  )}
                >
                  <MethodGlyph method={l.method} />
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-[14px] font-bold', TEXT.strong)}>
                      {l.beneficiary_name || methodLabel(l.method)}
                    </p>
                    <p className={cn('truncate text-[12px]', TEXT.muted)}>
                      {l.beneficiary_identifier || l.beneficiary_bank_account || l.reference}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn('text-[14px] font-extrabold tabular-nums', TEXT.strong)}>
                      {formatCurrencyRMB(l.amount_rmb)}
                    </p>
                    <p className={cn('text-[11px] tabular-nums', TEXT.muted)}>{formatXAF(l.amount_xaf)}</p>
                  </div>
                  <StatusPill tone={paymentStatusTone(l.status) as Tone} label={statusLabel(l.status)} className="shrink-0" />
                  <ChevronRight className={cn('h-4 w-4 shrink-0', TEXT.muted)} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
