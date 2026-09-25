// RateFlyerSheet — contenu du panneau « Flyer du jour ».
// Ouvert depuis la pilule « Voir le flyer du jour » au bas du module Taux
// (mobile) ou le bouton d'en-tête (desktop), et depuis « Taux par pays » avec
// le pays déjà choisi. Un flyer PAR PAYS (Cameroun compris), au seul nom de
// NORTON GAUSS BONZINI SARL, avec les petits paiements en rouge : tout vient
// de buildFlyerData (publication active + rate_adjustments).
//
// Le flyer est dessiné hors écran (RateFlyer, 1080×1350), photographié en PNG
// (2160×2700), et c'est CETTE IMAGE qu'on affiche : ce qu'on voit est ce
// qu'on copie ou télécharge, et le clic droit / appui long « Copier l'image »
// du navigateur marche dessus. Boutons : Copier l'image · Télécharger (et
// Partager sur téléphone) · Copier le texte du jour. Plus de PDF (25/09/2026).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { RateFlyer } from './RateFlyer';
import { flyerPngFile, FLYER_W, FLYER_H } from '@/lib/exportFlyer';
import { buildCountryRateSheets, formatCountryPct, REFERENCE_COUNTRY_KEY } from '@/lib/countryRates';
import { buildFlyerData, flyerCaption } from '@/lib/rateFlyer';
import { canShareFiles, copyImageFile, deliverFile, downloadFile, prefersDownload } from '@/components/customer-code/exportShippingLabel';
import { LEGAL_NAME } from '@/lib/companyIdentity';
import type { DailyRate, RateAdjustment } from '@/types/rates';
import { CountryFlag } from '@/components/form/CountryFlag';
import { TEXT, TYPE, Button, Chip } from '@/mobile/designKit';

interface RateFlyerSheetProps {
  /** Publication active — les taux de référence. */
  activeRate: DailyRate | null | undefined;
  /** Ajustements (pays + tranches de montant). */
  adjustments: readonly RateAdjustment[] | undefined;
  /** Pays présélectionné (clé `rate_adjustments`), sinon la référence. */
  initialCountry?: string | null;
}

interface FlyerImage { key: string; file: File; url: string }

