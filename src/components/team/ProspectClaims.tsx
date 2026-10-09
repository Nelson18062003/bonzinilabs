// ============================================================
// Mes équipes › Les commerciaux › À vérifier (07/10) — les fiches qu'un
// commercial a saisies avec le numéro d'un client Bonzini. Lui ne sait pas
// de quel client il s'agit ; la direction, si : côte à côte, ce qu'il a
// saisi et le client reconnu PAR LE NUMÉRO (les noms sont souvent
// imprécis). Elle décide :
//   · Attribuer — ce client devient celui du commercial (son origine est
//     REMPLACÉE par la fiche du commercial, le prospect « devenu client ») ;
//   · Refuser — la fiche passe « Perdu » avec un motif FIXE, « Déjà client
//     de Bonzini » (posé par le serveur) : c'est tout ce que lit le
//     commercial, qui ne doit pas apprendre de quel client il s'agit. La
//     note facultative de la direction reste interne (la vérification, le
//     journal) ; la fenêtre le dit. Le client n'est pas touché.
// Le commercial est prévenu dans les deux cas (côté serveur).
// Plusieurs clients reconnus pour une fiche : la direction choisit lequel.
// Un client déjà refusé à ce commercial (qui l'a ressaisi) le dit, avec la
// date. La fiche d'un commercial archivé ne s'attribue pas : « Confier à un
// commercial actif » d'abord (prospect_reassign), puis « Attribuer ».
// ?fiche=<prospect> met une fiche en évidence (lien de la notification) ;
// ?commercial=<fiche> n'affiche que celles d'un commercial (lien de sa page).
// canManageSales — garde serveur : prospect_claims_pending, prospect_resolve_claim.
// ============================================================
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Archive, ArrowLeft, Check, CircleCheck, ExternalLink, History, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useProspectClaims, useResolveProspectClaim, type ClaimClient, type ProspectClaim } from '@/hooks/useSales';
import { groupClaimsByProspect } from '@/hooks/useAdminNotifications';
import { PhoneNumber, ProspectStatusPill } from '@/components/sales/SalesBits';
import { TextArea } from '@/components/form';
import { currentMonth } from '@/lib/sales';
import { BTN_PRIMARY, BTN_SOFT, CARD, Initials, Modal, Skeleton } from './TeamBits';
import { TEAM_BASE } from './TeamScreen';
import { ReassignProspectDialog } from './ReassignProspectDialog';

/** Le motif FIXE que le serveur pose sur la fiche refusée : le seul que lit le commercial. */
export const REJECT_REASON = 'Déjà client de Bonzini';

/**
 * Sous la note d'un refus : elle reste à la direction (la vérification, le
 * journal) ; le commercial ne lit que le motif fixe — il ne doit pas apprendre
 * de quel client il s'agit (demande du 07/10). Espaces insécables avant « : ».
 */
export const REJECT_HINT = 'Pour la direction seulement (gardée au journal)\u00a0: le commercial ne la voit pas.';

export function ProspectClaims() {
  const { hasPermission } = useAdminAuth();
  if (!hasPermission('canManageSales')) return <Navigate to="/m" replace />;
  return <ClaimsPage />;
}

type Decision =
  | { kind: 'attribute'; group: ProspectClaim[]; claim: ProspectClaim }
  | { kind: 'reject'; group: ProspectClaim[] }
  | { kind: 'reassign'; group: ProspectClaim[] };

