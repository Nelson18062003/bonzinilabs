// ============================================================
// ESPACE COMMERCIAL — « Mes clients » (refonte v2, maquette 10/26). Les
// clients dont il est l'origine, et ce qu'ils ont fait dans le mois choisi
// (« Octobre ⌄ ») : paiements terminés, fret avion (kg, colis), fret bateau
// (m³, colis). Le total en tête ; Appeler / WhatsApp sur la ligne ; toucher
// la ligne montre ses chiffres du mois. Aucune fiche « /m » (il n'y a pas
// accès). Données : commercial_clients, limité à SA fiche.
// ============================================================
import { useMemo, useState } from 'react';
import { ChevronDown, MessageCircle, Phone, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeText } from '@/lib/clientSearch';
import { useCommercialClients } from '@/hooks/useSales';
import { clientPhoneE164, currentMonth, fmtCbm, fmtKg, fmtXaf, whatsappLink, type CommercialClient } from '@/lib/sales';
import { formatE164ForDisplay } from '@/components/form/PhoneNumberInput';
import {
  BottomSheet, EmptyLine, Initials, ItemList, ItemRow, KVBox, RoundButton, SearchBox, TabTop, TEXT, SURFACE, FOCUS_RING,
} from '@/mobile/designKit';
import { shortXaf } from '@/mobile/screens/clients/parts';
import { MonthSheet, monthName } from '@/mobile/screens/team/teamParts';
import { UnlinkedNotice } from './SalesBits';
import { fmtLongDay, isUnlinkedError, plural } from './salesHelpers';

const isActive = (c: CommercialClient) => c.payments_count + c.air_parcels + c.sea_parcels > 0;
const num = (v: number, d = 0) => v.toLocaleString('fr-FR', { maximumFractionDigits: d }).replace(/\u202F/g, '\u00A0');

