// ============================================================
// Classer un produit — /douane/classer (client connecté).
// L'IA propose, le commissionnaire agréé (CAD) signe (docs/douane/00-plan.md).
// On décrit le produit comme on le décrirait au transitaire — ses mots, pas
// ceux du tarif — et l'assistant fait le reste dans la fiche.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Camera, FileSearch, ScanSearch, BadgeCheck, X } from 'lucide-react';
import { cn, validateUploadFile } from '@/lib/utils';
import { Button, Card, FormField, Holder, ListRow, Line, ScreenError, SectionTitle, TextArea, TextInput, SURFACE, TEXT, TYPE, FOCUS_RING } from '@/mobile/designKit';
import { formatHs } from '@/lib/customs/hsCode';
import { useCreateClassification, useMyCustomsFiles } from '@/hooks/useCustomsFiles';
import { CustomsShell } from './shared';
import { ClassificationStatusPill } from './components/ClassificationParts';

const MAX_PHOTOS = 4;

export function ClassifyHomePage() {
  const { t } = useTranslation('customs');
  const navigate = useNavigate();
  const files = useMyCustomsFiles();
  const create = useCreateClassification();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [tried, setTried] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Les aperçus : une URL par photo, libérée quand la photo s'en va.
  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const nameError = tried && name.trim().length < 2 ? t('files.nameRequired', { defaultValue: 'Donnez un nom au produit.' }) : null;

  const addPhotos = (list: FileList | null) => {
    if (!list) return;
    const next = [...photos];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_PHOTOS) { toast.error(t('files.photosMax', { max: MAX_PHOTOS, defaultValue: `${MAX_PHOTOS} photos au plus` })); break; }
      try { validateUploadFile(f); } catch (e) { toast.error((e as Error).message); continue; }
      if (!f.type.startsWith('image/')) { toast.error(t('files.photoOnly', { defaultValue: 'Des photos seulement (JPG, PNG, WebP).' })); continue; }
      next.push(f);
    }
    setPhotos(next);
  };

  const submit = () => {
    setTried(true);
    if (name.trim().length < 2) return;
    create.mutate(
      { productName: name.trim(), description: description.trim(), photos },
      {
        onSuccess: (res) => navigate(`/douane/classer/${res.id}?start=1`),
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  const list = files.data?.classifications ?? [];

  return (
    <CustomsShell title={t('files.homeTitle', { defaultValue: 'Classer un produit' })} backTo="/douane">
      <div className="mx-auto max-w-2xl space-y-6 px-4 pb-12 pt-3">
        {/* Comment ça marche : trois temps, le dernier est une signature humaine. */}
        <Card className="space-y-4 p-5">
          <p className={cn(TYPE.title, TEXT.strong)}>{t('files.homeTagline', { defaultValue: 'Le bon code SH, signé par un commissionnaire agréé.' })}</p>
          <ol className="space-y-3">
            {[
              { icon: Camera, title: t('files.how1', { defaultValue: 'Vous décrivez le produit' }), text: t('files.how1Desc', { defaultValue: 'Avec vos mots, et des photos de la marchandise et de sa plaque.' }) },
              { icon: ScanSearch, title: t('files.how2', { defaultValue: 'L’assistant cherche dans le tarif' }), text: t('files.how2Desc', { defaultValue: 'Il pose les questions qui départagent, puis propose un à trois codes, avec ses raisons et le droit de chacun.' }) },
              { icon: BadgeCheck, title: t('files.how3', { defaultValue: 'Un commissionnaire agréé signe' }), text: t('files.how3Desc', { defaultValue: 'Il valide ou corrige. Le code signé devient votre référence, et vous pouvez en demander la confirmation à la douane (décision anticipée).' }) },
            ].map((s, i) => (
              <li key={i} className="flex gap-3">
                <Holder icon={s.icon} size="sm" />
                <div className="min-w-0">
                  <p className={cn(TYPE.bodyStrong, TEXT.strong)}>{s.title}</p>
                  <p className={cn(TYPE.body, TEXT.muted)}>{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        {/* La nouvelle fiche. */}
        <section className="space-y-4" aria-labelledby="new-file">
          <h2 id="new-file" className={cn(TYPE.lead, TEXT.strong)}>{t('files.newTitle', { defaultValue: 'Nouveau produit' })}</h2>
          <FormField label={t('files.name', { defaultValue: 'Le produit' })} htmlFor="cl-name" error={nameError}
            hint={t('files.nameHint', { defaultValue: 'Comme vous l’appelez : « régulateur 5 kVA », « chaises plastique », « mèches »…' })}>
            <TextInput id="cl-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} autoComplete="off" aria-invalid={!!nameError} />
          </FormField>
          <FormField label={t('files.description', { defaultValue: 'Ce qu’on en sait' })} htmlFor="cl-desc"
            hint={t('files.descriptionHint', { defaultValue: 'Matière, usage, fonctionnement, puissance, neuf ou usagé. Collez la description du fournisseur si vous l’avez.' })}>
            <TextArea id="cl-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} />
          </FormField>

          <div className="space-y-2">
            <p className={cn(TYPE.bodyStrong, TEXT.strong)}>{t('files.photos', { defaultValue: 'Photos' })} <span className={cn('font-normal', TEXT.muted)}>· {photos.length}/{MAX_PHOTOS}</span></p>
            <div className="grid grid-cols-4 gap-2">
              {previews.map((src, i) => (
                <div key={src} className={cn('relative aspect-square overflow-hidden rounded-lg', SURFACE.shadow)}>
                  <img src={src} alt={t('files.photoAlt', { n: i + 1, defaultValue: `Photo ${i + 1}` })} className="h-full w-full object-cover" />
                  <button type="button" onClick={() => setPhotos(photos.filter((_, k) => k !== i))}
                    aria-label={t('files.photoRemove', { n: i + 1, defaultValue: `Retirer la photo ${i + 1}` })}
                    className={cn('absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white', FOCUS_RING)}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button type="button" onClick={() => inputRef.current?.click()}
                  className={cn('flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[#949494] text-[14px] font-semibold dark:border-[#6E6E6E]', TEXT.body, FOCUS_RING)}>
                  <Camera className="h-6 w-6" aria-hidden />
                  {t('files.photoAdd', { defaultValue: 'Ajouter' })}
                </button>
              )}
            </div>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
              onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
            <p className={cn(TYPE.small, TEXT.muted)}>{t('files.photosHint', { defaultValue: 'La plaque signalétique et l’étiquette de composition départagent souvent deux codes.' })}</p>
          </div>

          <Button className="w-full" onClick={submit} loading={create.isPending}>
            <FileSearch aria-hidden /> {t('files.start', { defaultValue: 'Trouver le code' })}
          </Button>
          <p className={cn(TYPE.small, TEXT.faint)}>
            {t('files.privacy', { defaultValue: 'La description et les photos sont lues par notre assistant (Claude, d’Anthropic) puis par le commissionnaire agréé. Elles ne servent qu’à ce classement.' })}
          </p>
        </section>

        {/* Les fiches déjà ouvertes. */}
        {files.isError ? (
          <ScreenError className="min-h-0 py-6" description={(files.error as Error).message} onRetry={() => files.refetch()} />
        ) : list.length > 0 ? (
          <section>
            <SectionTitle>{t('files.mine', { defaultValue: 'Mes fiches' })}</SectionTitle>
            <div className={cn('rounded-lg px-4', SURFACE.card, SURFACE.shadow)}>
              {list.map((f) => {
                const code = f.final_code ?? f.proposed_code;
                return (
                  <ListRow
                    key={f.id}
                    title={f.product_name}
                    subtitle={
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                        <ClassificationStatusPill status={f.status} />
                        <span className="tabular-nums">{f.ref}</span>
                        {code && <span className={cn('tabular-nums', f.final_code && 'font-semibold text-[#009951] dark:text-[#14AE5C]')}>· {formatHs(code)}</span>}
                      </span>
                    }
                    onClick={() => navigate(`/douane/classer/${f.id}`)}
                  />
                );
              })}
            </div>
          </section>
        ) : files.isSuccess ? (
          <Line className={TEXT.muted}>{t('files.none', { defaultValue: 'Vos fiches de classement apparaîtront ici.' })}</Line>
        ) : null}
      </div>
    </CustomsShell>
  );
}

export default ClassifyHomePage;
