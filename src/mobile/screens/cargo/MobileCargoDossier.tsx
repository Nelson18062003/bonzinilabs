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
import { useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, ChevronDown, Circle, ExternalLink } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCargoDocuments, useCargoShipment, useCargoVesselPositions } from '@/hooks/useCargo';
import { DossierActions, TabChargement } from '@/components/cargo/dossier';
import { MobilePapiers } from './MobilePapiers';
import { MobileDouane } from './MobileDouane';
import { MobileCouts } from './MobileCouts';
import { MobileClient } from './MobileClient';
import { MobileNotes } from './MobileNotes';
import { CargoJourney } from '@/components/cargo/CargoJourney';
import { groupVessels } from '@/lib/cargo/vessels';
import { nextSteps } from '@/lib/cargo/todo';
import {
  arrivalSentence, contentSentence, customsSentence, delaySentence, departureSentence, journeySentence,
  moneySentence, papersSentence, todoSentence, whereSentence,
} from '@/lib/cargo/plain';
import { CARRIER_LABEL, fmtUsd, liveVesselUrl, statusMeta } from '@/lib/cargo/model';
import type { CargoDocument, CargoShipment, CargoVesselPosition } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { TEXT, TYPE, SURFACE, Button, ScreenError, ScreenLoader, StatusPill } from '@/mobile/designKit';

type SectionKey = 'afaire' | 'ou' | 'trajet' | 'argent' | 'papiers' | 'douane' | 'dedans' | 'chargement' | 'client' | 'couts' | 'notes';
const KEYS: SectionKey[] = ['afaire', 'ou', 'trajet', 'argent', 'papiers', 'douane', 'dedans', 'chargement', 'client', 'couts', 'notes'];
/** Les adresses des onglets desktop restent valables : on les traduit. */
const ALIAS: Record<string, SectionKey> = { apercu: 'afaire', suivi: 'trajet', documents: 'papiers' };
const DEFAULT: SectionKey = 'afaire';
const path = (id: string, k: SectionKey) => (k === DEFAULT ? `/m/cargo/${id}` : `/m/cargo/${id}/${k}`);

/** Une phrase, en 16 px, avec les mots qui comptent en gras. */
function Line({ children, strong, tone }: { children: React.ReactNode; strong?: boolean; tone?: 'warn' | 'bad' | 'good' }) {
  return (
    <p className={cn('text-[16px] leading-relaxed', strong ? cn('font-semibold', TEXT.strong) : TEXT.body,
      tone === 'warn' && 'font-semibold text-[#975102] dark:text-[#E8B931]',
      tone === 'bad' && 'font-semibold text-[#C00F0C] dark:text-[#EC221F]',
      tone === 'good' && 'font-semibold text-[#009951] dark:text-[#14AE5C]')}>
      {children}
    </p>
  );
}

