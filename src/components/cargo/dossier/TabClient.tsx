/**
 * Onglet Clients — les clients du GROUPAGE, refait le 04/10/2026.
 *
 * Bonzini remplit ses conteneurs lui-même : « le conteneur de GAUSS » est un
 * groupage, et ses vrais clients sont les propriétaires des lots (le nom
 * porté sur les colis, ou relevé sur la packing list). Cet onglet dit, pour
 * chacun : ses lots, ses colis, son volume, sa part du fret, et sa fiche
 * client Bonzini quand on l'a rattachée. Les lots sans propriétaire sont
 * listés à part : c'est la question à poser à notre entrepôt de Guangzhou.
 *
 * Les colis chargés depuis la Réception portent déjà leur client : ils
 * apparaissent dans leur propre bloc.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, Link2, Link2Off, PackageOpen, Pencil, Search, Tag as TagIcon, UserPlus, Users, Warehouse } from 'lucide-react';
import { TextField } from '@/components/form';
import {
  useAssignLotsOwner, useCargoClient, useCargoClientOptions, useCargoClientsByIds, useCargoPackages, useCargoShipments, useUpdateCargoShipment,
} from '@/hooks/useCargo';
import { useShipmentParcels } from '@/hooks/useReception';
import { Empty, FieldLabel, IconButton, IconTile, Section, Tag, ToolButton } from '@/components/cargo/dossier/kit';
import { groupOwners, type GroupageOwner } from '@/lib/cargo/groupage';
import { initials } from '@/lib/cargo/parties';
import { clientFullName, formatCbm } from '@/lib/reception';
import { bestEta, fmtDay, fmtUsd, statusMeta } from '@/lib/cargo/model';
import type { CargoPackage, CargoShipment } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, SOFT_PILL, PRIMARY_PILL, CenterDialog, RefChip, StatusPill } from '@/desktop/designKit';

const pct = (v: number) => `${Math.round(v * 100)} %`;
const m3 = (v: number) => `${v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} m³`;

/* ── Choisir une fiche client Bonzini ───────────────────────────────────── */

function ClientPicker({ onPick }: { onPick: (c: { id: string; first_name: string; last_name: string; company_name: string | null }) => void }) {
  const [search, setSearch] = useState('');
  const { data: options } = useCargoClientOptions(search);
  return (
    <div>
      <TextField id="client-search" size="sm" variant="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, prénom ou société…" leftIcon={<Search className="h-4 w-4" />} />
      <ul className="mt-2 max-h-[240px] overflow-y-auto rounded-[10px] ring-1 ring-black/[0.06] dark:ring-white/[0.07]">
        {(options ?? []).map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => onPick(c)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/60">
              <span className={cn('text-[13px] max-lg:text-[15px] font-semibold', TEXT.strong)}>{c.first_name} {c.last_name}</span>
              <span className={cn('text-[12px] max-lg:text-[14px]', TEXT.muted)}>{c.company_name || '—'}</span>
            </button>
          </li>
        ))}
        {options && options.length === 0 && <li className={cn('px-3 py-5 text-center text-[13px]', TEXT.muted)}>Aucun client trouvé.</li>}
      </ul>
    </div>
  );
}

/* ── Attribuer des lots ─────────────────────────────────────────────────── */

