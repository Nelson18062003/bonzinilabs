// ============================================================
// ESPACE COMMERCIAL — « Mes clients ». Les clients dont il est l'origine,
// chacun avec ce qu'il a fait dans le mois choisi : paiements terminés
// (XAF), fret avion (kg, colis), fret bateau (m³, colis). Les totaux en
// tête. Appeler / WhatsApp depuis la ligne ; aucune fiche « /m » (il n'y a
// pas accès). Données : commercial_clients, limité à SA fiche.
// ============================================================
import { useMemo, useState } from 'react';
import { Handshake, MessageCircle, Phone, Plane, Search, Ship, Users, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeText } from '@/lib/clientSearch';
import { useCommercialClients } from '@/hooks/useSales';
import { currentMonth, fmtCbm, fmtCount, fmtKg, fmtXaf, monthLabel, toE164, whatsappLink, type CommercialClient } from '@/lib/sales';
import { TextInput } from '@/mobile/designKit';
import { Figure, ListSkeleton, LoadError, MonthSwitcher, SALES_CARD, ScreenHeader, UnlinkedNotice } from './SalesBits';
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
          (digits.length >= 3 && (c.phone ?? '').replace(/\D/g, '').includes(digits)),
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
                    <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
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
              <div className={cn(SALES_CARD, 'flex flex-col items-center px-6 py-12 text-center')}>
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Handshake className="h-5 w-5 text-muted-foreground" />
                </span>
                <h2 className="mt-4 text-[17px] font-semibold">Pas encore de client</h2>
                <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-muted-foreground">
                  Un client apparaît ici dès que la réception crée son compte en vous choisissant comme origine — ou tout seul, quand son numéro est
                  celui de l’un de vos prospects.
                </p>
              </div>
            ) : (
              <>
                <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Figure icon={Users} label="Clients" value={fmtCount(rows.length)} hint={`${sum.active} actif${sum.active > 1 ? 's' : ''} en ${monthName}`} />
                  <Figure icon={Wallet} label="Paiements" value={fmtXaf(sum.pay)} hint={plural(sum.payN, 'paiement', 'paiements')} />
                  <Figure icon={Plane} label="Fret avion" value={fmtKg(sum.airKg)} hint={plural(sum.airN, 'colis', 'colis')} />
                  <Figure icon={Ship} label="Fret bateau" value={fmtCbm(sum.seaCbm)} hint={plural(sum.seaN, 'colis', 'colis')} />
                </section>

                {rows.length > 6 && (
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <TextInput
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Nom, entreprise, code client, téléphone"
                      aria-label="Rechercher un client"
                      inputMode="search"
                      autoComplete="off"
                      className="h-12 rounded-xl border-input bg-card pl-11 dark:bg-card"
                    />
                  </div>
                )}

                <div className={cn('overflow-hidden', SALES_CARD)}>
                  {shown.length === 0 ? (
                    <div className="p-10 text-center text-[14px] text-muted-foreground">Aucun client ne correspond à cette recherche.</div>
                  ) : (
                    <ul className="divide-y divide-border/60">
                      {shown.map((c) => (
                        <li key={c.user_id}>
                          <ClientRow c={c} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <p className="pb-2 text-[12.5px] leading-relaxed text-muted-foreground">
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
  const e164 = c.phone ? toE164(c.phone) : null;
  const tel = e164 ?? c.phone?.replace(/[^\d+]/g, '') ?? null;
  const sub = [c.company, c.customer_code].filter(Boolean).join(' · ');
  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3">
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-bold', isActive(c) ? 'bg-primary/10 text-foreground' : 'bg-muted text-muted-foreground')} aria-hidden>
          {initialsOf(c.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold">{c.name || '—'}</div>
          <div className="truncate text-[13px] tabular-nums text-muted-foreground">
            {sub && `${sub} · `}client depuis le {fmtLongDay(c.created_at)}
          </div>
        </div>
        {tel && (
          <div className="flex shrink-0 items-center gap-1.5">
            <a
              href={`tel:${tel}`}
              aria-label={`Appeler ${c.name}`}
              className="flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-black/10 transition-colors hover:bg-accent dark:ring-white/15"
            >
              <Phone className="h-4 w-4" />
            </a>
            {e164 && (
              <a
                href={whatsappLink(e164)}
                target="_blank"
                rel="noreferrer"
                aria-label={`Écrire à ${c.name} sur WhatsApp`}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] text-white transition-colors hover:bg-[#1DA851]"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
            )}
          </div>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl bg-muted/50 px-3 py-2.5 text-[13px] tabular-nums sm:ml-[3.25rem] sm:grid-cols-3">
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
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="truncate font-semibold">{value}</dd>
      {hint && <dd className="truncate text-[12px] text-muted-foreground">{hint}</dd>}
    </div>
  );
}
