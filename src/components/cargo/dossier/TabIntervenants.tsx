/**
 * Onglet Intervenants — les parties prenantes EXTERNES du conteneur.
 *
 * Qui réserve le navire, qui est chargeur sur le B/L, qui dépose la
 * déclaration, qui a délivré le BESC, qui a certifié les véhicules : ces
 * noms vivaient dans les notes et WhatsApp. Ici, chacun a sa fiche (contact,
 * téléphone, WhatsApp, mail) et son rôle sur CE conteneur, rangés dans
 * l'ordre du voyage : en Chine, le transport, au Cameroun, le destinataire.
 *
 * Les fiches viennent d'un annuaire commun : le même transitaire se choisit
 * d'un clic sur le conteneur suivant.
 */
import { useMemo, useState, type ElementType } from 'react';
import {
  Anchor, BadgeCheck, Building2, ClipboardCheck, Contact, Factory, HardHat, Landmark, Mail, MapPin, MessageCircle, Pencil, Phone,
  Plus, Search, Ship, ShieldCheck, Stamp, Truck, UserPlus, Users, Warehouse, X,
} from 'lucide-react';
import { TextArea, TextField } from '@/components/form';
import { useAddShipmentParty, useCargoParties, useCargoShipmentParties, useRemoveShipmentParty, useUpdateShipmentParty } from '@/hooks/useCargo';
import { Empty, FieldLabel, IconButton, IconTile, Section, Tag, ToolButton, type SectionTone } from '@/components/cargo/dossier/kit';
import {
  KEY_ROLES, PARTY_GROUPS, PARTY_ROLES, PARTY_ROLE_META, initials, isPartyRole, roleLabel, telUrl, whatsappUrl,
  type CargoParty, type CargoShipmentPartyWithParty, type PartyGroup, type PartyRole,
} from '@/lib/cargo/parties';
import type { CargoShipment } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, SOFT_PILL, PRIMARY_PILL, CenterDialog } from '@/desktop/designKit';

const ROLE_ICON: Record<PartyRole, ElementType> = {
  SUPPLIER: Factory, WAREHOUSE: Warehouse, FORWARDER: Truck, SHIPPER: Contact,
  CARRIER: Ship, SHIPPING_AGENT: Anchor, INSURER: ShieldCheck,
  DECLARANT: ClipboardCheck, CUSTOMS_BROKER: Landmark, BESC_AGENT: Stamp, INSPECTION: BadgeCheck, EXPERT: HardHat, TERMINAL: Anchor, TRUCKER: Truck,
  CONSIGNEE: Building2, NOTIFY: Mail, OTHER: Users,
};
const GROUP_LOOK: Record<PartyGroup, { icon: ElementType; tone: SectionTone }> = {
  china: { icon: Warehouse, tone: 'orange' },
  sea: { icon: Ship, tone: 'blue' },
  cameroon: { icon: Landmark, tone: 'emerald' },
  receiver: { icon: Building2, tone: 'violet' },
};
const roleOf = (r: string): PartyRole => (isPartyRole(r) ? r : 'OTHER');

/* ── Une carte d'intervenant ─────────────────────────────────────────────── */

