/**
 * Le vocabulaire du marché → les codes du tarif.
 *
 * Un importateur de Douala ne cherche pas « Perruques, barbes, sourcils, cils,
 * mèches et articles similaires, en matières textiles synthétiques » : il tape
 * « mèches ». Le fournisseur de Guangzhou tape « 假发 ». Le douanier, lui, a
 * parfois choisi le code par ressemblance de mots — « régulateur » classé comme
 * réfrigérateur (docs/cargo/dossiers/…/articles-4-a-10_analyse.md).
 *
 * Chaque entrée : les mots (FR du Cameroun, EN, 中文), les codes SH 2022 à 6
 * chiffres dans l'ordre du plus probable, et ce qu'il faut savoir pour ne pas se
 * tromper. Un test vérifie que chaque code existe dans la nomenclature.
 */

export interface MarketTerm {
  terms: string[];
  codes: string[];
  /** Le piège, en une phrase — affiché avec le résultat. */
  tip?: string;
}

export const MARKET_TERMS: MarketTerm[] = [
  // ── Téléphonie, électronique ──
  { terms: ['téléphone', 'telephone portable', 'portable', 'smartphone', 'android', 'iphone', 'mobile phone', '手机', '智能手机'], codes: ['851713', '851714'], tip: "Les téléphones sont enregistrés par IMEI dans CAMCIS depuis 2026 : gardez la liste des IMEI de chaque lot." },
  { terms: ['tablette', 'tablet', 'ipad', '平板电脑'], codes: ['847130'] },
  { terms: ['ordinateur portable', 'laptop', 'pc portable', '笔记本电脑'], codes: ['847130'] },
  { terms: ['ordinateur de bureau', 'desktop', 'unité centrale', '台式电脑'], codes: ['847141', '847150'] },
  { terms: ['chargeur', 'charger', '充电器', 'adaptateur secteur'], codes: ['850440'] },
  { terms: ['power bank', 'batterie externe', '充电宝', '移动电源'], codes: ['850760'] },
  { terms: ['écouteurs', 'ecouteurs', 'casque audio', 'earphones', 'airpods', '耳机'], codes: ['851830'] },
  { terms: ['haut-parleur', 'baffle', 'enceinte', 'speaker', '音箱', '喇叭'], codes: ['851822', '851821', '851840'] },
  { terms: ['télévision', 'television', 'téléviseur', 'tv', 'écran plat', 'smart tv', '电视', '电视机'], codes: ['852872'] },
  { terms: ['décodeur', 'android box', 'tv box', 'démodulateur', '机顶盒'], codes: ['852871'] },
  { terms: ['caméra de surveillance', 'cctv', 'camera ip', '监控摄像头'], codes: ['852589'] },
  { terms: ['câble électrique', 'fil électrique', 'cable', '电线', '电缆'], codes: ['854449', '854442'] },
  { terms: ['ampoule', 'lampe led', 'led', 'ampoules', '灯泡', 'LED灯'], codes: ['853952', '940542', '940541'] },
  { terms: ['projecteur led', 'lampadaire solaire', 'lampe solaire', '太阳能灯'], codes: ['940542', '940541'] },
  { terms: ['disjoncteur', 'breaker', '断路器'], codes: ['853620'] },
  { terms: ['prise électrique', 'multiprise', 'rallonge', '插座', '插线板'], codes: ['853669'] },
  { terms: ['compteur électrique', 'electric meter', '电表'], codes: ['902830'] },

  // ── Énergie ──
  { terms: ['panneau solaire', 'plaque solaire', 'module photovoltaïque', 'solar panel', '太阳能板', '光伏板'], codes: ['854143'], tip: 'Les panneaux solaires sont à 10 %. La loi de finances 2026 exonère certains équipements d’énergie renouvelable pendant 12 mois : demandez l’attestation.' },
  { terms: ['batterie solaire', 'batterie lithium', 'batterie gel', 'lithium battery', '锂电池', '蓄电池'], codes: ['850760', '850720'] },
  { terms: ['batterie de voiture', 'batterie auto', 'car battery', '汽车电池'], codes: ['850710'] },
  { terms: ['onduleur', 'inverter', 'convertisseur', '逆变器'], codes: ['850440'] },
  { terms: ['régulateur de tension', 'stabilisateur', 'régulateur', 'regulateur', 'stabilizer', '稳压器'], codes: ['850440', '903289'], tip: "Un régulateur n'est pas un réfrigérateur : sur une DAU réelle, « RÉGULATEUR » classé en 8418 (30 %) au lieu de 8504 (10 %) a coûté 35 779 F de trop sur 150 000 F." },
  { terms: ['régulateur de charge', 'contrôleur solaire', 'charge controller', '太阳能控制器'], codes: ['850440', '903289'] },
  { terms: ['groupe électrogène', 'générateur', 'generator', 'groupe', '发电机', '发电机组'], codes: ['850220', '850211', '850212'] },
  { terms: ['transformateur', 'transformer', '变压器'], codes: ['850431', '850432', '850433'] },

  // ── Électroménager ──
  { terms: ['réfrigérateur', 'frigo', 'refrigerator', 'fridge', '冰箱'], codes: ['841821', '841810'] },
  { terms: ['congélateur', 'freezer', '冰柜', '冷柜'], codes: ['841830', '841840'] },
  { terms: ['climatiseur', 'split', 'clim', 'air conditioner', '空调'], codes: ['841510'] },
  { terms: ['ventilateur', 'fan', '风扇', '电风扇'], codes: ['841451'] },
  { terms: ['cuisinière', 'gazinière', 'réchaud', 'cooker', '燃气灶'], codes: ['732111', '851660'] },
  { terms: ['four micro-ondes', 'micro-ondes', 'microwave', '微波炉'], codes: ['851650'] },
  { terms: ['mixeur', 'blender', 'robot', '搅拌机', '榨汁机'], codes: ['850940'] },
  { terms: ['fer à repasser', 'iron', '熨斗'], codes: ['851640'] },
  { terms: ['bouilloire', 'kettle', '电热水壶'], codes: ['851671'] },
  { terms: ['machine à laver', 'lave-linge', 'washing machine', '洗衣机'], codes: ['845011', '845020'] },
  { terms: ['tondeuse à cheveux', 'tondeuse', 'clipper', '理发器'], codes: ['851020'] },
  { terms: ['sèche-cheveux', 'séchoir', 'hair dryer', '吹风机'], codes: ['851631'] },
  { terms: ['fer à lisser', 'lisseur', 'hair straightener', '直发器'], codes: ['851632'] },
  { terms: ['machine à coudre', 'sewing machine', '缝纫机'], codes: ['845210', '845229'] },

  // ── Mode, beauté ──
  { terms: ['mèches', 'meches', 'perruque', 'perruques', 'tissage', 'rajouts', 'brésilienne', 'extensions', 'wig', 'wigs', 'hair extension', '假发', '接发'], codes: ['670411', '670419', '670420'], tip: "Mèches et perruques portent 12,5 % d'accises (CGI art. 142). Synthétiques : 6704.11/19 ; cheveux naturels : 6704.20. Le TEC CEEAC 2026 pourrait les porter à 40 %." },
  { terms: ['friperie', 'fripe', 'vêtements usagés', 'vêtements d’occasion', 'balles de friperie', 'second hand clothes', '二手衣服', '旧衣服'], codes: ['630900'], tip: 'La friperie, ce sont des vêtements usagés (12,5 % d’accises). Des vêtements neufs déclarés en friperie paient une accise qu’ils ne doivent pas.' },
  { terms: ['t-shirt', 'tee-shirt', 'tshirt', 'maillot', 'T恤'], codes: ['610910', '610990'] },
  { terms: ['robe', 'robes', 'dress', '连衣裙'], codes: ['620442', '620443', '610442'] },
  { terms: ['pantalon', 'jean', 'jeans', 'trousers', '牛仔裤', '裤子'], codes: ['620342', '620462', '620343'] },
  { terms: ['chemise', 'shirt', '衬衫'], codes: ['620520', '620530'] },
  { terms: ['vêtements', 'habits', 'clothes', 'clothing', '衣服', '服装'], codes: ['610910', '620520', '620462', '630900'], tip: 'Neufs : chapitres 61 (bonneterie) ou 62. Usagés : 6309 (friperie). Le code dépend du vêtement et de la matière.' },
  { terms: ['sous-vêtements', 'slip', 'culotte', 'underwear', '内衣'], codes: ['610821', '610711'] },
  { terms: ['soutien-gorge', 'bra', '文胸'], codes: ['621210'] },
  { terms: ['pagne', 'wax', 'tissu imprimé', 'tissu wax', 'ankara', 'african print', '非洲蜡染布', '蜡染布'], codes: ['520852', '520842', '551341'], tip: 'Le pagne en coton imprimé relève en général du 5208.52. Les tissus de fibres synthétiques (5514 à 5516) portent 25 % d’accises.' },
  { terms: ['tissu', 'tissus', 'étoffe', 'fabric', '布料', '面料'], codes: ['520852', '540752', '551511'] },
  { terms: ['chaussures', 'baskets', 'sneakers', 'shoes', '鞋', '运动鞋'], codes: ['640411', '640299', '640399'] },
  { terms: ['tapettes', 'babouches', 'sandales', 'claquettes', 'tongs', 'slippers', 'flip-flops', '拖鞋'], codes: ['640220', '640299'] },
  { terms: ['sac à main', 'sacoche', 'handbag', '手提包', '包包'], codes: ['420222', '420221', '420229'] },
  { terms: ['valise', 'suitcase', '行李箱'], codes: ['420212', '420211'] },
  { terms: ['montre', 'watch', '手表'], codes: ['910211', '910212', '910219'] },
  { terms: ['bijoux fantaisie', 'bijouterie fantaisie', 'imitation jewelry', '饰品'], codes: ['711719', '711790'], tip: 'Bijoux, même fantaisie (71.17) : 25 % d’accises.' },
  { terms: ['lunettes de soleil', 'sunglasses', '太阳镜'], codes: ['900410'] },
  { terms: ['cosmétiques', 'crème', 'lait de toilette', 'pommade', 'lotion', 'cosmetics', '化妆品', '护肤品'], codes: ['330499', '330491'], tip: "Cosmétiques : 25 % d'accises, 50 % s'ils contiennent de l'hydroquinone (produits éclaircissants)." },
  { terms: ['crème éclaircissante', 'produit éclaircissant', 'hydroquinone', '美白霜'], codes: ['330499'], tip: "Avec de l'hydroquinone : 50 % d'accises (CGI art. 142(6)d)." },
  { terms: ['parfum', 'eau de toilette', 'perfume', '香水'], codes: ['330300'] },
  { terms: ['déodorant', 'deodorant', '除臭剂'], codes: ['330720'] },
  { terms: ['shampooing', 'shampoing', 'shampoo', '洗发水'], codes: ['330510'] },
  { terms: ['vernis à ongles', 'faux ongles', 'nail polish', '指甲油'], codes: ['330430', '670290'] },
  { terms: ['savon', 'soap', '肥皂'], codes: ['340111', '340119'], tip: 'Savons et produits de nettoyage : 25 % d’accises.' },
  { terms: ['détergent', 'lessive', 'omo', 'washing powder', '洗衣粉'], codes: ['340250'] },
  { terms: ['couches bébé', 'couches', 'diapers', '尿不湿', '纸尿裤'], codes: ['961900'] },
  { terms: ['serviettes hygiéniques', 'sanitary pads', '卫生巾'], codes: ['961900'] },
  { terms: ['papier hygiénique', 'papier toilette', 'toilet paper', '卫生纸'], codes: ['481810'], tip: 'Le papier hygiénique (4818.10) porte 25 % d’accises ; les mouchoirs (4818.20) n’en portent pas.' },
  { terms: ['mouchoirs', 'mouchoirs en papier', 'tissues', '纸巾'], codes: ['481820'], tip: "Les mouchoirs ne sont pas à l'annexe II du CGI : pas d'accises, même si une DAU réelle en a liquidé 25 %." },

  // ── Maison, mobilier ──
  { terms: ['chaise', 'chaises', 'chaises plastiques', 'chaise plastique', 'fauteuil', 'chair', '椅子', '塑料椅'], codes: ['940180', '940171', '940179', '940161'], tip: "Une chaise est un siège (94.01), jamais un « autre meuble » (94.03). En 9403.70 elle paie 25 % d'accises qu'elle ne doit pas." },
  { terms: ['canapé', 'salon', 'sofa', '沙发'], codes: ['940161', '940171'] },
  { terms: ['table', 'tables', 'bureau', 'desk', '桌子'], codes: ['940360', '940370', '940320'], tip: 'Meubles en bois (9403.30/50/60) et en plastique (9403.70) : 25 % d’accises. En métal (9403.20, hors bureau) : non.' },
  { terms: ['lit', 'bed', '床'], codes: ['940350', '940320'] },
  { terms: ['matelas', 'mattress', '床垫'], codes: ['940421', '940429'] },
  { terms: ['armoire', 'placard', 'wardrobe', '衣柜'], codes: ['940350', '940360'] },
  { terms: ['rideaux', 'curtains', '窗帘'], codes: ['630391', '630392'] },
  { terms: ['draps', 'linge de lit', 'bed sheets', '床单'], codes: ['630221', '630231'] },
  { terms: ['tapis', 'moquette', 'carpet', '地毯'], codes: ['570242', '570500'] },
  { terms: ['casseroles', 'marmites', 'cocotte', 'pots', '锅'], codes: ['732393', '761510', '732394'] },
  { terms: ['assiettes', 'vaisselle', 'plates', '盘子', '碗'], codes: ['691200', '691110', '392410'] },
  { terms: ['verres', 'gobelets', 'glasses', '玻璃杯'], codes: ['701337', '701349'] },
  { terms: ['thermos', 'glacière', 'cooler', '保温瓶'], codes: ['961700', '392490'] },
  { terms: ['bouteille de gaz', 'bonbonne de gaz', 'gas cylinder', '煤气罐'], codes: ['731100'] },
  { terms: ['jouets', 'jouet', 'toys', '玩具'], codes: ['950300'] },
  { terms: ['console de jeux', 'playstation', 'ps5', 'jeux vidéo', 'video game', '游戏机'], codes: ['950450'], tip: 'Consoles et jeux vidéo (95.04) : 25 % d’accises.' },

  // ── Bâtiment, quincaillerie ──
  { terms: ['carreaux', 'carrelage', 'tiles', 'faïence', '瓷砖'], codes: ['690721', '690722', '690723'], tip: 'Taxe environnementale de la loi de finances 2026 : 15 000 F la tonne sur les carreaux importés.' },
  { terms: ['ciment', 'cement', '水泥'], codes: ['252329', '252390'] },
  { terms: ['fer à béton', 'barre de fer', 'rond à béton', 'rebar', '钢筋'], codes: ['721420', '721310'], tip: 'Taxe environnementale de la loi de finances 2026 : 5 000 F la tonne sur les fers à béton.' },
  { terms: ['tôle', 'tôles', 'tôle ondulée', 'bac alu', 'roofing sheet', '铁皮', '彩钢瓦'], codes: ['721049', '721070', '721061', '760612'] },
  { terms: ['fenêtre aluminium', 'fenêtres alu', 'fenêtres', 'baie vitrée', 'aluminium window', '铝窗'], codes: ['761010'] },
  { terms: ['porte', 'portes', 'door', '门'], codes: ['761010', '441829', '730830'] },
  { terms: ['robinet', 'robinetterie', 'tap', 'faucet', '水龙头'], codes: ['848180'] },
  { terms: ['tuyau pvc', 'tuyaux', 'pvc pipe', 'PVC管'], codes: ['391723'] },
  { terms: ['peinture', 'paint', '油漆'], codes: ['320910', '321000'] },
  { terms: ['clous', 'nails', '钉子'], codes: ['731700'] },
  { terms: ['vis', 'boulons', 'screws', '螺丝'], codes: ['731815', '731814'] },
  { terms: ['serrure', 'cadenas', 'lock', 'padlock', '锁'], codes: ['830140', '830110'] },
  { terms: ['sanitaires', 'wc', 'lavabo', 'toilet bowl', '马桶'], codes: ['691010'] },
  { terms: ['brouette', 'wheelbarrow', '手推车'], codes: ['871680'] },
  { terms: ['outils', 'outillage', 'tools', '工具'], codes: ['820559', '820540'] },
  { terms: ['perceuse', 'drill', '电钻'], codes: ['846721'] },
  { terms: ['poste à souder', 'soudure', 'welding machine', '电焊机'], codes: ['851531', '851539'] },
  { terms: ['bâche', 'bâches', 'tarpaulin', '篷布'], codes: ['630612'] },

  // ── Véhicules, deux-roues ──
  { terms: ['moto', 'motos', 'okada', 'mototaxi', 'bensikin', 'motorcycle', '摩托车'], codes: ['871120', '871130'], tip: "Jusqu'à 250 cm³ : 5 % d'accises ; au-delà : 12,5 %. La plupart des motos-taxis sont en 8711.20." },
  { terms: ['moto électrique', 'scooter électrique', 'electric scooter', '电动摩托车'], codes: ['871160'] },
  { terms: ['tricycle', 'moto tricycle', 'keke', '三轮车'], codes: ['871120', '870490'] },
  { terms: ['pièces moto', 'pièces détachées moto', 'motorcycle parts', '摩托车配件'], codes: ['871410'], tip: 'Toutes les parties de motos portent 12,5 % d’accises.' },
  { terms: ['pneus', 'pneu', 'pneumatiques', 'tyres', 'tires', '轮胎'], codes: ['401110', '401140', '401120'], tip: 'Les pneus d’occasion (4012.20) portent 12,5 % d’accises ; les neufs non.' },
  { terms: ['voiture', 'véhicule', 'auto', 'car', '汽车'], codes: ['870323', '870322', '870332', '870333'], tip: "Le taux d'accises dépend de la cylindrée et de l'année de première mise en circulation (0 à 25 %) : trois millions de francs peuvent dépendre de 500 cm³." },
  { terms: ['voiture électrique', 'electric car', '电动汽车'], codes: ['870380'] },
  { terms: ['camion', 'truck', '卡车'], codes: ['870422', '870423', '870432'] },
  { terms: ['pick-up', 'pickup', 'camionnette', '皮卡'], codes: ['870421', '870431'] },
  { terms: ['bus', 'minibus', 'coaster', '客车'], codes: ['870210', '870290'] },
  { terms: ['pièces détachées auto', 'pièces auto', 'auto parts', 'spare parts', '汽车配件'], codes: ['870899', '870830', '870880'] },
  { terms: ['huile moteur', 'lubrifiant', 'engine oil', '机油'], codes: ['271019'] },

  // ── Agriculture, équipement ──
  { terms: ['tracteur', 'tracteur agricole', 'tractor', '拖拉机'], codes: ['870193', '870194', '870192'], tip: "Le code « tracteurs agricoles à roues » 870190.11.0000 reste ouvert dans CAMCIS et c'est lui que nomme le CGI : TVA exonérée d'office. Déclaré en 8701.93/94 sans mention agricole, l'exonération se discute." },
  { terms: ['motoculteur', 'power tiller', '微耕机'], codes: ['870110'] },
  { terms: ['motopompe', 'pompe à eau', 'water pump', '水泵'], codes: ['841381', '841370'], tip: 'Exonérée de TVA si elle sert à l’irrigation (annexe agricole du CGI).' },
  { terms: ['moulin', 'moulin à écraser', 'broyeur', 'grain mill', '磨粉机'], codes: ['843780', '850940'] },
  { terms: ['décortiqueuse', 'huller', '脱壳机'], codes: ['843780'] },
  { terms: ['pulvérisateur', 'sprayer', '喷雾器'], codes: ['842482', '842441'] },
  { terms: ['engrais', 'fertilizer', '化肥'], codes: ['310520', '310210'] },
  { terms: ['semences', 'graines', 'seeds', '种子'], codes: ['120991', '120999'] },
  { terms: ['machette', 'houe', 'daba', 'hoe', '砍刀'], codes: ['820110', '820130'] },
  { terms: ['couveuse', 'incubateur', 'incubator', '孵化器'], codes: ['843621'] },

  // ── Alimentaire ──
  { terms: ['riz', 'rice', '大米'], codes: ['100630', '100640'], tip: 'Le riz est exonéré de TVA (annexe I du CGI).' },
  { terms: ['farine', 'farine de blé', 'flour', '面粉'], codes: ['110100'] },
  { terms: ['sucre', 'sugar', '白糖'], codes: ['170199'] },
  { terms: ['huile végétale', "huile d'arachide", 'huile de palme raffinée', 'vegetable oil', '食用油'], codes: ['151790', '151190', '151219'], tip: 'Les huiles végétales raffinées importées portent 12,5 % d’accises.' },
  { terms: ['lait en poudre', 'lait', 'milk powder', '奶粉'], codes: ['040221', '040210'] },
  { terms: ['pâtes alimentaires', 'spaghetti', 'macaroni', 'pasta', '意大利面'], codes: ['190219', '190211'] },
  { terms: ['conserves', 'sardines', 'tomate concentrée', 'canned food', '罐头'], codes: ['160413', '200290'] },
  { terms: ['poisson congelé', 'maquereau', 'chinchard', 'frozen fish', '冻鱼'], codes: ['030354', '030355', '030389'], tip: 'Le poisson est exonéré de TVA (annexe I du CGI).' },
  { terms: ['poulet congelé', 'volaille', 'frozen chicken', '冻鸡'], codes: ['020714', '020712'], tip: 'Viandes importées : 12,5 % d’accises.' },
  { terms: ['boisson gazeuse', 'soda', 'jus', 'soft drink', '饮料'], codes: ['220210', '220299', '200989'] },
  { terms: ['biscuits', 'gâteaux', 'biscuits secs', '饼干'], codes: ['190531', '190590'], tip: 'Biscuits et pâtisseries (19.05) : 25 % d’accises.' },
  { terms: ['bonbons', 'sucreries', 'chewing-gum', 'candy', '糖果'], codes: ['170490', '170410'] },
  { terms: ['chocolat', 'chocolate', '巧克力'], codes: ['180690', '180632'] },
  { terms: ['cube', 'bouillon cube', 'maggi', 'assaisonnement', '调味料'], codes: ['210410', '210390'] },
  { terms: ['mayonnaise', '蛋黄酱'], codes: ['210390'] },

  // ── Santé, bureau, emballage ──
  { terms: ['médicaments', 'medicaments', 'medicine', '药品'], codes: ['300490', '300420'], tip: 'Les médicaments sont exonérés de TVA et à 0 % de droit de douane pour la plupart.' },
  { terms: ['masques', 'gants', 'matériel médical', 'medical supplies', '医疗用品'], codes: ['630790', '401519', '901890'] },
  { terms: ['moustiquaire', 'mosquito net', '蚊帐'], codes: ['630493', '630499'] },
  { terms: ['cahiers', 'notebooks', '笔记本'], codes: ['482020'] },
  { terms: ['stylos', 'bic', 'pens', '笔', '圆珠笔'], codes: ['960810'] },
  { terms: ['livres', 'books', '书'], codes: ['490199'] },
  { terms: ['emballages plastiques', 'sachets', 'plastic bags', '塑料袋'], codes: ['392321', '392329'], tip: 'Sacs en polyéthylène (3923.21) : 25 % d’accises, plus la taxe environnementale sur les plastiques.' },
  { terms: ['bouteilles plastique', 'préformes', 'plastic bottles', '塑料瓶'], codes: ['392330'] },
  { terms: ['sacs tissés', 'sacs de riz vides', 'sacs pp', 'woven bags', '编织袋'], codes: ['630533'] },
  { terms: ['cartons', 'boîtes en carton', 'carton box', '纸箱'], codes: ['481910'] },
];
