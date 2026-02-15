import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useCreateClient } from '@/hooks/useClientManagement';
import { cn } from '@/lib/utils';
import {
  Loader2,
  ChevronRight,
  ChevronLeft,
  Check,
  User,
  Phone,
  Mail,
  MapPin,
  Copy,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ClientGender } from '@/types/admin';

type Step = 'identity' | 'contact' | 'confirm' | 'success';

const GENDER_OPTIONS: { value: ClientGender; label: string }[] = [
  { value: 'MALE', label: 'Homme' },
  { value: 'FEMALE', label: 'Femme' },
  { value: 'OTHER', label: 'Autre' },
];

const COUNTRIES = [
  'Cameroun',
  'Côte d\'Ivoire',
  'Sénégal',
  'Mali',
  'Burkina Faso',
  'Bénin',
  'Togo',
  'Gabon',
  'Congo',
  'RDC',
  'Guinée',
  'Niger',
  'Tchad',
  'Autre',
];

export function MobileCreateClient() {
  const navigate = useNavigate();
  const createClientMutation = useCreateClient();

  // Form state
  const [step, setStep] = useState<Step>('identity');

  // Identity step
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [gender, setGender] = useState<ClientGender>('MALE');

  // Contact step
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('Cameroun');
  const [city, setCity] = useState('');

  // Success state
  const [tempPassword, setTempPassword] = useState('');
  const [createdClientId, setCreatedClientId] = useState('');
  const [passwordCopied, setPasswordCopied] = useState(false);

  // Validation
  const isIdentityValid = firstName.trim() && lastName.trim() && gender;
  const isContactValid = whatsappNumber.trim() && country;

  // Progress percentage
  const getProgress = () => {
    const steps: Step[] = ['identity', 'contact', 'confirm', 'success'];
    const index = steps.indexOf(step);
    return ((index + 1) / steps.length) * 100;
  };

  const handleNext = () => {
    if (step === 'identity' && isIdentityValid) {
      setStep('contact');
    } else if (step === 'contact' && isContactValid) {
      setStep('confirm');
    }
  };

  const handleBack = () => {
    if (step === 'contact') setStep('identity');
    else if (step === 'confirm') setStep('contact');
  };

  const handleSubmit = async () => {
    try {
      const result = await createClientMutation.mutateAsync({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        company: company.trim() || undefined,
        gender,
        whatsappNumber: whatsappNumber.trim(),
        email: email.trim() || undefined,
        country,
        city: city.trim() || undefined,
      });

      if (result.tempPassword) {
        setTempPassword(result.tempPassword);
        setCreatedClientId(result.clientId || '');
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
        title="Nouveau client"
        showBack
        backTo="/m/clients"
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

      <div className="flex-1 px-4 py-6">
        {/* Step 1: Identity */}
        {step === 'identity' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Identité</h2>
              <p className="text-muted-foreground mt-1">
                Informations personnelles du client
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="firstName">Prénom *</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jean"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="lastName">Nom *</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Dupont"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="company">Société (optionnel)</Label>
                <Input
                  id="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Ma Société SARL"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label>Genre *</Label>
                <div className="flex gap-2 mt-1.5">
                  {GENDER_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setGender(option.value)}
                      className={cn(
                        'flex-1 py-2.5 rounded-lg border-2 font-medium transition-colors',
                        gender === option.value
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border bg-card text-foreground'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Contact */}
        {step === 'contact' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Contact</h2>
              <p className="text-muted-foreground mt-1">
                Coordonnées et localisation
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="whatsappNumber">Numéro WhatsApp *</Label>
                <Input
                  id="whatsappNumber"
                  type="tel"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="+237 6XX XXX XXX"
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Format international avec indicatif pays
                </p>
              </div>

              <div>
                <Label htmlFor="email">Email (optionnel)</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jean.dupont@email.com"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="country">Pays *</Label>
                <select
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full mt-1.5 h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="city">Ville (optionnel)</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Douala"
                  className="mt-1.5"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 'confirm' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Confirmation</h2>
              <p className="text-muted-foreground mt-1">
                Vérifiez les informations avant de créer le client
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
                  {company && (
                    <p className="text-sm text-muted-foreground">{company}</p>
                  )}
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Genre</p>
                    <p className="font-medium">
                      {gender === 'MALE' ? 'Homme' : gender === 'FEMALE' ? 'Femme' : 'Autre'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">WhatsApp</p>
                    <p className="font-medium">{whatsappNumber}</p>
                  </div>
                </div>

                {email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{email}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Localisation</p>
                    <p className="font-medium">
                      {city ? `${city}, ${country}` : country}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Un mot de passe temporaire sera généré. Vous devrez le transmettre
                au client de manière sécurisée.
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 'success' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-semibold">Client créé avec succès</h2>
              <p className="text-muted-foreground mt-1">
                {firstName} {lastName} peut maintenant se connecter
              </p>
            </div>

            <div className="bg-card rounded-xl border border-border p-4 space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Mot de passe temporaire
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

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Ce mot de passe ne sera plus affiché. Transmettez-le de
                  manière sécurisée au client via WhatsApp.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={() => navigate(`/m/clients/${createdClientId}`)}
              >
                Voir la fiche client
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/m/clients')}
              >
                Retour à la liste
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      {step !== 'success' && (
        <div className="sticky bottom-0 bg-background border-t border-border px-4 py-3">
          <div className="flex gap-3">
            {step !== 'identity' && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleBack}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
            )}

            {step === 'confirm' ? (
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={createClientMutation.isPending}
              >
                {createClientMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Création...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Créer le client
                  </>
                )}
              </Button>
            ) : (
              <Button
                className="flex-1"
                onClick={handleNext}
                disabled={
                  (step === 'identity' && !isIdentityValid) ||
                  (step === 'contact' && !isContactValid)
                }
              >
                Continuer
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
