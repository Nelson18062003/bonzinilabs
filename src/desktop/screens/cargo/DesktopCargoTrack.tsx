/**
 * Desktop admin — Cargo · Suivre une référence.
 *
 * Archétype 02-foundation §2.C (page de création) : colonne principale = la
 * décision (référence → résultat → ajouter ou consulter), rail droit = le
 * contexte (armateurs pris en charge, dernières recherches).
 */
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Search as SearchIcon } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAddCargoShipment, useCargoLookup, useCargoShipments, useRecentCargoLookups, useRequestCargoLookup } from '@/hooks/useCargo';
import { CargoTimeline } from '@/components/cargo/CargoTimeline';
import { CargoManualAddDialog } from '@/components/cargo/CargoManualAddDialog';
import {
  CARRIER_LABEL, CARRIER_SUPPORT, cleanReference, fmtDay, fmtDayTime, guessCarrier, parseLookupResult, statusMeta, timelineFromLookup,
} from '@/lib/cargo/model';
import type { CargoLookup, LookupContainer } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { DateField, NumberField, TextField } from '@/components/form';
import { TEXT, PRIMARY_PILL, SOFT_PILL, TONE_PILL, Card, CardHeader, SecLabel, KV, RefChip, StatusPill, CenterDialog, relShort } from '@/desktop/designKit';

