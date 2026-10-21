/* ═══════════════ RÉGLAGES & PROFIL ═══════════════ */
const faceId = '<svg class="face" viewBox="0 0 96 96"><path d="M8 30V18A10 10 0 0 1 18 8h12M66 8h12a10 10 0 0 1 10 10v12M88 66v12a10 10 0 0 1-10 10H66M30 88H18A10 10 0 0 1 8 78V66" fill="none" stroke="#1E1E1E" stroke-width="5" stroke-linecap="round"/><path d="M33 36v6M63 36v6M48 38v16h-4M36 64c7 6 17 6 24 0" fill="none" stroke="#1E1E1E" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
add('Connexion', `${sbar()}<div class="body">
  <div style="padding:70px 20px 0"><div class="brand">BONZINI HQ</div><div style="font:700 30px 'DM Sans';letter-spacing:-.02em;margin-top:28px">Connexion</div></div>
  <div class="lbl" style="padding-top:26px">Email</div>
  <div class="inp">nelson@bonzinilabs.com</div>
  <div class="lbl">Mot de passe</div>
  <div class="inp" style="letter-spacing:.2em">••••••••••••<span style="margin-left:auto;letter-spacing:0">${J.eye()}</span></div>
  <div class="dock" style="border:0"><div class="btn">Se connecter</div><div class="btn soft">Face ID</div></div>
</div>${end}`);

add('Verrou Face ID', `${sbar()}<div class="body">
  <div style="padding-top:190px;display:grid;justify-items:center;text-align:center">${faceId}
    <div style="font:700 26px 'DM Sans';margin-top:28px">BONZINI HQ</div><div style="font:400 16px 'DM Sans';color:#5A5A5A;margin-top:6px">Nelson · verrouillée</div></div>
  <div class="dock" style="border:0"><div class="btn">Déverrouiller avec Face ID</div><div class="btn soft">Se déconnecter</div></div>
</div>${end}`);

add('Moi · Mon profil', `${sbar()}<div class="body">
  ${nav('Mon profil')}
  <div class="fiche">${av('N', 'style="width:88px;height:88px;border-radius:44px;font-size:30px;margin:0 auto"')}<div class="copy" style="margin-top:14px">${J.cam().replace('class="ic24"', 'width="16" height="16"')}Changer la photo</div></div>
  <div class="lbl">Prénom</div><div class="inp">Nelson</div>
  <div class="lbl">Nom</div><div class="inp">Kamdem</div>
  <div class="lbl">Email · connexion</div><div class="inp lock">nelson@bonzinilabs.com<span style="margin-left:auto">${J.lock('#757575')}</span></div>
  <div class="dock"><div class="btn">Enregistrer</div></div>
</div>${end}`);

add('Moi · Mot de passe', `${sbar()}<div class="body">
  ${nav('Mot de passe')}
  <div class="lbl">Nouveau mot de passe</div>
  <div class="inp" style="letter-spacing:.2em">••••••••••••<span style="margin-left:auto;letter-spacing:0">${J.eye()}</span></div>
  <div class="okline">${J.okc}10 caractères ou plus</div>
  <div class="lbl">Encore une fois</div>
  <div class="inp" style="letter-spacing:.2em">••••••••••••</div>
  <div class="okline">${J.okc}Les deux sont identiques</div>
  <div class="dock"><div class="btn">Enregistrer</div></div>
</div>${end}`);

add('Moi · Clés d\'accès', `${sbar()}<div class="body">
  ${nav('Clés d\'accès')}
  <div class="list" style="margin-top:6px">
    ${row(avI(J.mobile()), 'iPhone de Nelson', 'Créée le 3 sept. · aujourd\'hui', '<span class="link" style="font-size:15px">Révoquer</span>')}
    ${row(avI(J.laptop()), 'MacBook Air', 'Créée le 12 août · il y a 2 j', '<span class="link" style="font-size:15px">Révoquer</span>')}
  </div>
  <div class="dock"><div class="btn">Ajouter cet appareil</div></div>
</div>${end}`);

add('Moi · Mise à jour', `${sbar()}<div class="body">
  ${nav('Mise à jour')}
  <div class="fiche" style="padding-top:40px"><div class="logo" style="background:#F5F5F5;width:72px;height:72px;border-radius:36px">${J.refresh()}</div><div class="big">3.2.1</div><div class="sub">Prête à installer · 4 Mo</div>${tg('t-todo', 'Nouvelle version')}</div>
  <div class="box"><div class="kv">Installée<b>3.2.0 (418)</b></div><div class="kv">Nouveautés<b>Lots de paiements</b></div></div>
  <div class="dock"><div class="btn">Redémarrer pour installer</div></div>
</div>${end}`);

add('Réglages · Adresses en Chine', `${sbar()}<div class="body">
  ${nav('Adresses en Chine')}
  <div class="seg"><span class="on">Bateau · entrepôt</span><span>Avion · bureau</span></div>
  <div class="lbl"><span class="cn">Destinataire · 收件人</span></div><div class="inp">Tina</div>
  <div class="lbl">Adresse en chinois</div><div class="inp area cn" style="min-height:76px">广州市白云区永兴物流园 B 栋 12 号</div>
  <div class="lbl">Adresse en anglais</div><div class="inp">B12, Yongxing Logistics Park, Baiyun</div>
  <div class="two" style="margin-top:10px"><div class="inp">138 2716 4410</div><div class="inp">WeChat tina_bz</div></div>
  <div class="dock"><div class="btn">Enregistrer</div></div>
</div>${end}`);

add('Réglages · Tarifs cargo', `${sbar()}<div class="body">
  ${nav('Tarifs cargo')}
  <div class="lbl" style="padding-top:26px">Bateau · au mètre cube</div>
  <div class="field">165 000<small>XAF / m³</small></div>
  <div class="note" style="color:#5A5A5A">Carton 60 × 40 × 40 cm = 15 840 XAF</div>
  <div class="lbl" style="padding-top:28px">Avion · au kilo</div>
  <div class="field">8 500<small>XAF / kg</small></div>
  <div class="note" style="color:#5A5A5A">Colis de 8,4 kg = 71 400 XAF</div>
  <div class="dock"><div class="btn">Enregistrer</div></div>
</div>${end}`);
