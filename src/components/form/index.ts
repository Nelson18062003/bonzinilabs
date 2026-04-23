/**
 * Mobile-safe form primitives.
 *
 * Every control here is guaranteed to use `text-base md:text-sm`
 * internally so iOS Safari never triggers its "< 16px" auto-zoom
 * on focus — and therefore never breaks your layout.
 *
 * Prefer these primitives over `<input>`, `<textarea>`, or the
 * generic `<Input />` from `components/ui` for any new screen.
 */

export { TextField } from './TextField';
export type { TextFieldProps } from './TextField';

export { TextArea } from './TextArea';
export type { TextAreaProps } from './TextArea';

export { EmailField } from './EmailField';
export type { EmailFieldProps } from './EmailField';

export { PasswordField } from './PasswordField';
export type { PasswordFieldProps } from './PasswordField';

export { SearchField } from './SearchField';
export type { SearchFieldProps } from './SearchField';

export { NumberField } from './NumberField';
export type { NumberFieldProps } from './NumberField';

export { AmountField } from './AmountField';
export type { AmountFieldProps } from './AmountField';

export { PhoneField } from './PhoneField';
export type { PhoneFieldProps } from './PhoneField';

export { OtpField } from './OtpField';
export type { OtpFieldProps } from './OtpField';

export { SelectField } from './SelectField';
export type { SelectFieldProps, SelectOption } from './SelectField';

export { DateField } from './DateField';
export type { DateFieldProps } from './DateField';

export { FormFieldWrapper } from './FormFieldWrapper';
export type { FormFieldWrapperProps } from './FormFieldWrapper';

export { LeftAddon, RightAddon, LeftIcon, RightIcon } from './Adornments';

export { KeyboardSafeArea } from './KeyboardSafeArea';
export type { KeyboardSafeAreaProps } from './KeyboardSafeArea';

export { KeyboardFocusManager } from './KeyboardFocusManager';

export type { FieldSize, BaseFieldProps } from './shared';
