/**
 * Mobile admin — Cargo · Suivre un conteneur (refonte v2, maquettes 10/32
 * et 10/33). Même logique que la page desktop (recherche → résultat →
 * ajouter ou consulter) : la référence avec l'armateur reconnu à droite,
 * les armateurs couverts, les dernières recherches et « Interroger
 * l'armateur » en bas. Le résultat : la boîte, ses derniers jalons (tous
 * dans une feuille) et « Ajouter à ma flotte » (feuille : client, départ et
 * arrivée promis, fret USD). Sans réponse de l'armateur : « Ajouter sans
 * suivi » (feuille de saisie manuelle).
 */
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ExternalLink, History, PenLine, RefreshCw, Ship } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAddCargoShipment, useCargoLookup, useCargoShipments, useRecentCargoLookups, useRequestCargoLookup } from '@/hooks/useCargo';
import { lookupState, STALLED_TITLE } from '@/lib/cargo/lookup';
import {
  CARRIER_LABEL, CARRIER_SUPPORT, cleanReference, guessCarrier, parseLookupResult, statusMeta, timelineFromLookup,
} from '@/lib/cargo/model';
import type { CargoLookup, LookupContainer, TimelineItem } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import {
  BigButton, BottomSheet, Dock, IconCircle, ItemList, ItemRow, ScreenLoader, ScreenTop, SURFACE, TEXT, Tag, TextInput,
} from '@/mobile/designKit';
import { CapsLabel, CarrierCircle, RowButton, StateCircle, UnitField } from '@/mobile/components/cargo/v2';
import { boxNo } from './fleet';
import { ManualAddSheet } from './ManualAddSheet';

const shortDay = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : null);
const portName = (p: { name: string | null } | null | undefined) => (p?.name ?? '—').replace(/\s+(Port|Container Terminal|Terminal).*$/i, '').replace(/^GZ Oceangate.*$/i, 'Nansha');

/** Un jalon : fait (vert) ou estimé (gris). */
function EventRow({ e }: { e: TimelineItem }) {
  const done = e.classifier === 'ACT';
  return (
    <div className={cn('flex items-center gap-3.5 border-b py-3 last:border-b-0', SURFACE.divider)}>
      <StateCircle state={done ? 'done' : 'todo'} />
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[17px] font-semibold leading-snug', TEXT.strong)}>{e.label}</span>
        <span className={cn('block truncate text-[15px]', TEXT.muted)}>{[e.location ? portName({ name: e.location }) : null, e.vessel, shortDay(e.time)].filter(Boolean).join(' · ')}</span>
      </span>
    </div>
  );
}

