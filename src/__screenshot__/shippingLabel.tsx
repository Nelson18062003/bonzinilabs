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
