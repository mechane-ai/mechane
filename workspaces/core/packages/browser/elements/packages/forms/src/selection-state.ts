import type {
  OpenStateProperties,
  ReadOnlyValueProperties,
  ValueStateProperties,
} from '../../foundations/src/control-state.ts';

type Multiple = Readonly<Record<'multiple', true>>;

export type SingleSelectionOf<Options> = Exclude<Options, Multiple>;
export type MultipleSelectionOf<Options> = Extract<Options, Multiple>;

export type SelectionProperties<
  Options extends {
    readonly open?: unknown;
    readonly onOpenChange?: unknown;
    readonly value?: unknown;
    readonly onValueChange?: unknown;
  },
> = Options &
  OpenStateProperties<NonNullable<Options['onOpenChange']>> &
  (
    | ValueStateProperties<Exclude<Options['value'], undefined>, NonNullable<Options['onValueChange']>>
    | ReadOnlyValueProperties<Exclude<Options['value'], undefined>, NonNullable<Options['onValueChange']>>
  );
