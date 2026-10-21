/* ═══════════════ OPÉRATIONS ═══════════════ */
const lotBody = `${nav('Paiement groupé', dotsB)}
  <div class="who">${av('SN')}<div style="flex:1"><b>Samuel Nkoulou</b><span>Solde 6 400 000 XAF</span></div><span class="link" style="font-size:15px">Changer</span></div>
  <div class="lbl">4 fournisseurs</div>
  <div class="list">
    ${row(meth('alipay'), 'Guangzhou Hengtai Trading', 'Alipay · hengtai_gz@163.com', amt('¥ 18 200', rs('1 679 276')))}
    ${row(meth('wechat'), 'Chen Xiaoli', 'WeChat Pay · wxid_chenxl88', amt('¥ 9 500', rs('876 545')))}
    ${row(meth('bank'), 'Foshan Meida Furniture', 'Virement · ICBC ****6621', amt('¥ 22 000', rs('2 029 895')))}
    ${row(meth('cash'), 'Wang Lei', 'Retrait au bureau · QR auto', amt('¥ 12 500', rs('1 153 349')))}
    ${row(av('+', 'style="font-size:24px"'), 'Ajouter un fournisseur', 'Nouveau ou depuis son carnet')}
  </div>`;

add('Opérations · Paiement groupé', `${sbar()}<div class="body">${lotBody}
  <div class="dock"><div style="display:flex;justify-content:space-between;font:500 16px 'DM Sans';color:#303030;margin-bottom:12px"><span>Total <b style="color:#1E1E1E">¥ 62 200</b></span><span>Restant <b style="color:#1E1E1E">660 934 XAF</b></span></div><div class="btn">Vérifier le lot · 4</div></div>
</div>${end}`);

add('Opérations · Lot · ajouter un fournisseur', `${sbar()}<div class="body">${lotBody}
  ${sheet(`<div style="display:flex;justify-content:space-between;align-items:baseline"><h3>Nouveau fournisseur</h3><span class="link" style="font-size:15px">Son carnet</span></div>
    <div class="lbl">Par</div>
    <div class="methods" style="padding:0"><div class="m">${meth('alipay')}Alipay</div><div class="m">${meth('wechat')}WeChat</div><div class="m on">${meth('bank')}Virement</div><div class="m">${meth('cash')}Cash</div></div>
    <div class="lbl">Montant</div>
    <div class="field on" style="margin:0">¥ 22 000<small>= 2 029 895 XAF</small></div>
    <div class="chips" style="margin-top:10px"><span class="chip">¥1K</span><span class="chip">¥2,5K</span><span class="chip">¥5K</span><span class="chip">Restant</span></div>
    <div class="lbl">Bénéficiaire</div>
    <div class="inp">Foshan Meida Furniture</div>
    <div class="two" style="margin:10px 0 0"><div class="inp">ICBC Foshan</div><div class="inp">N° ****6621</div></div>
    <div class="srow" style="border:0;margin-top:6px">Enregistrer dans son carnet<span class="sw" style="margin-left:auto"></span></div>
    <div class="btn" style="margin-top:6px">Ajouter au lot</div>`, 30)}
</div>${endS}`);

add('Opérations · Lot · vérifier', `${sbar()}<div class="body">${lotBody}
  ${sheet(`<h3>Créer le lot ?</h3><p>4 paiements · Samuel Nkoulou · tout ou rien</p>
    <div class="box" style="margin:16px 0 0">
      <div class="kv">Total<b>¥ 62 200</b></div>
      <div class="kv">Débité<b>5 739 066 XAF</b></div>
      <div class="kv">Solde avant<b>6 400 000 XAF</b></div>
      <div class="kv">Solde après<b>660 934 XAF</b></div>
    </div>
    <div class="lbl">Note</div>
    <div class="inp hint">Commande d'octobre, facture…</div>
    <div class="btn" style="margin-top:18px">Créer le lot</div>`)}
</div>${endS}`);

add('Opérations · Modifier le fournisseur', `${sbar()}<div class="body">
  ${nav('Modifier le fournisseur')}
  <div class="who">${meth('alipay')}<div style="flex:1"><b>¥ 7 493 · Fatou Ndiaye</b><span>BZ-PY-2610-0416</span></div><span class="tag t-todo">À payer</span></div>
  <div class="seg" style="margin-top:16px"><span class="on">Alipay</span><span>WeChat</span></div>
  <div class="lbl">QR code</div>
  <div style="display:flex;gap:14px;align-items:center;padding:0 20px">${qr(11)}<div><div style="font:600 16px 'DM Sans'">QR enregistré</div><div class="copy">${J.cam().replace('ic24', '').replace('<svg', '<svg width="16" height="16"')}Changer le QR</div></div></div>
  <div class="lbl">Nom</div>
  <div class="inp">Guangzhou Hengtai Trading</div>
  <div class="lbl">ID Alipay</div>
  <div class="inp">hengtai_gz@163.com</div>
  <div class="okline" style="margin-top:14px">${J.plus()}Téléphone, identifiant, notes</div>
  <div class="dock"><div class="btn">Enregistrer</div></div>
</div>${end}`);

