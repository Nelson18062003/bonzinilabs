/**
 * Dev-only showcase for the form primitives. Mount at `/dev/form-showcase`
 * on a mobile device (or Chrome DevTools iOS emulation) to visually validate
 * that NO input triggers iOS auto-zoom on focus.
 *
 * Remove this file at the end of the migration (step 8).
 */

import * as React from 'react';
import {
  AmountField,
  DateField,
  EmailField,
  NumberField,
  OtpField,
  PasswordField,
  PhoneField,
  SearchField,
  SelectField,
  TextArea,
  TextField,
} from '@/components/form';

export function FormShowcase() {
  const [search, setSearch] = React.useState('');
  const [otp, setOtp] = React.useState('');
  const [amount, setAmount] = React.useState<number | null>(null);
  const [quantity, setQuantity] = React.useState<number | null>(null);
  const [method, setMethod] = React.useState<string>('alipay');
  const [textarea, setTextarea] = React.useState('');
  const [lastEvent, setLastEvent] = React.useState<string>('(aucun)');

  const computedFontSizes = useComputedFontSizes();

  return (
    <div className="mx-auto max-w-xl p-4 pb-24">
      <header className="mb-6">
        <h1 className="text-xl font-bold">Form primitives — Showcase</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ouvre cette page sur un vrai iPhone (Safari). Focus chaque champ :
          <strong> aucun ne doit déclencher de zoom.</strong>
        </p>
        <p className="mt-2 rounded-md bg-muted p-2 text-xs font-mono">
          font-size détectée sur les inputs : <strong>{computedFontSizes}px</strong>
          {' '}— doit être ≥ 16 sur mobile
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Dernier événement : <span className="font-mono">{lastEvent}</span>
        </p>
      </header>

      <section className="space-y-6">
        <Group title="Text">
          <TextField
            label="Nom complet"
            placeholder="Votre nom"
            variant="name"
            autoComplete="name"
            required
          />
          <TextField
            label="Référence"
            hint="Caractères alphanumériques uniquement"
            placeholder="BZ-XXXX"
          />
          <TextField
            label="Champ en erreur"
            error="Ce champ est requis"
            defaultValue="valeur invalide"
          />
        </Group>

        <Group title="Email / Password">
          <EmailField label="Email" required />
          <PasswordField label="Mot de passe" autoComplete="current-password" required />
          <PasswordField label="Nouveau mot de passe" autoComplete="new-password" />
        </Group>

        <Group title="Search">
          <SearchField
            label="Rechercher un client"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />
        </Group>

        <Group title="Numeric / Amount / Phone">
          <NumberField
            label="Quantité"
            value={quantity}
            onValueChange={setQuantity}
            min={0}
            max={100}
          />
          <AmountField
            label="Montant à payer"
            currency="XAF"
            value={amount}
            onValueChange={setAmount}
            hint="Maximum 50 000 000 XAF"
          />
          <AmountField
            label="Équivalent RMB"
            currency="RMB"
            value={amount != null ? Math.round(amount * 0.01167 * 100) / 100 : null}
            allowDecimal
            disabled
          />
          <PhoneField label="Téléphone" required />
        </Group>

        <Group title="OTP">
          <OtpField
            label="Code de vérification (6 chiffres)"
            length={6}
            value={otp}
            onValueChange={setOtp}
            onComplete={(v) => setLastEvent(`OTP complété : ${v}`)}
          />
        </Group>

        <Group title="Select / Date">
          <SelectField
            label="Méthode de paiement"
            value={method}
            onValueChange={setMethod}
            options={[
              { value: 'alipay', label: 'Alipay' },
              { value: 'wechat', label: 'WeChat Pay' },
              { value: 'bank_transfer', label: 'Virement bancaire' },
              { value: 'cash', label: 'Espèces' },
            ]}
          />
          <DateField label="Date souhaitée" dateType="date" />
        </Group>

        <Group title="TextArea">
          <TextArea
            label="Commentaire"
            value={textarea}
            onChange={(e) => setTextarea(e.target.value)}
            maxLength={500}
            showCounter
            rows={5}
            hint="Limité à 500 caractères"
          />
        </Group>
      </section>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-lg border p-4">
      <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

/**
 * Reports the actual computed font-size of the first rendered input,
 * so you can visually confirm the iOS-safe value at runtime.
 */
function useComputedFontSizes() {
  const [value, setValue] = React.useState<string>('…');
  React.useEffect(() => {
    const id = requestAnimationFrame(() => {
      const input = document.querySelector('input');
      if (input) {
        const cs = window.getComputedStyle(input);
        setValue(parseFloat(cs.fontSize).toString());
      }
    });
    return () => cancelAnimationFrame(id);
  }, []);
  return value;
}
