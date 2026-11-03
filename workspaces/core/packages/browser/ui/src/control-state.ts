import type { Dialog } from '@base-ui/react/dialog';
import type { ComponentProps } from 'react';

export type OpenStateProperties<Change> =
  | {
      readonly open: NonNullable<Dialog.Root.Props['open']>;
      readonly defaultOpen?: never;
      readonly onOpenChange: Change;
    }
  | { readonly open?: never; readonly defaultOpen?: Dialog.Root.Props['defaultOpen']; readonly onOpenChange?: Change };

export type ValueStateProperties<Value, Change> =
  | { readonly value: Value; readonly defaultValue?: never; readonly onValueChange: Change }
  | { readonly value?: never; readonly defaultValue?: Value; readonly onValueChange?: Change };

export type ReadOnlyValueProperties<Value, Change> = {
  readonly value: Value;
  readonly defaultValue?: never;
  readonly onValueChange?: Change;
  readonly readOnly: true;
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
