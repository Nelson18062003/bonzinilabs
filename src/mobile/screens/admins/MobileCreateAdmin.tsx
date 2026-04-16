import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Navigate } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useCreateAdmin } from '@/hooks/useAdminManagement';
import { ADMIN_ROLE_LABELS, type AppRole, useAdminAuth } from '@/contexts/AdminAuthContext';
import { cn } from '@/lib/utils';
import {
  Loader2,
  ChevronRight,
  ChevronLeft,
  Check,
  Mail,
  User,
  Shield,
  Copy,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Step = 'personal' | 'role' | 'confirm' | 'success';

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
];

const ROLE_BADGE_COLORS: Record<AppRole, string> = {
  super_admin: 'bg-purple-100 text-purple-700 border-purple-200',
  ops: 'bg-blue-100 text-blue-700 border-blue-200',
  support: 'bg-green-100 text-green-700 border-green-200',
  customer_success: 'bg-orange-100 text-orange-700 border-orange-200',
  cash_agent: 'bg-amber-100 text-amber-700 border-amber-200',
};

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

  if (!hasPermission('canManageUsers')) {
    return <Navigate to="/m" replace />;
  }

  // Validation
  const isPersonalValid = firstName.trim() && lastName.trim() && email.trim() && email.includes('@');
  const isRoleValid = !!selectedRole;

  // Progress percentage
  const getProgress = () => {
    const steps: Step[] = ['personal', 'role', 'confirm', 'success'];
    const index = steps.indexOf(step);
    return ((index + 1) / steps.length) * 100;
  };

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
        setStep('success');
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

  return (
    <div className="flex flex-col min-h-screen">
      <MobileHeader
        title={t('newAdmin', { defaultValue: 'Nouvel admin' })}
        showBack
        backTo="/m/more/admins"
      />

      {/* Progress Bar */}
      {step !== 'success' && (
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${getProgress()}%` }}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-6">
        {/* Step 1: Personal Info */}
        {step === 'personal' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">{t('personalInfo', { defaultValue: 'Informations personnelles' })}</h2>
              <p className="text-muted-foreground mt-1">
                {t('enterNewAdminInfo', { defaultValue: 'Entrez les informations de base du nouvel administrateur' })}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="firstName">{t('firstName', { defaultValue: 'Prénom' })} *</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jean"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="lastName">{t('lastName', { defaultValue: 'Nom' })} *</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Dupont"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jean.dupont@bonzini.com"
                  className="mt-1.5"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Role Selection */}
        {step === 'role' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">{t('roleSelection', { defaultValue: 'Sélection du rôle' })}</h2>
              <p className="text-muted-foreground mt-1">
                {t('chooseRoleForAdmin', { defaultValue: 'Choisissez le rôle à attribuer à cet administrateur' })}
              </p>
            </div>

            <div className="space-y-3">
              {MANAGEABLE_ROLES.map((item) => (
                <button
                  key={item.role}
                  onClick={() => setSelectedRole(item.role)}
                  className={cn(
                    'w-full p-4 rounded-xl border-2 text-left transition-all',
                    selectedRole === item.role
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                        ROLE_BADGE_COLORS[item.role]?.replace('text-', 'text-').replace('bg-', 'bg-')
                      )}
                    >
                      <Shield className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{ADMIN_ROLE_LABELS[item.role]}</p>
                        {selectedRole === item.role && (
                          <Check className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {t(item.descriptionKey, { defaultValue: item.descriptionDefault })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 'confirm' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">{t('confirmation', { defaultValue: 'Confirmation' })}</h2>
              <p className="text-muted-foreground mt-1">
                {t('verifyBeforeCreating', { defaultValue: "Vérifiez les informations avant de créer l'administrateur" })}
              </p>
            </div>

            <div className="bg-card rounded-xl border border-border p-4 space-y-4">
              {/* Avatar Preview */}
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-lg font-medium text-primary">
                  {firstName[0] || '?'}
                  {lastName[0] || ''}
                </div>
                <div>
                  <p className="font-semibold text-lg">
                    {firstName} {lastName}
                  </p>
                  <span
                    className={cn(
                      'inline-block px-2 py-0.5 rounded-full text-xs font-medium',
                      ROLE_BADGE_COLORS[selectedRole]
                    )}
                  >
                    {ADMIN_ROLE_LABELS[selectedRole]}
                  </span>
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">{t('fullName', { defaultValue: 'Nom complet' })}</p>
                    <p className="font-medium">{firstName} {lastName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">{t('role', { defaultValue: 'Rôle' })}</p>
                    <p className="font-medium">{ADMIN_ROLE_LABELS[selectedRole]}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                Un mot de passe temporaire sera généré. Vous devrez le transmettre
                manuellement à l'administrateur.
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 'success' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold">{t('adminCreatedSuccess', { defaultValue: 'Admin créé avec succès' })}</h2>
              <p className="text-muted-foreground mt-1">
                {firstName} {lastName} peut maintenant se connecter
              </p>
            </div>

            <div className="bg-card rounded-xl border border-border p-4 space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  {t('temporaryPassword', { defaultValue: 'Mot de passe temporaire' })}
                </p>
                <div className="bg-muted rounded-lg p-4 flex items-center justify-between">
                  <code className="text-lg font-mono">{tempPassword}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopyPassword}
                  >
                    {passwordCopied ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  Ce mot de passe ne sera plus affiché. Transmettez-le de
                  manière sécurisée à l'administrateur.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={() => navigate(`/m/more/admins/${createdUserId}`)}
              >
                {t('viewAdminProfile', { defaultValue: 'Voir le profil admin' })}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/m/more/admins')}
              >
                {t('backToList', { defaultValue: 'Retour à la liste' })}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      {step !== 'success' && (
        <div className="sticky bottom-0 bg-background border-t border-border px-4 py-3">
          <div className="flex gap-3">
            {step !== 'personal' && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleBack}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                {t('back', { defaultValue: 'Retour' })}
              </Button>
            )}

            {step === 'confirm' ? (
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={createAdminMutation.isPending}
              >
                {createAdminMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('creating', { defaultValue: 'Création...' })}
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    {t('createAdmin', { defaultValue: "Créer l'admin" })}
                  </>
                )}
              </Button>
            ) : (
              <Button
                className="flex-1"
                onClick={handleNext}
                disabled={
                  (step === 'personal' && !isPersonalValid) ||
                  (step === 'role' && !isRoleValid)
                }
              >
                {t('continue', { defaultValue: 'Continuer' })}
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
