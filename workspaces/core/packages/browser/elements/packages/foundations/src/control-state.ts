import type { Dialog } from '@base-ui/react/dialog';
import type { ComponentProps } from 'react';

export type OpenStateProperties<Change> =
  | {
      readonly open: NonNullable<Dialog.Root.Props['open']>;
      readonly defaultOpen?: never;
      readonly onOpenChange: Change;
    }
  | { readonly open?: never; readonly defaultOpen?: Dialog.Root.Props['defaultOpen']; readonly onOpenChange?: Change };

export type ValueStateProperties<Value, Change, DefaultValue = Value> =
  | { readonly value: Value; readonly defaultValue?: never; readonly onValueChange: Change }
  | { readonly value?: never; readonly defaultValue?: DefaultValue; readonly onValueChange?: Change };

export type ReadOnlyValueProperties<Value, Change> = {
  readonly value: Value;
  readonly defaultValue?: never;
  readonly onValueChange?: Change;
  readonly readOnly: true;
};

export type CheckedStateProperties<Change> =
  | {
      readonly checked: boolean;
      readonly defaultChecked?: never;
      readonly onCheckedChange: Change;
      readonly readOnly?: boolean;
    }
  | {
      readonly checked: boolean;
      readonly defaultChecked?: never;
      readonly onCheckedChange?: Change;
      readonly readOnly: true;
    }
  | {
      readonly checked?: never;
      readonly defaultChecked?: boolean;
      readonly onCheckedChange?: Change;
      readonly readOnly?: boolean;
    };

export type TextValueProperties<Value, Change, ValueChange> =
  | {
      readonly value: Value;
      readonly defaultValue?: never;
      readonly onChange: Change;
      readonly onValueChange?: ValueChange;
      readonly readOnly?: ComponentProps<'input'>['readOnly'];
    }
  | {
      readonly value: Value;
      readonly defaultValue?: never;
      readonly onChange?: Change;
      readonly onValueChange: ValueChange;
      readonly readOnly?: ComponentProps<'input'>['readOnly'];
    }
  | {
      readonly value: Value;
      readonly defaultValue?: never;
      readonly onChange?: Change;
      readonly onValueChange?: ValueChange;
      readonly readOnly: true;
    }
  | {
      readonly value?: never;
      readonly defaultValue?: Value;
      readonly onChange?: Change;
      readonly onValueChange?: ValueChange;
      readonly readOnly?: ComponentProps<'input'>['readOnly'];
    };
