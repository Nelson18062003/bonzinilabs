// ============================================================
// Vérifier une déclaration — /douane/audit (client connecté).
// Le client dépose sa DAU ; l'IA la lit, le moteur recalcule chaque taxe et
// confronte chaque code à sa désignation (docs/douane/00-plan.md, étape 5).
//
// Ordinateur : le dépôt à gauche, mes vérifications et ce que nous
// vérifions à droite. Téléphone : le dépôt, puis mes vérifications.
// ============================================================
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ChevronRight, FileText, Loader2, ScanLine, Upload, X } from 'lucide-react';
import { cn, validateUploadFile } from '@/lib/utils';
import { StatusPill } from '@/mobile/designKit';
import { AUDIT_STATUS, type AuditStatus } from '@/lib/customs/files';
import { useMyCustomsFiles } from '@/hooks/useCustomsFiles';
import { useCreateAudit } from '@/hooks/useCustomsAudits';
import { xaf } from './format';
import { SiteLayout } from './site/SiteLayout';
import { Button, Container, Field, Input, PageIntro, Reveal, StatusBadge } from './site/ui';

const MAX_FILES = 10;

/** Le statut d'une vérification, pour l'espace équipe (kit de l'app). */
export function AuditStatusPill({ status }: { status: AuditStatus }) {
  const { t } = useTranslation('customs');
  return <StatusPill tone={AUDIT_STATUS[status].tone} label={t(`audit.status.${status}`, { defaultValue: AUDIT_STATUS[status].fr })} />;
}

