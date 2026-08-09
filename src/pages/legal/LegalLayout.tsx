// ============================================================
// Socle commun aux deux pages légales publiques
// (/confidentialite et /conditions).
//
// POURQUOI CES PAGES EXISTENT
// Google exige, pour vérifier la marque d'un client OAuth, une politique de
// confidentialité et des conditions d'utilisation atteignables sur le domaine
// autorisé. Sans elles, le bouton « Verify branding » reste grisé et l'écran
// de consentement affiche l'adresse technique de redirection à la place de
// « Bonzini Labs ». Ce sont aussi des obligations propres : UK GDPR pour la
// première, contrat de service pour la seconde.
//
// PARTI PRIS DE LECTURE
// Un texte légal se PARCOURT plus qu'il ne se lit : sommaire ancré, sections
// numérotées, colonne de 68 caractères, interlignage large. Le corps de texte
// utilise `ink` et non `C.muted` — ce dernier, prévu pour des légendes courtes,
// tombe sous un contraste confortable sur fond #050208 quand on enchaîne les
// paragraphes.
//
// Les 3 couleurs du logo sont présentes partout (règle .claude/rules/frontend.md) :
// elles numérotent les sections en rotation violet → ambre → orange, et
// reforment la barre tri-couleur du pied de page de la landing.
// ============================================================
import { useEffect } from 'react';
import { Link } from 'react-router-dom';

// Même palette et mêmes fontes que src/pages/LandingPage.tsx : ces pages sont
// la continuation du site public, pas une annexe administrative.
export const C = {
  bg: '#050208',
  violet: '#a64af7',
  gold: '#f3a745',
  orange: '#fe560d',
  muted: '#8b82a0',
  dim: '#3d3555',
  surface: '#0f0b18',
  ink: '#d8d3e6', // corps de texte — plus clair que `muted`, tenable sur la durée
};
export const F = { display: "'Syne', sans-serif", body: "'DM Sans', sans-serif" };

// ─── Identité de la société ───────────────────────────────────────────────────
// Un seul endroit à corriger si quoi que ce soit change.
export const COMPANY = {
  name: 'BONZINILABS LTD',
  address: ['71-75 Shelton Street', 'Covent Garden', 'Londres WC2H 9JQ', 'Royaume-Uni'],
  phone: '+237 652 236 856',
  /**
   * Adresse de contact publiée. DOIT être une boîte réellement relevée : c'est
   * par elle que transitent les demandes d'accès et de suppression, auxquelles
   * le UK GDPR impose de répondre sous un mois.
   */
  email: 'contact@bonzinilabs.com',
  /**
   * Numéro d'immatriculation au Companies House. Laisser `null` tant qu'il
   * n'est pas connu : la ligne disparaît alors, plutôt que d'afficher un
   * emplacement vide sur une page publique.
   */
  number: null as string | null,
  site: 'https://www.bonzinilabs.com',
};

/** Date de dernière révision, affichée en tête de chaque document. */
export const LAST_UPDATED = '9 août 2026';

const ACCENTS = [C.violet, C.gold, C.orange];

// ─── Primitives de texte ──────────────────────────────────────────────────────

export function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: F.body, fontSize: 15.5, lineHeight: 1.75, color: C.ink, margin: '0 0 16px' }}>
      {children}
    </p>
  );
}

export function UL({ items }: { items: React.ReactNode[] }) {
  return (
    <ul style={{ margin: '0 0 18px', padding: 0, listStyle: 'none' }}>
      {items.map((item, i) => (
        <li
          key={i}
          style={{
            fontFamily: F.body,
            fontSize: 15.5,
            lineHeight: 1.7,
            color: C.ink,
            padding: '0 0 10px 20px',
            position: 'relative',
          }}
        >
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              top: 11,
              width: 6,
              height: 6,
              borderRadius: 3,
              background: ACCENTS[i % 3],
            }}
          />
          {item}
        </li>
      ))}
    </ul>
  );
}

