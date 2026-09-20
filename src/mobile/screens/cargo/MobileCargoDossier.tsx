/**
 * Mobile admin — le dossier d'un conteneur, pour quelqu'un qui ne veut pas
 * déchiffrer (05-simplicite.md).
 *
 * En-tête : le client, le numéro de boîte, l'état, puis UNE phrase —
 * « Arrive à Kribi le 11 octobre, dans 28 jours. » et le retard s'il y en a.
 *
 * Ensuite une liste de sections repliées, dans l'ordre des questions, avec
 * un titre en français et un sous-titre qui dit l'essentiel sans ouvrir.
 * Une section ouverte à la fois ; l'adresse suit (/m/cargo/:id/:section)
 * pour que Retour et les liens marchent. Plus d'onglets.
 *
 * Rien sous 16 px, texte foncé, aucune coupure.
 */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, ChevronDown, ChevronRight, Circle, Copy, ExternalLink, Map as MapIcon, Ship } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCargoDocuments, useCargoEvents, useCargoShipment, useCargoVesselPositions, useUpdateCargoShipment } from '@/hooks/useCargo';
import { useShipmentParcels } from '@/hooks/useReception';
import { clientFullName, formatCbm, formatKg } from '@/lib/reception';
import { DossierActions } from '@/components/cargo/dossier';
import { MobilePapiers } from './MobilePapiers';
import { MobileDouane } from './MobileDouane';
import { MobileCouts } from './MobileCouts';
import { MobileClient } from './MobileClient';
import { MobileNotes } from './MobileNotes';
import { MobileChargement } from './MobileChargement';
import { MobileNavireSheet } from './MobileNavire';
import { CargoJourney } from '@/components/cargo/CargoJourney';
import { groupVessels } from '@/lib/cargo/vessels';
import { nextSteps } from '@/lib/cargo/todo';
import {
  arrivalSentence, contentSentence, customsSentence, delaySentence, departureSentence, journeySentence,
  moneySentence, papersSentence, todoSentence, whereSentence,
} from '@/lib/cargo/plain';
import { CARRIER_LABEL, fmtUsd, liveVesselUrl, statusMeta, timelineFromEvents } from '@/lib/cargo/model';
import type { CargoEvent } from '@/lib/cargo/model';
import { fmtDayLong } from '@/lib/cargo/plain';
import type { CargoDocument, CargoShipment, CargoVesselPosition } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/lib/clipboard';
import { TEXT, TYPE, SURFACE, Button, ScreenError, ScreenLoader, StatusPill } from '@/mobile/designKit';

type SectionKey = 'afaire' | 'ou' | 'trajet' | 'argent' | 'papiers' | 'douane' | 'dedans' | 'chargement' | 'client' | 'couts' | 'notes';
const KEYS: SectionKey[] = ['afaire', 'ou', 'trajet', 'argent', 'papiers', 'douane', 'dedans', 'chargement', 'client', 'couts', 'notes'];
/** Les adresses des onglets desktop restent valables : on les traduit. */
const ALIAS: Record<string, SectionKey> = { apercu: 'afaire', suivi: 'trajet', documents: 'papiers' };
const DEFAULT: SectionKey = 'afaire';
const path = (id: string, k: SectionKey) => (k === DEFAULT ? `/m/cargo/${id}` : `/m/cargo/${id}/${k}`);

/** Une phrase, en 16 px, avec les mots qui comptent en gras. */
function Line({ children, strong, tone, className }: { children: React.ReactNode; strong?: boolean; tone?: 'warn' | 'bad' | 'good'; className?: string }) {
  return (
    <p className={cn('text-[16px] leading-relaxed', strong ? cn('font-semibold', TEXT.strong) : TEXT.body,
      tone === 'warn' && 'font-semibold text-[#975102] dark:text-[#E8B931]',
      tone === 'bad' && 'font-semibold text-[#C00F0C] dark:text-[#EC221F]',
      tone === 'good' && 'font-semibold text-[#009951] dark:text-[#14AE5C]', className)}>
      {children}
    </p>
  );
}

