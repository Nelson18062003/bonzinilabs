/**
 * Planche de composants — Trésorerie.
 *
 * Retour : « les boutons et les composants ne sont pas top ». Trois
 * traitements du MÊME jeu d'éléments, côte à côte, pour trancher en
 * regardant. La direction A (Inter + mono, gris neutres, angles nets) est
 * acquise : ici seule la FABRIQUE des contrôles change.
 *
 * Défauts corrigés dans les trois variantes (ils étaient objectifs, pas une
 * affaire de goût) :
 *   · une seule hauteur de barre d'outils — 32px partout, plus de 26 vs 32 ;
 *   · des bordures qui se voient (#D4D4D8 au lieu de #E4E4E7 sur blanc) ;
 *   · un vrai compteur dans les filtres, pas du texte grisé ;
 *   · des boutons-icônes à 28px au lieu de 24.
 *
 * Maquette : autonome, aucun import du kit, rien ne part en production tel quel.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';

const INK = '#09090B';
const BODY = '#52525B';
const MUTED = '#71717A';
const FAINT = '#A1A1AA';
const LINE = '#E4E4E7';
const LINE_STRONG = '#D4D4D8';
const INSET = '#F4F4F5';
const INDIGO = '#4F46E5';
const AMBER = '#B45309';

const sans = { fontFamily: '"Inter", system-ui, sans-serif' };
const mono = { fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontVariantNumeric: 'tabular-nums' as const };

/* ══ Variante 1 — PLEIN : pas de bordure, des fonds. ══════════════ */

function V1() {
  return (
    <Row title="1 — Plein" note="Aucune bordure : les contrôles existent par leur fond. Compteur en pastille pleine.">
      <Group label="Boutons">
        <button style={{ ...btn, background: '#18181B', color: '#fff' }}>Vente USDT</button>
        <button style={{ ...btn, background: '#E4E4E7', color: INK }}>Achat</button>
        <button style={{ ...btn, background: 'transparent', color: BODY }}>Annuler</button>
      </Group>
      <Group label="Filtres">
        <button style={{ ...chip, background: '#18181B', color: '#fff' }}>
          Tout <b style={{ ...mono, ...countPill, background: 'rgba(255,255,255,0.22)', color: '#fff' }}>11</b>
        </button>
        <button style={{ ...chip, background: '#E4E4E7', color: BODY }}>
          Achats <b style={{ ...mono, ...countPill, background: 'rgba(0,0,0,0.10)', color: INK }}>6</b>
        </button>
        <button style={{ ...chip, background: '#E4E4E7', color: BODY }}>
          Ventes <b style={{ ...mono, ...countPill, background: 'rgba(0,0,0,0.10)', color: INK }}>5</b>
        </button>
      </Group>
      <Group label="Recherche · menu">
        <div style={{ ...field, background: INSET, color: FAINT, width: 190 }}>Rechercher…</div>
        <button style={{ ...chip, background: '#E4E4E7', color: BODY }}>30 jours ▾</button>
      </Group>
      <Group label="Badges">
        <span style={{ ...tag, background: '#EEF2FF', color: INDIGO }}>Achat</span>
        <span style={{ ...tag, background: '#FEF3C7', color: AMBER }}>Vente</span>
        <span style={{ ...tag, background: '#FEE2E2', color: '#B91C1C' }}>Annulée</span>
      </Group>
      <Group label="Actions de ligne">
        <button style={{ ...icon, background: INSET, color: BODY }}>▤</button>
        <button style={{ ...icon, background: INSET, color: BODY }}>✎</button>
        <button style={{ ...icon, background: '#FEE2E2', color: '#B91C1C' }}>🗑</button>
      </Group>
    </Row>
  );
}

/* ══ Variante 2 — CONTOUR NET : bordures assumées, fonds blancs. ══ */

function V2() {
  return (
    <Row title="2 — Contour net" note="Bordure franche et visible. Compteur séparé par un filet. Le plus « outil de travail ».">
      <Group label="Boutons">
        <button style={{ ...btn, background: '#18181B', color: '#fff' }}>Vente USDT</button>
        <button style={{ ...btn, background: '#fff', color: INK, border: `1px solid ${LINE_STRONG}` }}>Achat</button>
        <button style={{ ...btn, background: 'transparent', color: BODY }}>Annuler</button>
      </Group>
      <Group label="Filtres">
        <button style={{ ...chip, background: '#18181B', color: '#fff', padding: 0, overflow: 'hidden' }}>
          <span style={{ padding: '0 10px' }}>Tout</span>
          <span style={{ ...mono, padding: '0 8px', borderLeft: '1px solid rgba(255,255,255,0.25)', height: '100%', display: 'inline-flex', alignItems: 'center' }}>11</span>
        </button>
        <button style={{ ...chip, background: '#fff', color: BODY, border: `1px solid ${LINE_STRONG}`, padding: 0, overflow: 'hidden' }}>
          <span style={{ padding: '0 10px' }}>Achats</span>
          <span style={{ ...mono, padding: '0 8px', borderLeft: `1px solid ${LINE_STRONG}`, background: INSET, height: '100%', display: 'inline-flex', alignItems: 'center' }}>6</span>
        </button>
        <button style={{ ...chip, background: '#fff', color: BODY, border: `1px solid ${LINE_STRONG}`, padding: 0, overflow: 'hidden' }}>
          <span style={{ padding: '0 10px' }}>Ventes</span>
          <span style={{ ...mono, padding: '0 8px', borderLeft: `1px solid ${LINE_STRONG}`, background: INSET, height: '100%', display: 'inline-flex', alignItems: 'center' }}>5</span>
        </button>
      </Group>
      <Group label="Recherche · menu">
        <div style={{ ...field, background: '#fff', border: `1px solid ${LINE_STRONG}`, color: FAINT, width: 190 }}>Rechercher…</div>
        <button style={{ ...chip, background: '#fff', color: BODY, border: `1px solid ${LINE_STRONG}` }}>30 jours ▾</button>
      </Group>
      <Group label="Badges">
        <span style={{ ...tag, background: '#fff', color: INDIGO, border: `1px solid ${INDIGO}33`, boxShadow: `inset 3px 0 0 ${INDIGO}` }}>Achat</span>
        <span style={{ ...tag, background: '#fff', color: AMBER, border: `1px solid ${AMBER}33`, boxShadow: `inset 3px 0 0 ${AMBER}` }}>Vente</span>
        <span style={{ ...tag, background: '#fff', color: '#B91C1C', border: '1px solid #B91C1C33', boxShadow: 'inset 3px 0 0 #B91C1C' }}>Annulée</span>
      </Group>
      <Group label="Actions de ligne">
        <button style={{ ...icon, background: '#fff', color: BODY, border: `1px solid ${LINE_STRONG}` }}>▤</button>
        <button style={{ ...icon, background: '#fff', color: BODY, border: `1px solid ${LINE_STRONG}` }}>✎</button>
        <button style={{ ...icon, background: '#fff', color: '#B91C1C', border: '1px solid #FCA5A5' }}>🗑</button>
      </Group>
    </Row>
  );
}

