// ============================================================
// Vérifier une déclaration — /douane/audit (client connecté).
// Le « compliance audit » de Flexport pour CAMCIS : la DAU en PDF ou en
// photos, l'IA la lit, le moteur recalcule chaque taxe et confronte chaque
// code à sa désignation, le commissionnaire agréé rend son avis.
// ============================================================
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { FileText, ListChecks, Scale, ScanLine, Upload, X } from 'lucide-react';
import { cn, validateUploadFile } from '@/lib/utils';
import { Button, Card, FormField, Holder, IconButton, ListRow, Line, ScreenError, SectionTitle, StatusPill, TextInput, SURFACE, TEXT, TYPE, FOCUS_RING } from '@/mobile/designKit';
import { AUDIT_STATUS, type AuditStatus } from '@/lib/customs/files';
import { useMyCustomsFiles } from '@/hooks/useCustomsFiles';
import { useCreateAudit } from '@/hooks/useCustomsAudits';
import { CustomsShell } from './shared';
import { xaf } from './format';

const MAX_FILES = 10;

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
      if (next.length >= MAX_FILES) { toast.error(t('audit.filesMax', { max: MAX_FILES, defaultValue: `${MAX_FILES} pièces au plus` })); break; }
      try { validateUploadFile(f); } catch (e) { toast.error((e as Error).message); continue; }
      next.push(f);
    }
    setPicked(next);
  };

  const submit = () => {
    setTried(true);
    if (!picked.length) return;
    if (paidOn && paidOn > today) { toast.error(t('audit.paidFuture', { defaultValue: 'La date de paiement ne peut pas être dans le futur.' })); return; }
    create.mutate(
      { files: picked, dauNumber, paidOn: paidOn || null },
      { onSuccess: (res) => navigate(`/douane/audit/${res.id}`), onError: (e) => toast.error((e as Error).message) },
    );
  };

  const audits = files.data?.audits ?? [];

  return (
    <CustomsShell title={t('audit.homeTitle', { defaultValue: 'Vérifier une déclaration' })} backTo="/douane">
      <div className="mx-auto max-w-2xl space-y-6 px-4 pb-12 pt-3">
        <Card className="space-y-4 p-5">
          <p className={cn(TYPE.title, TEXT.strong)}>{t('audit.homeTagline', { defaultValue: 'Avez-vous payé le juste droit ?' })}</p>
          <Line>{t('audit.homeIntro', { defaultValue: 'Sur une seule DAU réelle de septembre 2026, quatre articles sur sept étaient mal taxés : 307 078 F sur 900 000 F de marchandises.' })}</Line>
          <ul className="space-y-3">
            {[
              { icon: ScanLine, text: t('audit.check1', { defaultValue: 'Chaque taxe recalculée comme CAMCIS la calcule, article par article.' }) },
              { icon: ListChecks, text: t('audit.check2', { defaultValue: 'Chaque code confronté à sa désignation : un « régulateur » n’est pas un réfrigérateur.' }) },
              { icon: Scale, text: t('audit.check3', { defaultValue: 'Accises et exonérations lues dans le CGI, et la voie de recours avec son délai.' }) },
            ].map((x, i) => (
              <li key={i} className="flex items-start gap-3">
                <Holder icon={x.icon} size="sm" />
                <p className={cn('pt-1.5', TYPE.body, TEXT.body)}>{x.text}</p>
              </li>
            ))}
          </ul>
        </Card>

        <section className="space-y-4" aria-labelledby="new-audit">
          <h2 id="new-audit" className={cn(TYPE.lead, TEXT.strong)}>{t('audit.newTitle', { defaultValue: 'Votre déclaration' })}</h2>
          <div className="space-y-2">
            {picked.length > 0 && (
              <ul className={cn('overflow-hidden rounded-lg', SURFACE.card, SURFACE.shadow)}>
                {picked.map((f, i) => (
                  <li key={`${f.name}-${i}`} className={cn('flex items-center gap-3 border-b px-3 py-2 last:border-b-0', SURFACE.divider)}>
                    <FileText aria-hidden className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
                    <span className={cn('min-w-0 flex-1 truncate', TYPE.body, TEXT.strong)}>{f.name}</span>
                    <IconButton icon={X} size="sm" variant="subtle" ariaLabel={t('audit.fileRemove', { name: f.name, defaultValue: `Retirer ${f.name}` })} onClick={() => setPicked(picked.filter((_, k) => k !== i))} />
                  </li>
                ))}
              </ul>
            )}
            {picked.length < MAX_FILES && (
              <button type="button" onClick={() => inputRef.current?.click()}
                className={cn('flex min-h-[88px] w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-4 text-center',
                  tried && !picked.length ? 'border-[#900B09] dark:border-[#FCB3AD]' : 'border-[#949494] dark:border-[#6E6E6E]', FOCUS_RING)}>
                <Upload aria-hidden className={cn('h-6 w-6', TEXT.body)} />
                <span className={cn(TYPE.bodyStrong, TEXT.strong)}>{picked.length ? t('audit.addMore', { defaultValue: 'Ajouter une page' }) : t('audit.addFiles', { defaultValue: 'Ajouter la DAU' })}</span>
                <span className={cn(TYPE.small, TEXT.muted)}>{t('audit.filesHint', { defaultValue: 'Le PDF de CAMCIS, ou une photo nette de chaque page.' })}</span>
              </button>
            )}
            {tried && !picked.length && <p className="text-[16px] text-[#900B09] dark:text-[#FCB3AD]">{t('audit.filesRequired', { defaultValue: 'Ajoutez la déclaration.' })}</p>}
            <input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple className="hidden"
              onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('audit.dauNumber', { defaultValue: 'Numéro de la DAU (facultatif)' })} htmlFor="au-number">
              <TextInput id="au-number" value={dauNumber} onChange={(e) => setDauNumber(e.target.value)} maxLength={80} placeholder="SDSD2-2026-IMP-…" autoComplete="off" />
            </FormField>
            <FormField label={t('audit.paidOnLabel', { defaultValue: 'Payée le (facultatif)' })} htmlFor="au-paid"
              hint={t('audit.paidOnHint', { defaultValue: 'Fixe le délai de réclamation : trois ans.' })}>
              <TextInput id="au-paid" type="date" value={paidOn} max={today} onChange={(e) => setPaidOn(e.target.value)} />
            </FormField>
          </div>
          <Button className="w-full" loading={create.isPending} onClick={submit}>
            <ScanLine aria-hidden /> {t('audit.start', { defaultValue: 'Vérifier ma déclaration' })}
          </Button>
          <p className={cn(TYPE.small, TEXT.faint)}>
            {t('audit.privacy', { defaultValue: 'La déclaration est lue par notre assistant (Claude, d’Anthropic), puis par le commissionnaire agréé si vous la lui envoyez. Elle ne sert qu’à cette vérification.' })}
          </p>
        </section>

        {files.isError ? (
          <ScreenError className="min-h-0 py-6" description={(files.error as Error).message} onRetry={() => files.refetch()} />
        ) : audits.length > 0 ? (
          <section>
            <SectionTitle>{t('audit.mine', { defaultValue: 'Mes vérifications' })}</SectionTitle>
            <div className={cn('rounded-lg px-4', SURFACE.card, SURFACE.shadow)}>
              {audits.map((a) => (
                <ListRow
                  key={a.id}
                  title={a.dau_number ?? a.ref}
                  subtitle={
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                      <AuditStatusPill status={a.status} />
                      {a.dau_number && <span className="tabular-nums">{a.ref}</span>}
                      {a.recoverable_xaf != null
                        ? <span className="tabular-nums">· {t('audit.recoverableShort', { amount: xaf(a.recoverable_xaf), defaultValue: `récupérable ${xaf(a.recoverable_xaf)}` })}</span>
                        : a.overpaid_xaf ? <span className="tabular-nums">· {t('audit.atStake', { amount: xaf(a.overpaid_xaf), defaultValue: `enjeu ${xaf(a.overpaid_xaf)}` })}</span> : null}
                    </span>
                  }
                  onClick={() => navigate(`/douane/audit/${a.id}`)}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </CustomsShell>
  );
}

export default AuditHomePage;
