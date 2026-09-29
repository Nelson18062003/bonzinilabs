/**
 * L'exonération de TVA à l'importation — CGI 2024.
 *
 * Deux listes, lues dans l'édition 2024 :
 *   - annexe I du titre II (p. 99-103) : biens de première nécessité — riz, farine,
 *     lait, poisson, médicaments, engrais, livres, moustiquaires, matériel médical ;
 *   - annexe du titre I (p. 70-75) : équipements et matériels de l'agriculture, de
 *     l'élevage et de la pêche — semences, engrais, tracteurs agricoles, charrues,
 *     motopompes… Beaucoup de ces lignes ne valent que pour un **usage agricole**.
 *
 * L'exonération est **mécanique** : elle tient au code inscrit dans la liste (art.
 * 128 ter, « d'office, sans attestation »). C'est pourquoi le code exact compte : le
 * tracteur de MRSU9909331 déclaré en 8701.94.00.9100 a perdu l'exonération que
 * donnait 870190.11.0000 (docs/cargo/dossiers/2026-08_*, code-sh-tracteur.md).
 *
 * Le CGI écrit les codes sur 11 chiffres (« 100630 90 100 ») : une ligne plus fine
 * que le SH6 connu donne « ça dépend de la ligne nationale ».
 * Le droit de douane, lui, n'est pas exonéré par ces listes.
 */
import { matchSpec, type CodeSpec } from './hsCode';

type Entry = readonly [spec: CodeSpec, label: string];

export const ANNEX_I: Entry[] = [
  ['010511', 'Poussins'], ['010594', 'Coqs et poules vivants'],
  ['030211-030569', 'Poissons'],
  ['040110', 'Lait'], ['040120', 'Lait'], ['040140', 'Lait'], ['040150', 'Lait et crème'],
  ['040210', 'Lait en poudre'], ['040221', 'Lait en poudre'], ['040229', 'Lait en poudre'], ['040291', 'Lait concentré'],
  ['04029900100', 'Lait concentré sucré à moins de 40 % de sucre'],
  ['040711', 'Œufs à couver'], ['040719', 'Œufs à couver'],
  ['100111', 'Blé dur'], ['100119', 'Blé dur'], ['100590', 'Maïs'],
  ['100610', 'Riz paddy'], ['100620', 'Riz décortiqué'], ['100630', 'Riz blanchi'], ['100640', 'Brisures de riz'],
  ['110100', 'Farine de blé ou de méteil'],
  ['19011011', 'Préparations pour l’alimentation des enfants'],
  ['190510', 'Pain croustillant'], ['19059090', 'Pain ordinaire'],
  ['230110', 'Farines de viande (alimentation animale)'], ['230120', 'Farines de poisson (alimentation animale)'],
  ['230220-230250', 'Sons et résidus de céréales'], ['230400', 'Tourteaux de soja'],
  ['230620-230690', 'Tourteaux'], ['230990', 'Préparations pour l’alimentation animale (provenderie)'],
  ['25010090100', 'Sel brut en vrac'],
  ['27090010', 'Pétrole brut'], ['27101223', 'Pétrole lampant'], ['271113', 'Butane liquéfié (gaz domestique)'],
  ['293712', 'Insuline'], ['29392000900', 'Quinine'], ['294110-294190', 'Antibiotiques'],
  ['3001-3006', 'Produits pharmaceutiques'],
  ['3101-3105', 'Engrais'],
  ['34070010', 'Compositions pour l’art dentaire'],
  ['370110', 'Films pour rayons X'], ['370210', 'Pellicules pour rayons X'],
  ['38085', 'Pesticides (note 1 du chapitre 38)'],
  ['38089110100', 'Insecticides à usage agricole'], ['38089190100', 'Insecticides à usage agricole'],
  ['38089210100', 'Fongicides à usage agricole'], ['38089290100', 'Fongicides à usage agricole'],
  ['380893', 'Herbicides'], ['380894', 'Désinfectants'],
  ['3822', 'Réactifs de diagnostic ou de laboratoire'],
  ['401410', 'Préservatifs'], ['401490', 'Articles d’hygiène en caoutchouc (tétines…)'], ['401512', 'Gants chirurgicaux (SH 2017 : 4015.11)'],
  ['480100', 'Papier journal'], ['48026910', 'Papier pour journaux'],
  ['490110', 'Livres et brochures'], ['490191', 'Dictionnaires et encyclopédies'], ['490199', 'Livres et brochures'],
  ['63049300100', 'Moustiquaires'], ['63049900100', 'Moustiquaires'],
  ['701510', 'Verres de lunetterie médicale'], ['701710-701790', 'Verrerie de laboratoire'],
  ['841920', 'Stérilisateurs médicaux'],
  ['871310', 'Fauteuils roulants'], ['871390', 'Fauteuils roulants à moteur'], ['871420', 'Parties de fauteuils roulants'],
  ['901180', 'Microscopes'], ['901811', 'Électrocardiographes'], ['902212-902290', 'Appareils à rayons X'],
  ['94021010', 'Fauteuils de dentiste'], ['940290', 'Mobilier médical'],
];

/**
 * Annexe du titre I : matériel de l'agriculture, de l'élevage et de la pêche.
 * `true` : le code seul dit agricole. `false` : exonéré seulement si l'usage est
 * agricole (motopompe, emballages, pièces…).
 */
