// ============================================================
// Classer un produit — /douane/classer (client connecté).
// L'IA propose, le commissionnaire agréé (CAD) signe (docs/douane/00-plan.md).
// On décrit le produit comme on le décrirait au transitaire — ses mots, pas
// ceux du tarif — et l'assistant fait le reste dans la fiche.
//
// Ordinateur : le formulaire à gauche, mes fiches et « comment ça marche »
// à droite. Téléphone : le formulaire, puis mes fiches.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Camera, ChevronRight, FileSearch, Loader2, X } from 'lucide-react';
import { cn, validateUploadFile } from '@/lib/utils';
import { formatHs } from '@/lib/customs/hsCode';
import { CLASSIFICATION_STATUS } from '@/lib/customs/files';
import { useCreateClassification, useMyCustomsFiles } from '@/hooks/useCustomsFiles';
import { SiteLayout } from './site/SiteLayout';
import { Button, Container, Field, Input, PageIntro, Reveal, StatusBadge, Textarea } from './site/ui';

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

  const nameError = tried && name.trim().length < 2 ? t('files.nameRequired') : null;

  const addPhotos = (list: FileList | null) => {
    if (!list) return;
    const next = [...photos];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_PHOTOS) { toast.error(t('files.photosMax', { max: MAX_PHOTOS })); break; }
      try { validateUploadFile(f); } catch (e) { toast.error((e as Error).message); continue; }
      if (!f.type.startsWith('image/')) { toast.error(t('files.photoOnly')); continue; }
      next.push(f);
    }
    setPhotos(next);
  };

  const submit = () => {
    setTried(true);
    if (name.trim().length < 2) return;
    create.mutate(
      { productName: name.trim(), description: description.trim(), photos },
      { onSuccess: (res) => navigate(`/douane/classer/${res.id}?start=1`), onError: (e) => toast.error((e as Error).message) },
    );
  };

  const list = files.data?.classifications ?? [];
  const steps = [t('files.how1'), t('files.how2'), t('files.how3')];
  const stepText = [t('files.how1Desc'), t('files.how2Desc'), t('files.how3Desc')];

  return (
    <SiteLayout>
      <PageIntro title={t('files.homeTitle')} subtitle={t('site.classify.subtitle')} back={{ to: '/douane', label: t('site.badge') }} />
      <Container className="grid gap-8 pb-20 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12">
        {/* La nouvelle fiche. */}
        <section aria-labelledby="dz-new" className="min-w-0 rounded-3xl border border-dz-line bg-dz-card p-5 sm:p-7">
          <h2 id="dz-new" className="text-[20px] font-bold">{t('files.newTitle')}</h2>
          <div className="mt-5 space-y-5">
            <Field label={t('files.name')} htmlFor="cl-name" hint={nameError ?? t('files.nameHint')}>
              <Input id="cl-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} autoComplete="off" aria-invalid={!!nameError}
                className={cn(nameError && 'border-dz-bad focus:border-dz-bad')} />
            </Field>
            <Field label={t('files.description')} htmlFor="cl-desc" hint={t('files.descriptionHint')}>
              <Textarea id="cl-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} />
            </Field>

            <div className="space-y-2">
              <p className="text-[15px] font-semibold">{t('files.photos')} <span className="font-normal text-dz-ink3">· {photos.length}/{MAX_PHOTOS}</span></p>
              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                {previews.map((src, i) => (
                  <div key={src} className="relative aspect-square overflow-hidden rounded-2xl border border-dz-line">
                    <img src={src} alt={t('files.photoAlt', { n: i + 1 })} className="h-full w-full object-cover" />
                    <button type="button" onClick={() => setPhotos(photos.filter((_, k) => k !== i))} aria-label={t('files.photoRemove', { n: i + 1 })}
                      className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white">
                      <X aria-hidden className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <button type="button" onClick={() => inputRef.current?.click()}
                    className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-dz-ink3/40 text-[14px] font-semibold text-dz-ink2 transition-colors hover:border-dz-ink/40 hover:bg-dz-soft">
                    <Camera aria-hidden className="h-6 w-6" />{t('files.photoAdd')}
                  </button>
                )}
              </div>
              <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
                onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
              <p className="text-[14px] text-dz-ink3">{t('files.photosHint')}</p>
            </div>

            <Button size="lg" className="w-full" onClick={submit} disabled={create.isPending}>
              {create.isPending ? <Loader2 aria-hidden className="animate-spin" /> : <FileSearch aria-hidden />} {t('files.start')}
            </Button>
            <p className="text-[14px] leading-relaxed text-dz-ink3">{t('files.privacy')}</p>
          </div>
        </section>

        <div className="min-w-0 space-y-8 lg:sticky lg:top-24 lg:self-start">
          {list.length > 0 && (
            <section aria-labelledby="dz-mine">
              <h2 id="dz-mine" className="text-[18px] font-bold">{t('files.mine')}</h2>
              <ul className="mt-3 overflow-hidden rounded-2xl border border-dz-line bg-dz-card">
                {list.map((f, i) => {
                  const code = f.final_code ?? f.proposed_code;
                  const meta = CLASSIFICATION_STATUS[f.status];
                  return (
                    <Reveal as="li" key={f.id} delay={Math.min(i, 5) * 0.04} y={6} className="border-b border-dz-line last:border-b-0">
                      <Link to={`/douane/classer/${f.id}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-dz-soft">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[16px] font-semibold">{f.product_name}</span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[14px] text-dz-ink3">
                            <StatusBadge tone={meta.tone}>{t(`files.status.${f.status}`, { defaultValue: meta.fr })}</StatusBadge>
                            {code && <span className={cn('tabular-nums', f.final_code ? 'font-bold text-dz-ink' : '')}>{formatHs(code)}</span>}
                          </span>
                        </span>
                        <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-dz-ink3" />
                      </Link>
                    </Reveal>
                  );
                })}
              </ul>
            </section>
          )}
          {files.isError && <p className="rounded-2xl bg-dz-soft p-4 text-[15px]">{(files.error as Error).message}</p>}

          <section aria-labelledby="dz-how">
            <h2 id="dz-how" className="text-[18px] font-bold">{t('site.classify.how')}</h2>
            <ol className="mt-4 space-y-4">
              {steps.map((s, i) => (
                <li key={s} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-dz-brand-soft text-[14px] font-bold text-dz-brand">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block text-[16px] font-semibold">{s}</span>
                    <span className="mt-0.5 block text-[14px] leading-snug text-dz-ink3">{stepText[i]}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </Container>
    </SiteLayout>
  );
}

export default ClassifyHomePage;
