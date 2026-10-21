/**
 * Revue d'un classement — refonte v2 (maquettes 06/07, 06/08, 06/09).
 *
 * Les photos, le produit, le code proposé en grand avec droit et TVA ; puis
 * Valider / Changer / Demander, l'observation, et un seul bouton noir. Signer
 * passe par une feuille de confirmation avec la ligne rouge « Engage votre
 * agrément CAD », puis l'écran « Signé » avec « Suivant ».
 * Gardes inchangées : canSignCustoms + agrément enregistré (is_broker), fiche
 * prise par soi ; le serveur revérifie (customs_classification_claim/decide).
 * « … » : la proposition de l'assistant, le fil de la fiche, simuler le code.
 */
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bot, Calculator, MessagesSquare, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCustomsNomenclature } from '@/hooks/useCustomsNomenclature';
import {
  useAdminClassification, useClaimClassification, useCustomsPhotoUrls, useCustomsReviewQueue, useDecideClassification,
} from '@/hooks/useCustomsReview';
import { formatHs, hsDigits } from '@/lib/customs/hsCode';
import { isSigned, latestProposal, type Classification } from '@/lib/customs/files';
import { defaultRate } from '@/lib/customs/nomenclature';
import { vatExemption } from '@/lib/customs/vatExempt';
import { cn } from '@/lib/utils';
import { CandidateCard, SignedCard, Thread } from '@/pages/customs/components/ClassificationParts';
import { ProductPicker } from '@/pages/customs/components/ProductPicker';
import { lineTitle } from '@/pages/customs/components/lineText';
import {
  ActionSheet, BigButton, BottomSheet, BoxSegmented, ConfirmSheet, Dock, EmptyLine, FOCUS_RING, MoreButton, ScreenLoader, ScreenTop,
  SuccessView, SURFACE, TEXT, TextArea, TextInput, useSheet,
} from '@/mobile/designKit';
import { BIG_FIELD, FieldBlock, RedNotice } from '@/mobile/screens/more/parts';
import { agoLabel, clientFirst, clientName, PhotoViewer } from './shared';
import { nextInQueue } from './CustomsHomeV2';

const SIMULATE = '/m/douane/simulateur';
type Decision = 'approved' | 'changed' | 'needs_info';

export function ReviewV2() {
  const { id } = useParams();
  // Une fiche = un état : « Suivant » repart de zéro.
  return <ReviewRoute key={id} id={id} />;
}

function ReviewRoute({ id }: { id: string | undefined }) {
  const q = useAdminClassification(id);
  const [done, setDone] = useState<{ code: string | null; product: string; first: string; asked: boolean } | null>(null);
  if (done) return <Signed done={done} currentId={id} />;
  if (q.isLoading) return <><ScreenTop title="Classement" backTo="/m/douane" /><ScreenLoader /></>;
  if (q.isError || !q.data) {
    return (
      <>
        <ScreenTop title="Classement" backTo="/m/douane" />
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void q.refetch() }}>La fiche n'a pas pu être chargée.</EmptyLine>
      </>
    );
  }
  return <Review key={q.data.id} c={q.data} onDone={setDone} />;
}

