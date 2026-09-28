// ============================================================
// La caméra de la réception : html5-qrcode, comme AgentCashScanner et
// MobileClientScan — même arrêt sûr, mêmes messages. Lit les QR (client,
// étiquette Bonzini) ET les codes-barres des bordereaux de transporteur.
//
// Dans l'app BONZINI HQ : c'est la caméra NATIVE qui lit (plus rapide, plus
// nette, lampe torche) ; elle s'ouvre toute seule, et un bouton « Ouvrir le
// scanner » la rouvre. Le texte lu revient ici, au même `onDecode`.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import i18n from '@/i18n';
import { isNativeApp } from '@/lib/nativeApp';
import { closeNativeScanner, openNativeScanner, registerNativeScanner } from '@/lib/nativeBridge';

export function safeStopScanner(scanner: Html5Qrcode | null) {
  if (!scanner) return;
  try {
    const state = scanner.getState();
    if (state === 2 /* SCANNING */ || state === 3 /* PAUSED */) scanner.stop().catch(() => {});
  } catch {
    // pas dans un état arrêtable
  }
}

/** Le bouton posé dans la zone caméra, dans l'app (la vidéo est native). */
function mountNativeButton(elementId: string): HTMLButtonElement | null {
  const el = document.getElementById(elementId);
  if (!el) return null;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('style', 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;width:100%;height:100%;min-height:180px;border:0;border-radius:inherit;background:#1A1028;color:#fff;font:700 19px/1.3 inherit;cursor:pointer');
  // Pictogramme appareil photo (trait blanc) + libellé.
  btn.innerHTML = '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>';
  const label = document.createElement('span');
  label.textContent = i18n.t('scanOpenNative', { ns: 'common', defaultValue: 'Ouvrir le scanner' });
  btn.appendChild(label);
  btn.onclick = () => openNativeScanner();
  el.appendChild(btn);
  return btn;
}

export function useQrScanner(elementId: string, onDecode: (text: string) => void, enabled = true, { continuous = false }: { continuous?: boolean } = {}) {
  const native = isNativeApp();
  const [starting, setStarting] = useState(enabled && !native);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onDecodeRef = useRef(onDecode);
  onDecodeRef.current = onDecode;

  useEffect(() => {
    if (!enabled) return;
    if (native) {
      const btn = mountNativeButton(elementId);
      const off = registerNativeScanner((text) => onDecodeRef.current(text), { continuous });
      return () => {
        off();
        btn?.remove();
      };
    }
    let mounted = true;
    const start = async () => {
      try {
        const scanner = new Html5Qrcode(elementId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
          (text) => { if (mounted) onDecodeRef.current(text); },
          () => {},
        );
        if (mounted) setStarting(false);
      } catch (err: unknown) {
        if (!mounted) return;
        setStarting(false);
        const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
        setError(msg.includes('permission') || msg.includes('denied') ? 'denied' : msg.includes('not found') || msg.includes('no device') ? 'none' : msg.includes('https') || msg.includes('insecure') ? 'https' : 'error');
      }
    };
    void start();
    return () => {
      mounted = false;
      safeStopScanner(scannerRef.current);
      scannerRef.current = null;
    };
  }, [elementId, enabled, native, continuous]);

  return { starting, error, stop: () => (native ? closeNativeScanner() : safeStopScanner(scannerRef.current)) };
}
