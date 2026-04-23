import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface PremiumInputProps {
  id: string;
  type?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
  error?: string;
  isValid?: boolean;
  autoComplete?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** Mobile keyboard hints — forwarded to <input>. */
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  enterKeyHint?: React.InputHTMLAttributes<HTMLInputElement>['enterKeyHint'];
  autoCapitalize?: React.InputHTMLAttributes<HTMLInputElement>['autoCapitalize'];
  autoCorrect?: 'on' | 'off';
  spellCheck?: boolean;
  name?: string;
  required?: boolean;
}

export function PremiumInput({
  id,
  type = 'text',
  label,
  value,
  onChange,
  icon,
  rightElement,
  error,
  isValid,
  autoComplete,
  autoFocus,
  disabled,
  onKeyDown,
  inputMode,
  enterKeyHint,
  autoCapitalize,
  autoCorrect,
  spellCheck,
  name,
  required,
}: PremiumInputProps) {
  // Shake re-trigger: increment key on each new error to force remount
  const [shakeKey, setShakeKey] = useState(0);

  useEffect(() => {
    if (error) {
      setShakeKey((k) => k + 1);
    }
  }, [error]);

  const hasLeftIcon = !!icon;
  const hasRightElement = !!rightElement;
  const showValidCheck = isValid && !hasRightElement && !error;

  // Sensible mobile keyboard defaults based on `type`. Consumers can override
  // via explicit props. Keeps every auth/login consumer correct for free.
  const typeDefaults = (() => {
    switch (type) {
      case 'email':
        return { inputMode: 'email' as const, autoCapitalize: 'none' as const, autoCorrect: 'off' as const, spellCheck: false };
      case 'password':
        return { inputMode: 'text' as const, autoCapitalize: 'none' as const, autoCorrect: 'off' as const, spellCheck: false };
      case 'tel':
        return { inputMode: 'tel' as const, autoCapitalize: 'none' as const, autoCorrect: 'off' as const, spellCheck: false };
      case 'url':
        return { inputMode: 'url' as const, autoCapitalize: 'none' as const, autoCorrect: 'off' as const, spellCheck: false };
      default:
        return {};
    }
  })();
  const resolvedInputMode = inputMode ?? typeDefaults.inputMode;
  const resolvedAutoCapitalize = autoCapitalize ?? typeDefaults.autoCapitalize;
  const resolvedAutoCorrect = autoCorrect ?? typeDefaults.autoCorrect;
  const resolvedSpellCheck = spellCheck ?? typeDefaults.spellCheck;

  return (
    <div>
      <div
        key={shakeKey}
        className={cn('premium-input-wrapper', error && 'animate-shake')}
      >
        {/* Left icon */}
        {hasLeftIcon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors duration-200 z-10 pointer-events-none">
            {icon}
          </div>
        )}

        {/* Input — `.premium-input` CSS class handles typography.
            `text-base` kept as belt-and-suspenders against future
            html/body font-size changes that could drop below 16px
            and re-introduce the iOS zoom-on-focus bug. */}
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder=" "
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          disabled={disabled}
          required={required}
          onKeyDown={onKeyDown}
          inputMode={resolvedInputMode}
          enterKeyHint={enterKeyHint}
          autoCapitalize={resolvedAutoCapitalize}
          autoCorrect={resolvedAutoCorrect}
          spellCheck={resolvedSpellCheck}
          className={cn(
            'premium-input text-base',
            hasLeftIcon && 'premium-input-has-left-icon',
            (hasRightElement || showValidCheck) && 'premium-input-has-right',
            error && 'premium-input-error'
          )}
        />

        {/* Floating label */}
        <label
          htmlFor={id}
          className={cn(
            'premium-input-label',
            hasLeftIcon && 'left-12'
          )}
        >
          {label}
        </label>

        {/* Right element (e.g., eye toggle) */}
        {hasRightElement && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
            {rightElement}
          </div>
        )}

        {/* Validation checkmark */}
        {showValidCheck && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 animate-scale-in">
            <Check className="w-5 h-5 text-green-500" />
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-destructive text-xs mt-1.5 ml-1 animate-fade-in">
          {error}
        </p>
      )}
    </div>
  );
}
