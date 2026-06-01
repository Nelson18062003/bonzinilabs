import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootEl = document.getElementById("root")!;

/**
 * Filet de sécurité racine.
 * Évite l'écran blanc total : si une erreur survient AVANT/PENDANT le démarrage
 * de React (ex. chunk lazy périmé après un déploiement → cache du navigateur),
 * on affiche un message lisible + un bouton Recharger au lieu d'une page vide.
 */
function showFatal(message: string, isChunkError: boolean) {
  // Erreur de chargement de module (déploiement + cache navigateur) → rechargement auto une fois.
  if (isChunkError && !sessionStorage.getItem("bz-reloaded-once")) {
    sessionStorage.setItem("bz-reloaded-once", "1");
    window.location.reload();
    return;
  }
  rootEl.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0e0e12;color:#fff;text-align:center">
      <div style="max-width:420px">
        <div style="font-size:40px;margin-bottom:12px">⚠️</div>
        <h1 style="font-size:18px;margin:0 0 8px">Un problème est survenu au chargement</h1>
        <p style="font-size:14px;color:#b5b5c2;margin:0 0 20px">Essaie de recharger la page. Si ça persiste, vide le cache du navigateur.</p>
        <button onclick="sessionStorage.clear();location.reload()" style="background:linear-gradient(135deg,hsl(258 100% 60%),hsl(16 100% 55%));border:none;color:#fff;font-weight:700;padding:12px 22px;border-radius:12px;font-size:15px">Recharger</button>
        <pre style="margin-top:18px;font-size:11px;color:#7a7a86;white-space:pre-wrap;text-align:left;max-height:160px;overflow:auto">${message.replace(/[<>&]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[ch] || ch))}</pre>
      </div>
    </div>`;
}

function isChunk(msg: string): boolean {
  return /dynamically imported module|Failed to fetch|Importing a module|ChunkLoadError|Loading chunk|MIME type/i.test(msg);
}

// Filet : erreurs synchrones non capturées + promesses rejetées (imports lazy).
window.addEventListener("error", (e) => {
  const msg = e?.message || String(e?.error ?? "Erreur inconnue");
  if (isChunk(msg)) showFatal(msg, true);
});
window.addEventListener("unhandledrejection", (e) => {
  const msg = String((e?.reason as Error)?.message ?? e?.reason ?? "");
  if (isChunk(msg)) showFatal(msg, true);
});

try {
  createRoot(rootEl).render(<App />);
  // Démarrage OK → on réarme le rechargement auto pour un futur déploiement.
  sessionStorage.removeItem("bz-reloaded-once");
} catch (err) {
  const msg = (err as Error)?.message ?? String(err);
  showFatal(msg, isChunk(msg));
}
