/* ═══════════════ CARGO ═══════════════ */
const routeHead = (num = 'MIEU 3611115') => `${nav(num, dotsB)}
  <div class="route">
    <div class="ends"><div><b>Nansha</b><span>parti le 2 oct.</span></div><div class="r"><b>Douala</b><span>MAERSK KENSINGTON</span></div></div>
    <div class="track"><div class="ln"></div><div class="fl" style="width:70%"></div><div class="a"></div><div class="b"></div><div class="boat" style="left:calc(72% - 16px)">${J.ship('#F5F5F5').replace('ic24', '')}</div></div>
    <div class="eta">Arrive le <b>28 oct.</b><span class="tag t-bad">+4 j</span><span class="pm">promis le 24</span></div>
  </div>`;
const segC = (on) => `<div class="seg seg4" style="margin-top:16px">${['Suivi', 'Documents', 'Colis', 'Coûts'].map((x) => `<span class="${x === on ? 'on' : ''}">${x}</span>`).join('')}</div>`;

// 1 · Liste complète de la flotte
add('Cargo · Tous les conteneurs', `${sbar()}<div class="body">
  ${nav('Conteneurs', `<div style="display:flex;gap:4px">${icB(I.search)}${dotsB}</div>`)}
  <div class="chips"><span class="chip on">Tous 9</span><span class="chip">En mer 6</span><span class="chip">Sous 7 j 3</span><span class="chip">À régler 2</span><span class="chip">Sans suivi 1</span></div>
  <div class="list" style="margin-top:6px">
    ${row(carrier('cma'), 'CMAU 5530218', 'Groupage · Kribi 26 oct.', tg('t-ok', 'À l\'heure'))}
    ${row(carrier('maersk'), 'MIEU 3611115', 'Groupage · Douala 28 oct.', tg('t-bad', '+4 j'))}
    ${row(carrier('maersk'), 'MRKU 2208671', 'Ibrahim Touré · Douala 30 oct.', tg('t-todo', 'Télex'))}
    ${row(carrier('msc'), 'MSCU 4417092', 'Samuel Nkoulou · Douala 3 nov.', tg('t-bad', '+2 j'))}
    ${row(carrier('cma'), 'CMAU 7741026', 'Jean-Paul Mbarga · Douala 9 nov.', tg('t-todo', 'Fret à régler'))}
    ${row(carrier('maersk'), 'MRKU 7730415', 'Groupage · Douala 21 nov.', tg('t-ok', 'À l\'heure'))}
    ${row(carrier('cosco'), 'CSNU 6120974', 'Aïcha Diallo · pas encore parti', tg('t-neu', 'Sans suivi'))}
  </div>
</div>${tabs('cargo', 'admin', { ops: 5, cargo: 2 })}${end}`);

