/**
 * Sources des clients — refonte v2 (maquettes 10/23, 10/24, 10/25).
 * Garde `canViewClients` comme l'écran d'avant ; créer : canRegisterClients
 * ou canEditClients ; modifier / archiver : canEditClients, hors sources
 * système (avec confirmation, ce que l'ancien écran n'avait pas).
 *
 * Liste : le total des clients, les nouveaux et les sans origine de la
 * période (« Octobre ⌄ »), les types en puces, une ligne par source.
 * Une source : ses 4 chiffres et ses clients ; Modifier et Archiver dans
 * « … ». « + » : nouvelle source (type en tuiles, nom, téléphone).
 * RPC : get_client_source_report, get_client_source_clients,
 * create_client_source, update_client_source.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Archive, ArchiveRestore, ChevronDown, Flag, Globe, HelpCircle, Megaphone, Pencil, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  SOURCE_KINDS, sourceKindLabel, useClientSourceClients, useClientSourceReport, useCreateClientSource, useUpdateClientSource,
  type ClientSourceKind, type SourceReportRow,
} from '@/hooks/useClientSources';
import { PRESET_LABELS, buildRangeFromPreset, toSupabaseBounds, type PresetId } from '@/lib/analytics/dateRange';
import {
  ActionSheet, BigButton, BottomSheet, Chip, ConfirmSheet, EmptyLine, IconCircle, Initials, ItemList, ItemRow, MoreButton, RoundButton, ScreenTop, SectionHead, TEXT, SURFACE, FOCUS_RING,
  useSheet,
} from '@/mobile/designKit';
import { BigInput, ChipRow, FieldLabel, Tiles, shortXaf } from '@/mobile/screens/clients/parts';
import { shortDay } from '@/mobile/screens/clients/ledgerRows';

const BASE = '/m/clients/sources';
const NONE = 'none';
type Filter = 'all' | Exclude<ClientSourceKind, 'unknown'> | 'unset';
const PRESETS: PresetId[] = ['this_month', 'last_month', 'last_30_days', 'last_90_days', 'this_quarter', 'this_year', 'last_year', 'all_time'];

const num = (n: number) => Number(n || 0).toLocaleString('fr-FR').replace(/\u202F/g, '\u00A0');

function SourceLeading({ row, size = 44 }: { row: Pick<SourceReportRow, 'kind' | 'label'>; size?: number }) {
  // « Ets Kamga (client) » → « EK » : les initiales des mots seulement.
  if (row.kind === 'commercial' || row.kind === 'referral') return <Initials name={row.label.replace(/[^\p{L}\s-]/gu, ' ')} size={size} />;
  const Icon = row.kind === 'social' || row.kind === 'online' ? Globe : row.kind === 'event' ? Flag : row.kind === 'none' || row.kind === 'unknown' ? HelpCircle : Megaphone;
  if (size === 44) return <IconCircle icon={Icon} />;
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] text-[#1E1E1E] dark:bg-[#383838] dark:text-[#F5F5F5]" style={{ width: size, height: size }}>
      <Icon style={{ width: size * 0.4, height: size * 0.4 }} />
    </span>
  );
}

export function SourcesV2() {
  const { hasPermission } = useAdminAuth();
  if (!hasPermission('canViewClients')) return <Navigate to="/m" replace />;
  return <Body />;
}

function Body() {
  const { sourceId } = useParams();
  const [preset, setPreset] = useState<PresetId>('this_month');
  const { fromISO, toISO } = useMemo(() => toSupabaseBounds(buildRangeFromPreset(preset)), [preset]);
  const report = useClientSourceReport(fromISO, toISO);
  const [pick, setPick] = useState(false);
  const periodBtn = (
    <button type="button" onClick={() => setPick(true)} className={cn('-mr-1 inline-flex h-8 items-center gap-1 rounded px-1 text-[16px] font-semibold', TEXT.strong, FOCUS_RING)}>
      {PRESET_LABELS[preset]} <ChevronDown className="h-4 w-4" />
    </button>
  );
  return (
    <>
      {sourceId ? (
        <Detail sourceId={sourceId === NONE ? null : sourceId} rows={report.data} fromIso={fromISO} toIso={toISO} periodBtn={periodBtn} />
      ) : (
        <List report={report} periodBtn={periodBtn} />
      )}
      <BottomSheet open={pick} onClose={() => setPick(false)}>
        <h3 className={cn('mb-2 text-[22px] font-semibold leading-tight', TEXT.strong)}>La période</h3>
        {PRESETS.map((p) => (
          <button key={p} type="button" onClick={() => { setPreset(p); setPick(false); }} className="flex min-h-[52px] w-full items-center justify-between border-b border-[#D9D9D9] text-left last:border-b-0 dark:border-[#444444]">
            <span className={cn('text-[17px] font-semibold', TEXT.strong)}>{PRESET_LABELS[p]}</span>
            {p === preset && <span className={cn('text-[16px] font-semibold', TEXT.strong)}>✓</span>}
          </button>
        ))}
      </BottomSheet>
    </>
  );
}

function List({ report, periodBtn }: { report: ReturnType<typeof useClientSourceReport>; periodBtn: ReactNode }) {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const [adding, setAdding] = useState(false);
  const canAdd = hasPermission('canRegisterClients') || hasPermission('canEditClients');
  const rows = useMemo(() => report.data ?? [], [report.data]);
  const totals = useMemo(() => ({
    all: rows.reduce((s, r) => s + r.clients, 0),
    fresh: rows.reduce((s, r) => s + r.new_clients, 0),
    unset: rows.filter((r) => r.kind === 'none').reduce((s, r) => s + r.clients, 0),
  }), [rows]);
  const shown = rows
    .filter((r) => r.is_active || r.clients > 0)
    .filter((r) => (filter === 'all' ? true : filter === 'unset' ? r.kind === 'none' || r.kind === 'unknown' : r.kind === filter))
    .sort((a, b) => Number(a.kind === 'none') - Number(b.kind === 'none') || b.clients - a.clients);
  const filters: { value: Filter; label: string }[] = [
    { value: 'all', label: 'Toutes' },
    ...SOURCE_KINDS.map((k) => ({ value: k.kind as Filter, label: k.label })),
    { value: 'unset', label: 'Inconnues' },
  ];

  return (
    <div className="min-h-[100dvh] bg-white pb-8 dark:bg-[#1E1E1E]">
      <ScreenTop title="Sources des clients" backTo="/m/clients" right={canAdd ? <RoundButton icon={Plus} ariaLabel="Nouvelle source" onClick={() => setAdding(true)} className="border-0" /> : undefined} />
      <div className="px-5 pt-5">
        <div className={cn('rounded-lg border px-[18px] pb-4 pt-[18px]', SURFACE.divider)}>
          <div className="flex items-start justify-between gap-3">
            <span className={cn('text-[16px] font-medium', TEXT.muted)}>Clients au total</span>
            {periodBtn}
          </div>
          <div className={cn('mt-1.5 text-[40px] font-bold leading-[1.1] tracking-[-0.02em] tabular-nums', TEXT.strong)}>{report.isLoading ? '—' : num(totals.all)}</div>
          <div className={cn('mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[16px] font-medium', TEXT.body)}>
            <span><b className="font-bold">{num(totals.fresh)}</b> nouveaux</span>
            <span><b className="font-bold">{num(totals.unset)}</b> sans origine</span>
          </div>
        </div>
      </div>
      <ChipRow className="mt-3.5">
        {filters.map((f) => <Chip key={f.value} label={f.label} active={filter === f.value} onClick={() => setFilter(f.value)} />)}
      </ChipRow>
      {report.isLoading ? (
        <ItemList className="mt-2">{[0, 1, 2, 3].map((i) => <div key={i} className="my-2 h-14 animate-pulse rounded-lg bg-[#F5F5F5] dark:bg-[#383838]" />)}</ItemList>
      ) : report.isError ? (
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void report.refetch() }}>Le rapport n’a pas pu être chargé.</EmptyLine>
      ) : shown.length === 0 ? (
        <EmptyLine>Aucune source ici.</EmptyLine>
      ) : (
        <ItemList className="mt-1">
          {shown.map((r) => (
            <ItemRow
              key={r.source_id ?? NONE}
              leading={<SourceLeading row={r} />}
              title={r.kind === 'none' ? 'Inconnues' : r.kind === 'unknown' ? 'Je ne sais pas' : r.label}
              subtitle={r.kind === 'none' ? 'À compléter sur chaque fiche' : `${sourceKindLabel(r.kind)}${r.new_clients ? ` · +${r.new_clients}` : ''}${r.is_active ? '' : ' · archivée'}`}
              right={
                <span className="shrink-0 text-right">
                  <span className={cn('block text-[17px] font-bold tabular-nums', TEXT.strong)}>{num(r.clients)}</span>
                  <span className={cn('block text-[15px]', TEXT.muted)}>clients</span>
                </span>
              }
              onClick={() => navigate(`${BASE}/${r.source_id ?? NONE}`)}
            />
          ))}
        </ItemList>
      )}
      {adding && <NewSourceSheet onClose={() => setAdding(false)} />}
    </div>
  );
}

function NewSourceSheet({ onClose }: { onClose: () => void }) {
  const create = useCreateClientSource();
  const [kind, setKind] = useState<Exclude<ClientSourceKind, 'unknown' | 'parcel'>>('commercial');
  const [label, setLabel] = useState('');
  const [phone, setPhone] = useState('');
  const withPhone = SOURCE_KINDS.find((k) => k.kind === kind)?.withPhone ?? false;
  const ok = label.trim().length >= 2;
  return (
    <BottomSheet open onClose={create.isPending ? () => undefined : onClose}>
      <h3 className={cn('text-[22px] font-semibold leading-tight', TEXT.strong)}>Nouvelle source</h3>
      <FieldLabel className="mt-4">Type</FieldLabel>
      <Tiles<string> cols={3} ariaLabel="Type" options={SOURCE_KINDS.map((k) => ({ value: k.kind, label: k.label }))} value={kind} onChange={(v) => setKind(v as typeof kind)} />
      <FieldLabel htmlFor="ns-label">Nom</FieldLabel>
      <BigInput id="ns-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder={kind === 'commercial' ? 'Prénom Nom' : 'Facebook, Salon…'} />
      {withPhone && (
        <>
          <FieldLabel htmlFor="ns-phone">Téléphone · facultatif</FieldLabel>
          <BigInput id="ns-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+237 6XX XX XX XX" />
        </>
      )}
      <BigButton className="mt-5" disabled={!ok} loading={create.isPending} onClick={() => create.mutate({ kind, label: label.trim(), phone: withPhone ? phone.trim() || null : null }, { onSuccess: onClose })}>Ajouter</BigButton>
    </BottomSheet>
  );
}

function Detail({ sourceId, rows, fromIso, toIso, periodBtn }: { sourceId: string | null; rows: SourceReportRow[] | undefined; fromIso: string; toIso: string; periodBtn: ReactNode }) {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const row = (rows ?? []).find((r) => r.source_id === sourceId) ?? (sourceId === null ? (rows ?? []).find((r) => r.kind === 'none') : undefined);
  const clients = useClientSourceClients(sourceId, fromIso, toIso);
  const update = useUpdateClientSource();
  const more = useSheet();
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [label, setLabel] = useState('');
  const [phone, setPhone] = useState('');
  const list = clients.data ?? [];
  const sum = list.reduce((s, c) => ({ dep: s.dep + c.deposits_xaf, pay: s.pay + c.payments_xaf, parcels: s.parcels + c.parcels }), { dep: 0, pay: 0, parcels: 0 });
  const canEdit = hasPermission('canEditClients') && !!row && !row.is_system;
  const title = !row ? '…' : row.kind === 'unknown' ? 'Je ne sais pas' : row.kind === 'none' ? 'Inconnues' : row.label;

  return (
    <div className="min-h-[100dvh] bg-white pb-8 dark:bg-[#1E1E1E]">
      <ScreenTop title="Source" backTo={BASE} right={canEdit ? <MoreButton onClick={more.show} /> : periodBtn} />
      <div className="flex flex-col items-center px-5 pt-7 text-center">
        {row ? <SourceLeading row={row} size={92} /> : <span className="h-[92px] w-[92px] rounded-full bg-[#F5F5F5] dark:bg-[#383838]" />}
        <h2 className={cn('mt-3.5 text-[22px] font-semibold leading-tight', TEXT.strong)}>{title}</h2>
        <p className={cn('mt-1 text-[16px]', TEXT.muted)}>{row ? [sourceKindLabel(row.kind), row.phone, row.is_active ? null : 'archivée'].filter(Boolean).join(' · ') : ''}</p>
        {canEdit && <div className="mt-2">{periodBtn}</div>}
      </div>
      <div className="px-5 pt-5">
        <div className={cn('grid grid-cols-2 overflow-hidden rounded-lg border', SURFACE.divider)}>
          {[
            ['Clients apportés', clients.isLoading ? '…' : num(list.length)],
            ['Dépôts validés', clients.isLoading ? '…' : shortXaf(sum.dep)],
            ['Paiements', clients.isLoading ? '…' : shortXaf(sum.pay)],
            ['Colis déposés', clients.isLoading ? '…' : num(sum.parcels)],
          ].map(([l, v], i) => (
            <div key={l} className={cn('px-4 py-3.5', i % 2 === 1 && 'border-l', i > 1 && 'border-t', SURFACE.divider)}>
              <div className={cn('text-[15px]', TEXT.muted)}>{l}</div>
              <div className={cn('mt-1 text-[26px] font-bold tabular-nums', TEXT.strong)}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      <SectionHead title="Ses clients" />
      {clients.isLoading ? (
        <ItemList>{[0, 1, 2].map((i) => <div key={i} className="my-2 h-14 animate-pulse rounded-lg bg-[#F5F5F5] dark:bg-[#383838]" />)}</ItemList>
      ) : clients.isError ? (
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void clients.refetch() }}>La liste n’a pas pu être chargée.</EmptyLine>
      ) : list.length === 0 ? (
        <EmptyLine>Aucun client pour cette source.</EmptyLine>
      ) : (
        <ItemList>
          {list.map((c) => (
            <ItemRow
              key={c.user_id}
              leading={<Initials name={c.name || '?'} />}
              title={c.name || '—'}
              subtitle={[c.customer_code, `depuis ${shortDay(c.created_at)}`].filter(Boolean).join(' · ')}
              right={
                <span className="shrink-0 text-right">
                  <span className={cn('block text-[17px] font-bold tabular-nums', TEXT.strong)}>{shortXaf(c.payments_xaf)}</span>
                  <span className={cn('block text-[15px]', TEXT.muted)}>payés</span>
                </span>
              }
              onClick={() => navigate(`/m/clients/${c.user_id}`)}
            />
          ))}
        </ItemList>
      )}

      {row && canEdit && (
        <>
          <ActionSheet
            open={more.open}
            onClose={more.hide}
            actions={[
              { label: 'Modifier', hint: 'nom, téléphone', icon: Pencil, onClick: () => { setLabel(row.label); setPhone(row.phone ?? ''); setEditing(true); } },
              { label: row.is_active ? 'Archiver' : 'Réactiver', icon: row.is_active ? Archive : ArchiveRestore, danger: row.is_active, onClick: () => setArchiving(true) },
            ]}
          />
          <BottomSheet open={editing} onClose={() => setEditing(false)}>
            <h3 className={cn('text-[22px] font-semibold leading-tight', TEXT.strong)}>Modifier la source</h3>
            <FieldLabel className="mt-4" htmlFor="sv-label">Nom</FieldLabel>
            <BigInput id="sv-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} />
            <FieldLabel htmlFor="sv-phone">Téléphone</FieldLabel>
            <BigInput id="sv-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <BigButton className="mt-5" disabled={label.trim().length < 2} loading={update.isPending} onClick={() => update.mutate({ id: row.source_id!, label: label.trim(), phone: phone.trim() || null }, { onSuccess: () => setEditing(false) })}>Enregistrer</BigButton>
          </BottomSheet>
          <ConfirmSheet
            open={archiving}
            onClose={() => setArchiving(false)}
            title={row.is_active ? `Archiver « ${row.label} » ?` : `Réactiver « ${row.label} » ?`}
            subtitle={row.is_active ? 'Plus proposée aux nouveaux clients · ses clients la gardent' : 'De nouveau proposée'}
            confirmLabel={row.is_active ? 'Archiver' : 'Réactiver'}
            danger={row.is_active}
            loading={update.isPending}
            onConfirm={() => update.mutate({ id: row.source_id!, isActive: !row.is_active }, { onSuccess: () => setArchiving(false) })}
          />
        </>
      )}
    </div>
  );
}
