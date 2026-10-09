// ============================================================
// Mes équipes › Ventes › un commercial — la direction seulement
// (canManageSales) ; le commercial voit les mêmes chiffres dans son espace
// « /v ». Refaite le 08/10 : la même lecture que la vue d'ensemble, pour
// LUI SEUL — ses tuiles et leurs tendances, l'évolution de ses chiffres
// (sales_series, sa fiche), ses prospects et son fret — puis :
//   · ses objectifs d'un mois, à fixer ou modifier ;
//   · ses prospects : ses fiches « À vérifier » (un numéro déjà client)
//     renvoient à l'écran de décision et se confient encore à un autre
//     commercial (une fiche d'un commercial archivé ne s'attribue pas
//     avant) ; un prospect en cours peut devenir client d'un geste
//     (« Créer son compte client » : le formulaire « Nouveau client », son
//     numéro déjà saisi, sa fiche reprise) ;
//   · les clients qu'il a apportés, avec leurs chiffres du mois choisi.
// Sur téléphone, les gestes d'un prospect passent SOUS la ligne (les
// coordonnées gardent toute la largeur).
// ============================================================
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Archive, ChevronRight, KeyRound, Phone, UserSearch, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCommercialClients, useCommercialDashboard, useProspects, type Prospect } from '@/hooks/useSales';
import { OPEN_STATUSES, PROSPECT_STATUS, clientPhoneE164, currentMonth, fmtCbm, fmtKg, fmtXaf, monthLabel, ofMonth, type ProspectStatus } from '@/lib/sales';
import { PhoneNumber, ProspectStatusPill } from '@/components/sales/SalesBits';
import { formatE164ForDisplay } from '@/components/form/PhoneNumberInput';
import { PROSPECT_CLAIMS_PATH } from '@/hooks/useAdminNotifications';
import { newClientPathForPhone } from '@/components/clients/prospectPrefill';
import { ErrorState, PANEL, Skeleton } from '@/components/salesdash';
import { BTN_SOFT, Initials } from './TeamBits';
import { TEAM_BASE } from './TeamScreen';
import { ReassignProspectDialog } from './ReassignProspectDialog';
import { DashboardBoundary, DefinitionsNote, SalesDashboardBody, SectionLabel, presetQuery, useSalesPreset } from './SalesDashboard';
import { ObjectivesPanel } from './SalesObjectives';

export function SalesCommercial() {
  const { hasPermission } = useAdminAuth();
  const { sourceId = '' } = useParams();
  if (!hasPermission('canManageSales')) return <Navigate to="/m" replace />;
  // Une autre fiche, une autre page : rien de la précédente (graphique, onglet, mois) ne reste affiché.
  return <Page key={sourceId} sourceId={sourceId} />;
}

type ProspectFilter = 'open' | ProspectStatus;

