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

        {/* Input */}
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder=" "
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          disabled={disabled}
          onKeyDown={onKeyDown}
          className={cn(
            'premium-input',
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
