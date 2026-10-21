// ============================================================
// Mobile admin — Cargo › Réception › un dépôt › ajouter ou modifier un
// colis (photos, couverture, état, poids, dimensions, contenu, bordereau).
// Le même écran que l'app Réception (04/12, ReceptionParcel), ouvert depuis
// la fiche dépôt de l'équipe : il parle la langue de l'app (agent) et
// revient à /m/cargo/reception/:depositId.
// ============================================================
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ReceptionParcel } from '@/mobile/screens/reception/ReceptionParcel';

export function MobileCargoParcel() {
  return (
    <LanguageProvider>
      <ReceptionParcel />
    </LanguageProvider>
  );
}
