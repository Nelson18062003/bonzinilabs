// ============================================================
// MODULE DEPOTS V2 — MobileDepositsScreenV2
// UI selon maquette v3 : KPIs compacts, icône entonnoir SVG,
// filtres famille, présets période, cartes avec MIcon + SLA
// Logique identique à MobileDepositsScreen.tsx
// ============================================================
import { useState, useMemo, useCallback } from 'react';
import { useDepositStats } from '@/hooks/useAdminDeposits';
import { usePaginatedAdminDeposits, type DepositFilters } from '@/hooks/usePaginatedDeposits';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  DEPOSIT_STATUS_LABELS,
  DEPOSIT_METHOD_LABELS_SHORT,
} from '@/types/deposit';
import type { DepositStatus, DepositMethod } from '@/types/deposit';
import { SkeletonListScreen } from '@/mobile/components/ui/SkeletonCard';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import { InfiniteScrollTrigger } from '@/mobile/components/ui/InfiniteScrollTrigger';
import { MobileEmptyState } from '@/mobile/components/ui/MobileEmptyState';
import { formatXAF, formatRelativeDate } from '@/lib/formatters';
import { getDepositSlaLevel, type SlaLevel } from '@/lib/depositTimeline';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';

// ── Couleurs maquette ────────────────────────────────────────
const GR = '#34d399';
const V = '#A947FE';
const O = '#FE560D';
const BLUE = '#3b82f6';
const RED = '#ef4444';
const t = {
  bg: '#f5f3f7',
  card: '#ffffff',
  text: '#1a1028',
  sub: '#7a7290',
  dim: '#c4bdd0',
  border: '#ebe6f0',
};

// ── Familles de méthode ──────────────────────────────────────
const FAMILIES_CONF: Record<string, { letter: string; bg: string; dark?: boolean; name: string }> = {
  BANK: { letter: 'B', bg: '#1e3a5f', name: 'Banque' },
  AGENCY_BONZINI: { letter: 'A', bg: '#A947FE', name: 'Agence' },
  ORANGE_MONEY: { letter: 'O', bg: '#ff6600', name: 'Orange' },
  MTN_MONEY: { letter: 'M', bg: '#ffcb05', dark: true, name: 'MTN' },
  WAVE: { letter: 'W', bg: '#1dc3e3', name: 'Wave' },
};

function getFamilyFromMethod(method: string): string {
  if (['bank_transfer', 'bank_cash'].includes(method)) return 'BANK';
  if (method === 'agency_cash') return 'AGENCY_BONZINI';
  if (['om_transfer', 'om_withdrawal'].includes(method)) return 'ORANGE_MONEY';
  if (['mtn_transfer', 'mtn_withdrawal'].includes(method)) return 'MTN_MONEY';
  if (method === 'wave') return 'WAVE';
  return 'BANK';
}

// Mapping famille → méthodes DB (pour filtrage)
const FAMILY_TO_METHODS: Record<string, DepositMethod[]> = {
  BANK: ['bank_transfer', 'bank_cash'],
  AGENCY_BONZINI: ['agency_cash'],
  ORANGE_MONEY: ['om_transfer', 'om_withdrawal'],
  MTN_MONEY: ['mtn_transfer', 'mtn_withdrawal'],
  WAVE: ['wave'],
};

// ── Composant MIcon ──────────────────────────────────────────
function MIcon({ family, size = 34 }: { family: string; size?: number }) {
  const f = FAMILIES_CONF[family];
  if (!f) return null;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.26),
        background: f.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.38),
        color: f.dark ? '#1a1028' : '#fff',
        fontWeight: 900,
        flexShrink: 0,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {f.letter}
    </div>
  );
}

// ── Icône entonnoir SVG ──────────────────────────────────────
function FunnelIcon({ color = '#7a7290', size = 16 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path
        d="M1.5 2h13l-5 6v4.5L7.5 14V8L1.5 2z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Point SLA ────────────────────────────────────────────────
function SlaDot({ level }: { level: SlaLevel }) {
  const color =
    level === 'fresh' ? GR : level === 'aging' ? '#F3A745' : RED;
  return (
    <div
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        animation: level === 'overdue' ? 'sla-pulse 1.5s infinite' : undefined,
      }}
    />
  );
}

// ── Status colors inline ─────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  created: t.sub,
  awaiting_proof: '#F3A745',
  proof_submitted: BLUE,
  admin_review: V,
  validated: GR,
  rejected: RED,
  pending_correction: O,
  cancelled: t.sub,
};

