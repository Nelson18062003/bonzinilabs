/* ═══════════════ CLIENTS ═══════════════ */
add('Clients · Découvert', `${sbar()}<div class="body">${fatou}
  ${sheet(`<h3>Découvert autorisé</h3><p>Fatou Ndiaye · aujourd'hui 500 000</p>
    <div class="lbl">Nouveau plafond</div>
    <div class="tiles two"><div class="tl">500 000</div><div class="tl on">1 000 000</div><div class="tl">2 000 000</div><div class="tl">5 000 000</div></div>
    <div class="inp hint" style="margin-top:10px">Montant libre (XAF)</div>
    <div class="box" style="margin:14px 0 0"><div class="kv">Solde plancher<b>−1 000 000 XAF</b></div></div>
    <div class="lbl">Motif</div>
    <div class="inp">Facture fournisseur urgente</div>
    <div class="btn" style="margin-top:16px">Enregistrer le plafond</div>
    <div class="redt">Retirer le découvert</div>`, 30)}
</div>${endS}`);

add('Clients · Étiquette colis', `${sbar()}<div class="body">
  ${nav('Étiquette colis', icB(J.share()))}
  <div class="seg"><span class="on">Bateau</span><span>Avion</span></div>
  <div class="paper">
    <div class="hd"><span>BONZINI LABS · SEA</span><span class="cn">海运</span></div>
    <div style="display:flex;gap:14px;align-items:center;margin-top:14px">${qr(5).replace('class="qr"', 'class="qr q"')}<div><div class="code">BZ-4821</div><div style="font:600 17px 'DM Sans';margin-top:8px">Fatou Ndiaye</div><div style="font:400 15px 'DM Sans';color:#5A5A5A">Douala · Cameroun</div></div></div>
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid #D9D9D9">
      <div class="cn" style="font:400 14px 'DM Sans';color:#5A5A5A">收件人 · Destinataire</div>
      <div class="cn" style="font:600 16px 'DM Sans'">Tina · 138 2716 4410</div>
      <div class="zh cn" style="margin-top:6px">广州市白云区太和镇永兴村物流园 B 栋 12 号 · Bonzini 仓库</div>
    </div>
    <div style="margin-top:12px;padding-top:12px;border-top:1px dashed #949494">
      <div class="cn" style="font:400 14px 'DM Sans';color:#5A5A5A">供应商 · Fournisseur</div>
      <div style="font:600 16px 'DM Sans'">Guangzhou Hengtai Trading</div>
    </div>
  </div>
  <div class="dock"><div class="btn">Envoyer l'image</div><div class="duo" style="margin-top:10px"><div class="btn soft">PDF</div><div class="btn soft">Copier BZ-4821</div></div></div>
</div>${end}`);

add('Clients · Identité', `${sbar()}<div class="body">
  ${nav('Identité · Fatou')}
  <div class="lbl">Nom</div>
  <div class="two"><div class="inp">Fatou</div><div class="inp">Ndiaye</div></div>
  <div class="seg" style="margin-top:10px"><span class="on">Femme</span><span>Homme</span></div>
  <div class="two" style="margin-top:0"><div><div class="lbl" style="padding-left:0">Naissance</div><div class="inp" style="margin:0">12/04/1988</div></div><div><div class="lbl" style="padding-left:0">Ville</div><div class="inp" style="margin:0">Douala</div></div></div>
  <div class="lbl">Email</div>
  <div class="inp">fatou.ndiaye@gmail.com</div>
  <div class="lbl">Entreprise</div>
  <div class="inp">Ndiaye Import</div>
  <div class="lbl">Origine</div>
  <div class="inp">Commercial · Brice Onana<span style="margin-left:auto">${J.chev}</span></div>
  <div class="dock"><div class="btn">Enregistrer</div></div>
</div>${end}`);