function PartyCard({ link, canManage, onEdit, onRemove }: { link: CargoShipmentPartyWithParty; canManage: boolean; onEdit: () => void; onRemove: () => void }) {
  const p = link.party;
  const role = roleOf(link.role);
  const tel = telUrl(p.phone);
  const wa = whatsappUrl(p.whatsapp || p.phone);
  const place = [p.city, p.country].filter(Boolean).join(', ');
  return (
    <div className={cn('flex flex-col rounded-[12px] p-4 ring-1 ring-black/[0.07] dark:ring-white/[0.08]', SURFACE.card)}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-[13px] font-extrabold text-foreground">{initials(p.name)}</span>
        <div className="min-w-0 flex-1">
          <div className={cn('text-[14px] max-lg:text-[16px] font-bold leading-5', TEXT.strong)}>{p.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Tag tone="info">{(() => { const I = ROLE_ICON[role]; return <I className="h-3 w-3" />; })()}{roleLabel(link.role)}</Tag>
            {p.contact_name && <span className={cn('text-[12px] max-lg:text-[14px]', TEXT.body)}>{p.contact_name}</span>}
          </div>
        </div>
        {canManage && (
          <div className="-mr-1 -mt-1 flex shrink-0">
            <IconButton icon={Pencil} label="Modifier" onClick={onEdit} />
            <IconButton icon={X} label="Retirer du conteneur" danger onClick={onRemove} />
          </div>
        )}
      </div>
      {link.note && <p className={cn('mt-3 rounded-lg px-3 py-2 text-[12.5px] max-lg:text-[14px] leading-relaxed', SURFACE.inset, TEXT.body)}>{link.note}</p>}
      <div className={cn('mt-3 space-y-1 text-[12.5px] max-lg:text-[14px]', TEXT.body)}>
        {p.phone && <div className="flex items-center gap-2"><Phone className={cn('h-3.5 w-3.5 shrink-0', TEXT.muted)} /><span className="tabular-nums">{p.phone}</span></div>}
        {p.email && <div className="flex items-center gap-2"><Mail className={cn('h-3.5 w-3.5 shrink-0', TEXT.muted)} /><span className="truncate">{p.email}</span></div>}
        {place && <div className="flex items-center gap-2"><MapPin className={cn('h-3.5 w-3.5 shrink-0', TEXT.muted)} />{place}</div>}
        {!p.phone && !p.email && !p.whatsapp && <div className={cn('text-[12px] max-lg:text-[14px] italic', TEXT.muted)}>Aucun contact renseigné</div>}
      </div>
      {(tel || wa || p.email) && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-black/[0.06] pt-3 dark:border-white/[0.06]">
          {tel && <a href={tel} className={cn('inline-flex h-8 max-lg:h-10 items-center gap-1.5 px-2.5 text-[12px] max-lg:text-[14px] font-semibold', SOFT_PILL)}><Phone className="h-3.5 w-3.5" /> Appeler</a>}
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={cn('inline-flex h-8 max-lg:h-10 items-center gap-1.5 px-2.5 text-[12px] max-lg:text-[14px] font-semibold', SOFT_PILL)}><MessageCircle className="h-3.5 w-3.5 text-[#07C160]" /> WhatsApp</a>}
          {p.email && <a href={`mailto:${p.email}`} className={cn('inline-flex h-8 max-lg:h-10 items-center gap-1.5 px-2.5 text-[12px] max-lg:text-[14px] font-semibold', SOFT_PILL)}><Mail className="h-3.5 w-3.5" /> Mail</a>}
        </div>
      )}
    </div>
  );
}

/* ── Formulaire d'une fiche ─────────────────────────────────────────────── */

type PartyForm = { name: string; contact_name: string; phone: string; whatsapp: string; email: string; city: string; country: string; note: string };
const emptyForm: PartyForm = { name: '', contact_name: '', phone: '', whatsapp: '', email: '', city: '', country: '', note: '' };
const fromParty = (p: CargoParty): PartyForm => ({
  name: p.name, contact_name: p.contact_name ?? '', phone: p.phone ?? '', whatsapp: p.whatsapp ?? '', email: p.email ?? '',
  city: p.city ?? '', country: p.country ?? '', note: p.note ?? '',
});
const toInput = (f: PartyForm) => ({
  name: f.name.trim(), contact_name: f.contact_name.trim() || null, phone: f.phone.trim() || null, whatsapp: f.whatsapp.trim() || null,
  email: f.email.trim() || null, city: f.city.trim() || null, country: f.country.trim() || null, note: f.note.trim() || null,
});

