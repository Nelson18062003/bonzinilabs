/* ═══════════════ DOUANE ═══════════════ */
add('Douane · Relecture d\'une DAU', `${sbar()}<div class="body">
  ${nav('Relecture de la DAU', dotsB)}
  <div class="who">${av('SN')}<div style="flex:1"><b>Samuel Nkoulou</b><span>DAU 118452 · payée le 6 oct.</span></div></div>
  <div class="hero"><div class="lab">Enjeu estimé par le moteur</div><div class="num">1 284 000 <small>XAF</small></div><div class="sub" style="align-items:center">Le moteur propose ${tg('t-ok', 'Réclamable').replace('class="tag', 'style="margin:0" class="tag')}</div></div>
  <div style="display:flex;gap:10px;padding:14px 20px 0">${['DAU', 'Facture', 'BL'].map((t) => `<div class="tl" style="flex:1;gap:4px">${J.doc()}<small style="margin:0">${t}</small></div>`).join('')}</div>
  <div class="lbl">Montant récupérable</div>
  <div class="field" style="height:56px;font-size:26px">1 120 000<small>XAF</small></div>
  <div class="chips"><span class="chip">Réclamable · 1,28 M</span><span class="chip">Reclasser · 1,65 M</span></div>
  <div class="lbl">Votre avis au client</div>
  <div class="inp area" style="min-height:76px">Demande de remboursement à la DGD, 3 mois, facture et DAU.</div>
  <div class="dock"><div class="btn">Rendre l'avis</div></div>
</div>${end}`);

add('Douane · Veille', `${sbar()}<div class="body">
  ${nav('Veille douane', icB(J.plus()))}
  <div class="seg"><span>Réglementation 3</span><span class="on">Perturbations 3</span></div>
  <div class="list" style="margin-top:6px">
    ${row(avI(J.anchor()), 'Port de Douala saturé', 'Retard ≈ 4 j · depuis le 14 oct.', tg('t-bad', 'Fort'))}
    ${row(avI(J.truck()), 'Grève Douala – N\'Djamena', 'Corridor · retard ≈ 2 j', tg('t-todo', 'Moyen'))}
    ${row(avI(J.ship()), 'Escale de Lomé allongée', 'Lomé · retard ≈ 1 j', tg('t-neu', 'Brouillon'))}
  </div>
  <div class="okline" style="margin-top:14px"><span class="link">Voir les avis terminés (5)</span></div>
</div>${end}`);

add('Douane · Publier un avis', `${sbar()}<div class="body">
  ${nav('Publier un avis')}
  <div class="seg"><span>Réglementation</span><span class="on">Perturbation</span></div>
  <div class="lbl">Titre</div><div class="inp">Congestion au port de Douala</div>
  <div class="lbl">Gravité</div>
  <div class="tiles"><div class="tl">Faible</div><div class="tl">Moyen</div><div class="tl on">Fort</div></div>
  <div class="two" style="margin-top:0"><div><div class="lbl" style="padding-left:0">Retard (jours)</div><div class="inp" style="margin:0">4</div></div><div><div class="lbl" style="padding-left:0">Depuis</div><div class="inp" style="margin:0">14 oct.</div></div></div>
  <div class="lbl">Lieux · codes SH visés</div><div class="inp">Douala · tous</div>
  <div class="okline" style="margin-top:14px">${J.plus()}Résumé, à faire, source, fin</div>
  <div class="dock"><div class="btn">Publier · 12 clients prévenus</div><div class="btn soft">Enregistrer en brouillon</div></div>
</div>${end}`);

const avis = `${nav('Avis', dotsB)}
  <div style="padding:20px 20px 0"><div style="display:flex;gap:8px">${tg('t-bad', 'Fort').replace('class="tag', 'style="margin:0" class="tag')}${tg('t-neu', 'Perturbation').replace('class="tag', 'style="margin:0" class="tag')}</div>
    <div style="font:700 26px/1.2 'DM Sans';letter-spacing:-.02em;margin-top:12px">Congestion au port de Douala</div></div>
  <div class="box">
    <div class="kv">Retard<b>≈ 4 jours</b></div>
    <div class="kv">Depuis<b>14 oct.</b></div>
    <div class="kv">Source<b>PAD · confiance moyenne</b></div>
    <div class="kv">À faire<b>Prévoir la franchise</b></div>
  </div>
  <div class="h2"><b>Conteneurs touchés · 3</b></div>
  <div class="list">
    ${row(carrier('maersk'), 'MIEU 3611115', 'Groupage · 28 oct.', tg('t-bad', '+4 j'))}
    ${row(carrier('msc'), 'MSCU 4417092', 'Samuel Nkoulou · 3 nov.', tg('t-bad', '+2 j'))}
  </div>`;
add('Douane · Avis · menu « … »', `${sbar()}<div class="body">${avis}
  ${sheet(`<h3>Congestion au port de Douala</h3><p>12 clients prévenus</p>
    <div style="margin-top:8px">
      <div class="srow">${J.pen()}Corriger</div>
      <div class="srow">${J.share()}Partager le lien</div>
      <div class="srow">${J.box()}Retirer l'avis<span class="x">republiable</span></div>
    </div>`)}
</div>${endS}`);

add('Douane · Routes et délais', `${sbar()}<div class="body">
  ${nav('Routes et délais', icB(J.share()))}
  <div class="seg"><span class="on">Mer</span><span>Avion</span></div>
  <div class="two" style="margin-top:10px"><div class="inp">${cnf}Nansha</div><div class="inp">${cm}Douala</div></div>
  <div class="hero"><div class="lab">De l'usine du fournisseur à Douala</div><div class="num">38 à 52 <small>jours</small></div><div class="sub"><span>≈ <b>18 900</b> km</span><span><b>1,2 t</b> CO₂e</span></div></div>
  <div class="okline" style="font-weight:500;color:#303030">${J.okc}Mesuré sur 23 expéditions : 41 j</div>
  <div class="lbl">Étape par étape</div>
  <div class="list">
    <div class="row" style="padding:10px 0"><div class="st">${J.factory()}</div><div class="rm"><div class="rn">Enlèvement à l'usine</div></div><b style="font:600 15px 'DM Sans'">J+1 à 3</b></div>
    <div class="row" style="padding:10px 0"><div class="st">${J.anchor()}</div><div class="rm"><div class="rn">Au port de Nansha</div></div><b style="font:600 15px 'DM Sans'">J+3 à 7</b></div>
    <div class="row" style="padding:10px 0"><div class="st">${J.ship()}</div><div class="rm"><div class="rn">En mer jusqu'à Douala</div></div><b style="font:600 15px 'DM Sans'">J+35 à 45</b></div>
    <div class="row" style="padding:10px 0"><div class="st">${J.shield()}</div><div class="rm"><div class="rn">Port et dédouanement</div></div><b style="font:600 15px 'DM Sans'">J+38 à 52</b></div>
  </div>
</div>${end}`);
