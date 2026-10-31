/**
 * Fournisseurs USDT et acheteurs CNY — maquettes 07-tresorerie/25 (liste),
 * 26 (fiche acheteur ; fournisseur : 05-tresorerie-taux/10) et 27 (modifier).
 *
 * L'identifiant lisible (F-003, A-002) accompagne toujours le nom. Les
 * chiffres portent sur la période partagée, hors opérations annulées. Le
 * « … » de la fiche : Modifier, Archiver / Réactiver, Supprimer (seulement
 * sans opération — le serveur le refuse sinon), chacun confirmé en feuille.
 */
import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  useCounterparties, useCreateCounterparty, useDeleteCounterparty, useTreasuryOperations, useUpdateCounterparty, type TreasuryCounterparty,
} from '@/hooks/useTreasury';
import { totalsOf, viewOperation, type OperationView } from '@/desktop/screens/treasury/operationView';
import { fmtNum } from '@/desktop/screens/treasury/treasuryFormat';
import { plural } from '@/desktop/screens/treasury/treasuryLabels';
import type { CounterpartyFilter } from '@/desktop/screens/treasury/treasuryNav';
import { normalizeText } from '@/lib/clientSearch';
import { PhoneInputWithCountry } from '@/components/form';
import { cn } from '@/lib/utils';
import {
  ActionSheet, BigButton, BoxSegmented, Chip, ConfirmSheet, Dock, EmptyLine, Initials, ItemList, ItemRow, MoreButton, RoundButton, ScreenTop,
  SearchBox, SectionHead, TEXT, TextArea, TextInput, useSheet,
} from '@/mobile/designKit';
import { AmountStack, CapsLabel, FieldBlock, OpRow, PeriodChip, PeriodSheet, StatGrid, TreasuryGate } from './parts';
import { fmtUsdt, tp, usePeriod, useGoBack, whenShort } from './treasuryMobile';

const NOUN: Record<CounterpartyFilter, { one: string; many: string; add: string; edit: string; name: string; counter: 'XAF' | 'CNY'; decimals: number }> = {
  usdt_supplier: { one: 'Fournisseur USDT', many: 'Fournisseurs USDT', add: 'Nouveau fournisseur', edit: 'Modifier le fournisseur', name: 'Nom du fournisseur', counter: 'XAF', decimals: 2 },
  cny_buyer: { one: 'Acheteur CNY', many: 'Acheteurs CNY', add: 'Nouvel acheteur', edit: 'Modifier l’acheteur', name: 'Nom de l’acheteur', counter: 'CNY', decimals: 4 },
};

/** Les opérations de la période, rangées par contrepartie (comme sur ordinateur). */
function useOpsByCounterparty() {
  const period = usePeriod();
  const ops = useTreasuryOperations(period.fromIso, period.toIso);
  const byCp = useMemo(() => {
    const m = new Map<string, OperationView[]>();
    for (const op of ops.data ?? []) {
      const v = viewOperation(op);
      if (!v.counterpartyId) continue;
      const list = m.get(v.counterpartyId) ?? [];
      list.push(v);
      m.set(v.counterpartyId, list);
    }
    return m;
  }, [ops.data]);
  return { ops, byCp };
}

/* ── La liste ───────────────────────────────────────────────────────────── */
export function CounterpartiesScreen() {
  const [params] = useSearchParams();
  const type: CounterpartyFilter = params.get('type') === 'cny_buyer' ? 'cny_buyer' : 'usdt_supplier';
  if (params.get('new') === '1') {
    return (
      <TreasuryGate manage>
        <CounterpartyForm type={type} />
      </TreasuryGate>
    );
  }
  return (
    <TreasuryGate>
      <ListBody type={type} />
    </TreasuryGate>
  );
}