const fullName = (p: { first_name?: string | null; last_name?: string | null }) => [p.first_name, p.last_name].filter(Boolean).join(' ') || '—';

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtWhen = (iso: string) =>
  `${new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à ${new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

function ClaimsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const focus = params.get('fiche');
  const only = params.get('commercial');
  const claims = useProspectClaims();
  const groups = useMemo(() => groupClaimsByProspect(claims.data ?? []), [claims.data]);
  const shown = only ? groups.filter((g) => g[0].source_id === only) : groups;
  const onlyLabel = only ? groups.find((g) => g[0].source_id === only)?.[0].source_label : null;
  const [decision, setDecision] = useState<Decision | null>(null);

  // La fiche de la notification : amenée sous les yeux une fois la liste arrivée.
  useEffect(() => {
    if (!focus || !claims.data) return;
    document.getElementById(`fiche-${focus}`)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }, [focus, claims.data]);

  const clearFilter = () => {
    const next = new URLSearchParams(params);
    next.delete('commercial');
    setParams(next, { replace: true });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-0">
      <header className="space-y-1">
        <button
          type="button"
          onClick={() => navigate(only ? `${TEAM_BASE}/ventes/${only}` : `${TEAM_BASE}/ventes`)}
          className="mb-1 inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {only ? onlyLabel || 'Le commercial' : 'Les commerciaux'}
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[26px] font-bold tracking-tight">À vérifier</h1>
          {!claims.isLoading && shown.length > 0 && (
            <span className="inline-flex h-7 items-center rounded-full bg-amber-100 px-2.5 text-[13px] font-bold tabular-nums text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
              {shown.length}
            </span>
          )}
        </div>
        {/* Sans fiche, l'état vide explique tout seul : pas de « ces numéros… » au-dessus d'une liste vide. */}
        {(claims.isLoading || shown.length > 0) && (
          <p className="max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
            Ces numéros, saisis par vos commerciaux, sont déjà ceux de clients Bonzini. Le commercial ne sait pas de quel client il s’agit : c’est peut-être qu’il l’a
            rencontré et convaincu. À vous de décider.
          </p>
        )}
        {only && (
          <div className="pt-2">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary/10 pl-3 pr-1 text-[13px] font-semibold text-primary">
              {onlyLabel || 'Un commercial'}
              <button type="button" onClick={clearFilter} aria-label="Voir les fiches de tous les commerciaux" className="rounded-full p-1 hover:bg-primary/15">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
        )}
      </header>

      {claims.isLoading ? (
        <div className={CARD}>
          <Skeleton rows={3} />
        </div>
      ) : claims.isError ? (
        <div className={cn(CARD, 'p-8 text-center text-[14px]')} role="alert">
          {(claims.error as Error | null)?.message || 'Les fiches n’ont pas pu être chargées.'}{' '}
          <button type="button" onClick={() => void claims.refetch()} className="font-semibold underline">
            Réessayer
          </button>
        </div>
      ) : shown.length === 0 ? (
        <Empty filtered={!!only && groups.length > 0} onShowAll={clearFilter} />
      ) : (
        <div className="space-y-4">
          {shown.map((g) => (
            <ClaimCard
              key={g[0].prospect?.id ?? g[0].claim_id}
              group={g}
              focused={focus === g[0].prospect?.id}
              onAttribute={(claim) => setDecision({ kind: 'attribute', group: g, claim })}
              onReject={() => setDecision({ kind: 'reject', group: g })}
              onReassign={() => setDecision({ kind: 'reassign', group: g })}
            />
          ))}
        </div>
      )}

      {decision?.kind === 'attribute' && <AttributeDialog group={decision.group} claim={decision.claim} onClose={() => setDecision(null)} />}
      {decision?.kind === 'reject' && <RejectDialog group={decision.group} onClose={() => setDecision(null)} />}
      {decision?.kind === 'reassign' && <ReassignProspectDialog prospect={decision.group[0].prospect} month={currentMonth()} onClose={() => setDecision(null)} />}
    </div>
  );
}

function Empty({ filtered, onShowAll }: { filtered: boolean; onShowAll: () => void }) {
  return (
    <div className={cn(CARD, 'flex flex-col items-center px-6 py-12 text-center')}>
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
        <CircleCheck className="h-7 w-7" />
      </span>
      <h2 className="mt-4 text-[17px] font-bold">{filtered ? 'Rien à vérifier pour ce commercial' : 'Rien à vérifier'}</h2>
      <p className="mt-1 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
        Quand un commercial saisit le numéro d’un client Bonzini, sa fiche arrive ici et vous êtes prévenu. Vous décidez alors de lui attribuer ce client, ou non.
      </p>
      {filtered && (
        <button type="button" onClick={onShowAll} className={cn(BTN_SOFT, 'mt-5')}>
          Voir les fiches de tous les commerciaux
        </button>
      )}
    </div>
  );
}

/* ── Une fiche à vérifier ──────────────────────────────────────────────── */

function ClaimCard({
  group,
  focused,
  onAttribute,
  onReject,
  onReassign,
}: {
  group: ProspectClaim[];
  focused: boolean;
  onAttribute: (claim: ProspectClaim) => void;
  onReject: () => void;
  onReassign: () => void;
}) {
  const navigate = useNavigate();
  const first = group[0];
  const p = first.prospect;
  const many = group.length > 1;
  // Un seul client reconnu : il est choisi. Plusieurs : la direction choisit, rien n'est coché d'office.
  const [picked, setPicked] = useState<string | null>(many ? null : first.client.user_id);
  const chosen = group.find((c) => c.client.user_id === picked) ?? null;
  const matched = new Set(group.map((c) => c.matched_phone));
  const numbers = [
    { phone_e164: p.phone_e164, label: 'principal' as string | null },
    ...(p.phones ?? []).filter((x) => x.phone_e164 !== p.phone_e164).map((x) => ({ phone_e164: x.phone_e164, label: x.label })),
  ];
  const signaled = group.reduce((latest, c) => (c.created_at > latest ? c.created_at : latest), first.created_at);
  // Fiche commercial archivée : on ne lui attribue pas de client (le serveur refuse) — la confier d'abord.
  const archived = first.source_active === false;

  return (
    <article
      id={`fiche-${p.id}`}
      aria-label={`Fiche de ${fullName(p)}, saisie par ${first.source_label}`}
      className={cn(CARD, 'scroll-mt-24 overflow-hidden', focused && 'ring-2 ring-amber-400 dark:ring-amber-400/70')}
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-border/60 px-5 py-3.5">
        <Initials name={first.source_label} className="h-9 w-9 text-[13px]" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-semibold">{first.source_label}</div>
          <div className="text-[12.5px] text-muted-foreground">Signalé le {fmtWhen(signaled)}</div>
        </div>
        <ProspectStatusPill status="to_verify" />
      </header>

      <div className="grid md:grid-cols-2">
        {/* Ce que le commercial a saisi */}
        <section className="space-y-3 p-5" aria-label="Ce que le commercial a saisi">
          <Eyebrow>Ce que le commercial a saisi</Eyebrow>
          <div>
            <div className="text-[18px] font-bold leading-tight">{fullName(p)}</div>
            {(p.company || p.city) && <div className="mt-0.5 text-[13.5px] text-muted-foreground">{[p.company, p.city].filter(Boolean).join(' · ')}</div>}
          </div>
          <ul className="space-y-1.5">
            {numbers.map((n) => (
              <li key={n.phone_e164} className="flex flex-wrap items-center gap-2 text-[13.5px]">
                <PhoneNumber e164={n.phone_e164} className={cn(matched.has(n.phone_e164) && MATCH)} />
                {n.label && <span className="text-[12.5px] text-muted-foreground">{n.label}</span>}
              </li>
            ))}
          </ul>
          <p className="text-[12.5px] font-medium text-amber-800 dark:text-amber-300">
            Surligné : {matched.size > 1 ? 'les numéros des clients reconnus' : 'le numéro du client reconnu'}.
          </p>
          {p.pain_points && <Quote label="Ses problèmes">{p.pain_points}</Quote>}
          {p.help_needed && <Quote label="Ce que nous pouvons faire">{p.help_needed}</Quote>}
        </section>

        {/* Le (ou les) client(s) reconnu(s) */}
        <section className="space-y-3 border-t border-border/60 bg-muted/30 p-5 md:border-l md:border-t-0" aria-label="Le client reconnu">
          <Eyebrow>{many ? `${group.length} clients reconnus` : 'Le client reconnu'}</Eyebrow>
          {many && (
            <p className="flex items-start gap-1.5 text-[13px] font-medium text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Plusieurs clients ont ces numéros : choisissez lequel attribuer.
            </p>
          )}
          <div role={many ? 'radiogroup' : undefined} aria-label={many ? 'Le client à attribuer' : undefined} className="space-y-2.5">
            {group.map((c) => (
              <ClientBlock
                key={c.claim_id}
                claim={c}
                commercialSourceId={first.source_id}
                commercialLabel={first.source_label}
                selectable={many}
                selected={picked === c.client.user_id}
                onSelect={() => setPicked(c.client.user_id)}
                onOpen={() => navigate(`/m/clients/${c.client.user_id}`)}
              />
            ))}
          </div>
        </section>
      </div>

      {archived && (
        <p className="flex items-start gap-2 border-t border-border/60 bg-muted/40 px-5 py-3 text-[13.5px] leading-relaxed">
          <Archive className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          {/* Le texte après <strong> dans un gabarit : une espace en tête suivie d'un &nbsp; se perd au rendu de dev. */}
          <span>
            La fiche commercial de <strong>{first.source_label}</strong>
            {` est archivée\u00a0: confiez d’abord ce prospect à un commercial actif, puis attribuez-lui le client.`}
          </span>
        </p>
      )}
      <footer className="flex flex-col-reverse gap-2 border-t border-border/60 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-end">
        <button type="button" onClick={onReject} className={cn(BTN_SOFT, 'w-full sm:w-auto')}>
          Refuser
        </button>
        {archived ? (
          <button type="button" onClick={onReassign} className={cn(BTN_PRIMARY, 'w-full sm:w-auto')}>
            Confier à un commercial actif
          </button>
        ) : (
          <button type="button" disabled={!chosen} onClick={() => chosen && onAttribute(chosen)} className={cn(BTN_PRIMARY, 'w-full sm:w-auto')}>
            <Check className="h-4 w-4" /> Attribuer à {first.source_label}
          </button>
        )}
      </footer>
    </article>
  );
}

const MATCH = 'rounded-md bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-950 dark:bg-amber-500/20 dark:text-amber-100';

function Eyebrow({ children }: { children: ReactNode }) {
  return <h3 className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{children}</h3>;
}

function Quote({ label, children }: { label: string; children: string }) {
  return (
    <div className="rounded-xl bg-muted/60 px-3.5 py-2.5">
      <div className="text-[12px] font-semibold text-muted-foreground">{label}</div>
      <p className="mt-0.5 line-clamp-4 whitespace-pre-line text-[13.5px] leading-relaxed">{children}</p>
    </div>
  );
}

function ClientBlock({
  claim,
  commercialSourceId,
  commercialLabel,
  selectable,
  selected,
  onSelect,
  onOpen,
}: {
  claim: ProspectClaim;
  commercialSourceId: string;
  commercialLabel: string;
  selectable: boolean;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const c = claim.client;
  const replaced = !!c.source_id && c.source_id !== commercialSourceId;
  const body = (
    <>
      <div className="flex items-start gap-2.5">
        {selectable && (
          <span
            aria-hidden
            className={cn(
              'mt-1 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full ring-2',
              selected ? 'bg-primary ring-primary' : 'ring-black/25 dark:ring-white/30',
            )}
          >
            {selected && <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[16px] font-bold">{c.name}</span>
            {c.customer_code && <span className="text-[12.5px] font-semibold tabular-nums text-muted-foreground">{c.customer_code}</span>}
          </div>
          {(c.company || c.city) && <div className="text-[13px] text-muted-foreground">{[c.company, c.city].filter(Boolean).join(' · ')}</div>}
        </div>
      </div>
      {/* Téléphone : chaque libellé AU-DESSUS de sa valeur (un numéro ne tient pas à côté de « Numéro qui correspond ») ; deux colonnes ensuite. */}
      <dl className="mt-3 grid grid-cols-1 text-[13px] sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-4 sm:gap-y-1.5 [&>dd]:mb-2 sm:[&>dd]:mb-0 [&>dt]:text-[12px] sm:[&>dt]:text-[13px]">
        <dt className="text-muted-foreground">Numéro qui correspond</dt>
        <dd>
          <PhoneNumber e164={claim.matched_phone} className={MATCH} />
        </dd>
        {c.phone_e164 && c.phone_e164 !== claim.matched_phone && (
          <>
            <dt className="text-muted-foreground">Son numéro principal</dt>
            <dd>
              <PhoneNumber e164={c.phone_e164} />
            </dd>
          </>
        )}
        <dt className="text-muted-foreground">Origine actuelle</dt>
        <dd className={cn('font-medium', replaced && 'text-amber-800 dark:text-amber-300')}>{originLabel(c)}</dd>
        <dt className="text-muted-foreground">Inscrit le</dt>
        <dd className="font-medium">{fmtDay(c.created_at)}</dd>
        <dt className="text-muted-foreground">Opérations</dt>
        <dd className="font-medium">{activityLabel(c)}</dd>
        <dt className="text-muted-foreground">Dernière activité</dt>
        <dd className="font-medium">{c.last_activity_at ? fmtDay(c.last_activity_at) : 'aucune'}</dd>
      </dl>
      {/* Le commercial a ressaisi un client que la direction lui avait déjà refusé. */}
      {claim.previously_rejected_at && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[12.5px] font-medium text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          <History className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {`Déjà refusé à ${commercialLabel} le ${fmtDay(claim.previously_rejected_at)}`}
        </p>
      )}
    </>
  );

  return (
    <div className={cn('rounded-2xl bg-card p-4 ring-1', selectable && selected ? 'ring-2 ring-primary' : 'ring-black/[0.06] dark:ring-white/10')}>
      {selectable ? (
        <button type="button" role="radio" aria-checked={selected} aria-label={`${c.name}${c.customer_code ? ` (${c.customer_code})` : ''}`} onClick={onSelect} className="block w-full text-left">
          {body}
        </button>
      ) : (
        body
      )}
      <button type="button" onClick={onOpen} className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline">
        Voir sa fiche client <ExternalLink className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** « Commercial · Carine Ewane », « Facebook », « Non renseignée ». */
function originLabel(c: Pick<ClaimClient, 'source_id' | 'source_label' | 'source_kind'>): string {
  if (!c.source_id || !c.source_label) return 'Non renseignée';
  return c.source_kind === 'commercial' ? `Commercial · ${c.source_label}` : c.source_label;
}

/** « 3 dépôts · 2 paiements », « Aucune opération ». */
function activityLabel(c: Pick<ClaimClient, 'deposits_count' | 'payments_count'>): string {
  const d = Number(c.deposits_count) || 0;
  const y = Number(c.payments_count) || 0;
  if (d === 0 && y === 0) return 'Aucune opération';
  return [d ? `${d} dépôt${d > 1 ? 's' : ''}` : null, y ? `${y} paiement${y > 1 ? 's' : ''}` : null].filter(Boolean).join(' · ');
}

/* ── Les décisions ─────────────────────────────────────────────────────── */

function AttributeDialog({ group, claim, onClose }: { group: ProspectClaim[]; claim: ProspectClaim; onClose: () => void }) {
  const resolve = useResolveProspectClaim();
  const first = group[0];
  const c = claim.client;
  const commercial = first.source_label;
  const replaced = !!c.source_id && c.source_id !== first.source_id;
  return (
    <Modal
      title={`Attribuer ${c.name} à ${commercial}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_SOFT}>
            Annuler
          </button>
          <button
            type="button"
            disabled={resolve.isPending}
            onClick={() =>
              resolve.mutate(
                { prospectId: first.prospect.id, decision: 'attribute', clientUserId: c.user_id },
                { onSuccess: onClose },
              )
            }
            className={BTN_PRIMARY}
          >
            {resolve.isPending ? '…' : 'Attribuer'}
          </button>
        </>
      }
    >
      <p className="text-[14px] leading-relaxed">
        <strong>{c.name}</strong> devient un client de <strong>{commercial}</strong>&nbsp;: il comptera dans ses chiffres, et la fiche prospect «&nbsp;
        {fullName(first.prospect)}&nbsp;» passe «&nbsp;Devenu client&nbsp;». Le commercial est prévenu.
      </p>
      {replaced ? (
        <div role="alert" className="flex gap-2.5 rounded-xl bg-amber-50 px-3.5 py-3 text-[13.5px] leading-relaxed text-amber-950 dark:bg-amber-500/10 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
          <span>
            Ce client a déjà une origine : <strong>{originLabel(c)}</strong>. Elle sera remplacée par <strong>Commercial · {commercial}</strong>
            {c.source_kind === 'commercial' && ' — il ne comptera plus dans les chiffres de son commercial actuel'}.
          </span>
        </div>
      ) : (
        <p className="rounded-xl bg-muted/60 px-3.5 py-2.5 text-[13px] text-muted-foreground">Ce client n’a pas encore d’origine : elle devient «&nbsp;Commercial · {commercial}&nbsp;».</p>
      )}
    </Modal>
  );
}

