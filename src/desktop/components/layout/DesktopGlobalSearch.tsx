/**
 * Desktop topbar global search.
 *
 * Replaces the previously-inert topbar input with a working searchbox: debounced
 * lookups across clients (name / phone) and deposit / payment references
 * (useGlobalAdminSearch), shown as a grouped dropdown. Picking a result deep-
 * links to its detail route and clears the field.
 */
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ArrowDownToLine, ArrowUpFromLine, Loader2 } from 'lucide-react';
import { useGlobalAdminSearch } from '@/hooks/useGlobalAdminSearch';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatXAF, formatCurrencyRMB } from '@/lib/formatters';
import { SURFACE, TEXT, Avatar } from '@/mobile/designKit';
import { cn } from '@/lib/utils';

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn('px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider', TEXT.muted)}>{children}</div>
  );
}

const ROW = 'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-black/[0.03] dark:hover:bg-white/[0.04]';
const REF = 'rounded-md bg-black/[0.05] px-1.5 py-0.5 font-mono text-[11px] font-bold dark:bg-white/[0.06]';

export function DesktopGlobalSearch() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const debounced = useDebouncedValue(term);
  const { data, isLoading } = useGlobalAdminSearch(debounced);

  const active = open && debounced.trim().length >= 2;
  const total = (data?.clients.length ?? 0) + (data?.deposits.length ?? 0) + (data?.payments.length ?? 0);

  const go = (path: string) => {
    setOpen(false);
    setTerm('');
    inputRef.current?.blur();
    navigate(path);
  };

  return (
    <div className="relative hidden lg:block">
      <Search className={cn('pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2', TEXT.muted)} />
      {/* Desktop-only chrome (≥1024px): no iOS auto-zoom concern here. */}
      {/* eslint-disable-next-line no-restricted-syntax */}
      <input
        ref={inputRef}
        type="search"
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
        placeholder="Rechercher un client, une référence…"
        className={cn(
          'h-10 w-72 rounded-full pl-9 pr-9 text-[13px] outline-none placeholder:text-[#9B98AD]',
          SURFACE.card,
          SURFACE.shadow,
          TEXT.strong,
        )}
      />
      {term && (
        <button
          type="button"
          onClick={() => {
            setTerm('');
            inputRef.current?.focus();
          }}
          aria-label="Effacer"
          className={cn('absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full p-0.5', TEXT.muted)}
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {active && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            className={cn(
              'absolute left-0 top-full z-50 mt-2 w-[420px] overflow-hidden rounded-[20px]',
              SURFACE.card,
              'shadow-[0_18px_50px_-12px_rgba(46,32,92,0.35)] ring-1 ring-black/[0.06] dark:ring-white/[0.08]',
            )}
          >
            {isLoading || !data ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : total === 0 ? (
              <div className={cn('px-4 py-10 text-center text-[13px]', TEXT.muted)}>
                Aucun résultat pour « {debounced.trim()} »
              </div>
            ) : (
              <div className="max-h-[min(70vh,560px)] overflow-y-auto p-2">
                {data.clients.length > 0 && (
                  <section>
                    <GroupLabel>Clients</GroupLabel>
                    {data.clients.map((c) => (
                      <button key={c.userId} type="button" onClick={() => go(`/m/clients/${c.userId}`)} className={ROW}>
                        <Avatar name={c.name} tone="info" size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className={cn('truncate text-[13.5px] font-semibold', TEXT.strong)}>{c.name}</p>
                          {c.phone && <p className={cn('truncate text-[11.5px]', TEXT.muted)}>{c.phone}</p>}
                        </div>
                      </button>
                    ))}
                  </section>
                )}

                {data.deposits.length > 0 && (
                  <section>
                    <GroupLabel>Dépôts</GroupLabel>
                    {data.deposits.map((d) => (
                      <button key={d.id} type="button" onClick={() => go(`/m/deposits/${d.id}`)} className={ROW}>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EDEAFA] text-[#6B5BD2] dark:bg-[#272252] dark:text-[#A99BF0]">
                          <ArrowDownToLine className="h-4 w-4" />
                        </span>
                        <span className={REF}>{d.reference}</span>
                        <span className={cn('ml-auto text-[13px] font-bold tabular-nums', TEXT.strong)}>{formatXAF(d.amountXaf)}</span>
                      </button>
                    ))}
                  </section>
                )}

                {data.payments.length > 0 && (
                  <section>
                    <GroupLabel>Paiements</GroupLabel>
                    {data.payments.map((p) => (
                      <button key={p.id} type="button" onClick={() => go(`/m/payments/${p.id}`)} className={ROW}>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FCEFE0] text-[#C9700F] dark:bg-[#3A2A14] dark:text-[#E7B27A]">
                          <ArrowUpFromLine className="h-4 w-4" />
                        </span>
                        <span className={REF}>{p.reference}</span>
                        <span className={cn('ml-auto text-[13px] font-bold tabular-nums', TEXT.strong)}>{formatCurrencyRMB(p.amountRmb)}</span>
                      </button>
                    ))}
                  </section>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
