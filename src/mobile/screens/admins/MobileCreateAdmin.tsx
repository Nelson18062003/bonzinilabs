import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Navigate } from 'react-router-dom';
import { useCreateAdmin } from '@/hooks/useAdminManagement';
import { ADMIN_ROLE_LABELS, type AppRole, useAdminAuth } from '@/contexts/AdminAuthContext';
import { cn } from '@/lib/utils';
import { Check, Shield, Copy } from 'lucide-react';
import {
  SURFACE,
  TEXT,
  roleMeta,
  Card,
  Row,
  Holder,
  StatusPill,
  FormField,
  TextInput,
  PrimaryPill,
  SoftPill,
} from '@/mobile/designKit';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';

type Step = 'personal' | 'role' | 'confirm';

const STEPS: { key: Step; num: number; labelKey: string; labelDefault: string }[] = [
  { key: 'personal', num: 1, labelKey: 'personalInfoShort', labelDefault: 'Identité' },
  { key: 'role', num: 2, labelKey: 'role', labelDefault: 'Rôle' },
  { key: 'confirm', num: 3, labelKey: 'confirmation', labelDefault: 'Confirmation' },
];

const MANAGEABLE_ROLES: { role: AppRole; descriptionKey: string; descriptionDefault: string }[] = [
  {
    role: 'super_admin',
    descriptionKey: 'roleSuperAdminDesc',
    descriptionDefault: 'Accès complet à toutes les fonctionnalités, gestion des admins',
  },
  {
    role: 'ops',
    descriptionKey: 'roleOpsDesc',
    descriptionDefault: 'Opérations: dépôts, paiements, taux de change',
  },
  {
    role: 'cash_agent',
    descriptionKey: 'roleCashAgentDesc',
    descriptionDefault: 'Gestion des paiements cash uniquement',
  },
  {
    role: 'treasurer',
    descriptionKey: 'roleTreasurerDesc',
    descriptionDefault: 'Trésorerie : achats/ventes USDT, contreparties, inventaire',
  },
];