export function CommercialClients() {
  const thisMonth = useMemo(() => currentMonth(), []);
  const [month, setMonth] = useState(thisMonth);
  const [pick, setPick] = useState(false);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<CommercialClient | null>(null);
  const clients = useCommercialClients(month);
  const unlinked = clients.isError && isUnlinkedError(clients.error);
  const rows = clients.data ?? [];

  const sum = rows.reduce(
    (s, c) => ({ pay: s.pay + c.payments_xaf, airKg: s.airKg + c.air_kg, seaCbm: s.seaCbm + c.sea_cbm, active: s.active + (isActive(c) ? 1 : 0) }),
    { pay: 0, airKg: 0, seaCbm: 0, active: 0 },
  );
  const nq = normalizeText(q);
  const digits = q.replace(/\D/g, '');
  const shown = !nq
    ? rows
    : rows.filter(
        (c) =>
          normalizeText(`${c.name} ${c.company ?? ''} ${c.customer_code ?? ''}`).includes(nq) ||
          (digits.length >= 3 && [clientPhoneE164(c.phone), c.phone].some((n) => (n ?? '').replace(/\D/g, '').includes(digits))),
      );

  return (
    <div className="flex min-h-full flex-col bg-white pb-6 dark:bg-[#1E1E1E]">
      <TabTop title="Mes clients" right={!unlinked ? <RoundButton icon={Search} ariaLabel="Chercher un client" onClick={() => setSearching((s) => !s)} /> : undefined} />
      {unlinked ? (
        <div className="px-5 pt-4">
          <UnlinkedNotice message={(clients.error as Error).message} onRetry={() => void clients.refetch()} />
        </div>
      ) : (
        <>
          {searching && (
            <div className="px-5 pt-3">
              <SearchBox value={q} onChange={setQ} placeholder="Nom, code client, téléphone" autoFocus />
            </div>
          )}
          <div className="px-5 pt-3.5">
            <div className={cn('rounded-lg border px-[18px] pb-4 pt-[18px]', SURFACE.divider)}>
              <div className="flex items-start justify-between gap-3">
                <span className={cn('text-[16px] font-medium', TEXT.muted)}>Paiements · {plural(rows.length, 'client', 'clients')}</span>
                <button type="button" onClick={() => setPick(true)} className={cn('-mr-1 inline-flex h-8 items-center gap-1 rounded px-1 text-[16px] font-semibold', TEXT.strong, FOCUS_RING)}>
                  {monthName(month)} <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              <div className={cn('mt-1.5 text-[40px] font-bold leading-[1.1] tracking-[-0.02em] tabular-nums', TEXT.strong)}>
                {clients.isLoading ? '—' : shortXaf(sum.pay)}<span className={cn('ml-1.5 text-[20px] font-semibold', TEXT.muted)}>XAF</span>
              </div>
              <div className={cn('mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[16px] font-medium', TEXT.body)}>
                <span><b className="font-bold">{sum.active}</b> actif{sum.active > 1 ? 's' : ''}</span>
                <span><b className="font-bold">{num(sum.airKg)}</b> kg avion</span>
                <span><b className="font-bold">{num(sum.seaCbm, 1)}</b> m³</span>
              </div>
            </div>
          </div>

          {clients.isLoading ? (
            <ItemList className="mt-3">{[0, 1, 2].map((i) => <div key={i} className="my-2 h-14 animate-pulse rounded-lg bg-[#F5F5F5] dark:bg-[#383838]" />)}</ItemList>
          ) : clients.isError ? (
            <EmptyLine action={{ label: 'Réessayer', onClick: () => void clients.refetch() }}>Vos clients n’ont pas pu être chargés.</EmptyLine>
          ) : rows.length === 0 ? (
            <EmptyLine>Pas encore de client.</EmptyLine>
          ) : shown.length === 0 ? (
            <EmptyLine>Aucun client ne correspond.</EmptyLine>
          ) : (
            <ItemList className="mt-2">
              {shown.map((c) => {
                const e164 = clientPhoneE164(c.phone);
                const tel = e164 ?? c.phone?.replace(/[^\d+]/g, '') ?? null;
                const round = cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] dark:bg-[#383838]', TEXT.strong, FOCUS_RING);
                return (
                  // La ligne s'ouvre ; Appeler et WhatsApp sont des liens à côté (pas DANS le bouton).
                  <div key={c.user_id} className={cn('flex items-center gap-2 border-b last:border-b-0', SURFACE.divider)}>
                    <ItemRow
                      className="min-w-0 flex-1 border-b-0"
                      leading={<Initials name={c.name || '?'} />}
                      title={c.name || '—'}
                      subtitle={[c.customer_code, `${shortXaf(c.payments_xaf)} ce mois`].filter(Boolean).join(' · ')}
                      onClick={() => setOpen(c)}
                    />
                    {tel && <a href={`tel:${tel}`} aria-label={`Appeler ${c.name}`} className={round}><Phone className="h-5 w-5" /></a>}
                    {e164 && (
                      <a href={whatsappLink(e164)} target="_blank" rel="noreferrer" aria-label={`Écrire à ${c.name} sur WhatsApp`} className={round}>
                        <MessageCircle className="h-5 w-5" />
                      </a>
                    )}
                  </div>
                );
              })}
            </ItemList>
          )}
        </>
      )}

      <MonthSheet open={pick} onClose={() => setPick(false)} value={month} onChange={setMonth} />
      <BottomSheet open={!!open} onClose={() => setOpen(null)}>
        {open && (
          <>
            <h3 className={cn('text-[22px] font-semibold leading-tight', TEXT.strong)}>{open.name || '—'}</h3>
            <p className={cn('mt-1 text-[16px]', TEXT.muted)}>{[open.company, open.customer_code].filter(Boolean).join(' · ') || 'Client'}</p>
            <KVBox
              className="mt-4"
              rows={[
                { label: 'Paiements', value: open.payments_xaf ? `${fmtXaf(open.payments_xaf)} · ${open.payments_count}` : '—' },
                { label: 'Avion', value: open.air_parcels ? `${fmtKg(open.air_kg)} · ${plural(open.air_parcels, 'colis', 'colis')}` : '—' },
                { label: 'Bateau', value: open.sea_parcels ? `${fmtCbm(open.sea_cbm)} · ${plural(open.sea_parcels, 'colis', 'colis')}` : '—' },
                { label: 'Téléphone', value: open.phone ? formatE164ForDisplay(clientPhoneE164(open.phone) ?? open.phone) : '—' },
                { label: 'Client depuis', value: fmtLongDay(open.created_at) },
              ]}
            />
          </>
        )}
      </BottomSheet>
    </div>
  );
}
