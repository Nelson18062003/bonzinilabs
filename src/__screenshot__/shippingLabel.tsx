// DEV-ONLY — l'étiquette colis avec des données d'exemple (adresses fictives),
// pour la regarder en vrai avant de la mettre entre les mains d'un client.
import { ShippingLabel } from '@/components/customer-code/ShippingLabel';
import type { ChinaReceivingAddress } from '@/lib/customerCode';

const WAREHOUSE: ChinaReceivingAddress = {
  key: 'warehouse',
  label: { zh: '仓库', en: 'Warehouse', fr: 'Entrepôt' },
  addressZh: '广东省广州市白云区石井街道庆丰路88号\n国际物流园 B区 12号仓',
  recipientZh: '张伟（Bonzini 仓库）',
  phone: '+86 138 0000 0000',
  wechat: 'bonzini_cargo',
};
const OFFICE: ChinaReceivingAddress = {
  key: 'office',
  label: { zh: '广州办公室', en: 'Guangzhou office', fr: 'Bureau de Guangzhou' },
  addressZh: '广东省广州市越秀区环市东路 371 号\n世贸大厦 南塔 2108 室',
  recipientZh: '李娜（Bonzini 办公室）',
  phone: '+86 139 0000 0000',
  wechat: 'bonzini_gz',
};

const props = { code: 'BZ-482913', clientName: 'Aïcha Mbarga', clientPhone: '+237 677 12 34 56', companyName: 'Mbarga Import SARL', clientCity: 'Douala', clientCountry: 'Cameroun' };
const supplier = { name: 'Yiwu Hengda Trading Co.', phone: '+86 137 0000 0000', address: '浙江省义乌市国际商贸城三区 12345 号' };

export const LabelWarehouse = () => <ShippingLabel {...props} destination="warehouse" address={WAREHOUSE} supplier={supplier} />;
export const LabelOffice = () => <ShippingLabel {...props} destination="office" address={OFFICE} />;

// Le composeur (destination · fournisseur · aperçu · export), tel qu'il
// s'affiche sur un téléphone.
import { ShippingLabelComposer } from '@/components/customer-code/ShippingLabelComposer';
export const LabelComposer = () => (
  <div style={{ padding: 16, background: '#ECEAF7', minHeight: '100vh' }}>
    <ShippingLabelComposer code="BZ-482913" clientName="Aïcha Mbarga" clientPhone="+237 677 12 34 56" companyName="Mbarga Import SARL" clientCity="Douala" clientCountry="Cameroun" />
  </div>
);
