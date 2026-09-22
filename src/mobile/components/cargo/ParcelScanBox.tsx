// ============================================================
// La boîte de scan des cartons — au chargement (Guangzhou) et au pointage
// (Douala). Deux lecteurs, un seul geste :
//   · la douchette Bluetooth (mode clavier HID) : elle « tape » le code puis
//     Entrée dans un champ qui garde le focus tout seul ;
//   · la caméra du téléphone, en secours, derrière un bouton.
// Chaque lecture répond par un son et une vibration différents selon
// l'issue, pour travailler sans regarder l'écran.
// ============================================================
import { useEffect, useId, useRef, useState } from 'react';
import { Camera, CameraOff, ScanLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE } from '@/mobile/designKit';
import { useQrScanner } from '@/mobile/components/reception/useQrScanner';

export type ScanOutcome = 'ok' | 'again' | 'unknown' | 'refused';

const TONES: Record<ScanOutcome, { freq: number; ms: number; vibrate: number | number[] }> = {
  ok: { freq: 1320, ms: 90, vibrate: 40 },
  again: { freq: 660, ms: 120, vibrate: [40, 60, 40] },
  unknown: { freq: 220, ms: 350, vibrate: [80, 60, 80, 60, 80] },
  refused: { freq: 220, ms: 350, vibrate: [80, 60, 80, 60, 80] },
};

let audioCtx: AudioContext | null = null;

/** Un bip et une vibration selon l'issue : aigu = pointé, grave et long = inconnu. */
export function scanFeedback(outcome: ScanOutcome) {
  const tone = TONES[outcome];
  try { navigator.vibrate?.(tone.vibrate); } catch { /* pas de vibreur */ }
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = tone.freq;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + tone.ms / 1000);
  } catch { /* pas de son */ }
}

const OUTCOME_STYLE: Record<ScanOutcome, string> = {
  ok: 'bg-[#CFF7D3] text-[#02542D] dark:bg-[#02542D] dark:text-[#CFF7D3]',
  again: 'bg-[#FFF1C2] text-[#975102] dark:bg-[#975102] dark:text-[#FFF1C2]',
  unknown: 'bg-[#FDD3D0] text-[#900B09] dark:bg-[#900B09] dark:text-[#FDD3D0]',
  refused: 'bg-[#FDD3D0] text-[#900B09] dark:bg-[#900B09] dark:text-[#FDD3D0]',
};

export interface ScanResult { outcome: ScanOutcome; text: string }

interface Props {
  /** Reçoit le texte lu (douchette ou caméra) et dit ce qu'il en est advenu. */
  onScan: (text: string) => ScanResult | Promise<ScanResult>;
  placeholder?: string;
  /** Un compteur à droite, ex. « 12 / 40 ». */
  counter?: string;
  className?: string;
}

export function ParcelScanBox({ onScan, placeholder = 'Scannez un carton', counter, className }: Props) {
  const scannerId = `parcel-scan-${useId().replace(/:/g, '')}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [camera, setCamera] = useState(false);
  const [last, setLast] = useState<ScanResult | null>(null);
  const busyRef = useRef(false);
  const lastTextRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });

  const handle = async (raw: string) => {
    const text = raw.trim();
    if (!text || busyRef.current) return;
    // La caméra relit le même QR dix fois par seconde : on ignore la répétition pendant 1,5 s.
    const now = Date.now();
    if (lastTextRef.current.text === text && now - lastTextRef.current.at < 1500) return;
    lastTextRef.current = { text, at: now };
    busyRef.current = true;
    try {
      const res = await onScan(text);
      setLast(res);
      scanFeedback(res.outcome);
    } finally {
      busyRef.current = false;
      setValue('');
      inputRef.current?.focus({ preventScroll: true });
    }
  };

  const cam = useQrScanner(scannerId, (text) => { void handle(text); }, camera);

  // La douchette « tape » dans le champ : on le garde au focus, sauf si l'utilisateur
  // écrit ailleurs (un autre champ, la fiche d'un colis).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const refocus = () => {
      const active = document.activeElement;
      const typingElsewhere = active && active !== el && active !== document.body && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || (active as HTMLElement).isContentEditable);
      if (!typingElsewhere) el.focus({ preventScroll: true });
    };
    refocus();
    const t = window.setInterval(refocus, 1500);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <ScanLine className={cn('pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2', TEXT.muted)} />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handle(value); } }}
            enterKeyHint="done"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            placeholder={placeholder}
            aria-label={placeholder}
            className={cn('h-12 w-full rounded-lg border pl-12 pr-3 text-[16px] tabular-nums outline-none focus:border-[#2C2C2C] dark:focus:border-[#E3E3E3]', SURFACE.card, SURFACE.divider, TEXT.strong)}
          />
        </div>
        {counter && <span className={cn('shrink-0 tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{counter}</span>}
        <button
          type="button"
          onClick={() => setCamera((c) => !c)}
          aria-pressed={camera}
          aria-label={camera ? 'Fermer la caméra' : 'Ouvrir la caméra'}
          className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border', camera ? 'border-[#2C2C2C] bg-[#2C2C2C] text-white dark:border-[#E3E3E3] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]' : cn(SURFACE.card, SURFACE.divider, TEXT.strong))}
        >
          {camera ? <CameraOff className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
        </button>
      </div>

      {camera && (
        <div className="relative overflow-hidden rounded-lg bg-[#1E1E1E]" style={{ aspectRatio: '1 / 1' }}>
          <div id={scannerId} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
          {cam.starting && <div className="absolute inset-0 flex items-center justify-center text-[16px] font-medium text-white/80">Caméra…</div>}
          {cam.error && <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-[16px] font-medium leading-relaxed text-white/90">La caméra ne s'ouvre pas. Utilisez la douchette ou tapez le numéro.</div>}
        </div>
      )}

      {last && (
        <p className={cn('rounded-lg px-4 py-2.5', TYPE.bodyStrong, OUTCOME_STYLE[last.outcome])} role="status" aria-live="polite">{last.text}</p>
      )}

      {!last && <p className={cn(TYPE.small, TEXT.muted)}>Douchette Bluetooth ou caméra : chaque carton lu répond par un bip. Aigu = pointé, grave = inconnu.</p>}
    </div>
  );
}