function ContainerResult({ c, lookup, alreadyId, onAdd, canManage, single }: { c: LookupContainer; lookup: CargoLookup; alreadyId: string | null; onAdd: () => void; canManage: boolean; single: boolean }) {
  const navigate = useNavigate();
  const [all, setAll] = useState(false);
  const meta = statusMeta(c.status);
  const items = useMemo(() => [...timelineFromLookup(c.events)].sort((a, b) => a.time.localeCompare(b.time)), [c.events]);
  const done = items.filter((e) => e.classifier === 'ACT');
  const last = done.slice(-2);
  const bl = (lookup.result && parseLookupResult(lookup.result)?.bl_number) || lookup.reference;
  const arrival = c.status === 'DELIVERED' ? 'Livré' : c.status === 'ARRIVED' ? 'Arrivé' : shortDay(c.eta_carrier) ?? 'date inconnue';
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3.5 rounded-lg border border-[#D9D9D9] px-4 py-3.5 dark:border-[#444444]">
        <CarrierCircle carrier={lookup.carrier} />
        <span className="min-w-0 flex-1">
          <span className={cn('block text-[17px] font-semibold tabular-nums', TEXT.strong)}>{boxNo(c.number)}</span>
          <span className={cn('block truncate text-[15px]', TEXT.muted)}>{portName(c.pol)} → {portName(c.pod)} · {arrival}</span>
        </span>
        <Tag tone={meta.tone}>{meta.label}</Tag>
      </div>
      <div>
        {last.map((e) => <EventRow key={e.id} e={e} />)}
        {c.vessel?.name && c.status === 'AT_SEA' && (
          <div className={cn('flex items-center gap-3.5 py-3')}>
            <StateCircle state="here" icon={Ship} />
            <span className="min-w-0 flex-1">
              <span className={cn('block text-[17px] font-semibold', TEXT.strong)}>En mer</span>
              <span className={cn('block truncate text-[15px]', TEXT.muted)}>{[c.vessel.name, c.voyage].filter(Boolean).join(' · ')}</span>
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1">
        {items.length > 0 && <RowButton link onClick={() => setAll(true)}>Tous les jalons · {items.length}</RowButton>}
        {!single && (alreadyId
          ? <RowButton onClick={() => navigate(`/m/cargo/${alreadyId}`)}>Ouvrir</RowButton>
          : canManage && <RowButton onClick={onAdd}>Ajouter</RowButton>)}
      </div>

      <BottomSheet open={all} onClose={() => setAll(false)} title={boxNo(c.number)}>
        <p className={cn('pb-2 text-[15px] tabular-nums', TEXT.muted)}>B/L {bl}</p>
        {items.map((e) => <EventRow key={e.id} e={e} />)}
      </BottomSheet>
    </div>
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

  const f = freight.trim() === '' ? null : Number(freight.replace(/\s/g, '').replace(',', '.'));
  const freightOk = f === null || (Number.isFinite(f) && f >= 0);
  const confirmAdd = () => {
    if (!adding || !lookupId || !freightOk) return;
    add.mutate(
      { lookupId, containerNumber: adding.number, clientLabel: clientLabel.trim(), freightUsd: f, etaPromised: etaPromised || null, etdPromised: etdPromised || null },
      { onSuccess: (id) => { setAdding(null); navigate(`/m/cargo/${id}`); } },
    );
  };

  const fleetIdFor = (n: string) => fleet?.find((s) => s.container_number === n)?.id ?? null;
  // Une boîte qu'on suit déjà : inutile d'interroger l'armateur, on l'ouvre.
  const typed = cleanReference(ref);
  const known = typed.length >= 6 ? fleet?.find((s) => s.container_number === typed || (s.bl_number ?? '').toUpperCase() === typed) ?? null : null;
  const showing = !!lookup && cleanReference(lookup.reference) === typed;
  const containers = showing && lookup!.status === 'done' && result ? result.containers : [];
  const single = containers.length === 1 ? containers[0] : null;
  const singleId = single ? fleetIdFor(single.number) : null;
  const guessLabel = guess ? (guess.carrier === 'UNKNOWN' ? 'Inconnu' : CARRIER_LABEL[guess.carrier]) : '';
  const noAnswer = showing && (state === 'stalled' || lookup!.status === 'error' || lookup!.status === 'unsupported');

  // Le bouton noir du bas : il suit ce qu'on a sous les yeux.
  const dock = known && !showing
    ? <BigButton onClick={() => navigate(`/m/cargo/${known.id}`)}>Ouvrir le dossier</BigButton>
    : single
      ? singleId ? <BigButton onClick={() => navigate(`/m/cargo/${singleId}`)}>Ouvrir le dossier</BigButton>
        : canManage ? <BigButton onClick={() => { setAdding(single); setClientLabel(''); }}>Ajouter à ma flotte</BigButton> : null
      : noAnswer && canManage
        ? <BigButton onClick={() => setManualOpen(true)}>Ajouter sans suivi</BigButton>
        : <BigButton type="submit" onClick={submit} disabled={!guess || guess.carrier === 'UNKNOWN'} loading={request.isPending || (showing && state === 'pending')}>Interroger l'armateur</BigButton>;

  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <ScreenTop title="Suivre un conteneur" backTo="/m/cargo" />

      <div className="flex-1 px-5 pb-6 pt-5">
        <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <CapsLabel as="label">B/L, booking ou n° de conteneur</CapsLabel>
          <UnitField className="mt-2 [&_input]:text-[20px] [&_input]:uppercase [&_input]:tracking-wide" unit={guessLabel} value={ref} onChange={(e) => setRef(e.target.value)}
            placeholder="MRKU 7730415" autoComplete="off" autoCapitalize="characters" inputMode="text" aria-label="Référence" />
        </form>

        {known && !showing && (
          <ItemList className="-mx-5 pt-3">
            <ItemRow leading={<CarrierCircle carrier={known.carrier} />} title={boxNo(known.container_number)} subtitle={`Déjà suivi · ${known.client_label}`} onClick={() => navigate(`/m/cargo/${known.id}`)} chevron />
            <ItemRow leading={<IconCircle icon={RefreshCw} />} title="Interroger quand même" onClick={submit} />
          </ItemList>
        )}

        {showing && (
          <div className="pt-6">
            <CapsLabel>Résultat · {CARRIER_LABEL[lookup!.carrier] ?? lookup!.carrier}</CapsLabel>
            <div className="mt-3 space-y-5">
              {state === 'pending' && <ScreenLoader className="min-h-[120px]" label={`${CARRIER_LABEL[lookup!.carrier] ?? lookup!.carrier}…`} />}
              {noAnswer && (
                <>
                  <p className={cn('text-[17px] font-semibold', TEXT.strong)}>{state === 'stalled' ? STALLED_TITLE : lookup!.status === 'unsupported' ? 'Pas encore interrogeable' : 'Pas de résultat'}</p>
                  {lookup!.error && <p className={cn('text-[15px]', TEXT.muted)}>{lookup!.error}</p>}
                  <ItemList className="-mx-5">
                    <ItemRow leading={<IconCircle icon={RefreshCw} />} title="Réessayer" onClick={submit} />
                    {lookup!.carrier === 'CMA_CGM' && (
                      <ItemRow leading={<IconCircle icon={ExternalLink} />} title="Ouvrir sur cma-cgm.com"
                        onClick={() => window.open(`https://www.cma-cgm.com/ebusiness/tracking/search?SearchBy=${lookup!.reference_type === 'CONTAINER' ? 'Container' : 'BL'}&Reference=${lookup!.reference}`, '_blank', 'noopener,noreferrer')} />
                    )}
                    {canManage && <ItemRow leading={<IconCircle icon={PenLine} />} title="Ajouter sans suivi" subtitle="Dates du transitaire" onClick={() => setManualOpen(true)} chevron />}
                  </ItemList>
                </>
              )}
              {containers.map((c) => (
                <ContainerResult key={c.number} c={c} lookup={lookup!} alreadyId={fleetIdFor(c.number)} canManage={canManage} single={containers.length === 1} onAdd={() => { setAdding(c); setClientLabel(''); }} />
              ))}
            </div>
          </div>
        )}

        {!showing && (
          <>
            <CapsLabel className="pt-7">Armateurs</CapsLabel>
            <ItemList className="-mx-5">
              {CARRIER_SUPPORT.map((c) => (
                <ItemRow
                  key={c.carrier}
                  leading={<CarrierCircle carrier={c.carrier} />}
                  title={c.label}
                  subtitle={c.state === 'live' ? 'Jalons en direct' : 'Dates du transitaire'}
                  tag={c.state === 'live' ? { tone: 'success', label: 'En direct' } : { tone: 'neutral', label: c.state === 'pending' ? 'Bientôt' : 'Plus tard' }}
                />
              ))}
            </ItemList>

            {recent && recent.length > 0 && (
              <>
                <CapsLabel className="pt-6">Dernières recherches</CapsLabel>
                <ItemList className="-mx-5">
                  {recent.map((l) => {
                    const inFleet = fleet?.some((s) => s.container_number === l.reference || (s.bl_number ?? '').toUpperCase() === l.reference);
                    return (
                      <ItemRow
                        key={l.id}
                        leading={<IconCircle icon={History} />}
                        title={<span className="tabular-nums">{l.reference}</span>}
                        subtitle={[l.reference_type === 'CONTAINER' ? 'Conteneur' : 'B/L', inFleet ? 'déjà dans la flotte' : l.status === 'done' ? 'trouvé' : l.status === 'pending' ? 'en cours' : 'sans résultat'].join(' · ')}
                        onClick={() => { setRef(l.reference); setParams({ ref: l.reference, lookup: l.id }); }}
                        chevron
                      />
                    );
                  })}
                </ItemList>
              </>
            )}
          </>
        )}
      </div>

      {dock && <Dock>{dock}</Dock>}

      <ManualAddSheet open={manualOpen} onClose={() => setManualOpen(false)} reference={lookup?.reference ?? ref} />

      <BottomSheet open={!!adding} onClose={() => setAdding(null)} title={adding ? `Ajouter ${boxNo(adding.number)}` : ''}>
        <div className="space-y-4">
          <div><CapsLabel as="label">Client</CapsLabel><TextInput className="mt-2 h-14" value={clientLabel} onChange={(e) => setClientLabel(e.target.value)} placeholder="GAUSS, PRC, DJIANI…" aria-label="Client" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><CapsLabel as="label">Départ promis</CapsLabel><TextInput type="date" className="mt-2 h-14" value={etdPromised} onChange={(e) => setEtdPromised(e.target.value)} aria-label="Départ promis" /></div>
            <div><CapsLabel as="label">Arrivée promise</CapsLabel><TextInput type="date" className="mt-2 h-14" value={etaPromised} onChange={(e) => setEtaPromised(e.target.value)} aria-label="Arrivée promise" /></div>
          </div>
          <div><CapsLabel as="label">Fret</CapsLabel><UnitField className="mt-2" unit="USD" value={freight} onChange={(e) => setFreight(e.target.value)} placeholder="3 450" invalid={!freightOk} aria-label="Fret (USD)" /></div>
          <BigButton onClick={confirmAdd} disabled={!clientLabel.trim() || !freightOk} loading={add.isPending}>Ajouter à ma flotte</BigButton>
        </div>
      </BottomSheet>
    </div>
  );
}
