/**
 * « Le client » — qui attend cette boîte, en phrases.
 *
 * Le dossier porte un nom libre venu du tableau du transitaire (« GAUSS »).
 * Rattaché à un vrai client Bonzini, il dit son téléphone, sa société, son
 * KYC, et ouvre sa fiche d'un geste. Dessous, ses autres conteneurs.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link2, Link2Off, MessageCircle, Search, Tag } from 'lucide-react';
import { useCargoClient, useCargoClientOptions, useCargoShipments, useUpdateCargoShipment } from '@/hooks/useCargo';
import { bestEta, fmtDay, statusMeta } from '@/lib/cargo/model';
import { arrivalSentence, delaySentence, uncap } from '@/lib/cargo/plain';
import { normalizePhone } from '@/lib/phone';
import { useAdminShippingSettings } from '@/hooks/useShippingSettings';
import { DEFAULT_SHIPPING_SETTINGS } from '@/lib/customerCode';
import { MobileShippingLabelSheet } from '@/mobile/components/clients/MobileShippingLabelSheet';
import type { CargoShipment } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { TEXT, BottomSheet, Button, Line, ListRow, StatusPill, TextInput } from '@/mobile/designKit';

export function MobileClient({ shipment: s, canManage }: { shipment: CargoShipment; canManage: boolean }) {
  const navigate = useNavigate();
  const { data: client } = useCargoClient(s.client_id);
  const { data: fleet } = useCargoShipments();
  const update = useUpdateCargoShipment();
  const [linkOpen, setLinkOpen] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);
  const { data: shipping } = useAdminShippingSettings();
  const [search, setSearch] = useState('');
  const { data: options } = useCargoClientOptions(search);

  const others = useMemo(
    () => (fleet ?? []).filter((o) => o.id !== s.id && (s.client_id ? o.client_id === s.client_id : o.client_label === s.client_label)),
    [fleet, s],
  );
  const link = (id: string) => update.mutate({ id: s.id, patch: { client_id: id } }, { onSuccess: () => setLinkOpen(false) });
  const place = client ? [client.city, client.country].filter(Boolean).join(', ') : '';

  // Prévenir le client, c'est presque toujours un message WhatsApp : on le
  // pré-écrit avec la phrase de l'app, il n'y a plus qu'à envoyer.
  const wa = client?.phone ? normalizePhone(client.phone, client.country ?? undefined)?.e164 ?? null : null;
  const delay = delaySentence(s);
  const message = `Bonjour ${client?.first_name ?? ''},\n\nvotre conteneur ${s.container_number} : ${uncap(arrivalSentence(s))}.${delay ? ` ${delay}.` : ''}\n\nBonzini Cargo`;
  const waHref = wa ? `https://wa.me/${wa.replace(/\D/g, '')}?text=${encodeURIComponent(message)}` : null;

  return (
    <div className="space-y-4">
      {client ? (
        <>
          <Line>
            <b className={TEXT.strong}>{client.first_name} {client.last_name}</b>{client.company_name ? `, ${client.company_name}` : ''}.
          </Line>
          {client.phone
            ? <Line>Téléphone : <a href={`tel:${client.phone}`} className={cn('font-semibold underline decoration-[#B3B3B3] underline-offset-4', TEXT.strong)}>{client.phone}</a>.</Line>
            : <Line tone="warn">Pas de numéro de téléphone sur sa fiche.</Line>}
          {client.email && <Line>Email : <b className={cn('break-all', TEXT.strong)}>{client.email}</b>.</Line>}
          {place && <Line>À {place}.</Line>}
          <Line tone={client.kyc_verified ? 'good' : 'warn'}>{client.kyc_verified ? 'Identité vérifiée.' : 'Identité pas encore vérifiée.'}</Line>
          {client.customer_code && (
            <>
              <Line>Identifiant client : <b className={cn('tabular-nums', TEXT.strong)}>{client.customer_code}</b>. C'est le code de ses étiquettes colis.</Line>
              <Button variant="neutral" className="w-full" onClick={() => setLabelOpen(true)}>
                <Tag />
                Étiquette colis pour son fournisseur
              </Button>
              <MobileShippingLabelSheet
                open={labelOpen}
                onClose={() => setLabelOpen(false)}
                code={client.customer_code}
                clientName={`${client.first_name ?? ''} ${client.last_name ?? ''}`.trim()}
                clientPhone={client.phone}
                clientEmail={client.email}
                companyName={client.company_name}
                clientCity={client.city}
                clientCountry={client.country}
                settings={shipping ?? DEFAULT_SHIPPING_SETTINGS}
              />
            </>
          )}
          {waHref && (
            <a href={waHref} target="_blank" rel="noopener noreferrer"
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#2C2C2C] bg-[#2C2C2C] px-3 text-[16px] font-medium text-[#F5F5F5] active:bg-[#1E1E1E] dark:border-[#E3E3E3] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]">
              <MessageCircle className="h-5 w-5" />
              Prévenir sur WhatsApp
            </a>
          )}
          {waHref && <Line className={TEXT.muted}>Le message est déjà écrit : « votre conteneur {s.container_number} : {uncap(arrivalSentence(s))}{delay ? `. ${delay}` : ''}. »</Line>}
          <Button variant={waHref ? 'neutral' : 'primary'} className="w-full" onClick={() => navigate(`/m/clients/${client.id}`)}>Ouvrir sa fiche client</Button>
          {canManage && (
            <Button variant="subtle" className="w-full" onClick={() => update.mutate({ id: s.id, patch: { client_id: null } })} loading={update.isPending}>
              <Link2Off />
              Détacher ce client du dossier
            </Button>
          )}
        </>
      ) : (
        <>
          <Line>Le dossier est au nom de <b className={TEXT.strong}>« {s.client_label} »</b>, le nom donné par le transitaire.</Line>
          <Line className={TEXT.muted}>Rattachez-le à un client Bonzini pour retrouver son téléphone, sa société et son portefeuille d'ici.</Line>
          {canManage && (
            <Button className="w-full" onClick={() => setLinkOpen(true)}>
              <Link2 />
              Rattacher à un client
            </Button>
          )}
        </>
      )}

      <div>
        <p className={cn('mb-1 text-[16px] font-semibold', TEXT.strong)}>
          {others.length === 0 ? 'Aucun autre conteneur suivi pour ce client.' : others.length === 1 ? 'Son autre conteneur' : `Ses ${others.length} autres conteneurs`}
        </p>
        {others.map((o) => {
          const meta = statusMeta(o.status);
          const eta = bestEta(o).date;
          return (
            <ListRow
              key={o.id}
              title={o.container_number}
              subtitle={`${o.pod_name ?? 'Arrivée'}${eta ? ` le ${fmtDay(eta)}` : ''}`}
              trailing={<StatusPill tone={meta.tone} label={meta.label} />}
              onClick={() => navigate(`/m/cargo/${o.id}`)}
            />
          );
        })}
      </div>

      <Line className={TEXT.muted}>
        Trois choses valent un appel au client : la date d'arrivée donnée par l'armateur, un report s'il y en a un, et le fait
        que la boîte ne sort pas du port sans télex.
      </Line>

      <BottomSheet open={linkOpen} onClose={() => setLinkOpen(false)} title="Quel client ?">
        <div className="space-y-3">
          <div className="relative">
            <Search className={cn('pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2', TEXT.muted)} />
            <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom ou entreprise" className="pl-10" autoFocus />
          </div>
          <div className="max-h-[50vh] overflow-y-auto">
            {(options ?? []).map((c) => (
              <ListRow key={c.id} title={`${c.first_name} ${c.last_name}`} subtitle={c.company_name || undefined} onClick={() => link(c.id)} chevron={false} />
            ))}
            {options && options.length === 0 && <Line className={TEXT.muted}>Aucun client avec ce nom.</Line>}
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
