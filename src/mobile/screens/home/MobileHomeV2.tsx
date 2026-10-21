/**
 * L'Accueil v2 de l'équipe (maquette validée : docs/mobile-refonte/maquettes-v2,
 * écran 1). Façon Wave : un gros chiffre — ce qui reste à payer —, quatre gros
 * boutons ronds, puis les trois paiements les plus anciens. Mola et les
 * notifications en ronds en haut à droite.
 *
 * Le trésorier a son propre accueil (stock USDT, coût moyen) ; les rôles de
 * terrain n'arrivent jamais ici (staffHomeFor).
 */
import { useNavigate } from 'react-router-dom';
import { ArrowDownToLine, ArrowUpRight, Bell, ScanLine, UserRound } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAdminActionableCounts, useAdminNotificationCount } from '@/hooks/useAdminNotifications';
import { useHomeToPay, type HomePayment } from '@/hooks/useHomeToPay';
import { formatYuan } from '@/lib/formatters';
import { whenSentence } from '@/lib/plainTime';
import {
  ActionCircles, EmptyLine, HeroFigure, ItemList, ItemRow, MethodCircle, PAYMENT_METHOD, RoundButton, SectionHead, TabTop,
  toMethodKey, type CircleAction, type Tone,
} from '@/mobile/designKit';
import { TreasurerHome } from '@/mobile/screens/treasury/TreasurerHome';
import { MolaMascot } from '@/components/MolaMascot';

/** En 40 px, l'espace fine des milliers disparaît : une espace insécable la remplace. */
const wide = (s: string) => s.replace(/\u202F/g, '\u00A0');

function payTag(p: HomePayment): { tone: Tone; label: string } {
  if (p.status === 'processing') return { tone: 'neutral', label: 'En cours' };
  if (p.status === 'cash_scanned') return { tone: 'pending', label: 'QR lu' };
  return { tone: 'pending', label: 'À payer' };
}

export function MobileHomeV2() {
  const { currentUser } = useAdminAuth();
  if (currentUser?.role === 'treasurer') return <TreasurerHome />;
  return <TeamHome />;
}

function TeamHome() {
  const navigate = useNavigate();
  const { currentUser, hasPermission } = useAdminAuth();
  const { data: counts } = useAdminActionableCounts();
  const { data: notifCount } = useAdminNotificationCount();
  const canPay = hasPermission('canViewPayments');
  const { data: toPay, isLoading, isError, refetch } = useHomeToPay({ userId: currentUser?.id, enabled: canPay });

  const actions: CircleAction[] = [];
  if (hasPermission('canProcessPayments')) actions.push({ label: 'Paiement', icon: ArrowUpRight, onClick: () => navigate('/m/payments/new') });
  if (hasPermission('canProcessDeposits')) actions.push({ label: 'Dépôt', icon: ArrowDownToLine, onClick: () => navigate('/m/deposits/new') });
  if (hasPermission('canViewClients')) {
    actions.push({ label: 'Scanner', icon: ScanLine, onClick: () => navigate('/m/clients/scan') });
    actions.push({ label: 'Client', icon: UserRound, onClick: () => navigate('/m/clients') });
  }

  // Le nombre vient de la même lecture que le total (sinon ¥ et « N paiements » peuvent se contredire).
  const payments = toPay?.count ?? counts?.payments ?? 0;
  const deposits = counts?.deposits ?? 0;

  return (
    <div className="flex min-h-full flex-col pb-4">
      <TabTop
        title={`Bonjour ${currentUser?.firstName ?? ''}`.trim()}
        right={
          <>
            <RoundButton ariaLabel="Mola" onClick={() => navigate('/m/assistant')}>
              <MolaMascot small alt="" className="h-full w-full object-cover" />
            </RoundButton>
            <RoundButton icon={Bell} ariaLabel="Notifications" dot={(notifCount ?? 0) > 0} onClick={() => navigate('/m/more/notifications')} />
          </>
        }
      />

      {canPay && (
        <div className="px-5 pt-3.5">
          <HeroFigure
            label="À payer"
            value={isLoading ? '—' : <>¥&nbsp;{wide(formatYuan(toPay?.total ?? 0))}</>}
            sub={[
              <><b className="font-bold">{payments}</b> paiement{payments > 1 ? 's' : ''}</>,
              <><b className="font-bold">{deposits}</b> dépôt{deposits > 1 ? 's' : ''} à valider</>,
            ]}
            onClick={() => navigate('/m/payments')}
          />
        </div>
      )}

      {actions.length > 0 && <ActionCircles actions={actions} />}

      {canPay && (
        <>
          <SectionHead title="À payer" link={{ label: 'Tout voir', onClick: () => navigate('/m/payments') }} />
          {isError ? (
            <EmptyLine action={{ label: 'Réessayer', onClick: () => void refetch() }}>La liste n'a pas pu être chargée.</EmptyLine>
          ) : toPay && toPay.list.length === 0 ? (
            <EmptyLine>Rien à payer pour l'instant.</EmptyLine>
          ) : (
            <ItemList>
              {(toPay?.list ?? []).map((p) => {
                const m = toMethodKey(p.method);
                return (
                  <ItemRow
                    key={p.id}
                    leading={<MethodCircle method={m} />}
                    title={p.clientName}
                    subtitle={`${PAYMENT_METHOD[m].label} · ${whenSentence(p.created_at)}`}
                    amount={<>¥&nbsp;{formatYuan(p.amount_rmb)}</>}
                    tag={payTag(p)}
                    onClick={() => navigate(`/m/payments/${p.id}`)}
                  />
                );
              })}
            </ItemList>
          )}
        </>
      )}

      {!canPay && hasPermission('canViewDeposits') && (
        <>
          <SectionHead title="À valider" link={{ label: 'Tout voir', onClick: () => navigate('/m/deposits') }} />
          <EmptyLine action={{ label: 'Ouvrir les dépôts', onClick: () => navigate('/m/deposits') }}>
            {deposits > 0 ? `${deposits} dépôt${deposits > 1 ? 's' : ''} à valider.` : 'Aucun dépôt à valider.'}
          </EmptyLine>
        </>
      )}

      {!canPay && !hasPermission('canViewDeposits') && (
        <EmptyLine action={{ label: 'Ouvrir Plus', onClick: () => navigate('/m/more') }}>Vos outils sont dans Plus.</EmptyLine>
      )}
    </div>
  );
}
