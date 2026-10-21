/* ═══════════════ ÉQUIPE & VENTES ═══════════════ */
const roleRow = (n, s, on) => `<div class="row" style="padding:11px 0">${`<span class="rd ${on ? 'on' : ''}"></span>`}<div class="rm"><div class="rn">${n}</div><div class="rs">${s}</div></div></div>`;
add('Équipe · Nouvel accès · le rôle', `${sbar()}<div class="body">
  ${nav('Nouvel accès', stepT('1/2'))}
  <div class="list" style="margin-top:4px">
    ${roleRow('Opérations', 'Bureau · dépôts, paiements, taux, cargo')}
    ${roleRow('Chargé de clientèle', 'Bureau · clients, dépôts, messages')}
    ${roleRow('Support', 'Bureau · clients et messages')}
    ${roleRow('Trésorier', 'Bureau · USDT, comptes, inventaire')}
    ${roleRow('Commercial', 'Ventes · ses prospects et ses clients')}
    ${roleRow('Réceptionnaire', 'Guangzhou · réception des colis', true)}
    ${roleRow('Agent cash', 'Guangzhou · remise des espèces')}
    ${roleRow("Agent d'entrepôt", 'Douala · arrivées et remises')}
  </div>
  <div class="dock"><div class="btn">Continuer</div></div>
</div>${end}`);

add('Équipe · Nouvel accès · qui', `${sbar()}<div class="body">
  ${nav('Nouvel accès', stepT('2/2'))}
  <div class="who">${avI(J.box())}<div style="flex:1"><b>Réceptionnaire</b><span>Arrive sur Réception</span></div><span class="link" style="font-size:15px">Changer</span></div>
  <div class="lbl">Nom</div>
  <div class="two"><div class="inp">Li</div><div class="inp">Na</div></div>
  <div class="lbl">Email · pour se connecter</div>
  <div class="inp">lina@bonzinilabs.com</div>
  <div class="lbl">Téléphone</div>
  <div class="inp"><span class="pre">${cnf}+86</span>138 0261 5547</div>
  <div class="lbl">Site</div>
  <div class="chips wrap"><span class="chip on">Guangzhou · Bureau</span><span class="chip">Guangzhou · Entrepôt</span><span class="chip">${J.plus().replace('ic24', '').replace('<svg', '<svg width="16" height="16"')}Nouveau site</span></div>
  <div class="dock"><div class="btn">Créer l'accès</div></div>
</div>${end}`);

add('Équipe · Accès créé', `${sbar()}<div class="body">
  <div style="padding-top:70px"><div class="done">${I.check}</div></div>
  <div style="text-align:center;padding:18px 20px 0"><div style="font:700 28px 'DM Sans'">Accès créé</div><div style="font:400 16px 'DM Sans';color:#5A5A5A;margin-top:6px">Li Na · Réceptionnaire · Guangzhou</div></div>
  <div class="box" style="margin-top:24px">
    <div style="padding:16px;border-bottom:1px solid #D9D9D9;text-align:center"><div style="font:500 15px 'DM Sans';color:#5A5A5A">Mot de passe provisoire</div><div class="pwd" style="margin-top:6px">K7m-Q2x-91</div><div class="copy">${I.copy}Copier le message</div></div>
    <div class="kv">Email<b>lina@bonzinilabs.com</b></div>
    <div class="kv">Arrive sur<b>Réception</b></div>
  </div>
  <div class="dock" style="border:0"><div class="btn">Partager le message</div><div class="btn soft">Voir sa fiche</div></div>
</div>${end}`);

const membre = `${nav('Membre', dotsB)}
  <div class="fiche">${av('BO')}<div class="nm">Brice Onana</div><div class="sub" style="margin-top:4px">brice@bonzinilabs.com</div></div>
  <div class="acts three">
    <div class="act"><div class="r ink">${J.phone('#F5F5F5')}</div>Appeler</div>
    <div class="act"><div class="r" style="background:#25D366">${J.wa('#fff')}</div>WhatsApp</div>
    <div class="act"><div class="r">${J.key()}</div>Mot de passe</div>
  </div>
  <div class="box">
    <div class="kv">Rôle<b>Commercial</b></div>
    <div class="kv">Site<b>Douala</b></div>
    <div class="kv">Fiche commercial<b>Brice Onana</b></div>
  </div>`;
