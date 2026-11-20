import type { SelectProps } from '@ui-sdk/react/select';
import { Check, ChevronDown } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Select } from './select.tsx';
import type { SingleSelectionOf } from './selection-state.ts';

export type SelectOption<Value extends string> = Pick<ComponentProps<typeof Select.Item>, 'disabled'> & {
  readonly value: Value;
  readonly label: string;
};

type SelectValueChange<Value extends string> = NonNullable<SingleSelectionOf<SelectProps<Value>>['onValueChange']>;

type SelectControlValueProps<Value extends string> = { readonly value: Value | null } & (
  | { readonly readOnly?: false; readonly onValueChange: SelectValueChange<Value> }
  | { readonly readOnly: true; readonly onValueChange?: never }
);

type SelectFormProps<Value extends string> = Pick<SelectProps<Value>, 'name' | 'form' | 'required' | 'autoComplete'>;

type SelectControlTriggerProps = Omit<
  ComponentProps<typeof Select.Trigger>,
  | 'children'
  | 'render'
  | 'type'
  | 'value'
  | 'defaultValue'
  | 'name'
  | 'form'
  | 'autoComplete'
  | 'required'
  | 'readOnly'
  | 'aria-label'
  | 'className'
  | 'style'
>;

export type SelectControlProps<Value extends string> = SelectControlValueProps<Value> &
  SelectFormProps<Value> &
  SelectControlTriggerProps & {
    readonly label: string;
    readonly items: ReadonlyArray<SelectOption<Value>>;
    readonly placeholder?: string;
    readonly align?: 'start' | 'end';
  };

export function SelectControl<Value extends string>({
  label,
  items,
  placeholder,
  align = 'start',
  value,
  readOnly,
  onValueChange,
  disabled,
  id,
  name,
  form,
  required,
  autoComplete,
  ...triggerProps
}: SelectControlProps<Value>): ReactNode {
  const changeValue: SelectValueChange<Value> = (nextValue, details) => {
    const isAvailableValue =
      nextValue === null || items.some((item) => item.value === nextValue && item.disabled !== true);

    if (!isAvailableValue) {
      details.cancel();

      return;
    }

    onValueChange?.(nextValue, details);
  };

  const valueProps: SelectControlValueProps<Value> =
    readOnly === true ? { value, readOnly: true } : { value, onValueChange: changeValue };

  return (
    <Select.Root<Value>
      {...valueProps}
      items={[...items]}
      {...(name !== undefined && { name })}
      {...(form !== undefined && { form })}
      required={required ?? false}
      {...(autoComplete !== undefined && { autoComplete })}
      disabled={disabled ?? false}
    >
      <Select.Trigger {...triggerProps} id={id} aria-label={label} disabled={disabled ?? false}>
        <Select.Value placeholder={placeholder ?? ''} />
        <Select.Icon>
          <ChevronDown size={16} aria-hidden />
        </Select.Icon>
      </Select.Trigger>
      <Select.Popup align={align}>
        <Select.List>
          {items.map((item) => (
            <Select.Item key={item.value} value={item.value} disabled={item.disabled ?? false}>
              <Select.ItemText>{item.label}</Select.ItemText>
              <Select.ItemIndicator>
                <Check size={16} aria-hidden />
              </Select.ItemIndicator>
            </Select.Item>
          ))}
        </Select.List>
      </Select.Popup>
    </Select.Root>
  );
}
