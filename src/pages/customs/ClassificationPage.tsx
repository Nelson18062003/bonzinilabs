// ============================================================
// Une fiche de classement — /douane/classer/:id (client connecté).
// La conversation avec l'assistant, les codes qu'il propose, puis la
// signature du commissionnaire agréé et la lettre de décision anticipée.
//
// Ordinateur : la conversation au centre, l'état de la fiche et ses actions
// à droite (toujours visibles). Téléphone : l'état en haut, la conversation,
// puis la zone de réponse collée en bas, à portée du pouce.
// ============================================================
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowUp, BadgeCheck, Calculator, Copy, Download, Hourglass, Loader2, MessageCircleQuestion, Scale, Send, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/lib/clipboard';
import { formatHs } from '@/lib/customs/hsCode';
import {
  CLASSIFICATION_STATUS, advanceRulingLetter, isEditable, isSigned, latestProposal, marketHints, pendingQuestion, type Classification,
} from '@/lib/customs/files';
import {
  useCancelClassification, useClassification, useClassify, useMyCustomsPhotoUrls, usePostClassification, useSubmitClassification,
} from '@/hooks/useCustomsFiles';
import { Conversation, Thinking } from './site/classify/Conversation';
import { SiteLayout } from './site/SiteLayout';
import { Button, ButtonLink, Container, PageIntro, Sheet, StatusBadge, Textarea } from './site/ui';

const SIMULATE = '/douane/simulateur';

/** Les pistes du marché tirées de tout ce que le client a écrit sur ce produit. */
function hintsOf(c: Classification, extra = '') {
  const said = c.messages.filter((m) => m.author === 'client').map((m) => m.body);
  return marketHints([c.product_name, c.description ?? '', ...said, extra].join(' \n '));
}