function AssignDialog({
  lots, owners, initialLabel, onClose, onAssign, saving,
}: {
  lots: CargoPackage[]; owners: GroupageOwner[]; initialLabel?: string; onClose: () => void; saving: boolean;
  onAssign: (ownerLabel: string | null, clientId: string | null) => void;
}) {
  const [label, setLabel] = useState(initialLabel ?? '');
  const [client, setClient] = useState<{ id: string; name: string } | null>(null);
  const [picking, setPicking] = useState(false);
  const valid = label.trim().length > 0 || !!client;
  const submit = () => { if (valid) onAssign(label.trim() || client?.name || null, client?.id ?? null); };
  return (
    <CenterDialog
      open
      onClose={onClose}
      onConfirm={submit}
      width={560}
      title={lots.length > 1 ? `Attribuer ${lots.length} lots` : `À qui est « ${lots[0]?.label} » ?`}
      footer={
        <>
          <button type="button" onClick={onClose} className={cn('ml-auto h-9 px-4 text-[13px] max-lg:text-[15px] font-semibold', SOFT_PILL)}>Annuler</button>
          <button type="button" onClick={submit} disabled={!valid || saving} className={cn('h-9 px-4 text-[13px] max-lg:text-[15px] font-bold disabled:opacity-60', PRIMARY_PILL)}>{saving ? 'Enregistrement…' : 'Attribuer'}</button>
        </>
      }
    >
      <div className="space-y-4">
        {owners.length > 0 && (
          <div>
            <FieldLabel>Un client déjà dans ce conteneur</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {owners.map((o) => (
                <button key={o.key} type="button" onClick={() => { setLabel(o.label); setClient(o.clientId ? { id: o.clientId, name: o.label } : null); }} className={cn('h-8 max-lg:h-10 rounded-md px-2.5 text-[12.5px] max-lg:text-[14px] font-semibold', label === o.label ? PRIMARY_PILL : SOFT_PILL)}>
                  {o.label || 'Client rattaché'}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <FieldLabel htmlFor="owner-label" hint="tel qu'écrit sur les colis">Nom du propriétaire</FieldLabel>
          <TextField id="owner-label" size="sm" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Olivier Yaoundé, Jeremy Balondo…" />
        </div>
        <div>
          <FieldLabel hint="facultatif">Fiche client Bonzini</FieldLabel>
          {client ? (
            <div className={cn('flex items-center justify-between gap-2 rounded-lg px-3 py-2', SURFACE.inset)}>
              <span className={cn('text-[13px] max-lg:text-[15px] font-semibold', TEXT.strong)}>{client.name}</span>
              <ToolButton icon={Link2Off} onClick={() => setClient(null)}>Retirer</ToolButton>
            </div>
          ) : picking ? (
            <ClientPicker onPick={(c) => { const name = `${c.first_name} ${c.last_name}`.trim(); setClient({ id: c.id, name }); if (!label) setLabel(name); setPicking(false); }} />
          ) : (
            <ToolButton icon={Link2} onClick={() => setPicking(true)}>Chercher une fiche client</ToolButton>
          )}
        </div>
        <ul className={cn('rounded-lg px-3 py-2 text-[12.5px] max-lg:text-[14px]', SURFACE.inset, TEXT.body)}>
          {lots.map((l) => <li key={l.id} className="truncate">· {l.label} ({l.qty} colis)</li>)}
        </ul>
      </div>
    </CenterDialog>
  );
}

/* ── Un client du groupage ──────────────────────────────────────────────── */

function OwnerCard({
  owner, client, freightUsd, canManage, onEdit, onOpenClient,
}: {
  owner: GroupageOwner; client?: { first_name: string; last_name: string; company_name: string | null; phone: string | null; customer_code: string | null } | null;
  freightUsd: number | null; canManage: boolean; onEdit: () => void; onOpenClient?: () => void;
}) {
  const name = owner.label || (client ? `${client.first_name} ${client.last_name}` : 'Client');
  return (
    <div className={cn('flex flex-col rounded-[12px] p-4 ring-1 ring-black/[0.07] dark:ring-white/[0.08]', SURFACE.card)}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-50 text-[13px] font-extrabold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">{initials(name)}</span>
        <div className="min-w-0 flex-1">
          <div className={cn('text-[14.5px] max-lg:text-[16px] font-bold', TEXT.strong)}>{name}</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {client ? <Tag tone="success"><Link2 className="h-3 w-3" />fiche Bonzini{client.customer_code ? ` · ${client.customer_code}` : ''}</Tag> : <Tag tone="warn">pas de fiche</Tag>}
            {client?.company_name && <Tag>{client.company_name}</Tag>}
          </div>
        </div>
        {canManage && <IconButton icon={Pencil} label="Modifier" onClick={onEdit} />}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { k: 'Colis', v: String(owner.colis) },
          { k: 'Volume', v: m3(owner.cbm) },
          { k: 'Part', v: pct(owner.share) },
        ].map((x) => (
          <div key={x.k} className={cn('rounded-lg px-3 py-2', SURFACE.inset)}>
            <div className={cn('text-[10.5px] max-lg:text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>{x.k}</div>
            <div className={cn('text-[15px] max-lg:text-[16px] font-extrabold tabular-nums', TEXT.strong)}>{x.v}</div>
          </div>
        ))}
      </div>
      {freightUsd != null && (
        <p className={cn('mt-2 text-[12px] max-lg:text-[14px]', TEXT.muted)}>
          Fret au volume : <b className={TEXT.body}>{fmtUsd(freightUsd * owner.share)}</b> sur {fmtUsd(freightUsd)} (estimation)
        </p>
      )}
      <ul className={cn('mt-3 space-y-1 border-t border-black/[0.06] pt-3 text-[12.5px] max-lg:text-[14px] dark:border-white/[0.06]', TEXT.body)}>
        {owner.lots.map((l) => <li key={l.id} className="flex justify-between gap-2"><span className="truncate">{l.label}</span><span className={cn('shrink-0 tabular-nums', TEXT.muted)}>{l.qty} colis</span></li>)}
      </ul>
      {client && onOpenClient && (
        <button type="button" onClick={onOpenClient} className={cn('mt-3 self-start text-[12.5px] max-lg:text-[14px] font-semibold hover:underline', TEXT.body)}>Ouvrir la fiche client →</button>
      )}
    </div>
  );
}

/* ── L'onglet ─────────────────────────────────────────────────────────── */

export function TabClient({ shipment: s, canManage }: { shipment: CargoShipment; canManage: boolean }) {
  const navigate = useNavigate();
  const { data: packages } = useCargoPackages(s.id);
  const { data: parcels } = useShipmentParcels(s.id);
  const { data: dossierClient } = useCargoClient(s.client_id);
  const { data: fleet } = useCargoShipments();
  const update = useUpdateCargoShipment();
  const assign = useAssignLotsOwner();
  const [assigning, setAssigning] = useState<{ lots: CargoPackage[]; label?: string } | null>(null);
  const [linkDossier, setLinkDossier] = useState(false);

  const lots = useMemo(() => packages ?? [], [packages]);
  const { owners, unassigned } = useMemo(() => groupOwners(lots), [lots]);
  const { data: clients } = useCargoClientsByIds(owners.map((o) => o.clientId).filter(Boolean) as string[]);
  const clientById = useMemo(() => Object.fromEntries((clients ?? []).map((c) => [c.id, c])), [clients]);
  const freight = s.freight_usd != null ? Number(s.freight_usd) : null;

  // Les colis de la Réception, regroupés par client.
  const received = useMemo(() => {
    const m = new Map<string, { name: string; code: string | null; colis: number; cbm: number }>();
    for (const p of parcels ?? []) {
      const k = p.client?.user_id ?? 'none';
      const g = m.get(k) ?? { name: p.client ? clientFullName(p.client) : 'Client inconnu', code: p.client?.customer_code ?? null, colis: 0, cbm: 0 };
      g.colis += 1;
      g.cbm += Number(p.cbm ?? 0);
      m.set(k, g);
    }
    return [...m.values()];
  }, [parcels]);

  const others = useMemo(
    () => (fleet ?? []).filter((o) => o.id !== s.id && (s.client_id ? o.client_id === s.client_id : o.client_label === s.client_label)),
    [fleet, s],
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-5 max-lg:grid-cols-1">
      <div className="space-y-5">
        <div className={cn('flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[14px] px-5 py-4', SURFACE.card, SURFACE.shadow)}>
          <div className="flex items-center gap-3">
            <IconTile icon={Users} tone="violet" size="lg" />
            <div>
              <div className={cn('text-[15px] max-lg:text-[17px] font-bold', TEXT.strong)}>Clients de ce conteneur</div>
              <div className={cn('text-[12.5px] max-lg:text-[14px]', TEXT.muted)}>
                {owners.length} client{owners.length > 1 ? 's' : ''} identifié{owners.length > 1 ? 's' : ''}
                {unassigned && ` · ${unassigned.lots.length} lot${unassigned.lots.length > 1 ? 's' : ''} sans propriétaire (${pct(unassigned.share)} du volume)`}
              </div>
            </div>
          </div>
          {canManage && unassigned && <ToolButton icon={UserPlus} primary className="ml-auto max-sm:ml-0" onClick={() => setAssigning({ lots: unassigned.lots })}>Attribuer des lots</ToolButton>}
        </div>

        {lots.length === 0 ? (
          <Section icon={Users} tone="violet" title="Aucun lot saisi">
            <Empty icon={PackageOpen} title="Les clients viennent des lots">Saisis la packing list dans l'onglet Chargement : chaque lot porte le nom de son propriétaire.</Empty>
          </Section>
        ) : (
          <>
            {owners.length > 0 && (
              <Section icon={Users} tone="violet" title="Les clients" subtitle="la part de chacun se mesure au volume, comme se facture le groupage maritime">
                <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3 max-sm:grid-cols-1">
                  {owners.map((o) => (
                    <OwnerCard
                      key={o.key}
                      owner={o}
                      client={o.clientId ? clientById[o.clientId] ?? null : null}
                      freightUsd={freight}
                      canManage={canManage}
                      onEdit={() => setAssigning({ lots: o.lots, label: o.label })}
                      onOpenClient={o.clientId ? () => navigate(`/m/clients/${o.clientId}`) : undefined}
                    />
                  ))}
                </div>
              </Section>
            )}

            {unassigned && (
              <Section icon={HelpCircle} tone="amber" title="Lots sans propriétaire" subtitle="à demander à notre entrepôt de Guangzhou : il a reçu et chargé ces colis" meta={`${unassigned.colis} colis · ${m3(unassigned.cbm)}`}>
                <ul className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
                  {unassigned.lots.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <div className={cn('truncate text-[13.5px] max-lg:text-[15px] font-semibold', TEXT.strong)}>{l.label}</div>
                        <div className={cn('text-[12px] max-lg:text-[14px]', TEXT.muted)}>{l.qty} colis</div>
                      </div>
                      {canManage && <ToolButton icon={TagIcon} onClick={() => setAssigning({ lots: [l] })}>Attribuer</ToolButton>}
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </>
        )}

        {received.length > 0 && (
          <Section icon={Warehouse} tone="emerald" title="Colis reçus à l'entrepôt" subtitle="chargés depuis la Réception : leur client est déjà connu">
            <ul className="space-y-2">
              {received.map((r) => (
                <li key={`${r.name}-${r.code}`} className="flex items-center justify-between gap-3 text-[13px] max-lg:text-[15px]">
                  <span className={cn('font-semibold', TEXT.strong)}>{r.name}{r.code && <span className={cn('ml-1.5 font-normal', TEXT.muted)}>{r.code}</span>}</span>
                  <span className={cn('tabular-nums', TEXT.muted)}>{r.colis} colis · {formatCbm(r.cbm)}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      <div className="space-y-5">
        <Section
          icon={Link2}
          title="Dossier au nom de"
          action={canManage ? (s.client_id
            ? <ToolButton icon={Link2Off} onClick={() => update.mutate({ id: s.id, patch: { client_id: null } })}>Détacher</ToolButton>
            : <ToolButton icon={Link2} onClick={() => setLinkDossier(true)}>Rattacher</ToolButton>) : undefined}
        >
          <div className={cn('text-[16px] font-bold', TEXT.strong)}>{s.client_label}</div>
          {dossierClient ? (
            <div className={cn('mt-1 text-[12.5px] max-lg:text-[14px]', TEXT.body)}>
              {dossierClient.first_name} {dossierClient.last_name}{dossierClient.company_name ? ` · ${dossierClient.company_name}` : ''}
              <button type="button" onClick={() => navigate(`/m/clients/${dossierClient.id}`)} className="ml-2 font-semibold hover:underline">Ouvrir →</button>
            </div>
          ) : (
            <p className={cn('mt-1 text-[12.5px] max-lg:text-[14px]', TEXT.muted)}>Libellé venu du tableau du transitaire. Pour un groupage Bonzini, les vrais clients sont ceux des lots, à gauche.</p>
          )}
        </Section>

        <Section icon={PackageOpen} title="Ses autres conteneurs" meta={others.length ? `${others.length}` : undefined}>
          {others.length === 0 ? (
            <p className={cn('text-[13px] max-lg:text-[15px]', TEXT.muted)}>Aucun autre conteneur suivi à ce nom.</p>
          ) : (
            <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
              {others.map((o) => (
                <li key={o.id}>
                  <button type="button" onClick={() => navigate(`/m/cargo/${o.id}`)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left">
                    <RefChip>{o.container_number}</RefChip>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className={cn('text-[12.5px] max-lg:text-[14px] font-semibold tabular-nums', TEXT.strong)}>{fmtDay(bestEta(o).date)}</span>
                      <StatusPill tone={statusMeta(o.status).tone} label={statusMeta(o.status).label} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section icon={HelpCircle} title="Ce que chaque client doit savoir">
          <p className={cn('text-[12.5px] max-lg:text-[14px] leading-relaxed', TEXT.body)}>
            L'<b>arrivée</b> retenue (pas celle du transitaire), le <b>retard</b> s'il y en a, et ce qu'il doit fournir : la
            <b> facture</b> de sa marchandise, base de la valeur en douane.
          </p>
        </Section>
      </div>

      {assigning && (
        <AssignDialog
          lots={assigning.lots}
          owners={owners}
          initialLabel={assigning.label}
          saving={assign.isPending}
          onClose={() => setAssigning(null)}
          onAssign={(ownerLabel, clientId) => assign.mutate({ ids: assigning.lots.map((l) => l.id), shipmentId: s.id, ownerLabel, clientId }, { onSuccess: () => setAssigning(null) })}
        />
      )}
      {linkDossier && (
        <CenterDialog open onClose={() => setLinkDossier(false)} title="Rattacher le dossier à une fiche client" footer={<button type="button" onClick={() => setLinkDossier(false)} className={cn('ml-auto h-9 px-4 text-[13px] font-semibold', SOFT_PILL)}>Fermer</button>}>
          <ClientPicker onPick={(c) => update.mutate({ id: s.id, patch: { client_id: c.id } }, { onSuccess: () => setLinkDossier(false) })} />
        </CenterDialog>
      )}
    </div>
  );
}
