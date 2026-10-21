/**
 * Recherche globale de l'équipe — refonte v2 (maquette 01/07). Nouvelle sur
 * mobile (le bureau l'avait dans sa barre du haut). Un nom, un téléphone, un
 * code client (BZ-4821), une référence de dépôt (BZ-DP-…) ou de paiement
 * (BZ-PY-…) ; Tout · Clients · Dépôts · Paiements ; chaque ligne ouvre sa fiche.
 *
 * Lecture seule, tables existantes, session `supabaseAdmin` : clients,
 * wallets (solde), deposits et payments (par référence, et ceux des clients
 * trouvés). Le terme est nettoyé avant d'entrer dans le filtre PostgREST,
 * comme useGlobalAdminSearch (aucune entrée brute dans la requête).
 */
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatYuan } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { DepositMethodLogo } from '@/mobile/components/deposits/DepositLogos';
import {
  Chip, EmptyLine, FOCUS_RING, Initials, ItemList, ItemRow, MethodCircle, ScreenLoader, SearchBox, TEXT, toMethodKey, type Tone,
} from '@/mobile/designKit';
import { CapsLabel } from '@/mobile/screens/more/parts';

type Filter = 'all' | 'clients' | 'deposits' | 'payments';

interface Found {
  clients: { userId: string; name: string; phone: string; code: string; balance: number | null }[];
  deposits: { id: string; ref: string; amount: number; method: string; bank: string | null; status: string; who: string }[];
  payments: { id: string; ref: string; amount: number; method: string; status: string; who: string }[];
}

const DEPOSIT_TAG: Record<string, { tone: Tone; label: string }> = {
  validated: { tone: 'success', label: 'Crédité' },
  proof_submitted: { tone: 'pending', label: 'À valider' },
  admin_review: { tone: 'pending', label: 'À valider' },
  pending_correction: { tone: 'pending', label: 'À corriger' },
  awaiting_proof: { tone: 'neutral', label: 'Sans preuve' },
  created: { tone: 'neutral', label: 'Créé' },
  rejected: { tone: 'danger', label: 'Refusé' },
  cancelled: { tone: 'neutral', label: 'Annulé' },
  cancelled_by_admin: { tone: 'neutral', label: 'Annulé' },
};
const PAYMENT_TAG: Record<string, { tone: Tone; label: string }> = {
  ready_for_payment: { tone: 'pending', label: 'À payer' },
  waiting_beneficiary_info: { tone: 'pending', label: 'Info manquante' },
  processing: { tone: 'neutral', label: 'En cours' },
  completed: { tone: 'success', label: 'Payé' },
  cash_pending: { tone: 'pending', label: 'À remettre' },
  cash_scanned: { tone: 'pending', label: 'QR lu' },
  rejected: { tone: 'danger', label: 'Refusé' },
  cancelled_by_admin: { tone: 'neutral', label: 'Annulé' },
  created: { tone: 'neutral', label: 'Créé' },
};

const nbsp = (s: string) => s.replace(/\u202F/g, '\u00A0');
const xafShort = (n: number) => nbsp(Math.round(n).toLocaleString('fr-FR'));

/** Le terme, sans ce qui casserait le filtre PostgREST (virgules, parenthèses, jokers). */
export const cleanTerm = (raw: string) => (raw ?? '').replace(/[,()*%\\]/g, ' ').replace(/\s+/g, ' ').trim();

