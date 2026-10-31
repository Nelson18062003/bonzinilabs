/* ═══════════════ COMMERCIAL ═══════════════ */
const callBtns = `<div style="display:flex;gap:8px"><div class="rbtn">${J.phone()}</div><div class="rbtn">${J.wa('#1E1E1E')}</div></div>`;
add('Commercial · Mes clients', `${sbar()}<div class="body">
  <div class="top"><div class="hello">Mes clients</div><div class="icbtn">${I.search}</div></div>
  <div class="hero"><div class="lab" style="display:flex;justify-content:space-between"><span>Paiements · 9 clients</span><span style="font:600 15px 'DM Sans';color:#1E1E1E;display:flex;align-items:center;gap:4px">Octobre ${J.down}</span></div>
    <div class="num">18,2 M <small>XAF</small></div><div class="sub"><span><b>7</b> actifs</span><span><b>212</b> kg avion</span><span><b>7,4</b> m³</span></div></div>
  <div class="list" style="margin-top:8px">
    ${row(av('SN'), 'Samuel Nkoulou', 'BZ-3307 · 6,1 M ce mois', callBtns)}
    ${row(av('FN'), 'Fatou Ndiaye', 'BZ-4821 · 4,8 M ce mois', callBtns)}
    ${row(av('JM'), 'Jean-Paul Mbarga', 'BZ-2290 · 3,9 M ce mois', callBtns)}
    ${row(av('RT'), 'Rosine Tchoua', 'BZ-4477 · 0 ce mois', callBtns)}
  </div>
</div>${tabs('cli', 'commercial', { target: 3 })}${end}`);

const prospect = `${nav('Prospect', dotsB)}
  <div class="fiche">${av('PK')}<div class="nm">Paul Kamga</div><div class="sub" style="margin-top:4px">Ets Kamga & Fils · Douala</div></div>
  <div class="acts three">
    <div class="act"><div class="r ink">${J.phone('#F5F5F5')}</div>Appeler</div>
    <div class="act"><div class="r" style="background:#25D366">${J.wa('#fff')}</div>WhatsApp</div>
    <div class="act"><div class="r">${J.idc()}</div>Compléter</div>
  </div>`;
add('Commercial · Prospect · marquer perdu', `${sbar()}<div class="body">${prospect}
  ${sheet(`<h3>Paul Kamga est perdu ?</h3>
    <div class="lbl">Pourquoi</div>
    <div class="chips wrap" style="gap:8px"><span class="chip">Prix trop élevé</span><span class="chip on">A déjà un prestataire</span><span class="chip">Ne répond plus</span><span class="chip">N'importe pas</span><span class="chip">Autre</span></div>
    <div class="lbl">Précisez</div>
    <div class="inp area">Travaille avec un agent à Yiwu depuis 2023</div>
    <div class="btn" style="margin-top:18px">Marquer perdu</div>
    <p style="text-align:center;margin-top:12px">Il pourra être rouvert</p>`)}
</div>${endS}`);

add('Commercial · Nouveau prospect 7/7', `${sbar()}<div class="body">
  ${nav('Nouveau prospect', stepT('7/7'))}
  <div class="steps">${'<i class="on"></i>'.repeat(7)}</div>
  <div class="ttl">Tout est bon ?</div>
  <div class="box">
    <div class="kv">Identité<b>Paul Kamga · Ets Kamga</b></div>
    <div class="kv">WhatsApp<b style="display:flex;gap:6px;align-items:center">+237 699 12 34 56 ${J.okc}</b></div>
    <div class="kv">Activité<b>Quincaillerie · Douala</b></div>
    <div class="kv">Problèmes<b>Paiements lents</b></div>
    <div class="kv">Aide<b>Alipay, groupage</b></div>
    <div class="kv">La suite<b>Relancer le 24 oct.</b></div>
  </div>
  <div class="okline" style="margin-top:14px">${J.okc}Numéro libre · pas encore client</div>
  <div class="dock"><div class="btn">Enregistrer le prospect</div></div>
</div>${end}`);

add('Commercial · Plus', `${sbar()}<div class="body">
  <div class="top"><div class="hello">Plus</div></div>
  <div class="who" style="margin-top:10px">${av('BO')}<div style="flex:1"><b>Brice Onana</b><span>Commercial · Moi</span></div>${J.chev}</div>
  <div class="list" style="margin-top:10px">
    <div class="srow">${J.lock()}Mon mot de passe${J.chev.replace('class="chev"', 'class="chev" style="margin-left:auto"')}</div>
    <div class="srow">${J.globe()}Langue<span class="x">Français</span>${J.chev}</div>
    <div class="srow">${I.bell}Notifications<span class="x">2 sur 2</span>${J.chev}</div>
    <div class="srow">${J.out()}Se déconnecter</div>
  </div>
</div>${tabs('more', 'commercial', { target: 3 })}${end}`);
