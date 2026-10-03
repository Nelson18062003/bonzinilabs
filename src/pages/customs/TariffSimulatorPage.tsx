// ============================================================
// Estimer mes droits — /douane/simulateur (site public) et
// /m/douane/simulateur (équipe). docs/douane/00-plan.md, étape 2.
// L'écran lui-même : site/simulator/SimulatorView.tsx.
// ============================================================
import { useTranslation } from 'react-i18next';
import { CustomsShell, type CustomsVariant } from './shared';
import { SiteLayout } from './site/SiteLayout';
import { Container, PageIntro } from './site/ui';
import { SimulatorView } from './site/simulator/SimulatorView';

export function TariffSimulatorPage({ variant = 'client', desktop = false }: { variant?: CustomsVariant; desktop?: boolean } = {}) {
  const { t } = useTranslation('customs');
  if (variant === 'admin') {
    return (
      <CustomsShell title={t('sim.title')} subtitle={t('sim.subtitle')} backTo="/m/douane" variant="admin" desktop={desktop}>
        <div className="dz bg-dz-bg px-4 pb-12 pt-4 text-dz-ink">
          <SimulatorView admin />
        </div>
      </CustomsShell>
    );
  }
  return (
    <SiteLayout>
      <PageIntro title={t('site.sim.title')} subtitle={t('site.sim.subtitle')} back={{ to: '/douane', label: t('site.badge') }} />
      <Container className="pb-24 lg:pb-20">
        <SimulatorView />
      </Container>
    </SiteLayout>
  );
}

export default TariffSimulatorPage;