// 2 · Carte (golfe de Guinée, navires qui arrivent)
const P = (lon, lat) => [((lon + 6) * 20.7).toFixed(1), ((12 - lat) * 20.7).toFixed(1)];
const coast = [[-6, 4.9], [-5, 5.1], [-4, 5.25], [-3, 5.1], [-2, 4.75], [-1, 5.1], [0, 5.6], [1.2, 6.1], [2.4, 6.35], [3.4, 6.45], [4.5, 6.2], [5.2, 5.6], [5.6, 4.9], [6.1, 4.3], [7.0, 4.45], [8.0, 4.55], [8.6, 4.7], [9.1, 4.1], [9.7, 4.05], [9.8, 3.5], [9.9, 2.9], [9.8, 2.2], [9.6, 1.1], [9.4, 0.4], [9.2, -0.4], [8.8, -0.8], [9.3, -2.0], [10.3, -3.1], [11.2, -4.0], [11.9, -4.9], [12.4, -6.0], [13.0, -7.2]];
const land = 'M' + coast.map(([a, b]) => P(a, b).join(' ')).join(' L') + ` L 400 ${P(0, -7.2)[1]} L 400 -10 L -10 -10 L -10 ${P(-6, 4.9)[1]} Z`;
const bioko = 'M' + [[8.45, 3.75], [8.95, 3.75], [8.95, 3.25], [8.6, 3.2]].map(([a, b]) => P(a, b).join(' ')).join(' L') + ' Z';
const sea1 = 'M' + [[4.2, -9], [5.6, -3], [7.6, 1.2], [9.2, 3.4], [9.7, 4.05]].map(([a, b]) => P(a, b).join(' ')).join(' L');
const sea2 = 'M' + [[1.22, 6.0], [2.6, 4.2], [5.2, 2.9], [8.2, 3.0], [9.7, 4.05]].map(([a, b]) => P(a, b).join(' ')).join(' L');
const at = (lon, lat, dx = 0, dy = 0) => { const [x, y] = P(lon, lat); return `left:${(+x + dx).toFixed(0)}px;top:${(+y + 56 + dy).toFixed(0)}px`; };
const shipI = J.ship('#F5F5F5').replace('class="ic24"', '');
add('Cargo · Carte', `${sbar()}<div class="body">
  ${nav('Carte', icB(I.search))}
  <div class="mapw" style="top:56px">
    <svg width="393" height="742" style="position:absolute;left:0;top:0"><path d="${land}" fill="#F0F0F0" stroke="#C9C9C9" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="${sea1}" fill="none" stroke="#949494" stroke-width="2" stroke-dasharray="6 6"/><path d="${sea2}" fill="none" stroke="#949494" stroke-width="2" stroke-dasharray="6 6"/></svg>
  </div>
  <div class="port" style="${at(-4.0, 5.3, -6, -6)}"><i></i>Abidjan</div>
  <div class="port" style="${at(1.22, 6.13, -20, -48)}">Lomé</div>
  <div class="port" style="${at(3.4, 6.45, -5, 2)}"><i></i>Lagos</div>
  <div class="port" style="${at(9.7, 4.05, -48, -26)}">Douala<i></i></div>
  <div class="port" style="${at(9.9, 2.9, 6, -8)}"><i></i>Kribi</div>
  <div class="pinv" style="${at(1.22, 6.13, -20, -2)}">${shipI}<span class="n">2</span></div>
  <div class="pinv" style="${at(6.0, 1.6, -20, -20)}">${shipI}</div>
  <div class="pinv" style="${at(9.0, 2.7, -20, -20)}">${shipI}</div>
  <div class="chips" style="position:absolute;top:70px;left:0;right:0"><span class="chip on">Tous 6</span><span class="chip" style="background:#fff;border:1px solid #D9D9D9">Sous 7 j 3</span><span class="chip" style="background:#fff;border:1px solid #D9D9D9">En Asie 2</span></div>
  <div class="sheet" style="padding-bottom:30px"><div class="grab"></div>
    <div style="display:flex;justify-content:space-between;align-items:baseline"><h3>MAERSK KENSINGTON</h3><span class="tag t-todo" style="margin:0">À Lomé</span></div>
    <p>Escale depuis le 20 oct. · 2 conteneurs</p>
    <div class="list" style="padding:0;margin-top:6px">
      ${row(carrier('maersk'), 'MIEU 3611115', 'Groupage · Douala 28 oct.', tg('t-bad', '+4 j'))}
      ${row(carrier('maersk'), 'MRKU 2208671', 'Ibrahim Touré · Douala 30 oct.', tg('t-todo', 'Télex'))}
    </div>
  </div>
</div>${endS}`);

// 3 · Suivre un conteneur
add('Cargo · Suivre un conteneur', `${sbar()}<div class="body">
  ${nav('Suivre un conteneur')}
  <div class="lbl">B/L, booking ou n° de conteneur</div>
  <div class="inp on" style="font-weight:700;letter-spacing:.02em">MRKU 7730415<span style="margin-left:auto;display:flex;align-items:center;gap:8px;font:600 15px 'DM Sans';color:#5A5A5A">${carrier('maersk').replace('class="logo"', 'class="logo" style="width:32px;height:32px"')}Maersk</span></div>
  <div class="lbl">Armateurs</div>
  <div class="list">
    ${row(carrier('maersk'), 'Maersk', 'Jalons en direct', tg('t-ok', 'En direct'))}
    ${row(carrier('cma'), 'CMA CGM', 'Jalons en direct', tg('t-ok', 'En direct'))}
    ${row(carrier('msc'), 'MSC', 'Dates du transitaire', tg('t-neu', 'Bientôt'))}
    ${row(carrier('cosco'), 'COSCO', 'Dates du transitaire', tg('t-neu', 'Bientôt'))}
  </div>
  <div class="lbl">Dernières recherches</div>
  <div class="list">
    ${row(avI(J.hist()), 'MEDUJ8812044', 'B/L · déjà dans la flotte', J.chev)}
  </div>
  <div class="dock"><div class="btn">Interroger l'armateur</div></div>
</div>${end}`);

