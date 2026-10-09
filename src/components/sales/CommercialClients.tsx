// ============================================================
// ESPACE COMMERCIAL — « Mes clients ». Les clients dont il est l'origine,
// chacun avec ce qu'il a fait dans le mois choisi : paiements terminés
// (XAF), fret avion (kg, colis), fret bateau (m³, colis). Les totaux en
// tête. Appeler / WhatsApp depuis la ligne ; aucune fiche « /m » (il n'y a
// pas accès). Données : commercial_clients, limité à SA fiche.
// ============================================================
import { useMemo, useState } from 'react';
import { Handshake, MessageCircle, Phone, Plane, Ship, Users, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeText } from '@/lib/clientSearch';
import { useCommercialClients } from '@/hooks/useSales';
import { clientPhoneE164, currentMonth, fmtCbm, fmtCount, fmtKg, fmtXaf, monthLabel, whatsappLink, type CommercialClient } from '@/lib/sales';
import { Figure, ListSkeleton, LoadError, MonthSwitcher, PhoneNumber, SALES_CARD, ScreenHeader, UnlinkedNotice } from './SalesBits';
import { SearchField } from './SalesUi';
import { btn } from './uiClasses';
import { fmtLongDay, initialsOf, isUnlinkedError, plural } from './salesHelpers';

const isActive = (c: CommercialClient) => c.payments_count + c.air_parcels + c.sea_parcels > 0;

