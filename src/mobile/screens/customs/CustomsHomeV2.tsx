/**
 * Douane · À signer — refonte v2 (maquette 06/06). Le gros chiffre : les
 * classements à signer (et les déclarations à relire) ; quatre ronds
 * Signer · DAU · Veille · Routes ; la file, la plus ancienne d'abord, avec
 * le lien « Signés ». Le commissionnaire agréé arrive ici (staffHomeFor) ;
 * le reste de l'équipe (canViewCustoms) y lit la file depuis Plus.
 * Même source qu'avant : customs_review_queue (useCustomsReviewQueue).
 */
import { useNavigate } from 'react-router-dom';
import { Bell, Calculator, FileText, Package, PenTool, Route } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCustomsReviewQueue, type QueueAudit, type QueueClassification } from '@/hooks/useCustomsReview';
import { formatHs } from '@/lib/customs/hsCode';
import { cn } from '@/lib/utils';
import {
  ActionCircles, ActionSheet, BottomSheet, EmptyLine, HeroFigure, IconCircle, ItemList, ItemRow, MoreButton, ScreenLoader, ScreenTop,
  SectionHead, TabTop, Tag, TEXT, useSheet, type CircleAction,
} from '@/mobile/designKit';
import { clientName, nb, waited } from './shared';

function claimTag(x: { mine: boolean; claimed_by: string | null }) {
  if (x.mine) return <Tag tone="pending">À vous</Tag>;
  if (x.claimed_by) return <Tag tone="neutral">Pris</Tag>;
  return <Tag tone="pending">À prendre</Tag>;
}

/** Ce qui reste à signer, dans l'ordre : d'abord ce qui est à soi, puis ce qui est libre. */
export function nextInQueue<T extends { id: string; mine: boolean; claimed_by: string | null }>(list: T[], skip?: string): T | undefined {
  const rest = list.filter((x) => x.id !== skip);
  return rest.find((x) => x.mine) ?? rest.find((x) => !x.claimed_by);
}