function ListBody({ type }: { type: CounterpartyFilter }) {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission('canManageTreasury');
  const [q, setQ] = useState('');
  const [archived, setArchived] = useState(false);
  const periodSheet = useSheet();
  const cps = useCounterparties(type, true);
  const { ops, byCp } = useOpsByCounterparty();
  const t = NOUN[type];

  const all = cps.data ?? [];
  const archivedCount = all.filter((c) => !c.is_active).length;
  const rows = all
    .filter((c) => (archived ? !c.is_active : c.is_active))
    .filter((c) => !q || normalizeText(`${c.short_id} ${c.display_name} ${c.legal_name ?? ''} ${c.phone ?? ''} ${c.wechat_id ?? ''}`).includes(normalizeText(q)))
    .map((c) => ({ c, s: totalsOf((byCp.get(c.id) ?? []).filter((o) => !o.voided)) }))
    .sort((a, b) => b.s.usdt - a.s.usdt || a.c.display_name.localeCompare(b.c.display_name));

  return (
    <div className="flex min-h-full flex-col pb-6">
      <ScreenTop
        title="Fournisseurs et acheteurs"
        backTo={tp.root}
        right={canManage ? <RoundButton icon={Plus} ariaLabel={t.add} onClick={() => navigate(tp.counterpartyNew(type))} className="border-0" /> : undefined}
      />
      <div className="space-y-3 px-5 pt-4">
        <BoxSegmented
          ariaLabel="Type"
          value={type}
          onChange={(v) => navigate(tp.counterparties(v), { replace: true })}
          options={[
            { value: 'usdt_supplier', label: 'Fournisseurs USDT' },
            { value: 'cny_buyer', label: 'Acheteurs CNY' },
          ]}
        />
        <SearchBox value={q} onChange={setQ} placeholder="Nom, F-003, téléphone" />
        <div className="flex flex-wrap gap-2">
          <PeriodChip onClick={periodSheet.show} />
          {archivedCount > 0 && <Chip label="Archivés" count={archivedCount} active={archived} onClick={() => setArchived((a) => !a)} />}
        </div>
        <CapsLabel className="pt-2">Par volume · USDT et taux moyen</CapsLabel>
      </div>
      {cps.isError ? (
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void cps.refetch() }}>La liste n’a pas pu être chargée.</EmptyLine>
      ) : !cps.isLoading && rows.length === 0 ? (
        <EmptyLine>{q ? 'Aucun résultat.' : archived ? 'Aucun archivé.' : `Aucun ${t.one.toLowerCase()}.`}</EmptyLine>
      ) : (
        <ItemList>
          {rows.map(({ c, s }) => (
            <ItemRow
              key={c.id}
              leading={<Initials name={c.display_name} />}
              title={c.display_name}
              subtitle={`${c.short_id} · ${ops.isLoading ? '…' : s.count ? plural(s.count, 'opération') : 'aucune opération'}`}
              right={<AmountStack main={ops.isLoading ? '…' : fmtUsdt(s.usdt)} sub={s.avgRate ? fmtNum(s.avgRate, t.decimals) : '—'} />}
              onClick={() => navigate(tp.counterparty(c.id))}
            />
          ))}
        </ItemList>
      )}
      <PeriodSheet open={periodSheet.open} onClose={periodSheet.hide} />
    </div>
  );
}

/* ── La fiche ───────────────────────────────────────────────────────────── */
export function CounterpartyScreen() {
  return (
    <TreasuryGate>
      <DetailBody />
    </TreasuryGate>
  );
}