export function CommercialClients() {
  const thisMonth = useMemo(() => currentMonth(), []);
  const [month, setMonth] = useState(thisMonth);
  const [q, setQ] = useState('');
  const clients = useCommercialClients(month);
  const unlinked = clients.isError && isUnlinkedError(clients.error);
  const rows = clients.data ?? [];
  const monthName = monthLabel(month).split(' ')[0];

  const sum = rows.reduce(
    (s, c) => ({
      pay: s.pay + c.payments_xaf,
      payN: s.payN + c.payments_count,
      airKg: s.airKg + c.air_kg,
      airN: s.airN + c.air_parcels,
      seaCbm: s.seaCbm + c.sea_cbm,
      seaN: s.seaN + c.sea_parcels,
      active: s.active + (isActive(c) ? 1 : 0),
    }),
    { pay: 0, payN: 0, airKg: 0, airN: 0, seaCbm: 0, seaN: 0, active: 0 },
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
    <div>
      <ScreenHeader title="Mes clients" subtitle={clients.data ? `${plural(rows.length, 'client', 'clients')} · ${sum.active} actif${sum.active > 1 ? 's' : ''} en ${monthName}` : ' '} />

      <div className="space-y-5 px-4 pt-4 sm:px-6">
        {unlinked ? (
          <UnlinkedNotice message={(clients.error as Error).message} onRetry={() => void clients.refetch()} />
        ) : (
          <>
            <div className="flex justify-center">
              <MonthSwitcher month={month} onChange={setMonth} max={thisMonth} className="w-full sm:w-auto" />
            </div>

            {clients.isLoading ? (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className={cn('s-skeleton h-24 animate-pulse rounded-[18px] bg-muted', i < 2 && 'col-span-2 md:col-span-1')} />
                  ))}
                </div>
                <div className={SALES_CARD}>
                  <ListSkeleton rows={4} />
                </div>
              </>
            ) : clients.isError ? (
              <div className={SALES_CARD}>
                <LoadError message="Vos clients n’ont pas pu être chargés." onRetry={() => void clients.refetch()} />
              </div>
            ) : rows.length === 0 ? (
              <div className={cn(SALES_CARD, 's-enter flex flex-col items-center px-6 py-12 text-center')}>
                <span className="s-inset flex h-11 w-11 items-center justify-center rounded-xl">
                  <Handshake className="h-5 w-5 s-ink-3" />
                </span>
                <h2 className="mt-4 text-[18px] font-semibold tracking-[-0.01em] s-ink">Pas encore de client</h2>
                <p className="mt-1.5 max-w-sm text-[15px] leading-relaxed s-ink-2">
                  Un client apparaît ici dès que la réception crée son compte en vous choisissant comme origine — ou tout seul, quand son numéro est
                  celui de l’un de vos prospects.
                </p>
              </div>
            ) : (
              <>
                {/* Téléphone : clients et paiements sur toute la largeur (un montant en XAF passait sur deux lignes dans une demi-tuile). */}
                <section className="s-enter grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Figure className="col-span-2 md:col-span-1" icon={Users} label="Clients" value={fmtCount(rows.length)} hint={`${sum.active} actif${sum.active > 1 ? 's' : ''} en ${monthName}`} />
                  <Figure className="col-span-2 md:col-span-1" icon={Wallet} label="Paiements" value={fmtXaf(sum.pay)} hint={plural(sum.payN, 'paiement', 'paiements')} />
                  <Figure icon={Plane} label="Fret avion" value={fmtKg(sum.airKg)} hint={plural(sum.airN, 'colis', 'colis')} />
                  <Figure icon={Ship} label="Fret bateau" value={fmtCbm(sum.seaCbm)} hint={plural(sum.seaN, 'colis', 'colis')} />
                </section>

                {rows.length > 6 && <SearchField value={q} onChange={setQ} placeholder="Nom, entreprise, code client, téléphone" ariaLabel="Rechercher un client" />}

                <div className={cn('overflow-hidden', SALES_CARD)}>
                  {shown.length === 0 ? (
                    <div className="p-10 text-center text-[15px] s-ink-2">Aucun client ne correspond à cette recherche.</div>
                  ) : (
                    <ul className="s-divide">
                      {shown.map((c, i) => (
                        <li key={c.user_id} className="s-enter" style={i < 12 ? { animationDelay: `${60 + i * 28}ms` } : undefined}>
                          <ClientRow c={c} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <p className="px-1 pb-2 text-[13px] leading-relaxed s-ink-3">
                  Chiffres de {monthName} : paiements terminés, colis enregistrés (avion au bureau, bateau à l’entrepôt), dépôts annulés exclus.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ClientRow({ c }: { c: CommercialClient }) {
  const e164 = clientPhoneE164(c.phone);
  const tel = e164 ?? c.phone?.replace(/[^\d+]/g, '') ?? null;
  const sub = [c.company, c.customer_code].filter(Boolean).join('\u00a0· ');
  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3">
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold', isActive(c) ? 's-ink bg-[hsl(var(--s-accent-tint))] shadow-[inset_0_0_0_1px_hsl(var(--s-accent)/0.2)]' : 's-field-bg s-ink-2')} aria-hidden>
          {initialsOf(c.name)}
        </span>
        {/* Le nom partage sa ligne avec Appeler / WhatsApp ; le numéro (drapeau, format international), puis l'entreprise, le code et « client depuis » passent dessous, sur toute la largeur. */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1 truncate text-[16px] font-semibold s-ink">{c.name || '—'}</div>
            {tel && (
              <div className="flex shrink-0 items-center gap-1.5">
                <a href={`tel:${tel}`} aria-label={`Appeler ${c.name}`} className={btn('quiet', 'icon')}>
                  <Phone className="h-4 w-4" />
                </a>
                {e164 && (
                  <a href={whatsappLink(e164)} target="_blank" rel="noreferrer" aria-label={`Écrire à ${c.name} sur WhatsApp`} className={btn('whatsapp', 'icon')}>
                    <MessageCircle className="h-4 w-4" />
                  </a>
                )}
              </div>
            )}
          </div>
          {c.phone && (
            <div className="text-[13px] s-ink-2">
              <PhoneNumber e164={e164 ?? c.phone} />
            </div>
          )}
          {/* Entreprise et code sur une ligne, « client depuis » sur la sienne : aucun « · » ne pend en bout de ligne. */}
          {sub && <div className="text-[13px] tabular-nums s-ink-2">{sub}</div>}
          <div className="text-[13px] s-ink-2">Client depuis le {fmtLongDay(c.created_at)}</div>
        </div>
      </div>
      <dl className="s-inset mt-3 grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl bg-muted/50 px-3 py-2.5 text-[13px] tabular-nums sm:ml-[3.25rem] sm:grid-cols-3">
        <Cell className="col-span-2 sm:col-span-1" label="Paiements" value={c.payments_xaf ? fmtXaf(c.payments_xaf) : '—'} hint={c.payments_count ? plural(c.payments_count, 'paiement', 'paiements') : undefined} />
        <Cell label="Avion" value={c.air_parcels ? fmtKg(c.air_kg) : '—'} hint={c.air_parcels ? plural(c.air_parcels, 'colis', 'colis') : undefined} />
        <Cell label="Bateau" value={c.sea_parcels ? fmtCbm(c.sea_cbm) : '—'} hint={c.sea_parcels ? plural(c.sea_parcels, 'colis', 'colis') : undefined} />
      </dl>
    </div>
  );
}

function Cell({ label, value, hint, className }: { label: string; value: string; hint?: string; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-[12px] s-ink-2">{label}</dt>
      <dd className="truncate text-[14px] font-semibold s-ink">{value}</dd>
      {hint && <dd className="truncate text-[12px] s-ink-2">{hint}</dd>}
    </div>
  );
}
