// ============================================================
// La revue d'une fiche de classement — /m/douane/revue/:id (espace équipe).
// Le commissionnaire agréé (CAD) prend la fiche, puis signe : il valide le
// code proposé, le change (en disant pourquoi), ou demande une précision au
// client. Le reste de l'équipe (canViewCustoms) lit sans pouvoir signer.
// Session `supabaseAdmin` uniquement (useCustomsReview).
// ============================================================
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { BadgeCheck, Hand, Lock, PenLine, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import {
  Button, Card, Fold, FormField, Holder, Line, Row, ScreenError, ScreenLoader, Segmented, TextArea, TextInput, SURFACE, TEXT, TYPE,
} from '@/mobile/designKit';
import { formatHs, hsDigits } from '@/lib/customs/hsCode';
import { isSigned, latestProposal } from '@/lib/customs/files';
import { useCustomsNomenclature } from '@/hooks/useCustomsNomenclature';
import {
  useAdminClassification, useClaimClassification, useCustomsPhotoUrls, useCustomsReviewQueue, useDecideClassification,
} from '@/hooks/useCustomsReview';
import { CustomsShell } from './shared';
import { CandidateCard, ClassificationStatusPill, SignedCard, Thread } from './components/ClassificationParts';
import { ProductPicker } from './components/ProductPicker';
import { lineTitle } from './components/lineText';

const SIMULATE = '/m/douane/simulateur';
type Decision = 'approved' | 'changed' | 'needs_info';

export function ReviewPage({ desktop = false }: { desktop?: boolean } = {}) {
  const { t, i18n } = useTranslation('customs');
  const navigate = useNavigate();
  const { id } = useParams();
  const { hasPermission, currentUser } = useAdminAuth();
  const q = useAdminClassification(id);
  const queue = useCustomsReviewQueue(hasPermission('canViewCustoms'));
  const photos = useCustomsPhotoUrls(q.data?.photo_paths);
  const claim = useClaimClassification(id);
  const decide = useDecideClassification(id);
  const nom = useCustomsNomenclature();

  const [decision, setDecision] = useState<Decision>('approved');
  const [national, setNational] = useState('');
  const [changedTo, setChangedTo] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [thread, setThread] = useState(true);
  const [tried, setTried] = useState(false);

  const c = q.data;
  const proposal = useMemo(() => (c ? latestProposal(c.messages) : null), [c]);
  const lang = (i18n.language?.slice(0, 2) ?? 'fr') as 'fr' | 'en' | 'zh';

  const shell = (children: ReactNode) => (
    <CustomsShell
      title={c ? c.product_name : t('review.title', { defaultValue: 'Revue du classement' })}
      subtitle={c?.ref}
      backTo="/m/douane"
      variant="admin"
      desktop={desktop}
    >
      {children}
    </CustomsShell>
  );

  if (q.isLoading) return shell(<ScreenLoader />);
  if (q.isError || !c) return shell(<ScreenError description={(q.error as Error | null)?.message} onRetry={() => q.refetch()} />);

  const isBroker = queue.data?.is_broker === true;
  const canSign = hasPermission('canSignCustoms');
  const waiting = c.status === 'submitted' || c.status === 'in_review';
  const claimedByOther = !!c.claimed_by && c.claimed_by !== currentUser?.id;
  const mine = c.status === 'in_review' && !!c.claimed_by && c.claimed_by === currentUser?.id;
  const proposed = c.proposed_code ?? proposal?.candidates[0]?.code ?? null;
  const who = c.client?.company_name || [c.client?.first_name, c.client?.last_name].filter(Boolean).join(' ') || '—';

  // Le code qui sera signé, selon la décision.
  const nationalDigits = hsDigits(national);
  const approveCode = proposed ? (nationalDigits.length > 6 ? nationalDigits : proposed) : null;
  const nationalError = decision === 'approved' && national && (!nationalDigits.startsWith(proposed ?? '') || ![6, 8, 12].includes(nationalDigits.length))
    ? t('review.nationalError', { code: proposed ? formatHs(proposed) : '', defaultValue: `8 ou 12 chiffres commençant par ${proposed ? formatHs(proposed) : 'le code proposé'}` })
    : null;
  const noteRequired = decision !== 'approved';
  const noteError = tried && noteRequired && !note.trim()
    ? decision === 'changed'
      ? t('review.noteWhy', { defaultValue: 'Dites pourquoi ce code et pas celui proposé.' })
      : t('review.noteAsk', { defaultValue: 'Dites au client ce qui manque.' })
    : null;
  const codeError = tried && decision === 'changed' && !changedTo ? t('review.codeRequired', { defaultValue: 'Choisissez le code retenu.' }) : null;

  const sign = () => {
    setTried(true);
    if (nationalError || (noteRequired && !note.trim()) || (decision === 'changed' && !changedTo)) return;
    if (decision === 'approved' && !approveCode) { toast.error(t('review.noProposal', { defaultValue: 'Aucun code proposé : choisissez « Changer le code ».' })); return; }
    decide.mutate(
      {
        decision,
        finalCode: decision === 'approved' ? approveCode : decision === 'changed' ? changedTo : null,
        note: note.trim() || null,
      },
      {
        onSuccess: () => toast.success(decision === 'needs_info'
          ? t('review.sentBack', { defaultValue: 'Question envoyée au client' })
          : t('review.signed', { defaultValue: 'Classement signé' })),
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  return shell(
    <div className={cn('mx-auto space-y-5 px-4 pb-12 pt-3', desktop ? 'max-w-5xl lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-6 lg:space-y-0' : 'max-w-2xl')}>
      {/* Colonne de lecture : le client, le produit, ce que l'IA propose, la conversation. */}
      <div className="min-w-0 space-y-5">
        <Card className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Holder icon={UserRound} size="sm" />
              <div className="min-w-0">
                <p className={cn(TYPE.bodyStrong, TEXT.strong)}>{who}</p>
                {c.client?.customer_code && <p className={cn(TYPE.small, 'tabular-nums', TEXT.muted)}>{c.client.customer_code}</p>}
              </div>
            </div>
            <ClassificationStatusPill status={c.status} />
          </div>
          {c.submitted_at && <Row label={t('review.submittedAt', { defaultValue: 'Envoyée le' })} value={new Date(c.submitted_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} />}
        </Card>

        <Card className="space-y-3 p-4">
          <p className={cn(TYPE.lead, TEXT.strong)}>{c.product_name}</p>
          {c.description
            ? <p className={cn('whitespace-pre-line', TYPE.body, TEXT.body)}>{c.description}</p>
            : <p className={cn(TYPE.body, TEXT.muted)}>{t('review.noDescription', { defaultValue: 'Pas de description.' })}</p>}
          {Object.keys(c.facts ?? {}).length > 0 && (
            <div className={cn('rounded-lg px-3', SURFACE.inset)}>
              {Object.entries(c.facts).map(([k, v]) => <Row key={k} label={k} value={typeof v === 'string' ? v : JSON.stringify(v)} />)}
            </div>
          )}
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

        {isSigned(c.status) && <SignedCard c={c} simulateBase={SIMULATE} />}

        {proposal ? (
          <section className="space-y-2">
            <h2 className={cn(TYPE.lead, TEXT.strong)}>{t('review.aiTitle', { defaultValue: 'Ce que propose l’assistant' })}</h2>
            {proposal.message.body && <Line>{proposal.message.body}</Line>}
            {proposal.candidates.map((cand, k) => <CandidateCard key={cand.code} c={cand} rank={k} simulateBase={SIMULATE} />)}
            {proposal.message.payload?.missing_facts?.length ? (
              <p className={cn(TYPE.small, TEXT.muted)}>{t('files.missingFacts', { defaultValue: 'Ce qui départagerait :' })} {proposal.message.payload.missing_facts.join(' ; ')}</p>
            ) : null}
          </section>
        ) : (
          <Line tone="warn">{t('review.noAi', { defaultValue: 'L’assistant n’a pas fait de proposition : le client a envoyé la fiche directement.' })}</Line>
        )}

        <Fold title={t('review.threadTitle', { count: c.messages.length, defaultValue: `Conversation (${c.messages.length})` })} open={thread} onToggle={() => setThread(!thread)}>
          <div className="pt-2">
            <Thread messages={c.messages} simulateBase={SIMULATE} compactProposals />
          </div>
        </Fold>
      </div>

      {/* Colonne de décision : ce que seul le CAD peut faire. */}
      <div className={cn('min-w-0 space-y-4', desktop && 'lg:sticky lg:top-4 lg:self-start')}>
        {!waiting ? (
          !isSigned(c.status) && (
            <Card className="p-4"><Line>{t('review.notWaiting', { defaultValue: 'Cette fiche n’attend pas de décision.' })}</Line></Card>
          )
        ) : !canSign ? (
          <Card className="flex gap-3 p-4">
            <Holder icon={Lock} size="sm" />
            <Line>{t('review.readOnly', { defaultValue: 'Seul un commissionnaire agréé en douane peut signer un classement. Vous voyez la fiche en lecture.' })}</Line>
          </Card>
        ) : !isBroker && queue.isSuccess ? (
          <Card className="p-4"><Line tone="warn">{t('review.noLicense', { defaultValue: 'Votre agrément n’est pas encore enregistré. Demandez à un administrateur de le saisir dans votre fiche d’équipe.' })}</Line></Card>
        ) : claimedByOther ? (
          <Card className="flex gap-3 p-4">
            <Holder icon={Lock} size="sm" />
            <Line>{t('review.claimedByOther', { defaultValue: 'Un autre commissionnaire relit cette fiche.' })}</Line>
          </Card>
        ) : !mine ? (
          <Card className="space-y-3 p-4">
            <p className={cn(TYPE.bodyStrong, TEXT.strong)}>{t('review.claimTitle', { defaultValue: 'Prendre la fiche' })}</p>
            <Line>{t('review.claimDesc', { defaultValue: 'Elle quitte la file des autres commissionnaires. Vous pourrez ensuite signer, corriger ou poser une question.' })}</Line>
            <Button className="w-full" loading={claim.isPending} onClick={() => claim.mutate(undefined, { onError: (e) => toast.error((e as Error).message) })}>
              <Hand aria-hidden /> {t('review.claimCta', { defaultValue: 'Je prends cette fiche' })}
            </Button>
          </Card>
        ) : (
          <Card className="space-y-4 p-4">
            <p className={cn(TYPE.lead, TEXT.strong)}>{t('review.decisionTitle', { defaultValue: 'Votre décision' })}</p>
            <Segmented<Decision>
              value={decision}
              onChange={(v) => { setDecision(v); setTried(false); }}
              options={[
                { value: 'approved', label: t('review.approve', { defaultValue: 'Valider' }) },
                { value: 'changed', label: t('review.change', { defaultValue: 'Changer' }) },
                { value: 'needs_info', label: t('review.ask', { defaultValue: 'Demander' }) },
              ]}
            />

            {decision === 'approved' && (
              proposed ? (
                <div className="space-y-3">
                  <div className={cn('rounded-lg p-3', SURFACE.inset)}>
                    <p className={cn(TYPE.small, TEXT.muted)}>{t('review.proposed', { defaultValue: 'Code proposé' })}</p>
                    <p className={cn('text-[24px] font-semibold tabular-nums', TEXT.strong)}>{formatHs(approveCode ?? proposed)}</p>
                  </div>
                  <FormField label={t('review.national', { defaultValue: 'Ligne tarifaire nationale (facultatif)' })} htmlFor="rv-national"
                    error={nationalError} hint={t('review.nationalHint', { defaultValue: 'Les 8 ou 12 chiffres de la ligne CAMCIS, si vous la connaissez.' })}>
                    <TextInput id="rv-national" inputMode="numeric" value={national} onChange={(e) => setNational(e.target.value)} placeholder={formatHs(`${proposed}000000`)} />
                  </FormField>
                </div>
              ) : (
                <Line tone="warn">{t('review.noProposal', { defaultValue: 'Aucun code proposé : choisissez « Changer le code ».' })}</Line>
              )
            )}

            {decision === 'changed' && (
              <div className="space-y-3">
                {changedTo ? (
                  <div className={cn('flex items-start justify-between gap-3 rounded-lg p-3', SURFACE.inset)}>
                    <div className="min-w-0">
                      <p className={cn('text-[24px] font-semibold tabular-nums', TEXT.strong)}>{formatHs(changedTo)}</p>
                      {nom.data?.byCode.get(changedTo.slice(0, 6)) && (
                        <p className={cn(TYPE.small, TEXT.body)}>{lineTitle(nom.data, nom.data.byCode.get(changedTo.slice(0, 6))!, lang)}</p>
                      )}
                    </div>
                    <Button size="sm" variant="neutral" className="shrink-0" onClick={() => setChangedTo(null)}>{t('sim.change')}</Button>
                  </div>
                ) : nom.data ? (
                  <>
                    <ProductPicker nom={nom.data} onPick={(l) => setChangedTo(l.code)} exclude={proposed} inputId="rv-search" />
                    {codeError && <p className="text-[16px] text-[#900B09] dark:text-[#FCB3AD]">{codeError}</p>}
                  </>
                ) : nom.isError ? (
                  <Line tone="bad">{t('sim.loadError')}</Line>
                ) : (
                  <ScreenLoader className="min-h-0 py-6" />
                )}
              </div>
            )}

            <FormField
              label={decision === 'needs_info'
                ? t('review.askLabel', { defaultValue: 'Votre question au client' })
                : decision === 'changed'
                  ? t('review.whyLabel', { defaultValue: 'Pourquoi ce code' })
                  : t('review.noteLabel', { defaultValue: 'Observation (facultatif)' })}
              htmlFor="rv-note"
              error={noteError}
              hint={decision === 'needs_info' ? t('review.askHint', { defaultValue: 'Le client la reçoit en notification et répond dans sa fiche.' }) : t('review.noteHint', { defaultValue: 'Le client la lit avec le code signé.' })}
            >
              <TextArea id="rv-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
            </FormField>

            {decision !== 'needs_info' && (
              <p className={cn(TYPE.small, TEXT.muted)}>
                {t('review.signNotice', { defaultValue: 'En signant, vous engagez votre agrément : votre société et votre numéro d’agrément apparaissent sur la fiche du client.' })}
              </p>
            )}
            <Button className="w-full" loading={decide.isPending} onClick={sign}>
              {decision === 'needs_info'
                ? <><PenLine aria-hidden /> {t('review.askCta', { defaultValue: 'Envoyer la question' })}</>
                : <><BadgeCheck aria-hidden /> {t('review.signCta', { defaultValue: 'Signer le classement' })}</>}
            </Button>
          </Card>
        )}

        {isSigned(c.status) && (
          <Button variant="neutral" className="w-full" onClick={() => navigate('/m/douane')}>{t('review.backToQueue', { defaultValue: 'Retour à la file' })}</Button>
        )}
      </div>
    </div>,
  );
}

export default ReviewPage;
