/**
 * DEV-ONLY — maquettes du futur flyer « Taux du jour » (phase 13, à valider).
 * Rien ici n'est branché dans l'app : le harnais les rend en PNG
 * (/rate-flyer-v2.html?variant=…&country=…).
 *
 * Ce qui change par rapport au flyer actuel (RateFlyer.tsx) :
 *   · un flyer PAR PAYS (le pays en très gros, en tête) ;
 *   · le MONTANT compte : les paliers de rate_adjustments donnent une colonne
 *     par tranche (aujourd'hui « 400 000 XAF et plus » et « moins de 400 000
 *     XAF ») — tranches voisines au même pourcentage fusionnées ;
 *   · au seul nom de NORTON GAUSS BONZINI SARL : ni logo ni nom « Bonzini »,
 *     ni site, ni WhatsApp, ni heure de Guangzhou, ni chinois ;
 *   · la date de la publication, pas l'heure du téléphone.
 * Mêmes calculs que la RPC calculate_final_rate : base × (1 + pays) × (1 + palier),
 * arrondi à l'entier comme le flyer actuel.
 */
import type { CSSProperties, ReactNode } from 'react';
import { Landmark } from 'lucide-react';
import { LOGO_PATH } from '@/mobile/designKit/methods';
import { flagUrl } from '@/components/form/CountryFlag';

export const LEGAL_NAME = 'NORTON GAUSS BONZINI SARL';

// ── Données : les chiffres de production du 24/09/2026 ─────────────────────
export type MethodKey = 'alipay' | 'wechat' | 'virement' | 'cash';
export type Base = Record<MethodKey, number>;
export interface Tier { key: string; min: number; pct: number }
export interface Country { key: string; label: string; iso: string; pct: number }

export const BASE_2409: Base = { alipay: 10800, wechat: 10800, virement: 10800, cash: 10700 };
export const TIERS_2409: Tier[] = [
  { key: 't1', min: 0, pct: -2 },
  { key: 't2', min: 400_000, pct: 0 },
  { key: 't3', min: 1_000_000, pct: 0 },
];
export const COUNTRIES_2409: Country[] = [
  { key: 'cameroun', label: 'Cameroun', iso: 'CM', pct: 0 },
  { key: 'gabon', label: 'Gabon', iso: 'GA', pct: -1 },
  { key: 'tchad', label: 'Tchad', iso: 'TD', pct: -1 },
  { key: 'rca', label: 'Centrafrique', iso: 'CF', pct: -1 },
  { key: 'congo', label: 'Congo', iso: 'CG', pct: -1 },
  { key: 'guinee', label: 'Guinée équatoriale', iso: 'GQ', pct: -1 },
];
export const DATE_2409 = 'Jeudi 24 septembre 2026';

const METHODS: { key: MethodKey; label: string }[] = [
  { key: 'alipay', label: 'Alipay' },
  { key: 'wechat', label: 'WeChat Pay' },
  { key: 'virement', label: 'Virement' },
  { key: 'cash', label: 'Cash' },
];

export interface Bracket { min: number; max: number | null; pct: number; label: string; lines: [string, string] }

export function fmt(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
}

/**
 * Les tranches de montant, de la plus haute (le taux de référence) à la plus
 * basse. Deux paliers voisins au même pourcentage n'en font qu'une : t2 et t3
 * valent 0 % aujourd'hui, donc « 400 000 XAF et plus ».
 */
export function brackets(tiers: Tier[]): Bracket[] {
  const asc = tiers.slice().sort((a, b) => a.min - b.min);
  const merged: { min: number; pct: number }[] = [];
  for (const t of asc) {
    const last = merged[merged.length - 1];
    if (last && last.pct === t.pct) continue;
    merged.push({ min: t.min, pct: t.pct });
  }
  const out: Bracket[] = merged.map((b, i) => {
    const next = merged[i + 1];
    const max = next ? next.min - 1 : null;
    let label: string;
    let lines: [string, string];
    if (merged.length === 1) { label = 'Tous montants'; lines = ['Tous', 'montants']; }
    else if (max === null) { label = `${fmt(b.min)} XAF et plus`; lines = [`${fmt(b.min)} XAF`, 'et plus']; }
    else if (b.min === 0) { label = `Moins de ${fmt(next!.min)} XAF`; lines = ['Moins de', `${fmt(next!.min)} XAF`]; }
    else { label = `De ${fmt(b.min)} à ${fmt(max)} XAF`; lines = [`${fmt(b.min)} à`, `${fmt(max)} XAF`]; }
    return { min: b.min, max, pct: b.pct, label, lines };
  });
  return out.reverse();
}

export function exactRate(base: Base, method: MethodKey, countryPct: number, tierPct: number): number {
  return Math.round(base[method] * (1 + countryPct / 100) * (1 + tierPct / 100) * 100) / 100;
}

export function rateFor(base: Base, method: MethodKey, countryPct: number, tierPct: number): number {
  return Math.round(exactRate(base, method, countryPct, tierPct));
}

