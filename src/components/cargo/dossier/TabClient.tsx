/**
 * Onglet Client — qui attend cette boîte.
 *
 * Le dossier porte un libellé libre (« GAUSS », venu du tableau du
 * transitaire) ; on peut le rattacher au VRAI client Bonzini pour retrouver
 * son téléphone, sa société, et ses autres conteneurs.
 */
import { useMemo, useState } from 'react';
import { Link2, Link2Off, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TextField } from '@/components/form';
import { useCargoClient, useCargoClientOptions, useCargoShipments, useUpdateCargoShipment } from '@/hooks/useCargo';
import { Empty, Fact, Facts, Section } from '@/components/cargo/dossier/kit';
import { bestEta, fmtDay, statusMeta } from '@/lib/cargo/model';
import type { CargoShipment } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { TEXT, SOFT_PILL, CenterDialog, RefChip, StatusPill } from '@/desktop/designKit';

export function TabClient({ shipment: s, canManage }: { shipment: CargoShipment; canManage: boolean }) {
  const navigate = useNavigate();
  const { data: client } = useCargoClient(s.client_id);
  const { data: fleet } = useCargoShipments();
  const update = useUpdateCargoShipment();
  const [linkOpen, setLinkOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data: options } = useCargoClientOptions(search);

  const others = useMemo(
    () => (fleet ?? []).filter((o) => o.id !== s.id && (s.client_id ? o.client_id === s.client_id : o.client_label === s.client_label)),
    [fleet, s],
  );

  const link = (id: string) => update.mutate({ id: s.id, patch: { client_id: id } }, { onSuccess: () => setLinkOpen(false) });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-5 max-lg:grid-cols-1">
      <div className="space-y-5">
        <Section
          title="Client Bonzini"
          action={canManage ? (
            client ? (
              <button type="button" onClick={() => update.mutate({ id: s.id, patch: { client_id: null } })} className={cn('inline-flex h-7 items-center gap-1 px-2.5 text-[11.5px] font-semibold', SOFT_PILL)}>
                <Link2Off className="h-3 w-3" /> Détacher
              </button>
            ) : (
              <button type="button" onClick={() => setLinkOpen(true)} className={cn('inline-flex h-7 items-center gap-1 px-2.5 text-[11.5px] font-semibold', SOFT_PILL)}>
                <Link2 className="h-3 w-3" /> Rattacher
              </button>
            )
          ) : undefined}
        >
          {client ? (
            <>
              <Facts cols={3}>
                <Fact label="Nom" value={`${client.first_name} ${client.last_name}`} />
                <Fact label="Société" value={client.company_name || '—'} />
                <Fact label="Téléphone" value={client.phone || '—'} />
                <Fact label="Email" value={client.email || '—'} />
                <Fact label="Ville" value={[client.city, client.country].filter(Boolean).join(', ') || '—'} />
                <Fact label="KYC" value={client.kyc_verified ? <span className="text-emerald-700 dark:text-emerald-400">Vérifié</span> : 'Non vérifié'} />
              </Facts>
              <button type="button" onClick={() => navigate(`/m/clients/${client.id}`)} className={cn('mt-4 inline-flex h-8 items-center px-3 text-[12px] font-semibold', SOFT_PILL)}>
                Ouvrir la fiche client →
              </button>
            </>
          ) : (
            <Empty title={`Dossier au nom de « ${s.client_label} »`}>
              Ce libellé vient du tableau du transitaire. Rattache-le à un client Bonzini pour retrouver son téléphone, sa
              société et son portefeuille depuis ce dossier.
            </Empty>
          )}
        </Section>

        <Section title="Ses autres conteneurs" meta={others.length ? `${others.length}` : undefined}>
          {others.length === 0 ? (
            <Empty title="Aucun autre conteneur suivi" />
          ) : (
            <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
              {others.map((o) => {
                const meta = statusMeta(o.status);
                return (
                  <li key={o.id}>
                    <button type="button" onClick={() => navigate(`/m/cargo/${o.id}`)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left">
                      <span className="flex min-w-0 items-center gap-2">
                        <RefChip>{o.container_number}</RefChip>
                        <span className={cn('truncate text-[12.5px]', TEXT.muted)}>{o.vessel_name ?? '—'}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2.5">
                        <span className={cn('text-[12.5px] font-semibold tabular-nums', TEXT.strong)}>{o.pod_name} · {fmtDay(bestEta(o).date)}</span>
                        <StatusPill tone={meta.tone} label={meta.label} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Ce que le client doit savoir">
        <p className={cn('text-[12.5px] leading-relaxed', TEXT.body)}>
          Trois informations valent un appel : la <b>date d'arrivée</b> annoncée par l'armateur (pas celle du transitaire),
          le <b>report</b> s'il y en a un, et le fait que le conteneur ne sortira pas du port sans <b>télex release</b>.
        </p>
        <p className={cn('mt-3 text-[12.5px]', TEXT.muted)}>
          Libellé du dossier : <b className={TEXT.body}>{s.client_label}</b>
          {client ? ' · rattaché à une fiche client Bonzini.' : ' · aucune fiche client rattachée.'}
        </p>
      </Section>

      <CenterDialog
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title="Rattacher à un client Bonzini"
        footer={<button type="button" onClick={() => setLinkOpen(false)} className={cn('ml-auto h-9 px-4 text-[13px] font-semibold', SOFT_PILL)}>Fermer</button>}
      >
        <TextField id="cargo-client-search" size="sm" variant="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, prénom ou société…" leftIcon={<Search className="h-4 w-4" />} />
        <ul className="mt-3 max-h-[320px] overflow-y-auto">
          {(options ?? []).map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => link(c.id)} className={cn('flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted/50')}>
                <span className={cn('text-[13px] font-semibold', TEXT.strong)}>{c.first_name} {c.last_name}</span>
                <span className={cn('text-[12px]', TEXT.muted)}>{c.company_name || '—'}</span>
              </button>
            </li>
          ))}
          {options && options.length === 0 && <li className={cn('px-3 py-6 text-center text-[13px]', TEXT.muted)}>Aucun client trouvé.</li>}
        </ul>
      </CenterDialog>
    </div>
  );
}
