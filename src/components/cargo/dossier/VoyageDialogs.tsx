/**
 * Les corrections du suivi que l'équipe fait à la main quand les flux se
 * taisent ou se trompent :
 *   · la POSITION du navire (aucune source AIS n'est branchée) ;
 *   · l'ARRIVÉE relevée (Atlas, consignataire) quand celle de l'armateur
 *     retarde sur le terrain ;
 *   · le conteneur ARRIVÉ (statut) quand l'armateur ne le dit pas — sans quoi
 *     Douala ne peut pas pointer ses colis — et son annulation ;
 *   · les ESCALES du voyage (la rotation change d'un voyage à l'autre).
 * Chaque saisie garde sa SOURCE : on doit toujours savoir d'où vient un chiffre.
 */
import { useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, MapPin, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { DateField, TextArea, TextField } from '@/components/form';
import { useMarkShipmentArrived, useSetVesselPosition, useUnmarkShipmentArrived, useUpdateCargoShipment } from '@/hooks/useCargo';
import { FieldLabel, IconButton, ToolButton } from '@/components/cargo/dossier/kit';
import { PORTS, liveVesselUrl } from '@/lib/cargo/model';
import type { CargoShipment, CargoVesselPosition } from '@/lib/cargo/model';
import { arrivalPort, newCallId, voyageCalls, type RouteCall } from '@/lib/cargo/voyage';
import type { Json } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, SOFT_PILL, PRIMARY_PILL, CenterDialog } from '@/desktop/designKit';

const toLocalInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");
/** « 2,79 » ou « -20.42 » → nombre ; vide ou faux → null. */
const parseCoord = (v: string): number | null => {
  const n = Number(v.trim().replace(',', '.'));
  return v.trim() && Number.isFinite(n) ? n : null;
};

function Footer({ onClose, onSave, saving, disabled, label = 'Enregistrer', extra }: { onClose: () => void; onSave: () => void; saving: boolean; disabled?: boolean; label?: string; extra?: React.ReactNode }) {
  return (
    <>
      {extra}
      <button type="button" onClick={onClose} className={cn('ml-auto h-9 px-4 text-[13px] max-lg:text-[15px] font-semibold', SOFT_PILL)}>Annuler</button>
      <button type="button" onClick={onSave} disabled={disabled || saving} className={cn('h-9 px-4 text-[13px] max-lg:text-[15px] font-bold disabled:opacity-60', PRIMARY_PILL)}>
        {saving ? 'Enregistrement…' : label}
      </button>
    </>
  );
}

/* ── Position du navire ─────────────────────────────────────────────────── */