// ── Filtres statut ───────────────────────────────────────────
type FilterKey = DepositStatus | 'all' | 'to_process';
const TO_PROCESS_STATUSES: DepositStatus[] = ['proof_submitted', 'admin_review'];

// ── Formatage montant ────────────────────────────────────────
function fmt(n: number) {
  return Math.abs(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
}

// ── Présets période ──────────────────────────────────────────
type PeriodPreset = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom';

function getPeriodDates(preset: PeriodPreset): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (preset === 'today') {
    return { dateFrom: ymd(now), dateTo: ymd(now) };
  }
  if (preset === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { dateFrom: ymd(y), dateTo: ymd(y) };
  }
  if (preset === 'week') {
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return { dateFrom: ymd(monday), dateTo: '' };
  }
  if (preset === 'month') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return { dateFrom: ymd(first), dateTo: '' };
  }
  return { dateFrom: '', dateTo: '' };
}

// ── Composant principal ──────────────────────────────────────
export function MobileDepositsScreenV2() {
  const [statusFilter, setStatusFilter] = useState<FilterKey>('all');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('all');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const { data: stats } = useDepositStats();
  const navigate = useNavigate();

  // Dates effectives selon preset
  const { dateFrom, dateTo } = useMemo(() => {
    if (periodPreset === 'custom') return { dateFrom: customDateFrom, dateTo: customDateTo };
    return getPeriodDates(periodPreset);
  }, [periodPreset, customDateFrom, customDateTo]);

  // filterParams
  const filterParams = useMemo<DepositFilters | undefined>(() => {
    const params: DepositFilters = {};

    if (statusFilter === 'to_process') {
      params.statuses = TO_PROCESS_STATUSES as string[];
    } else if (statusFilter !== 'all') {
      params.status = statusFilter;
    }

    // Note: DepositFilters supporte method (string unique) — on filtre par famille côté client
    // Pas besoin d'envoyer le filtre méthode au serveur ici

    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;

    params.sortField = 'created_at';
    params.sortAscending = false;

    const hasFilters = params.status || params.statuses || params.dateFrom || params.dateTo;
    const isDefault = !hasFilters;
    if (isDefault) return undefined;
    return params;
  }, [statusFilter, dateFrom, dateTo]);

  const {
    data,
    isLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePaginatedAdminDeposits(filterParams);

  const handleLoadMore = useCallback(() => { fetchNextPage(); }, [fetchNextPage]);

  const allDeposits = useMemo(
    () => data?.pages.flatMap((page) => page.data) || [],
    [data],
  );

  // Filtrage côté client : recherche + famille
  const filteredDeposits = useMemo(() => {
    let list = allDeposits;
    // Filtre famille côté client
    if (familyFilter !== 'all') {
      const methods = FAMILY_TO_METHODS[familyFilter] || [];
      list = list.filter((d) => methods.includes(d.method));
    }
    // Recherche
    if (debouncedSearch) {
      const search = debouncedSearch.toLowerCase();
      list = list.filter((deposit) => {
        const clientName = `${deposit.profiles?.first_name || ''} ${deposit.profiles?.last_name || ''}`.toLowerCase();
        return (
          clientName.includes(search) ||
          deposit.reference?.toLowerCase().includes(search) ||
          deposit.profiles?.phone?.includes(search)
        );
      });
    }
    return list;
  }, [allDeposits, debouncedSearch, familyFilter]);

  const counts = useMemo(() => {
    if (stats) {
      return {
        toProcess: stats.to_process,
        correction: stats.pending_correction,
        validated: stats.validated,
        rejected: stats.rejected,
        total: stats.total,
      };
    }
    return { toProcess: 0, correction: 0, validated: 0, rejected: 0, total: 0 };
  }, [stats]);

  const hasActiveFilters = familyFilter !== 'all' || periodPreset !== 'all';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        background: t.bg,
        fontFamily: "'DM Sans', sans-serif",
        color: t.text,
      }}
    >
      <style>{`
        @keyframes sla-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
      `}</style>

      {/* ── Header ─────────────────────────────────────────── */}
      <div
        style={{
          flexShrink: 0,
          padding: '12px 20px',
          background: t.card,
          borderBottom: `1px solid ${t.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 800 }}>Dépôts</span>
        <button
          onClick={() => navigate('/m/deposits/new')}
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: GR,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            color: '#fff',
            boxShadow: `0 4px 12px ${GR}40`,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          +
        </button>
      </div>

      <PullToRefresh
        onRefresh={refetch}
        style={{ flex: 1, overflowY: 'auto' } as React.CSSProperties}
      >
        {/* ── KPIs compacts ──────────────────────────────── */}
        <div style={{ padding: '12px 20px 0', display: 'flex', gap: 6 }}>
          {[
            { label: 'À traiter', value: counts.toProcess, color: BLUE, key: 'to_process' as FilterKey },
            { label: 'À corriger', value: counts.correction, color: O, key: 'pending_correction' as FilterKey },
            { label: 'Validés', value: counts.validated, color: GR, key: 'validated' as FilterKey },
          ].map((k) => (
            <button
              key={k.key}
              onClick={() => setStatusFilter(statusFilter === k.key ? 'all' : k.key)}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                background: statusFilter === k.key ? `${k.color}10` : t.card,
                outline: statusFilter === k.key ? `2px solid ${k.color}` : `1px solid ${t.border}`,
                textAlign: 'center',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 900, color: k.color, lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.sub, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {k.label}
              </div>
            </button>
          ))}
        </div>

        {/* ── Recherche + entonnoir ──────────────────────── */}
        <div style={{ padding: '10px 20px 0', display: 'flex', gap: 6 }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 14px',
              height: 42,
              borderRadius: 10,
              background: t.card,
              border: `1px solid ${t.border}`,
            }}
          >
            <span style={{ fontSize: 13, color: t.dim }}>🔍</span>
            <input
              style={{
                border: 'none',
                background: 'none',
                outline: 'none',
                fontSize: 13,
                fontWeight: 500,
                color: t.text,
                width: '100%',
                fontFamily: "'DM Sans', sans-serif",
              }}
              placeholder="Nom, téléphone ou référence..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.dim, fontSize: 14, padding: 0 }}
              >
                ×
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              background: showFilters ? `${V}10` : t.card,
              outline: showFilters ? `2px solid ${V}` : `1px solid ${t.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <FunnelIcon color={showFilters || hasActiveFilters ? V : t.sub} />
            {hasActiveFilters && (
              <div
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: V,
                }}
              />
            )}
          </button>
        </div>

        {/* ── Panneau filtres avancés ────────────────────── */}
        {showFilters && (
          <div
            style={{
              margin: '8px 20px 0',
              padding: 12,
              borderRadius: 12,
              background: t.card,
              border: `1px solid ${t.border}`,
            }}
          >
            {/* Filtre méthode par famille */}
            <div style={{ fontSize: 11, fontWeight: 700, color: t.sub, marginBottom: 6 }}>Méthode</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
              {[
                { k: 'all', l: 'Toutes' },
                { k: 'BANK', l: 'Banque' },
                { k: 'AGENCY_BONZINI', l: 'Agence' },
                { k: 'ORANGE_MONEY', l: 'Orange' },
                { k: 'MTN_MONEY', l: 'MTN' },
                { k: 'WAVE', l: 'Wave' },
              ].map((m) => (
                <button
                  key={m.k}
                  onClick={() => setFamilyFilter(m.k)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 7,
                    border: 'none',
                    cursor: 'pointer',
                    background: familyFilter === m.k ? V : t.bg,
                    color: familyFilter === m.k ? '#fff' : t.sub,
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {m.l}
                </button>
              ))}
            </div>

            {/* Filtre période */}
            <div style={{ fontSize: 11, fontWeight: 700, color: t.sub, marginBottom: 6 }}>Période</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
              {[
                { k: 'all' as PeriodPreset, l: 'Toutes' },
                { k: 'today' as PeriodPreset, l: "Aujourd'hui" },
                { k: 'yesterday' as PeriodPreset, l: 'Hier' },
                { k: 'week' as PeriodPreset, l: 'Cette semaine' },
                { k: 'month' as PeriodPreset, l: 'Ce mois' },
                { k: 'custom' as PeriodPreset, l: 'Personnalisé' },
              ].map((p) => (
                <button
                  key={p.k}
                  onClick={() => setPeriodPreset(p.k)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 7,
                    border: 'none',
                    cursor: 'pointer',
                    background: periodPreset === p.k ? V : t.bg,
                    color: periodPreset === p.k ? '#fff' : t.sub,
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {p.l}
                </button>
              ))}
            </div>
            {periodPreset === 'custom' && (
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: `1.5px solid ${t.border}`,
                    background: t.bg,
                    fontSize: 12,
                    fontWeight: 600,
                    color: t.text,
                    fontFamily: "'DM Sans', sans-serif",
                    outline: 'none',
                  }}
                />
                <span style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: t.dim }}>→</span>
                <input
                  type="date"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: `1.5px solid ${t.border}`,
                    background: t.bg,
                    fontSize: 12,
                    fontWeight: 600,
                    color: t.text,
                    fontFamily: "'DM Sans', sans-serif",
                    outline: 'none',
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Chips statut ───────────────────────────────── */}
        <div
          style={{
            padding: '10px 20px 0',
            display: 'flex',
            gap: 4,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {[
            { k: 'all' as FilterKey, l: 'Tous', c: counts.total },
            { k: 'to_process' as FilterKey, l: 'À traiter', c: counts.toProcess },
            { k: 'pending_correction' as FilterKey, l: 'À corriger', c: counts.correction },
            { k: 'validated' as FilterKey, l: 'Validés', c: counts.validated },
            { k: 'rejected' as FilterKey, l: 'Rejetés', c: counts.rejected },
          ].map((ch) => (
            <button
              key={ch.k}
              onClick={() => setStatusFilter(ch.k)}
              style={{
                padding: '6px 12px',
                borderRadius: 20,
                border: 'none',
                cursor: 'pointer',
                background: statusFilter === ch.k ? t.text : t.card,
                color: statusFilter === ch.k ? '#fff' : t.sub,
                fontSize: 11,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                outline: statusFilter !== ch.k ? `1px solid ${t.border}` : 'none',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {ch.l}
              {ch.c != null && ch.c > 0 && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    padding: '1px 5px',
                    borderRadius: 8,
                    background: statusFilter === ch.k ? 'rgba(255,255,255,0.2)' : t.bg,
                  }}
                >
                  {ch.c}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Liste dépôts ────────────────────────────────── */}
        <div style={{ padding: '10px 20px 100px' }}>
          {isLoading ? (
            <SkeletonListScreen count={4} />
          ) : filteredDeposits.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filteredDeposits.map((deposit) => {
                const clientName = deposit.profiles
                  ? `${deposit.profiles.first_name} ${deposit.profiles.last_name}`
                  : 'Client inconnu';
                const proofCount = deposit.proof_count || 0;
                const slaLevel = getDepositSlaLevel(deposit.created_at, deposit.status);
                const family = getFamilyFromMethod(deposit.method);
                const statusColor = STATUS_COLOR[deposit.status] || t.sub;
                const statusLabel = DEPOSIT_STATUS_LABELS[deposit.status] || deposit.status;
                const methodShort = DEPOSIT_METHOD_LABELS_SHORT[deposit.method] || deposit.method;

                return (
                  <button
                    key={deposit.id}
                    onClick={() => navigate(`/m/deposits/${deposit.id}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px',
                      borderRadius: 14,
                      width: '100%',
                      background: t.card,
                      border: `1px solid ${t.border}`,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    <MIcon family={family} size={38} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: t.text,
                          }}
                        >
                          {clientName}
                        </span>
                        {proofCount > 0 && (
                          <span style={{ fontSize: 9, color: t.dim }}>📎{proofCount}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: t.dim, marginTop: 1 }}>
                        {deposit.reference} · {methodShort}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: t.text }}>
                        {fmt(deposit.amount_xaf)} XAF
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          justifyContent: 'flex-end',
                          marginTop: 2,
                        }}
                      >
                        {slaLevel && <SlaDot level={slaLevel} />}
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: statusColor,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: `${statusColor}10`,
                          }}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <div style={{ fontSize: 9, color: t.dim, marginTop: 1 }}>
                        {formatRelativeDate(deposit.created_at)}
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* Infinite scroll — uniquement si pas de recherche en cours */}
              {!debouncedSearch && (
                <InfiniteScrollTrigger
                  onLoadMore={handleLoadMore}
                  hasNextPage={hasNextPage}
                  isFetchingNextPage={isFetchingNextPage}
                />
              )}
            </div>
          ) : (
            <MobileEmptyState
              icon={FileText}
              title="Aucun dépôt trouvé"
              description={
                statusFilter !== 'all' || hasActiveFilters
                  ? 'Essayez de modifier vos filtres'
                  : 'Les dépôts apparaîtront ici'
              }
            />
          )}
        </div>
      </PullToRefresh>
    </div>
  );
}
