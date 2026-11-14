import { Check, ChevronDown } from 'lucide-react';
import { useRef } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { Select } from './select.tsx';

export type SelectOption<Value extends string> = Pick<ComponentProps<typeof Select.Item>, 'disabled'> & {
  readonly value: Value;
  readonly label: string;
};

type SelectValueChange<Value extends string> = NonNullable<ComponentProps<typeof Select.Root<Value>>['onValueChange']>;

type SelectControlValueProps<Value extends string> = { readonly value: Value | null } & (
  | { readonly readOnly?: false; readonly onValueChange: SelectValueChange<Value> }
  | { readonly readOnly: true; readonly onValueChange?: never }
);

type SelectFormProps<Value extends string> = Pick<
  ComponentProps<typeof Select.Root<Value>>,
  'name' | 'form' | 'required' | 'autoComplete' | 'inputRef'
>;

type SelectControlTriggerProps = Omit<
  ComponentProps<typeof Select.Trigger>,
  | 'children'
  | 'render'
  | 'nativeButton'
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
  name,
  form,
  required,
  autoComplete,
  inputRef,
  disabled,
  id,
  onKeyDown,
  ...triggerProps
}: SelectControlProps<Value>): ReactNode {
  const typeaheadEvent = useRef<KeyboardEvent | null>(null);

  const changeValue: SelectValueChange<Value> = (nextValue, details) => {
    // Base UI uses the same synthetic event for typeahead and removed-option reconciliation.
    // Only the active key dispatch makes that synthetic change a user selection.
    const isSyntheticChange = details.reason === 'none' && details.event.type === 'base-ui';
    const isReconciliation = isSyntheticChange && typeaheadEvent.current === null;

    const isAvailableValue =
      nextValue === null || items.some((item) => item.value === nextValue && item.disabled !== true);

    if (isReconciliation || !isAvailableValue) {
      details.cancel();

      return;
    }

    if (isSyntheticChange) {
      typeaheadEvent.current = null;
    }

    onValueChange?.(nextValue, details);
  };

  const valueProps: SelectControlValueProps<Value> =
    readOnly === true ? { value, readOnly: true } : { value, onValueChange: changeValue };

  return (
    <Select.Root<Value>
      {...valueProps}
      items={items}
      name={name}
      form={form}
      required={required}
      autoComplete={autoComplete}
      inputRef={inputRef}
      disabled={disabled}
      id={id}
    >
      <Select.Trigger
        {...triggerProps}
        id={id}
        aria-label={label}
        disabled={disabled}
        onKeyDown={(event) => {
          onKeyDown?.(event);

          const hasCommandModifier = event.ctrlKey || event.metaKey || event.altKey;
          const canTypeahead = !event.defaultPrevented && event.key.length === 1 && !hasCommandModifier;

          if (!canTypeahead) {
            return;
          }

          const nativeEvent = event.nativeEvent;
          typeaheadEvent.current = nativeEvent;

          queueMicrotask(() => {
            if (typeaheadEvent.current === nativeEvent) {
              typeaheadEvent.current = null;
            }
          });
        }}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon>
          <ChevronDown size={16} aria-hidden />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner align={align}>
          <Select.Popup>
            <Select.List>
              {items.map((item) => (
                <Select.Item key={item.value} value={item.value} disabled={item.disabled}>
                  <Select.ItemText>{item.label}</Select.ItemText>
                  <Select.ItemIndicator>
                    <Check size={16} aria-hidden />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
