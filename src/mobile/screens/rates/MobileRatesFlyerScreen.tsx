/**
 * Flyer du jour (maquettes 08-taux/25 et 26).
 *
 * Le pays en pastilles, la langue, puis le VRAI flyer (RateFlyer : couleurs,
 * mise en page et tranches en rouge inchangées — c'est ce que reçoivent les
 * clients), photographié en PNG : ce qu'on voit est ce qu'on partage.
 * « Partager sur WhatsApp » ouvre la feuille de partage du téléphone (qui
 * propose aussi Enregistrer l'image) et télécharge sur ordinateur ; « L'image »
 * la copie ; « La légende » copie le texte du jour. « … » : Télécharger.
 */
import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, Copy, Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RateFlyer } from '@/mobile/components/rates/RateFlyer';
import { useFlyerImage } from '@/mobile/components/rates/useFlyerImage';
import { FLYER_H, FLYER_W } from '@/lib/exportFlyer';
import { REFERENCE_COUNTRY_KEY } from '@/lib/countryRates';
import { FLYER_BRAND, buildFlyerData, flyerCaption, flyerTitle, type FlyerLang } from '@/lib/rateFlyer';
import { copyImageFile, deliverFile, downloadFile } from '@/components/customer-code/exportShippingLabel';
import { ActionSheet, BigButton, Chip, Dock, EmptyLine, MoreButton, ScreenTop, TEXT, useSheet } from '@/mobile/designKit';
import { ChipRow, DockSpacer, FlagCircle } from './parts';
import { useRatesData } from './useRatesData';

const LANG_KEY = 'bz.flyer.lang';
function savedLang(): FlyerLang {
  try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'fr'; } catch { return 'fr'; }
}

/** Le logo WhatsApp (glyphe officiel), à la couleur du texte du bouton. */
function WhatsAppGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.42.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35M12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37A9.86 9.86 0 0 1 2.16 12C2.16 6.55 6.6 2.11 12.06 2.11c2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.89-9.89 9.89m8.41-18.3A11.82 11.82 0 0 0 12.05.01C5.5.01.16 5.34.16 11.9c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.69 1.45h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.17-3.48-8.41" />
    </svg>
  );
}

