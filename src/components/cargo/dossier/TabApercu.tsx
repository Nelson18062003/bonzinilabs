/**
 * Onglet Aperçu — refait le 03/10/2026.
 *
 * La fiche de MIEU3611115 affichait une position de 22 jours, un parcours
 * figé et une arrivée fausse, sans dire d'où venait aucun chiffre. L'aperçu
 * répond maintenant, dans cet ordre, à :
 *   1. où est-il et quand arrive-t-il — avec la SOURCE et l'ÂGE de chaque
 *      information, et les deux boutons pour la corriger ;
 *   2. où en est le voyage — la carte de la dernière étape et les escales ;
 *   3. qu'est-ce qui reste à faire ;
 *   4. l'essentiel des autres onglets (argent, intervenants, classeur,
 *      marchandise), chacun avec un lien vers son onglet.
 */
import { useMemo, useState } from 'react';
import {
  ArrowRight, CalendarClock, CheckCircle2, Circle, ExternalLink, FolderOpen, Handshake, ListChecks, MapPin, MessageCircle, PackageOpen, Pencil, Phone,
  Route, Ship, Wallet,
} from 'lucide-react';
import { useCargoDocFolders, useCargoDocuments, useCargoPackages, useCargoShipmentParties, useCargoVesselPositions } from '@/hooks/useCargo';
import { VoyageMap } from '@/components/cargo/VoyageMap';
import { CargoJourney } from '@/components/cargo/CargoJourney';
import { Empty, Fact, Facts, IconTile, Section, Tag, ToolButton } from '@/components/cargo/dossier/kit';
import { CallsDialog, EtaDialog, PositionDialog } from '@/components/cargo/dossier/VoyageDialogs';
import { groupVessels } from '@/lib/cargo/vessels';
import { nextSteps } from '@/lib/cargo/todo';
import { folderProgress } from '@/lib/cargo/documents';
import { isVehicle, lotVolumeM3 } from '@/lib/cargo/loadplan';
import { PARTY_ROLE_META, isPartyRole, telUrl, whatsappUrl } from '@/lib/cargo/parties';
import { voyageDays } from '@/lib/cargo/voyage';
import type { DossierTab } from '@/lib/cargo/dossierNav';
import {
  ETA_SOURCE_LABEL, bestEta, daysUntilArrival, etaSlipDays, fmtDay, fmtDayTime, fmtUsd, isStalePosition, liveVesselUrl, positionAge, whereIs,
} from '@/lib/cargo/model';
import type { CargoShipment } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT } from '@/desktop/designKit';

const inDaysText = (n: number | null) => (n == null ? '' : n > 1 ? `dans ${n} jours` : n === 1 ? 'demain' : n === 0 ? "aujourd'hui" : n === -1 ? 'hier' : `il y a ${-n} jours`);

