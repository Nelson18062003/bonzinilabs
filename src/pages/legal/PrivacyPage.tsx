// ============================================================
// Politique de confidentialité — /confidentialite
//
// Cadre : UK GDPR + Data Protection Act 2018, l'éditeur étant une société
// immatriculée au Royaume-Uni. Le responsable de traitement est BONZINILABS
// LTD ; l'autorité de contrôle compétente est l'ICO.
//
// Les sous-traitants cités sont ceux réellement utilisés par la plateforme —
// vérifiés dans le code, pas supposés :
//   Supabase   → base de données, authentification, stockage des pièces
//   Resend     → emails transactionnels (supabase/functions/send-email)
//   Anthropic  → assistant Mola, côté administration (functions/admin-assistant)
//   Telegram   → alertes internes aux administrateurs (functions/telegram-bot)
//   Vercel     → hébergement du site et mesure d'audience (@vercel/analytics)
//   Google     → connexion des administrateurs par compte Google (OAuth)
// Toute nouvelle intégration doit être ajoutée à la section 6.
// ============================================================
import { LegalLayout, P, UL, Callout, COMPANY, C, F, type LegalSection } from './LegalLayout';

const A = { color: C.violet, textDecoration: 'none', fontWeight: 500 };
const B = { color: '#fff', fontWeight: 600 };