function Page({ sourceId }: { sourceId: string }) {
  const navigate = useNavigate();
  const [preset, setPreset] = useSalesPreset();
  // Le mois des objectifs et des chiffres de ses clients (le mois en cours d'abord).
  const [month, setMonth] = useState(currentMonth());
  const dash = useCommercialDashboard(month, sourceId);
  const card = dash.data;
  const title = card?.staff?.name || card?.source.label || '…';
  const archived = !!card && !card.source.is_active;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-0">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => navigate(`${TEAM_BASE}/ventes${presetQuery(preset)}`)}
            className="mb-1 inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Ventes
          </button>
          <div className="flex min-w-0 items-start gap-3 sm:items-center">
            <Initials name={card ? title : ''} disabled={archived || !!card?.staff?.is_disabled} className="mt-0.5 h-11 w-11 text-[15px] sm:mt-0" />
            <div className="min-w-0">
              <h1 className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[26px] font-bold leading-tight tracking-[-0.02em]">
                <span className="min-w-0 truncate">{title}</span>
                {archived && (
                  <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 text-[12.5px] font-semibold tracking-normal text-muted-foreground">
                    <Archive className="h-3.5 w-3.5" aria-hidden /> Fiche archivée
                  </span>
                )}
              </h1>
              {card && (
                <p className="mt-0.5 text-[14px] text-muted-foreground">
                  Fiche « {card.source.label} »{card.source.phone && ` · ${formatE164ForDisplay(card.source.phone)}`}
                  {!card.staff && ' · sans compte'}
                  {card.staff?.is_disabled && ' · accès désactivé'}
                </p>
              )}
            </div>
          </div>
        </div>
        {card?.staff && (
          <button type="button" onClick={() => navigate(`${TEAM_BASE}/${card.staff!.user_id}`)} className={BTN_SOFT}>
            <KeyRound className="h-4 w-4" /> Son accès
          </button>
        )}
      </header>

      {dash.isError && !card && (
        <div className={PANEL}>
          <ErrorState message={(dash.error as Error | null)?.message || 'Ce commercial est introuvable.'} onRetry={() => void dash.refetch()} height={160} />
        </div>
      )}

      {archived && (
        <p className="flex items-start gap-2.5 rounded-2xl bg-muted/60 px-4 py-3 text-[14px] leading-snug text-muted-foreground">
          <Archive className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>Cette fiche est archivée : ses chiffres restent, mais elle ne reçoit plus de clients. Ses prospects en cours se confient à un autre commercial (« Confier à… »).</span>
        </p>
      )}

      <DashboardBoundary resetKey={preset}>
        <SalesDashboardBody preset={preset} onPreset={setPreset} sourceId={sourceId} idPrefix="commercial" />
      </DashboardBoundary>

      <section aria-labelledby="commercial-suivi" className="space-y-3">
        <SectionLabel id="commercial-suivi">Son suivi</SectionLabel>
        <div className="space-y-4">
          {/* Une fiche archivée sans objectif ce mois-là n'a rien à fixer. */}
          {(dash.isLoading || (card && (!archived || card.objectives.length > 0))) && <ObjectivesPanel card={card} month={month} onMonth={setMonth} sourceId={sourceId} loading={dash.isLoading} />}
          <Prospects sourceId={sourceId} month={month} />
          <Clients sourceId={sourceId} month={month} />
        </div>
      </section>

      <DefinitionsNote />
    </div>
  );
}

/* ── Ses prospects ─────────────────────────────────────────────────────── */