function PartyFields({ form, onChange }: { form: PartyForm; onChange: (f: PartyForm) => void }) {
  const set = (k: keyof PartyForm) => (e: { target: { value: string } }) => onChange({ ...form, [k]: e.target.value });
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3 max-sm:grid-cols-1">
      <div className="col-span-2 max-sm:col-span-1">
        <FieldLabel htmlFor="party-name">Nom (société ou personne)</FieldLabel>
        <TextField id="party-name" size="sm" value={form.name} onChange={set('name')} placeholder="KASSUMAYE PARTNER SARL, Cynthia AKAH…" />
      </div>
      <div>
        <FieldLabel htmlFor="party-contact" hint="facultatif">Personne à contacter</FieldLabel>
        <TextField id="party-contact" size="sm" value={form.contact_name} onChange={set('contact_name')} placeholder="Eric" />
      </div>
      <div>
        <FieldLabel htmlFor="party-phone" hint="avec l'indicatif">Téléphone</FieldLabel>
        <TextField id="party-phone" size="sm" value={form.phone} onChange={set('phone')} placeholder="+237 6…" inputMode="tel" />
      </div>
      <div>
        <FieldLabel htmlFor="party-wa" hint="si différent">WhatsApp</FieldLabel>
        <TextField id="party-wa" size="sm" value={form.whatsapp} onChange={set('whatsapp')} placeholder="+86 1…" inputMode="tel" />
      </div>
      <div>
        <FieldLabel htmlFor="party-email" hint="facultatif">Mail</FieldLabel>
        <TextField id="party-email" size="sm" value={form.email} onChange={set('email')} placeholder="nom@societe.com" inputMode="email" />
      </div>
      <div>
        <FieldLabel htmlFor="party-city">Ville</FieldLabel>
        <TextField id="party-city" size="sm" value={form.city} onChange={set('city')} placeholder="Douala, Guangzhou…" />
      </div>
      <div>
        <FieldLabel htmlFor="party-country">Pays</FieldLabel>
        <TextField id="party-country" size="sm" value={form.country} onChange={set('country')} placeholder="Cameroun, Chine…" />
      </div>
      <div className="col-span-2 max-sm:col-span-1">
        <FieldLabel htmlFor="party-note" hint="sur la fiche, pour tous les conteneurs">Note</FieldLabel>
        <TextArea id="party-note" rows={2} value={form.note} onChange={set('note')} placeholder="Horaires, n° d'agrément, ce qu'il faut savoir…" />
      </div>
    </div>
  );
}

