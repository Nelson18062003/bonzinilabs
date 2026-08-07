/**
 * ⌘K — the console's real navigation.
 *
 * With thirty screens, a sidebar is a map, not a road. The palette is how an
 * experienced operator actually moves: type three letters of a destination, a
 * client name, or a `BZ-DP-…` reference and press Enter. It merges four
 * sources into one ranked list:
 *
 *   · **Actions**       — the handful of things that create work (new deposit,
 *                          new payment, new client, ask Mola).
 *   · **Navigation**    — every permission-visible destination in DESKTOP_NAV.
 *   · **Records**       — live search over clients / deposits / payments.
 *   · **Mola**          — anything the palette can't resolve is handed to the
 *                          AI assistant, which is what makes the platform
 *                          AI-native rather than AI-decorated.
 *
 * Fully keyboard-driven: ↑/↓ move, Enter runs, Esc closes.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bot,
  CornerDownLeft,
  Loader2,
  Search,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useGlobalAdminSearch } from '@/hooks/useGlobalAdminSearch';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatXAF, formatCurrencyRMB } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { DS, DT, DFG, DFOCUS } from '@/desktop/ui/tokens';
import { Avatar, Holder, Ref } from '@/desktop/ui/primitives';
import { ALL_NAV_ITEMS } from './desktopNav';

interface Entry {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon?: LucideIcon;
  trailing?: React.ReactNode;
  /** Lower sorts first. See `score()`. */
  rank: number;
  run: () => void;
}

/**
 * Relevance of `label` for query `q`: 0 = starts with, 1 = word starts with,
 * 2 = contains, 3 = only the secondary text matched. Ties keep source order.
 */
function score(label: string, q: string): number {
  if (!q) return 2;
  const l = norm(label);
  if (l.startsWith(q)) return 0;
  if (l.split(/[\s—·-]+/).some((w) => w.startsWith(q))) return 1;
  if (l.includes(q)) return 2;
  return 3;
}

