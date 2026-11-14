import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { spacing } from '../../../foundations/src/tokens.stylex.ts';
import { Field, Input } from '../forms.tsx';
import type { CalendarDate } from './calendar.tsx';
import { parseCalendarDate, parseCalendarMonth, serializeCalendarDate, serializeCalendarMonth } from './civil.ts';
import type { CalendarMonth } from './civil.ts';

const styles = stylex.create({
  fields: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: spacing.sm },
  input: { width: '100%', minWidth: 0 },
});

export function DateInput({
  label,
  value,
  minimum,
  maximum,
  onValueChange,
}: {
  readonly label: string;
  readonly value: CalendarDate | undefined;
  readonly minimum?: CalendarDate | undefined;
  readonly maximum?: CalendarDate | undefined;
  readonly onValueChange: (value: CalendarDate | undefined) => void;
}): ReactNode {
  return (
    <Field.Root>
      <Field.Label>{label}</Field.Label>
      <Input
        type="date"
        value={value === undefined ? '' : serializeCalendarDate(value)}
        min={minimum === undefined ? '0001-01-01' : serializeCalendarDate(minimum)}
        max={maximum === undefined ? '9999-12-31' : serializeCalendarDate(maximum)}
        onChange={(event) => onValueChange(parseCalendarDate(event.target.value))}
        xstyle={styles.input}
      />
    </Field.Root>
  );
}

export function MonthInput({
  label,
  value,
  minimum,
  maximum,
  onValueChange,
}: {
  readonly label: string;
  readonly value: CalendarMonth | undefined;
  readonly minimum?: CalendarMonth | undefined;
  readonly maximum?: CalendarMonth | undefined;
  readonly onValueChange: (value: CalendarMonth | undefined) => void;
}): ReactNode {
  return (
    <Field.Root>
      <Field.Label>{label}</Field.Label>
      <Input
        type="month"
        value={value === undefined ? '' : serializeCalendarMonth(value)}
        min={minimum === undefined ? '0001-01' : serializeCalendarMonth(minimum)}
        max={maximum === undefined ? '9999-12' : serializeCalendarMonth(maximum)}
        onChange={(event) => onValueChange(parseCalendarMonth(event.target.value))}
        xstyle={styles.input}
      />
    </Field.Root>
  );
}

export function RangeInputs({ children }: { readonly children: ReactNode }): ReactNode {
  return <div {...stylex.props(styles.fields)}>{children}</div>;
}
