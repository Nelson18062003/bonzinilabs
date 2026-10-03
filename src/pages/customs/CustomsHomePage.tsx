// ============================================================
// Douane — /douane (site public) et /m/douane (équipe).
// Le client arrive sur le site Douane (site/SiteHome) ; l'équipe garde son
// hub : la file du commissionnaire agréé, puis les outils.
// ============================================================
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BellRing, Calculator, Route, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { Card, Holder, ListRow, Line, SectionTitle, SURFACE, TEXT, TYPE } from '@/mobile/designKit';
import { CustomsShell, type CustomsVariant } from './shared';
import { SiteHome } from './site/SiteHome';
import { ReviewQueue } from './components/ReviewQueue';

export function CustomsHomePage({ variant = 'client', desktop = false }: { variant?: CustomsVariant; desktop?: boolean } = {}) {
  if (variant === 'client') return <SiteHome />;
  return <StaffCustomsHome desktop={desktop} />;
}

function StaffCustomsHome({ desktop = false }: { desktop?: boolean }) {
  const { t } = useTranslation('customs');
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const staffQueue = hasPermission('canViewCustoms');
  const base = '/m/douane';

  return (
    <CustomsShell title={t('hub.title')} backTo="/m/more" variant="admin" desktop={desktop}>
      <div className="mx-auto max-w-2xl space-y-6 px-4 pb-12 pt-3">
        {/* Le commissionnaire agréé arrive ici : sa file passe avant tout le reste. */}
        {staffQueue ? (
          <ReviewQueue />
        ) : (
          <Card className="space-y-3 p-5">
            <p className={cn(TYPE.title, TEXT.strong)}>{t('hub.tagline')}</p>
            <Line>{t('hub.intro')}</Line>
          </Card>
        )}

        {staffQueue && <SectionTitle className="-mb-4">{t('hub.tools', { defaultValue: 'Outils' })}</SectionTitle>}
        <div className={cn('rounded-lg px-4', SURFACE.card, SURFACE.shadow)}>
          <ListRow leading={<Holder icon={BellRing} />} title={t('hub.watchTitle')} subtitle={t('hub.watchDesc')} onClick={() => navigate(`${base}/veille`)} />
          <ListRow leading={<Holder icon={Route} />} title={t('hub.routesTitle')} subtitle={t('hub.routesDesc')} onClick={() => navigate(`${base}/routes`)} />
          <ListRow leading={<Holder icon={Calculator} />} title={t('hub.simulatorTitle')} subtitle={t('hub.simulatorDesc')} onClick={() => navigate(`${base}/simulateur`)} />
          <ListRow leading={<Holder icon={Search} />} title={t('hub.searchTitle')} subtitle={t('hub.searchDesc')} onClick={() => navigate(`${base}/simulateur`)} />
        </div>

        <p className={cn(TYPE.small, TEXT.muted)}>{t('hub.facts')}</p>
      </div>
    </CustomsShell>
  );
}

export default CustomsHomePage;
