import { forwardRef } from 'react';
import {
  COLORS,
  DASHBOARD_ACCOUNTS,
  LAYOUT,
  PAGE,
  darken,
  formatXAF,
  formatFooterTimestamp,
  formatHeaderDate,
} from './constants';

interface Props {
  /** Map of account key → balance in XAF. */
  balances: Record<string, number>;
  /** Generation timestamp (header date + footer). */
  generatedAt: Date;
}

const FONT = "'Libre Baskerville', Georgia, serif";

function GradientLine({ width }: { width: number }) {
  return (
    <div
      style={{
        width,
        height: 2,
        background: `linear-gradient(to right, ${COLORS.gradientStart}, ${COLORS.gradientEnd})`,
      }}
    />
  );
}

function AccountCard({ account, balance }: { account: (typeof DASHBOARD_ACCOUNTS)[number]; balance: number }) {
  // All cards render at full brightness regardless of balance (zero-dimming removed per request).
  const accent = account.color;

  return (
    <div
      style={{
        position: 'relative',
        width: LAYOUT.cardWidth,
        height: LAYOUT.cardHeight,
        background: COLORS.cardBg,
        border: `0.5px solid ${COLORS.cardBorder}`,
        borderRadius: LAYOUT.cardRadius,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Left accent bar */}
      <div
        style={{
          position: 'absolute',
          left: 8,
          top: 14,
          width: 3,
          height: LAYOUT.cardHeight - 28,
          borderRadius: 1.5,
          background: accent,
        }}
      />

      {/* Logo circle */}
      <div
        style={{
          position: 'absolute',
          left: 40 - 21,
          top: 46 - 21,
          width: 42,
          height: 42,
          borderRadius: '50%',
          background: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <img
          src={account.logo}
          alt={account.name}
          style={{ width: 36, height: 36, objectFit: 'contain' }}
        />
      </div>

      {/* Name */}
      <div
        style={{
          position: 'absolute',
          left: 68,
          top: 20,
          width: LAYOUT.cardWidth - 80,
          fontFamily: FONT,
          fontWeight: 700,
          fontSize: 14,
          color: COLORS.textWhite,
          whiteSpace: 'nowrap',
        }}
      >
        {account.name}
      </div>

      {/* Type badge */}
      {(() => {
        const isMobile = account.type === 'Mobile Money';
        const badgeBg = isMobile ? COLORS.badgeMobileBg : COLORS.badgeBankBg;
        const badgeText = isMobile ? COLORS.badgeMobileText : COLORS.badgeBankText;
        const label = isMobile ? 'Mobile Money' : 'Bank';
        return (
          <div
            style={{
              position: 'absolute',
              left: 68,
              top: 44,
              height: 18,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 9px',
              borderRadius: 4,
              background: badgeBg,
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: badgeText }} />
            <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 9, color: badgeText, lineHeight: 1 }}>
              {label}
            </span>
          </div>
        );
      })()}

      {/* Balance */}
      <div style={{ position: 'absolute', left: 20, top: LAYOUT.cardHeight - 42, display: 'flex', alignItems: 'baseline' }}>
        <span
          style={{
            fontFamily: FONT,
            fontWeight: 700,
            fontSize: 22,
            color: COLORS.textWhite,
          }}
        >
          {formatXAF(balance)}
        </span>
        <span
          style={{
            fontFamily: FONT,
            fontWeight: 400,
            fontSize: 13,
            marginLeft: 4,
            color: COLORS.textMuted,
          }}
        >
          XAF
        </span>
      </div>
    </div>
  );
}

/**
 * Pixel-faithful HTML/CSS reproduction of the prototype PDF
 * (generate-dashboard-pdf.mjs). Rendered at 1pt = 1px (595×842).
 * The ref points to the root node for html-to-image capture.
 */
export const BalanceDashboardPreview = forwardRef<HTMLDivElement, Props>(function BalanceDashboardPreview(
  { balances, generatedAt },
  ref,
) {
  const total = DASHBOARD_ACCOUNTS.reduce((s, a) => s + (balances[a.key] || 0), 0);

  return (
    <div
      ref={ref}
      style={{
        width: PAGE.width,
        height: PAGE.height,
        background: COLORS.bg,
        position: 'relative',
        fontFamily: FONT,
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div style={{ position: 'absolute', top: 40, left: LAYOUT.margin, width: LAYOUT.contentWidth, textAlign: 'center' }}>
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 28, color: COLORS.textWhite, letterSpacing: 0.5 }}>
          MY ACCOUNT BALANCES
        </div>
      </div>
      <div style={{ position: 'absolute', top: 78, left: LAYOUT.margin, width: LAYOUT.contentWidth, textAlign: 'center' }}>
        <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 13, color: COLORS.textMuted }}>
          {formatHeaderDate(generatedAt)}
        </span>
      </div>
      <div style={{ position: 'absolute', top: 100, left: LAYOUT.margin }}>
        <GradientLine width={LAYOUT.contentWidth} />
      </div>

      {/* Cards grid 2×3 */}
      {DASHBOARD_ACCOUNTS.map((account, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const cx = LAYOUT.margin + col * (LAYOUT.cardWidth + LAYOUT.cardGap);
        const cy = LAYOUT.gridStartY + row * (LAYOUT.cardHeight + LAYOUT.cardGap);
        return (
          <div key={account.key} style={{ position: 'absolute', left: cx, top: cy }}>
            <AccountCard account={account} balance={balances[account.key] || 0} />
          </div>
        );
      })}

      {/* Total section */}
      {(() => {
        const lastCardBottom = LAYOUT.gridStartY + 2 * (LAYOUT.cardHeight + LAYOUT.cardGap) + LAYOUT.cardHeight;
        const startY = lastCardBottom + 30;
        const cardY = startY + 20;
        const cardH = 110;
        return (
          <>
            <div style={{ position: 'absolute', top: startY, left: LAYOUT.margin }}>
              <GradientLine width={LAYOUT.contentWidth} />
            </div>
            <div
              style={{
                position: 'absolute',
                top: cardY,
                left: LAYOUT.margin,
                width: LAYOUT.contentWidth,
                height: cardH,
                background: COLORS.totalCardBg,
                border: `1px solid ${COLORS.totalCardBorder}`,
                borderRadius: LAYOUT.cardRadius,
                boxSizing: 'border-box',
                borderTop: `3px solid ${darken(COLORS.greenAccent, 0.3)}`,
              }}
            >
              <div style={{ width: '100%', textAlign: 'center', marginTop: 20 }}>
                <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 13, color: COLORS.textMuted, letterSpacing: 1 }}>
                  TOTAL BALANCE
                </span>
              </div>
              <div style={{ width: '100%', textAlign: 'center', marginTop: 8, display: 'flex', alignItems: 'baseline', justifyContent: 'center' }}>
                <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 38, color: COLORS.textWhite }}>
                  {formatXAF(total)}
                </span>
                <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 20, color: COLORS.greenAccent, marginLeft: 6 }}>
                  XAF
                </span>
              </div>
            </div>
          </>
        );
      })()}

      {/* Footer */}
      <div style={{ position: 'absolute', bottom: 22, left: LAYOUT.margin, width: LAYOUT.contentWidth, textAlign: 'center' }}>
        <span style={{ fontFamily: FONT, fontWeight: 400, fontSize: 8, color: COLORS.textVeryDim }}>
          Automatically generated document  —  Bonzini  —  {formatFooterTimestamp(generatedAt)}
        </span>
      </div>
    </div>
  );
});