// 4 · Résultat → Ajouter à ma flotte
add('Cargo · Ajouter à ma flotte', `${sbar()}<div class="body">
  ${nav('Suivre un conteneur')}
  <div class="who">${carrier('maersk')}<div style="flex:1"><b>MRKU 7730415</b><span>Nansha → Douala · 21 nov.</span></div></div>
  <div class="list" style="margin-top:6px">
    <div class="row"><div class="st ok">${J.ok()}</div><div class="rm"><div class="rn">Chargé à bord</div><div class="rs">Nansha · 18 oct.</div></div></div>
    <div class="row"><div class="st now">${J.ship('#F5F5F5')}</div><div class="rm"><div class="rn">En mer</div><div class="rs">MAERSK KOLKATA · 642W</div></div></div>
  </div>
  ${sheet(`<h3>Ajouter MRKU 7730415</h3>
    <div class="lbl">Client</div><div class="inp">Groupage<span class="r2">GAUSS, PRC…</span></div>
    <div class="two" style="margin:0"><div><div class="lbl">Départ promis</div><div class="inp">18 oct.</div></div><div><div class="lbl">Arrivée promise</div><div class="inp">18 nov.</div></div></div>
    <div class="lbl">Fret (USD)</div><div class="field" style="margin:0">3 450<small>USD</small></div>
    <div class="btn" style="margin-top:18px">Ajouter à ma flotte</div>`)}
</div>${endS}`);

// 5 · Conteneur · Colis
add('Cargo · Conteneur · Colis', `${sbar()}<div class="body">${routeHead()}${segC('Colis')}
  <div class="lbl" style="padding-top:16px">14 clients · 86 colis · 27,4 m³</div>
  <div class="list">
    ${row(av('FN'), 'Fatou Ndiaye', 'RC-000418 · 3 colis', amt('0,84', rs('m³ · 3 %')))}
    ${row(av('JM'), 'Jean-Paul Mbarga', 'RC-000412 · 9 colis', amt('4,12', rs('m³ · 15 %')))}
    ${row(avI(J.q('#1E1E1E')), 'Sans propriétaire', '2 lots · 0,96 m³', `<div class="mini-btn">Attribuer</div>`)}
  </div>
  <div class="dock"><div class="btn">Charger des colis reçus</div></div>
</div>${end}`);

// 6 · Conteneur · Coûts
add('Cargo · Conteneur · Coûts', `${sbar()}<div class="body">${routeHead()}${segC('Coûts')}
  <div class="box" style="margin-top:14px"><div class="kv">Prix de revient<b>4 812 000 XAF</b></div></div>
  <div class="list" style="margin-top:4px">
    ${row(avI(J.sea()), 'Fret · Maersk', 'Transport · payé le 3 oct.', amt('3 450 $', tg('t-ok', 'Payé')))}
    ${row(avI(J.anchor()), 'Droits de port DIT', 'Port · à Bolloré', amt('77 000', tg('t-todo', 'À payer')))}
    ${row(avI(J.doc()), 'BESC', 'Formalités', amt('118 000', tg('t-todo', 'À payer')))}
  </div>
  <div class="okline" style="margin-top:6px">${J.coin()}<span class="link">Estimer le coût à quai</span></div>
  <div class="dock"><div class="btn">Ajouter un coût</div></div>
</div>${end}`);