add('Équipe · Membre · menu « … »', `${sbar()}<div class="body">${membre}
  ${sheet(`<h3>Brice Onana</h3>
    <div style="margin-top:8px">
      <div class="srow">${J.pen()}Modifier<span class="x">nom, numéros, site</span></div>
      <div class="srow">${J.swap()}Changer de rôle</div>
      <div class="srow">${J.link()}Changer de fiche commercial</div>
      <div class="srow">${J.chart()}Ses chiffres et objectifs</div>
      <div class="srow">${J.shield()}Agrément CAD<span class="x">commissionnaire</span></div>
    </div>`)}
</div>${endS}`);

add('Équipe · Changer de rôle', `${sbar()}<div class="body">
  ${nav('Changer de rôle')}
  <div class="who">${av('BO')}<div style="flex:1"><b>Brice Onana</b><span>Commercial · Douala</span></div></div>
  <div class="list" style="margin-top:6px">
    ${roleRow('Commercial', 'Rôle actuel')}
    ${roleRow('Chargé de clientèle', 'Clients, dépôts, messages', true)}
    ${roleRow('Support', 'Clients et messages')}
    ${roleRow('Opérations', 'Dépôts, paiements, taux, cargo')}
  </div>
  <div class="box"><div class="kv">Sa fiche commercial<b>Gardée, archivée</b></div><div class="kv">Ses 12 prospects<b>À confier</b></div></div>
  <div class="dock"><div class="btn">Passer chargé de clientèle</div></div>
</div>${end}`);

add('Équipe · Agrément du commissionnaire', `${sbar()}<div class="body">
  ${nav('Membre', dotsB)}
  <div class="fiche">${av('HN')}<div class="nm">Hélène Ngando</div><div class="sub" style="margin-top:4px">Commissionnaire agréé (CAD)</div></div>
  ${sheet(`<h3>Agrément CAD</h3><p>Exigé pour signer un classement</p>
    <div class="lbl">Société</div><div class="inp">Transit Ngando SARL</div>
    <div class="lbl">N° d'agrément</div><div class="inp">CAD 0417 / MINFI</div>
    <div class="lbl">Représentant</div><div class="inp">Hélène Ngando</div>
    <div class="seg" style="margin:16px 0 0"><span class="on">Actif</span><span>Suspendu</span></div>
    <div class="btn" style="margin-top:18px">Enregistrer</div>`)}
</div>${endS}`);

add('Ventes · Un commercial', `${sbar()}<div class="body">
  ${nav('Brice Onana', dotsB)}
  <div class="hero" style="margin-top:14px"><div class="lab" style="display:flex;justify-content:space-between"><span>Paiements de ses clients</span><span style="font:600 15px 'DM Sans';color:#1E1E1E;display:flex;align-items:center;gap:4px">Octobre ${J.down}</span></div>
    <div class="num">18,2 M <small>XAF</small></div>
    <div class="bar"><i style="width:73%"></i></div>
    <div class="sub" style="justify-content:space-between;align-items:center"><span><b>73 %</b> de 25 M</span><span class="tag t-ok" style="margin:0">Dans le rythme</span></div></div>
  <div class="acts three">
    <div class="act"><div class="r ink">${J.target('#F5F5F5')}</div>Objectifs</div>
    <div class="act"><div class="r">${J.phone()}</div>Appeler</div>
    <div class="act"><div class="r">${J.key()}</div>Son accès</div>
  </div>
  <div class="h2"><b>Ses prospects</b></div>
  <div class="chips"><span class="chip on">En cours 12</span><span class="chip">À vérifier 1</span><span class="chip">Clients 9</span><span class="chip">Perdus 3</span></div>
  <div class="list" style="margin-top:4px">
    ${row(av('PK'), 'Paul Kamga', 'Ets Kamga & Fils · Douala', tg('t-todo', 'Aujourd\'hui'))}
    ${row(av('CE'), 'Carine Eyenga', 'Eyenga Cosmétiques · Yaoundé', tg('t-bad', 'Hier'))}
  </div>
</div>${end}`);

