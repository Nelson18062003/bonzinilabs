// ============================================================
// Sources & commerciaux — qui apporte les clients, et ce qu'ils rapportent.
//
// Pour chaque source (un commercial, une recommandation, Facebook…) et sur
// la période choisie :
//   · les clients apportés (et combien sont nouveaux sur la période) ;
//   · leurs dépôts VALIDÉS et leurs paiements TERMINÉS (en XAF) ;
//   · les colis qu'ils ont déposés chez nous (nombre, kg, m³).
// C'est la base des futures commissions. Une source s'ouvre sur ses clients,
// un par un, chacun avec ses chiffres.
//
// Un seul écran pour l'ordinateur et le téléphone : une table sur grand
// écran, des cartes sur petit.
// ============================================================
import { useMemo, useState, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Archive, ArchiveRestore, ChevronRight, Pencil, Plus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { DateRangePicker } from '@/components/analytics/DateRangePicker';
import { DateRangeProvider, useDateRange } from '@/lib/analytics/DateRangeContext';
import { formatRangeLabel, toSupabaseBounds } from '@/lib/analytics/dateRange';
import {
  SOURCE_KINDS,
  sourceKindLabel,
  useClientSourceClients,
  useClientSourceReport,
  useCreateClientSource,
  useUpdateClientSource,
  type ClientSourceKind,
  type SourceReportRow,
} from '@/hooks/useClientSources';

const BASE = '/m/clients/sources';
const NONE = 'none';

const xaf = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} XAF`;
const num = (n: number, d = 0) => n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const parcelsText = (n: number, kg: number, cbm: number) => (n === 0 ? '—' : `${num(n)} colis · ${num(kg, 0)} kg · ${num(cbm, 2)} m³`);

type Filter = 'all' | Exclude<ClientSourceKind, 'unknown'> | 'unset';

export function ClientSourcesScreen() {
  const { hasPermission } = useAdminAuth();
  if (!hasPermission('canViewClients')) return <Navigate to="/m" replace />;
  return (
    <DateRangeProvider defaultPreset="this_month">
      <Body />
    </DateRangeProvider>
  );
}

function Body() {
  const { sourceId } = useParams();
  const { range } = useDateRange();
  const { fromISO, toISO } = toSupabaseBounds(range);
  const report = useClientSourceReport(fromISO, toISO);
  if (sourceId) return <SourceDetail sourceId={sourceId === NONE ? null : sourceId} report={report.data} fromIso={fromISO} toIso={toISO} />;
  return <SourceList report={report} />;
}

/* ── Liste des sources ─────────────────────────────────────────────────── */

function SourceList({ report }: { report: ReturnType<typeof useClientSourceReport> }) {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const { range } = useDateRange();
  const [filter, setFilter] = useState<Filter>('all');
  const [adding, setAdding] = useState(false);
  const canAdd = hasPermission('canRegisterClients') || hasPermission('canEditClients');

  const rows = report.data ?? [];
  const totals = useMemo(() => {
    const all = rows.reduce((s, r) => s + r.clients, 0);
    const unset = rows.filter((r) => r.kind === 'none').reduce((s, r) => s + r.clients, 0);
    const fresh = rows.reduce((s, r) => s + r.new_clients, 0);
    return { all, unset, fresh };
  }, [rows]);

  const shown = rows
    .filter((r) => r.is_active || r.clients > 0)
    .filter((r) => (filter === 'all' ? true : filter === 'unset' ? r.kind === 'none' || r.kind === 'unknown' : r.kind === filter))
    // Les sources sans aucun client restent visibles (un commercial tout neuf) ;
    // « Non renseigné » passe en dernier pour ne pas écraser le classement.
    .sort((a, b) => Number(a.kind === 'none') - Number(b.kind === 'none') || b.deposits_xaf + b.payments_xaf - (a.deposits_xaf + a.payments_xaf) || b.clients - a.clients);

  const filters: Array<{ value: Filter; label: string }> = [
    { value: 'all', label: 'Toutes' },
    ...SOURCE_KINDS.map((k) => ({ value: k.kind as Filter, label: k.label })),
    { value: 'unset', label: 'Inconnues' },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-0">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <button type="button" onClick={() => navigate('/m/clients')} className="mb-1 inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Clients
          </button>
          <h1 className="text-[26px] font-bold tracking-tight">Sources & commerciaux</h1>
          <p className="mt-0.5 text-[14px] text-muted-foreground">Qui apporte vos clients, et ce que ces clients rapportent · {formatRangeLabel(range)}</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker showGranularity={false} showCompare={false} size="sm" />
          {canAdd && (
            <button type="button" onClick={() => setAdding(true)} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-[14px] font-semibold text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Nouvelle source
            </button>
          )}
        </div>
      </header>

      {adding && <NewSourceCard onDone={() => setAdding(false)} />}

      <section className="grid grid-cols-3 gap-2 sm:gap-4">
        <Figure label="Clients au total" value={report.isLoading ? '…' : num(totals.all)} />
        <Figure label="Nouveaux sur la période" value={report.isLoading ? '…' : num(totals.fresh)} />
        <Figure
          label="Origine non renseignée"
          value={report.isLoading ? '…' : num(totals.unset)}
          hint={totals.unset > 0 ? 'À compléter depuis la fiche de chaque client' : undefined}
          warn={totals.unset > 0}
        />
      </section>

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              'h-9 shrink-0 rounded-full px-3.5 text-[14px] font-medium transition-colors',
              filter === f.value ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground ring-1 ring-black/10 hover:bg-accent dark:ring-white/15',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-black/[0.06] dark:ring-white/10">
        {report.isLoading ? (
          <div className="space-y-2 p-5">{[0, 1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />)}</div>
        ) : report.isError ? (
          <div className="p-8 text-center text-[14px]">
            Le rapport n’a pas pu être chargé.{' '}
            <button type="button" onClick={() => void report.refetch()} className="font-semibold underline">
              Réessayer
            </button>
          </div>
        ) : shown.length === 0 ? (
          <div className="p-10 text-center text-[14px] text-muted-foreground">Aucune source dans cette catégorie.</div>
        ) : (
          <>
            {/* Grand écran : une table */}
            <table className="hidden w-full md:table">
              <thead>
                <tr className="border-b border-border/70 text-left text-[12.5px] font-medium text-muted-foreground">
                  <th className="px-6 pb-3 pt-4 font-medium">Source</th>
                  <th className="px-4 pb-3 pt-4 text-right font-medium">Clients</th>
                  <th className="px-4 pb-3 pt-4 text-right font-medium">Dépôts validés</th>
                  <th className="px-4 pb-3 pt-4 text-right font-medium">Paiements</th>
                  <th className="px-6 pb-3 pt-4 text-right font-medium">Colis déposés</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr
                    key={r.source_id ?? NONE}
                    onClick={() => navigate(`${BASE}/${r.source_id ?? NONE}`)}
                    className="cursor-pointer border-b border-border/50 last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-6 py-4">
                      <SourceName row={r} />
                    </td>
                    <td className="px-4 py-4 text-right tabular-nums">
                      <span className="font-semibold">{num(r.clients)}</span>
                      {r.new_clients > 0 && <span className="ml-1.5 text-[12.5px] text-emerald-700 dark:text-emerald-400">+{r.new_clients}</span>}
                    </td>
                    <td className="px-4 py-4 text-right tabular-nums">{r.deposits_xaf ? xaf(r.deposits_xaf) : '—'}</td>
                    <td className="px-4 py-4 text-right tabular-nums">{r.payments_xaf ? xaf(r.payments_xaf) : '—'}</td>
                    <td className="px-6 py-4 text-right tabular-nums text-muted-foreground">{parcelsText(r.parcels, r.parcels_kg, r.parcels_cbm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Téléphone : des cartes */}
            <ul className="divide-y divide-border/60 md:hidden">
              {shown.map((r) => (
                <li key={r.source_id ?? NONE}>
                  <button type="button" onClick={() => navigate(`${BASE}/${r.source_id ?? NONE}`)} className="flex w-full items-center gap-3 px-4 py-4 text-left active:bg-muted/50">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <SourceName row={r} />
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[13px] tabular-nums">
                        <span className="text-muted-foreground">Clients</span>
                        <span className="text-right font-semibold">
                          {num(r.clients)}
                          {r.new_clients > 0 && <span className="ml-1 font-normal text-emerald-700 dark:text-emerald-400">+{r.new_clients}</span>}
                        </span>
                        <span className="text-muted-foreground">Dépôts</span>
                        <span className="text-right">{r.deposits_xaf ? xaf(r.deposits_xaf) : '—'}</span>
                        <span className="text-muted-foreground">Paiements</span>
                        <span className="text-right">{r.payments_xaf ? xaf(r.payments_xaf) : '—'}</span>
                        <span className="text-muted-foreground">Colis</span>
                        <span className="text-right">{r.parcels ? `${num(r.parcels)} · ${num(r.parcels_kg)} kg` : '—'}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <p className="text-[12.5px] leading-relaxed text-muted-foreground">
        Dépôts : validés sur la période. Paiements : terminés sur la période. Colis : enregistrés à l’entrepôt sur la période (dépôts annulés exclus).
        Le nombre de clients est le total de la source ; « +n », les nouveaux de la période.
      </p>
    </div>
  );
}

function SourceName({ row }: { row: SourceReportRow }) {
  return (
    <div className="min-w-0">
      <div className={cn('truncate text-[15px] font-semibold', row.kind === 'none' && 'text-amber-700 dark:text-amber-400', !row.is_active && 'text-muted-foreground')}>
        {row.kind === 'unknown' ? 'Je ne sais pas' : row.label}
        {!row.is_active && <span className="ml-2 text-[12px] font-medium">archivée</span>}
      </div>
      <div className="text-[12.5px] text-muted-foreground">
        {row.kind === 'none' ? 'À compléter depuis la fiche de chaque client' : sourceKindLabel(row.kind)}
        {row.phone && ` · ${row.phone}`}
      </div>
    </div>
  );
}

function Figure({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div className="rounded-2xl bg-card p-3.5 ring-1 ring-black/[0.06] sm:p-5 dark:ring-white/10">
      <div className="text-[12px] font-medium leading-tight text-muted-foreground sm:text-[13px]">{label}</div>
      <div className={cn('mt-1.5 text-[20px] font-bold tracking-tight tabular-nums sm:text-[28px]', warn && 'text-amber-700 dark:text-amber-400')}>{value}</div>
      {hint && <div className="mt-0.5 hidden text-[12.5px] text-muted-foreground sm:block">{hint}</div>}
    </div>
  );
}

/* ── Nouvelle source ───────────────────────────────────────────────────── */

function NewSourceCard({ onDone }: { onDone: () => void }) {
  const create = useCreateClientSource();
  const [kind, setKind] = useState<Exclude<ClientSourceKind, 'unknown'>>('commercial');
  const [label, setLabel] = useState('');
  const [phone, setPhone] = useState('');
  const withPhone = SOURCE_KINDS.find((k) => k.kind === kind)?.withPhone ?? false;
  const ok = label.trim().length >= 2;

  return (
    <div className="space-y-4 rounded-2xl bg-card p-5 ring-1 ring-black/[0.06] dark:ring-white/10">
      <div className="text-[16px] font-semibold">Nouvelle source</div>
      <div className="flex flex-wrap gap-2">
        {SOURCE_KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            onClick={() => setKind(k.kind)}
            className={cn('h-9 rounded-full px-3.5 text-[14px] font-medium', kind === k.kind ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent')}
          >
            {k.label}
          </button>
        ))}
      </div>
      <p className="text-[13px] text-muted-foreground">{SOURCE_KINDS.find((k) => k.kind === kind)?.hint}</p>
      <div className={cn('grid gap-3', withPhone && 'sm:grid-cols-2')}>
        <Input label="Nom" value={label} onChange={setLabel} placeholder={kind === 'commercial' ? 'Ex. Jean Mbarga' : ''} autoFocus />
        {withPhone && <Input label="Téléphone (facultatif)" value={phone} onChange={setPhone} placeholder="+237 6…" />}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="h-10 rounded-xl px-4 text-[14px] font-semibold hover:bg-accent">
          Annuler
        </button>
        <button
          type="button"
          disabled={!ok || create.isPending}
          onClick={() => create.mutate({ kind, label: label.trim(), phone: withPhone ? phone.trim() || null : null }, { onSuccess: onDone })}
          className="h-10 rounded-xl bg-primary px-4 text-[14px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {create.isPending ? '…' : 'Ajouter'}
        </button>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, autoFocus }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="h-12 w-full rounded-xl border border-input bg-card px-3.5 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  );
}

/* ── Détail d'une source ───────────────────────────────────────────────── */

function SourceDetail({ sourceId, report, fromIso, toIso }: { sourceId: string | null; report: SourceReportRow[] | undefined; fromIso: string; toIso: string }) {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const { range } = useDateRange();
  const clients = useClientSourceClients(sourceId, fromIso, toIso);
  const update = useUpdateClientSource();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState('');
  const [phone, setPhone] = useState('');

  const row = report?.find((r) => (r.source_id ?? null) === sourceId);
  const list = clients.data ?? [];
  const sum = list.reduce(
    (s, c) => ({ dep: s.dep + c.deposits_xaf, pay: s.pay + c.payments_xaf, parcels: s.parcels + c.parcels, kg: s.kg + c.parcels_kg, cbm: s.cbm + c.parcels_cbm, active: s.active + (c.deposits_count + c.payments_count + c.parcels > 0 ? 1 : 0) }),
    { dep: 0, pay: 0, parcels: 0, kg: 0, cbm: 0, active: 0 },
  );
  const canEdit = hasPermission('canEditClients') && !!row && !row.is_system;
  const title = !row ? '…' : row.kind === 'unknown' ? 'Je ne sais pas' : row.label;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-0">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <button type="button" onClick={() => navigate(BASE)} className="mb-1 inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Sources & commerciaux
          </button>
          <h1 className={cn('truncate text-[26px] font-bold tracking-tight', row?.kind === 'none' && 'text-amber-700 dark:text-amber-400')}>{title}</h1>
          <p className="mt-0.5 text-[14px] text-muted-foreground">
            {row ? sourceKindLabel(row.kind) : ''}
            {row?.phone && ` · ${row.phone}`}
            {row && !row.is_active && ' · archivée'} · {formatRangeLabel(range)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker showGranularity={false} showCompare={false} size="sm" />
          {canEdit && row && (
            <>
              <button
                type="button"
                onClick={() => {
                  setLabel(row.label);
                  setPhone(row.phone ?? '');
                  setEditing(true);
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[14px] font-semibold ring-1 ring-black/10 hover:bg-accent dark:ring-white/15"
              >
                <Pencil className="h-4 w-4" /> Modifier
              </button>
              <button
                type="button"
                onClick={() => update.mutate({ id: row.source_id!, isActive: !row.is_active })}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[14px] font-semibold ring-1 ring-black/10 hover:bg-accent dark:ring-white/15"
              >
                {row.is_active ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                {row.is_active ? 'Archiver' : 'Réactiver'}
              </button>
            </>
          )}
        </div>
      </header>

      {editing && row && (
        <div className="space-y-4 rounded-2xl bg-card p-5 ring-1 ring-black/[0.06] dark:ring-white/10">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Nom" value={label} onChange={setLabel} autoFocus />
            <Input label="Téléphone" value={phone} onChange={setPhone} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="h-10 rounded-xl px-4 text-[14px] font-semibold hover:bg-accent">
              Annuler
            </button>
            <button
              type="button"
              disabled={label.trim().length < 2 || update.isPending}
              onClick={() => update.mutate({ id: row.source_id!, label: label.trim(), phone: phone.trim() || null }, { onSuccess: () => setEditing(false) })}
              className="h-10 rounded-xl bg-primary px-4 text-[14px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Enregistrer
            </button>
          </div>
        </div>
      )}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Figure label="Clients apportés" value={clients.isLoading ? '…' : num(list.length)} hint={row?.new_clients ? `dont ${row.new_clients} nouveaux sur la période` : undefined} />
        <Figure label="Dépôts validés" value={clients.isLoading ? '…' : xaf(sum.dep)} />
        <Figure label="Paiements" value={clients.isLoading ? '…' : xaf(sum.pay)} />
        <Figure label="Colis déposés" value={clients.isLoading ? '…' : num(sum.parcels)} hint={sum.parcels ? `${num(sum.kg)} kg · ${num(sum.cbm, 2)} m³` : undefined} />
      </section>

      <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-black/[0.06] dark:ring-white/10">
        <div className="flex items-center justify-between px-6 pb-2 pt-5">
          <h2 className="text-[16px] font-semibold">Ses clients</h2>
          {!clients.isLoading && <span className="text-[13px] text-muted-foreground">{sum.active} actifs sur la période</span>}
        </div>
        {clients.isLoading ? (
          <div className="space-y-2 p-5">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />)}</div>
        ) : clients.isError ? (
          <div className="p-8 text-center text-[14px]">
            La liste n’a pas pu être chargée.{' '}
            <button type="button" onClick={() => void clients.refetch()} className="font-semibold underline">
              Réessayer
            </button>
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-[14px] text-muted-foreground">
            <Users className="h-6 w-6" />
            Aucun client pour cette source pour l’instant.
          </div>
        ) : (
          <ul className="px-2 pb-2">
            {list.map((c) => (
              <li key={c.user_id}>
                <button
                  type="button"
                  onClick={() => navigate(`/m/clients/${c.user_id}`)}
                  className="flex w-full flex-wrap items-center gap-x-6 gap-y-1 rounded-xl px-4 py-3.5 text-left hover:bg-muted/40"
                >
                  <span className="min-w-[180px] flex-1">
                    <span className="block truncate text-[15px] font-semibold">{c.name || '—'}</span>
                    <span className="block text-[12.5px] text-muted-foreground">
                      {[c.customer_code, c.company].filter(Boolean).join(' · ') || 'Client'} · depuis le {new Date(c.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </span>
                  <Metric label="Dépôts" value={c.deposits_xaf ? xaf(c.deposits_xaf) : '—'} />
                  <Metric label="Paiements" value={c.payments_xaf ? xaf(c.payments_xaf) : '—'} />
                  <Metric label="Colis" value={c.parcels ? `${num(c.parcels)} · ${num(c.parcels_kg)} kg` : '—'} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span className="w-[150px] text-right tabular-nums">
      <span className="block text-[11.5px] text-muted-foreground">{label}</span>
      <span className="block text-[14px] font-medium">{value}</span>
    </span>
  );
}