// 7 · Coût à quai
const sure = tg('t-ok', 'Sûr'), est = tg('t-todo', 'Estimé');
add('Cargo · Coût à quai', `${sbar()}<div class="body">
  ${nav('Le coût à quai')}
  <div class="fiche" style="padding-top:18px"><div class="sub" style="margin:0">Pour MIEU 3611115 · CIF · 4 200 kg</div>
    <div class="big" style="font-size:40px">9,8 à 10,1 M <small>XAF</small></div></div>
  <div class="list" style="margin-top:10px">
    ${row(avI(J.shield()), 'Droit de douane 30 %', 'Sur 16 800 000 XAF', amt('5 040 000', sure))}
    ${row(avI(J.coin()), 'TVA 19,25 %', 'Sur la valeur + le droit', amt('4 204 200', sure))}
    ${row(avI(J.anchor()), 'Port, BESC, dossier', 'Douala · DIT', amt('450 à 650 k', est))}
    ${row(avI(J.truck()), 'Camion', 'Jusqu\'au client', amt('150 à 250 k', est))}
    ${row(avI(J.cal()), 'Franchise 10 jours', 'Puis ≈ 35 000 XAF / jour', tg('t-bad', 'Risque'))}
  </div>
  <div class="dock"><div class="btn soft">Revoir les 6 réponses</div></div>
</div>${end}`);

// 8 · Avion · expéditions
add('Cargo · Avion · expéditions', `${sbar()}<div class="body">
  ${nav('Avion', icB(J.plus()))}
  <div class="chips"><span class="chip on">En cours 3</span><span class="chip">Préparation</span><span class="chip">En vol</span><span class="chip">Arrivés</span><span class="chip">Tous</span></div>
  <div class="box" style="margin-top:14px"><div class="kv" style="color:#1E1E1E"><span style="display:flex;gap:10px;align-items:center">${J.box()}<b style="text-align:left">4 paquets sans vol</b></span><span class="link" style="font-size:15px">Mettre sur un vol</span></div></div>
  <div class="list" style="margin-top:4px">
    ${row(carrier('air'), 'LTA 071-4482 9035', 'ET 607 · part le 23 oct.', tg('t-todo', 'Préparation'))}
    ${row(carrier('air'), 'LTA à venir', 'TK 6271 · départ 27 oct.', tg('t-todo', 'Préparation'))}
    ${row(carrier('air'), 'LTA 235-1180 4426', 'TK 6265 · parti le 19 oct.', tg('t-neu', 'En vol'))}
    ${row(carrier('air'), 'LTA 071-4479 2210', 'Arrivé à Douala le 15 oct.', tg('t-todo', '2 non soldés'))}
  </div>
</div>${tabs('cargo', 'admin', { ops: 5, cargo: 2 })}${end}`);

// 9 · Avion · nouvelle expédition
add('Cargo · Avion · nouvelle expédition', `${sbar()}<div class="body">
  ${nav('Nouvelle expédition')}
  <div class="lbl">Numéro de LTA</div>
  <div class="inp">071-4482 9035</div>
  <div class="srow" style="margin:4px 20px 0;border:0">LTA pas encore connue<span class="sw off" style="margin-left:auto"></span></div>
  <div class="two"><div><div class="lbl" style="padding-left:0;padding-top:10px">Compagnie</div><div class="inp" style="margin:0">Ethiopian</div></div><div><div class="lbl" style="padding-left:0;padding-top:10px">Vol</div><div class="inp" style="margin:0">ET 607</div></div></div>
  <div class="two"><div><div class="lbl" style="padding-left:0">Départ prévu</div><div class="inp" style="margin:0">23 oct.</div></div><div><div class="lbl" style="padding-left:0">Arrivée prévue</div><div class="inp" style="margin:0">24 oct.</div></div></div>
  <div class="lbl">Paquets fermés · 2 sur 4</div>
  <div class="list">
    <div class="row" style="padding:10px 0">${ckOn}<div class="rm"><div class="rn">PQ-000231</div></div><b style="font:600 16px 'DM Sans'">31,6 kg</b></div>
    <div class="row" style="padding:10px 0">${ckOn}<div class="rm"><div class="rn">PQ-000233</div></div><b style="font:600 16px 'DM Sans'">30,2 kg</b></div>
  </div>
  <div class="dock"><div class="btn">Ouvrir l'expédition</div></div>
</div>${end}`);

