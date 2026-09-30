// ============================================================
// La page du fournisseur invité — /f/:token (public, sans compte).
// Un fournisseur chinois l'ouvre depuis WeChat : elle parle chinois par
// défaut (ou la langue choisie par l'importateur), dit qui demande quoi et
// pourquoi, et reçoit les fichiers. Rien d'autre du dossier n'est visible.
// ============================================================
import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, FileUp, Loader2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, Line, ScreenLoader, SURFACE, TEXT, TYPE, TOGGLE_OFF, TOGGLE_ON, FOCUS_RING } from '@/mobile/designKit';
import { useSupplierInvite, useSupplierUpload, type DocKind } from '@/hooks/useCustomsInvites';

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
    <Card className={cn('space-y-3 p-4', done && 'border-[#14AE5C] dark:border-[#14AE5C]')}>
      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          done ? 'bg-[#CFF7D3] text-[#02542D] dark:bg-[#02542D] dark:text-[#CFF7D3]' : SURFACE.holder)}>
          {done ? <CheckCircle2 className="h-5 w-5" /> : <FileUp className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <p className={cn(TYPE.bodyStrong, TEXT.strong)}>{tt(`supplier.kind.${kind}`)}</p>
          <p className={cn(TYPE.body, TEXT.muted)}>{tt(`supplier.hint.${kind}`)}</p>
        </div>
      </div>
      {uploaded.length > 0 && (
        <ul className={cn('space-y-1 rounded-lg p-3', SURFACE.inset)}>
          {uploaded.map((d, i) => (
            <li key={i} className={cn('flex items-center justify-between gap-3', TYPE.small, TEXT.body)}>
              <span className="min-w-0 truncate">{d.file_name ?? tt('supplier.file')}</span>
              <span className={cn('shrink-0 tabular-nums', TEXT.muted)}>{new Date(d.created_at).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </li>
          ))}
        </ul>
      )}
      {kind === 'final_invoice' && <p className={cn(TYPE.small, TEXT.muted)}>{tt('supplier.sgsTip')}</p>}
      <button type="button" disabled={busy} onClick={() => input.current?.click()}
        className={cn('flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-4 text-[16px] font-semibold', FOCUS_RING,
          done ? 'border border-[#767676] bg-[#E3E3E3] text-[#303030] dark:bg-[#444444] dark:text-[#F5F5F5]' : 'bg-[#2C2C2C] text-[#F5F5F5] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]',
          busy && 'opacity-70')}>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileUp className="h-5 w-5" />}
        {busy ? tt('supplier.uploading') : done ? tt('supplier.addAnother') : tt('supplier.upload')}
      </button>
      <input ref={input} type="file" className="hidden" multiple={kind === 'photos' || kind === 'other'}
        accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => { void send(e.target.files); e.target.value = ''; }} />
      {error && <p className="text-[15px] font-semibold text-[#900B09] dark:text-[#FCB3AD]" role="alert">{error}</p>}
    </Card>
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

  return (
    <div className={cn('min-h-[100dvh]', SURFACE.canvas)} lang={locale}>
      <div className="mx-auto max-w-xl space-y-5 px-4 pb-16 pt-5">
        <header className="flex items-center justify-between gap-3">
          <p className={cn('text-[18px] font-bold tracking-tight', TEXT.strong)}>Bonzini Labs</p>
          <div className="flex gap-1" role="group" aria-label="Language">
            {LANGS.map((l) => (
              <button key={l.value} type="button" onClick={() => setChosen(l.value)} aria-pressed={lang === l.value}
                className={cn('h-9 min-w-11 px-2 text-[15px] font-semibold', FOCUS_RING, lang === l.value ? TOGGLE_ON : TOGGLE_OFF)}>{l.label}</button>
            ))}
          </div>
        </header>

        {q.isLoading ? <ScreenLoader label="…" /> : !inv ? (
          <Card className="space-y-2 p-5">
            <p className={cn(TYPE.lead, TEXT.strong)}>{tt('supplier.invalidTitle')}</p>
            <Line>{tt('supplier.error.invalid_or_expired')}</Line>
          </Card>
        ) : (
          <>
            <div className="space-y-2">
              <p className={cn(TYPE.small, TEXT.muted)}>{tt('supplier.hello', { name: inv.supplier_name })}</p>
              <h1 className={cn(TYPE.heading, TEXT.strong)}>{tt('supplier.title', { importer: inv.importer ?? '—' })}</h1>
              <Line>{tt('supplier.intro')}</Line>
              {inv.due_on && (
                <p className={cn(TYPE.bodyStrong, TEXT.strong)}>
                  {tt('supplier.due', { date: new Date(`${inv.due_on}T00:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) })}
                </p>
              )}
            </div>
            {inv.message && (
              <Card className={cn('space-y-1 p-4', SURFACE.inset)}>
                <p className={cn(TYPE.smallStrong, TEXT.muted)}>{tt('supplier.messageFrom', { importer: inv.importer ?? '' })}</p>
                <p className={cn('whitespace-pre-line', TYPE.body, TEXT.body)}>{inv.message}</p>
              </Card>
            )}
            <div className="space-y-3">
              {inv.requested.map((k) => (
                <DocCard key={k} kind={k} lang={lang} token={token!} uploaded={inv.documents.filter((d) => d.kind === k)} />
              ))}
            </div>
            <p className={cn('flex items-start gap-2', TYPE.small, TEXT.muted)}>
              <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{tt('supplier.privacy', { importer: inv.importer ?? '' })}</span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default SupplierUploadPage;
