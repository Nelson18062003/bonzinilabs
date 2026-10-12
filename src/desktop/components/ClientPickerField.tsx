/**
 * Le choix du client, dans les fenêtres de saisie (nouveau dépôt, nouveau
 * paiement) : un champ qui s'ouvre en recherche — nom, téléphone, code
 * BZ-… — au clavier comme à la souris (↑ ↓ pour parcourir, Entrée pour
 * choisir, Échap pour refermer sans fermer la fenêtre).
 *
 * Le client choisi reste lisible d'un coup d'œil : nom, code, téléphone, et à
 * droite ce que l'appelant veut montrer (le solde, le plus souvent).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { matchesClientSearch } from '@/lib/clientSearch';
import { cn } from '@/lib/utils';
import { Avatar, SURFACE, TEXT } from '@/desktop/designKit';

export interface PickableClient {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  customer_code?: string | null;
  company_name?: string | null;
}

const nameOf = (c: PickableClient) => `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Sans nom';

export function ClientPickerField<C extends PickableClient>({
  clients,
  value,
  onChange,
  loading,
  invalid,
  meta,
  autoFocus,
  id,
}: {
  clients: C[];
  value: string | null;
  onChange: (client: C) => void;
  loading?: boolean;
  invalid?: boolean;
  /** Ce qui s'affiche à droite d'un client (son solde…). */
  meta?: (client: C) => ReactNode;
  autoFocus?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = clients.find((c) => c.user_id === value) ?? null;

  const results = useMemo(() => {
    const s = q.trim();
    const list = s
      ? clients.filter((c) =>
          matchesClientSearch(
            { firstName: c.first_name ?? '', lastName: c.last_name ?? '', phone: c.phone ?? '', customerCode: c.customer_code ?? '', companyName: c.company_name ?? '' },
            s,
          ),
        )
      : clients;
    return list.slice(0, 8);
  }, [clients, q]);

  useEffect(() => setActive(0), [q, open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const choose = (c: C) => {
    onChange(c);
    setOpen(false);
    setQ('');
    triggerRef.current?.focus();
  };

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        data-autofocus={autoFocus ? '' : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-3.5 py-2 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-ring',
          SURFACE.card,
          invalid ? 'ring-2 ring-red-500' : 'ring-1 ring-black/[0.12] hover:ring-black/25 dark:ring-white/[0.15]',
        )}
      >
        {selected ? (
          <>
            <Avatar name={nameOf(selected)} size="sm" />
            <span className="min-w-0 flex-1 leading-tight">
              <span className={cn('block truncate text-[14.5px] font-bold', TEXT.strong)}>{nameOf(selected)}</span>
              <span className={cn('block truncate text-[12px] tabular-nums', TEXT.muted)}>
                {[selected.customer_code, selected.phone, selected.company_name].filter(Boolean).join(' · ') || '—'}
              </span>
            </span>
            {meta && <span className="shrink-0 text-right">{meta(selected)}</span>}
          </>
        ) : (
          <>
            <Search className={cn('h-4 w-4 shrink-0', TEXT.muted)} />
            <span className={cn('flex-1 text-[14px]', TEXT.muted)}>{loading ? 'Chargement des clients…' : 'Rechercher un client — nom, téléphone ou BZ-…'}</span>
          </>
        )}
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', TEXT.muted, open && 'rotate-180')} />
      </button>

      {open && (
        <div className={cn('absolute left-0 right-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-2xl shadow-xl', SURFACE.card, 'ring-1 ring-black/[0.10] dark:ring-white/[0.10]')}>
          <div className="flex items-center gap-2 border-b border-black/[0.06] px-3.5 dark:border-white/[0.08]">
            <Search className={cn('h-4 w-4', TEXT.muted)} />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nom, téléphone ou BZ-…"
              aria-label="Rechercher un client"
              className={cn('h-11 w-full bg-transparent text-[16px] outline-none placeholder:text-muted-foreground', TEXT.strong)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive((i) => Math.min(i + 1, results.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((i) => Math.max(i - 1, 0));
                } else if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
                  e.preventDefault();
                  if (results[active]) choose(results[active]);
                } else if (e.key === 'Escape') {
                  // Referme la liste seulement : la fenêtre, elle, reste ouverte.
                  e.preventDefault();
                  setOpen(false);
                  triggerRef.current?.focus();
                }
              }}
            />
          </div>
          <ul role="listbox" aria-label="Clients" className="max-h-[300px] overflow-y-auto p-1.5">
            {results.map((c, i) => (
              <li key={c.user_id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={c.user_id === value}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(c)}
                  className={cn('flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left', i === active ? 'bg-accent' : 'hover:bg-muted/50')}
                >
                  <Avatar name={nameOf(c)} size="sm" />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className={cn('block truncate text-[13.5px] font-bold', TEXT.strong)}>{nameOf(c)}</span>
                    <span className={cn('block truncate text-[11.5px] tabular-nums', TEXT.muted)}>{[c.customer_code, c.phone].filter(Boolean).join(' · ') || '—'}</span>
                  </span>
                  {meta && <span className="shrink-0">{meta(c)}</span>}
                </button>
              </li>
            ))}
            {results.length === 0 && <li className={cn('px-3 py-4 text-[13px]', TEXT.muted)}>Aucun client trouvé</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