export function MobileCreateAdmin() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const createAdminMutation = useCreateAdmin();

  // Form state
  const [step, setStep] = useState<Step>('personal');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<AppRole>('ops');
  const [tempPassword, setTempPassword] = useState('');
  const [createdUserId, setCreatedUserId] = useState('');
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!hasPermission('canManageUsers')) {
    return <Navigate to="/m" replace />;
  }

  // Validation
  const isPersonalValid = !!(firstName.trim() && lastName.trim() && email.trim() && email.includes('@'));
  const isRoleValid = !!selectedRole;
  const canNext = step === 'personal' ? isPersonalValid : step === 'role' ? isRoleValid : true;

  const currentStepNum = STEPS.find((s) => s.key === step)?.num ?? 1;

  const handleNext = () => {
    if (step === 'personal' && isPersonalValid) {
      setStep('role');
    } else if (step === 'role' && isRoleValid) {
      setStep('confirm');
    }
  };

  const handleBack = () => {
    if (step === 'role') setStep('personal');
    else if (step === 'confirm') setStep('role');
  };

  const handleSubmit = async () => {
    try {
      const result = await createAdminMutation.mutateAsync({
        email: email.toLowerCase().trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: selectedRole,
      });

      if (result.tempPassword) {
        setTempPassword(result.tempPassword);
        setCreatedUserId(result.userId || '');
        setIsSuccess(true);
      }
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const handleCopyPassword = async () => {
    await navigator.clipboard.writeText(tempPassword);
    setPasswordCopied(true);
    setTimeout(() => setPasswordCopied(false), 2000);
  };

  const required = <span className="text-[#FE560D]">*</span>;

  // ── SUCCESS SCREEN ────────────────────────────────────────
  if (isSuccess) {
    return (
      <div className={cn('flex min-h-screen flex-col', SURFACE.canvas)}>
        <MobileHeader title={t('newAdmin', { defaultValue: 'Nouvel admin' })} />

        <div className="flex-1 overflow-y-auto px-4 py-8">
          {/* Success icon */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center">
              <Holder icon={Check} tone="success" size="lg" />
            </div>
            <div className={cn('text-[20px] font-extrabold', TEXT.strong)}>
              {t('adminCreatedSuccess', { defaultValue: 'Admin créé avec succès' })}
            </div>
            <div className={cn('mt-1 text-[14px]', TEXT.muted)}>
              {firstName} {lastName} peut maintenant se connecter
            </div>
          </div>

          {/* Temporary password */}
          <Card className="mb-4 p-4">
            <div className={cn('mb-2 text-[13px]', TEXT.muted)}>
              {t('temporaryPassword', { defaultValue: 'Mot de passe temporaire' })}
            </div>
            <div className={cn('flex items-center justify-between gap-3 rounded-2xl p-3.5', SURFACE.canvas)}>
              <code className={cn('text-[18px] font-bold tracking-wide', TEXT.strong)}>
                {tempPassword}
              </code>
              <Holder
                icon={passwordCopied ? Check : Copy}
                tone={passwordCopied ? 'success' : 'neutral'}
                size="sm"
                onClick={handleCopyPassword}
              />
            </div>
            <div className="mt-3 rounded-2xl bg-[#F8EFD8] px-3 py-2.5 text-[12px] leading-relaxed text-[#9A6B12] dark:bg-[#372D14] dark:text-[#E7C083]">
              Ce mot de passe ne sera plus affiché. Transmettez-le de manière sécurisée à l'administrateur.
            </div>
          </Card>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <PrimaryPill onClick={() => navigate(`/m/more/admins/${createdUserId}`)} className="w-full">
              {t('viewAdminProfile', { defaultValue: 'Voir le profil admin' })}
            </PrimaryPill>
            <SoftPill onClick={() => navigate('/m/more/admins')} className="w-full">
              {t('backToList', { defaultValue: 'Retour à la liste' })}
            </SoftPill>
          </div>
        </div>
      </div>
    );
  }

  // ── 3-STEP FORM ───────────────────────────────────────────
  return (
    <div className={cn('flex h-[100dvh] flex-col overflow-hidden', SURFACE.canvas)}>
      {/* HEADER — fixed, does not scroll */}
      <div className={cn('shrink-0 px-4 pt-[env(safe-area-inset-top)]', SURFACE.card, SURFACE.shadow)}>
        <div className="flex h-14 items-center">
          <button
            onClick={() => navigate('/m/more/admins')}
            className={cn('-ml-2 mr-2 flex h-10 w-10 items-center justify-center rounded-full text-[26px] font-light active:bg-black/5 dark:active:bg-white/5', TEXT.muted)}
            aria-label={t('back', { defaultValue: 'Retour' })}
          >
            ‹
          </button>
          <span className={cn('text-[15px] font-bold', TEXT.strong)}>
            {t('newAdmin', { defaultValue: 'Nouvel admin' })}
          </span>
        </div>

        {/* Progress bar — 3 segments */}
        <div className="flex gap-1.5 pb-3">
          {STEPS.map((s) => (
            <div key={s.key} className="flex-1">
              <div
                className={cn(
                  'h-[3px] rounded-full transition-colors',
                  currentStepNum >= s.num ? 'bg-[#6B5BD2] dark:bg-[#A99BF0]' : 'bg-black/10 dark:bg-white/10',
                )}
              />
              <div
                className={cn(
                  'mt-1.5 text-center text-[10px]',
                  currentStepNum === s.num
                    ? 'font-extrabold text-[#6B5BD2] dark:text-[#A99BF0]'
                    : cn('font-medium', TEXT.muted),
                )}
              >
                {s.num}. {t(s.labelKey, { defaultValue: s.labelDefault })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CONTENT — scrollable between header and footer */}
      <div className="flex-1 overflow-y-auto px-4 pt-5" style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* Step 1: Personal Info */}
        {step === 'personal' && (
          <div className="space-y-5">
            <div>
              <div className={cn('text-[24px] font-extrabold', TEXT.strong)}>
                {t('personalInfo', { defaultValue: 'Informations personnelles' })}
              </div>
              <div className={cn('mt-1 text-[14px]', TEXT.muted)}>
                {t('enterNewAdminInfo', { defaultValue: 'Entrez les informations de base du nouvel administrateur' })}
              </div>
            </div>

            <FormField label={<>{t('firstName', { defaultValue: 'Prénom' })} {required}</>} htmlFor="ca-firstName">
              <TextInput
                id="ca-firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jean"
                autoComplete="given-name"
                enterKeyHint="next"
              />
            </FormField>

            <FormField label={<>{t('lastName', { defaultValue: 'Nom' })} {required}</>} htmlFor="ca-lastName">
              <TextInput
                id="ca-lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Dupont"
                autoComplete="family-name"
                enterKeyHint="next"
              />
            </FormField>

            <FormField label={<>Email {required}</>} htmlFor="ca-email">
              <TextInput
                id="ca-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jean.dupont@bonzini.com"
                autoComplete="email"
                enterKeyHint="done"
              />
            </FormField>
          </div>
        )}

        {/* Step 2: Role Selection */}
        {step === 'role' && (
          <div className="space-y-5">
            <div>
              <div className={cn('text-[24px] font-extrabold', TEXT.strong)}>
                {t('roleSelection', { defaultValue: 'Sélection du rôle' })}
              </div>
              <div className={cn('mt-1 text-[14px]', TEXT.muted)}>
                {t('chooseRoleForAdmin', { defaultValue: 'Choisissez le rôle à attribuer à cet administrateur' })}
              </div>
            </div>

            <div className="space-y-3">
              {MANAGEABLE_ROLES.map((item) => {
                const active = selectedRole === item.role;
                return (
                  <button
                    key={item.role}
                    onClick={() => setSelectedRole(item.role)}
                    className={cn(
                      'w-full rounded-[22px] p-4 text-left transition active:scale-[0.99]',
                      SURFACE.card,
                      SURFACE.shadow,
                      active && 'ring-2 ring-[#6B5BD2] dark:ring-[#A99BF0]',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Holder icon={Shield} tone={roleMeta(item.role).tone} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className={cn('text-[15px] font-semibold', TEXT.strong)}>{ADMIN_ROLE_LABELS[item.role]}</p>
                          {active && <Check className="h-4 w-4 text-[#6B5BD2] dark:text-[#A99BF0]" />}
                        </div>
                        <p className={cn('mt-0.5 text-[13px]', TEXT.muted)}>
                          {t(item.descriptionKey, { defaultValue: item.descriptionDefault })}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 'confirm' && (
          <div className="space-y-3">
            <div>
              <div className={cn('text-[24px] font-extrabold', TEXT.strong)}>
                {t('confirmation', { defaultValue: 'Confirmation' })}
              </div>
              <div className={cn('mt-1 text-[14px]', TEXT.muted)}>
                {t('verifyBeforeCreating', { defaultValue: "Vérifiez les informations avant de créer l'administrateur" })}
              </div>
            </div>

            <Card className="p-4">
              {/* Avatar + name */}
              <div className="mb-4 flex items-center gap-3">
                <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[15px] font-bold', SURFACE.holder)}>
                  {(firstName[0] ?? '').toUpperCase()}{(lastName[0] ?? '').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className={cn('truncate text-[17px] font-bold', TEXT.strong)}>
                    {firstName} {lastName}
                  </div>
                  <StatusPill
                    tone={roleMeta(selectedRole).tone}
                    label={ADMIN_ROLE_LABELS[selectedRole]}
                  />
                </div>
              </div>

              <Row label={t('fullName', { defaultValue: 'Nom complet' })} value={`${firstName} ${lastName}`} />
              <Row label="Email" value={email} />
              <Row label={t('role', { defaultValue: 'Rôle' })} value={ADMIN_ROLE_LABELS[selectedRole]} />
            </Card>

            <div className="rounded-2xl bg-[#F8EFD8] px-3.5 py-3 text-[12px] leading-relaxed text-[#9A6B12] dark:bg-[#372D14] dark:text-[#E7C083]">
              Un mot de passe temporaire sera généré. Vous devrez le transmettre manuellement à l'administrateur.
            </div>
          </div>
        )}
      </div>

      {/* FOOTER — CTAs always visible */}
      <div className={cn('flex shrink-0 gap-2.5 px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3', SURFACE.card, SURFACE.shadow)}>
        {step !== 'personal' && (
          <SoftPill onClick={handleBack} className="flex-1">
            {t('back', { defaultValue: 'Retour' })}
          </SoftPill>
        )}

        <PrimaryPill
          onClick={step === 'confirm' ? handleSubmit : handleNext}
          disabled={!canNext}
          loading={createAdminMutation.isPending}
          className={step === 'personal' ? 'flex-1' : 'flex-[1.5]'}
        >
          {step === 'confirm'
            ? t('createAdmin', { defaultValue: "Créer l'admin" })
            : `${t('continue', { defaultValue: 'Continuer' })} (${currentStepNum}/3)`}
        </PrimaryPill>
      </div>
    </div>
  );
}
