/**
 * Shared infrastructure for every mobile-safe form primitive.
 *
 * Core rule: the inner form control ALWAYS uses `text-base md:text-sm`
 * so iOS Safari never zooms on focus (< 16px triggers the zoom).
 * This single guarantee is the reason this primitive layer exists.
 */

import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

// ────────────────────────────────────────────────────────────────────────────
// Base control class — shared by input, textarea, select trigger
// ────────────────────────────────────────────────────────────────────────────

export const fieldControlVariants = cva(
  [
    'flex w-full rounded-md border bg-background',
    // iOS zoom guard — the whole reason this layer exists.
    'text-base md:text-sm',
    'ring-offset-background',
    'placeholder:text-muted-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'transition-colors',
  ],
  {
    variants: {
      size: {
        // Apple HIG minimum touch target is 44px → h-11 on mobile, h-10 desktop for density
        sm: 'h-9 md:h-9 px-2.5',
        md: 'h-11 md:h-10 px-3',
        lg: 'h-12 md:h-11 px-4',
      },
      invalid: {
        true: 'border-destructive focus-visible:ring-destructive',
        false: 'border-input focus-visible:ring-ring',
      },
      withLeftAdornment: { true: 'pl-10', false: '' },
      withRightAdornment: { true: 'pr-10', false: '' },
    },
    defaultVariants: {
      size: 'md',
      invalid: false,
      withLeftAdornment: false,
      withRightAdornment: false,
    },
  },
);

export type FieldControlVariants = VariantProps<typeof fieldControlVariants>;
export type FieldSize = NonNullable<FieldControlVariants['size']>;

// ────────────────────────────────────────────────────────────────────────────
// Common props shared by every field primitive
// ────────────────────────────────────────────────────────────────────────────

export interface BaseFieldProps {
  label?: React.ReactNode;
  /** Helper text shown under the field when there is no error. */
  hint?: React.ReactNode;
  /** Error message. When truthy, replaces the hint and sets aria-invalid. */
  error?: React.ReactNode | boolean;
  required?: boolean;
  size?: FieldSize;
  /** Visual adornments inside the control. Use for icons or short text. */
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** Visually separated pre/post-fix (e.g. "+237" before a phone, "XAF" after an amount). */
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
  /** Classes for the outermost wrapper. */
  wrapperClassName?: string;
  /** Classes for the label row. */
  labelClassName?: string;
  /** Classes for the inner control (input/textarea/trigger). */
  controlClassName?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Tokens — keyboard hints, inputModes, autocomplete patterns
// ────────────────────────────────────────────────────────────────────────────

export const KEYBOARD = {
  text: { inputMode: 'text' as const, autoCapitalize: 'sentences' as const, spellCheck: true },
  name: { inputMode: 'text' as const, autoCapitalize: 'words' as const, spellCheck: false },
  email: { inputMode: 'email' as const, autoCapitalize: 'none' as const, autoCorrect: 'off' as const, spellCheck: false },
  tel: { inputMode: 'tel' as const, autoCapitalize: 'none' as const, spellCheck: false },
  url: { inputMode: 'url' as const, autoCapitalize: 'none' as const, autoCorrect: 'off' as const, spellCheck: false },
  numeric: { inputMode: 'numeric' as const, autoCapitalize: 'none' as const, spellCheck: false },
  decimal: { inputMode: 'decimal' as const, autoCapitalize: 'none' as const, spellCheck: false },
  search: { inputMode: 'search' as const, autoCapitalize: 'none' as const, autoCorrect: 'off' as const, spellCheck: false },
  password: { inputMode: 'text' as const, autoCapitalize: 'none' as const, autoCorrect: 'off' as const, spellCheck: false },
  otp: { inputMode: 'numeric' as const, autoCapitalize: 'none' as const, spellCheck: false },
} as const;
