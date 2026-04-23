import { useState, useEffect } from 'react';
import { PhoneField, TextField } from '@/components/form';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { User, Users } from 'lucide-react';
import { useMyProfile } from '@/hooks/useProfile';

interface CashBeneficiaryFormProps {
  onChange: (data: CashBeneficiaryData) => void;
}

export interface CashBeneficiaryData {
  type: 'self' | 'other';
  firstName: string;
  lastName: string;
  phone: string;
}

export function CashBeneficiaryForm({ onChange }: CashBeneficiaryFormProps) {
  const { data: profile } = useMyProfile();
  const [beneficiaryType, setBeneficiaryType] = useState<'self' | 'other'>('self');
  const [otherFirstName, setOtherFirstName] = useState('');
  const [otherLastName, setOtherLastName] = useState('');
  const [otherPhone, setOtherPhone] = useState('');

  useEffect(() => {
    if (beneficiaryType === 'self' && profile) {
      onChange({
        type: 'self',
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        phone: profile.phone || '',
      });
    } else if (beneficiaryType === 'other') {
      onChange({
        type: 'other',
        firstName: otherFirstName,
        lastName: otherLastName,
        phone: otherPhone,
      });
    }
  }, [beneficiaryType, profile, otherFirstName, otherLastName, otherPhone, onChange]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Qui va récupérer le cash ?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Cette personne devra présenter le QR Code au bureau Bonzini Guangzhou
        </p>
      </div>

      <RadioGroup
        value={beneficiaryType}
        onValueChange={(v) => setBeneficiaryType(v as 'self' | 'other')}
        className="space-y-3"
      >
        <div
          className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
            beneficiaryType === 'self' 
              ? 'border-primary bg-primary/5' 
              : 'border-border hover:border-primary/50'
          }`}
          onClick={() => setBeneficiaryType('self')}
        >
          <RadioGroupItem value="self" id="self" />
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <Label htmlFor="self" className="text-base font-medium cursor-pointer">
              Moi-même
            </Label>
            {profile && (
              <p className="text-sm text-muted-foreground">
                {profile.first_name} {profile.last_name}
              </p>
            )}
          </div>
        </div>

        <div
          className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
            beneficiaryType === 'other' 
              ? 'border-primary bg-primary/5' 
              : 'border-border hover:border-primary/50'
          }`}
          onClick={() => setBeneficiaryType('other')}
        >
          <RadioGroupItem value="other" id="other" />
          <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
            <Users className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <Label htmlFor="other" className="text-base font-medium cursor-pointer">
              Une autre personne
            </Label>
            <p className="text-sm text-muted-foreground">
              Indiquez les coordonnées du bénéficiaire
            </p>
          </div>
        </div>
      </RadioGroup>

      {beneficiaryType === 'other' && (
        <div className="space-y-4 animate-fade-in p-4 rounded-xl bg-muted/50">
          <div className="grid grid-cols-2 gap-4">
            <TextField
              id="other-first-name"
              label="Prénom *"
              variant="name"
              autoComplete="given-name"
              enterKeyHint="next"
              value={otherFirstName}
              onChange={(e) => setOtherFirstName(e.target.value)}
              placeholder="Prénom"
              required
            />
            <TextField
              id="other-last-name"
              label="Nom *"
              variant="name"
              autoComplete="family-name"
              enterKeyHint="next"
              value={otherLastName}
              onChange={(e) => setOtherLastName(e.target.value)}
              placeholder="Nom"
              required
            />
          </div>

          <PhoneField
            id="other-phone"
            label="Téléphone *"
            dialCode="+86"
            value={otherPhone}
            onChange={(e) => setOtherPhone(e.target.value)}
            placeholder="138 0000 0000"
            required
          />
        </div>
      )}
    </div>
  );
}