/** La lettre en texte brut : pour la copier dans un traitement de texte ou la télécharger. */
const plain = (letter: string) => letter.replace(/^## /gm, '').replace(/\*\*/g, '');

function Shell({ c, children }: { c?: Classification; children: ReactNode }) {
  const { t } = useTranslation('customs');
  const meta = c ? CLASSIFICATION_STATUS[c.status] : null;
  return (
    <SiteLayout>
      <PageIntro title={c?.product_name ?? t('files.homeTitle')} subtitle={c?.ref} back={{ to: '/douane/classer', label: t('files.homeTitle') }}
        actions={c && meta ? <StatusBadge tone={meta.tone}>{t(`files.status.${c.status}`, { defaultValue: meta.fr })}</StatusBadge> : undefined} />
      <Container className="pb-10">{children}</Container>
    </SiteLayout>
  );
}

/** Où en est la fiche, et ce que le client peut faire maintenant. */
function StatePanel({ c, onLetter }: { c: Classification; onLetter: () => void }) {
  const { t } = useTranslation('customs');
  if (isSigned(c.status) && c.final_code) {
    const when = c.reviewed_at ? new Date(c.reviewed_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    const title = c.candidates.find((x) => x.code === c.final_code!.slice(0, 6))?.title;
    return (
      <div className="rounded-3xl bg-dz-primary p-6 text-dz-on-primary">
        <p className="flex items-center gap-2 text-[15px] font-semibold opacity-80"><BadgeCheck aria-hidden className="h-5 w-5" /> {t('files.signedTitle')}</p>
        <p className="mt-3 text-[36px] font-bold leading-none tracking-[-0.02em] tabular-nums">{formatHs(c.final_code)}</p>
        {title && <p className="mt-2 text-[16px] opacity-80">{title}</p>}
        <p className="mt-3 text-[14px] opacity-60">{t('files.signedBy', { company: c.broker_company, license: c.broker_license_no, date: when })}</p>
        {c.broker_note && <p className="mt-4 rounded-2xl bg-dz-on-primary/10 p-4 text-[15px] leading-snug">{c.broker_note}</p>}
        <div className="mt-5 grid gap-2">
          <Link to={`${SIMULATE}?c=${c.final_code.slice(0, 6)}`}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-dz-on-primary px-5 py-2.5 text-center text-[16px] font-semibold leading-tight text-dz-primary transition-transform active:scale-[0.98]">
            <Calculator aria-hidden className="h-[18px] w-[18px]" /> {t('files.simulate')}
          </Link>
          <button type="button" onClick={onLetter}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-dz-on-primary/25 px-5 py-2.5 text-center text-[16px] font-semibold leading-tight transition-colors hover:bg-dz-on-primary/10">
            <Scale aria-hidden className="h-[18px] w-[18px]" /> {t('files.letterCta')}
          </button>
        </div>
      </div>
    );
  }
  if (c.status === 'submitted' || c.status === 'in_review') {
    return (
      <div className="flex gap-4 rounded-3xl bg-dz-warn-soft p-5">
        <Hourglass aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-dz-warn" />
        <div className="min-w-0">
          <p className="text-[16px] font-semibold">{t('files.atBroker')}</p>
          <p className="mt-1 text-[15px] leading-snug text-dz-ink2">{t('files.atBrokerDesc')}</p>
        </div>
      </div>
    );
  }
  if (c.status === 'needs_info') {
    return (
      <div className="flex gap-4 rounded-3xl bg-dz-warn-soft p-5">
        <MessageCircleQuestion aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-dz-warn" />
        <div className="min-w-0">
          <p className="text-[16px] font-semibold">{t('files.needsInfo')}</p>
          <p className="mt-1 text-[15px] leading-snug text-dz-ink2">{t('files.needsInfoDesc')}</p>
        </div>
      </div>
    );
  }
  return null;
}

export function ClassificationPage() {
  const { t } = useTranslation('customs');
  const navigate = useNavigate();
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const q = useClassification(id);
  const post = usePostClassification(id);
  const classify = useClassify(id);
  const submit = useSubmitClassification(id);
  const cancel = useCancelClassification(id);
  const photos = useMyCustomsPhotoUrls(q.data?.photo_paths);

  const [draft, setDraft] = useState('');
  const [sheet, setSheet] = useState<'submit' | 'cancel' | 'letter' | null>(null);
  const started = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const seen = useRef<number | null>(null);

  const c = q.data;
  const busy = post.isPending || classify.isPending;

  // Première visite après la création : l'assistant commence tout seul.
  useEffect(() => {
    if (!c || started.current || !params.get('start')) return;
    started.current = true;
    setParams({}, { replace: true });
    if (c.status === 'draft' && !c.messages.some((m) => m.author === 'assistant')) classify.mutate(hintsOf(c));
  }, [c, params, setParams, classify]);

  // On suit la conversation quand elle avance — pas au premier affichage (une fiche signée se lit d'en haut).
  const count = (c?.messages.length ?? 0) + (busy ? 1 : 0);
  useEffect(() => {
    if (!c) return;
    if (seen.current !== null && count > seen.current) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    seen.current = count;
  }, [c, count]);

  if (q.isLoading) {
    return <Shell><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]" aria-busy="true">
      <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-[28px] bg-dz-fill" />)}</div>
      <div className="hidden h-60 animate-pulse rounded-[28px] bg-dz-fill lg:block" />
    </div></Shell>;
  }
  if (q.isError || !c) {
    return <Shell><div className="rounded-[28px] bg-dz-card p-6">
      <p className="text-[16px]">{(q.error as Error | null)?.message}</p>
      <Button className="mt-4" variant="secondary" onClick={() => { void q.refetch(); }}>{t('site.retry')}</Button>
    </div></Shell>;
  }

  const editable = isEditable(c.status);
  const proposal = latestProposal(c.messages);
  const question = pendingQuestion(c.messages);
  const canSubmit = editable && !busy && (proposal || c.status === 'needs_info');

  /** Répondre : le message part, puis l'assistant reprend (sauf quand c'est le commissionnaire qui a posé la question). */
  const send = async (text: string) => {
    const body = text.trim();
    if (!body || busy) return;
    try {
      await post.mutateAsync(body);
      setDraft('');
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }
    if (c.status === 'draft') classify.mutate(hintsOf(c, body));
  };

  const letter = isSigned(c.status) ? advanceRulingLetter(c) : '';
  const download = () => {
    const blob = new Blob([plain(letter)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decision-anticipee-${c.ref}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const actions = (
    <div className="space-y-2">
      {canSubmit && (
        <div className="rounded-[28px] bg-dz-card p-5">
          <p className="text-[16px] font-semibold">{c.status === 'needs_info' ? t('files.resubmitTitle') : t('files.submitTitle')}</p>
          <p className="mt-1 text-[15px] leading-snug text-dz-ink3">{t('files.submitDesc')}</p>
          <Button className="mt-4 h-auto min-h-12 w-full whitespace-normal py-3" onClick={() => setSheet('submit')}>
            <Send aria-hidden /> {c.status === 'needs_info' ? t('files.resubmitCta') : t('files.submitCta')}
          </Button>
        </div>
      )}
      {editable && !proposal && !busy && !question && c.status === 'draft' && !classify.isError && c.messages.some((m) => m.author === 'assistant') && (
        <Button variant="secondary" className="w-full" onClick={() => setSheet('submit')}>{t('files.sendDirect')}</Button>
      )}
      {editable && (
        <ButtonLink to={`/douane/fournisseurs?classification=${c.id}`} variant="ghost" className="h-auto min-h-12 w-full whitespace-normal py-3">
          <Users aria-hidden /> {t('files.askSupplier')}
        </ButtonLink>
      )}
      {c.status === 'cancelled' && <ButtonLink to="/douane/classer" variant="secondary" className="w-full">{t('files.newTitle')}</ButtonLink>}
      {c.status !== 'cancelled' && !isSigned(c.status) && (
        <button type="button" onClick={() => setSheet('cancel')} className="w-full py-3 text-center text-[15px] font-medium text-dz-bad hover:underline">{t('files.cancelCta')}</button>
      )}
    </div>
  );

  return (
    <Shell c={c}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
        <div className="min-w-0 space-y-5">
          <div className="lg:hidden"><StatePanel c={c} onLetter={() => setSheet('letter')} /></div>

          {/* Le produit tel que le client l'a décrit. */}
          {(c.description || c.photo_paths.length > 0) && (
            <div className="rounded-[28px] bg-dz-card p-5">
              {c.description && <p className="whitespace-pre-line text-[16px] leading-relaxed text-dz-ink2">{c.description}</p>}
              {photos.data && photos.data.length > 0 && (
                <div className="mt-4 grid grid-cols-4 gap-2 sm:max-w-[420px]">
                  {photos.data.map((src, i) => (
                    <a key={src} href={src} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-2xl border border-dz-line">
                      <img src={src} alt={t('files.photoAlt', { n: i + 1 })} className="h-full w-full object-cover" loading="lazy" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* La conversation. */}
          <section aria-label={t('files.thread')} className="space-y-3">
            <Conversation messages={c.messages} simulateBase={SIMULATE} optionsEnabled={editable && !busy} onOption={(o) => void send(o)} />
            {busy && <Thinking />}
            {classify.isError && !busy && (
              <div className="rounded-3xl bg-dz-card p-5">
                <p className="text-[15px] font-semibold text-dz-bad">{(classify.error as Error).message}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => classify.mutate(hintsOf(c))}>{t('files.retry')}</Button>
                  {editable && <Button size="sm" variant="ghost" onClick={() => setSheet('submit')}>{t('files.sendDirect')}</Button>}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </section>

          <div className="lg:hidden">{actions}</div>

          {/* Écrire : en bas, toujours à portée du pouce. */}
          {editable && (
            <form className="sticky bottom-0 z-20 -mx-5 flex items-end gap-2 bg-dz-bg/90 px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:-mx-8 sm:px-8 lg:bottom-4 lg:mx-0 lg:rounded-[28px] lg:bg-dz-card lg:p-2 lg:shadow-[0_12px_40px_-12px_rgba(20,10,40,.25),0_0_0_1px_rgba(0,0,0,.05)]"
              onSubmit={(e) => { e.preventDefault(); void send(draft); }}>
              <label htmlFor="cl-reply" className="sr-only">{t('files.reply')}</label>
              <Textarea id="cl-reply" rows={1} value={draft} onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(draft); } }}
                placeholder={question ? t('files.replyQuestion') : t('files.replyFree')} maxLength={4000}
                className="max-h-40 min-h-12 flex-1 resize-none rounded-[22px] bg-dz-card py-3 ring-1 ring-dz-ink/10 lg:bg-dz-soft lg:ring-0" />
              <button type="submit" aria-label={t('files.send')} disabled={!draft.trim() || busy}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-dz-primary text-dz-on-primary transition-opacity disabled:opacity-30">
                {busy ? <Loader2 aria-hidden className="h-5 w-5 animate-spin" /> : <ArrowUp aria-hidden className="h-5 w-5" />}
              </button>
            </form>
          )}
        </div>

        <aside className="hidden space-y-4 lg:sticky lg:top-24 lg:block lg:self-start">
          <StatePanel c={c} onLetter={() => setSheet('letter')} />
          {actions}
        </aside>
      </div>

      <Sheet open={sheet === 'submit'} onClose={() => setSheet(null)} title={t('files.submitSheetTitle')}>
        <p className="text-[16px] leading-relaxed text-dz-ink2">{t('files.submitSheet')}</p>
        <div className="mt-6 grid gap-2">
          <Button size="lg" disabled={submit.isPending} onClick={() => submit.mutate(undefined, {
            onSuccess: () => { setSheet(null); toast.success(t('files.submitted')); },
            onError: (e) => toast.error((e as Error).message),
          })}>
            {submit.isPending ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />} {t('files.submitConfirm')}
          </Button>
          <Button variant="ghost" onClick={() => setSheet(null)}>{t('files.keep')}</Button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'cancel'} onClose={() => setSheet(null)} title={t('files.cancelSheetTitle')}>
        <p className="text-[16px] leading-relaxed text-dz-ink2">{t('files.cancelSheet')}</p>
        <div className="mt-6 grid gap-2">
          <Button size="lg" className="bg-dz-bad text-white hover:bg-dz-bad/90" disabled={cancel.isPending} onClick={() => cancel.mutate(undefined, {
            onSuccess: () => navigate('/douane/classer'),
            onError: (e) => toast.error((e as Error).message),
          })}>{t('files.cancelConfirm')}</Button>
          <Button variant="ghost" onClick={() => setSheet(null)}>{t('files.keep')}</Button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'letter'} onClose={() => setSheet(null)} title={t('files.letterTitle')}>
        <p className="text-[16px] leading-relaxed text-dz-ink2">{t('files.letterIntro')}</p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button onClick={() => void copyToClipboard(plain(letter), t('files.letterCopied'))}><Copy aria-hidden /> {t('files.letterCopy')}</Button>
          <Button variant="secondary" onClick={download}><Download aria-hidden /> {t('files.letterDownload')}</Button>
        </div>
        <LetterPreview text={letter} />
      </Sheet>
    </Shell>
  );
}

/** La lettre, lisible : titres, gras, puces. Pas de HTML injecté — du texte, ligne à ligne. */
function LetterPreview({ text }: { text: string }) {
  return (
    <div className="mt-5 space-y-1 rounded-2xl bg-dz-soft p-5 text-[15px] leading-relaxed text-dz-ink2">
      {text.split('\n').map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;
        if (line.startsWith('## ')) return <p key={i} className="pt-2 font-semibold text-dz-ink">{line.slice(3)}</p>;
        const bold = /^\*\*(.*)\*\*$/.exec(line);
        if (bold) return <p key={i} className={cn('font-semibold text-dz-ink')}>{bold[1]}</p>;
        return <p key={i}>{line.replace(/\*\*/g, '')}</p>;
      })}
    </div>
  );
}

export default ClassificationPage;
