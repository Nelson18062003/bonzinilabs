// ============================================================
// ESPACE COMMERCIAL — un prospect : création (« /v/prospects/new ») et
// fiche (« /v/prospects/:id »).
//
//   · « /v/prospects/new » : l'assistant en six étapes (ProspectWizard) ;
//   · « /v/prospects/:id » : la fiche (ProspectDetail) — appeler, WhatsApp,
//     statut, besoins, identité, activité, la suite ;
//   · « /v/prospects/:id?modifier=<section> » : l'étape de l'assistant pour
//     cette section (identite, joindre, activite, besoins, aide, suite) ;
//     « ?completer » : les étapes où il manque quelque chose. Ouverte
//     depuis la fiche, elle s'y referme par un retour dans l'historique (le
//     bouton retour du téléphone fait de même ; ce qui était tapé est gardé
//     et repris) ; ouverte par un lien, elle revient à la fiche.
// Numéros au format international (`toE164` de PhoneNumberInput) ; doublons
// (client existant, prospect déjà suivi) vérifiés au serveur ; relance à
// 9 h, heure de Douala. Les erreurs du serveur s'affichent aussi en toast
// (les hooks s'en chargent).
// ============================================================
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useProspects } from '@/hooks/useSales';
import { ListSkeleton, LoadError, SALES_CARD, ScreenHeader } from './SalesBits';
import { ProspectDetail } from './ProspectDetail';
import { EditProspectWizard, NewProspectWizard } from './ProspectWizard';
import { COMPLETE, stepBySlug, stepMeta, type StepId } from './prospectDraft';

export function CommercialProspectForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const prospects = useProspects();
  const back = { label: 'Prospects', onClick: () => navigate('/v/prospects') };

  if (!id) return <NewProspectWizard />;

  if (prospects.isLoading) {
    return (
      <div>
        <ScreenHeader title="Prospect" back={back} />
        <div className="px-4 pt-4 sm:px-6">
          <div className={SALES_CARD}>
            <ListSkeleton rows={3} />
          </div>
        </div>
      </div>
    );
  }
  if (prospects.isError) {
    return (
      <div>
        <ScreenHeader title="Prospect" back={back} />
        <div className="px-4 pt-4 sm:px-6">
          <div className={SALES_CARD}>
            <LoadError message="Ce prospect n’a pas pu être chargé." onRetry={() => void prospects.refetch()} />
          </div>
        </div>
      </div>
    );
  }
  const prospect = prospects.data?.find((p) => p.id === id);
  if (!prospect) {
    return (
      <div>
        <ScreenHeader title="Prospect introuvable" back={back} />
        <p className="px-4 pt-3 text-[15px] text-muted-foreground sm:px-6">Il a peut-être été confié à un autre commercial.</p>
      </div>
    );
  }

  const fromCard = (location.state as { fromCard?: boolean } | null)?.fromCard === true;
  const section = stepBySlug(params.get('modifier'));
  const editing = params.has('completer') ? COMPLETE : section && section.id !== 'review' ? section.id : null;
  if (editing) {
    const close = () => (fromCard ? navigate(-1) : navigate(location.pathname, { replace: true }));
    return <EditProspectWizard key={`${prospect.id}:${editing}`} prospect={prospect} requested={editing} onDone={close} />;
  }

  const openEdit = (step: StepId) => navigate(`${location.pathname}?modifier=${stepMeta(step).slug}`, { state: { fromCard: true } });
  const openComplete = () => navigate(`${location.pathname}?completer`, { state: { fromCard: true } });
  return <ProspectDetail key={prospect.id} prospect={prospect} onEdit={openEdit} onComplete={openComplete} />;
}
