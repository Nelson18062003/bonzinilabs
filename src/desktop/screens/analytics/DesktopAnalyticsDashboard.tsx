/**
 * Desktop admin — analytics dashboard.
 *
 * The analytics screen is already built on responsive primitives (KpiRow with
 * desktop column counts, ChartCard, `md:` grids, ResponsiveContainer charts) and
 * uses its own toolbar header — not the mobile back-bar. On desktop it simply
 * needs the full width the shell provides instead of the centred mobile
 * fallback, so it's rendered directly; the responsive grids then expand (4-up
 * KPIs, side-by-side charts).
 */
import { MobileAnalyticsDashboard } from '@/mobile/screens/analytics';

export function DesktopAnalyticsDashboard() {
  return <MobileAnalyticsDashboard />;
}