export function CustomsHomeV2() {
  const navigate = useNavigate();
  const { currentUser, hasPermission } = useAdminAuth();
  const canView = hasPermission('canViewCustoms');
  const broker = currentUser?.role === 'customs_broker';
  const queue = useCustomsReviewQueue(canView);
  const signed = useSheet();
  const more = useSheet();

  const classifications = queue.data?.classifications ?? [];
  const audits = queue.data?.audits ?? [];
  const recent = queue.data?.recent ?? [];
  const firstC = nextInQueue(classifications) ?? classifications[0];
  const firstA = nextInQueue(audits) ?? audits[0];

  const actions: CircleAction[] = [
    { label: 'Signer', icon: PenTool, onClick: () => firstC && navigate(`/m/douane/revue/${firstC.id}`), disabled: !firstC },
    { label: 'DAU', icon: FileText, onClick: () => firstA && navigate(`/m/douane/audit/${firstA.id}`), disabled: !firstA, badge: audits.length },
    { label: 'Veille', icon: Bell, onClick: () => navigate('/m/douane/veille') },
    { label: 'Routes', icon: Route, onClick: () => navigate('/m/douane/routes') },
  ];

  const header = broker
    ? <TabTop title={`Bonjour Maître ${currentUser?.lastName ?? currentUser?.firstName ?? ''}`.trim()} />
    : <ScreenTop title="Douane" backTo="/m/more" right={<MoreButton onClick={more.show} />} />;

  if (!canView) {
    return (
      <div className="flex min-h-full flex-col pb-6">
        {header}
        <ActionCircles actions={[
          { label: 'Simulateur', icon: Calculator, onClick: () => navigate('/m/douane/simulateur') },
          { label: 'Veille', icon: Bell, onClick: () => navigate('/m/douane/veille'), primary: false },
          { label: 'Routes', icon: Route, onClick: () => navigate('/m/douane/routes'), primary: false },
        ]} />
        <ActionSheet open={more.open} onClose={more.hide} actions={[{ label: 'Simulateur', icon: Calculator, onClick: () => navigate('/m/douane/simulateur') }]} />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col pb-6">
      {header}
      {queue.isLoading ? (
        <ScreenLoader />
      ) : queue.isError ? (
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void queue.refetch() }}>La file n'a pas pu être chargée.</EmptyLine>
      ) : (
        <>
          <div className="px-5 pt-3.5">
            <HeroFigure
              label="À signer"
              value={nb(classifications.length)}
              unit={classifications.length > 1 ? 'classements' : 'classement'}
              sub={[<><b className="font-bold">{audits.length}</b> déclaration{audits.length > 1 ? 's' : ''} à relire</>]}
              onClick={firstC ? () => navigate(`/m/douane/revue/${firstC.id}`) : undefined}
            />
          </div>
          <ActionCircles actions={actions} />
          {!queue.data?.is_broker && broker && (
            <p className="px-5 pt-3 text-[16px] font-semibold text-[#975102] dark:text-[#E8B931]">Agrément non enregistré : signature impossible.</p>
          )}

          <SectionHead title="Classements" link={recent.length > 0 ? { label: 'Signés', onClick: signed.show } : undefined} />
          {classifications.length === 0 ? (
            <EmptyLine>Rien à signer pour le moment.</EmptyLine>
          ) : (
            <ItemList>
              {classifications.map((c: QueueClassification) => (
                <ItemRow
                  key={c.id}
                  leading={<IconCircle icon={Package} />}
                  title={c.product_name}
                  subtitle={[clientName(c.client), c.proposed_code ? formatHs(c.proposed_code) : 'sans code'].join(' · ')}
                  right={
                    <span className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className={cn('text-[16px] tabular-nums', TEXT.muted)}>{waited(c.submitted_at)}</span>
                      {claimTag(c)}
                    </span>
                  }
                  onClick={() => navigate(`/m/douane/revue/${c.id}`)}
                />
              ))}
            </ItemList>
          )}

          {audits.length > 0 && (
            <>
              <SectionHead title="Déclarations à relire" />
              <ItemList>
                {audits.map((a: QueueAudit) => (
                  <ItemRow
                    key={a.id}
                    leading={<IconCircle icon={FileText} />}
                    title={a.dau_number ? `DAU ${a.dau_number}` : a.ref}
                    subtitle={[clientName(a.client), a.overpaid_xaf ? `enjeu ${nb(a.overpaid_xaf)} XAF` : null].filter(Boolean).join(' · ')}
                    right={
                      <span className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className={cn('text-[16px] tabular-nums', TEXT.muted)}>{waited(a.submitted_at)}</span>
                        {claimTag(a)}
                      </span>
                    }
                    onClick={() => navigate(`/m/douane/audit/${a.id}`)}
                  />
                ))}
              </ItemList>
            </>
          )}
        </>
      )}

      <BottomSheet open={signed.open} onClose={signed.hide} title="Signés récemment">
        <div>
          {recent.slice(0, 20).map((r) => (
            <ItemRow
              key={`${r.kind}-${r.id}`}
              leading={<IconCircle icon={r.kind === 'audit' ? FileText : Package} />}
              title={r.label}
              subtitle={[r.ref, r.final_code ? formatHs(r.final_code) : null, r.kind === 'audit' && r.amount_xaf != null ? `${nb(r.amount_xaf)} XAF` : null].filter(Boolean).join(' · ')}
              tag={r.status === 'needs_info' ? { tone: 'pending', label: 'Question posée' } : { tone: 'success', label: 'Signé' }}
              onClick={() => { signed.hide(); navigate(r.kind === 'audit' ? `/m/douane/audit/${r.id}` : `/m/douane/revue/${r.id}`); }}
            />
          ))}
        </div>
      </BottomSheet>
      <ActionSheet open={more.open} onClose={more.hide} actions={[{ label: 'Simulateur', icon: Calculator, onClick: () => navigate('/m/douane/simulateur') }]} />
    </div>
  );
}