export function MobileRatesFlyerScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const more = useSheet();
  const { activeRate, adjustments, sheets } = useRatesData();
  const [countryKey, setCountryKey] = useState<string>(params.get('country') ?? REFERENCE_COUNTRY_KEY);
  const [lang, setLangState] = useState<FlyerLang>(savedLang);
  const setLang = (l: FlyerLang) => { setLangState(l); try { localStorage.setItem(LANG_KEY, l); } catch { /* navigation privée */ } };
  const [copied, setCopied] = useState<'image' | 'text' | null>(null);
  const [sharing, setSharing] = useState(false);
  const copying = useRef(false);

  const selected = sheets.find((s) => s.key === countryKey) ?? sheets.find((s) => s.isReference) ?? null;
  const flyer = useMemo(
    () => (activeRate ? buildFlyerData(activeRate, adjustments, selected?.key ?? REFERENCE_COUNTRY_KEY, new Date(), lang) : null),
    [activeRate, adjustments, selected?.key, lang],
  );
  const { nodeRef, image, ready, failed, retry } = useFlyerImage(flyer);

  const flash = (what: 'image' | 'text') => { setCopied(what); setTimeout(() => setCopied((c) => (c === what ? null : c)), 2200); };

  const share = () => {
    if (!ready || !image || sharing || !flyer) return;
    setSharing(true);
    void deliverFile(image.file, `${FLYER_BRAND} · ${flyerTitle(flyer.lang)} · ${flyer.country.label}`)
      .then((o) => { if (o === 'downloaded') toast.success('Image téléchargée'); })
      .finally(() => setSharing(false));
  };
  // Pas d'attente avant l'écriture : Safari n'accepte le presse-papiers que dans le geste.
  const copyImage = () => {
    if (!ready || !image || copying.current) return;
    copying.current = true;
    void copyImageFile(image.file)
      .then((o) => {
        if (o === 'copied') { flash('image'); toast.success('Image copiée'); }
        else if (o === 'downloaded') toast.success('Image téléchargée');
      })
      .finally(() => { copying.current = false; });
  };
  const copyCaption = async () => {
    if (!flyer) return;
    try {
      await navigator.clipboard.writeText(flyerCaption(flyer));
      flash('text');
      toast.success('Légende copiée');
    } catch {
      toast.error('Copie impossible sur cet appareil');
    }
  };
  const download = () => {
    if (!ready || !image) return;
    downloadFile(image.file);
    toast.success('Image téléchargée');
  };

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop title="Flyer du jour" backTo="/m/more/rates" right={<MoreButton onClick={more.show} />} />

      {sheets.length > 1 && (
        <ChipRow className="pt-4" >
          {sheets.map((s) => (
            <Chip
              key={s.key}
              active={selected?.key === s.key}
              onClick={() => setCountryKey(s.key)}
              className="pl-2"
              label={<span className="inline-flex items-center gap-2"><FlagCircle iso={s.iso} size={28} />{s.label}</span>}
            />
          ))}
        </ChipRow>
      )}
      <div className="flex gap-2 px-5 pt-3">
        <Chip label="Français" active={lang === 'fr'} onClick={() => setLang('fr')} />
        <Chip label="English" active={lang === 'en'} onClick={() => setLang('en')} />
      </div>

      {!flyer ? (
        <EmptyLine action={{ label: 'Publier les taux', onClick: () => navigate('/m/more/rates/publish') }}>Aucun taux publié</EmptyLine>
      ) : (
        <>
          {/* L'aperçu EST l'image : l'appui long du navigateur (Copier, Enregistrer) marche dessus. */}
          <div className="px-5 pt-4">
            <div className="relative mx-auto w-[82%] overflow-hidden rounded-lg border border-[#D9D9D9] bg-[#f5f3f8] dark:border-[#444444]" style={{ aspectRatio: `${FLYER_W} / ${FLYER_H}` }}>
              {image && <img src={image.url} alt={`${flyerTitle(flyer.lang)} · ${flyer.country.label}`} className={cn('block h-full w-full', !ready && 'opacity-40')} />}
              {!ready && (
                <div className={cn('absolute inset-0 flex items-center justify-center gap-2 px-6 text-center text-[16px]', TEXT.muted)}>
                  {failed ? (
                    <div className="flex flex-col items-center gap-3">
                      <span>Image impossible à créer</span>
                      <button type="button" onClick={retry} className={cn('rounded text-[16px] font-semibold underline underline-offset-[3px]', TEXT.strong)}>Réessayer</button>
                    </div>
                  ) : <><Loader2 className="h-5 w-5 animate-spin" /> Préparation…</>}
                </div>
              )}
            </div>
          </div>

          {/* Le flyer à photographier : hors écran, en taille naturelle, jamais transformé. */}
          <div aria-hidden style={{ position: 'fixed', left: -20000, top: 0, width: FLYER_W, height: FLYER_H, pointerEvents: 'none' }}>
            <div ref={nodeRef} style={{ width: FLYER_W, height: FLYER_H }}>
              <RateFlyer data={flyer} />
            </div>
          </div>

          <DockSpacer />
          <Dock>
            <BigButton onClick={share} disabled={!ready} loading={sharing}><WhatsAppGlyph /> Partager sur WhatsApp</BigButton>
            <div className="grid grid-cols-2 gap-2.5">
              <BigButton variant="soft" onClick={copyImage} disabled={!ready}>
                {copied === 'image' ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />} L’image
              </BigButton>
              <BigButton variant="soft" onClick={() => void copyCaption()}>
                {copied === 'text' ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />} La légende
              </BigButton>
            </div>
          </Dock>
        </>
      )}

      <ActionSheet
        open={more.open}
        onClose={more.hide}
        actions={[
          { label: 'Télécharger l’image', icon: Download, onClick: download, disabled: !ready },
          { label: 'Copier la légende', icon: Copy, onClick: () => void copyCaption(), disabled: !flyer },
        ]}
      />
    </div>
  );
}
