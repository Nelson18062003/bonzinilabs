// DEV-ONLY — l'étiquette colis avec des données d'exemple, pour la regarder
// en vrai avant de la mettre entre les mains d'un client.
import { ShippingLabelComposer } from '@/components/customer-code/ShippingLabelComposer';
import { useShippingLabel, ShippingLabelPreview } from '@/components/customer-code/useShippingLabel';
import { MobileShippingLabelSheet } from '@/mobile/components/clients/MobileShippingLabelSheet';
import { DEFAULT_SHIPPING_SETTINGS, type ShippingDestination } from '@/lib/customerCode';
import type { LabelSupplierInfo } from '@/lib/shippingLabelCanvas';

const props = {
  code: 'BZ-482913',
  clientName: 'Aïcha Mbarga',
  clientPhone: '+237 677 12 34 56',
  clientEmail: 'aicha@mbarga-import.cm',
  companyName: 'Mbarga Import SARL',
  clientCity: 'Douala',
  clientCountry: 'Cameroun',
  settings: DEFAULT_SHIPPING_SETTINGS,
};
const supplier = { name: 'Yiwu Hengda Trading Co.', phone: '+86 137 0000 0000', email: 'sales@hengda-trading.cn', address: '浙江省义乌市国际商贸城三区 12345 号' };

/** L'étiquette seule, à sa taille naturelle (600 px). */
function Label({ destination, supplier: s, mono }: { destination: ShippingDestination; supplier?: LabelSupplierInfo; mono?: boolean }) {
  const { preview, qr } = useShippingLabel({ ...props, destination, supplier: s, mono });
  return <div style={{ width: 600, padding: 16, background: '#ECEAF7' }}>{qr}<ShippingLabelPreview src={preview} /></div>;
}
export const LabelWarehouse = () => <Label destination="warehouse" supplier={supplier} />;
export const LabelOffice = () => <Label destination="office" />;
export const LabelWarehouseMono = () => <Label destination="warehouse" supplier={supplier} mono />;
export const LabelOfficeMono = () => <Label destination="office" mono />;

// Le composeur (destination · fournisseur · aperçu · export), tel qu'il
// s'affiche sur un téléphone.
export const LabelComposer = () => (
  <div style={{ padding: 16, background: '#ECEAF7', minHeight: '100vh' }}>
    <ShippingLabelComposer {...props} />
  </div>
);

export const LabelComposerDesktop = () => (
  <div style={{ padding: 24, background: '#fff', minHeight: '100vh' }}>
    <ShippingLabelComposer {...props} layout="split" mode="admin" />
  </div>
);

// La feuille admin mobile (mode d'envoi · sorties · aperçu), ouverte.
export const LabelSheetMobile = () => (
  <div style={{ minHeight: '100vh', background: '#fff' }}>
    <MobileShippingLabelSheet open onClose={() => undefined} {...props} />
  </div>
);

// ── L'étiquette interne (入库标签), avec des données d'exemple ──
import { useEffect, useState } from 'react';
import { parcelQrPayload, renderWarehouseLabel, type WarehouseLabelData } from '@/lib/warehouseLabelCanvas';
import { useParcelQrCanvases } from '@/components/customer-code/useParcelQrCanvases';

const internalClient = { user_id: 'u1', customer_code: 'BZ-482913', first_name: 'Aïcha', last_name: 'Mbarga', phone: '+237 677 123 456', email: null, company_name: 'Mbarga Import SARL', city: 'Douala', country: 'Cameroun', account_id: 'a1', account_name: 'PRC', account_code: 'A1' };
const internalParcel = { parcel_no: 'RC-000123-03', seq: 3, kind: 'carton' as const, description: 'Chaussures, 40 paires 鞋子', weight_kg: 8.4, length_cm: 60, width_cm: 40, height_cm: 40, cbm: 0.096 };
const internalSupplier = { kind: 'supplier' as const, name: '广州鞋业有限公司 Guangzhou Shoes Co.', contact: 'Li Wei 李伟', phone: '138 0000 1234', email: 'liwei@gzshoes.cn', wechat: 'gzshoes_li', address: '广州市白云区石井大道 168 号 3 栋 · 168 Shijing Ave, Bldg 3, Baiyun, Guangzhou' };

function InternalLabel({ destination, supplier: s }: { destination: ShippingDestination; supplier?: WarehouseLabelData['supplier'] }) {
  const qrs = useParcelQrCanvases([{ id: 'p', value: parcelQrPayload(internalClient.customer_code, internalParcel.parcel_no) }]);
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!qrs.ready) return;
    const id = requestAnimationFrame(() => {
      renderWarehouseLabel({ destination, settings: DEFAULT_SHIPPING_SETTINGS, parcel: internalParcel, count: 10, depositNo: 'RC-000123', client: internalClient, supplier: s ?? null, receivedAt: '2026-09-21T06:32:00Z', receivedByName: 'Tina', location: 'B3' }, qrs.get('p'), 2)
        .then((c) => setSrc(c.toDataURL('image/png')))
        .catch((e) => console.error(e));
    });
    return () => cancelAnimationFrame(id);
  }, [qrs.ready, destination, s]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div style={{ width: 600, padding: 16, background: '#ECEAF7' }}>{qrs.nodes}{src && <img src={src} alt="" style={{ width: 600, display: 'block', boxShadow: '0 2px 10px rgba(0,0,0,.25)' }} />}</div>;
}
export const LabelInternalSea = () => <InternalLabel destination="warehouse" supplier={internalSupplier} />;
export const LabelInternalAir = () => <InternalLabel destination="office" />;
