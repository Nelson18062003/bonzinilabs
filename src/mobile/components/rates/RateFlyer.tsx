// RateFlyer — le flyer « Taux du jour » d'UN pays, 1080×1350 px en taille
// naturelle (exporté en 2160×2700), réduit via transform:scale dans le parent.
//
// Design validé par le fondateur le 24/09/2026 (« simple + bloc rouge ») :
// raison sociale NORTON GAUSS BONZINI SARL en tête — ni « Bonzini », ni
// site, ni WhatsApp, ni heure de Guangzhou —, le pays en très gros,
// « Pour 1 000 000 XAF, votre fournisseur reçoit : », un gros chiffre par
// carte, et les petits paiements dans un bloc ROUGE qu'on ne peut pas rater.
// Les chiffres viennent de buildFlyerData (src/lib/rateFlyer.ts).
import type { CSSProperties, ReactNode } from 'react';
import { Landmark } from 'lucide-react';
import { LOGO_PATH } from '@/mobile/designKit/methods';
import { flagUrl } from '@/components/form/CountryFlag';
import { LEGAL_NAME } from '@/lib/companyIdentity';
import { formatFlyerNumber as fmt, smallPaymentTitle } from '@/lib/rateFlyer';
import type { FlyerData } from '@/lib/rateFlyer';
import type { PaymentMethodKey } from '@/types/rates';

export const FLYER_WIDTH = 1080;
export const FLYER_HEIGHT = 1350;

const INK = '#1a1028';
const MUTED = '#5f5775';
const SOFT = '#d6d0e0';
const LINE = '#e6e1ee';
const SHEET = '#f5f3f8';
const GOLD = '#f3a745';
const ALERT = '#D7261E';
const NUM: CSSProperties = { fontVariantNumeric: 'tabular-nums' };

function Tile({ method, size }: { method: PaymentMethodKey; size: number }) {
  const box = (bg: string, child: ReactNode, ring = false) => (
    <div style={{ width: size, height: size, borderRadius: Math.round(size * 0.26), background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: ring ? `inset 0 0 0 2px ${LINE}` : undefined }}>{child}</div>
  );
  if (method === 'alipay') return box('#FFFFFF', <svg viewBox="0 0 24 24" width={size * 0.64} height={size * 0.64} fill="#1677FF"><path d={LOGO_PATH.alipay} /></svg>, true);
  if (method === 'wechat') return box('#07C160', <svg viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58} fill="#FFFFFF"><path d={LOGO_PATH.wechat} /></svg>);
  if (method === 'cash') return box('#E0322B', <span style={{ fontSize: size * 0.58, fontWeight: 900, color: '#fff', lineHeight: 1 }}>¥</span>);
  return box('#ECE8F6', <Landmark color={INK} width={size * 0.5} height={size * 0.5} strokeWidth={1.9} />);
}

/** Une ligne « modes · taux » des jours chargés (compact). */
function Row({ keys, label, rate, size, onRed }: { keys: PaymentMethodKey[]; label: string; rate: number; size: number; onRed?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {!onRed && keys.map((k) => <Tile key={k} method={k} size={40} />)}
      <div style={{ flex: 1, minWidth: 0, fontSize: onRed ? 26 : 30, fontWeight: 800, marginLeft: onRed ? 0 : 6, whiteSpace: 'nowrap', opacity: onRed ? 0.95 : 1 }}>{label}</div>
      <span style={{ ...NUM, fontSize: size, fontWeight: 900, letterSpacing: -1.5, lineHeight: 1 }}>{fmt(rate)}</span>
      <span style={{ fontSize: Math.round(size * 0.45), fontWeight: 800, alignSelf: 'flex-end', marginBottom: 4 }}>¥</span>
    </div>
  );
}

