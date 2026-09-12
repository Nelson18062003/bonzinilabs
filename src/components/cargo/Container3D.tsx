/**
 * Le conteneur en trois dimensions, et ce qu'il y a dedans.
 *
 * Pourquoi pas WebGL : la page porte déjà une carte MapLibre, donc ce serait un
 * second contexte WebGL et ~250 Ko de moteur 3D pour dessiner des boîtes à
 * angles droits. Les transformations 3D du navigateur suffisent, et elles ont
 * trois avantages concrets ici : rendu vectoriel (net à n'importe quel zoom,
 * imprimable), aucune dépendance nouvelle, et aucun écran noir sur une machine
 * sans accélération — ce qui arrive sur les postes d'agence.
 *
 * Repère, une fois pour toutes (c'est ce qui rend le code lisible) :
 *   origine = coin ARRIÈRE-HAUT-GAUCHE de la caisse
 *   +X = la longueur, vers la droite
 *   +Y = vers le BAS (convention CSS), donc « monter » c'est -Y
 *   +Z = la largeur, vers le spectateur
 * Un pavé est donc entièrement décrit par (x, y, z, l, w, h) et se dessine
 * toujours de la même façon — d'où le composant `Cuboid`, utilisé aussi bien
 * pour la caisse que pour chaque colis.
 *
 * La profondeur est gérée par le navigateur (`transform-style: preserve-3d`) ;
 * les pavés ne s'interpénètrent jamais, donc rien à trier à la main.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildLoadPlan, CAMERAS, lotColor } from '@/lib/cargo/loadplan';
import type { CameraPreset, LoadPlan, PlacedBox } from '@/lib/cargo/loadplan';
import type { CargoPackage } from '@/lib/cargo/model';

type FaceKey = 'back' | 'front' | 'left' | 'right' | 'top' | 'bottom';

/**
 * Les six faces d'un pavé (l × w × h), posé à (x, y, z).
 * Chaque face part du coin arrière-haut-gauche, avec `transform-origin: 0 0`.
 * `shade` assombrit chaque face pour donner le relief sans aucune lumière
 * calculée : c'est ce qui fait qu'un cube se lit comme un volume.
 */
const FACE_SHADE: Record<FaceKey, number> = {
  top: 0, front: 0.13, right: 0.24, back: 0.19, left: 0.3, bottom: 0.4,
};