function DetailBody() {
  const navigate = useNavigate();
  const { counterpartyId: id = '' } = useParams<{ counterpartyId: string }>();
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission('canManageTreasury');
  const cps = useCounterparties(undefined, true);
  const { ops, byCp } = useOpsByCounterparty();
  const update = useUpdateCounterparty();
  const remove = useDeleteCounterparty();
  const more = useSheet();
  const periodSheet = useSheet();
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null);

  const cp: TreasuryCounterparty | undefined = (cps.data ?? []).find((c) => c.id === id);
  if (!cp) {
    return (
      <div className="flex min-h-full flex-col">
        <ScreenTop title="Contrepartie" backTo={tp.counterparties()} />
        {cps.isLoading ? <EmptyLine>Chargement…</EmptyLine> : cps.isError ? (
          <EmptyLine action={{ label: 'Réessayer', onClick: () => void cps.refetch() }}>La fiche n’a pas pu être chargée.</EmptyLine>
        ) : <EmptyLine>Contrepartie introuvable.</EmptyLine>}
      </div>
    );
  }
  const type = cp.type as CounterpartyFilter;
  const t = NOUN[type];
  const supplier = type === 'usdt_supplier';
  const list = byCp.get(cp.id) ?? [];
  const s = totalsOf(list.filter((o) => !o.voided));

  return (
    <div className="flex min-h-full flex-col pb-6">
      <ScreenTop title={t.one} backTo={tp.counterparties(type)} right={<MoreButton onClick={more.show} />} />
      <div className="flex flex-col items-center px-5 pt-5 text-center">
        <Initials name={cp.display_name} size={64} />
        <h2 className={cn('mt-3 text-[26px] font-semibold leading-tight', TEXT.strong)}>{cp.display_name}</h2>
        <p className={cn('mt-1 text-[16px]', TEXT.muted)}>{[cp.short_id, cp.phone].filter(Boolean).join(' · ')}</p>
        {cp.wechat_id && <p className={cn('text-[16px]', TEXT.muted)}>WeChat {cp.wechat_id}</p>}
        {cp.legal_name && <p className={cn('text-[16px]', TEXT.muted)}>{cp.legal_name}</p>}
        {!cp.is_active && <p className={cn('mt-1 text-[16px] font-semibold', TEXT.strong)}>Archivé</p>}
        <PeriodChip className="mt-4" onClick={periodSheet.show} />
      </div>
      <div className="px-5 pt-4">
        <StatGrid
          items={[
            { label: 'Opérations', value: ops.isLoading ? '…' : s.count },
            { label: supplier ? 'USDT achetés' : 'USDT vendus', value: ops.isLoading ? '…' : fmtUsdt(s.usdt) },
            { label: supplier ? 'XAF payés' : 'CNY reçus', value: ops.isLoading ? '…' : supplier ? fmtNum(s.counter, 0) : `¥ ${fmtNum(s.counter, 0)}` },
            { label: 'Taux moyen', value: s.avgRate ? fmtNum(s.avgRate, t.decimals) : '—' },
          ]}
        />
        {cp.notes && <p className={cn('mt-4 whitespace-pre-wrap text-[16px]', TEXT.body)}>{cp.notes}</p>}
      </div>
      <SectionHead title="Opérations" link={list.length > 3 ? { label: 'Tout voir', onClick: () => navigate(tp.operationsQ(supplier ? 'purchase' : 'sale', cp.short_id)) } : undefined} />
      {ops.isError ? (
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void ops.refetch() }}>La liste n’a pas pu être chargée.</EmptyLine>
      ) : !ops.isLoading && list.length === 0 ? (
        <EmptyLine>Aucune opération sur cette période.</EmptyLine>
      ) : (
        <ItemList>
          {list.slice(0, 10).map((o) => (
            <OpRow
              key={o.id}
              op={{ ...o, counterpartyName: `${o.kind === 'purchase' ? 'Achat' : 'Vente'} · ${o.accounts === '—' ? 'sans compte' : o.accounts}` }}
              subtitle={whenShort(o.at)}
              below="rate"
              onClick={() => navigate(tp.operation(o.kind, o.id))}
            />
          ))}
        </ItemList>
      )}

      <ActionSheet
        open={more.open}
        onClose={more.hide}
        actions={[
          { label: 'Modifier', icon: Pencil, onClick: () => navigate(tp.counterpartyEdit(cp.id)), hidden: !canManage },
          { label: cp.is_active ? 'Archiver' : 'Réactiver', hint: cp.is_active ? 'Plus proposé dans les saisies' : undefined, icon: cp.is_active ? Archive : ArchiveRestore, onClick: () => setConfirm('archive'), hidden: !canManage },
          { label: 'Supprimer', hint: 'Sans opération seulement', icon: Trash2, danger: true, onClick: () => setConfirm('delete'), hidden: !canManage },
        ]}
      />
      <ConfirmSheet
        open={confirm === 'archive'}
        onClose={() => setConfirm(null)}
        title={cp.is_active ? `Archiver ${cp.display_name} ?` : `Réactiver ${cp.display_name} ?`}
        subtitle={cp.is_active ? 'Son historique reste intact.' : 'Il sera de nouveau proposé dans les saisies.'}
        confirmLabel={cp.is_active ? 'Archiver' : 'Réactiver'}
        loading={update.isPending}
        onConfirm={() => update.mutate({ id: cp.id, is_active: !cp.is_active }, { onSuccess: () => setConfirm(null) })}
      />
      <ConfirmSheet
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        title={`Supprimer ${cp.display_name} ?`}
        subtitle="Sans opération seulement. Sinon, archivez-le."
        confirmLabel="Supprimer"
        danger
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(cp.id, {
            onSuccess: () => {
              setConfirm(null);
              navigate(tp.counterparties(type), { replace: true });
            },
          })
        }
      />
      <PeriodSheet open={periodSheet.open} onClose={periodSheet.hide} />
    </div>
  );
}