export function PositionDialog({ shipment: s, position, onClose }: { shipment: CargoShipment; position: CargoVesselPosition | null; onClose: () => void }) {
  const set = useSetVesselPosition();
  const [lat, setLat] = useState(position ? String(position.latitude) : '');
  const [lon, setLon] = useState(position ? String(position.longitude) : '');
  const [when, setWhen] = useState(toLocalInput(new Date()));
  const [speed, setSpeed] = useState('');
  const [note, setNote] = useState('');
  const la = parseCoord(lat);
  const lo = parseCoord(lon);
  const valid = !!s.vessel_imo && la != null && lo != null && Math.abs(la) <= 90 && Math.abs(lo) <= 180 && !!when;
  const calls = voyageCalls(s).filter((c) => c.unlocode && PORTS[c.unlocode]);
  // Raccourcis : au port, ou au mouillage au large (≈ 20 km à l'ouest : l'Atlantique, pour nos ports d'Afrique de l'Ouest).
  const presets = calls.flatMap((c) => {
    const [pla, plo] = PORTS[c.unlocode!].pos;
    const out = [{ label: `À quai à ${c.name}`, lat: pla, lon: plo }];
    if (/^(CM|NG|CI|GA|CG|GH|TG|BJ|SN)/.test(c.unlocode!)) out.push({ label: `Au mouillage devant ${c.name}`, lat: Math.round((pla + 0.06) * 100) / 100, lon: Math.round((plo - 0.19) * 100) / 100 });
    return out;
  });
  const live = liveVesselUrl(s.vessel_imo);
  const save = () => {
    if (!valid || !s.vessel_imo) return;
    const sp = speed.trim() ? Number(speed.replace(',', '.')) : null;
    set.mutate(
      { imo: s.vessel_imo, latitude: la!, longitude: lo!, reportedAt: new Date(when).toISOString(), speedKn: sp != null && Number.isFinite(sp) ? sp : null, note: note.trim() || null },
      { onSuccess: onClose },
    );
  };
  return (
    <CenterDialog open onClose={onClose} onConfirm={save} width={600} title="Mettre à jour la position du navire" footer={<Footer onClose={onClose} onSave={save} saving={set.isPending} disabled={!valid} />}>
      <div className="space-y-4">
        <p className={cn('text-[13px] max-lg:text-[15px] leading-relaxed', TEXT.body)}>
          Aucune source AIS n'est branchée : relève la position de <b>{s.vessel_name ?? 'ce navire'}</b> sur Flexport Atlas ou VesselFinder, ou choisis un raccourci.
        </p>
        {live && (
          <div className="flex flex-wrap gap-2">
            <a href={live} target="_blank" rel="noopener noreferrer" className={cn('inline-flex h-8 max-lg:h-10 items-center gap-1.5 px-3 text-[12.5px] max-lg:text-[14px] font-semibold', SOFT_PILL)}>VesselFinder <ExternalLink className="h-3.5 w-3.5" /></a>
            <a href={`https://www.marinetraffic.com/en/ais/details/ships/imo:${s.vessel_imo}`} target="_blank" rel="noopener noreferrer" className={cn('inline-flex h-8 max-lg:h-10 items-center gap-1.5 px-3 text-[12.5px] max-lg:text-[14px] font-semibold', SOFT_PILL)}>MarineTraffic <ExternalLink className="h-3.5 w-3.5" /></a>
          </div>
        )}
        {presets.length > 0 && (
          <div>
            <FieldLabel>Raccourcis</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button key={p.label} type="button" onClick={() => { setLat(String(p.lat)); setLon(String(p.lon)); if (!note) setNote(p.label); }} className={cn('inline-flex h-8 max-lg:h-10 items-center gap-1.5 px-2.5 text-[12px] max-lg:text-[14px] font-semibold', SOFT_PILL)}>
                  <MapPin className="h-3.5 w-3.5" /> {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div><FieldLabel htmlFor="pos-lat" hint="nord +, sud −">Latitude</FieldLabel><TextField id="pos-lat" size="sm" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="2,79" inputMode="decimal" /></div>
          <div><FieldLabel htmlFor="pos-lon" hint="est +, ouest −">Longitude</FieldLabel><TextField id="pos-lon" size="sm" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="9,68" inputMode="decimal" /></div>
          <div><FieldLabel htmlFor="pos-when">Relevée le</FieldLabel><input id="pos-when" type="datetime-local" value={when} max={toLocalInput(new Date())} onChange={(e) => setWhen(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px] max-lg:h-11 max-lg:text-[16px]" /></div>
          <div><FieldLabel htmlFor="pos-speed" hint="facultatif">Vitesse (nœuds)</FieldLabel><TextField id="pos-speed" size="sm" value={speed} onChange={(e) => setSpeed(e.target.value)} placeholder="0 au mouillage" inputMode="decimal" /></div>
        </div>
        <div>
          <FieldLabel htmlFor="pos-note">Source</FieldLabel>
          <TextField id="pos-note" size="sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Flexport Atlas, VesselFinder, appel du consignataire…" />
        </div>
      </div>
    </CenterDialog>
  );
}

/* ── Arrivée relevée ─────────────────────────────────────────────────────── */

export function EtaDialog({ shipment: s, onClose }: { shipment: CargoShipment; onClose: () => void }) {
  const update = useUpdateCargoShipment();
  const [when, setWhen] = useState(s.eta_manual ? toLocalInput(new Date(s.eta_manual)) : toLocalInput(new Date()));
  const [note, setNote] = useState(s.eta_manual_note ?? '');
  const save = () => update.mutate(
    { id: s.id, patch: { eta_manual: new Date(when).toISOString(), eta_manual_note: note.trim() || null, eta_manual_at: new Date().toISOString() } },
    { onSuccess: onClose },
  );
  const clear = () => update.mutate({ id: s.id, patch: { eta_manual: null, eta_manual_note: null, eta_manual_at: null } }, { onSuccess: onClose });
  return (
    <CenterDialog
      open
      onClose={onClose}
      onConfirm={save}
      width={540}
      title="Corriger l'arrivée"
      footer={<Footer onClose={onClose} onSave={save} saving={update.isPending} disabled={!when} extra={s.eta_manual ? <ToolButton icon={Trash2} danger onClick={clear}>Revenir à l'armateur</ToolButton> : undefined} />}
    >
      <div className="space-y-4">
        <p className={cn('text-[13px] max-lg:text-[15px] leading-relaxed', TEXT.body)}>
          L'arrivée relevée par l'équipe passe devant celle de l'armateur{s.eta_carrier ? ` (${format(new Date(s.eta_carrier), 'dd/MM HH:mm')})` : ''}, qui reste affichée à côté.
        </p>
        <div><FieldLabel htmlFor="eta-when">Arrivée (ou arrivée prévue)</FieldLabel><input id="eta-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px] max-lg:h-11 max-lg:text-[16px]" /></div>
        <div>
          <FieldLabel htmlFor="eta-note">Source et précision</FieldLabel>
          <TextArea id="eta-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Au mouillage devant Kribi (Flexport Atlas, 03/10). Escale prévue du 03 au 04/10…" />
        </div>
      </div>
    </CenterDialog>
  );
}

/* ── Conteneur arrivé ────────────────────────────────────────────────────── */

/**
 * Marquer le conteneur arrivé quand l'armateur ne le dit pas : ses colis
 * deviennent pointables à Douala et leurs clients sont prévenus. La date ne
 * peut pas être dans le futur ; la source reste écrite à côté.
 */
export function MarkArrivedDialog({ shipment: s, onClose }: { shipment: CargoShipment; onClose: () => void }) {
  const mark = useMarkShipmentArrived();
  const [when, setWhen] = useState(toLocalInput(new Date()));
  const [note, setNote] = useState('');
  const port = arrivalPort(s);
  const save = () => {
    if (!when) return;
    mark.mutate({ shipmentId: s.id, arrivedAt: new Date(when).toISOString(), note: note.trim() || null }, { onSuccess: onClose });
  };
  return (
    <CenterDialog open onClose={onClose} onConfirm={save} width={540} title={`Marquer ${s.container_number} arrivé`} footer={<Footer onClose={onClose} onSave={save} saving={mark.isPending} disabled={!when} label="Marquer arrivé" />}>
      <div className="space-y-4">
        <p className={cn('text-[13px] max-lg:text-[15px] leading-relaxed', TEXT.body)}>
          À faire quand le conteneur est <b>déchargé au port de {port}</b> et que l'armateur ne l'a pas signalé. Ses colis deviennent pointables à Douala, et chaque client reçoit « Vos colis sont arrivés au port de {port} ».
        </p>
        <div><FieldLabel htmlFor="arr-when">Arrivé le</FieldLabel><input id="arr-when" type="datetime-local" value={when} max={toLocalInput(new Date())} onChange={(e) => setWhen(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px] max-lg:h-11 max-lg:text-[16px]" /></div>
        <div>
          <FieldLabel htmlFor="arr-note" hint="facultatif">Source</FieldLabel>
          <TextArea id="arr-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Avis d'arrivée du consignataire, Flexport Atlas, appel du transitaire…" />
        </div>
      </div>
    </CenterDialog>
  );
}

/** Annuler une arrivée posée par erreur : un motif, et seulement tant que rien n'est pointé à Douala. */
export function UnmarkArrivedDialog({ shipment: s, onClose }: { shipment: CargoShipment; onClose: () => void }) {
  const unmark = useUnmarkShipmentArrived();
  const [reason, setReason] = useState('');
  const valid = reason.trim().length >= 5;
  const save = () => { if (valid) unmark.mutate({ shipmentId: s.id, reason: reason.trim() }, { onSuccess: onClose }); };
  return (
    <CenterDialog open onClose={onClose} onConfirm={save} width={540} title={`Annuler l'arrivée de ${s.container_number}`} footer={<Footer onClose={onClose} onSave={save} saving={unmark.isPending} disabled={!valid} label="Annuler l'arrivée" />}>
      <div className="space-y-4">
        <p className={cn('text-[13px] max-lg:text-[15px] leading-relaxed', TEXT.body)}>
          Le conteneur repasse « en mer » et ses colis ne sont plus pointables. Aucun message ne part aux clients. Impossible dès qu'un colis est pointé à Douala.
        </p>
        <div>
          <FieldLabel htmlFor="unarr-reason">Pourquoi</FieldLabel>
          <TextArea id="unarr-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Marqué sur le mauvais conteneur, navire encore au mouillage…" />
        </div>
      </div>
    </CenterDialog>
  );
}

/* ── Escales du voyage ───────────────────────────────────────────────────── */

const dayOnly = (v: string | null | undefined) => (v ? v.slice(0, 10) : '');

export function CallsDialog({ shipment: s, onClose }: { shipment: CargoShipment; onClose: () => void }) {
  const update = useUpdateCargoShipment();
  const [calls, setCalls] = useState<RouteCall[]>(() => voyageCalls(s).map((c) => ({ ...c, id: c.id === 'pol' || c.id === 'pod' ? newCallId() : c.id })));
  const patch = (i: number, p: Partial<RouteCall>) => setCalls((l) => l.map((c, j) => (j === i ? { ...c, ...p } : c)));
  const move = (i: number, d: -1 | 1) => setCalls((l) => { const n = [...l]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); return n; });
  const portCodes = Object.entries(PORTS);
  const save = () => {
    const clean = calls
      .filter((c) => c.name.trim())
      .map((c) => {
        const o: Record<string, Json> = { id: c.id, name: c.name.trim() };
        for (const k of ['unlocode', 'eta', 'etd', 'ata', 'atd', 'note'] as const) { const v = c[k]?.trim(); if (v) o[k] = v; }
        if (c.after) o.after = true;
        return o;
      });
    update.mutate({ id: s.id, patch: { route_calls: clean } }, { onSuccess: onClose });
  };
  return (
    <CenterDialog open onClose={onClose} onConfirm={save} width={820} title="Escales du voyage" footer={<Footer onClose={onClose} onSave={save} saving={update.isPending} extra={<ToolButton icon={Plus} onClick={() => setCalls((l) => [...l, { id: newCallId(), name: '' }])}>Ajouter une escale</ToolButton>} />}>
      <p className={cn('mb-3 text-[13px] max-lg:text-[15px]', TEXT.body)}>
        Dans l'ordre du voyage. « Arrivé » et « parti » sont les dates constatées ; « prévu » ce qu'annoncent l'armateur ou Atlas. Une escale après le déchargement de notre conteneur reste affichée, en grisé.
      </p>
      <ul className="space-y-3">
        {calls.map((c, i) => (
          <li key={c.id} className={cn('rounded-[12px] p-3 ring-1 ring-black/[0.07] dark:ring-white/[0.08]', SURFACE.card)}>
            <div className="grid grid-cols-[1fr_170px_auto] items-end gap-2 max-sm:grid-cols-1">
              <div><FieldLabel htmlFor={`call-name-${i}`}>Port</FieldLabel><TextField id={`call-name-${i}`} size="sm" value={c.name} onChange={(e) => patch(i, { name: e.target.value })} placeholder="Kribi" /></div>
              <div>
                <FieldLabel htmlFor={`call-code-${i}`} hint="pour la carte">Code</FieldLabel>
                <select id={`call-code-${i}`} value={c.unlocode ?? ''} onChange={(e) => patch(i, { unlocode: e.target.value || null, name: c.name || PORTS[e.target.value]?.name || '' })} className="h-9 w-full rounded-md border border-input bg-background px-2 text-[13px] max-lg:h-11 max-lg:text-[16px]">
                  <option value="">—</option>
                  {portCodes.map(([code, p]) => <option key={code} value={code}>{p.name} ({code})</option>)}
                </select>
              </div>
              <div className="flex">
                <IconButton icon={ArrowUp} label="Monter" onClick={() => i > 0 && move(i, -1)} />
                <IconButton icon={ArrowDown} label="Descendre" onClick={() => i < calls.length - 1 && move(i, 1)} />
                <IconButton icon={Trash2} label="Retirer l'escale" danger onClick={() => setCalls((l) => l.filter((_, j) => j !== i))} />
              </div>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2 max-sm:grid-cols-2">
              <div><FieldLabel htmlFor={`call-eta-${i}`}>Arrivée prévue</FieldLabel><DateField id={`call-eta-${i}`} size="sm" value={dayOnly(c.eta)} onChange={(e) => patch(i, { eta: e.target.value || null })} /></div>
              <div><FieldLabel htmlFor={`call-etd-${i}`}>Départ prévu</FieldLabel><DateField id={`call-etd-${i}`} size="sm" value={dayOnly(c.etd)} onChange={(e) => patch(i, { etd: e.target.value || null })} /></div>
              <div><FieldLabel htmlFor={`call-ata-${i}`}>Arrivé le</FieldLabel><DateField id={`call-ata-${i}`} size="sm" value={dayOnly(c.ata)} onChange={(e) => patch(i, { ata: e.target.value || null })} /></div>
              <div><FieldLabel htmlFor={`call-atd-${i}`}>Parti le</FieldLabel><DateField id={`call-atd-${i}`} size="sm" value={dayOnly(c.atd)} onChange={(e) => patch(i, { atd: e.target.value || null })} /></div>
            </div>
            <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-3 max-sm:grid-cols-1">
              <TextField id={`call-note-${i}`} size="sm" value={c.note ?? ''} onChange={(e) => patch(i, { note: e.target.value })} placeholder="Note (source, ce qui se passe à cette escale)" />
              <label className={cn('flex items-center gap-2 text-[12.5px] max-lg:text-[14px]', TEXT.body)}>
                <input type="checkbox" checked={!!c.after} onChange={(e) => patch(i, { after: e.target.checked })} className="h-4 w-4" /> après notre déchargement
              </label>
            </div>
          </li>
        ))}
      </ul>
    </CenterDialog>
  );
}