function Cuboid({
  x, y, z, l, w, h, color, opacity = 1, faces, className, onEnter, onLeave, outline,
}: {
  x: number; y: number; z: number; l: number; w: number; h: number;
  color: string; opacity?: number;
  faces?: FaceKey[];
  className?: string;
  outline?: boolean;
  onEnter?: () => void;
  onLeave?: () => void;
}) {
  const shown: FaceKey[] = faces ?? ['back', 'front', 'left', 'right', 'top', 'bottom'];
  const geom: Record<FaceKey, { w: number; h: number; t: string }> = {
    back: { w: l, h, t: 'translateZ(0px)' },
    front: { w: l, h, t: `translateZ(${w}px)` },
    left: { w, h, t: 'rotateY(-90deg)' },
    right: { w, h, t: `translateX(${l}px) rotateY(-90deg)` },
    top: { w: l, h: w, t: 'rotateX(90deg)' },
    bottom: { w: l, h: w, t: `translateY(${h}px) rotateX(90deg)` },
  };
  return (
    <div
      className={['c3d-solid', className].filter(Boolean).join(' ')}
      style={{ transform: `translate3d(${x}px, ${y}px, ${z}px)` }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {shown.map((f) => (
        <div
          key={f}
          className={`c3d-face c3d-face--${f}${outline ? ' is-outlined' : ''}`}
          style={{
            width: `${geom[f].w}px`,
            height: `${geom[f].h}px`,
            transform: geom[f].t,
            background: `color-mix(in srgb, ${color} ${Math.round((1 - FACE_SHADE[f]) * 100)}%, #000)`,
            opacity,
          }}
        />
      ))}
    </div>
  );
}

export function Container3D({
  iso, packages, dark, hoveredPackageId = null, onHoverPackage, className,
}: {
  iso: string | null | undefined;
  packages: CargoPackage[];
  dark: boolean;
  hoveredPackageId?: string | null;
  onHoverPackage?: (id: string | null) => void;
  className?: string;
}) {
  const plan: LoadPlan = useMemo(() => buildLoadPlan(iso, packages), [iso, packages]);
  const [cam, setCam] = useState(CAMERAS[0]);
  const [yaw, setYaw] = useState(CAMERAS[0].yaw);
  const [pitch, setPitch] = useState(CAMERAS[0].pitch);
  const [zoom, setZoom] = useState(1);
  const [walls, setWalls] = useState(true);
  /** Combien d'étages sont visibles ; `null` = tous. Sert à regarder dessous. */
  const [upTo, setUpTo] = useState<number | null>(null);
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  const applyCam = useCallback((c: CameraPreset) => { setCam(c); setYaw(c.yaw); setPitch(c.pitch); }, []);

  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, yaw, pitch };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setYaw(d.yaw + (e.clientX - d.x) * 0.4);
    // Tirer vers le bas fait descendre la caméra, comme dans un visualiseur 3D.
    setPitch(Math.max(-12, Math.min(89, d.pitch - (e.clientY - d.y) * 0.3)));
  };
  const onUp = () => { drag.current = null; };

  // La molette approche la caisse, et ne fait pas défiler la page sous le
  // curseur — sinon on perd la vue dès qu'on essaie de zoomer.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((zz) => Math.max(0.45, Math.min(2.4, zz * (e.deltaY > 0 ? 0.92 : 1.08))));
    };
    host.addEventListener('wheel', onWheel, { passive: false });
    return () => host.removeEventListener('wheel', onWheel);
  }, []);

  const { dims } = plan;
  // La caisse tient dans ~660 px de scène.
  //
  // ⚠ `scale3d` et non `scale` : `scale()` est une mise à l'échelle 2D, elle
  // n'agit QUE sur X et Y. L'axe de profondeur restait donc à taille réelle, et
  // un 40 pieds paraissait deux fois trop large — invisible de trois-quarts,
  // flagrant en vue de dessus (rapport 3,2 au lieu de 5,1).
  const scale = (660 / dims.length) * zoom;
  const visible: PlacedBox[] = upTo == null ? plan.boxes : plan.boxes.filter((b) => b.layer <= upTo);
  const shellColor = dark ? '#5f6b78' : '#9fb0c0';

  return (
    <div className={['c3d', className].filter(Boolean).join(' ')}>
      <div className="c3d-bar">
        <div className="c3d-cams" role="group" aria-label="Point de vue">
          {CAMERAS.map((c) => (
            <button key={c.name} type="button" className={c.name === cam.name ? 'is-on' : ''} onClick={() => applyCam(c)}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="c3d-toggles">
          <button type="button" className={walls ? 'is-on' : ''} onClick={() => setWalls((v) => !v)}>
            {walls ? 'Parois visibles' : 'Parois masquées'}
          </button>
          {plan.layers > 1 && (
            <label className="c3d-layers">
              Étages
              <input
                type="range" min={0} max={plan.layers - 1}
                value={upTo ?? plan.layers - 1}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setUpTo(v >= plan.layers - 1 ? null : v);
                }}
              />
              <b>{(upTo ?? plan.layers - 1) + 1}/{plan.layers}</b>
            </label>
          )}
        </div>
      </div>

      <div
        ref={hostRef}
        className="c3d-stage"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        role="img"
        aria-label={`Conteneur ${plan.isoLabel}, ${plan.boxes.length} colis, rempli à ${Math.round(plan.fill * 100)} pour cent du volume`}
      >
        <div
          className="c3d-world"
          style={{ transform: `rotateX(${-pitch}deg) rotateY(${yaw}deg) scale3d(${scale}, ${scale}, ${scale})` }}
        >
          <div className="c3d-origin" style={{ transform: `translate3d(${-dims.length / 2}px, ${dims.height / 2}px, ${-dims.width / 2}px)` }}>
            {/* Le plancher : sans lui la caisse flotte et on perd l'assise. */}
            <div className="c3d-floor" style={{ width: `${dims.length}px`, height: `${dims.width}px`, transform: 'translateY(0px) rotateX(90deg)' }} />

            {/* La caisse : translucide, pour voir dedans sans perdre le volume.
                Pas de face avant — c'est par là qu'on regarde. */}
            {walls && (
              <Cuboid
                x={0} y={-dims.height} z={0}
                l={dims.length} w={dims.width} h={dims.height}
                color={shellColor} opacity={0.14}
                faces={['back', 'left', 'top', 'right']}
                className="c3d-shell" outline
              />
            )}

            {visible.map((b) => (
              <Cuboid
                key={b.id}
                x={b.x} y={-b.y - b.h} z={b.z}
                l={b.l} w={b.w} h={b.h}
                color={lotColor(b.lot, dark)}
                opacity={hoveredPackageId != null && hoveredPackageId !== b.packageId ? 0.13 : 1}
                className={`c3d-box${hoveredPackageId === b.packageId ? ' is-on' : ''}`}
                onEnter={() => onHoverPackage?.(b.packageId)}
                onLeave={() => onHoverPackage?.(null)}
              />
            ))}
          </div>
        </div>
      </div>

      <p className="c3d-hint">
        Glisser pour tourner · molette pour approcher · « Étages » retire les couches du haut pour voir dessous.
      </p>
    </div>
  );
}
