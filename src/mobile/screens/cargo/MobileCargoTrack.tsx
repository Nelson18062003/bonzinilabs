/**
 * Mobile admin — Cargo · Suivre une référence, en une colonne et au pouce.
 *
 * Même logique que la page desktop (recherche → résultat → ajouter ou
 * consulter), mais un vrai écran mobile : un seul Retour, un champ et un
 * bouton de 40 px, le résultat en carte, les armateurs et les dernières
 * recherches en lignes de liste. L'ajout à la flotte se fait dans une feuille
 * basse, pas dans un dialogue centré.
 */
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, Search as SearchIcon } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAddCargoShipment, useCargoLookup, useCargoShipments, useRecentCargoLookups, useRequestCargoLookup } from '@/hooks/useCargo';
import { CargoTimeline } from '@/components/cargo/CargoTimeline';
import { CargoManualAddDialog } from '@/components/cargo/CargoManualAddDialog';
import { lookupState, STALLED_BODY, STALLED_CAUSES, STALLED_TITLE } from '@/lib/cargo/lookup';
import { fmtDayLong } from '@/lib/cargo/plain';
import {
  CARRIER_LABEL, CARRIER_SUPPORT, cleanReference, fmtDayTime, guessCarrier, parseLookupResult, statusMeta, timelineFromLookup,
} from '@/lib/cargo/model';
import type { CargoLookup, LookupContainer } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import {
  TEXT, TYPE, SURFACE, Button, BottomSheet, Card, FormField, ListRow, ScreenLoader, SectionTitle, StatusPill, TextInput,
} from '@/mobile/designKit';

/** « Arrive à Kribi le 11 octobre » — pour un résultat d'armateur, qui n'est pas encore un dossier. */
function lookupArrival(c: LookupContainer): string {
  const place = c.pod?.name ?? 'destination inconnue';
  if (c.status === 'DELIVERED') return 'Livré';
  if (c.status === 'ARRIVED') return `Arrivé à ${place}`;
  if (!c.eta_carrier) return `Arrivée à ${place} : date inconnue`;
  return `Arrive à ${place} le ${fmtDayLong(new Date(c.eta_carrier))}`;
}