function RolePicker({ value, onChange }: { value: PartyRole | null; onChange: (r: PartyRole) => void }) {
  return (
    <div className="space-y-3">
      {PARTY_GROUPS.map((g) => (
        <div key={g.key}>
          <div className={cn('mb-1.5 text-[11px] max-lg:text-[13px] font-bold uppercase tracking-wider', TEXT.muted)}>{g.label}</div>
          <div className="flex flex-wrap gap-1.5">
            {PARTY_ROLES.filter((r) => PARTY_ROLE_META[r].group === g.key).map((r) => {
              const I = ROLE_ICON[r];
              return (
                <button key={r} type="button" onClick={() => onChange(r)} className={cn('inline-flex h-8 max-lg:h-10 items-center gap-1.5 px-2.5 text-[12px] max-lg:text-[14px] font-semibold', r === value ? PRIMARY_PILL : SOFT_PILL)}>
                  <I className="h-3.5 w-3.5" /> {PARTY_ROLE_META[r].label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Dialogue « Ajouter un intervenant » ─────────────────────────────────── */

function AddDialog({ initialRole, onClose, onSubmit, saving }: {
  initialRole: PartyRole | null; onClose: () => void; saving: boolean;
  onSubmit: (v: { role: PartyRole; note: string; partyId?: string; party?: ReturnType<typeof toInput> }) => void;
}) {
  const [role, setRole] = useState<PartyRole | null>(initialRole);
  const [mode, setMode] = useState<'pick' | 'new'>('pick');
  const [search, setSearch] = useState('');
  const { data: options } = useCargoParties(search);
  const [picked, setPicked] = useState<CargoParty | null>(null);
  const [form, setForm] = useState<PartyForm>(emptyForm);
  const [note, setNote] = useState('');
  const valid = !!role && (mode === 'pick' ? !!picked : form.name.trim().length > 0);
  const submit = () => {
    if (!valid || !role) return;
    onSubmit(mode === 'pick' && picked ? { role, note, partyId: picked.id } : { role, note, party: toInput(form) });
  };
  return (
    <CenterDialog
      open
      onClose={onClose}
      onConfirm={submit}
      width={680}
      title="Ajouter un intervenant"
      footer={
        <>
          <button type="button" onClick={onClose} className={cn('h-9 px-4 text-[13px] max-lg:text-[15px] font-semibold', SOFT_PILL)}>Annuler</button>
          <button type="button" onClick={submit} disabled={!valid || saving} className={cn('h-9 px-4 text-[13px] max-lg:text-[15px] font-bold disabled:opacity-60', PRIMARY_PILL)}>
            {saving ? 'Ajout…' : 'Ajouter au conteneur'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <FieldLabel hint={role ? PARTY_ROLE_META[role].hint : undefined}>1. Son rôle sur ce conteneur</FieldLabel>
          <RolePicker value={role} onChange={setRole} />
        </div>
        <div>
          <FieldLabel>2. Qui</FieldLabel>
          <div className="mb-3 inline-flex rounded-md bg-muted p-0.5">
            {(['pick', 'new'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} className={cn('h-8 max-lg:h-10 rounded-[5px] px-3 text-[12.5px] max-lg:text-[14px] font-semibold', mode === m ? 'bg-background text-foreground ring-1 ring-black/[0.08] dark:ring-white/[0.1]' : 'text-muted-foreground')}>
                {m === 'pick' ? 'Déjà dans l’annuaire' : 'Nouvelle fiche'}
              </button>
            ))}
          </div>
          {mode === 'pick' ? (
            <div>
              <TextField id="party-search" size="sm" variant="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, contact ou ville…" leftIcon={<Search className="h-4 w-4" />} />
              <ul className={cn('mt-2 max-h-[220px] overflow-y-auto rounded-[10px] ring-1 ring-black/[0.06] dark:ring-white/[0.07]')}>
                {(options ?? []).map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => setPicked(p)} className={cn('flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/60', picked?.id === p.id && 'bg-primary/[0.06]')}>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-extrabold">{initials(p.name)}</span>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block truncate text-[13px] max-lg:text-[15px] font-semibold', TEXT.strong)}>{p.name}</span>
                        <span className={cn('block truncate text-[11.5px] max-lg:text-[13px]', TEXT.muted)}>{[p.contact_name, p.city, p.phone].filter(Boolean).join(' · ') || '—'}</span>
                      </span>
                      {picked?.id === p.id && <Tag tone="success">choisi</Tag>}
                    </button>
                  </li>
                ))}
                {options && options.length === 0 && (
                  <li className={cn('px-3 py-5 text-center text-[12.5px] max-lg:text-[14px]', TEXT.muted)}>
                    Personne dans l'annuaire. <button type="button" className="font-semibold text-foreground underline" onClick={() => setMode('new')}>Créer la fiche</button>
                  </li>
                )}
              </ul>
            </div>
          ) : (
            <PartyFields form={form} onChange={setForm} />
          )}
        </div>
        <div>
          <FieldLabel htmlFor="link-note" hint="pour ce conteneur seulement">3. Note (facultatif)</FieldLabel>
          <TextArea id="link-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Détient les originaux du B/L, a validé le BESC le 30/09…" />
        </div>
      </div>
    </CenterDialog>
  );
}

function EditDialog({ link, onClose, onSubmit, saving }: {
  link: CargoShipmentPartyWithParty; onClose: () => void; saving: boolean;
  onSubmit: (v: { party: ReturnType<typeof toInput>; note: string }) => void;
}) {
  const [form, setForm] = useState<PartyForm>(fromParty(link.party));
  const [note, setNote] = useState(link.note ?? '');
  const valid = form.name.trim().length > 0;
  const submit = () => { if (valid) onSubmit({ party: toInput(form), note }); };
  return (
    <CenterDialog
      open
      onClose={onClose}
      onConfirm={submit}
      width={640}
      title={`Modifier · ${roleLabel(link.role)}`}
      footer={
        <>
          <button type="button" onClick={onClose} className={cn('h-9 px-4 text-[13px] max-lg:text-[15px] font-semibold', SOFT_PILL)}>Annuler</button>
          <button type="button" onClick={submit} disabled={!valid || saving} className={cn('h-9 px-4 text-[13px] max-lg:text-[15px] font-bold disabled:opacity-60', PRIMARY_PILL)}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <PartyFields form={form} onChange={setForm} />
        <div>
          <FieldLabel htmlFor="edit-link-note" hint="pour ce conteneur seulement">Note sur ce conteneur</FieldLabel>
          <TextArea id="edit-link-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <p className={cn('text-[12px] max-lg:text-[14px]', TEXT.muted)}>La fiche (nom, contacts) est commune à tous les conteneurs : la corriger ici la corrige partout.</p>
      </div>
    </CenterDialog>
  );
}

/* ── L'onglet ─────────────────────────────────────────────────────────── */

export function TabIntervenants({ shipment: s, canManage }: { shipment: CargoShipment; canManage: boolean }) {
  const { data: links } = useCargoShipmentParties(s.id);
  const add = useAddShipmentParty();
  const update = useUpdateShipmentParty();
  const remove = useRemoveShipmentParty();
  const [adding, setAdding] = useState<{ role: PartyRole | null } | null>(null);
  const [editing, setEditing] = useState<CargoShipmentPartyWithParty | null>(null);
  const [removing, setRemoving] = useState<CargoShipmentPartyWithParty | null>(null);

  const list = useMemo(() => links ?? [], [links]);
  const byGroup = useMemo(() => {
    const m: Record<PartyGroup, CargoShipmentPartyWithParty[]> = { china: [], sea: [], cameroon: [], receiver: [] };
    for (const l of list) m[PARTY_ROLE_META[roleOf(l.role)].group].push(l);
    for (const k of Object.keys(m) as PartyGroup[]) m[k].sort((a, b) => PARTY_ROLES.indexOf(roleOf(a.role)) - PARTY_ROLES.indexOf(roleOf(b.role)));
    return m;
  }, [list]);
  const present = new Set(list.map((l) => l.role));
  const missing = KEY_ROLES.filter((r) => !present.has(r));

  return (
    <div className="space-y-5">
      <div className={cn('flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[14px] px-5 py-4', SURFACE.card, SURFACE.shadow)}>
        <div className="flex items-center gap-3">
          <IconTile icon={Users} tone="violet" size="lg" />
          <div>
            <div className={cn('text-[15px] max-lg:text-[17px] font-bold', TEXT.strong)}>Qui travaille sur ce conteneur</div>
            <div className={cn('text-[12.5px] max-lg:text-[14px]', TEXT.muted)}>
              {list.length === 0 ? 'Aucun intervenant renseigné' : `${list.length} intervenant${list.length > 1 ? 's' : ''} externe${list.length > 1 ? 's' : ''}`}
              {missing.length > 0 && ` · à compléter : ${missing.map((r) => PARTY_ROLE_META[r].label.replace(/ \(.*\)/, '').toLowerCase()).join(', ')}`}
            </div>
          </div>
        </div>
        {canManage && <ToolButton icon={UserPlus} primary className="ml-auto max-sm:ml-0" onClick={() => setAdding({ role: null })}>Ajouter un intervenant</ToolButton>}
      </div>

      {list.length === 0 ? (
        <Section icon={Users} tone="violet" title="Aucun intervenant">
          <Empty
            icon={UserPlus}
            title="Commence par les acteurs clés"
            action={canManage ? (
              <div className="flex flex-wrap justify-center gap-1.5">
                {KEY_ROLES.map((r) => (
                  <ToolButton key={r} icon={Plus} onClick={() => setAdding({ role: r })}>{PARTY_ROLE_META[r].label}</ToolButton>
                ))}
              </div>
            ) : undefined}
          >
            Le transitaire en Chine, le chargeur inscrit sur le B/L, l'armateur et son consignataire, la ou le déclarant en douane, le
            destinataire. Chacun garde sa fiche : on la retrouve au prochain conteneur.
          </Empty>
        </Section>
      ) : (
        PARTY_GROUPS.map((g) => {
          const items = byGroup[g.key];
          const gaps = missing.filter((r) => PARTY_ROLE_META[r].group === g.key);
          if (items.length === 0 && gaps.length === 0) return null;
          const { icon, tone } = GROUP_LOOK[g.key];
          return (
            <Section key={g.key} icon={icon} tone={tone} title={g.label} subtitle={g.hint} meta={items.length > 0 ? `${items.length}` : undefined}>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3 max-sm:grid-cols-1">
                {items.map((l) => (
                  <PartyCard key={l.id} link={l} canManage={canManage} onEdit={() => setEditing(l)} onRemove={() => setRemoving(l)} />
                ))}
                {canManage && gaps.map((r) => {
                  const I = ROLE_ICON[r];
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setAdding({ role: r })}
                      className="flex min-h-[120px] flex-col items-center justify-center gap-1.5 rounded-[12px] border border-dashed border-black/[0.14] px-4 text-center hover:border-primary/50 hover:bg-primary/[0.03] dark:border-white/[0.16]"
                    >
                      <I className={cn('h-5 w-5', TEXT.muted)} />
                      <span className={cn('text-[13px] max-lg:text-[15px] font-semibold', TEXT.strong)}>Ajouter : {PARTY_ROLE_META[r].label}</span>
                      <span className={cn('text-[11.5px] max-lg:text-[13px]', TEXT.muted)}>{PARTY_ROLE_META[r].hint}</span>
                    </button>
                  );
                })}
              </div>
            </Section>
          );
        })
      )}

      {adding && (
        <AddDialog
          initialRole={adding.role}
          saving={add.isPending}
          onClose={() => setAdding(null)}
          onSubmit={(v) => add.mutate(
            { shipmentId: s.id, role: v.role, note: v.note, partyId: v.partyId, party: v.party, position: list.length + 1 },
            { onSuccess: () => setAdding(null) },
          )}
        />
      )}
      {editing && (
        <EditDialog
          link={editing}
          saving={update.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(v) => update.mutate({ link: editing, party: v.party, note: v.note }, { onSuccess: () => setEditing(null) })}
        />
      )}
      <CenterDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Retirer cet intervenant ?"
        footer={
          <>
            <button type="button" onClick={() => setRemoving(null)} className={cn('h-9 px-4 text-[13px] font-semibold', SOFT_PILL)}>Garder</button>
            <ToolButton icon={X} danger onClick={() => removing && remove.mutate(removing, { onSuccess: () => setRemoving(null) })}>Retirer</ToolButton>
          </>
        }
      >
        <p className={cn('text-[13px] max-lg:text-[15px]', TEXT.body)}>
          <b>{removing?.party.name}</b> ne sera plus « {removing ? roleLabel(removing.role).toLowerCase() : ''} » sur ce conteneur. Sa fiche reste dans l'annuaire.
        </p>
      </CenterDialog>
    </div>
  );
}