const objRow = (n, done, v, u = '') => `<div class="row"><div class="rm"><div class="rn">${n}</div><div class="rs">Réalisé ${done}</div></div><div class="inp" style="margin:0;width:132px;min-height:48px;justify-content:flex-end;font-weight:700">${v}${u ? `<span style="font:500 15px 'DM Sans';color:#5A5A5A">${u}</span>` : ''}</div></div>`;
add('Ventes · Objectifs du mois', `${sbar()}<div class="body">
  ${nav('Objectifs · Brice')}
  <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px 4px">${I.back.replace('width="28" height="28"', 'width="24" height="24"')}<b style="font:600 18px 'DM Sans'">Octobre 2026</b><span style="transform:scaleX(-1);display:grid">${I.back.replace('width="28" height="28"', 'width="24" height="24"')}</span></div>
  <div class="list">
    ${objRow('Paiements', '18,2 M', '25 M', 'XAF')}
    ${objRow('Nouveaux clients', '3', '4')}
    ${objRow('Fret avion', '212 kg', '300', 'kg')}
    ${objRow('Bateau', '7,4 m³', '12', 'm³')}
    ${objRow('Prospects ajoutés', '14', '20')}
    ${objRow('Prospects convertis', '3', '5')}
  </div>
  <div class="dock"><div class="btn">Enregistrer</div></div>
</div>${end}`);

add('Ventes · Sources des clients', `${sbar()}<div class="body">
  ${nav('Sources des clients', icB(J.plus()))}
  <div class="hero"><div class="lab" style="display:flex;justify-content:space-between"><span>Clients au total</span><span style="font:600 15px 'DM Sans';color:#1E1E1E;display:flex;align-items:center;gap:4px">Octobre ${J.down}</span></div>
    <div class="num">412</div><div class="sub"><span><b>38</b> nouveaux</span><span><b>27</b> sans origine</span></div></div>
  <div class="chips"><span class="chip on">Toutes</span><span class="chip">Commercial</span><span class="chip">Recommandation</span><span class="chip">Réseaux</span></div>
  <div class="list" style="margin-top:4px">
    ${row(av('BO'), 'Brice Onana', 'Commercial · +9 ce mois', amt('61', rs('clients')))}
    ${row(avI(J.globe()), 'Facebook', 'Réseaux sociaux · +11', amt('84', rs('clients')))}
    ${row(av('SN'), 'Samuel Nkoulou', 'Recommandation · +2', amt('14', rs('clients')))}
    ${row(avI(J.flag()), 'Foire de Douala 2026', 'Événement · +5', amt('23', rs('clients')))}
    ${row(av('?'), 'Inconnues', 'À compléter sur chaque fiche', amt('27', rs('clients')))}
  </div>
</div>${end}`);

add('Ventes · Une source', `${sbar()}<div class="body">
  ${nav('Source', dotsB)}
  <div class="fiche">${av('SN')}<div class="nm">Samuel Nkoulou</div><div class="sub" style="margin-top:4px">Recommandation · +237 677 88 99 00</div></div>
  <div class="g4">
    <div><span>Clients apportés</span><b>14</b></div>
    <div><span>Dépôts validés</span><b>38,6 M</b></div>
    <div><span>Paiements</span><b>35,1 M</b></div>
    <div><span>Colis déposés</span><b>212</b></div>
  </div>
  <div class="h2"><b>Ses clients</b></div>
  <div class="list">
    ${row(av('RT'), 'Rosine Tchoua', 'BZ-4477 · depuis juin', amt('4,2 M', rs('payés')))}
    ${row(av('DT'), 'Didier Tagne', 'BZ-5230 · depuis août', amt('2,8 M', rs('payés')))}
    ${row(av('YS'), 'Yasmine Sali', 'BZ-5598 · depuis sept.', amt('0', rs('payés')))}
  </div>
</div>${end}`);

add('Ventes · Nouvelle source', `${sbar()}<div class="body">
  ${nav('Sources des clients', icB(J.plus()))}
  <div class="hero"><div class="lab">Clients au total</div><div class="num">412</div></div>
  ${sheet(`<h3>Nouvelle source</h3>
    <div class="lbl">Type</div>
    <div class="tiles"><div class="tl">Commercial</div><div class="tl on">Recomman&shy;dation</div><div class="tl">Réseaux sociaux</div><div class="tl">En ligne</div><div class="tl">Événement</div><div class="tl">Autre</div></div>
    <div class="lbl">Nom</div><div class="inp">Aïcha Diallo</div>
    <div class="lbl">Téléphone (facultatif)</div><div class="inp"><span class="pre">${cm}+237</span><span style="color:#757575;font-weight:400">6XX XX XX XX</span></div>
    <div class="btn" style="margin-top:18px">Ajouter</div>`)}
</div>${endS}`);