function Review({ c, onDone }: { c: Classification; onDone: (d: { code: string | null; product: string; first: string; asked: boolean }) => void }) {
  const navigate = useNavigate();
  const { hasPermission, currentUser } = useAdminAuth();
  const queue = useCustomsReviewQueue(hasPermission('canViewCustoms'));
  const photos = useCustomsPhotoUrls(c.photo_paths);
  const claim = useClaimClassification(c.id);
  const decide = useDecideClassification(c.id);
  const nom = useCustomsNomenclature();
  const more = useSheet();
  const confirm = useSheet();
  const aiSheet = useSheet();
  const threadSheet = useSheet();

  const [decision, setDecision] = useState<Decision>('approved');
  const [note, setNote] = useState('');
  const [national, setNational] = useState('');
  const [showNational, setShowNational] = useState(false);
  const [changedTo, setChangedTo] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [tried, setTried] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);

  const proposal = useMemo(() => latestProposal(c.messages), [c.messages]);
  const proposed = c.proposed_code ?? proposal?.candidates[0]?.code ?? null;
  const isBroker = queue.data?.is_broker === true;
  const canSign = hasPermission('canSignCustoms');
  const waiting = c.status === 'submitted' || c.status === 'in_review';
  const claimedByOther = !!c.claimed_by && c.claimed_by !== currentUser?.id;
  const mine = c.status === 'in_review' && !!c.claimed_by && c.claimed_by === currentUser?.id;
  const who = clientName(c.client);

  const nationalDigits = hsDigits(national);
  const approveCode = proposed ? (nationalDigits.length > 6 ? nationalDigits : proposed) : null;
  const nationalError = decision === 'approved' && national && (!nationalDigits.startsWith(proposed ?? '') || ![6, 8, 12].includes(nationalDigits.length))
    ? `8 ou 12 chiffres commençant par ${proposed ? formatHs(proposed) : 'le code proposé'}`
    : null;
  const finalCode = decision === 'approved' ? approveCode : decision === 'changed' ? changedTo : null;
  const noteRequired = decision !== 'approved';
  const noteError = tried && noteRequired && !note.trim()
    ? (decision === 'changed' ? 'Dites pourquoi ce code.' : 'Dites au client ce qui manque.')
    : null;

  // Le code affiché : celui qui sera signé, avec son libellé, son droit et la TVA.
  const shown = (decision === 'changed' ? changedTo : approveCode) ?? proposed;
  const line = shown && nom.data ? nom.data.byCode.get(shown.slice(0, 6)) : undefined;
  const lang = 'fr' as const;
  const title = line && nom.data ? lineTitle(nom.data, line, lang) : proposal?.candidates.find((x) => x.code === shown?.slice(0, 6))?.title ?? null;
  const duty = line ? defaultRate(line) : proposal?.candidates.find((x) => x.code === shown?.slice(0, 6))?.rate_max ?? null;
  const vat = shown ? (vatExemption(shown.slice(0, 6), false).exempt === 'yes' ? 'exonérée' : '19,25 %') : null;

  const tryOpen = () => {
    setTried(true);
    if (nationalError || (noteRequired && !note.trim())) return;
    if (decision === 'changed' && !changedTo) { toast.error('Choisissez le code retenu.'); return; }
    if (decision === 'approved' && !approveCode) { toast.error('Aucun code proposé : choisissez « Changer ».'); return; }
    if (decision === 'needs_info') { void submit(); return; }
    confirm.show();
  };
  const submit = async () => {
    try {
      await decide.mutateAsync({ decision, finalCode, note: note.trim() || null });
      confirm.hide();
      onDone({ code: finalCode, product: c.product_name, first: clientFirst(c.client), asked: decision === 'needs_info' });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const urls = photos.data ?? [];
  const extra = urls.length - 3;

  let dock: React.ReactNode = null;
  if (waiting && canSign && (isBroker || !queue.isSuccess) && !claimedByOther) {
    dock = !mine
      ? <BigButton loading={claim.isPending} onClick={() => claim.mutate(undefined, { onError: (e) => toast.error((e as Error).message) })}>Je prends cette fiche</BigButton>
      : <BigButton loading={decide.isPending && decision === 'needs_info'} onClick={tryOpen}>{decision === 'needs_info' ? 'Envoyer la question' : 'Signer le classement'}</BigButton>;
  }

  return (
    <div className="flex min-h-full flex-col">
      <ScreenTop title="Classement" backTo="/m/douane" right={<MoreButton onClick={more.show} />} />
      <div className="px-5 pt-5">
        {urls.length > 0 && (
          <div className="mb-5 grid grid-cols-3 gap-2.5">
            {urls.slice(0, 3).map((u, i) => (
              <button key={u} type="button" onClick={() => setViewer(i)} className={cn('relative aspect-square overflow-hidden rounded-lg bg-[#F5F5F5] dark:bg-[#383838]', FOCUS_RING)}>
                <img src={u} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                {i === 2 && extra > 0 && (
                  <span className="absolute bottom-2 right-2 rounded-md bg-[#2C2C2C] px-2 py-1 text-[15px] font-semibold text-[#F5F5F5]">+{extra}</span>
                )}
              </button>
            ))}
          </div>
        )}

        <h2 className={cn('text-[24px] font-semibold leading-tight', TEXT.strong)}>{c.product_name}</h2>
        <p className={cn('mt-1 text-[16px]', TEXT.muted)}>{[who, c.client?.customer_code, agoLabel(c.submitted_at)].filter(Boolean).join(' · ')}</p>
        {c.description && <p className={cn('mt-3 whitespace-pre-line text-[16px] leading-relaxed', TEXT.body)}>{c.description}</p>}

        {isSigned(c.status) ? (
          <div className="mt-5"><SignedCard c={c} simulateBase={SIMULATE} /></div>
        ) : shown ? (
          <div className={cn('mt-5 rounded-lg border', SURFACE.divider)}>
            <div className="px-4 pb-4 pt-4">
              <div className={cn('text-[16px]', TEXT.muted)}>{decision === 'changed' && changedTo ? 'Code retenu' : 'Code proposé'}</div>
              <div className={cn('mt-1 text-[44px] font-bold leading-none tracking-[-0.02em] tabular-nums', TEXT.strong)}>{formatHs(shown)}</div>
              {title && <p className={cn('mt-2 line-clamp-2 text-[16px]', TEXT.body)}>{title}</p>}
            </div>
            <div className={cn('flex items-center justify-between gap-3 border-t px-4 py-3.5 text-[16px]', SURFACE.divider)}>
              <span className={TEXT.muted}>Droit · TVA</span>
              <span className={cn('font-semibold tabular-nums', TEXT.strong)}>{duty != null ? `${duty} %` : '—'} · {vat}</span>
            </div>
          </div>
        ) : (
          <p className="mt-5 text-[16px] font-semibold text-[#975102] dark:text-[#E8B931]">Aucun code proposé.</p>
        )}

        {/* Qui peut signer : les gardes d'avant, en une ligne. */}
        {waiting && !canSign && <p className={cn('mt-5 text-[16px]', TEXT.muted)}>Lecture seule : seul un commissionnaire agréé signe.</p>}
        {waiting && canSign && !isBroker && queue.isSuccess && (
          <p className="mt-5 text-[16px] font-semibold text-[#975102] dark:text-[#E8B931]">Agrément non enregistré : demandez sa saisie dans votre fiche d'équipe.</p>
        )}
        {waiting && claimedByOther && <p className={cn('mt-5 text-[16px]', TEXT.muted)}>Un autre commissionnaire relit cette fiche.</p>}
        {!waiting && !isSigned(c.status) && <p className={cn('mt-5 text-[16px]', TEXT.muted)}>Cette fiche n'attend pas de décision.</p>}

        {mine && (
          <div className="mt-5 space-y-4 pb-6">
            <BoxSegmented<Decision>
              ariaLabel="Décision"
              value={decision}
              onChange={(v) => { setDecision(v); setTried(false); }}
              options={[{ value: 'approved', label: 'Valider' }, { value: 'changed', label: 'Changer' }, { value: 'needs_info', label: 'Demander' }]}
            />
            {decision === 'approved' && proposed && (
              showNational ? (
                <FieldBlock label="Ligne tarifaire nationale" htmlFor="rv-national" error={nationalError}>
                  <TextInput id="rv-national" inputMode="numeric" value={national} onChange={(e) => setNational(e.target.value)} placeholder={formatHs(`${proposed}000000`)} className={BIG_FIELD} />
                </FieldBlock>
              ) : (
                <button type="button" onClick={() => setShowNational(true)} className={cn('flex h-11 items-center gap-2.5 rounded text-[17px] font-semibold', FOCUS_RING, TEXT.strong)}>
                  <Plus className="h-6 w-6" /> Ligne nationale (8 ou 12 chiffres)
                </button>
              )
            )}
            {decision === 'changed' && (
              changedTo && !picking ? (
                <button type="button" onClick={() => setPicking(true)} className={cn('h-11 rounded text-[17px] font-semibold underline underline-offset-[3px]', FOCUS_RING, TEXT.strong)}>Choisir un autre code</button>
              ) : nom.data ? (
                <ProductPicker nom={nom.data} exclude={proposed} inputId="rv-search" onPick={(l) => { setChangedTo(l.code); setPicking(false); }} />
              ) : nom.isError ? (
                <p className="text-[16px] font-semibold text-[#C00F0C]">Le tarif n'a pas pu être chargé.</p>
              ) : (
                <ScreenLoader className="min-h-0 py-6" />
              )
            )}
            <TextArea
              aria-label={decision === 'needs_info' ? 'Votre question au client' : decision === 'changed' ? 'Pourquoi ce code' : 'Observation'}
              rows={decision === 'approved' ? 2 : 3}
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={decision === 'needs_info' ? 'Votre question au client' : decision === 'changed' ? 'Pourquoi ce code (obligatoire)' : 'Observation (facultatif)'}
              className="px-4 py-3.5 text-[17px]"
            />
            {noteError && <p className="text-[15px] font-medium text-[#900B09] dark:text-[#FCB3AD]">{noteError}</p>}
          </div>
        )}
        {!dock && <div className="h-8" />}
      </div>

      {dock && <Dock>{dock}</Dock>}

      <ConfirmSheet
        open={confirm.open}
        onClose={confirm.hide}
        title={`Signer ${finalCode ? formatHs(finalCode) : ''} ?`}
        subtitle={`${c.product_name} · ${who}`}
        rows={[
          { label: 'Décision', value: decision === 'changed' ? 'Code changé' : 'Code validé' },
          { label: 'Code final', value: finalCode ? formatHs(finalCode) : '—' },
          { label: 'Client prévenu', value: 'Oui' },
        ]}
        confirmLabel="Signer"
        loading={decide.isPending}
        onConfirm={() => void submit()}
      >
        <RedNotice>Engage votre agrément CAD</RedNotice>
      </ConfirmSheet>

      <ActionSheet
        open={more.open}
        onClose={more.hide}
        actions={[
          { label: 'Proposition de l’assistant', icon: Bot, onClick: aiSheet.show, hidden: !proposal },
          { label: `Fil de la fiche (${c.messages.length})`, icon: MessagesSquare, onClick: threadSheet.show },
          { label: 'Simuler ce code', icon: Calculator, onClick: () => navigate(`${SIMULATE}?c=${(shown ?? '').slice(0, 6)}`), hidden: !shown },
        ]}
      />
      <BottomSheet open={aiSheet.open} onClose={aiSheet.hide} title="L’assistant propose">
        <div className="space-y-3">
          {proposal?.message.body && <p className={cn('text-[16px] leading-relaxed', TEXT.body)}>{proposal.message.body}</p>}
          {proposal?.candidates.map((cand, k) => <CandidateCard key={cand.code} c={cand} rank={k} simulateBase={SIMULATE} />)}
          {proposal?.message.payload?.missing_facts?.length ? (
            <p className={cn('text-[16px]', TEXT.muted)}>Ce qui départagerait : {proposal.message.payload.missing_facts.join(' ; ')}</p>
          ) : null}
        </div>
      </BottomSheet>
      <BottomSheet open={threadSheet.open} onClose={threadSheet.hide} title="Fil de la fiche">
        <Thread messages={c.messages} simulateBase={SIMULATE} compactProposals />
      </BottomSheet>
      {viewer != null && urls.length > 0 && <PhotoViewer urls={urls} start={viewer} onClose={() => setViewer(null)} />}
    </div>
  );
}

/** « Signé » (06/09) : la fiche suivante de la file, ou retour à la file. */
function Signed({ done, currentId }: { done: { code: string | null; product: string; first: string; asked: boolean }; currentId?: string }) {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const queue = useCustomsReviewQueue(hasPermission('canViewCustoms'));
  const next = nextInQueue(queue.data?.classifications ?? [], currentId);
  return (
    <SuccessView
      title={done.asked ? 'Question envoyée' : 'Signé'}
      subtitle={done.asked ? `${done.first} répondra dans sa fiche.` : <>{done.code ? `${formatHs(done.code)} · ` : ''}{done.product}<br />Le client est prévenu.</>}
      primary={next ? { label: `Suivant · ${next.product_name}`, onClick: () => navigate(`/m/douane/revue/${next.id}`) } : undefined}
      secondary={{ label: 'Retour à la file', onClick: () => navigate('/m/douane') }}
    />
  );
}