export function AuditHomePage() {
  const { t } = useTranslation('customs');
  const navigate = useNavigate();
  const files = useMyCustomsFiles();
  const create = useCreateAudit();
  const [picked, setPicked] = useState<File[]>([]);
  const [dauNumber, setDauNumber] = useState('');
  const [paidOn, setPaidOn] = useState('');
  const [tried, setTried] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  const add = (list: FileList | null) => {
    if (!list) return;
    const next = [...picked];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_FILES) { toast.error(t('audit.filesMax', { max: MAX_FILES })); break; }
      try { validateUploadFile(f); } catch (e) { toast.error((e as Error).message); continue; }
      next.push(f);
    }
    setPicked(next);
  };

  const submit = () => {
    setTried(true);
    if (!picked.length) return;
    if (paidOn && paidOn > today) { toast.error(t('audit.paidFuture')); return; }
    create.mutate(
      { files: picked, dauNumber, paidOn: paidOn || null },
      { onSuccess: (res) => navigate(`/douane/audit/${res.id}`), onError: (e) => toast.error((e as Error).message) },
    );
  };

  const audits = files.data?.audits ?? [];
  const checks = [t('audit.check1'), t('audit.check2'), t('audit.check3')];

  return (
    <SiteLayout>
      <PageIntro title={t('audit.homeTitle')} subtitle={t('audit.homeTagline')} back={{ to: '/douane', label: t('site.badge') }} />
      <Container className="grid gap-8 pb-20 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12">
        <section aria-labelledby="dz-new-audit" className="min-w-0 rounded-3xl border border-dz-line bg-dz-card p-5 sm:p-7">
          <h2 id="dz-new-audit" className="text-[20px] font-bold">{t('audit.newTitle')}</h2>
          <div className="mt-5 space-y-5">
            <div className="space-y-2">
              {picked.length > 0 && (
                <ul className="overflow-hidden rounded-2xl border border-dz-line">
                  {picked.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center gap-3 border-b border-dz-line px-4 py-2.5 last:border-b-0">
                      <FileText aria-hidden className="h-5 w-5 shrink-0 text-dz-ink3" />
                      <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{f.name}</span>
                      <button type="button" onClick={() => setPicked(picked.filter((_, k) => k !== i))} aria-label={t('audit.fileRemove', { name: f.name })}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-dz-ink3 hover:bg-dz-soft hover:text-dz-ink">
                        <X aria-hidden className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {picked.length < MAX_FILES && (
                <button type="button" onClick={() => inputRef.current?.click()}
                  className={cn('flex min-h-[120px] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-6 text-center transition-colors hover:bg-dz-soft',
                    tried && !picked.length ? 'border-dz-bad' : 'border-dz-ink3/40 hover:border-dz-ink/40')}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-dz-brand-soft text-dz-brand"><Upload aria-hidden className="h-5 w-5" /></span>
                  <span className="text-[16px] font-semibold">{picked.length ? t('audit.addMore') : t('audit.addFiles')}</span>
                  <span className="text-[14px] text-dz-ink3">{t('audit.filesHint')}</span>
                </button>
              )}
              {tried && !picked.length && <p className="text-[15px] font-medium text-dz-bad">{t('audit.filesRequired')}</p>}
              <input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple className="hidden"
                onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('audit.dauNumber')} htmlFor="au-number">
                <Input id="au-number" value={dauNumber} onChange={(e) => setDauNumber(e.target.value)} maxLength={80} placeholder="SDSD2-2026-IMP-…" autoComplete="off" />
              </Field>
              <Field label={t('audit.paidOnLabel')} htmlFor="au-paid" hint={t('audit.paidOnHint')}>
                <Input id="au-paid" type="date" value={paidOn} max={today} onChange={(e) => setPaidOn(e.target.value)} />
              </Field>
            </div>
            <Button size="lg" className="w-full" onClick={submit} disabled={create.isPending}>
              {create.isPending ? <Loader2 aria-hidden className="animate-spin" /> : <ScanLine aria-hidden />} {t('audit.start')}
            </Button>
            <p className="text-[14px] leading-relaxed text-dz-ink3">{t('audit.privacy')}</p>
          </div>
        </section>

        <div className="min-w-0 space-y-8 lg:sticky lg:top-24 lg:self-start">
          {audits.length > 0 && (
            <section aria-labelledby="dz-audits">
              <h2 id="dz-audits" className="text-[18px] font-bold">{t('audit.mine')}</h2>
              <ul className="mt-3 overflow-hidden rounded-2xl border border-dz-line bg-dz-card">
                {audits.map((a, i) => (
                  <Reveal as="li" key={a.id} delay={Math.min(i, 5) * 0.04} y={6} className="border-b border-dz-line last:border-b-0">
                    <Link to={`/douane/audit/${a.id}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-dz-soft">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold tabular-nums">{a.dau_number ?? a.ref}</span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[14px] text-dz-ink3">
                          <StatusBadge tone={AUDIT_STATUS[a.status].tone}>{t(`audit.status.${a.status}`, { defaultValue: AUDIT_STATUS[a.status].fr })}</StatusBadge>
                          {a.recoverable_xaf != null
                            ? <span className="tabular-nums">{t('audit.recoverableShort', { amount: xaf(a.recoverable_xaf) })}</span>
                            : a.overpaid_xaf ? <span className="tabular-nums">{t('audit.atStake', { amount: xaf(a.overpaid_xaf) })}</span> : null}
                        </span>
                      </span>
                      <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-dz-ink3" />
                    </Link>
                  </Reveal>
                ))}
              </ul>
            </section>
          )}
          {files.isError && <p className="rounded-2xl bg-dz-soft p-4 text-[15px]">{(files.error as Error).message}</p>}

          <section aria-labelledby="dz-checks">
            <h2 id="dz-checks" className="text-[18px] font-bold">{t('site.audit.what')}</h2>
            <p className="mt-2 text-[15px] leading-snug text-dz-ink3">{t('audit.homeIntro')}</p>
            <ol className="mt-4 space-y-4">
              {checks.map((c, i) => (
                <li key={c} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-dz-brand-soft text-[14px] font-bold text-dz-brand">{i + 1}</span>
                  <span className="pt-1 text-[15px] leading-snug text-dz-ink2">{c}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </Container>
    </SiteLayout>
  );
}

export default AuditHomePage;
