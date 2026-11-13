import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { spacing } from '../../../foundations/src/tokens.stylex.ts';
import { Field, Input } from '../forms.tsx';
import type { CalendarDate } from './calendar.tsx';
import { dateInput, monthInput, parseDate, parseMonth } from './civil.ts';
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
        value={value === undefined ? '' : dateInput(value)}
        min={minimum === undefined ? '0001-01-01' : dateInput(minimum)}
        max={maximum === undefined ? '9999-12-31' : dateInput(maximum)}
        onChange={(event) => onValueChange(parseDate(event.target.value))}
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
        value={value === undefined ? '' : monthInput(value)}
        min={minimum === undefined ? '0001-01' : monthInput(minimum)}
        max={maximum === undefined ? '9999-12' : monthInput(maximum)}
        onChange={(event) => onValueChange(parseMonth(event.target.value))}
        xstyle={styles.input}
      />
    </Field.Root>
  );
}

export function RangeInputs({ children }: { readonly children: ReactNode }): ReactNode {
  return <div {...stylex.props(styles.fields)}>{children}</div>;
}