const sections: LegalSection[] = [
  {
    id: 'responsable',
    title: 'Qui est responsable de vos données',
    body: (
      <>
        <P>
          Bonzini est une plateforme de <span style={B}>règlement de fournisseurs</span> : elle permet à des
          importateurs africains de payer leurs fournisseurs en Chine, en francs CFA, au taux du jour.
        </P>
        <P>
          Le responsable du traitement de vos données personnelles est&nbsp;:
        </P>
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
        </Callout>
        <P>
          La société étant immatriculée au Royaume-Uni, ce document s'inscrit dans le cadre du{' '}
          <span style={B}>UK GDPR</span> et du <span style={B}>Data Protection Act 2018</span>.
        </P>
      </>
    ),
  },
  {
    id: 'donnees',
    title: 'Les données que nous recueillons',
    body: (
      <>
        <P>Nous ne collectons que ce dont le service a besoin pour fonctionner et pour rester conforme.</P>
        <UL
          items={[
            <>
              <span style={B}>Identité et contact</span> — nom, prénom, numéro de téléphone, adresse email,
              langue d'usage.
            </>,
            <>
              <span style={B}>Vérification d'identité (KYC)</span> — pièce d'identité, justificatifs
              d'activité et documents que vous téléversez pour ouvrir ou maintenir votre compte.
            </>,
            <>
              <span style={B}>Données d'opérations</span> — dépôts, règlements, montants, taux appliqué,
              solde, ainsi que les coordonnées des fournisseurs que vous nous demandez de payer
              (nom du bénéficiaire, banque ou compte Alipay/WeChat concerné).
            </>,
            <>
              <span style={B}>Échanges avec nous</span> — messages du support, pièces jointes, historique
              des demandes.
            </>,
            <>
              <span style={B}>Données techniques</span> — adresse IP, type d'appareil et de navigateur,
              pages consultées, horodatages de connexion, journaux de sécurité.
            </>,
          ]}
        />
        <P>
          Nous ne demandons jamais de données dites « sensibles » au sens de l'article&nbsp;9 du UK GDPR
          (origine, opinions, santé, orientation). Merci de ne pas nous en communiquer.
        </P>
      </>
    ),
  },
  {
    id: 'finalites',
    title: 'Pourquoi nous les utilisons, et à quel titre',
    body: (
      <>
        <P>Chaque traitement repose sur une base légale précise&nbsp;:</P>
        <UL
          items={[
            <>
              <span style={B}>Exécuter le service</span> — ouvrir votre compte, enregistrer vos dépôts,
              exécuter les règlements demandés, tenir votre solde à jour, vous assister.{' '}
              <em style={{ color: C.muted }}>Base : exécution du contrat.</em>
            </>,
            <>
              <span style={B}>Vérifier votre identité et lutter contre le blanchiment</span> — contrôles
              KYC, détection d'opérations inhabituelles, conservation des pièces justificatives.{' '}
              <em style={{ color: C.muted }}>Base : obligation légale.</em>
            </>,
            <>
              <span style={B}>Sécuriser la plateforme</span> — journalisation des connexions, limitation
              du nombre de tentatives, prévention de la fraude et des accès non autorisés.{' '}
              <em style={{ color: C.muted }}>Base : intérêt légitime.</em>
            </>,
            <>
              <span style={B}>Vous informer</span> — notifications d'opérations, alertes de sécurité,
              messages de service.{' '}
              <em style={{ color: C.muted }}>Base : exécution du contrat.</em>
            </>,
            <>
              <span style={B}>Améliorer le service</span> — mesure d'audience agrégée, diagnostic des
              erreurs.{' '}
              <em style={{ color: C.muted }}>Base : intérêt légitime.</em>
            </>,
            <>
              <span style={B}>Vous adresser des informations commerciales</span> — uniquement si vous
              l'avez accepté, et vous pouvez revenir sur ce choix à tout moment.{' '}
              <em style={{ color: C.muted }}>Base : consentement.</em>
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: 'decisions',
    title: 'Décisions automatisées',
    body: (
      <>
        <P>
          Certains contrôles de sécurité et de conformité sont automatisés — par exemple la mise en
          attente d'une opération qui s'écarte de vos habitudes. Ces mécanismes peuvent{' '}
          <span style={B}>retarder</span> une opération, jamais la refuser définitivement sans qu'une
          personne de notre équipe l'examine.
        </P>
        <P>
          Vous pouvez toujours demander ce réexamen humain, contester la décision et faire valoir votre
          point de vue en écrivant à{' '}
          <a href={`mailto:${COMPANY.email}`} style={A}>
            {COMPANY.email}
          </a>
          .
        </P>
      </>
    ),
  },
  {
    id: 'conservation',
    title: 'Combien de temps nous les gardons',
    body: (
      <>
        <UL
          items={[
            <>
              <span style={B}>Compte et opérations</span> — pendant toute la durée de la relation, puis{' '}
              <span style={B}>5 ans</span> à compter de sa fin, conformément aux obligations britanniques
              de lutte contre le blanchiment.
            </>,
            <>
              <span style={B}>Pièces d'identité et justificatifs KYC</span> — même durée de 5 ans après la
              fin de la relation.
            </>,
            <>
              <span style={B}>Journaux techniques et de sécurité</span> — 12 mois.
            </>,
            <>
              <span style={B}>Échanges avec le support</span> — 3 ans après le dernier contact.
            </>,
          ]}
        />
        <P>Au terme de ces durées, les données sont supprimées ou anonymisées de façon irréversible.</P>
      </>
    ),
  },
  {
    id: 'partage',
    title: 'Avec qui elles sont partagées',
    body: (
      <>
        <P>
          Nous ne vendons pas vos données et ne les louons à personne. Elles sont accessibles à nos
          prestataires techniques, strictement dans la mesure nécessaire à leur mission, et sous contrat
          de sous-traitance&nbsp;:
        </P>
        <UL
          items={[
            <>
              <span style={B}>Supabase</span> — hébergement de la base de données, authentification et
              stockage des documents.
            </>,
            <>
              <span style={B}>Resend</span> — acheminement des emails transactionnels (codes de connexion,
              confirmations d'opération).
            </>,
            <>
              <span style={B}>Vercel</span> — hébergement du site et mesure d'audience agrégée.
            </>,
            <>
              <span style={B}>Anthropic</span> — assistant interne d'exploitation, utilisé par notre
              équipe. Les données qui lui sont soumises ne servent pas à entraîner de modèle.
            </>,
            <>
              <span style={B}>Google</span> — uniquement si un membre de notre équipe se connecte à
              l'espace d'administration avec son compte Google.
            </>,
            <>
              <span style={B}>Telegram</span> — alertes internes adressées à nos administrateurs.
            </>,
          ]}
        />
        <P>
          Nous transmettons également des informations aux <span style={B}>établissements financiers et
          partenaires de paiement</span> nécessaires à l'exécution de votre règlement en Chine — sans quoi
          l'opération ne peut aboutir — ainsi qu'aux <span style={B}>autorités compétentes</span> lorsque
          la loi nous y oblige.
        </P>
      </>
    ),
  },
  {
    id: 'transferts',
    title: 'Transferts hors du Royaume-Uni',
    body: (
      <P>
        Le service s'adresse à des importateurs africains payant des fournisseurs chinois : par nature,
        certaines données circulent hors du Royaume-Uni. Ces transferts s'appuient sur une décision
        d'adéquation lorsqu'elle existe, ou à défaut sur des clauses contractuelles types complétées de
        garanties techniques — chiffrement en transit et au repos, cloisonnement des accès.
      </P>
    ),
  },
  {
    id: 'securite',
    title: 'Comment elles sont protégées',
    body: (
      <>
        <UL
          items={[
            <>Chiffrement des échanges (HTTPS) et des données stockées.</>,
            <>
              Accès cloisonné par rôle&nbsp;: chaque membre de l'équipe ne voit que ce que sa fonction
              exige, et toute action sensible est journalisée.
            </>,
            <>
              Connexion sans mot de passe pour l'administration — code à usage unique, compte Google ou
              clé d'accès (empreinte / reconnaissance faciale). Dans ce dernier cas,{' '}
              <span style={B}>aucune donnée biométrique ne nous est transmise</span> : elle ne quitte
              jamais l'appareil, qui se contente de débloquer une clé cryptographique.
            </>,
            <>Sauvegardes régulières et limitation du nombre de tentatives de connexion.</>,
          ]}
        />
        <P>
          Aucun système n'est infaillible. En cas de violation de données susceptible d'engendrer un
          risque pour vos droits, nous en informons l'ICO dans les 72 heures et vous prévenons
          directement lorsque le risque est élevé.
        </P>
      </>
    ),
  },
  {
    id: 'droits',
    title: 'Vos droits',
    body: (
      <>
        <P>Le UK GDPR vous reconnaît les droits suivants&nbsp;:</P>
        <UL
          items={[
            <>
              <span style={B}>Accès</span> — obtenir une copie des données que nous détenons sur vous.
            </>,
            <>
              <span style={B}>Rectification</span> — faire corriger ce qui est inexact ou incomplet.
            </>,
            <>
              <span style={B}>Effacement</span> — demander la suppression, sous réserve des durées de
              conservation que la loi nous impose.
            </>,
            <>
              <span style={B}>Limitation et opposition</span> — demander la suspension d'un traitement, ou
              vous opposer à ceux fondés sur notre intérêt légitime.
            </>,
            <>
              <span style={B}>Portabilité</span> — recevoir vos données dans un format lisible par
              machine.
            </>,
            <>
              <span style={B}>Retrait du consentement</span> — à tout moment, sans que cela remette en
              cause ce qui a été fait auparavant.
            </>,
          ]}
        />
        <Callout accent={C.gold}>
          Pour exercer l'un de ces droits, écrivez à{' '}
          <a href={`mailto:${COMPANY.email}`} style={A}>
            {COMPANY.email}
          </a>
          . Nous répondons sous <span style={B}>un mois</span>. Une pièce d'identité peut vous être
          demandée, uniquement pour éviter qu'un tiers n'accède à votre compte.
        </Callout>
        <P>
          Si notre réponse ne vous satisfait pas, vous pouvez saisir l'autorité britannique de protection
          des données, l'<span style={B}>Information Commissioner's Office</span> —{' '}
          <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noreferrer" style={A}>
            ico.org.uk
          </a>
          .
        </P>
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies et traceurs',
    body: (
      <>
        <UL
          items={[
            <>
              <span style={B}>Strictement nécessaires</span> — maintien de votre session et protection
              contre la fraude. Ils ne peuvent pas être désactivés sans rendre le service inutilisable.
            </>,
            <>
              <span style={B}>Préférences</span> — mémorisation de votre langue et de votre dernière
              adresse de connexion, pour vous éviter de la ressaisir.
            </>,
            <>
              <span style={B}>Mesure d'audience</span> — statistiques agrégées de fréquentation, sans
              profilage publicitaire.
            </>,
          ]}
        />
        <P>
          Nous n'utilisons aucun cookie publicitaire et ne revendons aucune donnée de navigation. Votre
          navigateur vous permet de bloquer ou supprimer les cookies déjà déposés.
        </P>
      </>
    ),
  },
  {
    id: 'mineurs',
    title: 'Mineurs',
    body: (
      <P>
        Le service s'adresse à des professionnels et n'est pas destiné aux personnes de moins de 18 ans.
        Nous ne collectons pas sciemment leurs données. Si vous constatez qu'un mineur nous en a
        transmis, signalez-le à{' '}
        <a href={`mailto:${COMPANY.email}`} style={A}>
          {COMPANY.email}
        </a>{' '}
        : nous supprimerons le compte.
      </P>
    ),
  },
  {
    id: 'modifications',
    title: 'Modifications de cette politique',
    body: (
      <P>
        Ce document peut évoluer avec le service ou la réglementation. La date en tête de page indique la
        dernière révision. Tout changement important vous sera signalé par email ou dans l'application
        avant son entrée en vigueur.
      </P>
    ),
  },
  {
    id: 'contact',
    title: 'Nous écrire',
    body: (
      <>
        <P>Pour toute question relative à ce document ou à vos données&nbsp;:</P>
        <Callout accent={C.orange}>
          <div>
            <a href={`mailto:${COMPANY.email}`} style={A}>
              {COMPANY.email}
            </a>
          </div>
          <div style={{ marginTop: 4 }}>
            <a href={`tel:${COMPANY.phone.replace(/\s/g, '')}`} style={A}>
              {COMPANY.phone}
            </a>
          </div>
          <div style={{ marginTop: 10, color: C.muted, fontFamily: F.body }}>
            {COMPANY.name} — {COMPANY.address.join(', ')}
          </div>
        </Callout>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalLayout
      eyebrow="Protection des données"
      title="Politique de confidentialité"
      intro="Ce que nous collectons, pourquoi, combien de temps nous le gardons, et ce que vous pouvez exiger de nous à tout moment."
      sections={sections}
    />
  );
}
