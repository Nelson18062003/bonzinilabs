// ============================================================
// Mes fournisseurs — /douane/fournisseurs (client connecté).
// Les « invitations de partenaires » de Flexport : un lien sans compte que
// l'importateur envoie sur WeChat ; le fournisseur y dépose la facture
// définitive (celle que la SGS attend), le colisage, la fiche technique.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Check, Copy, FileText, Link2, Send, Share2, UserPlus, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/lib/clipboard';
import {
  BottomSheet, Button, Card, FormField, Line, ScreenError, ScreenLoader, Segmented, StatusPill, TextArea, TextInput, SURFACE, TEXT, TYPE,
  TOGGLE_OFF, TOGGLE_ON, FOCUS_RING, type Tone,
} from '@/mobile/designKit';
import { useMyProfile } from '@/hooks/useProfile';
import { useMyCustomsFiles } from '@/hooks/useCustomsFiles';
import {
  DOC_KINDS, supplierLink, useCreateInvite, useMyDocumentUrls, useMyInvites, useRevokeInvite, useRotateInvite, type DocKind, type Invite,
} from '@/hooks/useCustomsInvites';
import { CustomsShell } from './shared';
import { longDate } from './format';

type Lang = 'zh' | 'en' | 'fr';
const STATUS_TONE: Record<Invite['status'], Tone> = { open: 'info', expired: 'neutral', revoked: 'neutral' };

/** Le lien, et le message tout prêt dans la langue du fournisseur. */
function ShareSheet({ open, onClose, link, lang, supplier, importer, requested }: {
  open: boolean; onClose: () => void; link: string; lang: Lang; supplier: string; importer: string; requested: DocKind[];
}) {
  const { t } = useTranslation('customs');
  const docs = requested.map((k) => t(`supplier.kind.${k}`, { lng: lang })).join(lang === 'zh' ? '、' : ', ');
  const message = t('suppliers.shareMessage', { lng: lang, supplier, importer, docs, link });
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ text: message }); return; } catch { /* annulé : on copie */ }
    }
    void copyToClipboard(message, t('suppliers.messageLabel', { defaultValue: 'Message' }));
  };
  return (
    <BottomSheet open={open} onClose={onClose} title={t('suppliers.shareTitle', { defaultValue: 'Envoyez ce lien à votre fournisseur' })}>
      <div className="space-y-4">
        <Line>{t('suppliers.shareIntro', { defaultValue: 'Collez le message dans WeChat ou WhatsApp. Votre fournisseur n’a pas besoin de compte.' })}</Line>
        <p className={cn('whitespace-pre-line rounded-lg p-3 text-[15px] leading-snug [overflow-wrap:anywhere]', SURFACE.inset, TEXT.body)} lang={lang === 'zh' ? 'zh-CN' : lang}>{message}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" onClick={() => void share()}><Share2 aria-hidden /> {t('suppliers.shareCta', { defaultValue: 'Partager le message' })}</Button>
          <Button variant="neutral" className="flex-1" onClick={() => void copyToClipboard(link, t('suppliers.linkLabel', { defaultValue: 'Lien' }))}><Copy aria-hidden /> {t('suppliers.copyLink', { defaultValue: 'Copier le lien seul' })}</Button>
        </div>
        <p className={cn(TYPE.small, TEXT.muted)}>{t('suppliers.linkOnce', { defaultValue: 'Pour votre sécurité, ce lien ne sera plus affiché. Perdu ? Créez-en un nouveau depuis l’invitation : l’ancien cessera de marcher.' })}</p>
      </div>
    </BottomSheet>
  );
}

