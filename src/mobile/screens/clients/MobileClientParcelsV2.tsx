/**
 * Fiche client › Colis (maquette 03/08) : le gros chiffre « à l'entrepôt de
 * Guangzhou » (kg · m³), son ou ses conteneurs, ses réceptions avec leur
 * statut, le relevé des colis en PDF (bouton du bas) et son partage (en
 * haut). Le chiffre « à Guangzhou » ne compte que les colis qui attendent
 * encore (ni conteneur, ni LTA : `isParcelWaiting`) — l'ancien comptait les
 * colis partis en avion.
 * Garde : canViewCargo ou canViewClients, comme avant.
 */
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Package, Share, Ship } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useClientDeposits } from '@/hooks/useReception';
import { useCargoFleetDocuments, useCargoShipments } from '@/hooks/useCargo';
import { deliverClientStatementPdf, downloadClientStatementPdf } from '@/lib/clientStatementPdf';
import { canShareFiles, prefersDownload } from '@/components/customer-code/exportShippingLabel';
import { clientFullName, depositStage, formatCbm, formatKg, isParcelWaiting } from '@/lib/reception';
import { ALERT, TONE_OF, alertLevel } from '@/lib/cargo/palette';
import { arrivalSentence } from '@/lib/cargo/plain';
import {
  BigButton, Dock, EmptyLine, HeroFigure, IconCircle, ItemList, ItemRow, RoundButton, ScreenLoader, ScreenTop, SectionHead,
} from '@/mobile/designKit';
import { shortDay } from './ledgerRows';

/** Le statut d'un dépôt en deux mots pour la ligne (« Chargé · LTA 176-… » → « En avion »). */
function shortStage(st: ReturnType<typeof depositStage>): ReturnType<typeof depositStage> {
  if (/LTA|avion|vol/i.test(st.label)) return { tone: 'pending', label: 'En avion' };
  if (/^Chargé/i.test(st.label)) return { tone: 'pending', label: 'En mer' };
  if (/entrepôt|bureau|guangzhou/i.test(st.label)) return { tone: 'neutral', label: 'À Guangzhou' };
  return st;
}

export function MobileClientParcelsV2() {
  const navigate = useNavigate();
  const { clientId = '' } = useParams<{ clientId: string }>();
  const { hasPermission } = useAdminAuth();
  const canCargo = hasPermission('canViewCargo');
  const { data: deposits, isLoading } = useClientDeposits(clientId);
  const { data: fleet } = useCargoShipments({ enabled: canCargo });
  const { data: docsBy } = useCargoFleetDocuments({ enabled: canCargo });
  const [busy, setBusy] = useState<'dl' | 'share' | null>(null);
  const [allDeposits, setAllDeposits] = useState(false);
  const canShare = canShareFiles() && !prefersDownload();

  const statement = async (how: 'dl' | 'share') => {
    if (!deposits || busy) return;
    setBusy(how);
    try {
      if (how === 'dl') { await downloadClientStatementPdf(deposits); toast.success('Relevé des colis téléchargé'); }
      else if ((await deliverClientStatementPdf(deposits)) === 'downloaded') toast.success('Relevé des colis téléchargé');
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };

  if (!canCargo && !hasPermission('canViewClients')) return <Navigate to="/m" replace />;
  if (isLoading || !deposits) return <ScreenLoader className="min-h-[100dvh]" />;

  const client = deposits.find((d) => d.client)?.client ?? null;
  const first = client ? clientFullName(client).split(' ')[0] : 'Client';
  const parcels = deposits.flatMap((d) => d.parcels);
  const waiting = parcels.filter((p) => isParcelWaiting(p));
  const kg = waiting.reduce((s, p) => s + Number(p.weight_kg ?? 0), 0);
  const cbm = waiting.reduce((s, p) => s + Number(p.cbm ?? 0), 0);
  // Ses conteneurs : les siens (client du dossier) et ceux où ses colis sont chargés (groupage).
  const loadedIn = new Set(parcels.map((p) => p.shipment_id).filter(Boolean) as string[]);
  const containers = canCargo ? (fleet ?? []).filter((c) => c.client_id === clientId || loadedIn.has(c.id)) : [];
  const parcelsIn = (id: string) => parcels.filter((p) => p.shipment_id === id).length;
  const shownDeposits = allDeposits ? deposits : deposits.slice(0, 3);

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#1E1E1E]">
      <ScreenTop
        title={`Colis · ${first}`}
        backTo={`/m/clients/${clientId}`}
        right={canShare && parcels.length > 0 ? <RoundButton icon={Share} ariaLabel="Partager le relevé des colis" onClick={() => void statement('share')} className="border-0" /> : undefined}
      />
      <div className="px-5 pt-5">
        <HeroFigure
          label="À l'entrepôt de Guangzhou"
          value={waiting.length}
          unit="colis"
          sub={[<><b className="font-bold">{formatKg(kg).replace(' kg', '')}</b> kg</>, <><b className="font-bold">{formatCbm(cbm).replace(' m³', '')}</b> m³</>]}
        />
      </div>

      {containers.length > 0 && (
        <>
          <SectionHead title={containers.length > 1 ? 'Ses conteneurs' : 'Conteneur'} />
          <ItemList>
            {containers.map((c) => {
              const level = alertLevel(c, docsBy?.[c.id]);
              const n = parcelsIn(c.id);
              return (
                <ItemRow
                  key={c.id}
                  leading={<IconCircle icon={Ship} />}
                  title={<span className="tabular-nums">{c.container_number || c.bl_number || 'Conteneur'}</span>}
                  subtitle={arrivalSentence(c)}
                  amount={n > 0 ? `${n} colis` : undefined}
                  tag={{ tone: TONE_OF[level], label: ALERT[level].label }}
                  onClick={() => navigate(`/m/cargo/${c.id}`)}
                />
              );
            })}
          </ItemList>
        </>
      )}

      <SectionHead
        title="Réceptions"
        link={deposits.length > 3 && !allDeposits ? { label: 'Tout voir', onClick: () => setAllDeposits(true) } : undefined}
      />
      {deposits.length === 0 ? (
        <EmptyLine>Aucun colis reçu pour ce client.</EmptyLine>
      ) : (
        <ItemList>
          {shownDeposits.map((d) => {
            const st = shortStage(depositStage(d.parcels, d.location));
            return (
              <ItemRow
                key={d.id}
                leading={<IconCircle icon={Package} />}
                title={<span className="tabular-nums">{d.deposit_no}</span>}
                subtitle={`${shortDay(d.closed_at ?? d.opened_at)} · ${d.parcels.length} colis · ${formatKg(d.total_weight_kg)}`}
                tag={{ tone: st.tone, label: st.label }}
                onClick={() => navigate(`/m/cargo/reception/${d.id}`)}
              />
            );
          })}
        </ItemList>
      )}
      {parcels.length > 0 && (
        <Dock>
          <BigButton onClick={() => void statement('dl')} loading={busy === 'dl'} disabled={busy != null}>Relevé des colis (PDF)</BigButton>
        </Dock>
      )}
    </div>
  );
}