/** Accent- and case-insensitive substring match. */
function norm(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [term, setTerm] = useState('');
  const [cursor, setCursor] = useState(0);
  const debounced = useDebouncedValue(term);
  const { data: results, isLoading } = useGlobalAdminSearch(debounced.trim().length >= 2 ? debounced : '');

  useEffect(() => {
    if (open) {
      setTerm('');
      setCursor(0);
      // Focus after the dialog paints, otherwise Safari swallows it.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  const entries = useMemo<Entry[]>(() => {
    const q = norm(term.trim());
    const out: Entry[] = [];

    // 1. Actions — permission-gated, always first when they match.
    const actions: { label: string; icon: LucideIcon; to: string; perm?: Parameters<typeof hasPermission>[0] }[] = [
      { label: 'Nouveau dépôt', icon: ArrowDownToLine, to: '/m/deposits/new', perm: 'canViewDeposits' },
      { label: 'Nouveau paiement', icon: ArrowUpFromLine, to: '/m/payments/new', perm: 'canViewPayments' },
      { label: 'Nouveau client', icon: UserPlus, to: '/m/clients/new', perm: 'canViewClients' },
    ];
    for (const a of actions) {
      if (a.perm && !hasPermission(a.perm)) continue;
      if (q && !norm(a.label).includes(q)) continue;
      out.push({ id: `a:${a.to}`, group: 'Actions', label: a.label, icon: a.icon, rank: score(a.label, q), run: () => go(a.to) });
    }

    // 2. Navigation.
    for (const item of ALL_NAV_ITEMS) {
      if (item.perm && !hasPermission(item.perm)) continue;
      if (q && !norm(`${item.label} ${item.section} ${item.hint ?? ''}`).includes(q)) continue;
      out.push({
        id: `n:${item.to}`,
        group: 'Aller à',
        label: item.label,
        hint: item.section,
        icon: item.icon,
        rank: score(item.label, q),
        run: () => go(item.to),
      });
    }

    // 3. Records.
    for (const c of results?.clients ?? []) {
      out.push({
        id: `c:${c.userId}`,
        group: 'Clients',
        label: c.name,
        hint: c.phone ?? undefined,
        rank: score(c.name, q),
        run: () => go(`/m/clients/${c.userId}`),
      });
    }
    for (const d of results?.deposits ?? []) {
      out.push({
        id: `d:${d.id}`,
        group: 'Dépôts',
        label: d.reference,
        icon: ArrowDownToLine,
        trailing: <span className={cn('tabular-nums', DFG.strong)}>{formatXAF(d.amountXaf)}</span>,
        rank: score(d.reference, q),
        run: () => go(`/m/deposits/${d.id}`),
      });
    }
    for (const p of results?.payments ?? []) {
      out.push({
        id: `p:${p.id}`,
        group: 'Paiements',
        label: p.reference,
        icon: ArrowUpFromLine,
        trailing: <span className={cn('tabular-nums', DFG.strong)}>{formatCurrencyRMB(p.amountRmb)}</span>,
        rank: score(p.reference, q),
        run: () => go(`/m/payments/${p.id}`),
      });
    }

    // 4. Mola catch-all — a question is always a valid thing to type here.
    if (term.trim().length > 2) {
      out.push({
        id: 'mola',
        group: 'Assistant',
        label: `Demander à Mola : « ${term.trim()} »`,
        icon: Bot,
        rank: 3,
        run: () => go(`/m/assistant?q=${encodeURIComponent(term.trim())}`),
      });
    }

    // Stable sort: relevance first, declaration order within a tier.
    return out.map((e, i) => ({ e, i })).sort((a, b) => a.e.rank - b.e.rank || a.i - b.i).map(({ e }) => e);
  }, [term, results, hasPermission]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setCursor(0), [term, results]);

  /* Keep the highlighted row in view while arrowing through a long list. */
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  const grouped = entries.reduce<Record<string, Entry[]>>((acc, e) => {
    (acc[e.group] ??= []).push(e);
    return acc;
  }, {});
  let flatIndex = -1;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[12vh]" role="dialog" aria-modal="true" aria-label="Palette de commandes">
      <div className="absolute inset-0 bg-[#0B0A12]/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />

      <div className={cn('relative w-full max-w-[560px] overflow-hidden rounded-xl border', DS.panel, DS.line, DS.float)}>
        <div className={cn('flex items-center gap-2.5 border-b px-3.5', DS.line)}>
          <Search className={cn('h-4 w-4 shrink-0', DFG.faint)} />
          {/* Desktop-only chrome — the iOS 16px auto-zoom rule doesn't apply. */}
          {/* eslint-disable-next-line no-restricted-syntax */}
          <input
            ref={inputRef}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setCursor((c) => Math.min(entries.length - 1, c + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                entries[cursor]?.run();
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
            placeholder="Rechercher un écran, un client, une référence — ou poser une question à Mola…"
            className={cn('h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#A5A1B5]', DFG.strong)}
          />
          {isLoading ? <Loader2 className={cn('h-4 w-4 animate-spin', DFG.faint)} /> : null}
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5">
          {entries.length === 0 ? (
            <p className={cn('px-3 py-10 text-center', DT.body, DFG.faint)}>Aucun résultat</p>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group} className="mb-1">
                <p className={cn(DT.micro, DFG.faint, 'px-2.5 pb-1 pt-2')}>{group}</p>
                {items.map((e) => {
                  flatIndex += 1;
                  const idx = flatIndex;
                  const Icon = e.icon;
                  return (
                    <button
                      key={e.id}
                      data-idx={idx}
                      type="button"
                      onMouseMove={() => setCursor(idx)}
                      onClick={e.run}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                        idx === cursor ? DS.selected : 'bg-transparent',
                        DFOCUS,
                      )}
                    >
                      {Icon ? <Holder icon={Icon} size="sm" /> : <Avatar name={e.label} size="sm" />}
                      <span className="min-w-0 flex-1">
                        <span className={cn('block truncate text-[13px] font-semibold', DFG.strong)}>{e.label}</span>
                        {e.hint ? <span className={cn('block truncate text-[11px]', DFG.faint)}>{e.hint}</span> : null}
                      </span>
                      {e.trailing ? <span className="shrink-0 text-[12px] font-bold">{e.trailing}</span> : null}
                      {idx === cursor ? <CornerDownLeft className={cn('h-3.5 w-3.5 shrink-0', DFG.faint)} /> : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className={cn('flex items-center gap-4 border-t px-3.5 py-2', DS.line, DS.well)}>
          {[
            ['↑↓', 'naviguer'],
            ['↵', 'ouvrir'],
            ['esc', 'fermer'],
          ].map(([k, l]) => (
            <span key={k} className={cn('flex items-center gap-1.5 text-[11px]', DFG.faint)}>
              <kbd className={cn('rounded border px-1.5 py-0.5 font-sans text-[10px] font-bold', DS.line, DS.card)}>{k}</kbd>
              {l}
            </span>
          ))}
          <span className={cn('ml-auto text-[11px]', DFG.faint)}>
            <Ref>BZ-…</Ref> pour ouvrir une référence
          </span>
        </div>
      </div>
    </div>
  );
}
