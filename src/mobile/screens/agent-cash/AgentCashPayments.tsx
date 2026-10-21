// ============================================================
// AGENT-CASH — la liste, v2 (maquette 06-messages-douane-outils/17) :
//   « Bonjour Liang », le gros chiffre de ce qui reste à remettre, le
//   segment À remettre / Remis, puis une ligne par paiement (rond cash,
//   bénéficiaire, client, montant et tag QR lu / À remettre).
// Logique inchangée : useAgentCashPayments('pending' | 'paid', moi),
//   navigation vers la fiche. Langue et déconnexion sont dans Plus (/a/plus).
// ============================================================
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAgentCashPayments, CashPayment } from '@/hooks/useAgentCashPayments';
import { cashBeneficiaryName } from '@/lib/cashBeneficiary';
import {
  BoxSegmented, EmptyLine, HeroFigure, ItemList, ItemRow, MethodCircle, ScreenLoader, TabTop, type Tone,
} from '@/mobile/designKit';
import { yuan } from '@/mobile/screens/operations/opsLabels';

const wide = (s: string) => s.replace(/ /g, ' ');

export function AgentCashPayments() {
  const navigate = useNavigate();
  const { currentUser } = useAdminAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'pending' | 'paid'>('pending');

  const { data: pendingPayments, isLoading: loadingPending } = useAgentCashPayments('pending');
  const { data: paidPayments, isLoading: loadingPaid } = useAgentCashPayments('paid', currentUser?.id);

  const payments = activeTab === 'pending' ? pendingPayments : paidPayments;
  const isLoading = activeTab === 'pending' ? loadingPending : loadingPaid;

  const getClientName = (payment: CashPayment) =>
    payment.profile ? `${payment.profile.first_name} ${payment.profile.last_name}`.trim() : '—';

  const tag = (status: string): { tone: Tone; label: string } =>
    status === 'completed'
      ? { tone: 'success', label: t('cash_done') }
      : status === 'cash_scanned'
        ? { tone: 'neutral', label: t('cash_qr_read') }
        : { tone: 'pending', label: t('status_to_hand_over') }; /* cash_pending, et les anciens ready_for_payment / processing */

  const total = (pendingPayments ?? []).reduce((s, p) => s + (Number(p.amount_rmb) || 0), 0);
  const today = new Date().toDateString();
  const handedToday = (paidPayments ?? []).filter((p) => p.cash_paid_at && new Date(p.cash_paid_at).toDateString() === today).length;

  return (
    <div className="flex min-h-full flex-col pb-6">
      <TabTop title={`${t('cash_hello')} ${currentUser?.firstName ?? ''}`.trim()} />

      <div className="px-5 pt-3.5">
        <HeroFigure
          label={t('cash_to_hand')}
          value={loadingPending ? '—' : wide(yuan(total))}
          sub={[
            <><b className="font-bold">{pendingPayments?.length ?? 0}</b> {t('cash_payments_n')}</>,
            <><b className="font-bold">{handedToday}</b> {t('cash_handed_n')}</>,
          ]}
        />
      </div>

      <div className="px-5 pt-[18px]">
        <BoxSegmented<'pending' | 'paid'>
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: 'pending', label: t('status_to_hand_over') },
            { value: 'paid', label: t('cash_tab_handed') },
          ]}
        />
      </div>

      {isLoading ? (
        <ScreenLoader />
      ) : !payments || payments.length === 0 ? (
        <EmptyLine>{activeTab === 'pending' ? t('no_pending_payments') : t('no_paid_payments')}</EmptyLine>
      ) : (
        <ItemList className="pt-2">
          {payments.map((payment) => (
            <ItemRow
              key={payment.id}
              leading={<MethodCircle method="cash" />}
              title={cashBeneficiaryName(payment)}
              subtitle={`${t('client')} ${getClientName(payment)}`}
              amount={yuan(payment.amount_rmb)}
              tag={tag(payment.status)}
              onClick={() => navigate(`/a/payment/${payment.id}`)}
            />
          ))}
        </ItemList>
      )}
    </div>
  );
}
