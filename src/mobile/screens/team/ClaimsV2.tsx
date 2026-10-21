/**
 * Équipe › Ventes › À vérifier — refonte v2 (maquette 03/14). Les fiches
 * qu'un commercial a saisies avec le numéro d'un client Bonzini passent une
 * à une (1/4) : ce qu'il a saisi, le client qui a déjà ce numéro (toucher la
 * ligne ouvre sa fiche ; plusieurs : on choisit), puis Attribuer (noir) ou
 * Refuser (note interne facultative ; le commercial ne lit que « Déjà client
 * de Bonzini »). « … » : Confier à un autre commercial (obligatoire avant
 * d'attribuer la fiche d'un commercial archivé).
 * `canManageSales` ; RPC prospect_claims_pending, prospect_resolve_claim,
 * prospect_reassign. `?commercial=<fiche>` : seulement les siennes ;
 * `?fiche=<prospect>` : commence par celle-ci (lien de notification).
 */
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { UserRoundCog } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useProspectClaims, useReassignProspect, useResolveProspectClaim, useSalesOverview, type ProspectClaim } from '@/hooks/useSales';
import { groupClaimsByProspect } from '@/hooks/useAdminNotifications';
import { currentMonth } from '@/lib/sales';
import { formatE164ForDisplay } from '@/components/form/PhoneNumberInput';
import {
  ActionSheet, BigButton, BottomSheet, ConfirmSheet, Dock, EmptyLine, Initials, ItemList, ItemRow, KVBox, MoreButton, ScreenLoader, ScreenTop, SuccessView, Tag, TEXT,
  useSheet, type KV,
} from '@/mobile/designKit';
import { BigInput, ChoiceRow, FieldLabel } from '@/mobile/screens/clients/parts';
import { shortDay } from '@/mobile/screens/clients/ledgerRows';
import { TEAM_BASE } from './teamParts';

const fullName = (p: { first_name?: string | null; last_name?: string | null }) => [p.first_name, p.last_name].filter(Boolean).join(' ') || '—';

export function ClaimsV2() {
  const { hasPermission } = useAdminAuth();
  if (!hasPermission('canManageSales')) return <Navigate to="/m" replace />;
  return <Claims />;
}

function Claims() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const only = params.get('commercial');
  const focus = params.get('fiche');
  const claims = useProspectClaims();
  const resolve = useResolveProspectClaim();
  const more = useSheet();
  const groups = useMemo(() => {
    const all = groupClaimsByProspect(claims.data ?? []);
    const l = only ? all.filter((g) => g[0].source_id === only) : all;
    return focus ? [...l.filter((g) => g[0].prospect.id === focus), ...l.filter((g) => g[0].prospect.id !== focus)] : l;
  }, [claims.data, only, focus]);
  // La file se fige au chargement : une fiche décidée sort de la liste, on garde la position.
  const [done, setDone] = useState<string[]>([]);
  const queue = groups.filter((g) => !done.includes(g[0].prospect.id));
  const total = queue.length + done.length;
  const g = queue[0];
  const [pickedClient, setPickedClient] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | 'attribute' | 'reject' | 'reassign'>(null);
  const [note, setNote] = useState('');
  const currentId = g?.[0]?.prospect.id;
  useEffect(() => { setPickedClient(null); setNote(''); }, [currentId]);

  const back = only ? `${TEAM_BASE}/ventes/${only}` : `${TEAM_BASE}/ventes`;
  if (claims.isLoading) return <ScreenLoader className="min-h-[100dvh]" />;
  if (claims.isError) {
    return (
      <div className="min-h-[100dvh] bg-white dark:bg-[#1E1E1E]">
        <ScreenTop title="À vérifier" backTo={back} />
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void claims.refetch() }}>Les fiches n’ont pas pu être chargées.</EmptyLine>
      </div>
    );
  }
  if (!g) {
    return (
      <div className="min-h-[100dvh] bg-white dark:bg-[#1E1E1E]">
        <SuccessView title={done.length ? 'Tout est vérifié' : 'Rien à vérifier'} subtitle={done.length ? `${done.length} fiche${done.length > 1 ? 's' : ''} décidée${done.length > 1 ? 's' : ''}` : undefined} primary={{ label: 'Retour aux ventes', onClick: () => navigate(back) }} />
      </div>
    );
  }

  const first = g[0];
  const p = first.prospect;
  const archived = first.source_active === false;
  const claim: ProspectClaim | null = g.find((c) => c.client.user_id === pickedClient) ?? (g.length === 1 ? first : null);
  const commercialFirst = first.source_label.split(' ')[0];
  const next = () => { setDone((d) => [...d, p.id]); setSheet(null); };

  const rows: KV[] = [
    { label: 'Prospect', value: p.company || fullName(p) },
    { label: 'Contact', value: fullName(p) },
    { label: 'WhatsApp', value: formatE164ForDisplay(first.matched_phone || p.phone_e164) },
    { label: 'Ajouté', value: shortDay(p.created_at) },
  ];
  if (p.pain_points) rows.push({ label: 'Problèmes', value: p.pain_points });
  if (p.help_needed) rows.push({ label: 'Aide attendue', value: p.help_needed });

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#1E1E1E]">
      <ScreenTop title="À vérifier" step={`${done.length + 1}/${total}`} backTo={back} right={<MoreButton onClick={more.show} />} />
      <div className="px-5 pb-4 pt-5">
        <FieldLabel>Saisi par {first.source_label}{archived ? ' · archivée' : ''}</FieldLabel>
        <KVBox rows={rows} />
        <FieldLabel className="mt-6">Même numéro chez</FieldLabel>
        {g.length === 1 ? (
          <ItemList className="px-0">
            <ClientLine c={first} onOpen={() => navigate(`/m/clients/${first.client.user_id}`)} />
          </ItemList>
        ) : (
          <div role="radiogroup" aria-label="Le client reconnu">
            {g.map((c) => (
              <ChoiceRow
                key={c.claim_id}
                radioRight
                on={pickedClient === c.client.user_id}
                onClick={() => setPickedClient(c.client.user_id)}
                leading={<Initials name={c.client.name} />}
                title={c.client.name}
                subtitle={[c.client.customer_code, c.client.source_label ?? 'sans commercial'].filter(Boolean).join(' · ')}
              />
            ))}
          </div>
        )}
        {first.previously_rejected_at && <Tag tone="pending" className="mt-3">Déjà refusé le {shortDay(first.previously_rejected_at)}</Tag>}
        {archived && <Tag tone="pending" className="mt-3">Fiche archivée : confiez-la d’abord</Tag>}
      </div>
      <div aria-hidden className="h-16" />
      <Dock>
        <BigButton disabled={!claim || archived} onClick={() => setSheet('attribute')}>Attribuer à {commercialFirst}</BigButton>
        <BigButton variant="soft" onClick={() => setSheet('reject')}>Refuser</BigButton>
      </Dock>

      <ActionSheet open={more.open} onClose={more.hide} actions={[{ label: 'Confier à…', hint: 'un autre commercial', icon: UserRoundCog, onClick: () => setSheet('reassign') }]} />
      {claim && (
        <ConfirmSheet
          open={sheet === 'attribute'}
          onClose={() => setSheet(null)}
          title={`Attribuer ${claim.client.name} à ${first.source_label} ?`}
          subtitle="Le commercial est prévenu"
          rows={[{ label: 'Origine', before: claim.client.source_label ?? 'Aucune', value: `Commercial · ${first.source_label}` }, { label: 'Prospect', value: 'Devenu client' }]}
          confirmLabel="Attribuer"
          loading={resolve.isPending}
          onConfirm={() => resolve.mutate({ prospectId: p.id, decision: 'attribute', clientUserId: claim.client.user_id }, { onSuccess: next })}
        />
      )}
      <ConfirmSheet
        open={sheet === 'reject'}
        onClose={() => setSheet(null)}
        title={`Refuser la fiche de ${fullName(p)} ?`}
        subtitle="Le commercial lit « Déjà client de Bonzini »"
        confirmLabel="Refuser"
        danger
        loading={resolve.isPending}
        onConfirm={() => resolve.mutate({ prospectId: p.id, decision: 'reject', note }, { onSuccess: next })}
      >
        <FieldLabel htmlFor="rj-note" className="mt-0">Note · pour la direction</FieldLabel>
        <BigInput id="rj-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Facultatif" maxLength={300} />
      </ConfirmSheet>
      {sheet === 'reassign' && <ReassignSheet prospectId={p.id} sourceId={first.source_id} name={p.first_name} onClose={() => setSheet(null)} />}
    </div>
  );
}

