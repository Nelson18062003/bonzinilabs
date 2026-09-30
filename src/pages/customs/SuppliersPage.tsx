// ============================================================
// Mes fournisseurs — /douane/fournisseurs (client connecté).
// Les « invitations de partenaires » de Flexport : un lien sans compte que
// l'importateur partage sur WeChat ; le fournisseur y dépose la facture
// définitive (celle que la SGS attend), le colisage, la fiche technique.
//
// Ordinateur : les invitations à gauche ; pourquoi et comment à droite.
// Téléphone : le bouton d'invitation, puis les invitations.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Check, Copy, FileText, Link2, Loader2, Share2, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/lib/clipboard';
import { useMyProfile } from '@/hooks/useProfile';
import { useMyCustomsFiles } from '@/hooks/useCustomsFiles';
import {
  DOC_KINDS, supplierLink, useCreateInvite, useMyDocumentUrls, useMyInvites, useRevokeInvite, useRotateInvite, type DocKind, type Invite,
} from '@/hooks/useCustomsInvites';
import { longDate } from './format';
import { SiteLayout } from './site/SiteLayout';
import { Badge, Button, Container, Field, Input, PageIntro, Pills, Reveal, Sheet, Textarea } from './site/ui';

type Lang = 'zh' | 'en' | 'fr';
const STATUS_TONE: Record<Invite['status'], 'brand' | 'neutral'> = { open: 'brand', expired: 'neutral', revoked: 'neutral' };
const LANGS = [{ value: 'zh', label: '中文' }, { value: 'en', label: 'English' }, { value: 'fr', label: 'Français' }] as const;

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
    void copyToClipboard(message, t('suppliers.messageLabel'));
  };
  return (
    <Sheet open={open} onClose={onClose} title={t('suppliers.shareTitle')}>
      <p className="text-[16px] leading-relaxed text-dz-ink2">{t('suppliers.shareIntro')}</p>
      <p className="mt-4 whitespace-pre-line rounded-2xl bg-dz-soft p-4 text-[15px] leading-relaxed text-dz-ink [overflow-wrap:anywhere]" lang={lang === 'zh' ? 'zh-CN' : lang}>{message}</p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Button onClick={() => void share()}><Share2 aria-hidden /> {t('suppliers.shareCta')}</Button>
        <Button variant="secondary" onClick={() => void copyToClipboard(link, t('suppliers.linkLabel'))}><Copy aria-hidden /> {t('suppliers.copyLink')}</Button>
      </div>
      <p className="mt-4 text-[14px] leading-snug text-dz-ink3">{t('suppliers.linkOnce')}</p>
    </Sheet>
  );
}