// 10 · Avion · charger des colis
add('Cargo · Avion · charger des colis', `${sbar()}<div class="body">
  ${nav('Charger dans l\'avion', icB(J.scan()))}
  <div class="search">${J.scan('#5A5A5A')}Scannez ou tapez RC-…</div>
  <div class="lbl">Fatou Ndiaye · 2 colis</div>
  <div class="list">
    <div class="row" style="padding:10px 0">${ckOn}${photo(0, 48)}<div class="rm"><div class="rn">RC-000420-01</div><div class="rs">Chaussures · 6,2 kg</div></div></div>
    <div class="row" style="padding:10px 0">${ckOn}${photo(2, 48)}<div class="rm"><div class="rn">RC-000420-02</div><div class="rs">Montres · 2,2 kg</div></div></div>
  </div>
  <div class="lbl">Aïcha Diallo · 2 colis</div>
  <div class="list">
    <div class="row" style="padding:10px 0">${ckOn}${photo(1, 48)}<div class="rm"><div class="rn">RC-000421-01</div><div class="rs">Cosmétiques · 3,4 kg</div></div></div>
    <div class="row" style="padding:10px 0">${ckOff}${photo(3, 48)}<div class="rm"><div class="rn">RC-000421-02</div><div class="rs">Perruques · 2,4 kg</div></div></div>
  </div>
  <div class="dock"><div class="btn">Charger 3 colis · 11,8 kg</div></div>
</div>${end}`);

// 11 · Comptes cargo
add('Cargo · Comptes cargo', `${sbar()}<div class="body">
  ${nav('Comptes cargo', icB(J.plus()))}
  <div class="hero"><div class="lab">Leurs colis à Guangzhou</div><div class="num">89 <small>colis</small></div><div class="sub"><span><b>4</b> comptes</span><span><b>28</b> clients rattachés</span></div></div>
  <div class="list" style="margin-top:8px">
    ${row(av('D1'), 'Simon Djiani', 'DJIANI · 12 clients', amt('46', rs('colis')))}
    ${row(av('GA'), 'Gauss Import', 'GAUSS · 8 clients', amt('31', rs('colis')))}
    ${row(av('PR'), 'Pierre Roger', 'PRC · 5 clients', amt('12', rs('colis')))}
    ${row(av('KM'), 'Kamdem & Frères', 'KMF · 3 clients', amt('0', rs('colis')))}
  </div>
  <div class="okline" style="margin-top:12px"><span class="link">Voir aussi les comptes fermés (2)</span></div>
</div>${end}`);

// 12 · Compte cargo · fiche
add('Cargo · Compte cargo', `${sbar()}<div class="body">
  ${nav('Compte cargo', dotsB)}
  <div class="fiche">${av('D1')}<div class="nm">Simon Djiani</div><div class="sub" style="margin-top:4px">DJIANI · +237 699 21 44 10</div>
    <div class="big">46 <small>colis</small></div><div class="line">À Guangzhou, pas encore chargés</div></div>
  <div class="h2"><b>Ses clients · 12</b></div>
  <div class="list">
    ${row(av('BN'), 'Blaise Nana', 'BZ-5871', amt('14', rs('colis')))}
    ${row(av('MT'), 'Marie Tamba', 'BZ-5904', amt('9', rs('colis')))}
    ${row(av('OE'), 'Olivier Essama', 'BZ-6122', amt('6', rs('colis')))}
  </div>
  <div class="dock"><div class="btn">Rattacher un client</div></div>
</div>${end}`);

// 13 · Devis
add('Cargo · Devis', `${sbar()}<div class="body">
  ${nav('Devis · RC-000418', `<div style="display:flex;gap:4px">${icB(J.dl())}${icB(J.share())}</div>`)}
  <div class="fiche" style="padding-top:18px"><div class="big" style="margin-top:0">148 000 <small>XAF</small></div><div class="sub">Fatou Ndiaye · bateau · 0,84 m³</div><span class="tag t-todo">À payer</span></div>
  <div class="box">
    <div class="kv">Chaussures · 0,108 m³<b>17 820</b></div>
    <div class="kv">Sacs à main · 0,312 m³<b>51 480</b></div>
    <div class="kv">Tissus wax · 0,420 m³<b>69 300</b></div>
    <div class="kv">Manutention<b>9 400</b></div>
    <div class="kv" style="color:#1E1E1E;font-weight:600">Total<b>148 000 XAF</b></div>
  </div>
  <div class="seg" style="margin-top:14px"><span class="on">FR</span><span>EN</span></div>
  <div class="dock"><div class="btn">Renvoyer le devis</div><div class="duo" style="margin-top:10px"><div class="btn soft">Frais, remise</div><div class="btn soft">Facture</div></div></div>
</div>${end}`);

