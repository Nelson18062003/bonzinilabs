// ============================================================
// Une fiche de classement — /douane/classer/:id (client connecté).
// La conversation avec l'assistant, les codes qu'il propose, puis la
// signature du commissionnaire agréé et la lettre de décision anticipée.
// ============================================================
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowUp, Copy, Download, Hourglass, MessageCircleQuestion, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/lib/clipboard';
import {
  BottomSheet, Button, Card, Holder, IconButton, Line, ScreenError, ScreenLoader, TextArea, SURFACE, TEXT, TYPE,
} from '@/mobile/designKit';
import {
  advanceRulingLetter, isEditable, isSigned, latestProposal, marketHints, pendingQuestion, type Classification,
} from '@/lib/customs/files';
import {
  useCancelClassification, useClassification, useClassify, useMyCustomsPhotoUrls, usePostClassification, useSubmitClassification,
} from '@/hooks/useCustomsFiles';
import { CustomsShell } from './shared';
import { ClassificationStatusPill, SignedCard, Thread, ThinkingBubble } from './components/ClassificationParts';

const SIMULATE = '/douane/simulateur';

/** Les pistes du marché tirées de tout ce que le client a écrit sur ce produit. */
function hintsOf(c: Classification, extra = '') {
  const said = c.messages.filter((m) => m.author === 'client').map((m) => m.body);
  return marketHints([c.product_name, c.description ?? '', ...said, extra].join(' \n '));
}