function InviteCard({ inv, urls, onRotate, onRevoke, rotating }: {
  inv: Invite; urls: Record<string, string> | undefined; onRotate: () => void; onRevoke: () => void; rotating: boolean;
}) {
  const { t } = useTranslation('customs');
  const received = new Set(inv.documents.map((d) => d.kind));
  const got = inv.requested.filter((k) => received.has(k)).length;
  const late = inv.status === 'open' && !!inv.due_on && inv.due_on < new Date().toISOString().slice(0, 10) && got < inv.requested.length;
  return (
    <article className="rounded-3xl border border-dz-line bg-dz-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="break-words text-[18px] font-semibold leading-snug">{inv.supplier_name}</p>
          {(inv.supplier_contact || inv.due_on) && (
            <p className="mt-0.5 break-words text-[14px] text-dz-ink3">
              {inv.supplier_contact}{inv.supplier_contact && inv.due_on ? ' · ' : ''}
              {inv.due_on && <span className={cn(late && 'font-semibold text-dz-bad')}>{t('suppliers.dueShort', { date: longDate(inv.due_on) })}</span>}
            </p>
          )}
        </div>
        <Badge tone={STATUS_TONE[inv.status]} className="shrink-0">{t(`suppliers.status.${inv.status}`)}</Badge>
      </div>

      {/* Ce qui est attendu, et ce qui est arrivé. */}
      <div className="mt-4 flex items-center gap-3">
        <div aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-dz-soft">
          <div className="h-full rounded-full bg-dz-good transition-[width] duration-500" style={{ width: `${inv.requested.length ? (got / inv.requested.length) * 100 : 0}%` }} />
        </div>
        <span className="shrink-0 text-[14px] font-semibold tabular-nums text-dz-ink2">{t('site.suppliers.received', { n: got, total: inv.requested.length })}</span>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {inv.requested.map((k) => (
          <li key={k} className={cn('inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[14px]',
            received.has(k) ? 'bg-dz-good-soft font-semibold text-dz-good' : 'bg-dz-soft text-dz-ink2')}>
            {received.has(k) && <Check aria-hidden className="h-4 w-4" />}{t(`supplier.kind.${k}`)}
          </li>
        ))}
      </ul>

      {inv.documents.length > 0 && (
        <ul className="mt-4 rounded-2xl bg-dz-soft px-4">
          {inv.documents.map((d) => (
            <li key={d.id} className="border-b border-dz-line last:border-b-0">
              <a href={urls?.[d.file_path]} target="_blank" rel="noreferrer" className="flex min-h-12 items-center gap-3 py-2.5">
                <FileText aria-hidden className="h-5 w-5 shrink-0 text-dz-ink3" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold underline-offset-2 hover:underline">{d.file_name ?? t(`supplier.kind.${d.kind}`)}</span>
                  <span className="block text-[14px] text-dz-ink3">
                    {t(`supplier.kind.${d.kind}`)} · {new Date(d.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}{d.note ? ` · ${d.note}` : ''}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {inv.status !== 'revoked' && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-dz-line pt-4">
          <Button size="sm" variant="secondary" disabled={rotating} onClick={onRotate}>
            {rotating ? <Loader2 aria-hidden className="animate-spin" /> : <Link2 aria-hidden />} {t('suppliers.newLink')}
          </Button>
          {inv.status === 'open' && (
            <Button size="sm" variant="ghost" className="px-3 text-dz-bad hover:text-dz-bad" onClick={onRevoke}>{t('suppliers.revoke')}</Button>
          )}
        </div>
      )}
    </article>
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
  const list = invites.data ?? [];
  const nameError = tried && name.trim().length < 2 ? t('suppliers.nameRequired') : null;

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

  const steps = [1, 2, 3].map((n) => ({ title: t(`site.suppliers.how${n}`), desc: t(`site.suppliers.how${n}Desc`) }));
  const inviteButton = (className?: string) => (
    <Button className={className} onClick={() => setForm(true)}><UserPlus aria-hidden /> {t('suppliers.invite')}</Button>
  );

  return (
    <SiteLayout>
      <PageIntro title={t('suppliers.title')} subtitle={t('suppliers.tagline')} back={{ to: '/douane', label: t('site.badge') }}
        actions={list.length > 0 ? inviteButton('hidden sm:inline-flex') : undefined} />
      <Container className="grid gap-8 pb-20 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
        <div className="min-w-0 space-y-4">
          {list.length > 0 && inviteButton('w-full sm:hidden')}
          {invites.isLoading ? (
            <div className="space-y-4" aria-busy="true">{[0, 1].map((i) => <div key={i} className="h-44 animate-pulse rounded-3xl bg-dz-soft" />)}</div>
          ) : invites.isError ? (
            <div className="rounded-3xl border border-dz-line p-6">
              <p className="text-[16px]">{(invites.error as Error).message}</p>
              <Button className="mt-4" variant="secondary" onClick={() => { void invites.refetch(); }}>{t('site.retry')}</Button>
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center rounded-3xl border border-dashed border-dz-ink3/40 px-6 py-12 text-center sm:py-16">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-dz-brand-soft text-dz-brand"><UserPlus aria-hidden className="h-6 w-6" /></span>
              <p className="mt-4 text-[19px] font-semibold">{t('site.suppliers.emptyTitle')}</p>
              <p className="mt-1.5 max-w-[42ch] text-[15px] leading-snug text-dz-ink3">{t('suppliers.none')}</p>
              {inviteButton('mt-6')}
            </div>
          ) : (
            list.map((inv, i) => (
              <Reveal key={inv.id} delay={Math.min(i, 4) * 0.04} y={8}>
                <InviteCard inv={inv} urls={urls.data} rotating={rotate.isPending && rotate.variables === inv.id}
                  onRevoke={() => setClosing(inv)}
                  onRotate={() => rotate.mutate(inv.id, {
                    onSuccess: (r) => setShare({ link: supplierLink(r.token), lang: inv.language, supplier: inv.supplier_name, requested: inv.requested }),
                    onError: (e) => toast.error((e as Error).message),
                  })} />
              </Reveal>
            ))
          )}
        </div>

        <aside className="min-w-0 space-y-8 lg:sticky lg:top-24 lg:self-start">
          <section aria-labelledby="dz-sp-why" className="rounded-3xl bg-dz-soft p-6">
            <h2 id="dz-sp-why" className="text-[18px] font-bold">{t('site.suppliers.why')}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-dz-ink2">{t('suppliers.intro')}</p>
          </section>
          <section aria-labelledby="dz-sp-how">
            <h2 id="dz-sp-how" className="text-[18px] font-bold">{t('site.suppliers.how')}</h2>
            <ol className="mt-4 space-y-4">
              {steps.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-dz-brand-soft text-[14px] font-bold text-dz-brand">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block text-[16px] font-semibold">{s.title}</span>
                    <span className="mt-0.5 block text-[14px] leading-snug text-dz-ink3">{s.desc}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </Container>

      <Sheet open={form} onClose={() => setForm(false)} title={t('suppliers.formTitle')}>
        <div className="space-y-5">
          {linked && <p className="rounded-2xl bg-dz-brand-soft p-4 text-[15px] font-medium text-dz-brand">{t('suppliers.linkedTo', { product: linked.product_name })}</p>}
          <Field label={t('suppliers.name')} htmlFor="sp-name" hint={nameError}>
            <Input id="sp-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Shenzhen Power Co." autoComplete="off"
              aria-invalid={!!nameError} className={cn(nameError && 'border-dz-bad focus:border-dz-bad')} />
          </Field>
          <div className="space-y-2">
            <p className="text-[15px] font-semibold">{t('suppliers.docs')}</p>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {DOC_KINDS.map((k) => {
                const on = requested.includes(k);
                return (
                  <button key={k} type="button" aria-pressed={on} onClick={() => toggle(k)}
                    className={cn('flex min-h-11 items-center gap-1.5 rounded-2xl px-3 py-2 text-left text-[15px] font-semibold leading-tight transition-colors sm:inline-flex sm:h-11 sm:rounded-full sm:px-4 sm:py-0',
                      on ? 'bg-dz-primary text-dz-on-primary' : 'border border-dz-line bg-dz-card text-dz-ink2 hover:border-dz-ink/25 hover:text-dz-ink')}>
                    {on && <Check aria-hidden className="h-4 w-4 shrink-0" />}{t(`supplier.kind.${k}`)}
                  </button>
                );
              })}
            </div>
            {tried && requested.length === 0 && <p className="text-[15px] font-medium text-dz-bad">{t('suppliers.docsRequired')}</p>}
          </div>
          <div className="space-y-2">
            <p className="text-[15px] font-semibold">{t('suppliers.language')}</p>
            <Pills<Lang> options={LANGS} value={lang} onChange={setLang} label={t('suppliers.language')} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('suppliers.contact')} htmlFor="sp-contact" hint={t('suppliers.contactHint')}>
              <Input id="sp-contact" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={160} autoComplete="off" />
            </Field>
            <Field label={t('suppliers.due')} htmlFor="sp-due">
              <Input id="sp-due" type="date" min={today} value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
          </div>
          <Field label={t('suppliers.message')} htmlFor="sp-msg" hint={t('suppliers.messageHint')}>
            <Textarea id="sp-msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} placeholder="PO-118" className="min-h-[96px]" />
          </Field>
          <Button size="lg" className="w-full" disabled={create.isPending} onClick={submit}>
            {create.isPending ? <Loader2 aria-hidden className="animate-spin" /> : <Link2 aria-hidden />} {t('suppliers.create')}
          </Button>
        </div>
      </Sheet>

      {share && <ShareSheet open onClose={() => setShare(null)} link={share.link} lang={share.lang} supplier={share.supplier} importer={importer} requested={share.requested} />}

      <Sheet open={closing !== null} onClose={() => setClosing(null)} title={t('suppliers.revokeTitle')}>
        <p className="text-[16px] leading-relaxed text-dz-ink2">{t('suppliers.revokeText')}</p>
        <div className="mt-6 grid gap-2">
          <Button size="lg" className="bg-dz-bad text-white hover:bg-dz-bad/90" disabled={revoke.isPending} onClick={() => closing && revoke.mutate(closing.id, {
            onSuccess: () => setClosing(null),
            onError: (e) => toast.error((e as Error).message),
          })}>{t('suppliers.revoke')}</Button>
          <Button variant="ghost" onClick={() => setClosing(null)}>{t('files.keep')}</Button>
        </div>
      </Sheet>
    </SiteLayout>
  );
}

export default SuppliersPage;