/** Encadré mis en avant — coordonnées, avertissement, point à retenir. */
export function Callout({ accent = C.violet, children }: { accent?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.dim}66`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 12,
        padding: '18px 20px',
        margin: '0 0 22px',
        fontFamily: F.body,
        fontSize: 14.5,
        lineHeight: 1.7,
        color: C.ink,
      }}
    >
      {children}
    </div>
  );
}

export interface LegalSection {
  id: string;
  title: string;
  body: React.ReactNode;
}

// ─── Logo (repris de la landing, en réduction) ────────────────────────────────
function Mark({ size = 26 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        width: size,
        height: size,
        borderRadius: size / 4,
        overflow: 'hidden',
        background: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img src="/assets/bonzini-logo.jpg" alt="" width={size} height={size} style={{ display: 'block' }} />
    </span>
  );
}

// ─── Gabarit ──────────────────────────────────────────────────────────────────
export function LegalLayout({
  eyebrow,
  title,
  intro,
  sections,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  sections: LegalSection[];
}) {
  // Le titre de l'onglet double le H1 : ces pages sont souvent ouvertes dans un
  // onglet parmi dix, par un relecteur qui compare des documents.
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} — Bonzini`;
    return () => {
      document.title = previous;
    };
  }, [title]);

  return (
    <div style={{ background: C.bg, minHeight: '100vh' }}>
      {/* En-tête compact : le retour à l'accueil doit rester à portée. */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'rgba(5,2,8,0.88)',
          backdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: `1px solid ${C.dim}55`,
        }}
      >
        <div
          style={{
            maxWidth: 860,
            margin: '0 auto',
            height: 64,
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <Mark size={26} />
            <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 18, color: '#fff', letterSpacing: '-0.4px' }}>
              Bonzini
            </span>
          </Link>
          <Link
            to="/"
            style={{
              fontFamily: F.body,
              fontSize: 13.5,
              fontWeight: 500,
              color: C.muted,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            ← Retour à l'accueil
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '56px 24px 80px' }}>
        {/* Titre */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 13px',
            borderRadius: 999,
            border: `1px solid ${C.violet}44`,
            background: `${C.violet}14`,
            marginBottom: 20,
          }}
        >
          <span aria-hidden style={{ width: 6, height: 6, borderRadius: 3, background: C.gold }} />
          <span
            style={{
              fontFamily: F.body,
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              color: C.violet,
            }}
          >
            {eyebrow}
          </span>
        </div>

        <h1
          style={{
            fontFamily: F.display,
            fontWeight: 800,
            fontSize: 'clamp(30px, 6vw, 46px)',
            lineHeight: 1.1,
            letterSpacing: '-1.5px',
            color: '#fff',
            margin: '0 0 16px',
          }}
        >
          {title}
        </h1>

        <p style={{ fontFamily: F.body, fontSize: 16.5, lineHeight: 1.7, color: C.muted, margin: '0 0 12px' }}>
          {intro}
        </p>
        <p style={{ fontFamily: F.body, fontSize: 13, color: C.dim, margin: '0 0 40px' }}>
          Dernière mise à jour : {LAST_UPDATED} · Éditeur : {COMPANY.name}
        </p>

        {/* Sommaire — un document de cette longueur se parcourt d'abord. */}
        <nav
          aria-label="Sommaire"
          style={{
            background: C.surface,
            border: `1px solid ${C.dim}55`,
            borderRadius: 16,
            padding: '22px 24px',
            marginBottom: 44,
          }}
        >
          <h2
            style={{
              fontFamily: F.body,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              color: C.muted,
              margin: '0 0 14px',
            }}
          >
            Sommaire
          </h2>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 9 }}>
            {sections.map((section, i) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  style={{
                    fontFamily: F.body,
                    fontSize: 14.5,
                    color: C.ink,
                    textDecoration: 'none',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'baseline',
                  }}
                >
                  <span style={{ color: ACCENTS[i % 3], fontWeight: 700, minWidth: 18 }}>{i + 1}</span>
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Sections */}
        {sections.map((section, i) => (
          <section key={section.id} id={section.id} style={{ scrollMarginTop: 84, marginBottom: 44 }}>
            <h2
              style={{
                fontFamily: F.display,
                fontWeight: 800,
                fontSize: 'clamp(20px, 3.4vw, 25px)',
                lineHeight: 1.25,
                letterSpacing: '-0.6px',
                color: '#fff',
                margin: '0 0 16px',
                display: 'flex',
                gap: 12,
                alignItems: 'baseline',
              }}
            >
              <span style={{ color: ACCENTS[i % 3], fontSize: '0.72em', fontWeight: 800 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              {section.title}
            </h2>
            {section.body}
          </section>
        ))}
      </main>

      <footer style={{ borderTop: `1px solid ${C.dim}55`, padding: '32px 24px 40px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ display: 'flex', borderRadius: 2, overflow: 'hidden', height: 2, marginBottom: 22 }}>
            <div style={{ flex: 2, background: C.gold }} />
            <div style={{ flex: 3, background: C.violet }} />
            <div style={{ flex: 2, background: C.orange }} />
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 18,
              justifyContent: 'space-between',
              fontFamily: F.body,
              fontSize: 13,
              color: C.dim,
            }}
          >
            <span>© {new Date().getFullYear()} {COMPANY.name}</span>
            <span style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              <Link to="/confidentialite" style={{ color: C.muted, textDecoration: 'none' }}>
                Confidentialité
              </Link>
              <Link to="/conditions" style={{ color: C.muted, textDecoration: 'none' }}>
                Conditions d'utilisation
              </Link>
              <a href={`mailto:${COMPANY.email}`} style={{ color: C.muted, textDecoration: 'none' }}>
                {COMPANY.email}
              </a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