function Prospects({ sourceId, month }: { sourceId: string; month: string }) {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  // Comme « Nouveau client » : qui peut créer un client peut créer le compte d'un prospect.
  const canCreateClient = hasPermission('canRegisterClients') || hasPermission('canEditClients');
  const prospects = useProspects(sourceId);
  const [filter, setFilter] = useState<ProspectFilter>('open');
  const [moving, setMoving] = useState<Prospect | null>(null);
  const isIn = (p: Prospect, f: ProspectFilter) => (f === 'open' ? OPEN_STATUSES.includes(p.status) : p.status === f);
  const list = (prospects.data ?? []).filter((p) => isIn(p, filter));
  const counts = (f: ProspectFilter) => (prospects.data ?? []).filter((p) => isIn(p, f)).length;
  const toVerify = counts('to_verify');
  // « À vérifier » n'apparaît que s'il y en a (ou si l'onglet est ouvert : la dernière décision ne le fait pas disparaître sous les yeux).
  const filters: ProspectFilter[] = toVerify > 0 || filter === 'to_verify' ? ['open', 'to_verify', 'won', 'lost'] : ['open', 'won', 'lost'];
  const total = prospects.data?.length ?? 0;

  return (
    <section className={cn(PANEL, 'overflow-hidden')}>
      <div className="space-y-3 px-4 pb-2 pt-4 sm:px-5 sm:pt-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[16px] font-semibold leading-snug tracking-[-0.01em]">Ses prospects</h2>
          {!prospects.isLoading && <span className="text-[14px] tabular-nums text-muted-foreground">{total} en tout</span>}
        </div>
        {toVerify > 0 && (
          <div className="flex flex-col gap-2 rounded-xl bg-amber-50 px-3.5 py-3 text-[14px] text-amber-950 sm:flex-row sm:items-center dark:bg-amber-500/10 dark:text-amber-100">
            <UserSearch className="hidden h-4 w-4 shrink-0 text-amber-600 sm:block dark:text-amber-300" />
            <span className="min-w-0 flex-1 leading-snug">
              <strong>
                {toVerify} fiche{toVerify > 1 ? 's' : ''} à vérifier
              </strong>{' '}
              : un numéro saisi est déjà celui d’un client Bonzini.
            </span>
            <button
              type="button"
              onClick={() => navigate(`${PROSPECT_CLAIMS_PATH}?commercial=${encodeURIComponent(sourceId)}`)}
              className="self-start text-[14px] font-semibold text-amber-900 underline underline-offset-2 sm:self-auto dark:text-amber-200"
            >
              Décider
            </button>
          </div>
        )}
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={cn(
                'h-9 shrink-0 rounded-full px-3.5 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                filter === f ? 'bg-foreground text-background' : 'bg-muted text-foreground hover:bg-accent',
              )}
            >
              {f === 'open' ? 'En cours' : PROSPECT_STATUS[f].label} <span className="ml-1 tabular-nums opacity-70">{counts(f)}</span>
            </button>
          ))}
        </div>
      </div>
      {prospects.isLoading ? (
        <div className="space-y-2 p-4 sm:p-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : prospects.isError ? (
        <ErrorState message="La liste n’a pas pu être chargée." onRetry={() => void prospects.refetch()} />
      ) : list.length === 0 ? (
        <p className="px-4 pb-5 pt-2 text-[14px] text-muted-foreground sm:px-5">Aucun prospect ici.</p>
      ) : (
        <ul className="divide-y divide-border/60 px-1 pb-1 sm:px-2 sm:pb-2">
          {list.map((p) => (
            // Le statut toujours à droite ; les gestes à côté sur ordinateur, SOUS la ligne sur téléphone ; la relance sous les coordonnées.
            <li key={p.id} className="flex flex-wrap items-start gap-x-3 gap-y-2 px-3 py-3.5 sm:flex-nowrap sm:items-center sm:gap-x-4">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">{[p.first_name, p.last_name].filter(Boolean).join(' ')}</span>
                {(p.company || p.city) && <span className="block text-[13px] text-muted-foreground">{[p.company, p.city].filter(Boolean).join(' · ')}</span>}
                {/* Le numéro sur sa propre ligne : jamais un « · » orphelin en fin de ligne. */}
                <span className="block text-[13px] text-muted-foreground">
                  <PhoneNumber e164={p.phone_e164} />
                  {(p.phones ?? []).length > 0 && ` +${(p.phones ?? []).length}`}
                  {p.status === 'lost' && p.lost_reason && ` · ${p.lost_reason}`}
                </span>
                {/* Ses plus gros problèmes (06/10) : ce que le responsable veut lire d'abord. */}
                {p.pain_points && (
                  <span className="mt-1 line-clamp-2 block whitespace-pre-line text-[13px] text-foreground/80">
                    <span className="font-semibold">Problèmes : </span>
                    {p.pain_points}
                  </span>
                )}
                {p.next_action_at && OPEN_STATUSES.includes(p.status) && (
                  <span className={cn('block text-[13px]', new Date(p.next_action_at) <= new Date() ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>
                    relance le {new Date(p.next_action_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </span>
              <span className="shrink-0 sm:order-last">
                <ProspectStatusPill status={p.status} />
              </span>
              {p.status !== 'won' && (
                <span className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 sm:w-auto sm:shrink-0 sm:justify-end">
                  {p.status === 'to_verify' && (
                    // Le numéro est déjà celui d'un client : la décision se prend sur l'écran « À vérifier ».
                    <button type="button" onClick={() => navigate(`${PROSPECT_CLAIMS_PATH}?fiche=${encodeURIComponent(p.id)}`)} className={LINK}>
                      Décider
                    </button>
                  )}
                  {canCreateClient && OPEN_STATUSES.includes(p.status) && (
                    <button
                      type="button"
                      onClick={() => navigate(newClientPathForPhone(p.phone_e164))}
                      className={LINK}
                      aria-label={`Créer le compte client de ${[p.first_name, p.last_name].filter(Boolean).join(' ')}`}
                    >
                      Créer son compte client
                    </button>
                  )}
                  {/* « À vérifier » compris : une fiche d'un commercial archivé se confie avant d'être attribuée. */}
                  <button type="button" onClick={() => setMoving(p)} className={LINK}>
                    Confier à…
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {moving && <ReassignProspectDialog prospect={moving} month={month} onClose={() => setMoving(null)} />}
    </section>
  );
}

const LINK = 'min-h-9 text-[14px] font-semibold text-primary hover:underline';

/* ── Ses clients ───────────────────────────────────────────────────────── */

function Clients({ sourceId, month }: { sourceId: string; month: string }) {
  const navigate = useNavigate();
  const clients = useCommercialClients(month, sourceId);
  const list = clients.data ?? [];
  return (
    <section className={cn(PANEL, 'overflow-hidden')}>
      <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-4 sm:px-5 sm:pt-5">
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold leading-snug tracking-[-0.01em]">Les clients qu’il a apportés</h2>
          <p className="mt-0.5 text-[14px] text-muted-foreground">Leurs paiements et leur fret {ofMonth(monthLabel(month))}</p>
        </div>
        {!clients.isLoading && <span className="shrink-0 text-[14px] tabular-nums text-muted-foreground">{list.length}</span>}
      </div>
      {clients.isLoading ? (
        <div className="space-y-2 p-4 sm:p-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : clients.isError ? (
        <ErrorState message="La liste n’a pas pu être chargée." onRetry={() => void clients.refetch()} />
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 p-8 text-center text-[14px] text-muted-foreground">
          <Users className="h-6 w-6" aria-hidden />
          Aucun client pour l’instant.
        </div>
      ) : (
        <ul className="px-1 pb-1 sm:px-2 sm:pb-2">
          {list.map((c) => (
            // Toute la ligne ouvre la fiche (le bouton du nom s'étend dessus) ; l'appel reste un lien à part, au-dessus.
            // Téléphone : nom, appel et chevron sur la première ligne, les trois chiffres en dessous ; une seule ligne sur ordinateur.
            <li key={c.user_id} className="sd-press relative flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-3 py-3 sm:flex-nowrap sm:gap-x-5">
              <button
                type="button"
                onClick={() => navigate(`/m/clients/${c.user_id}`)}
                className="min-w-0 flex-1 text-left outline-none after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-foreground"
              >
                <span className="block truncate text-[15px] font-semibold">{c.name || '—'}</span>
                <span className="block text-[13px] text-muted-foreground">
                  {[c.customer_code, c.company].filter(Boolean).join(' · ') || 'Client'} · depuis le {new Date(c.created_at).toLocaleDateString('fr-FR')}
                </span>
              </button>
              <span className="order-last grid w-full grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 rounded-xl bg-muted/50 px-3 py-2 sm:order-none sm:flex sm:w-auto sm:gap-5 sm:bg-transparent sm:p-0">
                <Metric label="Paiements" value={c.payments_xaf ? fmtXaf(c.payments_xaf) : '—'} />
                <Metric label="Avion" value={c.air_parcels ? fmtKg(c.air_kg) : '—'} />
                <Metric label="Bateau" value={c.sea_parcels ? fmtCbm(c.sea_cbm) : '—'} />
              </span>
              {c.phone && <CallClient phone={c.phone} />}
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Appeler un client : le lien part en E.164 (un ancien numéro local est lu comme camerounais) ; le numéro lisible au survol. */
function CallClient({ phone }: { phone: string }) {
  const e164 = clientPhoneE164(phone);
  const readable = formatE164ForDisplay(e164 ?? phone);
  return (
    <a
      href={`tel:${e164 ?? phone.replace(/[^\d+]/g, '')}`}
      className="relative z-10 shrink-0 rounded-full p-2 text-muted-foreground hover:bg-accent"
      aria-label={`Appeler le ${readable}`}
      title={readable}
    >
      <Phone className="h-4 w-4" />
    </a>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="min-w-0 tabular-nums sm:w-[120px] sm:text-right">
      <span className="block text-[12.5px] text-muted-foreground">{label}</span>
      <span className="block text-[14px] font-medium">{value}</span>
    </span>
  );
}
