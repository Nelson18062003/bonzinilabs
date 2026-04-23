import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BaseFieldProps,
  fieldControlVariants,
  type FieldSize,
} from './shared';
import { FormFieldWrapper } from './FormFieldWrapper';

export interface SelectOption<V extends string = string> {
  value: V;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SelectFieldProps<V extends string = string>
  extends Omit<BaseFieldProps, 'leftAddon' | 'rightAddon' | 'leftIcon' | 'rightIcon'> {
  value?: V;
  defaultValue?: V;
  onValueChange?: (value: V) => void;
  options: SelectOption<V>[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
}

/**
 * Select built on Radix. The trigger carries `text-base md:text-sm`
 * so the blank-focus behaviour never triggers iOS zoom.
 *
 * For react-hook-form, use `Controller` and pass `value`/`onValueChange`:
 *
 *   <Controller
 *     control={form.control}
 *     name="method"
 *     render={({ field }) => (
 *       <SelectField label="Méthode" options={…} {...field} />
 *     )}
 *   />
 */
export function SelectField<V extends string = string>({
  label,
  hint,
  error,
  required,
  size = 'md',
  wrapperClassName,
  labelClassName,
  controlClassName,
  id: idProp,
  name,
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder = 'Sélectionner…',
  disabled,
}: SelectFieldProps<V>) {
  const reactId = React.useId();
  const id = idProp ?? reactId;
  const hasError = Boolean(error);

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
      <SelectPrimitive.Root
        value={value}
        defaultValue={defaultValue}
        onValueChange={(v) => onValueChange?.(v as V)}
        disabled={disabled}
        name={name}
      >
        <SelectPrimitive.Trigger
          className={cn(
            fieldControlVariants({
              size: size as FieldSize,
              invalid: hasError,
            }),
            'items-center justify-between [&>span]:line-clamp-1 [&>span]:text-left',
            controlClassName,
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={4}
            className={cn(
              'relative z-50 max-h-[min(24rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md',
              'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            )}
          >
            <SelectPrimitive.Viewport className="p-1">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className={cn(
                    'relative flex w-full cursor-default select-none items-center rounded-sm py-2 pl-8 pr-2',
                    // Menu items follow the zoom guard too — iOS can zoom when a select item
                    // carries a tiny font, same rule.
                    'text-base md:text-sm',
                    'outline-none focus:bg-accent focus:text-accent-foreground',
                    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                  )}
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <SelectPrimitive.ItemIndicator>
                      <Check className="h-4 w-4" />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </FormFieldWrapper>
  );
}
