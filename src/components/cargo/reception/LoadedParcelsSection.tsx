// ============================================================
// Desktop admin — dossier d'une boîte › « Colis reçus à l'entrepôt » : ce
// qui a été chargé dans cette boîte depuis la réception (poids, m³, par
// dépôt), un bouton pour en charger, un pour en sortir. Les colis suivent
// ensuite la boîte, sans rien ressaisir dans les lots.
// ============================================================
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, PackagePlus, Undo2 } from 'lucide-react';
import { deliverSeaManifestPdf } from '@/lib/airManifestPdf';
import { useShipmentParcels, useUnloadParcel } from '@/hooks/useReception';
import { clientFullName, formatCbm, formatDims, formatKg } from '@/lib/reception';
import type { CargoShipment } from '@/lib/cargo/model';
import { Empty, Fact, Facts, Section } from '@/components/cargo/dossier/kit';
import { LoadParcelsDialog } from './LoadParcelsDialog';
import { cn } from '@/lib/utils';
import { TEXT, SOFT_PILL, PRIMARY_PILL, Th, Td } from '@/desktop/designKit';

export function LoadedParcelsSection({ shipment: s, canManage, className }: { shipment: CargoShipment; canManage: boolean; className?: string }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data } = useShipmentParcels(s.id);
  const unload = useUnloadParcel();
  const [open, setOpen] = useState(false);
  // `?charger=1` : arrivée depuis le mobile ou un lien — le dialogue s'ouvre tout seul.
  useEffect(() => { if (params.get('charger') === '1' && canManage) setOpen(true); }, [params, canManage]);

  const parcels = data ?? [];
  const kg = parcels.reduce((a, p) => a + Number(p.weight_kg ?? 0), 0);
  const cbm = parcels.reduce((a, p) => a + Number(p.cbm ?? 0), 0);
  const deposits = [...new Set(parcels.map((p) => p.deposit_no))];

  return (
    <Section
      className={className}
      title="Colis reçus à l'entrepôt"
      meta={parcels.length > 0 ? `${parcels.length} colis · ${formatKg(kg)} · ${formatCbm(cbm)}` : undefined}
      action={
        <span className="inline-flex items-center gap-2">
          {parcels.length > 0 && (
            <button type="button" onClick={() => void deliverSeaManifestPdf(s, parcels)} className={cn('inline-flex h-8 items-center gap-1.5 px-3 text-[12px] font-semibold', SOFT_PILL)}>
              <FileText className="h-3.5 w-3.5" /> Manifeste (PDF)
            </button>
          )}
          {canManage && (
            <button type="button" onClick={() => setOpen(true)} className={cn('inline-flex h-8 items-center gap-1.5 px-3 text-[12px] font-bold', PRIMARY_PILL)}>
              <PackagePlus className="h-3.5 w-3.5" /> Charger des colis reçus
            </button>
          )}
        </span>
      }
      bodyClassName={parcels.length > 0 ? 'p-0' : undefined}
    >
      {parcels.length === 0 ? (
        <Empty title="Aucun colis reçu n'a encore été chargé dans cette boîte.">
          Les colis enregistrés à la réception attendent à l'entrepôt. Chargez-les ici : ils suivront la boîte jusqu'à la livraison.
        </Empty>
      ) : (
        <>
          <div className="px-5 py-4">
            <Facts cols={4}>
              <Fact label="Colis" value={parcels.length} />
              <Fact label="Poids" value={formatKg(kg)} />
              <Fact label="Volume" value={formatCbm(cbm)} />
              <Fact label={deposits.length > 1 ? 'Dépôts' : 'Dépôt'} value={deposits.length > 1 ? `${deposits.length} dépôts` : deposits[0]} hint={parcels[0]?.client ? clientFullName(parcels[0].client) : undefined} />
            </Facts>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr>
                <Th first>N°</Th>
                <Th>Ce qu'il y a dedans</Th>
                <Th>Dépôt</Th>
                <Th align="right">Poids</Th>
                <Th align="right">Dimensions</Th>
                <Th align="right">m³</Th>
                {canManage && <Th last className="w-[44px]" />}
              </tr>
            </thead>
            <tbody>
              {parcels.map((p) => (
                <tr key={p.id}>
                  <Td first><span className={cn('font-mono text-[12px] font-bold', TEXT.strong)}>{p.parcel_no}</span></Td>
                  <Td><span className="text-[13px] font-semibold">{p.description || p.kind}</span></Td>
                  <Td><button type="button" onClick={() => navigate(`/m/cargo/reception/${p.deposit_id}`)} className={cn('font-mono text-[12px] underline-offset-2 hover:underline', TEXT.muted)}>{p.deposit_no}</button></Td>
                  <Td align="right"><span className="text-[13px] tabular-nums">{formatKg(p.weight_kg)}</span></Td>
                  <Td align="right"><span className={cn('text-[12.5px] tabular-nums', TEXT.muted)}>{formatDims(p)}</span></Td>
                  <Td align="right"><span className="text-[13px] tabular-nums">{formatCbm(p.cbm)}</span></Td>
                  {canManage && (
                    <Td last>
                      <button type="button" onClick={() => unload.mutate(p.id)} title="Sortir de la boîte (retour à l'entrepôt)" aria-label={`Sortir ${p.parcel_no} de la boîte`} className={cn('inline-flex h-8 w-8 items-center justify-center', SOFT_PILL)}>
                        <Undo2 className="h-3.5 w-3.5" />
                      </button>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <LoadParcelsDialog shipmentId={s.id} open={open} onClose={() => setOpen(false)} containerLabel={s.container_number} />
    </Section>
  );
}
