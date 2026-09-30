// ============================================================
// La page du fournisseur invité — /f/:token (public, sans compte).
// Un fournisseur chinois l'ouvre depuis WeChat : elle parle chinois par
// défaut (ou la langue choisie par l'importateur), dit qui demande quoi et
// pourquoi, et reçoit les fichiers. Rien d'autre du dossier n'est visible.
// ============================================================
import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MotionConfig } from 'framer-motion';
import { CheckCircle2, FileUp, Loader2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BonziniLogo } from '@/components/brand/BonziniLogo';
import { useSupplierInvite, useSupplierUpload, type DocKind } from '@/hooks/useCustomsInvites';
import { Button, Pills, Reveal } from './site/ui';

type Lang = 'zh' | 'en' | 'fr';
const LANGS: { value: Lang; label: string; locale: string }[] = [
  { value: 'zh', label: '中文', locale: 'zh-CN' },
  { value: 'en', label: 'EN', locale: 'en-GB' },
  { value: 'fr', label: 'FR', locale: 'fr-FR' },
];

function DocCard({ kind, lang, uploaded, token }: { kind: DocKind; lang: Lang; uploaded: { file_name: string | null; created_at: string }[]; token: string }) {
  const { t } = useTranslation('customs');
  const tt = (k: string, o: Record<string, unknown> = {}) => t(k, { ...o, lng: lang });
  const upload = useSupplierUpload(token);
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const locale = LANGS.find((l) => l.value === lang)!.locale;

  const send = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    setBusy(true);
    try {
      for (const file of Array.from(files).slice(0, 10)) await upload.mutateAsync({ kind, file });
    } catch (e) {
      const code = (e as Error).message;
      setError(tt(`supplier.error.${code}`, { defaultValue: tt('supplier.error.server') }));
    } finally {
      setBusy(false);
    }
  };

  const done = uploaded.length > 0;
  return (
    <article className={cn('rounded-[28px] bg-dz-card p-5 transition-shadow sm:p-6', done && 'ring-2 ring-dz-good')}>
      <div className="flex items-start gap-4">
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', done ? 'bg-dz-good-soft text-dz-good' : 'bg-dz-soft text-dz-ink2')}>
          {done ? <CheckCircle2 aria-hidden className="h-5 w-5" /> : <FileUp aria-hidden className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold leading-snug">{tt(`supplier.kind.${kind}`)}</h2>
          <p className="mt-0.5 text-[15px] leading-snug text-dz-ink3">{tt(`supplier.hint.${kind}`)}</p>
        </div>
      </div>
      {uploaded.length > 0 && (
        <ul className="mt-4 rounded-2xl bg-dz-soft px-4">
          {uploaded.map((d, i) => (
            <li key={i} className="flex items-center justify-between gap-3 border-b border-dz-line py-2.5 text-[14px] last:border-b-0">
              <span className="min-w-0 truncate font-medium">{d.file_name ?? tt('supplier.file')}</span>
              <span className="shrink-0 tabular-nums text-dz-ink3">{new Date(d.created_at).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </li>
          ))}
        </ul>
      )}
      {kind === 'final_invoice' && <p className="mt-4 rounded-2xl bg-dz-warn-soft p-4 text-[14px] leading-snug text-dz-ink2">{tt('supplier.sgsTip')}</p>}
      <Button variant={done ? 'secondary' : 'primary'} className="mt-4 w-full" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <Loader2 aria-hidden className="animate-spin" /> : <FileUp aria-hidden />}
        {busy ? tt('supplier.uploading') : done ? tt('supplier.addAnother') : tt('supplier.upload')}
      </Button>
      <input ref={input} type="file" className="hidden" multiple={kind === 'photos' || kind === 'other'}
        accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => { void send(e.target.files); e.target.value = ''; }} />
      {error && <p className="mt-3 text-[15px] font-semibold text-dz-bad" role="alert">{error}</p>}
    </article>
  );
}