/** La section qui règle chaque chose à faire : on y va d'un tap. */
const TODO_SECTION: Record<string, SectionKey> = { freight: 'argent', telex: 'argent', bl: 'papiers', invoice: 'papiers', besc: 'papiers', vessel: 'ou', client: 'client' };

function Todo({ s, docs, onGo }: { s: CargoShipment; docs?: CargoDocument[]; onGo: (k: SectionKey) => void }) {
  const items = nextSteps(s, docs);
  if (items.length === 0) return <Line>Rien à faire : ce conteneur est livré.</Line>;
  return (
    <ul className="space-y-1">
      {items.map((t) => {
        const target = t.level === 'done' ? null : TODO_SECTION[t.id] ?? null;
        const inner = (
          <>
            {t.level === 'done'
              ? <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-[#009951] dark:text-[#14AE5C]" />
              : <Circle className={cn('mt-0.5 h-6 w-6 shrink-0', t.level === 'now' ? 'text-[#C00F0C] dark:text-[#EC221F]' : 'text-[#B3B3B3]')} />}
            <span className="min-w-0 flex-1">
              <span className={cn('block text-[16px] leading-snug', t.level === 'done' ? cn('line-through', TEXT.muted) : cn('font-semibold', TEXT.strong))}>{t.label}</span>
              {t.detail && t.level !== 'done' && <span className={cn('block text-[16px] leading-snug', TEXT.muted)}>{t.detail}</span>}
            </span>
            {target && <ChevronRight className={cn('mt-0.5 h-6 w-6 shrink-0', TEXT.muted)} />}
          </>
        );
        return (
          <li key={t.id}>
            {target ? (
              <button type="button" onClick={() => onGo(target)} className="flex w-full items-start gap-3 rounded-lg py-2 text-left transition-colors active:bg-[#F5F5F5] dark:active:bg-[#383838]">
                {inner}
              </button>
            ) : (
              <div className="flex items-start gap-3 py-2">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Where({ s, pos, canManage }: { s: CargoShipment; pos: CargoVesselPosition | null; canManage: boolean }) {
  const navigate = useNavigate();
  const [vesselOpen, setVesselOpen] = useState(false);
  const live = liveVesselUrl(s.vessel_imo);
  const noVessel = !s.vessel_name && !s.vessel_imo;
  return (
    <div className="space-y-3">
      <Line strong>{whereSentence(s, pos)}</Line>
      {s.vessel_name && <Line>Sur le navire <b>{s.vessel_name}</b>{s.voyage ? `, voyage ${s.voyage}` : ''}.</Line>}
      {pos?.speed_kn != null && <Line>Il avance à {pos.speed_kn} nœuds.</Line>}
      {noVessel && (
        <Line className={TEXT.muted}>
          {s.status === 'UNKNOWN'
            ? 'Si vous connaissez le navire (sur le site de l’armateur), renseignez-le : la boîte apparaîtra sur la carte.'
            : 'Le navire n’est pas encore connu.'}
        </Line>
      )}
      {canManage && (
        <Button variant={noVessel ? 'primary' : 'subtle'} className="w-full" onClick={() => setVesselOpen(true)}>
          <Ship />
          {noVessel ? 'Renseigner le navire' : 'Modifier le navire'}
        </Button>
      )}
      {pos && s.vessel_imo && (
        <Button variant="neutral" className="w-full" onClick={() => navigate(`/m/cargo/map?vessel=${encodeURIComponent(s.vessel_imo!)}`)}>
          <MapIcon />
          Voir sur la carte
        </Button>
      )}
      {live && (
        <a href={live} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-transparent text-[16px] font-medium text-[#303030] active:bg-[#F5F5F5] dark:text-[#E3E3E3] dark:active:bg-[#383838]">
          Voir la position en direct sur MarineTraffic <ExternalLink className="h-4 w-4" />
        </a>
      )}
      {canManage && <MobileNavireSheet shipment={s} open={vesselOpen} onClose={() => setVesselOpen(false)} />}
    </div>
  );
}

function Journey({ s, pos, events }: { s: CargoShipment; pos: CargoVesselPosition | null; events: CargoEvent[] }) {
  // Les jalons de l'armateur, les plus récents d'abord, en phrases : « Navire parti de Nansha le 15 août ».
  const items = timelineFromEvents(events).filter((e) => e.classifier === 'ACT').reverse().slice(0, 4);
  const planned = timelineFromEvents(events).filter((e) => e.classifier !== 'ACT');
  return (
    <div className="space-y-4">
      <Line>{departureSentence(s)}.</Line>
      <Line strong>{arrivalSentence(s)}.</Line>
      {delaySentence(s) && <Line tone="warn">{delaySentence(s)}.</Line>}
      <div className="admin-theme pt-1"><CargoJourney shipment={s} position={pos} /></div>
      {items.length > 0 && (
        <div className={cn('space-y-2 border-t pt-4', SURFACE.divider)}>
          <p className={cn('text-[16px] font-semibold', TEXT.strong)}>Ce que l'armateur a dit</p>
          <ul className="space-y-1">
            {items.map((e) => (
              <li key={e.id} className={cn('text-[16px] leading-relaxed', TEXT.body)}>
                {e.label}{e.location ? ` à ${e.location}` : ''}, le {fmtDayLong(new Date(e.time))}.
              </li>
            ))}
            {planned.length > 0 && (
              <li className={cn('text-[16px] leading-relaxed', TEXT.muted)}>
                Prévu : {planned.map((e) => `${e.label.toLowerCase()}${e.location ? ` à ${e.location}` : ''} le ${fmtDayLong(new Date(e.time))}`).join(' ; ')}.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function Money({ s, canManage }: { s: CargoShipment; canManage: boolean }) {
  const update = useUpdateCargoShipment();
  const flip = (patch: { freight_paid?: boolean; telex_released?: boolean }) => update.mutate({ id: s.id, patch });
  return (
    <div className="space-y-3">
      <Line>Le fret dû au transitaire : <b>{fmtUsd(s.freight_usd)}</b>.</Line>
      <Line tone={s.freight_paid ? 'good' : 'bad'}>{s.freight_paid ? 'Fret payé.' : 'Fret pas encore payé.'}</Line>
      {canManage && (
        <Button variant={s.freight_paid ? 'subtle' : 'primary'} className="w-full" loading={update.isPending} onClick={() => flip({ freight_paid: !s.freight_paid })}>
          {s.freight_paid ? 'Le fret n\'est pas payé, finalement' : 'Le fret est payé'}
        </Button>
      )}
      <Line tone={s.telex_released ? 'good' : 'bad'}>{s.telex_released ? 'Télex reçu : le conteneur peut sortir du port.' : 'Télex pas encore reçu : sans lui, le conteneur reste au port.'}</Line>
      {canManage && (
        <Button variant={s.telex_released ? 'subtle' : s.freight_paid ? 'primary' : 'neutral'} className="w-full" loading={update.isPending} onClick={() => flip({ telex_released: !s.telex_released })}>
          {s.telex_released ? 'Le télex n\'est pas reçu, finalement' : 'Le télex est reçu'}
        </Button>
      )}
      <Line>Le télex est envoyé par l'armateur une fois le fret payé. Les coûts réels se notent dans « Les coûts ».</Line>
    </div>
  );
}

function Inside({ s, onOpen3D, canManage }: { s: CargoShipment; onOpen3D: () => void; canManage: boolean }) {
  const navigate = useNavigate();
  const { data: loaded } = useShipmentParcels(s.id);
  const parcels = loaded ?? [];
  const kg = parcels.reduce((a, p) => a + Number(p.weight_kg ?? 0), 0);
  const cbm = parcels.reduce((a, p) => a + Number(p.cbm ?? 0), 0);
  const deposits = [...new Set(parcels.map((p) => p.deposit_no))];
  return (
    <div className="space-y-3">
      <Line strong>{contentSentence(s)}.</Line>
      <Line>Boîte de type <b>{s.container_iso === '45G1' ? "40 pieds High Cube" : s.container_iso ?? 'inconnu'}</b>.</Line>
      {/* Les colis reçus à l'entrepôt et chargés ici : ils suivent la boîte. */}
      {parcels.length > 0 ? (
        <div className={cn('rounded-lg p-3', SURFACE.inset)}>
          <Line strong>{parcels.length} colis reçus à l'entrepôt sont dans cette boîte — {formatKg(kg)}, {formatCbm(cbm)}.</Line>
          <Line>{deposits.length > 1 ? `${deposits.length} dépôts` : `Dépôt ${deposits[0]}`}{parcels[0]?.client ? ` · ${clientFullName(parcels[0].client)}` : ''}.</Line>
          <ul className="mt-2 space-y-1">
            {parcels.slice(0, 5).map((p) => (
              <li key={p.id} className={cn('flex items-baseline gap-2 text-[16px]', TEXT.strong)}>
                <span className={cn('shrink-0 tabular-nums', TEXT.muted)}>{p.parcel_no}</span>
                <span className="min-w-0 flex-1 truncate">{p.description ?? p.kind}</span>
                <span className={cn('shrink-0 tabular-nums', TEXT.muted)}>{formatKg(p.weight_kg)}</span>
              </li>
            ))}
            {parcels.length > 5 && <li className={cn('text-[16px]', TEXT.muted)}>… et {parcels.length - 5} autres</li>}
          </ul>
        </div>
      ) : (
        <Line>Aucun colis reçu à l'entrepôt n'a encore été chargé dans cette boîte.</Line>
      )}
      <div className="flex flex-wrap gap-2">
        {canManage && <Button variant="primary" onClick={() => navigate(`/m/cargo/${s.id}/charger-colis`)}>Charger des colis reçus</Button>}
        <Button variant="neutral" onClick={onOpen3D}>Voir le chargement en 3D</Button>
      </div>
    </div>
  );
}

export function MobileCargoDossier() {
  const { hasPermission } = useAdminAuth();
  const navigate = useNavigate();
  const { shipmentId, tab: raw } = useParams<{ shipmentId: string; tab?: string }>();
  const open: SectionKey = raw ? (KEYS.includes(raw as SectionKey) ? (raw as SectionKey) : ALIAS[raw] ?? DEFAULT) : DEFAULT;
  const canManage = hasPermission('canManageCargo');
  const { data: s, isLoading, error } = useCargoShipment(shipmentId ?? null);
  const { data: docs } = useCargoDocuments(shipmentId ?? null);
  const { data: positions } = useCargoVesselPositions();
  const { data: events } = useCargoEvents(shipmentId ?? null);
  const pos = useMemo(() => (s ? groupVessels([s], positions ?? [])[0]?.position ?? null : null), [s, positions]);

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;
  if (!shipmentId) return <Navigate to="/m/cargo" replace />;
  if (raw && !KEYS.includes(raw as SectionKey) && !ALIAS[raw]) return <Navigate to={path(shipmentId, DEFAULT)} replace />;

  const go = (k: SectionKey) => navigate(path(shipmentId, open === k ? DEFAULT : k), { replace: true });

  const sections: { key: SectionKey; title: string; summary: (s: CargoShipment) => string; body: (s: CargoShipment) => React.ReactNode }[] = s ? [
    { key: 'afaire', title: 'À faire', summary: (x) => todoSentence(x, docs), body: (x) => <Todo s={x} docs={docs} onGo={go} /> },
    { key: 'ou', title: 'Où est le conteneur', summary: (x) => whereSentence(x, pos), body: (x) => <Where s={x} pos={pos} canManage={canManage} /> },
    { key: 'trajet', title: 'Le trajet', summary: (x) => journeySentence(x), body: (x) => <Journey s={x} pos={pos} events={events ?? []} /> },
    { key: 'argent', title: "L'argent", summary: (x) => moneySentence(x), body: (x) => <Money s={x} canManage={canManage} /> },
    { key: 'papiers', title: 'Les papiers', summary: () => papersSentence(docs), body: (x) => <MobilePapiers shipment={x} canManage={canManage} /> },
    { key: 'douane', title: "La douane et l'arrivée", summary: (x) => customsSentence(x), body: (x) => <MobileDouane shipment={x} canManage={canManage} /> },
    { key: 'dedans', title: "Ce qu'il y a dedans", summary: (x) => contentSentence(x), body: (x) => <Inside s={x} onOpen3D={() => go('chargement')} canManage={canManage} /> },
    { key: 'chargement', title: 'Le chargement en 3D', summary: () => 'La boîte vue de l’intérieur, lot par lot', body: (x) => <MobileChargement shipment={x} canManage={canManage} /> },
    { key: 'client', title: 'Le client', summary: (x) => x.client_id ? `${x.client_label}, rattaché à sa fiche` : `${x.client_label}, pas encore rattaché à une fiche`, body: (x) => <MobileClient shipment={x} canManage={canManage} /> },
    { key: 'couts', title: 'Les coûts', summary: () => 'Ce que la boîte a vraiment coûté', body: (x) => <MobileCouts shipment={x} canManage={canManage} /> },
    { key: 'notes', title: 'Les notes', summary: (x) => x.notes ? x.notes : 'Rien de noté pour l’instant', body: (x) => <MobileNotes shipment={x} canManage={canManage} /> },
  ] : [];

  return (
    <div className="flex min-h-full flex-col">
      <MobileHeader
        title={s ? `Conteneur de ${s.client_label}` : 'Conteneur'}
        showBack
        backTo="/m/cargo"
        rightElement={s ? <DossierActions shipment={s} compact onRemoved={() => navigate('/m/cargo')} /> : undefined}
      />

      {isLoading && <ScreenLoader />}
      {error && <ScreenError title="Dossier introuvable" description={(error as Error).message} />}
      {!isLoading && !error && !s && <ScreenError title="Dossier introuvable" description="Ce conteneur n'est plus dans la flotte." />}

      {s && (
        <>
          {/* L'identité et la décision, en une phrase. */}
          <div className={cn('space-y-2 border-b px-4 py-4', SURFACE.divider)}>
            {/* Les deux numéros qu'on recopie dans WhatsApp ou au transitaire : un tap les copie. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <button type="button" onClick={() => copyToClipboard(s.container_number, 'Numéro de conteneur')} aria-label={`Copier le numéro ${s.container_number}`}
                className={cn('-ml-1 inline-flex min-h-11 items-center gap-2 rounded-lg px-1 tabular-nums active:bg-[#F5F5F5] dark:active:bg-[#383838]', TYPE.lead, TEXT.strong)}>
                {s.container_number}
                <Copy className={cn('h-5 w-5', TEXT.muted)} />
              </button>
              <StatusPill tone={statusMeta(s.status).tone} label={statusMeta(s.status).label} />
            </div>
            <p className={cn('text-[16px] leading-relaxed', TEXT.muted)}>
              {CARRIER_LABEL[s.carrier] ?? s.carrier}, bill of lading{' '}
              <button type="button" onClick={() => copyToClipboard(s.bl_number, 'Bill of lading')} aria-label={`Copier le bill of lading ${s.bl_number}`}
                className={cn('-my-2 inline-flex min-h-11 items-center gap-1 rounded-md px-1 tabular-nums underline decoration-[#B3B3B3] underline-offset-4 active:bg-[#F5F5F5] dark:active:bg-[#383838]', TEXT.strong)}>
                {s.bl_number}
              </button>.
            </p>
            <p className={cn('text-[18px] font-semibold leading-snug', TEXT.strong)}>{arrivalSentence(s)}.</p>
            {delaySentence(s) && <p className="text-[16px] font-semibold leading-snug text-[#975102] dark:text-[#E8B931]">{delaySentence(s)}.</p>}
          </div>

          {/* Les sections, repliées, une ouverte à la fois. */}
          <div className="px-4 pb-8">
            {sections.map((sec) => {
              const isOpen = open === sec.key;
              return (
                <section key={sec.key} className={cn('border-b', SURFACE.divider)}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => go(sec.key)}
                    className="flex w-full items-center gap-3 py-4 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className={cn('block', TYPE.lead, TEXT.strong)}>{sec.title}</span>
                      {!isOpen && <span className={cn('mt-0.5 block text-[16px] leading-snug', TEXT.muted)}>{sec.summary(s)}</span>}
                    </span>
                    <ChevronDown className={cn('h-6 w-6 shrink-0 transition-transform', TEXT.muted, isOpen && 'rotate-180')} />
                  </button>
                  {isOpen && <div className="pb-5">{sec.body(s)}</div>}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
