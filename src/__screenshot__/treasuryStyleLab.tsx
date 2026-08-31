/**
 * Laboratoire de style — Trésorerie.
 *
 * TROIS directions visuelles franchement différentes du MÊME écran
 * (Opérations), avec les mêmes données, pour choisir en regardant plutôt
 * qu'en décrivant. Chaque direction change les quatre choses rejetées :
 * couleurs, typographie, géométrie des boutons/pastilles, icônes.
 *
 * Volontairement autonome : aucune dépendance au kit partagé, pour que les
 * styles ne se contaminent pas. Ce fichier est une MAQUETTE, pas du code de
 * production — il sert à trancher, ensuite on implémente la direction retenue.
 *
 * Lancement : SCREENSHOT_MOCK=1 npx vite --port 8081
 *             /treasury-styles.html?style=a|b|c
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';

/* ── Données communes aux trois maquettes ────────────────────────── */

interface Op {
  date: string;
  time: string;
  kind: 'purchase' | 'sale';
  party: string;
  usdt: number;
  counter: number;
  currency: 'XAF' | 'CNY';
  rate: number;
  account: string;
  voided?: boolean;
}

const OPS: Op[] = [
  { date: '30 août 2026', time: '15:17', kind: 'sale', party: 'Mr. Chen', usdt: 4000, counter: 28960, currency: 'CNY', rate: 7.24, account: 'Alipay Guangzhou' },
  { date: '30 août 2026', time: '09:17', kind: 'purchase', party: 'Ibrahim Trading', usdt: 5000, counter: 3200000, currency: 'XAF', rate: 640, account: 'UBA Cameroun' },
  { date: '28 août 2026', time: '14:51', kind: 'purchase', party: 'Douala Crypto', usdt: 3000, counter: 1930000, currency: 'XAF', rate: 643.33, account: 'Plusieurs' },
  { date: '27 août 2026', time: '10:08', kind: 'sale', party: 'Lily Wang', usdt: 2500, counter: 18025, currency: 'CNY', rate: 7.21, account: 'Aucun' },
  { date: '25 août 2026', time: '11:42', kind: 'purchase', party: 'Ibrahim Trading', usdt: 2000, counter: 1275000, currency: 'XAF', rate: 637.5, account: 'Orange Money' },
  { date: '24 août 2026', time: '12:59', kind: 'sale', party: 'Mr. Chen', usdt: 3000, counter: 21780, currency: 'CNY', rate: 7.26, account: 'WeChat — papa' },
  { date: '22 août 2026', time: '16:33', kind: 'purchase', party: 'Kevin P2P', usdt: 1000, counter: 655000, currency: 'XAF', rate: 655, account: 'Caisse Douala', voided: true },
  { date: '19 août 2026', time: '09:24', kind: 'sale', party: 'Lily Wang', usdt: 1800, counter: 12996, currency: 'CNY', rate: 7.22, account: 'Alipay Guangzhou' },
];

const num = (n: number, d = 2) => n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const STATS = [
  { label: 'Stock USDT', value: num(8420.5), unit: 'USDT', hint: 'Disponible à la vente' },
  { label: 'WAC', value: num(638.42), unit: 'XAF/USDT', hint: 'Coût moyen du stock' },
  { label: 'XAF', value: '18,4 M', unit: 'XAF', hint: '3 comptes' },
  { label: 'CNY', value: '68 k', unit: 'CNY', hint: '3 comptes' },
];
const TABS = ['Opérations', 'Analyse', 'Comptes', 'Contreparties'];
const FILTERS = [
  { label: 'Tout', n: 11 },
  { label: 'Achats', n: 6 },
  { label: 'Ventes', n: 5 },
  { label: 'Annulées', n: 1 },
];

/* ════════════════════════════════════════════════════════════════════
   DIRECTION A — « Salle des marchés » : dense, contrasté, technique.
   Inter + JetBrains Mono sur les chiffres, angles nets (4-6px), accent
   indigo rare, badges à barre latérale, icônes épaisses et petites.
   ════════════════════════════════════════════════════════════════════ */