function ContainerResult({ c, lookup, alreadyId, onAdd, canManage }: { c: LookupContainer; lookup: CargoLookup; alreadyId: string | null; onAdd: () => void; canManage: boolean }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState(false);
  const meta = statusMeta(c.status);
  const items = useMemo(() => timelineFromLookup(c.events), [c.events]);
  const bl = (lookup.result && parseLookupResult(lookup.result)?.bl_number) || lookup.reference;
  return (
    <Card className="space-y-4">
      {/* Trois lignes, puis le bouton. Le reste attend en dessous. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className={cn('tabular-nums', TYPE.lead, TEXT.strong)}>{c.number}</span>
        <StatusPill tone={meta.tone} label={meta.label} />
      </div>
      <p className={cn('text-[18px] font-semibold leading-snug', TEXT.strong)}>{lookupArrival(c)}.</p>
      {c.vessel?.name && <p className={cn('text-[16px] leading-relaxed', TEXT.muted)}>Sur le navire {c.vessel.name}{c.voyage ? `, voyage ${c.voyage}` : ''}.</p>}
      {alreadyId ? (
        <Button variant="neutral" className="w-full" onClick={() => navigate(`/m/cargo/${alreadyId}`)}>Déjà dans ma flotte — ouvrir</Button>
      ) : canManage ? (
        <Button className="w-full" onClick={onAdd}>Ajouter à ma flotte</Button>
      ) : null}

      <button type="button" onClick={() => setDetail((v) => !v)} aria-expanded={detail} className={cn('flex h-10 w-full items-center justify-between text-[16px] font-semibold', TEXT.strong)}>
        {detail ? 'Masquer le détail' : 'Voir le détail'}
        <ChevronDown className={cn('h-5 w-5 transition-transform', detail && 'rotate-180')} />
      </button>
      {detail && (
        <div className={cn('space-y-3 border-t pt-3', SURFACE.divider)}>
          <p className={cn('text-[16px] leading-relaxed', TEXT.body)}>Bill of lading <b className="tabular-nums">{bl}</b>.</p>
          <p className={cn('text-[16px] leading-relaxed', TEXT.body)}>Chargé à <b>{c.pol?.name ?? '—'}</b>{c.etd_actual ? ` le ${fmtDayLong(new Date(c.etd_actual))}` : ''}, déchargé à <b>{c.pod?.name ?? '—'}</b>.</p>
          {c.last_event_label && <p className={cn('text-[16px] leading-relaxed', TEXT.body)}>Dernier jalon : <b>{c.last_event_label}</b>{c.last_event_at ? ` (${fmtDayTime(new Date(c.last_event_at))})` : ''}.</p>}
          <div className="admin-theme pt-1"><CargoTimeline items={items} /></div>
        </div>
      )}
    </Card>
  );
}

export function MobileCargoTrack() {
  const { hasPermission } = useAdminAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [ref, setRef] = useState(params.get('ref') ?? '');
  const lookupId = params.get('lookup');
  const request = useRequestCargoLookup();
  const { data: lookup } = useCargoLookup(lookupId);
  const { data: recent } = useRecentCargoLookups();
  const { data: fleet } = useCargoShipments();
  const add = useAddCargoShipment();
  const canManage = hasPermission('canManageCargo');

  const [adding, setAdding] = useState<LookupContainer | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [clientLabel, setClientLabel] = useState('');
  const [freight, setFreight] = useState('');
  const [etaPromised, setEtaPromised] = useState('');
  const [etdPromised, setEtdPromised] = useState('');

  const guess = guessCarrier(ref);
  const result = lookup ? parseLookupResult(lookup.result) : null;
  const state = lookupState(lookup);
  useEffect(() => { if (lookup && !ref) setRef(lookup.reference); }, [lookup, ref]);

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;

  const submit = () => {
    const clean = cleanReference(ref);
    if (clean.length < 6) return;
    request.mutate(clean, { onSuccess: (id) => setParams({ ref: clean, lookup: id }) });
  };

  const confirmAdd = () => {
    if (!adding || !lookupId) return;
    const f = freight.trim() === '' ? null : Number(freight.replace(/\s/g, '').replace(',', '.'));
    add.mutate(
      { lookupId, containerNumber: adding.number, clientLabel: clientLabel.trim(), freightUsd: Number.isFinite(f as number) ? f : null, etaPromised: etaPromised || null, etdPromised: etdPromised || null },
      { onSuccess: (id) => { setAdding(null); navigate(`/m/cargo/${id}`); } },
    );
  };

  const fleetIdFor = (n: string) => fleet?.find((s) => s.container_number === n)?.id ?? null;
  // Une boîte qu'on suit déjà : inutile d'interroger l'armateur, on l'ouvre.
  const typed = cleanReference(ref);
  const known = typed.length >= 6 ? fleet?.find((s) => s.container_number === typed || (s.bl_number ?? '').toUpperCase() === typed) ?? null : null;

  return (
    <div className="flex min-h-full flex-col">
      <MobileHeader title="Suivre une référence" showBack backTo="/m/cargo" />

      <div className="space-y-5 px-4 py-4">
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <FormField
            label="Bill of lading, booking ou n° de conteneur"
            htmlFor="cargo-track-ref"
            hint={
              guess
                ? guess.carrier === 'UNKNOWN' ? 'Format non reconnu' : `${CARRIER_LABEL[guess.carrier]} · ${guess.type === 'CONTAINER' ? 'conteneur' : 'bill of lading'}`
                : 'Maersk : 9 chiffres · conteneur : 4 lettres + 7 chiffres · CMA CGM : 3 lettres + 7 chiffres'
            }
          >
            <TextInput id="cargo-track-ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="274428633" autoComplete="off" autoCapitalize="characters" className="uppercase tracking-wide" inputMode="text" />
          </FormField>
          {known ? (
            <Card className="space-y-3">
              <p className={cn('text-[16px] leading-relaxed', TEXT.body)}>
                Cette boîte est déjà dans ma flotte : <b className={TEXT.strong}>{known.client_label}</b>, {known.container_number}.
              </p>
              <Button type="button" className="w-full" onClick={() => navigate(`/m/cargo/${known.id}`)}>Ouvrir le dossier</Button>
              <Button type="submit" variant="subtle" className="w-full" loading={request.isPending}>Interroger quand même l'armateur</Button>
            </Card>
          ) : (
            <Button type="submit" className="w-full" disabled={!guess || guess.carrier === 'UNKNOWN'} loading={request.isPending}>
              <SearchIcon /> Rechercher
            </Button>
          )}
        </form>

        {lookup && (
          <section className="space-y-2">
            <SectionTitle>
              Résultat {CARRIER_LABEL[lookup.carrier] ?? lookup.carrier}
              <span className={cn('ml-2 font-normal', TEXT.muted)}>{state === 'stalled' ? 'sans réponse' : state === 'pending' ? 'en cours' : ''}</span>
            </SectionTitle>
            {state === 'pending' && <ScreenLoader className="min-h-[120px]" label={`On interroge ${CARRIER_LABEL[lookup.carrier] ?? lookup.carrier}… quelques secondes.`} />}
            {state === 'stalled' && (
              <Card className="space-y-3">
                <p className={cn(TYPE.bodyStrong, TEXT.strong)}>{STALLED_TITLE}</p>
                <p className={cn('text-[16px] leading-relaxed', TEXT.body)}>{STALLED_BODY}</p>
                <ul className={cn('list-disc space-y-1 pl-5', 'text-[16px] leading-relaxed', TEXT.muted)}>
                  {STALLED_CAUSES.map((c) => <li key={c}>{c}</li>)}
                </ul>
                {canManage && <Button className="w-full" onClick={() => setManualOpen(true)}>Ajouter quand même à ma flotte</Button>}
                <Button variant="neutral" className="w-full" onClick={submit}>Réessayer</Button>
              </Card>
            )}
            {(lookup.status === 'error' || lookup.status === 'unsupported') && (
              <Card className="space-y-3">
                <p className={cn(TYPE.bodyStrong, TEXT.strong)}>{lookup.status === 'unsupported' ? 'Pas encore interrogeable' : 'Pas de résultat'}</p>
                <p className={cn('text-[16px] leading-relaxed', TEXT.body)}>{lookup.error}</p>
                {lookup.carrier === 'CMA_CGM' && (
                  <a
                    href={`https://www.cma-cgm.com/ebusiness/tracking/search?SearchBy=${lookup.reference_type === 'CONTAINER' ? 'Container' : 'BL'}&Reference=${lookup.reference}`}
                    target="_blank" rel="noopener noreferrer"
                    className={cn('flex h-10 w-full items-center justify-center rounded-lg border border-[#767676] bg-[#E3E3E3] text-[16px] font-medium text-[#303030] dark:border-[#767676] dark:bg-[#444444] dark:text-[#F5F5F5]')}
                  >
                    Ouvrir sur cma-cgm.com ↗
                  </a>
                )}
                {canManage && <Button className="w-full" onClick={() => setManualOpen(true)}>Ajouter quand même à ma flotte</Button>}
                <p className={cn('text-[16px] leading-relaxed', TEXT.muted)}>Le dossier existera avec les dates du transitaire ; les jalons arriveront quand l'armateur sera interrogeable.</p>
              </Card>
            )}
            {lookup.status === 'done' && result && result.containers.map((c) => (
              <ContainerResult key={c.number} c={c} lookup={lookup} alreadyId={fleetIdFor(c.number)} canManage={canManage} onAdd={() => { setAdding(c); setClientLabel(''); }} />
            ))}
          </section>
        )}

        <section>
          <SectionTitle>Armateurs</SectionTitle>
          <Card className="py-0">
            {CARRIER_SUPPORT.map((c) => (
              <ListRow
                key={c.carrier}
                title={c.label}
                subtitle={c.note}
                trailing={<StatusPill tone={c.state === 'live' ? 'success' : c.state === 'pending' ? 'pending' : 'neutral'} label={c.state === 'live' ? 'en direct' : c.state === 'pending' ? 'bientôt' : 'plus tard'} />}
              />
            ))}
          </Card>
        </section>

        <section>
          <SectionTitle>Dernières recherches</SectionTitle>
          {!recent || recent.length === 0 ? (
            <p className={cn('text-[16px] leading-relaxed', TEXT.muted)}>Aucune pour l'instant.</p>
          ) : (
            <Card className="py-0">
              {recent.map((l) => (
                <ListRow
                  key={l.id}
                  title={<span className={TYPE.code}>{l.reference}</span>}
                  subtitle={`${CARRIER_LABEL[l.carrier] ?? l.carrier} · ${l.status === 'done' ? 'trouvé' : l.status === 'pending' ? 'en cours' : 'sans résultat'}`}
                  onClick={() => { setRef(l.reference); setParams({ ref: l.reference, lookup: l.id }); }}
                />
              ))}
            </Card>
          )}
        </section>
      </div>

      {manualOpen && <div className="admin-theme"><CargoManualAddDialog open={manualOpen} onClose={() => setManualOpen(false)} reference={lookup?.reference ?? ref} /></div>}

      <BottomSheet open={!!adding} onClose={() => setAdding(null)} title={adding ? `Ajouter ${adding.number}` : ''}>
        <div className="space-y-4">
          <FormField label="Client" htmlFor="cargo-add-client">
            <TextInput id="cargo-add-client" value={clientLabel} onChange={(e) => setClientLabel(e.target.value)} placeholder="GAUSS, PRC, DJIANI…" />
          </FormField>
          <FormField label="Fret (USD)" htmlFor="cargo-add-freight">
            <TextInput id="cargo-add-freight" value={freight} onChange={(e) => setFreight(e.target.value)} placeholder="6 550" inputMode="decimal" className="tabular-nums" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Arrivée promise" htmlFor="cargo-add-eta">
              <TextInput id="cargo-add-eta" type="date" value={etaPromised} onChange={(e) => setEtaPromised(e.target.value)} />
            </FormField>
            <FormField label="Départ promis" htmlFor="cargo-add-etd">
              <TextInput id="cargo-add-etd" type="date" value={etdPromised} onChange={(e) => setEtdPromised(e.target.value)} />
            </FormField>
          </div>
          <p className={cn('text-[16px] leading-relaxed', TEXT.muted)}>Ce que le transitaire a annoncé. On le comparera à ce que l'armateur mesure.</p>
          <div className="flex gap-2">
            <Button variant="neutral" className="flex-1" onClick={() => setAdding(null)}>Annuler</Button>
            <Button className="flex-1" onClick={confirmAdd} disabled={!clientLabel.trim()} loading={add.isPending}>Ajouter</Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