/** La lettre en texte brut : pour la copier dans un traitement de texte ou la télécharger. */
const plain = (letter: string) => letter.replace(/^## /gm, '').replace(/\*\*/g, '');

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

  const shell = (children: ReactNode) => (
    <CustomsShell title={c?.product_name ?? t('files.homeTitle', { defaultValue: 'Classer un produit' })} subtitle={c?.ref} backTo="/douane/classer">
      {children}
    </CustomsShell>
  );

  if (q.isLoading) return shell(<ScreenLoader />);
  if (q.isError || !c) {
    return shell(<ScreenError description={(q.error as Error | null)?.message} onRetry={() => q.refetch()} />);
  }

  const editable = isEditable(c.status);
  const proposal = latestProposal(c.messages);
  const question = pendingQuestion(c.messages);

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

  return shell(
    <div className="mx-auto max-w-2xl space-y-5 px-4 pb-4 pt-3">
      {/* Où en est la fiche. */}
      {isSigned(c.status) ? (
        <SignedCard c={c} simulateBase={SIMULATE} onLetter={() => setSheet('letter')} />
      ) : c.status === 'submitted' || c.status === 'in_review' ? (
        <Card className="flex gap-3 p-4">
          <Holder icon={Hourglass} tone="pending" size="sm" />
          <div className="min-w-0 space-y-1">
            <p className={cn(TYPE.bodyStrong, TEXT.strong)}>{t('files.atBroker', { defaultValue: 'Chez le commissionnaire agréé' })}</p>
            <p className={cn(TYPE.body, TEXT.muted)}>{t('files.atBrokerDesc', { defaultValue: 'Il relit la fiche, les photos et la proposition. Vous recevrez une notification dès qu’il a signé, ou s’il a besoin d’une précision.' })}</p>
          </div>
        </Card>
      ) : c.status === 'needs_info' ? (
        <Card className="flex gap-3 border-[#E8B931] p-4 dark:border-[#E8B931]">
          <Holder icon={MessageCircleQuestion} tone="pending" size="sm" />
          <div className="min-w-0 space-y-1">
            <p className={cn(TYPE.bodyStrong, TEXT.strong)}>{t('files.needsInfo', { defaultValue: 'Le commissionnaire a une question' })}</p>
            <p className={cn(TYPE.body, TEXT.muted)}>{t('files.needsInfoDesc', { defaultValue: 'Répondez-lui en bas de la conversation, puis renvoyez-lui la fiche.' })}</p>
          </div>
        </Card>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <ClassificationStatusPill status={c.status} />
          {c.status === 'cancelled' && <Button size="sm" variant="neutral" onClick={() => navigate('/douane/classer')}>{t('files.newTitle', { defaultValue: 'Nouveau produit' })}</Button>}
        </div>
      )}

      {/* Le produit tel que le client l'a décrit. */}
      {(c.description || c.photo_paths.length > 0) && (
        <Card className="space-y-3 p-4">
          {c.description && <p className={cn('whitespace-pre-line', TYPE.body, TEXT.body)}>{c.description}</p>}
          {photos.data && photos.data.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {photos.data.map((src, i) => (
                <a key={src} href={src} target="_blank" rel="noreferrer" className={cn('block aspect-square overflow-hidden rounded-lg', SURFACE.shadow)}>
                  <img src={src} alt={t('files.photoAlt', { n: i + 1, defaultValue: `Photo ${i + 1}` })} className="h-full w-full object-cover" loading="lazy" />
                </a>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* La conversation. */}
      <section aria-label={t('files.thread', { defaultValue: 'Conversation' })} className="space-y-3">
        <Thread messages={c.messages} simulateBase={SIMULATE} optionsEnabled={editable && !busy} onOption={(o) => void send(o)} />
        {busy && <ThinkingBubble />}
        {classify.isError && !busy && (
          <Card className="space-y-3 p-4">
            <Line tone="bad">{(classify.error as Error).message}</Line>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="neutral" onClick={() => classify.mutate(hintsOf(c))}>{t('files.retry', { defaultValue: 'Réessayer' })}</Button>
              {editable && <Button size="sm" variant="subtle" onClick={() => setSheet('submit')}>{t('files.sendDirect', { defaultValue: 'Envoyer au commissionnaire' })}</Button>}
            </div>
          </Card>
        )}
        <div ref={endRef} />
      </section>

      {/* Faire signer : l'étape qui transforme une proposition en référence. */}
      {editable && !busy && (proposal || c.status === 'needs_info') && (
        <Card className="space-y-3 p-4">
          <p className={cn(TYPE.bodyStrong, TEXT.strong)}>
            {c.status === 'needs_info'
              ? t('files.resubmitTitle', { defaultValue: 'Vous avez répondu ?' })
              : t('files.submitTitle', { defaultValue: 'Le code vous paraît juste ?' })}
          </p>
          <p className={cn(TYPE.body, TEXT.muted)}>{t('files.submitDesc', { defaultValue: 'Un commissionnaire agréé en douane le vérifie et le signe. Le code signé devient votre référence pour la déclaration.' })}</p>
          <Button className="w-full" onClick={() => setSheet('submit')}>
            <Send aria-hidden /> {c.status === 'needs_info'
              ? t('files.resubmitCta', { defaultValue: 'Renvoyer au commissionnaire' })
              : t('files.submitCta', { defaultValue: 'Faire signer par un commissionnaire agréé' })}
          </Button>
        </Card>
      )}

      {editable && !proposal && !busy && !question && c.status === 'draft' && !classify.isError && c.messages.some((m) => m.author === 'assistant') && (
        <Button variant="subtle" className="w-full" onClick={() => setSheet('submit')}>{t('files.sendDirect', { defaultValue: 'Envoyer au commissionnaire' })}</Button>
      )}

      {c.status !== 'cancelled' && !isSigned(c.status) && (
        <Button variant="dangerSubtle" size="sm" className="w-full" onClick={() => setSheet('cancel')}>{t('files.cancelCta', { defaultValue: 'Abandonner cette fiche' })}</Button>
      )}

      {/* Écrire : en bas, toujours à portée du pouce. */}
      {editable && (
        <form
          className={cn('sticky bottom-0 -mx-4 flex items-end gap-2 border-t px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3', SURFACE.canvas, SURFACE.divider)}
          onSubmit={(e) => { e.preventDefault(); void send(draft); }}
        >
          <label htmlFor="cl-reply" className="sr-only">{t('files.reply', { defaultValue: 'Votre réponse' })}</label>
          <TextArea
            id="cl-reply"
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(draft); } }}
            placeholder={question ? t('files.replyQuestion', { defaultValue: 'Votre réponse…' }) : t('files.replyFree', { defaultValue: 'Une précision sur le produit…' })}
            maxLength={4000}
            className="max-h-40 min-h-11 flex-1 py-2.5"
          />
          <IconButton icon={ArrowUp} variant="primary" ariaLabel={t('files.send', { defaultValue: 'Envoyer' })} disabled={!draft.trim() || busy} onClick={() => void send(draft)} />
        </form>
      )}

      <BottomSheet open={sheet === 'submit'} onClose={() => setSheet(null)} title={t('files.submitSheetTitle', { defaultValue: 'Envoyer au commissionnaire ?' })}>
        <div className="space-y-4">
          <Line>{t('files.submitSheet', { defaultValue: 'Il relit la description, les photos et la conversation. Il signe le code, le corrige, ou vous pose une question. Pendant sa relecture, l’assistant ne répond plus sur cette fiche.' })}</Line>
          <Button className="w-full" loading={submit.isPending} onClick={() => submit.mutate(undefined, {
            onSuccess: () => { setSheet(null); toast.success(t('files.submitted', { defaultValue: 'Fiche envoyée au commissionnaire' })); },
            onError: (e) => toast.error((e as Error).message),
          })}>
            <Send aria-hidden /> {t('files.submitConfirm', { defaultValue: 'Envoyer' })}
          </Button>
          <Button variant="subtle" className="w-full" onClick={() => setSheet(null)}>{t('files.keep', { defaultValue: 'Pas maintenant' })}</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === 'cancel'} onClose={() => setSheet(null)} title={t('files.cancelSheetTitle', { defaultValue: 'Abandonner la fiche ?' })}>
        <div className="space-y-4">
          <Line>{t('files.cancelSheet', { defaultValue: 'La fiche reste dans votre liste, mais plus personne n’y répond.' })}</Line>
          <Button variant="danger" className="w-full" loading={cancel.isPending} onClick={() => cancel.mutate(undefined, {
            onSuccess: () => navigate('/douane/classer'),
            onError: (e) => toast.error((e as Error).message),
          })}>
            {t('files.cancelConfirm', { defaultValue: 'Abandonner' })}
          </Button>
          <Button variant="subtle" className="w-full" onClick={() => setSheet(null)}>{t('files.keep', { defaultValue: 'Pas maintenant' })}</Button>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === 'letter'} onClose={() => setSheet(null)} title={t('files.letterTitle', { defaultValue: 'Demande de décision anticipée' })}>
        <div className="space-y-4">
          <Line>{t('files.letterIntro', { defaultValue: 'Le code des douanes CEMAC (art. 75) permet de demander à la douane de confirmer un classement avant d’importer. Complétez NIU, RCCM et adresse, signez, et déposez-la avec les pièces jointes.' })}</Line>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" onClick={() => void copyToClipboard(plain(letter), t('files.letterCopied', { defaultValue: 'Lettre' }))}>
              <Copy aria-hidden /> {t('files.letterCopy', { defaultValue: 'Copier le texte' })}
            </Button>
            <Button variant="neutral" className="flex-1" onClick={download}>
              <Download aria-hidden /> {t('files.letterDownload', { defaultValue: 'Télécharger' })}
            </Button>
          </div>
          <LetterPreview text={letter} />
        </div>
      </BottomSheet>
    </div>,
  );
}

/** La lettre, lisible : titres, gras, puces. Pas de HTML injecté — du texte, ligne à ligne. */
function LetterPreview({ text }: { text: string }) {
  return (
    <div className={cn('space-y-1 rounded-lg p-4 text-[15px] leading-relaxed', SURFACE.inset, TEXT.body)}>
      {text.split('\n').map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;
        if (line.startsWith('## ')) return <p key={i} className={cn('pt-2 font-semibold', TEXT.strong)}>{line.slice(3)}</p>;
        const bold = /^\*\*(.*)\*\*$/.exec(line);
        if (bold) return <p key={i} className={cn('font-semibold', TEXT.strong)}>{bold[1]}</p>;
        return <p key={i}>{line.replace(/\*\*/g, '')}</p>;
      })}
    </div>
  );
}

export default ClassificationPage;