function ContainerResult({ c, lookup, alreadyId, onAdd }: { c: LookupContainer; lookup: CargoLookup; alreadyId: string | null; onAdd: () => void }) {
  const navigate = useNavigate();
  const meta = statusMeta(c.status);
  const items = useMemo(() => timelineFromLookup(c.events), [c.events]);
  return (
    <div className="border-t border-black/[0.06] px-5 py-4 first:border-t-0 dark:border-white/[0.06]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <RefChip>{c.number}</RefChip>
          <StatusPill tone={meta.tone} label={meta.label} />
          {c.iso && <span className={cn('text-[12px]', TEXT.muted)}>{c.iso === '45G1' ? "40' High Cube" : c.iso}</span>}
        </div>
        {alreadyId ? (
          <button type="button" onClick={() => navigate(`/m/cargo/${alreadyId}`)} className={cn('h-8 px-3 text-[12px] font-semibold', SOFT_PILL)}>Déjà dans la flotte · ouvrir</button>
        ) : (
          <button type="button" onClick={onAdd} className={cn('h-8 px-3.5 text-[12px] font-bold', PRIMARY_PILL)}>Ajouter à ma flotte</button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-2.5">
        <KV k="Navire" v={c.vessel?.name ?? '—'} />
        <KV k="Voyage" v={c.voyage ?? '—'} />
        <KV k="Bill of lading" v={<span className="font-mono">{lookup.result && parseLookupResult(lookup.result)?.bl_number ? parseLookupResult(lookup.result)!.bl_number : lookup.reference}</span>} />
        <KV k="Chargement" v={c.pol?.name ?? '—'} />
        <KV k="Déchargement" v={c.pod?.name ?? '—'} />
        <KV k="Départ réel" v={c.etd_actual ? fmtDay(new Date(c.etd_actual)) : '—'} />
        <KV k="Arrivée" v={c.eta_carrier ? fmtDay(new Date(c.eta_carrier)) : '—'} />
        <KV k="Dernier jalon" v={c.last_event_label ?? '—'} />
        <KV k="Le" v={c.last_event_at ? fmtDayTime(new Date(c.last_event_at)) : '—'} />
      </div>
      <div className="mt-3 border-t border-black/[0.06] pt-2.5 dark:border-white/[0.06]">
        <SecLabel className="mb-2">Suivi</SecLabel>
        <CargoTimeline items={items} />
      </div>
    </div>
  );
}

export function DesktopCargoTrack() {
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
  const [freight, setFreight] = useState<number | null>(null);
  const [etaPromised, setEtaPromised] = useState('');
  const [etdPromised, setEtdPromised] = useState('');

  const guess = guessCarrier(ref);
  const result = lookup ? parseLookupResult(lookup.result) : null;
  useEffect(() => { if (lookup && !ref) setRef(lookup.reference); }, [lookup, ref]);

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;

  const submit = () => {
    const clean = cleanReference(ref);
    if (clean.length < 6) return;
    request.mutate(clean, { onSuccess: (id) => setParams({ ref: clean, lookup: id }) });
  };

  const confirmAdd = () => {
    if (!adding || !lookupId) return;
    add.mutate(
      {
        lookupId, containerNumber: adding.number, clientLabel: clientLabel.trim(),
        freightUsd: freight, etaPromised: etaPromised || null, etdPromised: etdPromised || null,
      },
      { onSuccess: (id) => { setAdding(null); navigate(`/m/cargo/${id}`); } },
    );
  };

  const fleetIdFor = (n: string) => fleet?.find((s) => s.container_number === n)?.id ?? null;

  return (
    <div className="mx-auto max-w-[1080px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <button type="button" onClick={() => navigate('/m/cargo')} className={cn('mb-2 inline-flex items-center gap-1 text-[12px] font-semibold', TEXT.muted)}>
            <ArrowLeft className="h-3.5 w-3.5" /> Ma flotte
          </button>
          <h2 className={cn('text-[26px] font-extrabold tracking-tight', TEXT.strong)}>Suivre un conteneur</h2>
          <p className={cn('mt-1 text-[14px]', TEXT.muted)}>Un bill of lading, un booking ou un numéro de conteneur. On interroge l'armateur, tu décides ensuite.</p>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)_360px] gap-6">
        {/* ── Colonne principale ──────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card className="p-5">
            <SecLabel className="mb-2">Référence</SecLabel>
            <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
              <TextField
                id="cargo-track-ref"
                variant="search"
                size="sm"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="274428633 · MIEU3611115 · GGZ3133535"
                autoComplete="off"
                wrapperClassName="flex-1"
                className="font-mono uppercase tracking-wide"
              />
              <button type="submit" disabled={!guess || request.isPending} className={cn('inline-flex h-9 shrink-0 items-center gap-2 px-4 text-[13px] font-bold disabled:opacity-60', PRIMARY_PILL)}>
                {request.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchIcon className="h-4 w-4" />} Rechercher
              </button>
            </form>
            <div className={cn('mt-2 flex flex-wrap items-center gap-2 text-[12px]', TEXT.muted)}>
              {guess ? (
                <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold', guess.carrier === 'UNKNOWN' ? TONE_PILL.danger : TONE_PILL.neutral)}>
                  {guess.carrier === 'UNKNOWN' ? 'Format non reconnu' : `${CARRIER_LABEL[guess.carrier]} · ${guess.type === 'CONTAINER' ? 'conteneur' : 'bill of lading'}`}
                </span>
              ) : (
                <span>B/L Maersk : 9 chiffres · conteneur : 4 lettres + 7 chiffres · B/L CMA CGM : 3 lettres + 7 chiffres</span>
              )}
            </div>
          </Card>

          {lookup && (
            <Card className="overflow-hidden p-0">
              <CardHeader
                title={`Résultat ${CARRIER_LABEL[lookup.carrier] ?? lookup.carrier}`}
                meta={lookup.completed_at ? `il y a ${relShort(lookup.completed_at)}` : 'en cours'}
              />
              {lookup.status === 'pending' && (
                <div className={cn('flex items-center gap-3 px-5 py-8 text-[13px]', TEXT.muted)}>
                  <Loader2 className="h-4 w-4 animate-spin" /> On interroge {CARRIER_LABEL[lookup.carrier] ?? lookup.carrier}… quelques secondes.
                </div>
              )}
              {(lookup.status === 'error' || lookup.status === 'unsupported') && (
                <div className="px-5 py-5">
                  <p className={cn('text-[13px] font-semibold', TEXT.strong)}>{lookup.status === 'unsupported' ? 'Pas encore interrogeable' : 'Pas de résultat'}</p>
                  <p className={cn('mt-1 text-[13px]', TEXT.body)}>{lookup.error}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {lookup.carrier === 'CMA_CGM' && (
                      <a href={`https://www.cma-cgm.com/ebusiness/tracking/search?SearchBy=${lookup.reference_type === 'CONTAINER' ? 'Container' : 'BL'}&Reference=${lookup.reference}`} target="_blank" rel="noopener noreferrer" className={cn('inline-flex h-8 items-center px-3 text-[12px] font-semibold', SOFT_PILL)}>
                        Ouvrir sur cma-cgm.com ↗
                      </a>
                    )}
                    {canManage && (
                      <button type="button" onClick={() => setManualOpen(true)} className={cn('inline-flex h-8 items-center px-3 text-[12px] font-bold', PRIMARY_PILL)}>
                        Ajouter quand même à ma flotte
                      </button>
                    )}
                  </div>
                  <p className={cn('mt-2 text-[12px]', TEXT.muted)}>Le dossier existera avec les dates du transitaire ; les jalons arriveront quand l'armateur sera interrogeable.</p>
                </div>
              )}
              {lookup.status === 'done' && result && result.containers.map((c) => (
                <ContainerResult
                  key={c.number}
                  c={c}
                  lookup={lookup}
                  alreadyId={fleetIdFor(c.number)}
                  onAdd={() => { if (canManage) { setAdding(c); setClientLabel(''); } }}
                />
              ))}
            </Card>
          )}
        </div>

        {/* ── Rail droit ──────────────────────────────────────────────────── */}
        <aside className="space-y-4">
          <div className="sticky top-[84px] space-y-4">
            <Card className="p-4">
              <SecLabel className="mb-2">Armateurs</SecLabel>
              <ul className="space-y-2.5">
                {CARRIER_SUPPORT.map((c) => (
                  <li key={c.carrier} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className={cn('text-[13px] font-semibold', TEXT.strong)}>{c.label}</div>
                      <div className={cn('text-[11.5px]', TEXT.muted)}>{c.note}</div>
                    </div>
                    <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-[10.5px] font-bold', c.state === 'live' ? TONE_PILL.success : c.state === 'pending' ? TONE_PILL.pending : TONE_PILL.neutral)}>
                      {c.state === 'live' ? 'en direct' : c.state === 'pending' ? 'bientôt' : 'plus tard'}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-4">
              <SecLabel className="mb-2">Dernières recherches</SecLabel>
              {!recent || recent.length === 0 ? (
                <p className={cn('text-[12.5px]', TEXT.muted)}>Aucune pour l'instant.</p>
              ) : (
                <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                  {recent.map((l) => (
                    <li key={l.id}>
                      <button type="button" onClick={() => { setRef(l.reference); setParams({ ref: l.reference, lookup: l.id }); }} className={cn('flex w-full items-center justify-between gap-2 py-2 text-left', l.id === lookupId && 'font-bold')}>
                        <span className={cn('font-mono text-[12.5px]', TEXT.strong)}>{l.reference}</span>
                        <span className={cn('text-[11px]', TEXT.muted)}>{CARRIER_LABEL[l.carrier] ?? l.carrier} · {l.status === 'done' ? 'trouvé' : l.status === 'pending' ? 'en cours' : 'sans résultat'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </aside>
      </div>

      {manualOpen && <CargoManualAddDialog open={manualOpen} onClose={() => setManualOpen(false)} reference={lookup?.reference ?? ref} />}
      <CenterDialog
        open={!!adding}
        onClose={() => setAdding(null)}
        onConfirm={confirmAdd}
        title={adding ? `Ajouter ${adding.number} à la flotte` : ''}
        footer={
          <>
            <button type="button" onClick={() => setAdding(null)} className={cn('h-9 px-4 text-[13px] font-semibold', SOFT_PILL)}>Annuler</button>
            <button type="button" onClick={confirmAdd} disabled={!clientLabel.trim() || add.isPending} className={cn('h-9 px-4 text-[13px] font-bold disabled:opacity-60', PRIMARY_PILL)}>
              {add.isPending ? 'Ajout…' : 'Ajouter'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div className="col-span-2">
            <SecLabel className="mb-1.5">Client</SecLabel>
            <TextField id="cargo-add-client" variant="name" size="sm" value={clientLabel} onChange={(e) => setClientLabel(e.target.value)} placeholder="GAUSS, PRC, DJIANI…" />
          </div>
          <div>
            <SecLabel className="mb-1.5">Fret (USD)</SecLabel>
            <NumberField id="cargo-add-freight" size="sm" value={freight} onValueChange={setFreight} allowDecimal placeholder="6 550" className="tabular-nums" />
          </div>
          <div>
            <SecLabel className="mb-1.5">Arrivée promise</SecLabel>
            <DateField id="cargo-add-eta" size="sm" value={etaPromised} onChange={(e) => setEtaPromised(e.target.value)} />
          </div>
          <div>
            <SecLabel className="mb-1.5">Départ promis</SecLabel>
            <DateField id="cargo-add-etd" size="sm" value={etdPromised} onChange={(e) => setEtdPromised(e.target.value)} />
          </div>
          <p className={cn('col-span-2 text-[12px]', TEXT.muted)}>Ce que le transitaire a annoncé. On le comparera à ce que l'armateur mesure.</p>
        </div>
      </CenterDialog>
    </div>
  );
}