/** Les modes au même taux (Alipay, WeChat, Virement le sont 134 jours sur 137) se regroupent. */
export function methodGroups(base: Base): { keys: MethodKey[]; label: string }[] {
  const groups: { keys: MethodKey[]; label: string }[] = [];
  for (const m of METHODS) {
    const g = groups.find((x) => base[x.keys[0]] === base[m.key] && m.key !== 'cash' && !x.keys.includes('cash'));
    if (g) g.keys.push(m.key);
    else groups.push({ keys: [m.key], label: m.label });
  }
  for (const g of groups) g.label = g.keys.map((k) => METHODS.find((m) => m.key === k)!.label).join(' · ');
  return groups;
}

// ── Style ────────────────────────────────────────────────────────────────
const INK = '#1a1028';
const TEXT = '#1a1028';
const MUTED = '#5f5775';
const SOFT = '#d6d0e0';
const LINE = '#e6e1ee';
const PAPER = '#ffffff';
const SHEET = '#f5f3f8';
const GOLD = '#f3a745';
const GOLD_DEEP = '#a8620a';
const NUM: CSSProperties = { fontVariantNumeric: 'tabular-nums' };
const FONT = '"DM Sans", sans-serif';

function Tile({ method, size }: { method: MethodKey; size: number }) {
  const r = Math.round(size * 0.26);
  const box = (bg: string, child: ReactNode, ring = false) => (
    <div style={{ width: size, height: size, borderRadius: r, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: ring ? `inset 0 0 0 2px ${LINE}` : undefined }}>{child}</div>
  );
  if (method === 'alipay') return box('#FFFFFF', <svg viewBox="0 0 24 24" width={size * 0.64} height={size * 0.64} fill="#1677FF"><path d={LOGO_PATH.alipay} /></svg>, true);
  if (method === 'wechat') return box('#07C160', <svg viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58} fill="#FFFFFF"><path d={LOGO_PATH.wechat} /></svg>);
  if (method === 'cash') return box('#E0322B', <span style={{ fontSize: size * 0.58, fontWeight: 900, color: '#fff', lineHeight: 1 }}>¥</span>);
  return box('#ECE8F6', <Landmark color={INK} width={size * 0.5} height={size * 0.5} strokeWidth={1.9} />);
}

function Flag({ iso, w }: { iso: string; w: number }) {
  const url = flagUrl(iso);
  return url ? <img src={url} alt="" width={w} height={Math.round((w * 3) / 4)} style={{ borderRadius: Math.round(w * 0.12), boxShadow: `0 0 0 2px ${LINE}`, flexShrink: 0, objectFit: 'cover' }} /> : null;
}

/** L'en-tête commun : la raison sociale, « Taux du jour », le pays, la date. */
function Head({ country, date }: { country: Country; date: string }) {
  return (
    <>
      <div style={{ background: INK, padding: '40px 64px 38px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '0.2em', color: SOFT }}>{LEGAL_NAME}</div>
        <div style={{ fontSize: 88, fontWeight: 900, letterSpacing: -2, color: '#fff', lineHeight: 1, marginTop: 16 }}>Taux du jour</div>
        <div style={{ fontSize: 34, fontWeight: 700, color: GOLD, marginTop: 14 }}>{date}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 30, padding: '38px 64px 0' }}>
        <Flag iso={country.iso} w={116} />
        <div style={{ fontSize: country.label.length > 12 ? 68 : 84, fontWeight: 900, letterSpacing: -2, color: TEXT, lineHeight: 1 }}>{country.label}</div>
      </div>
    </>
  );
}

function Foot({ children }: { children?: ReactNode }) {
  return (
    <div style={{ marginTop: 'auto', padding: '0 64px 46px' }}>
      <div style={{ borderTop: `2px solid ${LINE}`, paddingTop: 26, fontSize: 26, lineHeight: 1.4, color: MUTED }}>
        {children ?? 'Taux valables ce jour. Le taux est confirmé au moment du paiement.'}
      </div>
    </div>
  );
}

/**
 * L'accroche. « Pour 1 000 000 XAF, votre fournisseur reçoit » se contredisait
 * au-dessus d'une colonne « moins de 400 000 XAF » : on dit l'unité, puis
 * pourquoi il y a deux colonnes.
 */
function Lead({ split }: { split: boolean }) {
  return (
    <div style={{ padding: '22px 64px 0', fontSize: 31, fontWeight: 500, color: MUTED, lineHeight: 1.3 }}>
      En ¥ pour <b style={{ color: TEXT, fontWeight: 800 }}>1&nbsp;000&nbsp;000 XAF</b>{split ? ', selon le montant de votre paiement' : ''}&nbsp;:
    </div>
  );
}

/** Un exemple chiffré sous la petite tranche : « 200 000 XAF → 2 096 ¥ ». */
function example(b: Bracket, rate: number): string | null {
  if (b.min !== 0 || b.max === null) return null;
  const amount = b.max + 1 >= 400_000 ? 200_000 : Math.round((b.max + 1) / 2 / 10_000) * 10_000;
  return `${fmt(amount)} XAF → ${fmt((amount * rate) / 1_000_000)} ¥`;
}

export interface FlyerProps { country: Country; base: Base; tiers: Tier[]; date: string }

