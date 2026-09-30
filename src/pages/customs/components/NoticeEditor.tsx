/**
 * Écrire ou corriger un avis de veille (équipe douane, canManageCustoms).
 * Le serveur revalide tout (customs_notice_upsert) ; ici, on aide à bien remplir.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { BottomSheet, Button, FormField, Line, Segmented, TextArea, TextInput, TEXT, TYPE } from '@/mobile/designKit';
import type { Confidence } from '@/lib/customs/levies';
import type { Notice, NoticeKind, NoticeStatus } from '@/lib/customs/notices';
import { useUpsertNotice, type NoticeDraft } from '@/hooks/useCustomsReview';

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'avis';

const EMPTY: NoticeDraft = {
  slug: '', kind: 'disruption', title: '', summary: '', advice: null, status: 'in_force', severity: 'medium',
  starts_on: null, ends_on: null, delay_days: null, hs_specs: [], places: [], source_label: null, source_url: null,
  confidence: 'marche', published: false,
};

export function NoticeEditor({ open, onClose, notice }: { open: boolean; onClose: () => void; notice: Notice | null }) {
  const { t } = useTranslation('customs');
  const upsert = useUpsertNotice();
  const [d, setD] = useState<NoticeDraft>(EMPTY);
  const [specs, setSpecs] = useState('');
  const [places, setPlaces] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [tried, setTried] = useState(false);

  // Chaque ouverture repart de l'avis choisi (ou d'une page blanche).
  useEffect(() => {
    if (!open) return;
    const base: NoticeDraft = notice ? { ...notice } : EMPTY;
    setD(base);
    setSpecs(base.hs_specs.join(', '));
    setPlaces(base.places.join(', '));
    setSlugTouched(!!notice);
    setTried(false);
  }, [open, notice]);

  const set = <K extends keyof NoticeDraft>(k: K, v: NoticeDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const errors = {
    title: d.title.trim().length < 3 ? t('watch.edit.titleRequired', { defaultValue: 'Un titre (3 caractères au moins).' }) : null,
    summary: d.summary.trim().length < 3 ? t('watch.edit.summaryRequired', { defaultValue: 'Un résumé.' }) : null,
    dates: d.starts_on && d.ends_on && d.ends_on < d.starts_on ? t('watch.edit.datesOrder', { defaultValue: 'La fin précède le début.' }) : null,
    url: d.source_url && !/^https:\/\/\S+$/.test(d.source_url) ? t('watch.edit.urlHttps', { defaultValue: 'Une adresse https://' }) : null,
  };

  const save = (publish: boolean) => {
    setTried(true);
    if (Object.values(errors).some(Boolean)) return;
    const payload: NoticeDraft = {
      ...d,
      slug: d.slug || slugify(d.title),
      title: d.title.trim(),
      summary: d.summary.trim(),
      advice: d.advice?.trim() || null,
      hs_specs: specs.split(/[,;\s]+/).map((s) => s.replace(/\D/g, '')).filter((s) => s.length >= 2),
      places: places.split(/[,;\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean),
      source_label: d.source_label?.trim() || null,
      source_url: d.source_url?.trim() || null,
      published: publish,
    };
    upsert.mutate(payload, {
      onSuccess: (r) => {
        toast.success(publish
          ? r.notified > 0
            ? t('watch.edit.publishedNotified', { count: r.notified, defaultValue: `Avis publié : ${r.notified} client(s) prévenu(s)` })
            : t('watch.edit.published', { defaultValue: 'Avis publié' })
          : t('watch.edit.saved', { defaultValue: 'Brouillon enregistré' }));
        onClose();
      },
      onError: (e) => toast.error((e as Error).message),
    });
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={notice ? t('watch.edit.titleEdit', { defaultValue: 'Corriger l’avis' }) : t('watch.edit.titleNew', { defaultValue: 'Nouvel avis' })}>
      <div className="space-y-4">
        <Segmented<NoticeKind> value={d.kind} onChange={(v) => set('kind', v)} options={[
          { value: 'disruption', label: t('watch.tabs.disruption', { defaultValue: 'Perturbation' }) },
          { value: 'regulation', label: t('watch.tabs.regulation', { defaultValue: 'Réglementation' }) },
        ]} />
        <FormField label={t('watch.edit.title', { defaultValue: 'Titre' })} htmlFor="nt-title" error={tried ? errors.title : null}>
          <TextInput id="nt-title" value={d.title} maxLength={160} onChange={(e) => {
            set('title', e.target.value);
            if (!slugTouched) set('slug', slugify(e.target.value));
          }} />
        </FormField>
        <FormField label={t('watch.edit.summary', { defaultValue: 'Ce qui se passe' })} htmlFor="nt-summary" error={tried ? errors.summary : null}
          hint={t('watch.edit.summaryHint', { defaultValue: 'Deux ou trois phrases, avec les chiffres.' })}>
          <TextArea id="nt-summary" rows={3} value={d.summary} maxLength={600} onChange={(e) => set('summary', e.target.value)} />
        </FormField>
        <FormField label={t('watch.edit.advice', { defaultValue: 'À faire (facultatif)' })} htmlFor="nt-advice">
          <TextArea id="nt-advice" rows={2} value={d.advice ?? ''} maxLength={1000} onChange={(e) => set('advice', e.target.value)} />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('watch.edit.start', { defaultValue: 'Début' })} htmlFor="nt-start">
            <TextInput id="nt-start" type="date" value={d.starts_on ?? ''} onChange={(e) => set('starts_on', e.target.value || null)} />
          </FormField>
          <FormField label={t('watch.edit.end', { defaultValue: 'Fin (facultatif)' })} htmlFor="nt-end" error={tried ? errors.dates : null}>
            <TextInput id="nt-end" type="date" value={d.ends_on ?? ''} onChange={(e) => set('ends_on', e.target.value || null)} />
          </FormField>
        </div>

        {d.kind === 'disruption' ? (
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('watch.edit.places', { defaultValue: 'Lieux' })} htmlFor="nt-places" hint={t('watch.edit.placesHint', { defaultValue: 'CN, CMDLA, CMKBI…' })}>
              <TextInput id="nt-places" value={places} onChange={(e) => setPlaces(e.target.value)} autoCapitalize="characters" />
            </FormField>
            <FormField label={t('watch.edit.delay', { defaultValue: 'Retard (jours)' })} htmlFor="nt-delay">
              <TextInput id="nt-delay" inputMode="numeric" value={d.delay_days ?? ''} onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '');
                set('delay_days', v ? Math.min(120, Number(v)) : null);
              }} />
            </FormField>
          </div>
        ) : (
          <div className="space-y-2">
            <p className={cn(TYPE.bodyStrong, TEXT.strong)}>{t('watch.edit.status', { defaultValue: 'Statut' })}</p>
            <Segmented<NoticeStatus> value={d.status} onChange={(v) => set('status', v)} options={[
              { value: 'in_force', label: t('watch.phase.in_force', { defaultValue: 'En vigueur' }) },
              { value: 'announced', label: t('watch.phase.announced', { defaultValue: 'Annoncé' }) },
              { value: 'watch', label: t('watch.phase.watch', { defaultValue: 'À confirmer' }) },
            ]} />
          </div>
        )}
        <FormField label={t('watch.edit.codes', { defaultValue: 'Codes SH visés (facultatif)' })} htmlFor="nt-codes"
          hint={t('watch.edit.codesHint', { defaultValue: 'Des préfixes : 61, 6704, 850440. À la publication, les clients qui ont classé un de ces produits sont prévenus.' })}>
          <TextInput id="nt-codes" inputMode="numeric" value={specs} onChange={(e) => setSpecs(e.target.value)} />
        </FormField>

        <div className="space-y-2">
          <p className={cn(TYPE.bodyStrong, TEXT.strong)}>{t('watch.edit.severity', { defaultValue: 'Gravité' })}</p>
          <Segmented<NoticeDraft['severity']> value={d.severity} onChange={(v) => set('severity', v)} options={[
            { value: 'low', label: t('watch.severity.low', { defaultValue: 'Faible' }) },
            { value: 'medium', label: t('watch.severity.medium', { defaultValue: 'Moyenne' }) },
            { value: 'high', label: t('watch.severity.high', { defaultValue: 'Forte' }) },
          ]} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label={t('watch.edit.sourceLabel', { defaultValue: 'Source' })} htmlFor="nt-src">
            <TextInput id="nt-src" value={d.source_label ?? ''} maxLength={200} onChange={(e) => set('source_label', e.target.value)} />
          </FormField>
          <FormField label={t('watch.edit.sourceUrl', { defaultValue: 'Lien (https)' })} htmlFor="nt-url" error={tried ? errors.url : null}>
            <TextInput id="nt-url" type="url" value={d.source_url ?? ''} onChange={(e) => set('source_url', e.target.value)} />
          </FormField>
        </div>
        <div className="space-y-2">
          <p className={cn(TYPE.bodyStrong, TEXT.strong)}>{t('watch.edit.confidence', { defaultValue: 'Confiance' })}</p>
          <Segmented<Confidence> value={d.confidence} onChange={(v) => set('confidence', v)} options={[
            { value: 'officiel', label: t('confidence.officiel') },
            { value: 'marche', label: t('confidence.marche') },
            { value: 'a_verifier', label: t('confidence.a_verifier') },
          ]} />
        </div>
        <FormField label={t('watch.edit.slug', { defaultValue: 'Identifiant' })} htmlFor="nt-slug" hint={t('watch.edit.slugHint', { defaultValue: 'Sert au lien de l’avis. Ne le changez pas après publication.' })}>
          <TextInput id="nt-slug" value={d.slug} maxLength={80} onChange={(e) => { setSlugTouched(true); set('slug', slugify(e.target.value)); }} />
        </FormField>

        <Line className={cn(TYPE.small, TEXT.muted)}>{t('watch.edit.honesty', { defaultValue: 'Un avis sans source se publie en « À vérifier ». Aucun chiffre sans texte ou sans témoin.' })}</Line>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" loading={upsert.isPending} onClick={() => save(true)}>{t('watch.edit.publish', { defaultValue: 'Publier' })}</Button>
          <Button variant="neutral" className="flex-1" disabled={upsert.isPending} onClick={() => save(false)}>{t('watch.edit.saveDraft', { defaultValue: 'Enregistrer en brouillon' })}</Button>
        </div>
      </div>
    </BottomSheet>
  );
}
