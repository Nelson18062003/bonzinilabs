// ============================================================
// La caméra de la réception : html5-qrcode, comme AgentCashScanner et
// MobileClientScan — même arrêt sûr, mêmes messages. Lit les QR (client,
// étiquette Bonzini) ET les codes-barres des bordereaux de transporteur.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export function safeStopScanner(scanner: Html5Qrcode | null) {
  if (!scanner) return;
  try {
    const state = scanner.getState();
    if (state === 2 /* SCANNING */ || state === 3 /* PAUSED */) scanner.stop().catch(() => {});
  } catch {
    // pas dans un état arrêtable
  }
}

export function useQrScanner(elementId: string, onDecode: (text: string) => void, enabled = true) {
  const [starting, setStarting] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onDecodeRef = useRef(onDecode);
  onDecodeRef.current = onDecode;

  useEffect(() => {
    if (!enabled) return;
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
  }, [elementId, enabled]);

  return { starting, error, stop: () => safeStopScanner(scannerRef.current) };
}