export function RateFlyerSheet({ activeRate, adjustments, initialCountry }: RateFlyerSheetProps) {
  const [copied, setCopied] = useState<'image' | 'text' | null>(null);
  const [saving, setSaving] = useState(false);
  // Un double toucher ne lance pas deux écritures (la seconde annulerait la première).
  const copying = useRef(false);

  const sheets = useMemo(() => buildCountryRateSheets(activeRate, adjustments ?? []), [activeRate, adjustments]);
  const [countryKey, setCountryKey] = useState<string>(initialCountry ?? REFERENCE_COUNTRY_KEY);
  useEffect(() => { setCountryKey(initialCountry ?? REFERENCE_COUNTRY_KEY); }, [initialCountry]);

  const selected = sheets.find((s) => s.key === countryKey) ?? sheets.find((s) => s.isReference) ?? null;
  const flyer = useMemo(
    () => (activeRate ? buildFlyerData(activeRate, adjustments ?? [], selected?.key ?? REFERENCE_COUNTRY_KEY) : null),
    [activeRate, adjustments, selected?.key],
  );
  // Ce que montre le flyer, en une clé : l'image est refaite quand elle change.
  const flyerKey = flyer ? JSON.stringify(flyer) : '';
  // « Copiée » valait pour l'image d'avant : on l'efface quand le flyer change.
  useEffect(() => { setCopied(null); }, [flyerKey]);

  // ── Le flyer en image ──────────────────────────────────────────────────
  const nodeRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<FlyerImage | null>(null);
  const [failed, setFailed] = useState(false);
  const imageRef = useRef<FlyerImage | null>(null);
  imageRef.current = image;
  useEffect(() => () => { if (imageRef.current) URL.revokeObjectURL(imageRef.current.url); }, []);
  // Les photos passent l'une après l'autre : deux captures du même nœud en même temps se mélangeraient.
  const captures = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    const node = nodeRef.current;
    if (!flyer || !node) return;
    const key = flyerKey;
    const countryKey = flyer.country.key;
    let cancelled = false;
    setFailed(false);
    // Un court délai : en passant vite d'un pays à l'autre, seul le dernier est photographié.
    const timer = window.setTimeout(() => {
      captures.current = captures.current
        .then(async () => {
          if (cancelled) return;
          // Le navigateur pose d'abord le flyer (et son drapeau).
          await new Promise((r) => requestAnimationFrame(r));
          if (cancelled) return;
          const file = await flyerPngFile(node, countryKey);
          if (cancelled) return;
          const url = URL.createObjectURL(file);
          setImage((prev) => { if (prev) URL.revokeObjectURL(prev.url); return { key, file, url }; });
        })
        .catch(() => { if (!cancelled) setFailed(true); });
    }, 150);
    return () => { cancelled = true; window.clearTimeout(timer); };
    // flyerKey résume flyer : pas besoin de l'objet dans les dépendances.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyerKey]);

  const ready = !!image && image.key === flyerKey;
  const desktop = prefersDownload();
  const share = !desktop && canShareFiles();

  const flash = (what: 'image' | 'text') => { setCopied(what); setTimeout(() => setCopied((c) => (c === what ? null : c)), 2200); };

  // Pas d'attente avant l'écriture : Safari n'accepte le presse-papiers que dans le geste.
  const copyImage = () => {
    if (!ready || !image || copying.current) return;
    copying.current = true;
    void copyImageFile(image.file)
      .then((o) => {
        if (o === 'copied') { flash('image'); toast.success('Image copiée — collez-la dans WhatsApp'); }
        else if (o === 'downloaded') toast.success('Copie impossible ici : l’image a été téléchargée');
      })
      .finally(() => { copying.current = false; });
  };
  const download = () => {
    if (!ready || !image) return;
    downloadFile(image.file);
    toast.success('Image téléchargée');
  };
  const shareImage = () => {
    if (!ready || !image || saving || !flyer) return;
    setSaving(true);
    void deliverFile(image.file, `${LEGAL_NAME} · Taux du jour · ${flyer.country.label}`)
      .then((o) => { if (o === 'downloaded') toast.success('Image téléchargée'); })
      .finally(() => setSaving(false));
  };
  const copyCaption = async () => {
    if (!flyer) return;
    try {
      await navigator.clipboard.writeText(flyerCaption(flyer));
      flash('text');
      toast.success('Texte copié — collez-le sous le flyer dans WhatsApp');
    } catch {
      toast.error('Copie impossible sur cet appareil');
    }
  };

  return (
    <div className="space-y-3">
      {/* ── Pays : un flyer par pays ── */}
      {sheets.length > 1 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Pays du flyer">
          {sheets.map((s) => (
            <Chip
              key={s.key}
              active={selected?.key === s.key}
              onClick={() => setCountryKey(s.key)}
              label={
                <span className="inline-flex items-center gap-2">
                  <CountryFlag iso={s.iso} size={20} />
                  {s.label}
                  <span className={cn('text-[14px] tabular-nums', selected?.key === s.key ? 'opacity-80' : TEXT.muted)}>
                    {s.isReference ? 'réf.' : formatCountryPct(s.percentage)}
                  </span>
                </span>
              }
            />
          ))}
        </div>
      )}

      {!flyer ? (
        <p className={cn(TYPE.body, TEXT.muted)}>Aucun taux publié : publiez les taux du jour pour obtenir le flyer.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" onClick={copyImage} disabled={!ready} className={cn('w-full', share && 'col-span-2')}>
              {copied === 'image' ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
              {copied === 'image' ? 'Copiée' : 'Copier l’image'}
            </Button>
            <Button variant="neutral" onClick={download} disabled={!ready} className="w-full">
              <Download className="h-5 w-5" />
              Télécharger
            </Button>
            {share && (
              <Button variant="neutral" onClick={shareImage} disabled={!ready} loading={saving} className="w-full">
                <Share2 className="h-5 w-5" />
                Partager
              </Button>
            )}
          </div>
          <Button variant="neutral" onClick={() => void copyCaption()} className="w-full">
            {copied === 'text' ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
            Copier le texte du jour
          </Button>
          <p className={cn(TYPE.small, TEXT.muted)}>
            {desktop ? 'Ou clic droit sur l’image › Copier l’image.' : 'Ou appui long sur l’image › Copier.'}
          </p>

          {/* L'aperçu EST l'image : le menu du navigateur (Copier l'image, Enregistrer) marche dessus. */}
          <div className="relative overflow-hidden rounded-lg bg-[#f5f3f8]" style={{ aspectRatio: `${FLYER_W} / ${FLYER_H}` }}>
            {image ? (
              <img src={image.url} alt={`Taux du jour · ${flyer.country.label}`} className={cn('block h-full w-full', !ready && 'opacity-40')} />
            ) : null}
            {!ready && (
              <div className={cn('absolute inset-0 flex items-center justify-center gap-2', TYPE.small, TEXT.muted)}>
                {failed ? 'Image impossible à créer — fermez et rouvrez le flyer.' : <><Loader2 className="h-5 w-5 animate-spin" /> Préparation de l’image…</>}
              </div>
            )}
          </div>

          {/* Le flyer à photographier : hors écran, en taille naturelle, jamais transformé. */}
          <div aria-hidden style={{ position: 'fixed', left: -20000, top: 0, width: FLYER_W, height: FLYER_H, pointerEvents: 'none' }}>
            <div ref={nodeRef} style={{ width: FLYER_W, height: FLYER_H }}>
              <RateFlyer data={flyer} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