// 14 · Réception · Qui apporte ?
const opt = (b, s, on, extra = '') => `<div class="opt ${on ? 'on' : ''}"><span class="rd ${on ? 'on' : ''}"></span><div style="flex:1"><b>${b}</b><span>${s}</span>${extra}</div></div>`;
add('Réception · 2/4 Qui apporte ?', `${sbar()}<div class="body">
  ${nav('Nouveau dépôt', stepT('2/4'))}
  <div class="who">${av('FN')}<div style="flex:1"><b>Fatou Ndiaye</b><span>BZ-4821 · Entrepôt</span></div></div>
  <div class="ttl">Qui apporte le colis ?</div>
  <div style="margin-top:6px">
  ${opt('Un transporteur', 'SF, YTO, ZTO… envoyé par un fournisseur', true)}
  ${opt('Le client lui-même', 'Il vient du marché avec ses achats')}
  ${opt('Quelqu\'un pour le client', 'Un parent, un employé, un agent')}
  ${opt('Bonzini est allé le chercher', 'Au marché ou chez le fournisseur')}
  </div>
  <div class="dock"><div class="btn">Continuer</div></div>
</div>${end}`);

// 15 · Réception · Fournisseur
add('Réception · 3/4 Fournisseur', `${sbar()}<div class="body">
  ${nav('Nouveau dépôt', `<span class="link" style="font-size:16px;margin-right:6px">Passer</span>${stepT('3/4')}`)}
  <div class="ttl">Qui a envoyé les colis ?</div>
  <div class="lbl">Déjà vus pour ce client</div>
  <div class="list">
    <div class="row" style="padding:12px 0"><span class="rd on"></span><div class="rm"><div class="rn">Guangzhou Hengtai Trading</div><div class="rs">Fournisseur · M. Huang</div></div></div>
    <div class="row" style="padding:12px 0"><span class="rd"></span><div class="rm"><div class="rn cn">广州鞋业 · Guangzhou Shoes</div><div class="rs">Agent d'achat</div></div></div>
  </div>
  <div class="lbl">Ou un nouveau</div>
  <div class="seg" style="margin-top:0"><span class="on">Fournisseur</span><span>Agent d'achat</span></div>
  <div class="inp hint cn" style="margin-top:10px">Société ou nom</div>
  <div class="two" style="margin-top:10px"><div class="inp hint">Contact</div><div class="inp hint">Téléphone</div></div>
  <div class="dock"><div class="btn">Continuer</div></div>
</div>${end}`);

// 16 · Réception · Dépôt terminé
add('Réception · Dépôt terminé', `${sbar()}<div class="body">
  <div style="padding-top:60px"><div class="done">${I.check}</div></div>
  <div style="text-align:center;padding:18px 20px 0"><div style="font:700 28px 'DM Sans'">Dépôt terminé</div><div style="font:400 16px 'DM Sans';color:#5A5A5A;margin-top:6px">RC-000419 · Fatou Ndiaye · reçu dans son app</div></div>
  <div class="box" style="margin-top:24px">
    <div class="kv">Colis<b>3</b></div>
    <div class="kv">Poids<b>62,4 kg</b></div>
    <div class="kv">Volume<b>0,84 m³</b></div>
    <div class="kv">Apporté par<b>Un transporteur</b></div>
    <div class="kv">Reçu par<b>Li Wei · 14:32</b></div>
  </div>
  <div class="dock" style="border:0"><div class="btn">Dépôt suivant</div><div class="btn soft">Imprimer les étiquettes</div></div>
</div>${end}`);

