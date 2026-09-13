// DEV-ONLY — l'étiquette colis avec des données d'exemple, pour la regarder
// en vrai avant de la mettre entre les mains d'un client.
import { ShippingLabel } from '@/components/customer-code/ShippingLabel';
import { ShippingLabelComposer } from '@/components/customer-code/ShippingLabelComposer';
import { DEFAULT_SHIPPING_SETTINGS } from '@/lib/customerCode';

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

export const LabelWarehouse = () => <ShippingLabel {...props} destination="warehouse" supplier={supplier} />;
export const LabelOffice = () => <ShippingLabel {...props} destination="office" />;

// Le composeur (destination · fournisseur · aperçu · export), tel qu'il
// s'affiche sur un téléphone.
export const LabelComposer = () => (
  <div style={{ padding: 16, background: '#ECEAF7', minHeight: '100vh' }}>
    <ShippingLabelComposer {...props} />
  </div>
);

export const LabelComposerDesktop = () => (
  <div style={{ padding: 24, background: '#fff', minHeight: '100vh' }}>
    <ShippingLabelComposer {...props} layout="split" />
  </div>
);
