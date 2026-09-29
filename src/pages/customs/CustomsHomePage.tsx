// ============================================================
// Douane — /douane (public) et /m/douane (équipe).
// La porte d'entrée des outils douane (docs/douane/00-plan.md). Chaque
// outil s'ajoute ici quand il existe vraiment — pas de « bientôt ».
// ============================================================
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Calculator, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Card, Holder, ListRow, Line, SURFACE, TEXT, TYPE } from '@/mobile/designKit';
import { CustomsShell, type CustomsVariant } from './shared';

export function CustomsHomePage({ variant = 'client', desktop = false }: { variant?: CustomsVariant; desktop?: boolean } = {}) {
  const { t } = useTranslation('customs');
  const navigate = useNavigate();
  const { user } = useAuth();
  const base = variant === 'admin' ? '/m/douane' : '/douane';
  const back = variant === 'admin' ? '/m/more' : user ? '/wallet' : '/';

  return (
    <CustomsShell title={t('hub.title')} backTo={back} variant={variant} desktop={desktop}>
      <div className="mx-auto max-w-2xl space-y-6 px-4 pb-12 pt-3">
        <Card className="space-y-3 p-5">
          <p className={cn(TYPE.title, TEXT.strong)}>{t('hub.tagline')}</p>
          <Line>{t('hub.intro')}</Line>
        </Card>

        <div className={cn('rounded-lg px-4', SURFACE.card, SURFACE.shadow)}>
          <ListRow
            leading={<Holder icon={Calculator} />}
            title={t('hub.simulatorTitle')}
            subtitle={t('hub.simulatorDesc')}
            onClick={() => navigate(`${base}/simulateur`)}
          />
          <ListRow
            leading={<Holder icon={Search} />}
            title={t('hub.searchTitle')}
            subtitle={t('hub.searchDesc')}
            onClick={() => navigate(`${base}/simulateur`)}
          />
        </div>

        <p className={cn(TYPE.small, TEXT.muted)}>{t('hub.facts')}</p>
      </div>
    </CustomsShell>
  );
}

export default CustomsHomePage;
