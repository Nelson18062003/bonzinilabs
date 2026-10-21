/**
 * Analyses — mobile, refonte v2 (maquettes validées :
 * docs/mobile-refonte/maquettes-v2/09-analyses, 26 écrans ; l'écran 27,
 * mini-graphe de l'Accueil, et la répartition des paiements par montant
 * (écran 10) attendent la validation du propriétaire et ne sont pas codés).
 *
 * Une seule route, `/m/dashboard/*` : la période et la comparaison restent
 * choisies d'un écran à l'autre. Chaque graphe a son écran (un graphe par
 * écran, gros chiffre au-dessus), son « … » (période, comparer, pas, voir la
 * liste, voir en tableau, exporter en CSV / PDF / image).
 *
 * Les données sont celles du tableau de bord ordinateur (`useAnalytics`,
 * `useTreasury`) : rien n'a changé côté serveur.
 */
import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { DateRangeProvider, useDateRange } from '@/lib/analytics/DateRangeContext';
import { AnalyticsUiProvider } from './state';
import { AnalyticsSheets } from './sheets';
import { Overview } from './Overview';
import {
  BasketScreen, CompareScreen, DepositsScreen, FlowScreen, MethodsScreen, MoneyScreen, OperationsList, PaymentsScreen,
} from './screensMoney';
import {
  ActiveScreen, ClientsScreen, CounterpartiesScreen, CountriesScreen, DelaysScreen, GrowthScreen, SourcesScreen, TeamScreen, TopScreen,
} from './screensClients';

const SCREENS: Record<string, React.ComponentType> = {
  paiements: PaymentsScreen,
  liste: OperationsList,
  comparer: CompareScreen,
  depots: DepositsScreen,
  flux: FlowScreen,
  methodes: MethodsScreen,
  panier: BasketScreen,
  argent: MoneyScreen,
  clients: ClientsScreen,
  actifs: ActiveScreen,
  top: TopScreen,
  pays: CountriesScreen,
  sources: SourcesScreen,
  delais: DelaysScreen,
  equipe: TeamScreen,
  croissance: GrowthScreen,
  contreparties: CounterpartiesScreen,
};

export function MobileAnalyticsDashboard() {
  return (
    <DateRangeProvider defaultPreset="last_30_days">
      <CompareByDefault>
        <AnalyticsUiProvider>
          <Router />
          <AnalyticsSheets />
        </AnalyticsUiProvider>
      </CompareByDefault>
    </DateRangeProvider>
  );
}

/** « Comparer » est actif à l'ouverture (maquette 01) ; on attend qu'il le soit pour lancer les lectures. */
function CompareByDefault({ children }: { children: React.ReactNode }) {
  const { range, setCompareToPrevious } = useDateRange();
  const [ready, setReady] = React.useState(range.compareToPrevious);
  React.useEffect(() => {
    if (!ready) { setCompareToPrevious(true); setReady(true); }
  }, [ready, setCompareToPrevious]);
  return ready ? <>{children}</> : null;
}

function Router() {
  const { pathname } = useLocation();
  const sub = pathname.replace(/^\/m\/dashboard\/?/, '').split('/')[0] ?? '';
  React.useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  const Screen = SCREENS[sub] ?? Overview;
  return <Screen />;
}
