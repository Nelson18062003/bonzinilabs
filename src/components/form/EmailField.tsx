import * as React from 'react';
import { Mail } from 'lucide-react';
import { TextField, type TextFieldProps } from './TextField';

export type EmailFieldProps = Omit<TextFieldProps, 'type' | 'variant' | 'autoComplete'> & {
  autoComplete?: 'email' | 'username' | 'off';
  showIcon?: boolean;
};

/**
 * Email input with all the iOS / Android keyboard hints baked in.
 * Defaults: `type="email"`, `inputMode="email"`, `autoComplete="email"`,
 * `autoCapitalize="none"`, `autoCorrect="off"`, `spellCheck={false}`.
 */
export const EmailField = React.forwardRef<HTMLInputElement, EmailFieldProps>(function EmailField(
  { autoComplete = 'email', showIcon = true, leftIcon, placeholder, enterKeyHint = 'next', ...rest },
  ref,
) {
  return (
    <TextField
      ref={ref}
      type="email"
      variant="url" // reuses autoCapitalize=none / autoCorrect=off from shared.ts
      autoComplete={autoComplete}
      enterKeyHint={enterKeyHint}
      leftIcon={leftIcon ?? (showIcon ? <Mail className="h-4 w-4" /> : undefined)}
      placeholder={placeholder ?? 'vous@exemple.com'}
      {...rest}
    />
  );
});