export function RateFlyer({ data }: { data: FlyerData }) {
  const { country, date, brackets, groups } = data;
  const small = brackets.slice(1);
  // Plus de deux taux différents ce jour-là (rare) : quatre cartes plus petites, sur deux lignes.
  const many = groups.length > 2;
  // Jour chargé (3 taux différents avec des petits paiements, ou plusieurs tranches de
  // petits paiements) : tout en lignes, pour tenir dans la page.
  const compact = (many && small.length > 0) || small.length > 1;
  const flag = flagUrl(country.iso);
  // Sans petits paiements (un seul taux) : les cartes l'une sous l'autre, chiffres plus grands.
  const stacked = small.length === 0 && !many;
  const bigSize = stacked ? 156 : many ? 76 : 100;
  const redSize = small.length > 1 || many ? 56 : 84;

  return (
    <div style={{ width: FLYER_WIDTH, height: FLYER_HEIGHT, background: '#ffffff', display: 'flex', flexDirection: 'column', fontFamily: '"DM Sans", sans-serif', color: INK }}>
      {/* En-tête : la raison sociale, « Taux du jour », la date */}
      <div style={{ background: INK, padding: '40px 64px 38px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '0.2em', color: SOFT }}>{LEGAL_NAME}</div>
        <div style={{ fontSize: 88, fontWeight: 900, letterSpacing: -2, color: '#fff', lineHeight: 1, marginTop: 16 }}>Taux du jour</div>
        <div style={{ fontSize: 34, fontWeight: 700, color: GOLD, marginTop: 14 }}>{date}</div>
      </div>

      {/* Le pays */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 30, padding: '36px 64px 0', flexShrink: 0 }}>
        {flag && <img src={flag} alt="" width={116} height={87} style={{ borderRadius: 14, boxShadow: `0 0 0 2px ${LINE}`, flexShrink: 0, objectFit: 'cover' }} />}
        <div style={{ fontSize: country.label.length > 12 ? 68 : 84, fontWeight: 900, letterSpacing: -2, lineHeight: 1 }}>{country.label}</div>
      </div>

      <div style={{ padding: '22px 64px 0', fontSize: 36, fontWeight: 600, color: MUTED, flexShrink: 0 }}>
        Pour <b style={{ color: INK, fontWeight: 900 }}>1&nbsp;000&nbsp;000 XAF</b>, votre fournisseur reçoit&nbsp;:
      </div>

      {compact ? (
        <>
          <div style={{ margin: '18px 40px 0', background: SHEET, borderRadius: 32, padding: '16px 28px', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
            {groups.map((g) => <Row key={g.label} keys={g.keys} label={g.label} rate={g.rates[0]} size={60} />)}
          </div>
          {small.map((b, bi) => (
            <div key={b.label} style={{ margin: '14px 40px 0', background: ALERT, borderRadius: 32, padding: '16px 28px 18px', color: '#fff', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 20, background: '#fff', color: ALERT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900, flexShrink: 0 }}>!</div>
                <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: -0.5 }}>{smallPaymentTitle(b)}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                {groups.map((g) => <Row key={g.label} keys={g.keys} label={g.label} rate={g.rates[bi + 1]} size={44} onRed />)}
              </div>
            </div>
          ))}
        </>
      ) : (
        <>
      {/* Le taux normal : un gros chiffre par carte */}
          <div style={{ display: 'flex', flexDirection: stacked ? 'column' : 'row', flexWrap: 'wrap', gap: many ? 14 : 20, margin: '22px 40px 0', flexShrink: 0 }}>
            {groups.map((g) => (
              <div key={g.label} style={{ flex: many ? '1 1 calc(50% - 7px)' : 1, minWidth: 0, background: SHEET, borderRadius: 36, padding: many ? '16px 24px 18px' : '24px 26px 26px', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {g.keys.map((k) => <Tile key={k} method={k} size={many ? 40 : stacked ? 64 : 52} />)}
                  {stacked && <div style={{ marginLeft: 12, fontSize: g.keys.length > 1 ? 36 : 44, fontWeight: 800, whiteSpace: 'nowrap' }}>{g.label}</div>}
                </div>
                {!stacked && <div style={{ fontSize: 27, fontWeight: 800, marginTop: many ? 8 : 12, whiteSpace: 'nowrap' }}>{g.label}</div>}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: many ? 4 : 8 }}>
                  <span style={{ ...NUM, fontSize: bigSize, fontWeight: 900, letterSpacing: -3, lineHeight: 1 }}>{fmt(g.rates[0])}</span>
                  <span style={{ fontSize: Math.round(bigSize * 0.44), fontWeight: 800 }}>¥</span>
                </div>
              </div>
            ))}
          </div>

          {/* Les petits paiements : en rouge, impossible à rater */}
          {small.map((b, bi) => (
            <div key={b.label} style={{ margin: `${bi === 0 ? 24 : 14}px 40px 0`, background: ALERT, borderRadius: 36, padding: small.length > 1 ? '18px 30px 20px' : '26px 34px 30px', color: '#fff', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 52, height: 52, borderRadius: 26, background: '#fff', color: ALERT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, fontWeight: 900, flexShrink: 0 }}>!</div>
                <div style={{ fontSize: small.length > 1 ? 34 : 40, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1.1 }}>
                  {smallPaymentTitle(b)}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: small.length > 1 ? 12 : 20 }}>
                {groups.map((g) => (
                  <div key={g.label} style={{ flex: many ? '1 1 calc(50% - 7px)' : 1, minWidth: 0, background: 'rgba(255,255,255,0.14)', borderRadius: 26, padding: small.length > 1 || many ? '10px 20px 12px' : '16px 22px 18px', boxSizing: 'border-box' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, whiteSpace: 'nowrap', opacity: 0.95 }}>{g.label}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                      <span style={{ ...NUM, fontSize: redSize, fontWeight: 900, letterSpacing: -2, lineHeight: 1 }}>{fmt(g.rates[bi + 1])}</span>
                      <span style={{ fontSize: Math.round(redSize * 0.45), fontWeight: 800 }}>¥</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      <div style={{ marginTop: 'auto', padding: compact ? '0 64px 32px' : '0 64px 46px', flexShrink: 0 }}>
        <div style={{ borderTop: `2px solid ${LINE}`, paddingTop: compact ? 18 : 26, fontSize: 26, lineHeight: 1.4, color: MUTED }}>
          Taux valables ce jour. Le taux est confirmé au moment du paiement.
        </div>
      </div>
    </div>
  );
}