function GoLink({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  if (!onClick) return null;
  return (
    <button type="button" onClick={onClick} className={cn('inline-flex items-center gap-1 text-[12px] max-lg:text-[14px] font-semibold hover:underline', TEXT.body)}>
      {children} <ArrowRight className="h-3 w-3" />
    </button>
  );
}

export function TabApercu({ shipment: s, canManage = false, onGo }: { shipment: CargoShipment; canManage?: boolean; onGo?: (t: DossierTab) => void }) {
  const { data: positions } = useCargoVesselPositions();
  const { data: docs } = useCargoDocuments(s.id);
  const { data: folders } = useCargoDocFolders(s.id);
  const { data: parties } = useCargoShipmentParties(s.id);
  const { data: packages } = useCargoPackages(s.id);
  const [dialog, setDialog] = useState<'position' | 'eta' | 'calls' | null>(null);

  const vessel = useMemo(() => groupVessels([s], positions ?? [])[0] ?? null, [s, positions]);
  const pos = vessel?.position ?? null;
  const todo = useMemo(() => nextSteps(s, docs), [s, docs]);
  const open = todo.filter((t) => t.level !== 'done');
  const eta = bestEta(s);
  const slip = etaSlipDays(s);
  const inDays = daysUntilArrival(s);
  const days = voyageDays(s);
  const stale = pos ? isStalePosition(pos) : true;
  const live = liveVesselUrl(s.vessel_imo);

  const keyParties = (parties ?? []).filter((l) => ['DECLARANT', 'FORWARDER', 'SHIPPER', 'SHIPPING_AGENT'].includes(l.role));
  const classeur = folders ?? [];
  const byFolder = (id: string) => (docs ?? []).filter((d) => d.folder_id === id).length;
  const incomplete = classeur.filter((f) => !folderProgress(f, byFolder(f.id)).complete);
  const lots = packages ?? [];
  const vehicles = lots.filter(isVehicle);
  const volume = lots.reduce((v, p) => v + lotVolumeM3(p), 0);

  return (
    <div className="space-y-5">
      {/* 1. Où est-il, quand arrive-t-il — avec la source de chaque chiffre. */}
      <div className={cn('grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] gap-6 rounded-[14px] px-6 py-5 max-lg:grid-cols-1 max-lg:gap-4 max-lg:px-5', SURFACE.card, SURFACE.shadow)}>
        <div className="flex min-w-0 items-start gap-4">
          <IconTile icon={Ship} tone="violet" size="lg" />
          <div className="min-w-0">
            <div className={cn('text-[11px] max-lg:text-[13px] font-bold uppercase tracking-wider', TEXT.muted)}>Où est-il</div>
            <div className={cn('mt-0.5 text-[21px] max-lg:text-[20px] font-extrabold leading-tight tracking-tight', TEXT.strong)}>{whereIs(s, pos)}</div>
            <div className={cn('mt-1 text-[12.5px] max-lg:text-[14px] leading-snug', TEXT.muted)}>
              {pos ? (
                <>
                  {s.vessel_name ?? pos.vessel_name} · position {pos.source === 'manual' ? 'relevée à la main' : 'AIS'} {positionAge(pos)}
                  {stale && <Tag tone="warn" className="ml-1.5">ancienne</Tag>}
                  {pos.source === 'manual' && pos.note && <span className="block">{pos.note}</span>}
                </>
              ) : 'Aucune position du navire'}
            </div>
          </div>
        </div>
        <div className="min-w-0 border-l border-black/[0.06] pl-6 dark:border-white/[0.06] max-lg:border-l-0 max-lg:border-t max-lg:pl-0 max-lg:pt-4">
          <div className={cn('flex items-center gap-1.5 text-[11px] max-lg:text-[13px] font-bold uppercase tracking-wider', TEXT.muted)}><CalendarClock className="h-3.5 w-3.5" /> Arrivée à {s.pod_name}</div>
          <div className={cn('mt-0.5 text-[21px] max-lg:text-[20px] font-extrabold tabular-nums leading-tight', TEXT.strong)}>{fmtDay(eta.date)} <span className={cn('text-[14px] font-semibold', TEXT.muted)}>{inDaysText(inDays)}</span></div>
          <div className={cn('mt-1 text-[12.5px] max-lg:text-[14px] leading-snug', TEXT.muted)}>
            {eta.source && <>{ETA_SOURCE_LABEL[eta.source]}</>}
            {eta.source === 'manual' && s.eta_carrier && <> · Maersk annonce {fmtDay(new Date(s.eta_carrier))}</>}
            {slip > 0 && <span className="font-semibold text-amber-700 dark:text-amber-400"> · +{slip} j sur la promesse</span>}
            {eta.source === 'manual' && s.eta_manual_note && <span className="block">{s.eta_manual_note}</span>}
          </div>
        </div>
        {canManage && (
          <div className="flex flex-col gap-2 max-lg:flex-row max-lg:flex-wrap">
            <ToolButton icon={MapPin} onClick={() => setDialog('position')}>Mettre à jour la position</ToolButton>
            <ToolButton icon={CalendarClock} onClick={() => setDialog('eta')}>Corriger l'arrivée</ToolButton>
            {live && <a href={live} target="_blank" rel="noopener noreferrer" className={cn('inline-flex h-8 max-lg:h-10 items-center justify-center gap-1.5 px-3 text-[12.5px] max-lg:text-[15px] font-semibold', 'rounded-md text-muted-foreground hover:text-foreground')}>Voir en direct <ExternalLink className="h-3.5 w-3.5" /></a>}
          </div>
        )}
      </div>

      {/* 2 & 3. La carte de la dernière étape, et ce qui reste à faire. */}
      <div className="grid grid-cols-[minmax(0,1fr)_380px] gap-5 max-lg:grid-cols-1">
        <Section icon={MapPin} tone="blue" title="Sur la carte" subtitle="la dernière étape du navire ; « Tout le voyage » pour le reste" bodyClassName="p-3">
          <VoyageMap shipment={s} position={pos} className="h-[380px] max-lg:h-[300px]" />
        </Section>
        <Section icon={ListChecks} tone="rose" title="À faire" meta={open.length > 0 ? `${open.length} restante${open.length > 1 ? 's' : ''}` : 'tout est fait'}>
          {todo.length === 0 ? (
            <Empty title="Rien à faire">Ce dossier est livré.</Empty>
          ) : (
            <ul className="space-y-3">
              {todo.map((t) => (
                <li key={t.id} className="flex items-start gap-2.5">
                  {t.level === 'done'
                    ? <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-emerald-600 dark:text-emerald-400" />
                    : <Circle className={cn('mt-0.5 h-[18px] w-[18px] shrink-0', t.level === 'now' ? 'text-destructive' : TEXT.muted)} />}
                  <div className="min-w-0">
                    <div className={cn('text-[13.5px] max-lg:text-[15px] leading-5', t.level === 'done' ? cn('line-through decoration-1', TEXT.muted) : t.level === 'now' ? cn('font-semibold', TEXT.strong) : TEXT.body)}>{t.label}</div>
                    {t.detail && t.level !== 'done' && <div className={cn('text-[12px] max-lg:text-[14px]', TEXT.muted)}>{t.detail}</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* Les escales. */}
      <Section
        icon={Route}
        tone="violet"
        title="Parcours"
        subtitle={days ? `jour ${days.sailed} depuis le départ${days.left != null && days.left > 0 ? ` · encore ${days.left} j` : ''}` : undefined}
        action={canManage ? <ToolButton icon={Pencil} onClick={() => setDialog('calls')}>Modifier les escales</ToolButton> : undefined}
      >
        <CargoJourney shipment={s} />
        <div className="mt-6 border-t border-black/[0.06] pt-5 dark:border-white/[0.06]">
          <Facts cols={4}>
            <Fact label="Départ réel" value={s.etd_actual ? fmtDay(new Date(s.etd_actual)) : '—'} hint={s.pol_name ?? undefined} />
            <Fact label="Arrivée promise" value={s.eta_promised ? fmtDay(new Date(s.eta_promised + 'T12:00:00')) : '—'} hint="par le transitaire" />
            <Fact label="Arrivée armateur" value={s.eta_carrier ? fmtDay(new Date(s.eta_carrier)) : '—'} hint={s.last_synced_at ? `mis à jour ${fmtDayTime(new Date(s.last_synced_at))}` : undefined} />
            <Fact label="Arrivée retenue" value={fmtDay(eta.date)} hint={eta.source ? ETA_SOURCE_LABEL[eta.source] : undefined} />
          </Facts>
        </div>
      </Section>

      {/* 4. L'essentiel des autres onglets. */}
      <div className="grid grid-cols-2 gap-5 max-lg:grid-cols-1 2xl:grid-cols-4">
        <Section icon={Wallet} tone="violet" title="Argent" action={<GoLink onClick={onGo && (() => onGo('couts'))}>Coûts</GoLink>}>
          <Facts cols={2}>
            <Fact label="Fret annoncé" value={fmtUsd(s.freight_usd)} hint={s.freight_note ? 'à confirmer' : 'au transitaire'} />
            <Fact label="Paiement" value={<span className={s.freight_paid ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}>{s.freight_paid ? 'Réglé' : 'À régler'}</span>} />
            <Fact label="Télex release" value={<span className={s.telex_released ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}>{s.telex_released ? 'Reçu' : 'Non reçu'}</span>} hint={s.telex_released ? undefined : 'sans lui, pas de sortie'} />
            <Fact label="BESC" value={s.besc_number ?? '—'} />
          </Facts>
          {s.freight_note && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-[12px] max-lg:text-[14px] leading-relaxed text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{s.freight_note}</p>}
        </Section>

        <Section icon={Handshake} tone="emerald" title="Intervenants clés" action={<GoLink onClick={onGo && (() => onGo('intervenants'))}>Tous</GoLink>}>
          {keyParties.length === 0 ? (
            <p className={cn('text-[13px] max-lg:text-[15px]', TEXT.muted)}>Aucun intervenant renseigné : déclarant, transitaire, chargeur…</p>
          ) : (
            <ul className="space-y-3">
              {keyParties.map((l) => {
                const tel = telUrl(l.party.phone);
                const wa = whatsappUrl(l.party.whatsapp || l.party.phone);
                return (
                  <li key={l.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className={cn('truncate text-[13.5px] max-lg:text-[15px] font-semibold', TEXT.strong)}>{l.party.name}</div>
                      <div className={cn('text-[12px] max-lg:text-[14px]', TEXT.muted)}>{isPartyRole(l.role) ? PARTY_ROLE_META[l.role].label : l.role}{l.party.contact_name ? ` · ${l.party.contact_name}` : ''}</div>
                    </div>
                    <span className="flex shrink-0 gap-1">
                      {tel && <a href={tel} aria-label="Appeler" className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"><Phone className="h-3.5 w-3.5" /></a>}
                      {wa && <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"><MessageCircle className="h-3.5 w-3.5 text-[#07C160]" /></a>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section icon={FolderOpen} tone="blue" title="Classeur" action={<GoLink onClick={onGo && (() => onGo('documents'))}>Documents</GoLink>}>
          {classeur.length === 0 ? (
            <p className={cn('text-[13px] max-lg:text-[15px]', TEXT.muted)}>Aucune pièce créée.</p>
          ) : (
            <>
              <div className={cn('text-[22px] font-extrabold tabular-nums', TEXT.strong)}>{classeur.length - incomplete.length}<span className={cn('text-[14px] font-semibold', TEXT.muted)}> / {classeur.length} pièces complètes</span></div>
              {incomplete.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {incomplete.slice(0, 5).map((f) => (
                    <li key={f.id} className={cn('flex items-center justify-between gap-2 text-[12.5px] max-lg:text-[14px]', TEXT.body)}>
                      <span className="truncate">{f.title}</span>
                      <Tag tone={byFolder(f.id) > 0 ? 'warn' : 'neutral'}>{folderProgress(f, byFolder(f.id)).label}</Tag>
                    </li>
                  ))}
                  {incomplete.length > 5 && <li className={cn('text-[12px]', TEXT.muted)}>et {incomplete.length - 5} autre(s)</li>}
                </ul>
              )}
            </>
          )}
        </Section>

        <Section icon={PackageOpen} tone="amber" title="La marchandise" action={<GoLink onClick={onGo && (() => onGo('chargement'))}>Chargement</GoLink>}>
          <Facts cols={2}>
            <Fact label="Boîte" value={s.container_iso === '45G1' ? "40' High Cube" : s.container_iso ?? '—'} />
            <Fact label="Poids brut" value={s.gross_weight_kg != null ? `${Number(s.gross_weight_kg).toLocaleString('fr-FR')} kg` : '—'} />
            <Fact label="Colis" value={lots.length ? String(lots.reduce((n, p) => n + p.qty, 0)) : s.packages_count != null ? String(s.packages_count) : '—'} hint={s.packages_count != null ? `${s.packages_count} sur le B/L` : undefined} />
            <Fact label="Véhicules" value={String(vehicles.length)} hint={volume > 0 ? `${volume.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} m³ déclarés` : undefined} />
          </Facts>
        </Section>
      </div>

      {dialog === 'position' && <PositionDialog shipment={s} position={pos} onClose={() => setDialog(null)} />}
      {dialog === 'eta' && <EtaDialog shipment={s} onClose={() => setDialog(null)} />}
      {dialog === 'calls' && <CallsDialog shipment={s} onClose={() => setDialog(null)} />}
    </div>
  );
}
