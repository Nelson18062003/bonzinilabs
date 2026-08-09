// ============================================================
// Conditions d'utilisation — /conditions
//
// Contrat entre BONZINILABS LTD et l'utilisateur du service. Droit applicable :
// Angleterre et Pays de Galles, la société y étant immatriculée.
//
// VOCABULAIRE — cf. .claude/rules/frontend.md : on parle de « règlement »,
// de « paiement », de « payer ses fournisseurs ». Jamais de « transfert
// d'argent » ni d'« envoi d'argent » : ce n'est pas notre métier et ce
// vocabulaire nous rangerait dans une autre catégorie que la nôtre.
//
// AUCUNE MENTION DE STATUT RÉGLEMENTAIRE n'est faite ici, dans un sens comme
// dans l'autre. Ajouter une allégation d'agrément (FCA, établissement de
// paiement, monnaie électronique) sans décision d'un conseil juridique
// exposerait la société — ne pas compléter cette page de mémoire.
// ============================================================
import { LegalLayout, P, UL, Callout, COMPANY, C, F, type LegalSection } from './LegalLayout';

const A = { color: C.violet, textDecoration: 'none', fontWeight: 500 };
const B = { color: '#fff', fontWeight: 600 };

const sections: LegalSection[] = [
  {
    id: 'objet',
    title: 'Objet et acceptation',
    body: (
      <>
        <P>
          Les présentes conditions régissent l'utilisation de la plateforme Bonzini, éditée par{' '}
          <span style={B}>{COMPANY.name}</span>, société immatriculée en Angleterre, dont le siège est
          situé {COMPANY.address.join(', ')}.
        </P>
        <P>
          En créant un compte ou en utilisant le service, vous acceptez ces conditions dans leur
          intégralité. Si vous n'y consentez pas, n'utilisez pas la plateforme.
        </P>
      </>
    ),
  },
  {
    id: 'service',
    title: 'Ce que fait le service',
    body: (
      <>
        <P>
          Bonzini permet à des importateurs d'Afrique centrale et de l'Ouest de{' '}
          <span style={B}>régler leurs fournisseurs situés en Chine</span>, en francs CFA, au taux du
          jour affiché.
        </P>
        <UL
          items={[
            <>Vous approvisionnez votre compte en XAF (le « dépôt »).</>,
            <>
              Vous nous indiquez le fournisseur à payer et le montant, avec ses coordonnées de
              réception (compte bancaire, Alipay ou WeChat).
            </>,
            <>
              Nous exécutons le règlement auprès de ce fournisseur et votre solde est débité du montant
              correspondant, taux et frais appliqués.
            </>,
            <>Vous suivez chaque étape depuis votre espace, avec un justificatif à l'arrivée.</>,
          ]}
        />
        <Callout accent={C.gold}>
          Le solde inscrit à votre compte correspond aux sommes que vous nous avez confiées en vue de
          régler vos fournisseurs. Il n'est pas rémunéré, ne produit aucun intérêt et n'est pas un dépôt
          bancaire.
        </Callout>
      </>
    ),
  },
  {
    id: 'compte',
    title: 'Ouverture de compte et vérification',
    body: (
      <>
        <P>
          Le service s'adresse à des <span style={B}>professionnels majeurs</span> agissant dans le cadre
          de leur activité d'import.
        </P>
        <UL
          items={[
            <>
              Vous devez fournir des informations exactes et les tenir à jour — nom, coordonnées, nature
              de l'activité.
            </>,
            <>
              Nous sommes tenus de vérifier votre identité avant d'exécuter des opérations, et de
              renouveler ces contrôles en cours de relation. Nous pouvons demander des pièces
              complémentaires à tout moment.
            </>,
            <>
              Vos moyens de connexion sont personnels. Toute opération effectuée depuis votre compte est
              réputée émaner de vous&nbsp;; prévenez-nous immédiatement en cas d'accès suspect.
            </>,
            <>Un compte ne peut être ni cédé ni utilisé pour le compte d'un tiers non déclaré.</>,
          ]}
        />
      </>
    ),
  },
  {
    id: 'operations',
    title: 'Exécution des règlements',
    body: (
      <>
        <Callout accent={C.orange}>
          <span style={B}>Point le plus important de ce document.</span> Un règlement est exécuté à
          partir des coordonnées <em>que vous fournissez</em>. Une fois l'opération partie, elle ne peut
          plus être annulée. Vérifiez le nom du bénéficiaire, le numéro de compte et le montant avant de
          valider.
        </Callout>
        <UL
          items={[
            <>
              Une demande de règlement vaut instruction. Nous ne modifions pas les coordonnées d'un
              bénéficiaire de notre propre initiative.
            </>,
            <>
              Si des coordonnées erronées conduisent à un règlement vers le mauvais destinataire, nous
              vous assistons dans les démarches de récupération, sans pouvoir en garantir l'issue.
            </>,
            <>
              Nous pouvons demander une confirmation supplémentaire avant d'exécuter une opération
              inhabituelle par son montant ou sa destination.
            </>,
            <>
              Les délais d'exécution dépendent des établissements et partenaires concernés, ainsi que des
              jours ouvrés et fériés locaux. Les délais annoncés sont indicatifs.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: 'taux',
    title: 'Taux de change et frais',
    body: (
      <>
        <UL
          items={[
            <>
              Le taux applicable est celui <span style={B}>affiché au moment où vous validez</span> votre
              demande. Il inclut notre marge, sans supplément caché.
            </>,
            <>
              Les taux varient au cours de la journée. Un taux consulté n'engage qu'une fois l'opération
              validée.
            </>,
            <>
              Les frais éventuels sont indiqués avant validation. Des frais peuvent être prélevés par des
              établissements intermédiaires, en dehors de notre contrôle.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: 'interdits',
    title: 'Usages interdits',
    body: (
      <>
        <P>Il vous est interdit d'utiliser le service pour&nbsp;:</P>
        <UL
          items={[
            <>
              Régler des biens ou services illicites — stupéfiants, armes, contrefaçons, espèces
              protégées, contenus interdits.
            </>,
            <>
              Contourner des sanctions internationales, ou opérer au profit d'une personne ou entité qui
              en fait l'objet.
            </>,
            <>Blanchir des capitaux, financer le terrorisme ou dissimuler l'origine de fonds.</>,
            <>Agir pour le compte d'un tiers sans nous l'avoir déclaré.</>,
            <>
              Fournir de fausses informations, de faux documents, ou tenter d'accéder à des comptes qui
              ne sont pas les vôtres.
            </>,
          ]}
        />
        <P>
          Nous pouvons <span style={B}>suspendre ou refuser</span> toute opération, et fermer un compte,
          si nous avons un motif raisonnable de soupçonner l'un de ces usages ou si la loi nous l'impose.
          Lorsque la réglementation nous interdit d'en préciser la raison, nous ne pouvons pas la
          communiquer.
        </P>
      </>
    ),
  },
  {
    id: 'reclamations',
    title: 'Réclamations',
    body: (
      <>
        <P>
          Une opération vous semble incorrecte&nbsp;? Écrivez-nous à{' '}
          <a href={`mailto:${COMPANY.email}`} style={A}>
            {COMPANY.email}
          </a>{' '}
          ou appelez le{' '}
          <a href={`tel:${COMPANY.phone.replace(/\s/g, '')}`} style={A}>
            {COMPANY.phone}
          </a>
          , en précisant la référence de l'opération.
        </P>
        <UL
          items={[
            <>Nous accusons réception sous 2 jours ouvrés.</>,
            <>Nous apportons une réponse motivée sous 15 jours ouvrés, ou vous tenons informé si l'examen prend plus de temps.</>,
            <>
              Une somme prélevée à tort est recréditée sur votre solde dès que l'erreur est établie.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: 'responsabilite',
    title: 'Responsabilité',
    body: (
      <>
        <P>
          Nous mettons en œuvre les moyens raisonnables pour assurer un service disponible, exact et
          sécurisé. Notre responsabilité ne peut cependant être engagée&nbsp;:
        </P>
        <UL
          items={[
            <>
              pour les conséquences de coordonnées de bénéficiaire erronées que vous nous auriez
              communiquées&nbsp;;
            </>,
            <>
              pour les retards ou refus imputables à un établissement tiers, à une autorité, ou à un cas
              de force majeure&nbsp;;
            </>,
            <>
              pour la qualité, la conformité ou la livraison des marchandises que vous réglez — notre
              rôle s'arrête au règlement, nous ne sommes pas partie à votre contrat commercial&nbsp;;
            </>,
            <>
              pour les pertes indirectes, telles qu'un manque à gagner ou une perte d'opportunité
              commerciale.
            </>,
          ]}
        />
        <P>
          Aucune clause de ce document n'exclut notre responsabilité en cas de fraude, de faute lourde,
          de dommage corporel, ni dans les cas où la loi interdit une telle exclusion.
        </P>
      </>
    ),
  },
  {
    id: 'propriete',
    title: 'Propriété intellectuelle',
    body: (
      <P>
        La plateforme, son nom, son logo, son interface et son contenu appartiennent à{' '}
        {COMPANY.name}. Vous disposez d'un droit d'usage personnel et non exclusif du service, à
        l'exclusion de toute reproduction, extraction ou exploitation commerciale sans notre accord
        écrit.
      </P>
    ),
  },
  {
    id: 'resiliation',
    title: 'Durée et clôture du compte',
    body: (
      <>
        <UL
          items={[
            <>
              Vous pouvez fermer votre compte à tout moment, sous réserve que les opérations en cours
              soient achevées.
            </>,
            <>
              Nous pouvons y mettre fin avec un préavis raisonnable, ou sans préavis en cas de
              manquement grave, de soupçon de fraude ou d'obligation légale.
            </>,
            <>
              Tout solde disponible vous est restitué, déduction faite des sommes dues, une fois les
              vérifications nécessaires effectuées.
            </>,
            <>
              La clôture n'efface pas les données que la loi nous impose de conserver — voir la{' '}
              <a href="/confidentialite" style={A}>
                politique de confidentialité
              </a>
              .
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: 'evolutions',
    title: 'Modification des conditions',
    body: (
      <P>
        Ces conditions peuvent évoluer. Tout changement significatif vous sera annoncé par email ou dans
        l'application avant son entrée en vigueur. Continuer à utiliser le service après cette date vaut
        acceptation. Si le changement ne vous convient pas, vous pouvez fermer votre compte sans frais.
      </P>
    ),
  },
  {
    id: 'droit',
    title: 'Droit applicable et juridiction',
    body: (
      <>
        <P>
          Ces conditions sont régies par le <span style={B}>droit d'Angleterre et du Pays de Galles</span>
          . Les tribunaux d'Angleterre et du Pays de Galles sont compétents pour tout litige, sans
          préjudice des règles impératives protégeant les consommateurs dans leur pays de résidence.
        </P>
        <P>
          Nous vous invitons à nous contacter d'abord&nbsp;: la grande majorité des différends se règle
          sans procédure.
        </P>
      </>
    ),
  },
  {
    id: 'contact',
    title: 'Nous écrire',
    body: (
      <Callout accent={C.violet}>
        <div style={{ fontWeight: 700, color: '#fff', marginBottom: 6 }}>{COMPANY.name}</div>
        {COMPANY.address.map((line) => (
          <div key={line}>{line}</div>
        ))}
        {COMPANY.number && <div style={{ marginTop: 6 }}>Companies House n° {COMPANY.number}</div>}
        <div style={{ marginTop: 10 }}>
          <a href={`mailto:${COMPANY.email}`} style={A}>
            {COMPANY.email}
          </a>
          {' · '}
          <a href={`tel:${COMPANY.phone.replace(/\s/g, '')}`} style={A}>
            {COMPANY.phone}
          </a>
        </div>
        <div style={{ marginTop: 10, color: C.muted, fontFamily: F.body }}>{COMPANY.site}</div>
      </Callout>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalLayout
      eyebrow="Conditions"
      title="Conditions d'utilisation"
      intro="Le cadre de notre relation : ce que le service fait, ce qu'il ne fait pas, ce que nous attendons de vous et ce que vous pouvez attendre de nous."
      sections={sections}
    />
  );
}
