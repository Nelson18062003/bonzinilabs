// ============================================================
// Un QR par carton, invisible, que le peintre de l'étiquette interne
// recopie. Même mécanique que le QR client de useShippingLabel, en série :
// `nodes` à monter quelque part, `get(id)` pour le canvas d'un colis.
// Les callbacks de ref sont stables par id : un callback recréé à chaque
// rendu ferait détacher/rattacher le canvas en boucle.
// ============================================================
import { useRef, useState, type ReactNode } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

type Attach = (el: HTMLCanvasElement | null) => void;

export function useParcelQrCanvases(items: ReadonlyArray<{ id: string; value: string }>): { nodes: ReactNode; get: (id: string) => HTMLCanvasElement | null; ready: boolean } {
  const map = useRef(new Map<string, HTMLCanvasElement>());
  const attachers = useRef(new Map<string, Attach>());
  const [, bump] = useState(0);
  const attach = (id: string): Attach => {
    let fn = attachers.current.get(id);
    if (!fn) {
      fn = (el) => {
        if (el) { if (map.current.get(id) !== el) { map.current.set(id, el); bump((n) => n + 1); } }
        else if (map.current.delete(id)) bump((n) => n + 1);
      };
      attachers.current.set(id, fn);
    }
    return fn;
  };
  const nodes = (
    <div aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
      {items.map((it) => <QRCodeCanvas key={it.id} ref={attach(it.id)} value={it.value} size={480} level="H" marginSize={0} />)}
    </div>
  );
  const ready = items.length > 0 && items.every((it) => map.current.has(it.id));
  return { nodes, get: (id) => map.current.get(id) ?? null, ready };
}