/**
 * VARIANTE A — « Le tableau » : les 4 modes en lignes, une colonne par
 * tranche de montant. Tout est toujours à la même place.
 */
export function FlyerTable({ country, base, tiers, date }: FlyerProps) {
  const bs = brackets(tiers);
  const colW = bs.length > 2 ? [230, 180, 180] : bs.length === 2 ? [280, 214] : [330];
  return (
    <div style={{ width: 1080, height: 1350, background: PAPER, display: 'flex', flexDirection: 'column', fontFamily: FONT }}>
      <Head country={country} date={date} />
      <Lead split={bs.length > 1} />
      <div style={{ margin: '26px 40px 0', background: SHEET, borderRadius: 40, padding: '24px 24px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', padding: '0 22px 16px', gap: 24 }}>
          <div style={{ flex: 1, fontSize: 24, fontWeight: 700, color: MUTED, lineHeight: 1.2 }}>Vous payez&nbsp;:</div>
          {bs.map((b, i) => (
            <div key={b.label} style={{ width: colW[i], textAlign: 'right', fontSize: 26, fontWeight: 800, lineHeight: 1.18, color: i === 0 ? TEXT : GOLD_DEEP }}>
              {b.lines[0]}<br />{b.lines[1]}
            </div>
          ))}
        </div>
        {METHODS.map((m) => (
          <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 24, background: PAPER, borderRadius: 28, padding: '20px 22px', marginBottom: 14 }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 22 }}>
              <Tile method={m.key} size={84} />
              <div style={{ fontSize: 42, fontWeight: 800, color: TEXT, letterSpacing: -0.5, whiteSpace: 'nowrap' }}>{m.label}</div>
            </div>
            {bs.map((b, i) => (
              <div key={b.label} style={{ width: colW[i], display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 6 }}>
                <span style={{ ...NUM, fontSize: i === 0 ? 72 : 52, fontWeight: 900, letterSpacing: -1, color: i === 0 ? TEXT : MUTED, lineHeight: 1 }}>{fmt(rateFor(base, m.key, country.pct, b.pct))}</span>
                <span style={{ fontSize: i === 0 ? 34 : 26, fontWeight: 800, color: i === 0 ? TEXT : MUTED }}>¥</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <Foot />
    </div>
  );
}

/**
 * VARIANTE B — « L'essentiel » : les modes au même taux sur une seule carte
 * (Alipay · WeChat Pay · Virement le sont presque toujours), le cash à part.
 * Deux cartes, quatre chiffres. Si un jour les taux divergent, les cartes se
 * séparent d'elles-mêmes.
 */
export function FlyerEssential({ country, base, tiers, date }: FlyerProps) {
  const bs = brackets(tiers);
  const groups = methodGroups(base);
  // Plus de deux taux différents ce jour-là : le tableau, qui les montre tous.
  if (groups.length > 2) return <FlyerTable country={country} base={base} tiers={tiers} date={date} />;
  return (
    <div style={{ width: 1080, height: 1350, background: PAPER, display: 'flex', flexDirection: 'column', fontFamily: FONT }}>
      <Head country={country} date={date} />
      <Lead split={bs.length > 1} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, margin: '26px 40px 0' }}>
        {groups.map((g) => (
          <div key={g.label} style={{ background: SHEET, borderRadius: 40, padding: '24px 28px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {g.keys.map((k) => <Tile key={k} method={k} size={64} />)}
              <div style={{ marginLeft: 10, fontSize: g.keys.length > 1 ? 34 : 42, fontWeight: 800, color: TEXT, letterSpacing: -0.3, whiteSpace: 'nowrap' }}>{g.label}</div>
            </div>
            <div style={{ display: 'flex', marginTop: 18, gap: 18 }}>
              {bs.map((b, i) => (
                <div key={b.label} style={{ flex: i === 0 ? 1.3 : 1, minWidth: 0, background: i === 0 ? PAPER : 'transparent', borderRadius: 28, padding: i === 0 ? '16px 24px 18px' : '16px 6px 18px', boxShadow: i === 0 ? `0 0 0 2px ${LINE}` : undefined }}>
                  <div style={{ fontSize: 25, fontWeight: 800, color: i === 0 ? TEXT : GOLD_DEEP, whiteSpace: 'nowrap' }}>{b.label}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                    <span style={{ ...NUM, fontSize: bs.length > 2 ? 72 : i === 0 ? 108 : 76, fontWeight: 900, letterSpacing: -2, color: i === 0 ? TEXT : MUTED, lineHeight: 1 }}>{fmt(rateFor(base, g.keys[0], country.pct, b.pct))}</span>
                    <span style={{ fontSize: i === 0 ? 44 : 32, fontWeight: 800, color: i === 0 ? TEXT : MUTED }}>¥</span>
                  </div>
                  {example(b, exactRate(base, g.keys[0], country.pct, b.pct)) && (
                    <div style={{ ...NUM, fontSize: 24, fontWeight: 700, color: MUTED, marginTop: 10, whiteSpace: 'nowrap' }}>Ex. {example(b, exactRate(base, g.keys[0], country.pct, b.pct))}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Foot />
    </div>
  );
}