export function SupplierUploadPage() {
  const { token } = useParams();
  const { t } = useTranslation('customs');
  const q = useSupplierInvite(token);
  const [chosen, setChosen] = useState<Lang | null>(null);
  const inv = q.data;
  const lang: Lang = chosen ?? inv?.language ?? 'zh';
  const tt = (k: string, o: Record<string, unknown> = {}) => t(k, { ...o, lng: lang });
  const locale = LANGS.find((l) => l.value === lang)!.locale;
  const got = inv ? inv.requested.filter((k) => inv.documents.some((d) => d.kind === k)).length : 0;

  return (
    <MotionConfig reducedMotion="user">
      <div className="dz min-h-[100dvh] bg-dz-bg text-dz-ink antialiased" lang={locale}>
        <header className="border-b border-dz-line">
          <div className="mx-auto flex h-16 max-w-[640px] items-center justify-between gap-3 px-5">
            <span className="flex min-w-0 items-center gap-2.5">
              <BonziniLogo size={30} />
              <span className="whitespace-nowrap text-[17px] font-bold tracking-[-0.01em]">Bonzini Labs</span>
            </span>
            <Pills<Lang> options={LANGS} value={lang} onChange={setChosen} label="Language" className="shrink-0 flex-nowrap gap-1 [&_button]:h-9 [&_button]:px-2.5 [&_button]:text-[14px] sm:[&_button]:px-3" />
          </div>
        </header>

        <main className="mx-auto max-w-[640px] px-5 pb-20 pt-8 sm:pt-12">
          {q.isLoading ? (
            <div className="space-y-4" aria-busy="true">
              <div className="h-24 animate-pulse rounded-[28px] bg-dz-fill" />
              {[0, 1].map((i) => <div key={i} className="h-44 animate-pulse rounded-[28px] bg-dz-fill" />)}
            </div>
          ) : !inv ? (
            <div className="rounded-[28px] bg-dz-card p-6">
              <h1 className="text-[22px] font-bold">{tt('supplier.invalidTitle')}</h1>
              <p className="mt-2 text-[16px] leading-relaxed text-dz-ink2">{tt('supplier.error.invalid_or_expired')}</p>
            </div>
          ) : (
            <>
              <p className="text-[15px] text-dz-ink3">{tt('supplier.hello', { name: inv.supplier_name })}</p>
              <h1 className="mt-2 [text-wrap:balance] text-[28px] font-bold leading-[1.15] tracking-[-0.02em] sm:text-[34px]">{tt('supplier.title', { importer: inv.importer ?? '—' })}</h1>
              <p className="mt-3 text-[16px] leading-relaxed text-dz-ink2">{tt('supplier.intro')}</p>
              {inv.due_on && (
                <p className="mt-3 inline-flex rounded-full bg-dz-brand-soft px-4 py-1.5 text-[15px] font-semibold text-dz-brand">
                  {tt('supplier.due', { date: new Date(`${inv.due_on}T00:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) })}
                </p>
              )}
              {inv.message && (
                <div className="mt-6 rounded-3xl bg-dz-card p-5">
                  <p className="text-[14px] font-semibold text-dz-ink3">{tt('supplier.messageFrom', { importer: inv.importer ?? '' })}</p>
                  <p className="mt-1 whitespace-pre-line text-[16px] leading-relaxed">{inv.message}</p>
                </div>
              )}

              <div className="mt-8 flex items-center gap-3" aria-hidden>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-dz-fill">
                  <div className="h-full rounded-full bg-dz-good transition-[width] duration-500" style={{ width: `${inv.requested.length ? (got / inv.requested.length) * 100 : 0}%` }} />
                </div>
                <span className="shrink-0 text-[14px] font-semibold tabular-nums text-dz-ink2">{got}/{inv.requested.length}</span>
              </div>
              <div className="mt-4 space-y-4">
                {inv.requested.map((k, i) => (
                  <Reveal key={k} delay={Math.min(i, 4) * 0.05} y={10}>
                    <DocCard kind={k} lang={lang} token={token!} uploaded={inv.documents.filter((d) => d.kind === k)} />
                  </Reveal>
                ))}
              </div>
              <p className="mt-8 flex items-start gap-2 text-[14px] leading-snug text-dz-ink3">
                <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{tt('supplier.privacy', { importer: inv.importer ?? '' })}</span>
              </p>
            </>
          )}
        </main>
      </div>
    </MotionConfig>
  );
}

export default SupplierUploadPage;