/* ══ Variante 3 — SEGMENTÉ : les filtres deviennent UN contrôle. ══ */

function V3() {
  return (
    <Row title="3 — Segmenté" note="Les filtres forment un seul bloc soudé (comme iOS / Linear). Moins d'objets à l'écran.">
      <Group label="Boutons">
        <button style={{ ...btn, background: INDIGO, color: '#fff' }}>Vente USDT</button>
        <button style={{ ...btn, background: '#fff', color: INK, border: `1px solid ${LINE_STRONG}` }}>Achat</button>
        <button style={{ ...btn, background: 'transparent', color: INDIGO, fontWeight: 600 }}>Annuler</button>
      </Group>
      <Group label="Filtres">
        <div style={{ display: 'inline-flex', height: 32, borderRadius: 6, background: INSET, padding: 3, gap: 2 }}>
          {[
            ['Tout', '11', true],
            ['Achats', '6', false],
            ['Ventes', '5', false],
            ['Annulées', '1', false],
          ].map(([l, n, on]) => (
            <span
              key={l as string}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '0 10px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                background: on ? '#fff' : 'transparent',
                color: on ? INK : MUTED,
                boxShadow: on ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {l}
              <b style={{ ...mono, fontSize: 10.5, color: on ? MUTED : FAINT, fontWeight: 500 }}>{n}</b>
            </span>
          ))}
        </div>
      </Group>
      <Group label="Recherche · menu">
        <div style={{ ...field, background: INSET, color: FAINT, width: 190 }}>Rechercher…</div>
        <button style={{ ...chip, background: INSET, color: BODY }}>30 jours ▾</button>
      </Group>
      <Group label="Badges">
        <span style={{ ...tag, background: 'transparent', color: INDIGO, padding: '0 2px', fontWeight: 700 }}>● Achat</span>
        <span style={{ ...tag, background: 'transparent', color: AMBER, padding: '0 2px', fontWeight: 700 }}>● Vente</span>
        <span style={{ ...tag, background: 'transparent', color: '#B91C1C', padding: '0 2px', fontWeight: 700 }}>● Annulée</span>
      </Group>
      <Group label="Actions de ligne">
        <button style={{ ...icon, background: 'transparent', color: MUTED }}>▤</button>
        <button style={{ ...icon, background: 'transparent', color: MUTED }}>✎</button>
        <button style={{ ...icon, background: 'transparent', color: '#B91C1C' }}>🗑</button>
      </Group>
    </Row>
  );
}

/* ── Gabarits communs ─────────────────────────────────────────────── */

const btn: React.CSSProperties = {
  height: 32,
  padding: '0 14px',
  borderRadius: 6,
  border: 'none',
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
};
const chip: React.CSSProperties = {
  height: 32,
  padding: '0 11px',
  borderRadius: 6,
  border: 'none',
  fontSize: 12,
  fontWeight: 600,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer',
};
const countPill: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  borderRadius: 999,
  padding: '1px 6px',
};
const field: React.CSSProperties = {
  height: 32,
  borderRadius: 6,
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0 11px',
  fontSize: 12,
};
const tag: React.CSSProperties = {
  height: 22,
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0 8px',
  borderRadius: 4,
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
};
const icon: React.CSSProperties = {
  height: 28,
  width: 28,
  borderRadius: 6,
  border: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 13,
  cursor: 'pointer',
};

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: FAINT, marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>{children}</div>
    </div>
  );
}

function Row({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 8, padding: '18px 20px 22px' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>{title}</div>
      <div style={{ fontSize: 12, color: MUTED, marginTop: 3, lineHeight: 1.45 }}>{note}</div>
      {children}
    </div>
  );
}

function Sheet() {
  return (
    <div style={{ ...sans, background: '#F4F4F5', minHeight: '100vh', padding: '26px 30px', color: INK }}>
      <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>Composants — 3 traitements</div>
      <div style={{ fontSize: 12.5, color: MUTED, marginTop: 3 }}>
        Mêmes couleurs et même typo (direction A). Seule la fabrique des contrôles change. Hauteur unique : 32px.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 20, alignItems: 'start' }}>
        <V1 />
        <V2 />
        <V3 />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sheet />
  </StrictMode>,
);
