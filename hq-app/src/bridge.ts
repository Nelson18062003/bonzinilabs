// ============================================================
// LE PONT entre le site (dans la WebView) et le téléphone.
//
// Le site fait déjà tout ce qu'il faut dans un navigateur : télécharger un
// PDF ou une image (<a download href="blob:…">), ouvrir la feuille de partage
// (navigator.share), copier une image (navigator.clipboard.write). Dans une
// WebView, rien de cela n'aboutit : ni dossier Téléchargements, ni feuille de
// partage, et le presse-papiers d'image est capricieux.
//
// Ce script, injecté AVANT le chargement de chaque page, intercepte ces
// trois gestes et les confie à l'app (postMessage). Aucun fichier du site
// n'est modifié : les ~10 endroits qui téléchargent (étiquettes, reçus,
// relevés, flyers, coordonnées, CSV…) passent tous par ces API standard.
//
// Piège évité : le site révoque souvent l'URL « blob: » juste après le clic.
// On garde donc une référence au Blob au moment où l'URL est CRÉÉE.
// ============================================================

/** Ce que la page envoie à l'app. */
export type BridgeMessage =
  | { type: 'file'; action: 'save' | 'share'; name: string; mime: string; base64: string }
  | { type: 'files'; title: string; files: { name: string; mime: string; base64: string }[] }
  | { type: 'download-url'; url: string; name: string }
  | { type: 'share-text'; title: string; text: string }
  | { type: 'clipboard-image'; mime: string; base64: string }
  | { type: 'clipboard-text'; text: string }
  | { type: 'theme'; background: string }
  | { type: 'error'; message: string };

export function parseBridgeMessage(raw: string): BridgeMessage | null {
  try {
    const m = JSON.parse(raw) as BridgeMessage;
    return m && typeof m === 'object' && typeof m.type === 'string' ? m : null;
  } catch {
    return null;
  }
}

/** Injecté avant le contenu, cadre principal seulement. Doit rester de l'ES5 simple et se terminer par `true;`. */
export const INJECTED_BEFORE_CONTENT = `
(function () {
  if (window.__bonziniHQ) return;
  window.__bonziniHQ = true;
  function post(m) { try { window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (e) {} }
  function toBase64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { var s = String(r.result); resolve(s.slice(s.indexOf(',') + 1)); };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(blob);
    });
  }

  // 1. Garder les Blob derrière les URL « blob: », même après révocation.
  var blobs = {};
  var createURL = URL.createObjectURL.bind(URL);
  var revokeURL = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = function (obj) {
    var u = createURL(obj);
    if (obj instanceof Blob) blobs[u] = obj;
    return u;
  };
  URL.revokeObjectURL = function (u) {
    setTimeout(function () { delete blobs[u]; }, 120000);
    return revokeURL(u);
  };

  // 2. Les téléchargements <a download>.
  function handleDownload(a) {
    if (!a || !a.hasAttribute || !a.hasAttribute('download')) return false;
    var href = a.href || '';
    var name = a.getAttribute('download') || 'document';
    var blob = blobs[href];
    if (blob) {
      toBase64(blob).then(function (b64) {
        post({ type: 'file', action: 'save', name: name, mime: blob.type || 'application/octet-stream', base64: b64 });
      }).catch(function (e) { post({ type: 'error', message: String(e) }); });
      return true;
    }
    if (href.indexOf('data:') === 0) {
      fetch(href).then(function (r) { return r.blob(); }).then(function (b) {
        return toBase64(b).then(function (b64) {
          post({ type: 'file', action: 'save', name: name, mime: b.type || 'application/octet-stream', base64: b64 });
        });
      }).catch(function (e) { post({ type: 'error', message: String(e) }); });
      return true;
    }
    if (/^https?:/i.test(href)) { post({ type: 'download-url', url: href, name: name }); return true; }
    return false;
  }
  var nativeClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (handleDownload(this)) return;
    return nativeClick.apply(this, arguments);
  };
  document.addEventListener('click', function (e) {
    var t = e.target;
    var a = t && t.closest ? t.closest('a[download]') : null;
    if (a && handleDownload(a)) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  // 3. La feuille de partage : celle du téléphone.
  navigator.canShare = function () { return true; };
  navigator.share = function (data) {
    data = data || {};
    var files = data.files ? Array.prototype.slice.call(data.files) : [];
    if (files.length) {
      return Promise.all(files.map(function (f) {
        return toBase64(f).then(function (b64) { return { name: f.name || 'document', mime: f.type || 'application/octet-stream', base64: b64 }; });
      })).then(function (list) { post({ type: 'files', title: data.title || '', files: list }); });
    }
    post({ type: 'share-text', title: data.title || '', text: [data.text, data.url].filter(Boolean).join('\\n') });
    return Promise.resolve();
  };

  // 4. Le presse-papiers : image et texte passent par l'app.
  if (navigator.clipboard) {
    var nativeWrite = navigator.clipboard.write ? navigator.clipboard.write.bind(navigator.clipboard) : null;
    navigator.clipboard.write = function (items) {
      try {
        var item = items && items[0];
        var types = (item && item.types) || [];
        var img = null;
        for (var i = 0; i < types.length; i++) if (types[i].indexOf('image/') === 0) img = types[i];
        if (img) {
          return item.getType(img).then(toBase64).then(function (b64) { post({ type: 'clipboard-image', mime: img, base64: b64 }); });
        }
      } catch (e) {}
      return nativeWrite ? nativeWrite(items) : Promise.reject(new Error('clipboard'));
    };
    navigator.clipboard.writeText = function (text) {
      post({ type: 'clipboard-text', text: String(text) });
      return Promise.resolve();
    };
  }

  // 5. La couleur du fond de page : l'app peint les bords (encoche, barre du bas) de la même couleur.
  function sendTheme() {
    try {
      var bg = getComputedStyle(document.body || document.documentElement).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') post({ type: 'theme', background: bg });
    } catch (e) {}
  }
  document.addEventListener('DOMContentLoaded', function () {
    sendTheme();
    try { new MutationObserver(sendTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] }); } catch (e) {}
  });
})();
true;
`;
