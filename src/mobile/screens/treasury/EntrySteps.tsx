/**
 * Les pièces communes aux saisies d'achat et de vente (maquettes
 * 07-tresorerie/05 à 12) : le choix de la contrepartie, et les champs du
 * clavier (le gros chiffre, la boîte, la ligne du taux).
 */
import * as React from 'react';
import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useCounterparties } from '@/hooks/useTreasury';
import { normalizeText } from '@/lib/clientSearch';
import { fmtNum } from '@/desktop/screens/treasury/treasuryFormat';
import type { CounterpartyFilter } from '@/desktop/screens/treasury/treasuryNav';
import { cn } from '@/lib/utils';
import { EmptyLine, FOCUS_RING, IconCircle, Initials, ItemList, ItemRow, SURFACE, SearchBox, TEXT } from '@/mobile/designKit';
import { CapsLabel, QuickCounterpartySheet } from './parts';
import { useRecentOperations } from './treasuryMobile';

/* ── Étape 1 : la contrepartie ──────────────────────────────────────────── */
export function CounterpartyStep({ type, onPick }: { type: CounterpartyFilter; onPick: (id: string) => void }) {
  const supplier = type === 'usdt_supplier';
  const list = useCounterparties(type);
  const recent = useRecentOperations();
  const [q, setQ] = useState('');
  const [quick, setQuick] = useState(false);

  // Le dernier taux et l'ordre des récents, lus dans les 90 derniers jours.
  const { last, recents } = useMemo(() => {
    const last = new Map<string, number>();
    const recents: string[] = [];
    for (const op of recent.data ?? []) {
      if (op.voided_at || (supplier ? op.kind !== 'purchase' : op.kind !== 'sale')) continue;
      const id = op.kind === 'purchase' ? op.supplier_id : op.buyer_id;
      if (!last.has(id) && op.implicit_rate != null) last.set(id, Number(op.implicit_rate));
      if (!recents.includes(id)) recents.push(id);
    }
    return { last, recents };
  }, [recent.data, supplier]);

  const all = list.data ?? [];
  const shown = q.trim()
    ? all.filter((c) => normalizeText(`${c.short_id} ${c.display_name} ${c.legal_name ?? ''} ${c.phone ?? ''} ${c.wechat_id ?? ''}`).includes(normalizeText(q)))
    : all;
  const recentCps = recents.map((id) => all.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c).slice(0, 4);
  const rate = (id: string) => (last.has(id) ? fmtNum(last.get(id)!, supplier ? 2 : 4) : null);

  return (
    <div className="pb-6">
      <div className="px-5 pt-4">
        <SearchBox value={q} onChange={setQ} placeholder="Nom, F-003 ou téléphone" />
      </div>
      {!q && recentCps.length > 0 && (
        <div className="px-5 pt-6">
          <CapsLabel>Récents</CapsLabel>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {recentCps.map((c) => (
              <button key={c.id} type="button" onClick={() => onPick(c.id)} className={cn('flex min-w-0 flex-col items-center gap-2 rounded-lg py-1', FOCUS_RING)}>
                <Initials name={c.display_name} size={60} />
                <span className={cn('max-w-full truncate text-[15px]', TEXT.body)}>{c.display_name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="px-5 pt-6">
        <CapsLabel>{supplier ? 'Fournisseurs USDT' : 'Acheteurs CNY'}</CapsLabel>
      </div>
      {list.isError ? (
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void list.refetch() }}>La liste n’a pas pu être chargée.</EmptyLine>
      ) : (
        <ItemList>
          {shown.map((c) => (
            <ItemRow
              key={c.id}
              leading={<Initials name={c.display_name} />}
              title={c.display_name}
              subtitle={[c.short_id, rate(c.id) ? `dernier ${rate(c.id)}` : c.phone].filter(Boolean).join(' · ')}
              onClick={() => onPick(c.id)}
              chevron
            />
          ))}
          {q && shown.length === 0 && !list.isLoading && <p className={cn('py-4 text-[16px]', TEXT.muted)}>Aucun résultat.</p>}
          <ItemRow
            leading={<IconCircle icon={Plus} />}
            title={supplier ? 'Nouveau fournisseur' : 'Nouvel acheteur'}
            subtitle="Nom et téléphone"
            onClick={() => setQuick(true)}
          />
        </ItemList>
      )}
      <QuickCounterpartySheet open={quick} onClose={() => setQuick(false)} type={type} onCreated={onPick} />
    </div>
  );
}

/* ── Les champs du clavier ──────────────────────────────────────────────── */
/** Le gros chiffre de la saisie (« Payé 3 000 000 XAF »). Gris quand il est calculé. */
export function BigField({
  label, text, unit, prefix, computed, active, onClick, compact,
}: { label: string; text: string; unit?: string; prefix?: string; computed?: boolean; active?: boolean; onClick?: () => void; compact?: boolean }) {
  const len = text.length + (prefix?.length ?? 0) + (unit ? unit.length / 2 : 0);
  const size = len > 12 ? 'text-[38px]' : len > 9 ? 'text-[46px]' : 'text-[56px]';
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cn('block w-full rounded-lg px-5 text-center', compact ? 'pt-3' : 'pt-5', FOCUS_RING)}>
      <span className={cn('block text-[16px] font-medium', TEXT.muted)}>{label}</span>
      <span className={cn('mt-2 block font-bold leading-none tracking-[-0.03em] tabular-nums', size, computed ? 'text-[#757575]' : TEXT.strong)}>
        {prefix && <span className="mr-2">{prefix}</span>}
        {text}
        {unit && <span className={cn('ml-2 text-[24px] font-semibold tracking-normal', TEXT.muted)}>{unit}</span>}
      </span>
    </button>
  );
}

/** La boîte d'un second montant (« Reçu 4 600,00 USDT ») : filet épais quand le clavier y écrit. */
export function BoxField({
  label, text, unit, computed, active, onClick, className,
}: { label: string; text: string; unit?: string; computed?: boolean; active?: boolean; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex h-[60px] w-full items-center justify-between gap-3 rounded-lg px-4 text-left',
        active ? 'border-2 border-[#2C2C2C] dark:border-[#E3E3E3]' : cn('border', SURFACE.field),
        FOCUS_RING,
        className,
      )}
    >
      <span className={cn('text-[16px]', TEXT.muted)}>{label}</span>
      <span className={cn('text-[22px] font-bold tabular-nums', computed ? 'text-[#757575]' : TEXT.strong)}>
        {text}
        {unit && <span className={cn('ml-1.5 text-[15px] font-semibold', TEXT.muted)}>{unit}</span>}
      </span>
    </button>
  );
}

/** La ligne du taux : touchée, elle devient saisissable (le clavier y écrit). */
export function RateLine({
  text, unit, active, onClick, tag,
}: { text: string; unit: string; active?: boolean; onClick: () => void; tag?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cn(
          'rounded-lg px-2.5 py-1 text-[17px] font-semibold tabular-nums',
          active ? 'border-2 border-[#2C2C2C] dark:border-[#E3E3E3]' : 'border-2 border-transparent',
          TEXT.strong,
          FOCUS_RING,
        )}
      >
        {text} {unit}
      </button>
      {tag}
    </div>
  );
}