function Todo({ s, docs }: { s: CargoShipment; docs?: CargoDocument[] }) {
  const items = nextSteps(s, docs);
  if (items.length === 0) return <Line>Rien à faire : ce conteneur est livré.</Line>;
  return (
    <ul className="space-y-3">
      {items.map((t) => (
        <li key={t.id} className="flex items-start gap-3">
          {t.level === 'done'
            ? <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-[#009951] dark:text-[#14AE5C]" />
            : <Circle className={cn('mt-0.5 h-6 w-6 shrink-0', t.level === 'now' ? 'text-[#C00F0C] dark:text-[#EC221F]' : 'text-[#B3B3B3]')} />}
          <div className="min-w-0">
            <p className={cn('text-[16px] leading-snug', t.level === 'done' ? cn('line-through', TEXT.muted) : cn('font-semibold', TEXT.strong))}>{t.label}</p>
            {t.detail && t.level !== 'done' && <p className={cn('text-[16px] leading-snug', TEXT.muted)}>{t.detail}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Where({ s, pos }: { s: CargoShipment; pos: CargoVesselPosition | null }) {
  const live = liveVesselUrl(s.vessel_imo);
  return (
    <div className="space-y-3">
      <Line strong>{whereSentence(s, pos)}</Line>
      {s.vessel_name && <Line>Sur le navire <b>{s.vessel_name}</b>{s.voyage ? `, voyage ${s.voyage}` : ''}.</Line>}
      {pos?.speed_kn != null && <Line>Il avance à {pos.speed_kn} nœuds.</Line>}
      {live && (
        <a href={live} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#767676] bg-[#E3E3E3] px-3 text-[16px] font-medium text-[#303030] dark:border-[#767676] dark:bg-[#444444] dark:text-[#F5F5F5]">
          Voir la position en direct <ExternalLink className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}

function Journey({ s, pos }: { s: CargoShipment; pos: CargoVesselPosition | null }) {
  return (
    <div className="space-y-4">
      <Line>{departureSentence(s)}.</Line>
      <Line strong>{arrivalSentence(s)}.</Line>
      {delaySentence(s) && <Line tone="warn">{delaySentence(s)}.</Line>}
      <div className="admin-theme pt-1"><CargoJourney shipment={s} position={pos} /></div>
    </div>
  );
}

function Money({ s }: { s: CargoShipment }) {
  return (
    <div className="space-y-3">
      <Line>Le fret dû au transitaire : <b>{fmtUsd(s.freight_usd)}</b>.</Line>
      <Line tone={s.freight_paid ? 'good' : 'bad'}>{s.freight_paid ? 'Fret payé.' : 'Fret pas encore payé.'}</Line>
      <Line tone={s.telex_released ? 'good' : 'bad'}>{s.telex_released ? 'Télex reçu : le conteneur peut sortir du port.' : 'Télex pas encore reçu : sans lui, le conteneur reste au port.'}</Line>
      <Line>Le télex est envoyé par l'armateur une fois le fret payé. Les coûts réels se notent dans « Les coûts ».</Line>
    </div>
  );
}

function Inside({ s, onOpen3D }: { s: CargoShipment; onOpen3D: () => void }) {
  return (
    <div className="space-y-3">
      <Line strong>{contentSentence(s)}.</Line>
      <Line>Boîte de type <b>{s.container_iso === '45G1' ? "40 pieds High Cube" : s.container_iso ?? 'inconnu'}</b>.</Line>
      <Button variant="neutral" onClick={onOpen3D}>Voir le chargement en 3D</Button>
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
  const pos = useMemo(() => (s ? groupVessels([s], positions ?? [])[0]?.position ?? null : null), [s, positions]);

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;
  if (!shipmentId) return <Navigate to="/m/cargo" replace />;
  if (raw && !KEYS.includes(raw as SectionKey) && !ALIAS[raw]) return <Navigate to={path(shipmentId, DEFAULT)} replace />;

  const go = (k: SectionKey) => navigate(path(shipmentId, open === k ? DEFAULT : k), { replace: true });

  const sections: { key: SectionKey; title: string; summary: (s: CargoShipment) => string; body: (s: CargoShipment) => React.ReactNode }[] = s ? [
    { key: 'afaire', title: 'À faire', summary: (x) => todoSentence(x, docs), body: (x) => <Todo s={x} docs={docs} /> },
    { key: 'ou', title: 'Où est le conteneur', summary: (x) => whereSentence(x, pos), body: (x) => <Where s={x} pos={pos} /> },
    { key: 'trajet', title: 'Le trajet', summary: (x) => journeySentence(x), body: (x) => <Journey s={x} pos={pos} /> },
    { key: 'argent', title: "L'argent", summary: (x) => moneySentence(x), body: (x) => <Money s={x} /> },
    { key: 'papiers', title: 'Les papiers', summary: () => papersSentence(docs), body: (x) => <MobilePapiers shipment={x} canManage={canManage} /> },
    { key: 'douane', title: "La douane et l'arrivée", summary: (x) => customsSentence(x), body: (x) => <MobileDouane shipment={x} canManage={canManage} /> },
    { key: 'dedans', title: "Ce qu'il y a dedans", summary: (x) => contentSentence(x), body: (x) => <Inside s={x} onOpen3D={() => go('chargement')} /> },
    { key: 'chargement', title: 'Le chargement en 3D', summary: () => 'La boîte vue de l’intérieur, lot par lot', body: (x) => <div className="admin-theme"><TabChargement shipment={x} canManage={canManage} /></div> },
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
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className={cn('tabular-nums', TYPE.lead, TEXT.strong)}>{s.container_number}</span>
              <StatusPill tone={statusMeta(s.status).tone} label={statusMeta(s.status).label} />
            </div>
            <p className={cn('text-[16px] leading-relaxed', TEXT.muted)}>
              {CARRIER_LABEL[s.carrier] ?? s.carrier}, bill of lading <span className={cn('tabular-nums', TEXT.strong)}>{s.bl_number}</span>.
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
