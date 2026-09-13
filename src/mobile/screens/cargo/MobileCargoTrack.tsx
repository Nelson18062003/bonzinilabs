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
import { Search as SearchIcon } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAddCargoShipment, useCargoLookup, useCargoShipments, useRecentCargoLookups, useRequestCargoLookup } from '@/hooks/useCargo';
import { CargoTimeline } from '@/components/cargo/CargoTimeline';
import { CargoManualAddDialog } from '@/components/cargo/CargoManualAddDialog';
import { lookupState, STALLED_BODY, STALLED_CAUSES, STALLED_TITLE } from '@/lib/cargo/lookup';
import {
  CARRIER_LABEL, CARRIER_SUPPORT, cleanReference, fmtDay, fmtDayTime, guessCarrier, parseLookupResult, statusMeta, timelineFromLookup,
} from '@/lib/cargo/model';
import type { CargoLookup, LookupContainer } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import {
  TEXT, TYPE, SURFACE, Button, BottomSheet, Card, FormField, ListRow, Row, ScreenLoader, SectionTitle, StatusPill, TextInput,
} from '@/mobile/designKit';

function ContainerResult({ c, lookup, alreadyId, onAdd, canManage }: { c: LookupContainer; lookup: CargoLookup; alreadyId: string | null; onAdd: () => void; canManage: boolean }) {
  const navigate = useNavigate();
  const meta = statusMeta(c.status);
  const items = useMemo(() => timelineFromLookup(c.events), [c.events]);
  const bl = (lookup.result && parseLookupResult(lookup.result)?.bl_number) || lookup.reference;
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className={cn(TYPE.code, TEXT.strong)}>{c.number}</span>
        <StatusPill tone={meta.tone} label={meta.label} />
      </div>
      <div className="-my-1">
        <Row label="Navire" value={c.vessel?.name ?? '—'} />
        <Row label="Voyage" value={c.voyage ?? '—'} />
        <Row label="Bill of lading" value={bl} />
        <Row label="Chargement" value={c.pol?.name ?? '—'} />
        <Row label="Déchargement" value={c.pod?.name ?? '—'} />
        <Row label="Départ réel" value={c.etd_actual ? fmtDay(new Date(c.etd_actual)) : '—'} />
        <Row label="Arrivée" value={c.eta_carrier ? fmtDay(new Date(c.eta_carrier)) : '—'} />
        <Row label="Dernier jalon" value={c.last_event_at ? `${c.last_event_label ?? ''} · ${fmtDayTime(new Date(c.last_event_at))}` : (c.last_event_label ?? '—')} />
      </div>
      {alreadyId ? (
        <Button variant="neutral" className="w-full" onClick={() => navigate(`/m/cargo/${alreadyId}`)}>Déjà dans la flotte · ouvrir</Button>
      ) : canManage ? (
        <Button className="w-full" onClick={onAdd}>Ajouter à ma flotte</Button>
      ) : null}
      <div className={cn('border-t pt-3', SURFACE.divider)}>
        <SectionTitle>Suivi</SectionTitle>
        <div className="admin-theme">
          <CargoTimeline items={items} />
        </div>
      </div>
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
          <Button type="submit" className="w-full" disabled={!guess || guess.carrier === 'UNKNOWN'} loading={request.isPending}>
            <SearchIcon /> Rechercher
          </Button>
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
                <p className={cn(TYPE.small, TEXT.body)}>{STALLED_BODY}</p>
                <ul className={cn('list-disc space-y-1 pl-5', TYPE.small, TEXT.muted)}>
                  {STALLED_CAUSES.map((c) => <li key={c}>{c}</li>)}
                </ul>
                {canManage && <Button className="w-full" onClick={() => setManualOpen(true)}>Ajouter quand même à ma flotte</Button>}
                <Button variant="neutral" className="w-full" onClick={submit}>Réessayer</Button>
              </Card>
            )}
            {(lookup.status === 'error' || lookup.status === 'unsupported') && (
              <Card className="space-y-3">
                <p className={cn(TYPE.bodyStrong, TEXT.strong)}>{lookup.status === 'unsupported' ? 'Pas encore interrogeable' : 'Pas de résultat'}</p>
                <p className={cn(TYPE.small, TEXT.body)}>{lookup.error}</p>
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
                <p className={cn(TYPE.small, TEXT.muted)}>Le dossier existera avec les dates du transitaire ; les jalons arriveront quand l'armateur sera interrogeable.</p>
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
            <p className={cn(TYPE.small, TEXT.muted)}>Aucune pour l'instant.</p>
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
          <p className={cn(TYPE.small, TEXT.muted)}>Ce que le transitaire a annoncé. On le comparera à ce que l'armateur mesure.</p>
          <div className="flex gap-2">
            <Button variant="neutral" className="flex-1" onClick={() => setAdding(null)}>Annuler</Button>
            <Button className="flex-1" onClick={confirmAdd} disabled={!clientLabel.trim()} loading={add.isPending}>Ajouter</Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
