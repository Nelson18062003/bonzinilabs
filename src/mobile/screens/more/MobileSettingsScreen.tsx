import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAdminAuth, ADMIN_ROLE_LABELS, type AppRole } from '@/contexts/AdminAuthContext';
import { Palette, Fingerprint, ChevronRight, Lock, Warehouse, Scale, Smartphone, FileDown, Landmark, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { deliverMobileMoneyGuidePdf } from '@/lib/mobileMoneyGuidePdf';
import { deliverBankDetailsPdf } from '@/lib/bankDetailsPdf';
import { bankGuideData } from '@/lib/bankDetailsGuide';
import type { GuideOrientation } from '@/lib/mobileMoneyGuide';
import type { BankOption } from '@/types/deposit';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, Card, Row, SectionTitle, StatusPill, roleMeta } from '@/mobile/designKit';

export function MobileSettingsScreen({ desktop = false }: { desktop?: boolean } = {}) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { currentUser, profile } = useAdminAuth();
  const role = currentUser?.role;
  const pdf = usePdfDelivery();

  return (
    <div className={desktop ? 'mx-auto max-w-2xl' : 'flex min-h-full flex-col'}>
      {desktop ? (
        <header className="mb-6">
          <h2 className={cn('text-[24px] font-bold tracking-tight', TEXT.strong)}>
            {t('settings', { defaultValue: 'Paramètres' })}
          </h2>
          <p className={cn('mt-0.5 text-[14px]', TEXT.muted)}>{t('settingsSubtitle', { defaultValue: 'Apparence, compte et informations' })}</p>
        </header>
      ) : (
        <MobileHeader title={t('settings', { defaultValue: 'Paramètres' })} showBack />
      )}

      <div className={cn(desktop ? 'space-y-5' : 'flex-1 space-y-5 px-4 py-5', !desktop && SURFACE.canvas)}>
        {/* Apparence */}
        <div>
          <SectionTitle>{t('appearance', { defaultValue: 'Apparence' })}</SectionTitle>
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <Palette className={cn('h-4 w-4', TEXT.muted)} />
              <p className={cn('text-[16px] font-semibold', TEXT.strong)}>
                {t('appTheme', { defaultValue: "Thème de l'application" })}
              </p>
            </div>
            <ThemeToggle />
            <p className={cn('mt-3 text-[16px]', TEXT.muted)}>
              {t('systemModeNote', { defaultValue: "Le mode Système s'adapte automatiquement aux préférences de votre appareil." })}
            </p>
          </Card>
        </div>

        {/* Compte */}
        <div>
          <SectionTitle>{t('account', { defaultValue: 'Compte' })}</SectionTitle>
          <Card>
            <Row
              label={t('name', { defaultValue: 'Nom' })}
              value={`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || '—'}
            />
            <div className="flex items-center justify-between gap-3 py-[7px] text-[14px]">
              <span className={TEXT.muted}>{t('role', { defaultValue: 'Rôle' })}</span>
              <StatusPill
                tone={role ? roleMeta(role).tone : 'neutral'}
                label={role ? (ADMIN_ROLE_LABELS[role as AppRole] || role) : 'Admin'}
              />
            </div>
          </Card>
        </div>

        {/* Sécurité */}
        <div>
          <SectionTitle>{t('security', { defaultValue: 'Sécurité' })}</SectionTitle>
          <Card>
            <button
              type="button"
              onClick={() => navigate('/m/more/passkeys')}
              className="flex w-full items-center gap-3 py-1 text-left"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] text-[#1E1E1E] dark:bg-[#383838] dark:text-[#F5F5F5]">
                <Fingerprint className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn('text-[14px] font-semibold', TEXT.strong)}>
                  {t('quickSignIn', { defaultValue: 'Connexion rapide' })}
                </p>
                <p className={cn('text-[14px]', TEXT.muted)}>
                  {t('quickSignInRowHint', { defaultValue: 'Se connecter sans mot de passe sur vos appareils' })}
                </p>
              </div>
              <ChevronRight className={cn('h-[18px] w-[18px] shrink-0', TEXT.muted)} />
            </button>

            <div className="my-1 h-px bg-black/5 dark:bg-white/5" />

            <button
              type="button"
              onClick={() => navigate('/m/more/password')}
              className="flex w-full items-center gap-3 py-1 text-left"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] text-[#1E1E1E] dark:bg-[#383838] dark:text-[#F5F5F5]">
                <Lock className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn('text-[14px] font-semibold', TEXT.strong)}>
                  {t('myPassword', { defaultValue: 'Mon mot de passe' })}
                </p>
                <p className={cn('text-[14px]', TEXT.muted)}>
                  {t('myPasswordRowHint', { defaultValue: 'Choisir un mot de passe dont vous vous souvenez' })}
                </p>
              </div>
              <ChevronRight className={cn('h-[18px] w-[18px] shrink-0', TEXT.muted)} />
            </button>
          </Card>
        </div>

        {/* Expédition — adresses en Chine et coordonnées imprimées sur l'étiquette colis */}
        <div>
          <SectionTitle>{t('shippingSettings', { defaultValue: 'Expédition' })}</SectionTitle>
          <Card>
            <button
              type="button"
              onClick={() => navigate('/m/more/shipping')}
              className="flex w-full items-center gap-3 py-1 text-left"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] text-[#1E1E1E] dark:bg-[#383838] dark:text-[#F5F5F5]">
                <Warehouse className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn('text-[14px] font-semibold', TEXT.strong)}>
                  {t('shippingSettingsRow', { defaultValue: 'Adresses en Chine et coordonnées' })}
                </p>
                <p className={cn('text-[14px]', TEXT.muted)}>
                  {t('shippingSettingsRowHint', { defaultValue: 'Sea cargo (entrepôt), air cargo (bureau), téléphone, WeChat, WhatsApp, e-mail — imprimés sur l’étiquette colis' })}
                </p>
              </div>
              <ChevronRight className={cn('h-[18px] w-[18px] shrink-0', TEXT.muted)} />
            </button>
            <button
              type="button"
              onClick={() => navigate('/m/more/cargo-pricing')}
              className={cn('flex w-full items-center gap-3 border-t py-1 pt-3 text-left', SURFACE.divider)}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] text-[#1E1E1E] dark:bg-[#383838] dark:text-[#F5F5F5]">
                <Scale className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn('text-[14px] font-semibold', TEXT.strong)}>Tarifs cargo</p>
                <p className={cn('text-[14px]', TEXT.muted)}>XAF au kilo (Air cargo), XAF au mètre cube (Sea cargo) — pré-remplissent chaque devis</p>
              </div>
              <ChevronRight className={cn('h-[18px] w-[18px] shrink-0', TEXT.muted)} />
            </button>
            <div className={cn('flex w-full items-center gap-3 border-t py-1 pt-3 text-left', SURFACE.divider)}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] text-[#1E1E1E] dark:bg-[#383838] dark:text-[#F5F5F5]">
                <Smartphone className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn('text-[14px] font-semibold', TEXT.strong)}>Fiche Mobile Money (PDF)</p>
                <p className={cn('text-[14px]', TEXT.muted)}>Orange Money et MTN MoMo, en français et en anglais : numéros, titulaires, codes, Flotte ou Retrait — à envoyer aux clients</p>
                <div className="mt-2 flex gap-2">
                  {([['portrait', 'Portrait'], ['landscape', 'Paysage']] as const).map(([orientation, label]) => (
                    <PdfPill
                      key={orientation}
                      id={`mm-${orientation}`}
                      pdf={pdf}
                      onClick={() => pdf.run(`mm-${orientation}`, () => deliverMobileMoneyGuidePdf(orientation), 'Fiche Mobile Money téléchargée')}
                    >
                      {label}
                    </PdfPill>
                  ))}
                </div>
              </div>
            </div>
            <BankDetailsRow pdf={pdf} />
          </Card>
        </div>

        {/* À propos */}
        <div>
          <SectionTitle>{t('about', { defaultValue: 'À propos' })}</SectionTitle>
          <Card>
            <Row label="Version" value="1.0.0" />
            <Row label="Plateforme" value="Bonzini Admin" />
          </Card>
        </div>
      </div>
    </div>
  );
}

const PILL = 'flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold disabled:opacity-60';
const PILL_IDLE = 'bg-[#F5F5F5] text-[#1E1E1E] dark:bg-[#383838] dark:text-[#F5F5F5]';

/** Un PDF à la fois : la fabrication prend un moment, un second toucher ne relance rien. */
function usePdfDelivery() {
  const [busy, setBusy] = useState<string | null>(null);
  const run = (id: string, deliver: () => Promise<'shared' | 'downloaded'>, downloaded: string) => {
    if (busy) return;
    setBusy(id);
    void deliver()
      .then((o) => { if (o === 'downloaded') toast.success(downloaded); })
      .catch(() => toast.error('Impossible de créer le PDF, réessayez'))
      .finally(() => setBusy(null));
  };
  return { busy, run };
}
type PdfDelivery = ReturnType<typeof usePdfDelivery>;

function PdfPill({ id, pdf, onClick, children }: { id: string; pdf: PdfDelivery; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={pdf.busy !== null} aria-busy={pdf.busy === id} className={cn(PILL, PILL_IDLE)}>
      {pdf.busy === id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} {children}
    </button>
  );
}

/**
 * Les coordonnées bancaires à envoyer à un client : le livret de toutes nos
 * banques, ou le RIB d'une seule banque (une page) — portrait ou paysage.
 * Seules les banques dont l'IBAN se vérifie sont proposées (voir bankGuideData).
 */
function BankDetailsRow({ pdf }: { pdf: PdfDelivery }) {
  const [orientation, setOrientation] = useState<GuideOrientation>('portrait');
  const accounts = bankGuideData().accounts;
  const send = (id: string, bank?: BankOption) => pdf.run(id, () => deliverBankDetailsPdf({ orientation, bank }), 'Coordonnées bancaires téléchargées');
  return (
    <div className={cn('flex w-full items-center gap-3 border-t py-1 pt-3 text-left', SURFACE.divider)}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-full bg-[#F5F5F5] text-[#1E1E1E] dark:bg-[#383838] dark:text-[#F5F5F5]">
        <Landmark className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('text-[14px] font-semibold', TEXT.strong)}>Coordonnées bancaires (PDF)</p>
        <p className={cn('text-[14px]', TEXT.muted)}>Nos banques, en français et en anglais : titulaire, IBAN, SWIFT, RIB — le livret complet, ou le RIB d'une seule banque</p>
        <div className="mt-2 inline-flex rounded-full bg-[#F5F5F5] p-1 dark:bg-[#383838]" role="group" aria-label="Orientation du PDF">
          {([['portrait', 'Portrait'], ['landscape', 'Paysage']] as const).map(([o, label]) => (
            <button
              key={o}
              type="button"
              aria-pressed={orientation === o}
              onClick={() => setOrientation(o)}
              className={cn('rounded-full px-3 py-1 text-[13px] font-semibold', orientation === o ? 'bg-white text-[#1E1E1E] shadow-sm dark:bg-[#1E1E1E] dark:text-[#F5F5F5]' : TEXT.muted)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <PdfPill id="banks" pdf={pdf} onClick={() => send('banks')}>Toutes les banques</PdfPill>
          {accounts.map((a) => (
            <PdfPill key={a.key} id={`rib-${a.key}`} pdf={pdf} onClick={() => send(`rib-${a.key}`, a.key)}>RIB {a.short}</PdfPill>
          ))}
        </div>
      </div>
    </div>
  );
}