// 17 · Réception · En attente d'attribution
add('Réception · En attente', `${sbar()}<div class="body">
  ${nav('En attente d\'attribution')}
  <div class="hero"><div class="lab">Reçus sans client</div><div class="num">3 <small>colis</small></div><div class="sub"><span><b>2</b> dépôts</span><span>le plus ancien <b>7 j</b></span></div></div>
  <div class="list" style="margin-top:8px">
    ${row(photo(0), 'RC-000417', '2 colis · « Lin » · 16 oct.', `<div class="mini-btn">Attribuer</div>`)}
    ${row(photo(3), 'RC-000409', '1 colis · sans nom · 14 oct.', `<div class="mini-btn">Attribuer</div>`)}
  </div>
</div>${tabs('today', 'reception', { today: 2 })}${end}`);

// 18 · Réception · Carte client
add('Réception · Carte client', `${sbar()}<div class="body">
  ${nav('Client')}
  <div class="fiche">${av('FN')}<div class="nm">Fatou Ndiaye</div><div class="sub" style="margin-top:4px">+237 690 55 66 77</div></div>
  <div style="display:grid;justify-items:center;margin-top:16px">${qr(5).replace('class="qr"', 'class="qr" style="width:150px;height:150px;padding:8px"')}<div style="font:800 26px 'DM Sans';margin-top:10px;letter-spacing:.01em">BZ-4821</div></div>
  <div class="acts two"><div class="act"><div class="r ink">${J.plus('#F5F5F5')}</div>Nouveau dépôt</div><div class="act"><div class="r">${J.label()}</div>Étiquette</div></div>
  <div class="h2"><b>Ses dépôts</b></div>
  <div class="list">${row(avI(J.box()), 'RC-000418', '19 oct. · 3 colis · 62 kg', tg('t-ok', 'Terminé'))}</div>
</div>${tabs('cli', 'reception', { today: 2 })}${end}`);

// 19 · Réception · Paquet en cours
add('Réception · Paquet en cours', `${sbar()}<div class="body">
  ${nav('PQ-000234', dotsB)}
  <div class="fiche" style="padding-top:16px"><div class="big" style="margin-top:0">24,6 <small>kg</small></div><div class="sub">sur 32 kg · 7 colis · Bureau</div></div>
  <div style="padding:0 20px"><div class="gauge"><i style="width:77%"></i></div></div>
  <div class="search">${J.scan('#5A5A5A')}Scannez un colis</div>
  <div class="list" style="margin-top:6px">
    <div class="row">${photo(0)}<div class="rm"><div class="rn">RC-000420-01</div><div class="rs">Fatou Ndiaye · 6,2 kg</div></div><span class="link" style="font-size:15px">Retirer</span></div>
    <div class="row">${photo(2)}<div class="rm"><div class="rn">RC-000421-01</div><div class="rs">Aïcha Diallo · 3,4 kg</div></div><span class="link" style="font-size:15px">Retirer</span></div>
    <div class="row">${photo(1)}<div class="rm"><div class="rn">RC-000415-03</div><div class="rs">Rosine Tchoua · 8,0 kg</div></div><span class="link" style="font-size:15px">Retirer</span></div>
  </div>
  <div class="dock"><div class="btn">Fermer le paquet (pesée)</div></div>
</div>${end}`);

// 20 · Entrepôt · Quelle arrivée ?
add('Entrepôt · Quelle arrivée ?', `${sbar()}<div class="body">
  <div class="top"><div class="hello">Pointer</div><div class="icbtn">${J.scan()}</div></div>
  <div class="lbl">Quelle arrivée ?</div>
  <div class="list">
    ${row(carrier('maersk'), 'MIEU 3611115', 'Boîte · 86 colis · arrivée le 28 oct.', tg('t-todo', '25 à pointer'))}
    ${row(carrier('air'), 'LTA 071-4479 2210', 'Avion · paquets reçus 4 / 6', tg('t-todo', '12 à pointer'))}
    ${row(carrier('air'), 'LTA 235-1170 3318', 'Avion · 41 colis', tg('t-ok', 'Tout pointé'))}
  </div>
</div>${tabs('pointer', 'warehouse', { pointer: 25, hand: 4 })}${end}`);