/* ── Modifier / créer ───────────────────────────────────────────────────── */
export function CounterpartyEditScreen() {
  return (
    <TreasuryGate manage>
      <EditBody />
    </TreasuryGate>
  );
}

function EditBody() {
  const { counterpartyId: id = '' } = useParams<{ counterpartyId: string }>();
  const cps = useCounterparties(undefined, true);
  const cp = (cps.data ?? []).find((c) => c.id === id);
  if (!cp) {
    return (
      <div className="flex min-h-full flex-col">
        <ScreenTop title="Modifier" />
        {cps.isLoading ? <EmptyLine>Chargement…</EmptyLine> : <EmptyLine>Contrepartie introuvable.</EmptyLine>}
      </div>
    );
  }
  return <CounterpartyForm type={cp.type as CounterpartyFilter} existing={cp} />;
}

function CounterpartyForm({ type, existing }: { type: CounterpartyFilter; existing?: TreasuryCounterparty }) {
  const navigate = useNavigate();
  const back = useGoBack(existing ? tp.counterparty(existing.id) : tp.counterparties(type));
  const create = useCreateCounterparty();
  const update = useUpdateCounterparty();
  const t = NOUN[type];
  const [name, setName] = useState(existing?.display_name ?? '');
  const [legal, setLegal] = useState(existing?.legal_name ?? '');
  const [phone, setPhone] = useState<string | null>(existing?.phone ?? null);
  const [wechat, setWechat] = useState(existing?.wechat_id ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const busy = create.isPending || update.isPending;
  const ok = name.trim().length >= 2;

  const save = () => {
    if (!ok || busy) return;
    const payload = { display_name: name.trim(), legal_name: legal.trim() || null, phone: phone || null, wechat_id: wechat.trim() || null, notes: notes.trim() || null };
    if (existing) {
      update.mutate({ id: existing.id, ...payload }, { onSuccess: () => navigate(tp.counterparty(existing.id), { replace: true }) });
    } else {
      create.mutate(
        {
          type,
          display_name: payload.display_name,
          legal_name: payload.legal_name ?? undefined,
          phone: payload.phone ?? undefined,
          wechat_id: payload.wechat_id ?? undefined,
          notes: payload.notes ?? undefined,
        },
        { onSuccess: (r) => navigate(r.id ? tp.counterparty(r.id) : tp.counterparties(type), { replace: true }) },
      );
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop title={existing ? t.edit : t.add} onBack={back} />
      <div className="space-y-5 px-5 pt-5">
        <FieldBlock label={t.name} htmlFor="cp-name">
          <TextInput id="cp-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!existing} className="h-14 text-[17px]" />
        </FieldBlock>
        <FieldBlock label="Raison sociale · facultatif" htmlFor="cp-legal">
          <TextInput id="cp-legal" value={legal} onChange={(e) => setLegal(e.target.value)} className="h-14 text-[17px]" />
        </FieldBlock>
        <div>
          <CapsLabel className="mb-2">Téléphone</CapsLabel>
          <PhoneInputWithCountry label="" value={phone} onValueChange={setPhone} defaultDialCode={type === 'cny_buyer' ? '+86' : '+237'} />
        </div>
        <FieldBlock label="WeChat · facultatif" htmlFor="cp-wechat">
          <TextInput id="cp-wechat" value={wechat} onChange={(e) => setWechat(e.target.value)} className="h-14 text-[17px]" />
        </FieldBlock>
        <FieldBlock label="Note · facultatif" htmlFor="cp-notes">
          <TextArea id="cp-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="text-[17px]" />
        </FieldBlock>
      </div>
      <Dock>
        <BigButton disabled={!ok} loading={busy} onClick={save}>{existing ? 'Enregistrer' : 'Créer'}</BigButton>
      </Dock>
    </div>
  );
}