function StyleA() {
  const mono = { fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontVariantNumeric: 'tabular-nums' as const };
  return (
    <div style={{ fontFamily: '"Inter", system-ui, sans-serif', background: '#F4F4F5', minHeight: '100vh', padding: '24px 28px', color: '#09090B' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>Trésorerie</div>
          <div style={{ fontSize: 12.5, color: '#71717A', marginTop: 2 }}>Pont USDT · XAF → USDT → CNY</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ height: 32, padding: '0 13px', borderRadius: 6, border: '1px solid #D4D4D8', background: '#fff', fontSize: 12.5, fontWeight: 600, color: '#18181B' }}>↓ Achat</button>
          <button style={{ height: 32, padding: '0 13px', borderRadius: 6, border: 'none', background: '#18181B', color: '#fff', fontSize: 12.5, fontWeight: 600 }}>↑ Vente USDT</button>
        </div>
      </div>

      {/* Bandeau de chiffres — filets, pas de cartes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', background: '#fff', border: '1px solid #E4E4E7', borderRadius: 6, marginBottom: 16 }}>
        {STATS.map((s, i) => (
          <div key={s.label} style={{ padding: '12px 16px', borderLeft: i ? '1px solid #E4E4E7' : 'none' }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#71717A' }}>{s.label}</div>
            <div style={{ ...mono, fontSize: 21, fontWeight: 700, marginTop: 5, letterSpacing: '-0.02em' }}>{s.value}</div>
            <div style={{ fontSize: 10.5, color: '#A1A1AA', marginTop: 3 }}>{s.unit} · {s.hint}</div>
          </div>
        ))}
      </div>

      {/* Onglets soulignés, pas de pilules */}
      <div style={{ display: 'flex', gap: 22, borderBottom: '1px solid #E4E4E7', marginBottom: 14 }}>
        {TABS.map((t, i) => (
          <div key={t} style={{ fontSize: 13, fontWeight: i === 0 ? 600 : 500, color: i === 0 ? '#09090B' : '#71717A', paddingBottom: 9, borderBottom: i === 0 ? '2px solid #4F46E5' : '2px solid transparent' }}>{t}</div>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #E4E4E7', borderRadius: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderBottom: '1px solid #E4E4E7' }}>
          {FILTERS.map((f, i) => (
            <button key={f.label} style={{ height: 26, padding: '0 9px', borderRadius: 4, fontSize: 11.5, fontWeight: 600, border: i === 0 ? 'none' : '1px solid #E4E4E7', background: i === 0 ? '#18181B' : '#fff', color: i === 0 ? '#fff' : '#52525B' }}>
              {f.label} <span style={{ ...mono, opacity: 0.55, fontSize: 10.5 }}>{f.n}</span>
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <div style={{ height: 26, width: 210, borderRadius: 4, border: '1px solid #E4E4E7', fontSize: 11.5, color: '#A1A1AA', display: 'flex', alignItems: 'center', padding: '0 9px' }}>Rechercher…</div>
            <div style={{ height: 26, borderRadius: 4, border: '1px solid #E4E4E7', fontSize: 11.5, color: '#52525B', display: 'flex', alignItems: 'center', padding: '0 9px', fontWeight: 600 }}>30 jours ▾</div>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#FAFAFA' }}>
              {['Date', 'Type', 'Contrepartie', 'USDT', 'Contre-valeur', 'Taux', 'Compte'].map((h, i) => (
                <th key={h} style={{ textAlign: i >= 3 && i <= 5 ? 'right' : 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#71717A', padding: '8px 14px', borderBottom: '1px solid #E4E4E7' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {OPS.map((o, i) => (
              <tr key={i} style={{ opacity: o.voided ? 0.45 : 1 }}>
                <td style={{ padding: '9px 14px', borderBottom: '1px solid #F4F4F5', fontSize: 12.5 }}>
                  <span style={{ fontWeight: 500 }}>{o.date}</span>
                  <span style={{ ...mono, color: '#A1A1AA', fontSize: 11, marginLeft: 6 }}>{o.time}</span>
                </td>
                <td style={{ padding: '9px 14px', borderBottom: '1px solid #F4F4F5' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: o.kind === 'purchase' ? '#4F46E5' : '#B45309', borderLeft: `2px solid ${o.kind === 'purchase' ? '#4F46E5' : '#B45309'}`, paddingLeft: 6 }}>
                    {o.kind === 'purchase' ? 'Achat' : 'Vente'}
                  </span>
                </td>
                <td style={{ padding: '9px 14px', borderBottom: '1px solid #F4F4F5', fontSize: 12.5, fontWeight: 600, textDecoration: o.voided ? 'line-through' : 'none' }}>{o.party}</td>
                <td style={{ ...mono, padding: '9px 14px', borderBottom: '1px solid #F4F4F5', fontSize: 12.5, fontWeight: 700, textAlign: 'right' }}>{num(o.usdt)}</td>
                <td style={{ ...mono, padding: '9px 14px', borderBottom: '1px solid #F4F4F5', fontSize: 12.5, color: '#52525B', textAlign: 'right' }}>{num(o.counter, o.currency === 'XAF' ? 0 : 2)} <span style={{ color: '#A1A1AA', fontSize: 10.5 }}>{o.currency}</span></td>
                <td style={{ ...mono, padding: '9px 14px', borderBottom: '1px solid #F4F4F5', fontSize: 12.5, fontWeight: 600, textAlign: 'right' }}>{num(o.rate, o.kind === 'purchase' ? 2 : 4)}</td>
                <td style={{ padding: '9px 14px', borderBottom: '1px solid #F4F4F5', fontSize: 11.5, color: '#71717A' }}>{o.account}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   DIRECTION B — « Marque » : les trois couleurs du logo portées pour de
   vrai. Space Grotesk en titres, badges pleins, cartes franches,
   pastilles d'icône colorées. Chaud, affirmé, reconnaissable.
   ════════════════════════════════════════════════════════════════════ */

const VIO = '#6D28D9';
const AMB = '#F59E0B';
const ORA = '#EA580C';

function StyleB() {
  const head = { fontFamily: '"Space Grotesk", system-ui, sans-serif' };
  return (
    <div style={{ fontFamily: '"Inter", system-ui, sans-serif', background: '#FBFAFF', minHeight: '100vh', color: '#1A1035' }}>
      {/* Bandeau de marque */}
      <div style={{ background: `linear-gradient(100deg, ${VIO} 0%, #7C3AED 45%, ${ORA} 130%)`, padding: '22px 30px 30px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ ...head, fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>Trésorerie</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', marginTop: 3 }}>Le pont USDT — XAF → USDT → CNY</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ height: 38, padding: '0 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: 13, fontWeight: 600 }}>Achat USDT</button>
            <button style={{ height: 38, padding: '0 18px', borderRadius: 10, border: 'none', background: '#fff', color: VIO, fontSize: 13, fontWeight: 700 }}>+ Vente USDT</button>
          </div>
        </div>

        {/* Chiffres sur le bandeau */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginTop: 20 }}>
          {STATS.map((s, i) => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)' }}>{s.label}</div>
              <div style={{ ...head, fontSize: 24, fontWeight: 700, color: '#fff', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                {s.value} <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.7 }}>{s.unit}</span>
              </div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{s.hint}</div>
              <div style={{ height: 3, borderRadius: 2, marginTop: 8, background: [AMB, '#fff', VIO, ORA][i], opacity: 0.9 }} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 30px 30px', marginTop: -14 }}>
        {/* Onglets en pilules pleines */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {TABS.map((t, i) => (
            <button key={t} style={{ height: 36, padding: '0 16px', borderRadius: 999, border: 'none', background: i === 0 ? '#1A1035' : '#fff', color: i === 0 ? '#fff' : '#5B5175', fontSize: 13, fontWeight: 600, boxShadow: i === 0 ? 'none' : '0 1px 2px rgba(26,16,53,0.06)' }}>{t}</button>
          ))}
        </div>

        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDE9FE', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px', borderBottom: '1px solid #F3F0FF' }}>
            {FILTERS.map((f, i) => (
              <button key={f.label} style={{ height: 32, padding: '0 13px', borderRadius: 999, border: 'none', background: i === 0 ? VIO : '#F5F2FF', color: i === 0 ? '#fff' : '#6B5B95', fontSize: 12.5, fontWeight: 700 }}>
                {f.label} <span style={{ opacity: 0.75, marginLeft: 3 }}>{f.n}</span>
              </button>
            ))}
            <div style={{ marginLeft: 'auto', height: 32, width: 200, borderRadius: 999, background: '#F5F2FF', fontSize: 12.5, color: '#9C8FBF', display: 'flex', alignItems: 'center', padding: '0 14px' }}>Rechercher…</div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Date', 'Type', 'Contrepartie', 'USDT', 'Contre-valeur', 'Taux', 'Compte'].map((h, i) => (
                  <th key={h} style={{ textAlign: i >= 3 && i <= 5 ? 'right' : 'left', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9C8FBF', padding: '11px 18px', background: '#FBFAFF' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {OPS.map((o, i) => (
                <tr key={i} style={{ opacity: o.voided ? 0.5 : 1, borderTop: '1px solid #F3F0FF' }}>
                  <td style={{ padding: '12px 18px', fontSize: 13 }}>
                    <div style={{ fontWeight: 600 }}>{o.date}</div>
                    <div style={{ fontSize: 11, color: '#9C8FBF' }}>{o.time}</div>
                  </td>
                  <td style={{ padding: '12px 18px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 11px', borderRadius: 999, background: o.kind === 'purchase' ? VIO : AMB, color: '#fff', fontSize: 11.5, fontWeight: 700 }}>
                      <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.85)' }} />
                      {o.kind === 'purchase' ? 'Achat' : 'Vente'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 18px', fontSize: 13.5, fontWeight: 700, textDecoration: o.voided ? 'line-through' : 'none' }}>{o.party}</td>
                  <td style={{ ...head, padding: '12px 18px', fontSize: 14.5, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{num(o.usdt)}</td>
                  <td style={{ padding: '12px 18px', fontSize: 13, color: '#5B5175', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{num(o.counter, o.currency === 'XAF' ? 0 : 2)} <span style={{ color: '#9C8FBF', fontSize: 11 }}>{o.currency}</span></td>
                  <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                    <span style={{ ...head, fontSize: 13.5, fontWeight: 700, color: o.kind === 'purchase' ? VIO : ORA, fontVariantNumeric: 'tabular-nums' }}>{num(o.rate, o.kind === 'purchase' ? 2 : 4)}</span>
                  </td>
                  <td style={{ padding: '12px 18px', fontSize: 12, color: '#9C8FBF' }}>{o.account}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   DIRECTION C — « Institutionnel » : sérieux bancaire. Newsreader en
   titres, IBM Plex Sans en données, ivoire et encre marine, filets au
   lieu de cartes, angles quasi droits, couleur réservée aux signes.
   ════════════════════════════════════════════════════════════════════ */

const INK = '#16233A';

function StyleC() {
  const serif = { fontFamily: '"Newsreader", Georgia, serif' };
  const sans = { fontFamily: '"IBM Plex Sans", system-ui, sans-serif' };
  return (
    <div style={{ ...sans, background: '#FCFBF8', minHeight: '100vh', padding: '28px 34px', color: INK }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 16, borderBottom: `2px solid ${INK}` }}>
        <div>
          <div style={{ ...serif, fontSize: 27, fontWeight: 500, letterSpacing: '-0.01em' }}>Trésorerie</div>
          <div style={{ fontSize: 12.5, color: '#5A6B85', marginTop: 3 }}>Pont USDT · XAF → USDT → CNY</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ height: 34, padding: '0 16px', borderRadius: 3, border: `1px solid ${INK}`, background: 'transparent', color: INK, fontSize: 11.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Achat</button>
          <button style={{ height: 34, padding: '0 16px', borderRadius: 3, border: `1px solid ${INK}`, background: INK, color: '#FCFBF8', fontSize: 11.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Vente USDT</button>
        </div>
      </div>

      {/* Chiffres : colonnes séparées par des filets, sans carte */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', padding: '18px 0 20px', borderBottom: '1px solid #DED8CB' }}>
        {STATS.map((s, i) => (
          <div key={s.label} style={{ paddingLeft: i ? 22 : 0, borderLeft: i ? '1px solid #DED8CB' : 'none' }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7A8899' }}>{s.label}</div>
            <div style={{ ...serif, fontSize: 27, fontWeight: 500, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#7A8899', marginTop: 2 }}>{s.unit} — {s.hint}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 26, padding: '16px 0 6px' }}>
        {TABS.map((t, i) => (
          <div key={t} style={{ ...serif, fontSize: 15, fontWeight: i === 0 ? 600 : 400, color: i === 0 ? INK : '#7A8899', borderBottom: i === 0 ? `2px solid ${INK}` : 'none', paddingBottom: 3 }}>{t}</div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '14px 0', borderBottom: '1px solid #DED8CB' }}>
        {FILTERS.map((f, i) => (
          <div key={f.label} style={{ fontSize: 12, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? INK : '#5A6B85', letterSpacing: '0.02em' }}>
            {f.label} <span style={{ color: '#9AA7B8', fontVariantNumeric: 'tabular-nums' }}>({f.n})</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{ height: 30, width: 190, borderRadius: 3, border: '1px solid #DED8CB', background: '#fff', fontSize: 12, color: '#9AA7B8', display: 'flex', alignItems: 'center', padding: '0 10px' }}>Rechercher…</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: INK }}>30 jours ▾</div>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Date', 'Type', 'Contrepartie', 'USDT', 'Contre-valeur', 'Taux', 'Compte'].map((h, i) => (
              <th key={h} style={{ textAlign: i >= 3 && i <= 5 ? 'right' : 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.11em', textTransform: 'uppercase', color: '#7A8899', padding: '13px 12px 9px', borderBottom: `1px solid ${INK}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {OPS.map((o, i) => (
            <tr key={i} style={{ color: o.voided ? '#9AA7B8' : INK }}>
              <td style={{ padding: '11px 12px', borderBottom: '1px solid #EAE5DA', fontSize: 12.5 }}>
                {o.date} <span style={{ color: '#9AA7B8', fontVariantNumeric: 'tabular-nums' }}>{o.time}</span>
              </td>
              <td style={{ padding: '11px 12px', borderBottom: '1px solid #EAE5DA' }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: o.kind === 'purchase' ? '#1F5FA8' : '#8A5A11' }}>
                  {o.kind === 'purchase' ? 'Achat' : 'Vente'}
                </span>
              </td>
              <td style={{ padding: '11px 12px', borderBottom: '1px solid #EAE5DA', fontSize: 13, fontWeight: 600, textDecoration: o.voided ? 'line-through' : 'none' }}>{o.party}</td>
              <td style={{ padding: '11px 12px', borderBottom: '1px solid #EAE5DA', fontSize: 13, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{num(o.usdt)}</td>
              <td style={{ padding: '11px 12px', borderBottom: '1px solid #EAE5DA', fontSize: 12.5, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#41506B' }}>{num(o.counter, o.currency === 'XAF' ? 0 : 2)} <span style={{ color: '#9AA7B8', fontSize: 10.5 }}>{o.currency}</span></td>
              <td style={{ padding: '11px 12px', borderBottom: '1px solid #EAE5DA', fontSize: 13, fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{num(o.rate, o.kind === 'purchase' ? 2 : 4)}</td>
              <td style={{ padding: '11px 12px', borderBottom: '1px solid #EAE5DA', fontSize: 11.5, color: '#7A8899' }}>{o.account}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Montage ─────────────────────────────────────────────────────── */

const style = new URLSearchParams(window.location.search).get('style') ?? 'a';
const Chosen = style === 'b' ? StyleB : style === 'c' ? StyleC : StyleA;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Chosen />
  </StrictMode>,
);
