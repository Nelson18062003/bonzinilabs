import * as React from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BaseFieldProps,
  KEYBOARD,
  fieldControlVariants,
} from './shared';
import { FormFieldWrapper } from './FormFieldWrapper';
import { LeftIcon } from './Adornments';

type NativeInputProps = Omit<React.ComponentPropsWithoutRef<'input'>, 'size' | 'type'>;

export interface PasswordFieldProps extends BaseFieldProps, NativeInputProps {
  /**
   * `new-password` enables strong password suggestions on iOS,
   * `current-password` enables autofill on sign-in forms,
   * `one-time-code` for SMS OTPs (prefer OtpField though).
   */
  autoComplete?: 'new-password' | 'current-password' | 'off';
  /** Default true — shows eye toggle for visibility. */
  showToggle?: boolean;
  showIcon?: boolean;
}

export const PasswordField = React.forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(
    {
      label,
      hint,
      error,
      required,
      size = 'md',
      leftIcon,
      wrapperClassName,
      labelClassName,
      controlClassName,
      className,
      id: idProp,
      autoComplete = 'current-password',
      showToggle = true,
      showIcon = true,
      enterKeyHint = 'done',
      ...rest
    },
    ref,
  ) {
    const reactId = React.useId();
    const id = idProp ?? reactId;
    const [visible, setVisible] = React.useState(false);
    const hasError = Boolean(error);
    // Mêmes identifiants que ceux calculés par FormFieldWrapper.
    const describedBy =
      [hasError ? `${id}-error` : null, hint && !hasError ? `${id}-hint` : null]
        .filter(Boolean)
        .join(' ') || undefined;
    const keyboard = KEYBOARD.password;
    const leftAdornment = leftIcon ?? (showIcon ? <Lock className="h-4 w-4" /> : null);

    return (
      <FormFieldWrapper
        id={id}
        label={label}
        hint={hint}
        error={error}
        required={required}
        wrapperClassName={wrapperClassName}
        labelClassName={labelClassName}
      >
        <div className={cn('relative', className)}>
          {leftAdornment ? <LeftIcon>{leftAdornment}</LeftIcon> : null}
          <input
            ref={ref}
            // Posé ici et non par FormFieldWrapper : l'<input> est enveloppé
            // dans un div (icône + bouton œil), donc l'injection du wrapper
            // atterrirait sur le div et le <label for> serait orphelin.
            id={id}
            aria-describedby={describedBy}
            aria-invalid={hasError}
            aria-required={required}
            type={visible ? 'text' : 'password'}
            autoComplete={autoComplete}
            enterKeyHint={enterKeyHint}
            inputMode={keyboard.inputMode}
            autoCapitalize={keyboard.autoCapitalize}
            autoCorrect={keyboard.autoCorrect}
            spellCheck={keyboard.spellCheck}
            className={cn(
              fieldControlVariants({
                size,
                invalid: hasError,
                withLeftAdornment: !!leftAdornment,
                withRightAdornment: showToggle,
              }),
              controlClassName,
            )}
            {...rest}
          />
          {showToggle ? (
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          ) : null}
        </div>
      </FormFieldWrapper>
    );
  },
);