function ClientLine({ c, onOpen }: { c: ProspectClaim; onOpen: () => void }) {
  return (
    <ItemRow
      leading={<Initials name={c.client.name} />}
      title={c.client.name}
      subtitle={[c.client.customer_code, c.client.source_label ?? 'sans commercial'].filter(Boolean).join(' · ')}
      right={
        <span className="shrink-0 text-right">
          <span className={cn('block text-[16px] font-bold tabular-nums', TEXT.strong)}>{c.client.payments_count} paiement{c.client.payments_count > 1 ? 's' : ''}</span>
          <span className={cn('block text-[15px]', TEXT.muted)}>{c.client.deposits_count} dépôt{c.client.deposits_count > 1 ? 's' : ''}</span>
        </span>
      }
      chevron
      onClick={onOpen}
    />
  );
}

/** « Confier à… » : un autre commercial actif (prospect_reassign). */
export function ReassignSheet({ prospectId, sourceId, name, onClose }: { prospectId: string; sourceId: string; name: string; onClose: () => void }) {
  const overview = useSalesOverview(currentMonth());
  const reassign = useReassignProspect();
  const others = (overview.data ?? []).filter((c) => c.source.id !== sourceId && c.source.is_active);
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <BottomSheet open onClose={reassign.isPending ? () => undefined : onClose}>
      <h3 className={cn('text-[22px] font-semibold leading-tight', TEXT.strong)}>Confier {name} à…</h3>
      {overview.isLoading ? (
        <div className="mt-4 h-20 animate-pulse rounded-lg bg-[#F5F5F5] dark:bg-[#383838]" />
      ) : others.length === 0 ? (
        <p className={cn('mt-3 text-[16px]', TEXT.muted)}>Aucun autre commercial actif.</p>
      ) : (
        <div role="radiogroup" className="mt-2">
          {others.map((c) => (
            <ChoiceRow key={c.source.id} radioRight on={picked === c.source.id} onClick={() => setPicked(c.source.id)} leading={<Initials name={c.staff?.name || c.source.label} />} title={c.staff?.name || c.source.label} subtitle={`${c.metrics.prospects_open} prospects en cours`} />
          ))}
        </div>
      )}
      <BigButton className="mt-5" disabled={!picked} loading={reassign.isPending} onClick={() => picked && reassign.mutate({ id: prospectId, sourceId: picked }, { onSuccess: onClose })}>Confier</BigButton>
    </BottomSheet>
  );
}