function RejectDialog({ group, onClose }: { group: ProspectClaim[]; onClose: () => void }) {
  const resolve = useResolveProspectClaim();
  const [note, setNote] = useState('');
  const first = group[0];
  const commercial = first.source_label;
  return (
    <Modal
      title={`Refuser la fiche de ${fullName(first.prospect)}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_SOFT}>
            Annuler
          </button>
          <button
            type="button"
            disabled={resolve.isPending}
            onClick={() => resolve.mutate({ prospectId: first.prospect.id, decision: 'reject', note }, { onSuccess: onClose })}
            className={BTN_PRIMARY}
          >
            {resolve.isPending ? '…' : 'Refuser la fiche'}
          </button>
        </>
      }
    >
      {/* Un gabarit, pas « {commercial} passe… » : l'espace qui suit une expression avant un &nbsp; se perdait au rendu de dev (« Tchamipasse »). */}
      <p className="text-[14px] leading-relaxed">
        {`La fiche de ${commercial} passe «\u00a0Perdu\u00a0» avec le motif «\u00a0${REJECT_REASON}\u00a0», et le commercial est prévenu\u00a0: c’est tout ce qu’il lira, sans savoir de quel client il s’agit. Le client n’est pas touché\u00a0: il garde son origine.`}
      </p>
      <TextArea
        label="Note interne (facultative)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={'Ex.\u00a0: déjà suivi par le bureau de Douala'}
        hint={REJECT_HINT}
        maxLength={300}
        rows={3}
        controlClassName="rounded-xl bg-card"
      />
    </Modal>
  );
}
