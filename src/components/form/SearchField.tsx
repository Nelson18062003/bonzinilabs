import * as React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BaseFieldProps,
  KEYBOARD,
  fieldControlVariants,
} from './shared';
import { FormFieldWrapper } from './FormFieldWrapper';
import { LeftIcon } from './Adornments';

type NativeInputProps = Omit<React.ComponentPropsWithoutRef<'input'>, 'size' | 'type'>;

export interface SearchFieldProps extends BaseFieldProps, NativeInputProps {
  /** Fired when the user taps the clear × button. */
  onClear?: () => void;
  /** Default true — show the × button while the field has a value. */
  clearable?: boolean;
}

/**
 * Search input. Uses `type="search"` so mobile keyboards render a proper
 * search key + enterKeyHint="search". Includes built-in clear button.
 */
export const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
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
    value,
    onChange,
    onClear,
    clearable = true,
    placeholder = 'Rechercher…',
    enterKeyHint = 'search',
    ...rest
  },
  ref,
) {
  const reactId = React.useId();
  const id = idProp ?? reactId;
  const hasError = Boolean(error);
  const keyboard = KEYBOARD.search;
  const showClear = clearable && typeof value === 'string' && value.length > 0;
  const iconNode = leftIcon ?? <Search className="h-4 w-4" />;

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
        <LeftIcon>{iconNode}</LeftIcon>
        <input
          ref={ref}
          type="search"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          enterKeyHint={enterKeyHint}
          inputMode={keyboard.inputMode}
          autoCapitalize={keyboard.autoCapitalize}
          autoCorrect={keyboard.autoCorrect}
          spellCheck={keyboard.spellCheck}
          className={cn(
            fieldControlVariants({
              size,
              invalid: hasError,
              withLeftAdornment: true,
              withRightAdornment: showClear,
            }),
            controlClassName,
          )}
          {...rest}
        />
        {showClear ? (
          <button
            type="button"
            onClick={onClear}
            aria-label="Effacer"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </FormFieldWrapper>
  );
});
