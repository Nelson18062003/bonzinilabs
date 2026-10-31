/* ═══════════════ MESSAGES CLIENTS · MOLA · VEILLE ═══════════════ */
const bars = [[22, 14], [30, 21], [26, 18], [41, 30], [35, 26], [12, 8], [18, 11]];
add('Messages · Statistiques', `${sbar()}<div class="body">
  ${nav('Statistiques')}
  <div class="seg three"><span class="on">7 j</span><span>14 j</span><span>30 j</span></div>
  <div class="hero"><div class="lab">Temps de réponse moyen</div><div class="num">6 <small>min</small></div><div class="sub"><span>Médian <b>3 min</b></span></div></div>
  <div class="g3"><div><span>Ouvertes</span><b>14</b></div><div><span>Messages</span><b>1 286</b></div><div><span>À prendre</span><b>2</b></div></div>
  <div class="lbl" style="padding-bottom:12px">Volume quotidien</div>
  <div class="chart">${bars.map(([c, b]) => `<div class="c"><i class="g" style="height:${b * 2.2}px"></i><i class="k" style="height:${c * 2.2}px"></i></div>`).join('')}</div>
  <div class="cx">${['mer', 'jeu', 'ven', 'sam', 'dim', 'lun', 'mar'].map((d) => `<span>${d}</span>`).join('')}</div>
  <div class="leg"><span><i style="background:#2C2C2C"></i>Client</span><span><i style="background:#B3B3B3"></i>Bonzini</span></div>
  <div class="h2"><b>Qui répond le plus</b></div>
  <div class="list">
    ${row(av('ME'), 'Mireille Ekambi', 'Médian 2 min', amt('412', rs('réponses')))}
  </div>
</div>${end}`);

const rt = (t, c) => `<div class="row"><div class="rm"><div class="rn">${t}</div><div class="rs">${c}</div></div><div class="handle"><i></i><i></i><i></i></div></div>`;
add('Messages · Réponses types', `${sbar()}<div class="body">
  ${nav('Réponses types', icB(J.plus()))}
  <div class="list" style="margin-top:6px">
    ${rt('Dépôt reçu', 'Bonjour {prénom}, nous avons bien reçu votre dépôt…')}
    ${rt('Paiement effectué', 'Bonjour {prénom}, votre fournisseur a reçu {montant}…')}
    ${rt('Taux du jour', 'Aujourd\'hui, 1 000 000 XAF = ¥ 10 838…')}
    ${rt('Preuve illisible', 'Bonjour {prénom}, la photo du reçu est floue…')}
    ${rt('Adresse de l\'entrepôt', 'Notre entrepôt à Guangzhou : 广州市白云区…')}
  </div>
</div>${end}`);

add('Messages · Modifier une réponse', `${sbar()}<div class="body">
  ${nav('Réponse type', icB(J.trash()))}
  <div class="lbl">Libellé</div><div class="inp">Dépôt reçu</div>
  <div class="lbl">Texte</div>
  <div class="inp area" style="min-height:120px">Bonjour {prénom}, nous avons bien reçu votre dépôt de {montant}. Il est crédité sur votre compte.</div>
  <div class="chips" style="padding-top:10px"><span class="chip">{prénom}</span><span class="chip">{montant}</span><span class="chip">{référence}</span></div>
  <div class="lbl">Aperçu</div>
  <div class="bub">Bonjour Fatou, nous avons bien reçu votre dépôt de 850 000 XAF. Il est crédité sur votre compte.</div>
  <div class="dock"><div class="btn">Enregistrer</div></div>
</div>${end}`);

const qrow = (t, c, on = true) => `<div class="row"><div class="rm"><div class="rn"${on ? '' : ' style="color:#757575"'}>${t}</div><div class="rs">${c}</div></div><span class="sw${on ? '' : ' off'}"></span></div>`;
add('Messages · Suggestions aux nouveaux clients', `${sbar()}<div class="body">
  ${nav('Suggestions', icB(J.plus()))}
  <div class="list" style="margin-top:6px">
    ${qrow('Comment ça marche ?', 'Pouvez-vous m\'expliquer comment fonctionne…')}
    ${qrow('Mon paiement est en retard', 'Mon paiement semble en retard, pouvez-vous…')}
    ${qrow('Question sur les taux', 'J\'ai une question sur les taux de change…')}
    ${qrow('Autre question', 'Bonjour, j\'ai une question :', false)}
  </div>
  <div class="lbl">Ce que voit le client</div>
  <div class="chips wrap"><span class="chip" style="background:#fff;border:1px solid #D9D9D9">Comment ça marche ?</span><span class="chip" style="background:#fff;border:1px solid #D9D9D9">Mon paiement est en retard</span><span class="chip" style="background:#fff;border:1px solid #D9D9D9">Question sur les taux</span></div>
</div>${end}`);

add('Mola · Conversations', `${sbar()}<div class="body">
  ${nav('Mola', icB(J.plus()))}
  <div class="fiche" style="padding-top:18px"><div class="logo" style="width:72px;height:72px;border-radius:36px;border:1px solid #D9D9D9"><img src="../mola-mascot.png"></div></div>
  <div class="lbl">Aujourd'hui</div>
  <div class="list">
    ${row(avI(J.coin()), 'Crédit 500 000 · Fatou', '10:42 · action confirmée', tg('t-ok', 'Fait'))}
    ${row(avI(J.ship()), 'Où en sont mes conteneurs ?', '08:15 · 6 en mer', J.chev)}
  </div>
  <div class="lbl">Cette semaine</div>
  <div class="list">
    ${row(avI(J.chart()), 'Volume de la semaine ?', 'Lun. · 184 M XAF payés', J.chev)}
    ${row(avI(J.coin()), 'Annuler BZ-PY-2610-0371', 'Dim. · action annulée', tg('t-neu', 'Annulé'))}
  </div>
  <div class="dock"><div class="btn">Nouvelle conversation</div></div>
</div>${end}`);

const mk = (n, v, d, c) => row(avI(`<span style="font:700 13px 'DM Sans'">${c}</span>`), n, d, amt(v));
add('Veille macro', `${sbar()}<div class="body">
  ${nav('Veille macro')}
  <div class="hero"><div class="lab">USD/CNY · demain</div><div class="num">7,118</div><div class="sub" style="align-items:center"><span>Confiance <b>72 %</b></span>${tg('t-neu', 'Garder le taux').replace('class="tag', 'style="margin:0" class="tag')}</div></div>
  <div class="list" style="margin-top:8px">
    ${mk('Brent', '82,40 $', '+0,8 % · 24 h', 'BR')}
    ${mk('WTI', '78,15 $', '+0,6 % · 24 h', 'WTI')}
    ${mk('DXY', '104,2', '−0,1 % · 24 h', 'DXY')}
    ${mk('EUR/USD', '1,0862', '+0,2 % · 24 h', '€/$')}
    ${mk('USD/CNY', '7,1204', '−0,05 % · 24 h', '¥/$')}
    ${mk('BTC', '67 420 $', '+1,9 % · 24 h', '₿')}
  </div>
</div>${end}`);