const payFiche = `${nav('Paiement', dotsB)}
  <div class="fiche"><div class="logo" style="background:#1677FF"><svg viewBox="0 0 24 24"><path d="${LOGO.alipay}" fill="#fff"/></svg></div><div class="big">¥ 7 493</div><div class="sub">Fatou Ndiaye · 691 364 XAF</div><span class="tag t-todo">À payer</span></div>
  <div class="box"><div class="kv">Taux<b>1 M XAF = ¥ 10 838</b></div><div class="kv">Référence<b>BZ-PY-2610-0416</b></div></div>`;
add('Opérations · Paiement · corriger le montant', `${sbar()}<div class="body">${payFiche}
  ${sheet(`<h3>Corriger le montant</h3><p>BZ-PY-2610-0416 · Fatou Ndiaye</p>
    <div class="two" style="margin:16px 0 0"><div class="field md">700 000<small>XAF</small></div><div class="field md">¥ 7 587</div></div>
    <div class="inp" style="margin-top:10px">Taux · 1 M XAF = ¥ 10 838<span class="r2">du jour</span></div>
    <div class="box" style="margin:14px 0 0">
      <div class="kv">Débité<b>691 364 → 700 000</b></div>
      <div class="kv">Solde de Fatou<b>522 086 → 513 450</b></div>
    </div>
    <div class="lbl">Motif</div>
    <div class="inp">Facture corrigée par le fournisseur</div>
    <div class="btn" style="margin-top:18px">Corriger</div>`)}
</div>${endS}`);

add('Opérations · Instruction de paiement', `${sbar()}<div class="body">
  ${nav('Instruction', `<span class="step cn">付款指令</span>`)}
  <div class="paper" style="margin-top:20px">
    <div class="hd"><span>BONZINI LABS</span><span class="cn" style="font-weight:700">付款指令</span></div>
    <div style="display:flex;align-items:center;gap:12px;margin-top:16px">${meth('alipay')}<div><div style="font:700 34px/1 'DM Sans';letter-spacing:-.02em">¥ 7 493</div><div class="cn" style="font:400 15px 'DM Sans';color:#5A5A5A;margin-top:4px">支付宝 · Alipay</div></div></div>
    <div style="display:flex;gap:14px;align-items:center;margin-top:16px">${qr(11).replace('class="qr"', 'class="qr q"')}<div style="min-width:0">
      <div class="cn" style="font:400 14px 'DM Sans';color:#5A5A5A">收款人</div><div style="font:600 16px 'DM Sans'">Guangzhou Hengtai Trading</div>
      <div class="cn" style="font:400 14px 'DM Sans';color:#5A5A5A;margin-top:8px">账号</div><div style="font:600 16px 'DM Sans'">hengtai_gz@163.com</div></div></div>
    <div style="display:flex;justify-content:space-between;margin-top:16px;padding-top:12px;border-top:1px solid #D9D9D9;font:500 14px 'DM Sans';color:#5A5A5A"><span>BZ-PY-2610-0416</span><span>21/10/2026</span></div>
  </div>
  <div class="dock"><div class="btn">Partager l'image</div><div class="duo" style="margin-top:10px"><div class="btn soft">PDF</div><div class="btn soft">Copier le texte</div></div></div>
</div>${end}`);

add('Opérations · Nouveau fournisseur', `${sbar()}<div class="body">
  ${nav('Nouveau fournisseur', stepT('3/3'))}
  <div class="who">${av('FN')}<div style="flex:1"><b>¥ 7 493 · Fatou Ndiaye</b><span>691 364 XAF</span></div></div>
  <div class="lbl">Par</div>
  <div class="methods"><div class="m on">${meth('alipay')}Alipay</div><div class="m">${meth('wechat')}WeChat</div><div class="m">${meth('bank')}Virement</div><div class="m">${meth('cash')}Cash</div></div>
  <div class="lbl">QR du fournisseur</div>
  <div class="proof" style="height:96px">${J.cam()}Photo ou capture du QR</div>
  <div class="lbl">Nom</div>
  <div class="inp">Yiwu Jinsheng Textile</div>
  <div class="lbl">ID Alipay</div>
  <div class="inp hint">Téléphone ou e-mail</div>
  <div class="srow" style="margin:6px 20px 0;border:0">Garder dans ses fournisseurs<span class="sw" style="margin-left:auto"></span></div>
  <div class="dock"><div class="btn">Continuer</div></div>
</div>${end}`);