function InviteCard({ inv, urls, onRotate, onRevoke, rotating }: {
  inv: Invite; urls: Record<string, string> | undefined; onRotate: () => void; onRevoke: () => void; rotating: boolean;
}) {
  const { t } = useTranslation('customs');
  const received = new Set(inv.documents.map((d) => d.kind));
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn(TYPE.bodyStrong, 'break-words', TEXT.strong)}>{inv.supplier_name}</p>
          <p className={cn(TYPE.small, TEXT.muted)}>
            {[inv.supplier_contact, inv.due_on ? t('suppliers.dueShort', { date: longDate(inv.due_on), defaultValue: `pour le ${longDate(inv.due_on)}` }) : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        <StatusPill tone={STATUS_TONE[inv.status]} label={t(`suppliers.status.${inv.status}`, { defaultValue: inv.status })} />
      </div>
      <ul className="flex flex-wrap gap-2">
        {inv.requested.map((k) => (
          <li key={k} className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[14px]',
            received.has(k) ? 'bg-[#CFF7D3] font-semibold text-[#02542D] dark:bg-[#02542D] dark:text-[#CFF7D3]' : cn(SURFACE.inset, TEXT.body))}>
            {received.has(k) && <Check aria-hidden className="h-4 w-4" />}{t(`supplier.kind.${k}`, { defaultValue: k })}
          </li>
        ))}
      </ul>
      {inv.documents.length > 0 && (
        <ul className={cn('rounded-lg px-3', SURFACE.inset)}>
          {inv.documents.map((d) => (
            <li key={d.id} className={cn('border-b last:border-b-0', SURFACE.divider)}>
              <a href={urls?.[d.file_path]} target="_blank" rel="noreferrer" className={cn('flex min-h-11 items-center gap-3 py-2', TEXT.body)}>
                <FileText aria-hidden className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate', TYPE.body, TEXT.strong)}>{d.file_name ?? t(`supplier.kind.${d.kind}`)}</span>
                  <span className={cn('block', TYPE.small, TEXT.muted)}>
                    {t(`supplier.kind.${d.kind}`)} · {new Date(d.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}{d.note ? ` · ${d.note}` : ''}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {inv.status !== 'revoked' && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="neutral" loading={rotating} onClick={onRotate}><Link2 aria-hidden /> {t('suppliers.newLink', { defaultValue: 'Nouveau lien' })}</Button>
          {inv.status === 'open' && <Button size="sm" variant="dangerSubtle" onClick={onRevoke}><XCircle aria-hidden /> {t('suppliers.revoke', { defaultValue: 'Fermer le lien' })}</Button>}
        </div>
      )}
    </Card>
  );
}

export function SuppliersPage() {
  const { t } = useTranslation('customs');
  const [params, setParams] = useSearchParams();
  const invites = useMyInvites();
  const profile = useMyProfile();
  const files = useMyCustomsFiles();
  const create = useCreateInvite();
  const rotate = useRotateInvite();
  const revoke = useRevokeInvite();

  const [form, setForm] = useState(false);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [lang, setLang] = useState<Lang>('zh');
  const [requested, setRequested] = useState<DocKind[]>(['final_invoice', 'packing_list']);
  const [message, setMessage] = useState('');
  const [due, setDue] = useState('');
  const [classificationId, setClassificationId] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [share, setShare] = useState<{ link: string; lang: Lang; supplier: string; requested: DocKind[] } | null>(null);
  const [closing, setClosing] = useState<Invite | null>(null);

  // Venu d'une fiche de classement : on demande la fiche technique et les photos, liées à la fiche.
  const fromClassification = params.get('classification');
  useEffect(() => {
    if (!fromClassification) return;
    setClassificationId(fromClassification);
    setRequested(['product_sheet', 'photos']);
    setForm(true);
    setParams({}, { replace: true });
  }, [fromClassification, setParams]);

  const linked = files.data?.classifications.find((c) => c.id === classificationId);
  const importer = profile.data?.company_name || profile.data?.first_name || '';
  const paths = useMemo(() => (invites.data ?? []).flatMap((i) => i.documents.map((d) => d.file_path)), [invites.data]);
  const urls = useMyDocumentUrls(paths);
  const today = new Date().toISOString().slice(0, 10);

  const toggle = (k: DocKind) => setRequested((r) => (r.includes(k) ? r.filter((x) => x !== k) : [...r, k]));
  const submit = () => {
    setTried(true);
    if (name.trim().length < 2 || requested.length === 0) return;
    create.mutate(
      { supplierName: name.trim(), requested, contact: contact.trim(), language: lang, message: message.trim(), dueOn: due || null, classificationId },
      {
        onSuccess: (res) => {
          setForm(false);
          setShare({ link: supplierLink(res.token), lang, supplier: name.trim(), requested });
          setName(''); setContact(''); setMessage(''); setDue(''); setClassificationId(null); setTried(false);
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  return (
    <CustomsShell title={t('suppliers.title', { defaultValue: 'Mes fournisseurs' })} backTo="/douane">
      <div className="mx-auto max-w-2xl space-y-5 px-4 pb-12 pt-3">
        <Card className="space-y-3 p-5">
          <p className={cn(TYPE.title, TEXT.strong)}>{t('suppliers.tagline', { defaultValue: 'Les bons documents, directement de votre fournisseur.' })}</p>
          <Line>{t('suppliers.intro', { defaultValue: 'Sans facture définitive déposée à temps, la SGS peut retenir une valeur bien plus élevée : 2 311 829 F de trop sur une Toyota Fortuner. Envoyez un lien à votre fournisseur : il dépose, vous êtes prévenu.' })}</Line>
          <Button className="w-full" onClick={() => setForm(true)}><UserPlus aria-hidden /> {t('suppliers.invite', { defaultValue: 'Inviter un fournisseur' })}</Button>
        </Card>

        {invites.isLoading ? <ScreenLoader className="min-h-0 py-10" />
          : invites.isError ? <ScreenError className="min-h-0 py-6" description={(invites.error as Error).message} onRetry={() => invites.refetch()} />
          : (invites.data ?? []).length === 0 ? <Line className={TEXT.muted}>{t('suppliers.none', { defaultValue: 'Vos invitations et les documents reçus apparaîtront ici.' })}</Line>
          : (
            <div className="space-y-3">
              {invites.data!.map((inv) => (
                <InviteCard key={inv.id} inv={inv} urls={urls.data} rotating={rotate.isPending && rotate.variables === inv.id}
                  onRevoke={() => setClosing(inv)}
                  onRotate={() => rotate.mutate(inv.id, {
                    onSuccess: (r) => setShare({ link: supplierLink(r.token), lang: inv.language, supplier: inv.supplier_name, requested: inv.requested }),
                    onError: (e) => toast.error((e as Error).message),
                  })} />
              ))}
            </div>
          )}
      </div>

      <BottomSheet open={form} onClose={() => setForm(false)} title={t('suppliers.formTitle', { defaultValue: 'Inviter un fournisseur' })}>
        <div className="space-y-4">
          {linked && <p className={cn('rounded-lg p-3', SURFACE.inset, TYPE.body, TEXT.body)}>{t('suppliers.linkedTo', { product: linked.product_name, defaultValue: `Pour la fiche « ${linked.product_name} »` })}</p>}
          <FormField label={t('suppliers.name', { defaultValue: 'Le fournisseur' })} htmlFor="sp-name" error={tried && name.trim().length < 2 ? t('suppliers.nameRequired', { defaultValue: 'Son nom ou celui de sa société.' }) : null}>
            <TextInput id="sp-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Shenzhen Power Co." />
          </FormField>
          <FormField label={t('suppliers.contact', { defaultValue: 'WeChat, e-mail ou téléphone (facultatif)' })} htmlFor="sp-contact"
            hint={t('suppliers.contactHint', { defaultValue: 'Pour vous : le fournisseur ne voit pas ce champ.' })}>
            <TextInput id="sp-contact" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={160} />
          </FormField>
          <div className="space-y-2">
            <p className={cn(TYPE.bodyStrong, TEXT.strong)}>{t('suppliers.language', { defaultValue: 'Sa langue' })}</p>
            <Segmented<Lang> value={lang} onChange={setLang} options={[{ value: 'zh', label: '中文' }, { value: 'en', label: 'English' }, { value: 'fr', label: 'Français' }]} />
          </div>
          <div className="space-y-2">
            <p className={cn(TYPE.bodyStrong, TEXT.strong)}>{t('suppliers.docs', { defaultValue: 'Les documents à déposer' })}</p>
            <div className="flex flex-wrap gap-2">
              {DOC_KINDS.map((k) => (
                <button key={k} type="button" aria-pressed={requested.includes(k)} onClick={() => toggle(k)}
                  className={cn('inline-flex h-11 items-center gap-1.5 px-3 text-[15px] font-semibold', FOCUS_RING, requested.includes(k) ? TOGGLE_ON : TOGGLE_OFF)}>
                  {requested.includes(k) && <Check aria-hidden className="h-4 w-4" />}{t(`supplier.kind.${k}`, { defaultValue: k })}
                </button>
              ))}
            </div>
            {tried && requested.length === 0 && <p className="text-[16px] text-[#900B09] dark:text-[#FCB3AD]">{t('suppliers.docsRequired', { defaultValue: 'Choisissez au moins un document.' })}</p>}
          </div>
          <FormField label={t('suppliers.message', { defaultValue: 'Un mot pour lui (facultatif)' })} htmlFor="sp-msg"
            hint={t('suppliers.messageHint', { defaultValue: 'Il le lit tel quel : écrivez-le dans sa langue, ou en anglais.' })}>
            <TextArea id="sp-msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} placeholder="PO-118" />
          </FormField>
          <FormField label={t('suppliers.due', { defaultValue: 'Pour quand (facultatif)' })} htmlFor="sp-due">
            <TextInput id="sp-due" type="date" min={today} value={due} onChange={(e) => setDue(e.target.value)} />
          </FormField>
          <Button className="w-full" loading={create.isPending} onClick={submit}><Send aria-hidden /> {t('suppliers.create', { defaultValue: 'Créer le lien' })}</Button>
        </div>
      </BottomSheet>

      {share && <ShareSheet open onClose={() => setShare(null)} link={share.link} lang={share.lang} supplier={share.supplier} importer={importer} requested={share.requested} />}

      <BottomSheet open={closing !== null} onClose={() => setClosing(null)} title={t('suppliers.revokeTitle', { defaultValue: 'Fermer ce lien ?' })}>
        <div className="space-y-4">
          <Line>{t('suppliers.revokeText', { defaultValue: 'Le fournisseur ne pourra plus rien déposer. Les documents déjà reçus restent dans votre dossier.' })}</Line>
          <Button variant="danger" className="w-full" loading={revoke.isPending} onClick={() => closing && revoke.mutate(closing.id, {
            onSuccess: () => setClosing(null),
            onError: (e) => toast.error((e as Error).message),
          })}>{t('suppliers.revoke', { defaultValue: 'Fermer le lien' })}</Button>
          <Button variant="subtle" className="w-full" onClick={() => setClosing(null)}>{t('files.keep', { defaultValue: 'Pas maintenant' })}</Button>
        </div>
      </BottomSheet>
    </CustomsShell>
  );
}

export default SuppliersPage;
