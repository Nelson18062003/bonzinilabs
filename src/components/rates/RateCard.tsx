import { Link } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { ChevronRight } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatNumber } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';

// ============================================================
// RateCard — Composant partagé "Taux du jour" (Admin + Client)
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

// Payment method display config (fixed colors, maquette icons)
const METHODS = [
  { key: 'rate_alipay' as const, label: 'Alipay', icon: '支', color: '#1677ff' },
  { key: 'rate_wechat' as const, label: 'WeChat', icon: '微', color: '#07c160' },
  { key: 'rate_virement' as const, label: 'Virement', icon: '🏦', color: '#8b5cf6' },
  { key: 'rate_cash' as const, label: 'Cash', icon: '¥', color: '#dc2626' },
];

// Theme tokens matching maquette exactly
const TOKENS = {
  light: {
    cardBg: '#ffffff',
    cardBorder: '#eeeeee',
    cardShadow: '0 1px 4px rgba(0,0,0,0.03)',
    cellBg: '#f9f9fb',
    titleColor: '#9ca3af',
    subtitleColor: '#1a1a2e',
    labelColor: '#9ca3af',
    rateColor: '#1a1a2e',
    footerColor: '#c4c7ce',
    footerSep: '#f3f3f3',
    detailBg: '#f3f0ff',
    detailColor: '#7c3aed',
  },
  dark: {
    cardBg: '#13152a',
    cardBorder: 'rgba(124,58,237,0.12)',
    cardShadow: 'none',
    cellBg: 'rgba(255,255,255,0.03)',
    titleColor: 'rgba(255,255,255,0.35)',
    subtitleColor: '#ffffff',
    labelColor: 'rgba(255,255,255,0.35)',
    rateColor: '#ffffff',
    footerColor: 'rgba(255,255,255,0.2)',
    footerSep: 'rgba(255,255,255,0.04)',
    detailBg: 'rgba(124,58,237,0.1)',
    detailColor: '#7c3aed',
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

  // --- Loading state ---
  if (isLoading) {
    return (
      <div
        className={className}
        style={{
          background: t.cardBg,
          border: `1px solid ${t.cardBorder}`,
          boxShadow: t.cardShadow,
          borderRadius: 14,
          padding: '12px 14px',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-4 w-32 mb-3" />
        <div className="grid grid-cols-2" style={{ gap: 6 }}>
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} className="h-14" style={{ borderRadius: 10 }} />
          ))}
        </div>
      </div>
    );
  }

  // --- No rates configured ---
  if (!rates) {
    return (
      <div
        className={className}
        style={{
          background: t.cardBg,
          border: `1px solid ${t.cardBorder}`,
          boxShadow: t.cardShadow,
          borderRadius: 14,
          padding: '12px 14px',
        }}
      >
        <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: t.titleColor }}>
          Taux du jour
        </p>
        <p style={{ fontSize: 13, color: t.labelColor, fontStyle: 'italic', marginTop: 8 }}>
          Taux non configurés
        </p>
      </div>
    );
  }

  // --- Main render ---
  return (
    <Link to={detailsHref} className={className} style={{ display: 'block', textDecoration: 'none' }}>
      <div
        style={{
          background: t.cardBg,
          border: `1px solid ${t.cardBorder}`,
          boxShadow: t.cardShadow,
          borderRadius: 14,
          padding: '12px 14px',
          transition: 'transform 150ms',
        }}
        className="active:scale-[0.98]"
      >
        {/* Header: title + details button */}
        <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: t.titleColor }}>
            Taux du jour
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: t.detailColor,
              background: t.detailBg,
              borderRadius: 8,
              padding: '3px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            Détails
            <ChevronRight style={{ width: 12, height: 12 }} />
          </span>
        </div>

        {/* Subtitle */}
        <p style={{ fontSize: 12, fontWeight: 500, color: t.subtitleColor, marginBottom: 8 }}>
          1 000 000 XAF =
        </p>

        {/* 2x2 rate grid */}
        <div className="grid grid-cols-2" style={{ gap: 6 }}>
          {METHODS.map(m => {
            const rate = rates[m.key];
            return (
              <div
                key={m.key}
                style={{
                  background: t.cellBg,
                  borderRadius: 10,
                  padding: '8px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {/* Icon badge */}
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: `${m.color}18`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    color: m.color,
                    flexShrink: 0,
                  }}
                >
                  {m.icon}
                </div>

                {/* Label + rate */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: t.labelColor, lineHeight: 1.2 }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: t.rateColor, lineHeight: 1.3 }}>
                    ¥{formatNumber(Math.round(rate))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer: updated at */}
        <div
          style={{
            borderTop: `1px solid ${t.footerSep}`,
            marginTop: 8,
            paddingTop: 6,
          }}
        >
          <p style={{ fontSize: 10, color: t.footerColor, textAlign: 'center', margin: 0 }}>
            {effectiveAt ? formatUpdatedAt(effectiveAt) : 'Taux non configurés'}
          </p>
        </div>
      </div>
    </Link>
  );
}
