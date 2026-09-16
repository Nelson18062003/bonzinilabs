/**
 * Mobile admin — Opérations : Dépôts et Paiements dans un seul écran.
 *
 * Décision fondateur du 13/09/2026 : la barre du bas ne porte plus deux
 * onglets jumeaux. Un Tag Toggle bascule entre les deux listes ; le `+`
 * ouvre une feuille avec les trois créations et l'export. Les listes
 * elles-mêmes sont les écrans existants en mode `embedded` (sans en-tête,
 * sans tuiles KPI : les compteurs vivent dans les chips de statut).
 *
 * L'URL est l'état : /m/deposits et /m/payments restent les adresses des
 * deux onglets, /m/ops ouvre sur Dépôts.
 */
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowDownToLine, ArrowUpFromLine, FileDown, Layers, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminActionableCounts } from '@/hooks/useAdminNotifications';
import { exportPendingPaymentsPDF } from '@/lib/exportPendingPaymentsPDF';
import { MobileDepositsScreenV2 } from '@/mobile/screens/deposits/MobileDepositsScreenV2';
import { MobilePaymentsScreen } from '@/mobile/screens/payments/MobilePaymentsScreen';
import { BottomSheet, Holder, IconButton, ListRow, Segmented } from '@/mobile/designKit';

export type OpsTab = 'deposits' | 'payments';

/** L'ancien Accueil : il redirige vers Opérations. */
export function MobileHome() {
  return <Navigate to="/m/ops" replace />;
}

export function MobileOperationsScreen({ tab = 'deposits' }: { tab?: OpsTab }) {
  const navigate = useNavigate();
  const [sheet, setSheet] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Les mêmes chiffres que le badge « Opérations » de la barre : ce qui
  // attend un opérateur (src/lib/actionable.ts). Dépôts + Paiements = badge.
  const { data: counts } = useAdminActionableCounts();
  const depCount = counts?.deposits ?? 0;
  const payCount = counts?.payments ?? 0;

  const go = (t: OpsTab) => navigate(t === 'deposits' ? '/m/deposits' : '/m/payments', { replace: true });

  const exportPdf = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const count = await exportPendingPaymentsPDF();
      if (count === 0) toast.error('Aucun paiement en cours à exporter');
      else toast.success(`Export de ${count} paiement(s) téléchargé`);
      setSheet(false);
    } catch {
      toast.error("Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <MobileHeader
        title="Opérations"
        rightElement={<IconButton icon={Plus} variant="primary" onClick={() => setSheet(true)} ariaLabel="Nouvelle opération" />}
      />
      <div className="px-4 pt-3">
        <Segmented<OpsTab>
          value={tab}
          onChange={go}
          options={[
            { value: 'deposits', label: 'Dépôts', count: depCount },
            { value: 'payments', label: 'Paiements', count: payCount },
          ]}
        />
      </div>
      {tab === 'deposits' ? <MobileDepositsScreenV2 embedded /> : <MobilePaymentsScreen embedded />}

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Nouvelle opération">
        <div className="-mx-2">
          <ListRow leading={<Holder icon={ArrowDownToLine} />} title="Dépôt" subtitle="Créditer le portefeuille d’un client" onClick={() => { setSheet(false); navigate('/m/deposits/new'); }} className="px-2" />
          <ListRow leading={<Holder icon={ArrowUpFromLine} />} title="Paiement" subtitle="Régler un fournisseur pour un client" onClick={() => { setSheet(false); navigate('/m/payments/new'); }} className="px-2" />
          <ListRow leading={<Holder icon={Layers} />} title="Paiement groupé" subtitle="Plusieurs bénéficiaires d’un coup" onClick={() => { setSheet(false); navigate('/m/payments/batch/new'); }} className="px-2" />
          <ListRow leading={<Holder icon={FileDown} />} title={exporting ? 'Export en cours…' : 'Exporter les paiements en cours'} subtitle="PDF signé, pour l’équipe en Chine" onClick={exportPdf} chevron={false} className="px-2" />
        </div>
      </BottomSheet>
    </div>
  );
}