// 21 · Entrepôt · Ce colis est-il là ?
add('Entrepôt · Ce colis est-il là ?', `${sbar()}<div class="body">
  ${nav('RC-000418-02', stepT('62/86'))}
  <div style="padding:18px 20px 0">${photo(1, 230, 353)}</div>
  <div style="padding:12px 20px 0;font:400 15px 'DM Sans';color:#5A5A5A">Photo prise à Guangzhou · Sacs à main · 21,0 kg</div>
  <div class="ttl" style="padding-top:14px">Ce colis est-il là ?</div>
  <div class="two" style="margin-top:0"><div><div class="lbl" style="padding-left:0">Rangée</div><div class="inp" style="margin:0">B3</div></div><div><div class="lbl" style="padding-left:0">Remarque</div><div class="inp hint" style="margin:0">Facultatif</div></div></div>
  <div class="dock" style="border:0"><div class="btn">Oui, en bon état</div><div class="duo" style="margin-top:10px"><div class="btn soft">Oui, mais abîmé</div><div class="btn soft">Non, il manque</div></div></div>
</div>${end}`);

// 22 · Entrepôt · Bilan du pointage
add('Entrepôt · Bilan du pointage', `${sbar()}<div class="body">
  ${nav('Bilan du pointage')}
  <div class="fiche" style="padding-top:18px"><div class="sub" style="margin:0">MIEU 3611115</div><div class="big" style="margin-top:8px">84 <small>sur 86 colis</small></div></div>
  <div class="g4">
    <div><span>En bon état</span><b>81</b></div>
    <div><span>Abîmés</span><b>3</b></div>
    <div><span>Manquants</span><b>0</b></div>
    <div><span>Jamais vus</span><b>2</b></div>
  </div>
  <div class="lbl">Jamais vus</div>
  <div class="list">
    <div class="row">${photo(3)}<div class="rm"><div class="rn">RC-000402-05</div><div class="rs">Aïcha Diallo · tissus</div></div></div>
    <div class="row">${photo(0)}<div class="rm"><div class="rn">RC-000398-01</div><div class="rs">Rosine Tchoua · chaussures</div></div></div>
  </div>
  <div class="dock"><div class="btn">Déclarer 2 manquants</div><div class="btn soft">Je continue à pointer</div></div>
</div>${end}`);

// 23 · Entrepôt · Qui attend ?
add('Entrepôt · Qui attend ?', `${sbar()}<div class="body">
  <div class="top"><div class="hello">Remettre</div><div class="icbtn">${J.scan()}</div></div>
  <div class="search">${I.search}Nom, BZ- ou RC-</div>
  <div class="lbl">Qui attend ses colis ?</div>
  <div class="list">
    ${row(av('FN'), 'Fatou Ndiaye', '3 colis · rangée B3', tg('t-ok', 'Payé'))}
    ${row(av('IT'), 'Ibrahim Touré', '5 colis · rangée C1', tg('t-todo', 'Reste 86 000'))}
    ${row(av('JM'), 'Jean-Paul Mbarga', '9 colis · rangée A2', tg('t-ok', 'Payé'))}
    ${row(av('RT'), 'Rosine Tchoua', '1 colis · rangée B1', tg('t-neu', 'Sans prix'))}
  </div>
</div>${tabs('hand', 'warehouse', { pointer: 25, hand: 4 })}${end}`);

// 24 · Entrepôt · Qui emporte ?
add('Entrepôt · Qui emporte ?', `${sbar()}<div class="body">
  ${nav('Remettre', stepT('3/3'))}
  <div class="who">${av('FN')}<div style="flex:1"><b>Fatou Ndiaye</b><span>3 colis · Payé</span></div></div>
  <div class="ttl">Qui emporte les colis ?</div>
  <div style="margin-top:6px">
  ${opt('Fatou elle-même', 'Pièce vue au guichet')}
  <div class="opt on" style="display:block"><div style="display:flex;gap:14px;align-items:center"><span class="rd on"></span><b>Quelqu'un d'autre</b></div>
    <div class="inp" style="margin:14px 0 0">Moussa Ndiaye</div>
    <div class="inp" style="margin:10px 0 0"><span class="pre">${cm}+237</span>677 45 12 09</div></div>
  </div>
  <div class="dock"><div class="btn">Faire signer</div></div>
</div>${end}`);
