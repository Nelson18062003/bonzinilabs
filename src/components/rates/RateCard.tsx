import { Link } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { format, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatNumber } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';

// ============================================================
// RateCard — Composant partagé "Taux du jour" (Admin + Client)
// Reproduit exactement la maquette maquette_taux_4themes.jsx
// ============================================================

interface RateCardProps {
  rates: {
    rate_cash: number;
    rate_alipay: number;
    rate_wechat: number;
    rate_virement: number;
  } | null;
  effectiveAt?: string;
  isLoading?: boolean;
  detailsHref: string;
  className?: string;
}

const METHODS = [
  { key: 'rate_alipay' as const, label: 'Alipay', icon: '支', color: '#1677ff' },
  { key: 'rate_wechat' as const, label: 'WeChat', icon: '微', color: '#07c160' },
  { key: 'rate_virement' as const, label: 'Virement', icon: '🏦', color: '#8b5cf6' },
  { key: 'rate_cash' as const, label: 'Cash', icon: '¥', color: '#dc2626' },
];

// Theme tokens — exact match with maquette_taux_4themes.jsx
const TOKENS = {
  light: {
    cardBg: '#ffffff',
    cardBorder: '#eee',
    cardShadow: '0 1px 4px rgba(0,0,0,0.03)',
    cellBg: '#f9f9fb',
    titleColor: '#9ca3af',
    mainText: '#1a1a2e',
    equalSign: '#d1d5db',
    labelColor: '#9ca3af',
    btnBg: '#f3f0ff',
    footerBorder: '#f3f3f3',
    footerText: '#c4c7ce',
    iconBgAlpha: '10',
  },
  dark: {
    cardBg: '#13152a',
    cardBorder: 'rgba(124,58,237,0.12)',
    cardShadow: 'none',
    cellBg: 'rgba(255,255,255,0.03)',
    titleColor: 'rgba(255,255,255,0.3)',
    mainText: '#fff',
    equalSign: 'rgba(255,255,255,0.25)',
    labelColor: 'rgba(255,255,255,0.35)',
    btnBg: 'rgba(124,58,237,0.1)',
    footerBorder: 'rgba(255,255,255,0.04)',
    footerText: 'rgba(255,255,255,0.2)',
    iconBgAlpha: '15',
  },
} as const;

function formatUpdatedAt(dateStr: string): string {
  const d = new Date(dateStr);
  const time = format(d, 'HH:mm');
  if (isToday(d)) {
    return `Mis à jour aujourd'hui à ${time}`;
  }
  return `Mis à jour le ${format(d, 'd MMMM', { locale: fr })} à ${time}`;
}

export function RateCard({ rates, effectiveAt, isLoading, detailsHref, className }: RateCardProps) {
  const { resolvedTheme } = useTheme();
  const t = TOKENS[resolvedTheme === 'dark' ? 'dark' : 'light'];

  const cardStyle = {
    background: t.cardBg,
    borderRadius: 14,
    padding: '12px 14px',
    border: `1px solid ${t.cardBorder}`,
    boxShadow: t.cardShadow,
  };

  // --- Loading state ---
  if (isLoading) {
    return (
      <div className={className} style={cardStyle}>
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-4 w-32 mb-3" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} style={{ height: 48, borderRadius: 10 }} />
          ))}
        </div>
      </div>
    );
  }

  // --- No rates configured ---
  if (!rates) {
    return (
      <div className={className} style={cardStyle}>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.titleColor, textTransform: 'uppercase', letterSpacing: 1.2 }}>
          Taux du jour
        </div>
        <p style={{ fontSize: 13, color: t.labelColor, fontStyle: 'italic', marginTop: 8 }}>
          Taux non configurés
        </p>
      </div>
    );
  }

  // --- Main render ---
  return (
    <Link to={detailsHref} className={className} style={{ display: 'block', textDecoration: 'none' }}>
      <div style={{ ...cardStyle, transition: 'transform 150ms' }} className="active:scale-[0.98]">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.titleColor, textTransform: 'uppercase', letterSpacing: 1.2 }}>
              Taux du jour
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: t.mainText, marginTop: 2 }}>
              1 000 000 XAF <span style={{ color: t.equalSign, fontWeight: 500 }}>=</span>
            </div>
          </div>
          <div style={{
            fontSize: 11, fontWeight: 600, color: '#7c3aed',
            padding: '5px 10px', borderRadius: 7, background: t.btnBg,
          }}>
            Détails →
          </div>
        </div>

        {/* Grid 2×2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {METHODS.map(m => {
            const rate = rates[m.key];
            return (
              <div
                key={m.key}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '8px 10px', borderRadius: 10,
                  background: t.cellBg,
                }}
              >
                {/* Icon badge */}
                <span
                  style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: `${m.color}${t.iconBgAlpha}`,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: m.color, fontWeight: 700, flexShrink: 0,
                  }}
                >
                  {m.icon}
                </span>

                {/* Label + rate */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: t.labelColor, lineHeight: 1 }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: t.mainText, letterSpacing: '-0.3px', lineHeight: 1.2, marginTop: 1 }}>
                    ¥{formatNumber(Math.round(rate))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 8, paddingTop: 8,
          borderTop: `1px solid ${t.footerBorder}`,
          fontSize: 10, color: t.footerText, fontWeight: 500,
        }}>
          {effectiveAt ? formatUpdatedAt(effectiveAt) : 'Taux non configurés'}
        </div>
      </div>
    </Link>
  );
}