function useStaffSearch(raw: string, can: { clients: boolean; deposits: boolean; payments: boolean }) {
  const term = cleanTerm(raw);
  return useQuery({
    queryKey: ['staff-search', term, can],
    enabled: term.length >= 2,
    staleTime: 10_000,
    queryFn: async (): Promise<Found> => {
      const like = `%${term}%`;
      const clientsRes = can.clients
        ? await supabaseAdmin.from('clients').select('user_id, first_name, last_name, phone, customer_code')
          .or(`first_name.ilike.${like},last_name.ilike.${like},phone.ilike.${like},customer_code.ilike.${like}`).limit(8)
        : { data: [], error: null };
      if (clientsRes.error) throw clientsRes.error;
      const clients = clientsRes.data ?? [];
      const ids = clients.map((c) => c.user_id).filter((id): id is string => /^[0-9a-zA-Z-]+$/.test(id ?? ''));
      const byRefOrOwner = (refCol: string) => (ids.length ? `${refCol}.ilike.${like},user_id.in.(${ids.join(',')})` : `${refCol}.ilike.${like}`);
      const [walletsRes, depositsRes, paymentsRes] = await Promise.all([
        ids.length ? supabaseAdmin.from('wallets').select('user_id, balance_xaf').in('user_id', ids) : Promise.resolve({ data: [], error: null }),
        can.deposits
          ? supabaseAdmin.from('deposits').select('id, reference, amount_xaf, method, bank_name, status, user_id, created_at').or(byRefOrOwner('reference')).order('created_at', { ascending: false }).limit(10)
          : Promise.resolve({ data: [], error: null }),
        can.payments
          ? supabaseAdmin.from('payments').select('id, reference, amount_rmb, method, status, user_id, created_at').or(byRefOrOwner('reference')).order('created_at', { ascending: false }).limit(10)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (depositsRes.error) throw depositsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      const deposits = depositsRes.data ?? [];
      const payments = paymentsRes.data ?? [];

      // Les noms des opérations trouvées par leur seule référence.
      const names = new Map(clients.map((c) => [c.user_id, `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()]));
      const missing = [...new Set([...deposits, ...payments].map((o) => o.user_id).filter((u) => !names.has(u)))];
      if (missing.length) {
        const { data } = await supabaseAdmin.from('clients').select('user_id, first_name, last_name').in('user_id', missing);
        for (const c of data ?? []) names.set(c.user_id, `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim());
      }
      const balances = new Map((walletsRes.data ?? []).map((w) => [w.user_id, w.balance_xaf as number]));
      return {
        clients: clients.map((c) => ({
          userId: c.user_id, name: `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Client', phone: c.phone ?? '', code: c.customer_code ?? '',
          balance: balances.get(c.user_id) ?? null,
        })),
        deposits: deposits.map((d) => ({ id: d.id, ref: d.reference ?? '—', amount: d.amount_xaf ?? 0, method: d.method, bank: d.bank_name, status: d.status, who: names.get(d.user_id) || 'Client' })),
        payments: payments.map((p) => ({ id: p.id, ref: p.reference ?? '—', amount: p.amount_rmb ?? 0, method: p.method, status: p.status, who: names.get(p.user_id) || 'Client' })),
      };
    },
  });
}

/** Le passage cherché, souligné (« Fatou »). */
function Mark({ text, term }: { text: string; term: string }) {
  const i = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<span className="underline decoration-2 underline-offset-[5px]">{text.slice(i, i + term.length)}</span>{text.slice(i + term.length)}</>;
}

export function StaffSearchScreen() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const can = { clients: hasPermission('canViewClients'), deposits: hasPermission('canViewDeposits'), payments: hasPermission('canViewPayments') };
  // `?q=` : un lien (ou le scanner) peut ouvrir la recherche déjà remplie.
  const [params] = useSearchParams();
  const [term, setTerm] = useState(() => params.get('q') ?? '');
  const [filter, setFilter] = useState<Filter>('all');
  const debounced = useDebouncedValue(term);
  const q = useStaffSearch(debounced, can);
  const t = cleanTerm(debounced);

  const ops = useMemo(() => {
    const d = (q.data?.deposits ?? []).map((x) => ({ kind: 'deposit' as const, ...x }));
    const p = (q.data?.payments ?? []).map((x) => ({ kind: 'payment' as const, ...x }));
    return filter === 'deposits' ? d : filter === 'payments' ? p : filter === 'clients' ? [] : [...p, ...d];
  }, [q.data, filter]);
  const clients = filter === 'all' || filter === 'clients' ? q.data?.clients ?? [] : [];
  const nothing = !!q.data && clients.length === 0 && ops.length === 0;

  return (
    <div className="flex min-h-full flex-col pb-10">
      <div className="flex items-center gap-3 px-5 pb-1 pt-[calc(env(safe-area-inset-top,0px)+12px)]">
        <SearchBox value={term} onChange={setTerm} placeholder="Client, BZ-DP-…, BZ-PY-…" autoFocus className="flex-1 border-2 border-[#2C2C2C] dark:border-[#E3E3E3]" />
        <button type="button" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/m/more'))} className={cn('h-11 shrink-0 rounded text-[17px] font-semibold', FOCUS_RING, TEXT.strong)}>Annuler</button>
      </div>
      <div className="scrollbar-hide flex gap-2.5 overflow-x-auto px-5 pt-3">
        {([['all', 'Tout'], ['clients', 'Clients'], ['deposits', 'Dépôts'], ['payments', 'Paiements']] as const).map(([v, l]) => (
          <Chip key={v} label={l} active={filter === v} onClick={() => setFilter(v)} className="h-12 px-4 text-[17px]" />
        ))}
      </div>

      {t.length < 2 ? (
        <EmptyLine>Un nom, un téléphone, BZ-4821, BZ-DP-… ou BZ-PY-…</EmptyLine>
      ) : q.isLoading ? (
        <ScreenLoader className="min-h-[30vh]" />
      ) : q.isError ? (
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void q.refetch() }}>La recherche n'a pas abouti.</EmptyLine>
      ) : nothing ? (
        <EmptyLine>Aucun résultat pour « {t} ».</EmptyLine>
      ) : (
        <>
          {clients.length > 0 && (
            <>
              <CapsLabel className="px-5 pt-6">Clients</CapsLabel>
              <ItemList className="pt-1">
                {clients.map((c) => (
                  <ItemRow
                    key={c.userId}
                    leading={<Initials name={c.name} size={52} />}
                    title={<Mark text={c.name} term={t} />}
                    subtitle={[c.code, c.phone].filter(Boolean).join(' · ')}
                    right={c.balance != null ? (
                      <span className="shrink-0 text-right">
                        <span className={cn('block text-[17px] font-bold tabular-nums', TEXT.strong)}>{xafShort(c.balance)}</span>
                        <span className={cn('block text-[15px]', TEXT.muted)}>XAF</span>
                      </span>
                    ) : undefined}
                    onClick={() => navigate(`/m/clients/${c.userId}`)}
                  />
                ))}
              </ItemList>
            </>
          )}
          {ops.length > 0 && (
            <>
              <CapsLabel className="px-5 pt-6">Opérations</CapsLabel>
              <ItemList className="pt-1">
                {ops.map((o) => (
                  <ItemRow
                    key={`${o.kind}-${o.id}`}
                    leading={o.kind === 'payment' ? <MethodCircle method={toMethodKey(o.method)} size={52} /> : <DepositMethodLogo method={o.method} bankName={o.bank} size={52} radius={26} />}
                    title={<Mark text={o.who} term={t} />}
                    subtitle={<Mark text={o.ref} term={t} />}
                    amount={o.kind === 'payment' ? <>¥&nbsp;{nbsp(formatYuan(o.amount))}</> : xafShort(o.amount)}
                    tag={(o.kind === 'payment' ? PAYMENT_TAG : DEPOSIT_TAG)[o.status] ?? { tone: 'neutral', label: o.status }}
                    onClick={() => navigate(o.kind === 'payment' ? `/m/payments/${o.id}` : `/m/deposits/${o.id}`)}
                  />
                ))}
              </ItemList>
            </>
          )}
        </>
      )}
    </div>
  );
}