add('Clients · Téléphones', `${sbar()}<div class="body">
  ${nav('Téléphones · Fatou')}
  <div class="list" style="margin-top:6px">
    ${row(avI(J.wa('#1E1E1E')), '+237 690 55 66 77', 'WhatsApp', tg('t-neu', 'Principal'))}
    ${row(avI(J.phone()), '+237 677 21 09 84', 'Boutique Akwa', `<div class="rbtn">${J.pen()}</div>`)}
    ${row(avI(J.phone()), '+86 156 2210 7731', 'Chine · son agent', `<div class="rbtn">${J.pen()}</div>`)}
    ${row(av('+', 'style="font-size:24px"'), 'Ajouter un numéro', 'Jusqu\'à 10, avec un libellé')}
  </div>
  <div class="dock"><div class="btn">Enregistrer</div></div>
</div>${end}`);

add('Clients · Bénéficiaire · gestes', `${sbar()}<div class="body">
  ${nav('Bénéficiaires · Fatou')}
  <div class="search">${I.search}Nom, compte ou téléphone</div>
  <div class="list" style="margin-top:6px">
    ${row(meth('alipay'), 'Guangzhou Hengtai Trading', 'hengtai_gz@163.com', J.chev)}
    ${row(meth('wechat'), 'Chen Xiaoli', 'wxid_chenxl88', J.chev)}
    ${row(meth('bank'), 'Foshan Meida Furniture', 'ICBC ****6621', J.chev)}
  </div>
  ${sheet(`<div style="display:flex;gap:14px;align-items:center">${meth('wechat')}<div><h3 style="font-size:20px">Chen Xiaoli</h3><p style="margin:0">WeChat Pay · wxid_chenxl88</p></div></div>
    <div class="box" style="margin:16px 0 0"><div class="kv">Payé<b>4 fois · ¥ 41 200</b></div><div class="kv">Dernier paiement<b>15 oct.</b></div></div>
    <div style="margin-top:8px">
      <div class="srow">${I.pay('#1E1E1E').replace('<svg', '<svg width="24" height="24"')}Payer Chen Xiaoli</div>
      <div class="srow">${J.pen()}Modifier</div>
      <div class="srow">${J.box()}Archiver<span class="x">plus proposé</span></div>
    </div>`)}
</div>${endS}`);

add('Clients · Repasser en prospect', `${sbar()}<div class="body">${aminatou}
  ${sheet(`<h3>Aminatou redevient prospect ?</h3><p>Aucune opération · son compte est supprimé</p>
    <div class="lbl">Le commercial</div>
    <div class="row" style="padding:10px 0">${av('BO')}<div class="rm"><div class="rn">Brice Onana</div></div>${tg('t-neu', 'Proposé')}<span class="rd on" style="margin-left:6px"></span></div>
    <div class="row" style="padding:10px 0">${av('SM')}<div class="rm"><div class="rn">Sandrine Mvogo</div></div><span class="rd"></span></div>
    <div class="lbl">Motif</div>
    <div class="inp hint">Compte créé trop tôt…</div>
    <div class="srow" style="height:auto;padding:14px 0 0;border:0;align-items:flex-start;font:500 16px/1.35 'DM Sans'">${ckOn}Son compte devient une fiche prospect</div>
    <div class="btn" style="margin-top:16px">Repasser en prospect</div>`)}
</div>${endS}`);

add('Clients · Supprimer', `${sbar()}<div class="body">${aminatou}
  ${sheet(`<h3>Supprimer Aminatou Bello ?</h3><p>BZ-6015 · définitif</p>
    <div class="box" style="margin:16px 0 0">
      <div class="kv">Solde<b style="display:flex;gap:8px;align-items:center">0 XAF ${J.okc}</b></div>
      <div class="kv">Découvert<b style="display:flex;gap:8px;align-items:center">Aucun ${J.okc}</b></div>
      <div class="kv">Paiements en cours<b style="display:flex;gap:8px;align-items:center">Aucun ${J.okc}</b></div>
    </div>
    <div class="btn red" style="margin-top:18px">Supprimer le client</div>
    <div class="btn soft" style="margin-top:10px">Garder</div>`)}
</div>${endS}`);
