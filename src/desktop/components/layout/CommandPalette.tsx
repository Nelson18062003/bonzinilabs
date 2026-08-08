/**
 * ⌘K — the console's real navigation.
 *
 * With thirty screens, a sidebar is a map, not a road. The palette is how an
 * experienced operator actually moves: type three letters of a destination, a
 * client name, or a `BZ-DP-…` reference and press Enter. It merges four
 * sources into one ranked list:
 *
 *   · **Actions**       — the handful of things that create work (new deposit,
 *                          new payment, new client, record a treasury op).
 *   · **Navigation**    — every permission-visible destination in DESKTOP_NAV.
 *   · **Records**       — live search over clients / deposits / payments.
 *   · **Mola**          — anything the palette can't resolve is handed to the
 *                          AI assistant, which is what makes the platform
 *                          AI-native rather than AI-decorated.
 *
 * Implementation notes that matter:
 *  · **One order.** Entries are ranked, then bucketed into groups, then
 *    flattened back to `visible` — and `visible` is what both the renderer and
 *    the ↑/↓/Enter handler index. Ranking across groups while indexing per
 *    group is how a palette ends up opening a different record than the one
 *    highlighted; it must not be possible here.
 *  · **Combobox semantics.** Rows are `role="option"` divs, not buttons, so
 *    they stay out of the tab order and Tab cannot walk out of a dialog that
 *    claims `aria-modal`. The input owns focus and points at the active row
 *    via `aria-activedescendant`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bot,
  CornerDownLeft,
  Layers,
  Loader2,
  Search,
  TrendingDown,
  TrendingUp,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { useAdminAuth, type RolePermission } from '@/contexts/AdminAuthContext';
import { useGlobalAdminSearch } from '@/hooks/useGlobalAdminSearch';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatXAF, formatCurrencyRMB } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { DS, DT, DFG } from '@/desktop/ui/tokens';
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

/** Accent- and case-insensitive normalisation. */
function norm(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Relevance of `label` for query `q`: 0 = starts with, 1 = a word starts with,
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

/** Actions that create work. Gated on the permission that lets you *finish* it. */
const ACTIONS: { label: string; icon: LucideIcon; to: string; perm: keyof RolePermission }[] = [
  { label: 'Nouveau dépôt', icon: ArrowDownToLine, to: '/m/deposits/new', perm: 'canProcessDeposits' },
  { label: 'Nouveau paiement', icon: ArrowUpFromLine, to: '/m/payments/new', perm: 'canProcessPayments' },
  { label: 'Paiement groupé', icon: Layers, to: '/m/payments/batch/new', perm: 'canProcessPayments' },
  { label: 'Nouveau client', icon: UserPlus, to: '/m/clients/new', perm: 'canEditClients' },
  { label: 'Nouvel achat USDT', icon: TrendingUp, to: '/m/more/treasury/purchase', perm: 'canManageTreasury' },
  { label: 'Nouvelle vente USDT', icon: TrendingDown, to: '/m/more/treasury/sale', perm: 'canManageTreasury' },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);
  /** True once the pointer has genuinely moved, so scrolling can't hijack ↑/↓. */
  const pointerMoved = useRef(false);

  const [term, setTerm] = useState('');
  const [cursor, setCursor] = useState(0);
  const debounced = useDebouncedValue(term);
  const { data: results, isLoading } = useGlobalAdminSearch(debounced.trim().length >= 2 ? debounced : '');

  /* Open: remember who had focus, focus the input, lock the page scroll. */
  useEffect(() => {
    if (!open) return;
    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    setTerm('');
    setCursor(0);
    requestAnimationFrame(() => inputRef.current?.focus());

    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
      restoreFocusTo.current?.focus?.();
    };
  }, [open]);

  const go = useCallback(
    (path: string) => {
      onClose();
      navigate(path);
    },
    [onClose, navigate],
  );

  const entries = useMemo<Entry[]>(() => {
    const q = norm(term.trim());
    const out: Entry[] = [];

    for (const a of ACTIONS) {
      if (!hasPermission(a.perm)) continue;
      if (q && !norm(a.label).includes(q)) continue;
      out.push({ id: `a:${a.to}`, group: 'Actions', label: a.label, icon: a.icon, rank: score(a.label, q), run: () => go(a.to) });
    }

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

    // A question is always a valid thing to type here.
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
  }, [term, results, hasPermission, go]);

  /**
   * Groups in first-seen order, and `visible` — the SAME sequence, flattened.
   * Rendering walks `groups`; the keyboard walks `visible`; they cannot drift.
   */
  const { groups, visible } = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of entries) {
      const bucket = map.get(e.group);
      if (bucket) bucket.push(e);
      else map.set(e.group, [e]);
    }
    return { groups: [...map.entries()], visible: [...map.values()].flat() };
  }, [entries]);

  /* Typing restarts the selection; late-arriving search results only clamp it,
     so the highlight doesn't jump out from under an operator mid-arrow. */
  useEffect(() => setCursor(0), [term]);
  useEffect(() => setCursor((c) => Math.max(0, Math.min(c, visible.length - 1))), [visible.length]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  const activeId = visible[cursor] ? `cmdk-opt-${cursor}` : undefined;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      pointerMoved.current = false;
      setCursor((c) => Math.min(visible.length - 1, c + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      pointerMoved.current = false;
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setCursor(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setCursor(Math.max(0, visible.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      visible[cursor]?.run();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab') {
      // The input is the only focusable node in the dialog — keep it that way.
      e.preventDefault();
    }
  };

  let flatIndex = -1;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Palette de commandes"
      onKeyDown={onKeyDown}
      onPointerMove={() => { pointerMoved.current = true; }}
    >
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
            role="combobox"
            aria-expanded
            aria-controls="cmdk-list"
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            placeholder="Rechercher un écran, un client, une référence — ou poser une question à Mola…"
            className={cn('h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#767187] dark:placeholder:text-[#8B8799]', DFG.strong)}
          />
          {isLoading ? <Loader2 className={cn('h-4 w-4 animate-spin motion-reduce:animate-none', DFG.faint)} /> : null}
        </div>

        <div ref={listRef} id="cmdk-list" role="listbox" aria-label="Résultats" className="max-h-[52vh] overflow-y-auto p-1.5">
          {visible.length === 0 ? (
            <p role="status" className={cn('px-3 py-10 text-center', DT.body, DFG.muted)}>
              Aucun résultat pour « {term.trim()} »
            </p>
          ) : (
            groups.map(([group, items]) => (
              <div key={group} className="mb-1">
                <p className={cn(DT.micro, DFG.faint, 'px-2.5 pb-1 pt-2')}>{group}</p>
                {items.map((e) => {
                  flatIndex += 1;
                  const idx = flatIndex;
                  const Icon = e.icon;
                  const active = idx === cursor;
                  return (
                    <div
                      key={e.id}
                      id={`cmdk-opt-${idx}`}
                      data-idx={idx}
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => { if (pointerMoved.current) setCursor(idx); }}
                      onClick={e.run}
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left',
                        active ? DS.selected : 'bg-transparent',
                      )}
                    >
                      {Icon ? <Holder icon={Icon} size="sm" /> : <Avatar name={e.label} size="sm" />}
                      <span className="min-w-0 flex-1">
                        <span className={cn('block truncate text-[13px] font-semibold', DFG.strong)}>{e.label}</span>
                        {e.hint ? <span className={cn('block truncate', DT.tiny, DFG.muted)}>{e.hint}</span> : null}
                      </span>
                      {e.trailing ? <span className="shrink-0 text-[12px] font-bold">{e.trailing}</span> : null}
                      {active ? <CornerDownLeft className={cn('h-3.5 w-3.5 shrink-0', DFG.faint)} /> : null}
                    </div>
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
            <span key={k} className={cn('flex items-center gap-1.5', DT.tiny, DFG.muted)}>
              <kbd className={cn('rounded border px-1.5 py-0.5 font-sans text-[10px] font-bold', DS.line, DS.card)}>{k}</kbd>
              {l}
            </span>
          ))}
          <span className={cn('ml-auto flex items-center gap-1.5', DT.tiny, DFG.muted)}>
            <Ref>BZ-…</Ref> pour ouvrir une référence
          </span>
        </div>
      </div>
    </div>
  );
}