export const AGRICULTURE: (readonly [spec: CodeSpec, label: string, byCode: boolean])[] = [
  ['120911-120999', 'Semences', true], ['070110', 'Pommes de terre de semence', true],
  ['060210-060290', 'Plants et boutures', true], ['100111', 'Semence de blé', true], ['100191', 'Semence de méteil', true],
  ['100210', 'Semence de seigle', true], ['100310', 'Semence d’orge', true], ['100410', 'Semence d’avoine', true],
  ['100510', 'Semence de maïs', true], ['100710', 'Semence de sorgho', true], ['100821', 'Semence de millet', true],
  ['120110', 'Semence de soja', true], ['120230', 'Semence d’arachides', true], ['120721', 'Semence de coton', true],
  ['010121', 'Chevaux reproducteurs', true], ['010221', 'Bovins reproducteurs', true], ['010231', 'Buffles reproducteurs', true],
  ['010310', 'Porcins reproducteurs', true], ['010599', 'Canards, oies, dindes, pintades vivants', false],
  ['030193', 'Géniteurs et alevins de carpe', false], ['030199', 'Géniteurs et alevins (tilapia, clarias)', false],
  ['270300', 'Tourbe (milieu de culture)', false],
  ['3808', 'Pesticides à usage agricole', false],
  ['843210', 'Charrues', true], ['843221', 'Herses à disques', true], ['843229', 'Herses, cultivateurs, sarcleuses', true],
  ['84323', 'Semoirs, plantoirs, repiqueuses', true], ['84324', 'Épandeurs de fumier et distributeurs d’engrais', true],
  ['843280', 'Machines pour le travail du sol', true], ['843290', 'Parties de machines agricoles', true],
  ['843320', 'Faucheuses', true], ['843359', 'Machines de récolte', true], ['843360', 'Machines de nettoyage et de triage des produits agricoles', true],
  ['843390', 'Parties de machines de récolte', true],
  ['843410', 'Machines à traire', true], ['843420', 'Machines de laiterie', true], ['843490', 'Parties de machines de laiterie', true],
  ['843621', 'Couveuses et éleveuses', true], ['843629', 'Machines pour l’aviculture', true], ['843680', 'Machines pour l’agriculture', true],
  ['843691', 'Parties de machines d’aviculture', true], ['843699', 'Parties de machines agricoles', true],
  ['843710', 'Machines à trier les grains', true], ['843850', 'Machines pour le travail des viandes', false],
  ['870110', 'Motoculteurs', true], ['87019011', 'Tracteurs agricoles à roues', true],
  ['870191-870195', 'Tracteurs — exonérés seulement s’ils sont agricoles', false],
  ['871620', 'Remorques agricoles', true],
  ['8201', 'Petit matériel agricole (bêches, houes, machettes…)', true],
  ['842482', 'Pulvérisateurs agricoles (SH 2017 : 8424.81)', false],
  ['842489', 'Pulvérisateurs', false], ['842490', 'Parties de pulvérisateurs et réseaux d’irrigation', false],
  ['841381', 'Motopompes (irrigation)', false], ['841391', 'Parties de pompes (irrigation)', false],
  ['841934', 'Séchoirs pour produits agricoles', false],
  ['842790', 'Chariots-gerbeurs', false], ['843120', 'Parties de chariots', false],
  ['390110', 'Polyéthylène (emballage agricole)', false], ['390210', 'Polypropylène (emballage agricole)', false],
  ['392329', 'Sacs et sachets plastiques (emballage agricole)', false], ['392350', 'Bouchons et capsules (emballage agricole)', false],
  ['481910', 'Caisses en carton ondulé (emballage agricole)', false], ['630533', 'Sacs en polypropylène tissé (emballage agricole)', false],
  ['901890', 'Matériel de laboratoire vétérinaire', false],
];

export interface VatExemptResult {
  /** 'yes' : exonéré d'office. 'maybe' : selon la ligne nationale ou l'usage. 'no' : TVA due. */
  exempt: 'yes' | 'maybe' | 'no';
  label?: string;
  basis?: string;
  /** Ce qui déciderait d'un 'maybe'. */
  condition?: string;
}

const BASIS_I = 'CGI art. 128-6a et annexe I — biens de première nécessité';
const BASIS_AGRI = 'CGI art. 128 et annexe du titre I — matériel agricole, d’élevage et de pêche';

/**
 * @param agriculturalUse le client déclare un usage agricole, d'élevage ou de pêche :
 *   les lignes « selon l'usage » deviennent exonérées.
 */
export function vatExemption(code: string, agriculturalUse = false): VatExemptResult {
  let maybe: VatExemptResult | null = null;

  for (const [spec, label] of ANNEX_I) {
    const m = matchSpec(code, spec);
    if (m === 'yes') return { exempt: 'yes', label, basis: BASIS_I };
    if (m === 'maybe' && !maybe) {
      maybe = { exempt: 'maybe', label, basis: BASIS_I, condition: `Seule une ligne précise est exonérée (${label.toLowerCase()}) : à confirmer sur le code à 12 chiffres.` };
    }
  }
  for (const [spec, label, byCode] of AGRICULTURE) {
    const m = matchSpec(code, spec);
    if (m === 'no') continue;
    if (m === 'yes' && (byCode || agriculturalUse)) return { exempt: 'yes', label, basis: BASIS_AGRI };
    if (!maybe) {
      maybe = {
        exempt: 'maybe', label, basis: BASIS_AGRI,
        condition: m === 'yes'
          ? 'Exonéré si le matériel est destiné à l’agriculture, l’élevage ou la pêche.'
          : `Seule une ligne précise est exonérée (${label.toLowerCase()}) : à confirmer sur le code à 12 chiffres.`,
      };
    }
  }
  return maybe ?? { exempt: 'no' };
}
