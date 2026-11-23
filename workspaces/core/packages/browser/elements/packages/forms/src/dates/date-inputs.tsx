import * as stylex from '@stylexjs/stylex';
import { DateInputSegment, DateInput as SdkDateInput } from '@ui-sdk/react/date-input';
import type { DateInputSegmentType } from '@ui-sdk/react/date-input';
import type { ReactNode } from 'react';
import { controlStyles } from '../../../foundations/src/control-styles.ts';
import { colors, controls, radii, spacing } from '../../../foundations/src/tokens.stylex.ts';
import { Field, Input } from '../forms.tsx';
import type { CalendarDate } from './calendar.tsx';
import { parseCalendarDate, parseCalendarMonth, serializeCalendarDate, serializeCalendarMonth } from './civil.ts';
import type { CalendarMonth } from './civil.ts';

const styles = stylex.create({
  fields: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: spacing.sm },
  input: { width: '100%', minWidth: 0 },
  segments: {
    'display': 'flex',
    'alignItems': 'center',
    'fontVariantNumeric': 'tabular-nums',
    ':focus-within': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: 1,
    },
    ':is([data-invalid])': { borderColor: colors.danger },
  },
  segment: {
    'boxSizing': 'content-box',
    'width': '2ch',
    'padding': 0,
    'paddingInline': spacing.xxs,
    'borderWidth': 0,
    'borderRadius': radii.sm,
    'backgroundColor': 'transparent',
    'color': 'inherit',
    'fontFamily': 'inherit',
    'fontSize': 'inherit',
    'lineHeight': 'inherit',
    'fontVariantNumeric': 'inherit',
    'textAlign': 'center',
    'outlineStyle': 'none',
    'caretColor': 'transparent',
    ':focus': { backgroundColor: colors.focus, color: colors.surface },
    '::placeholder': { color: colors.muted },
  },
  year: { width: '4ch' },
  literal: { color: colors.muted },
});

const segmentStyles: Readonly<Record<DateInputSegmentType, ReadonlyArray<stylex.StyleXStyles>>> = {
  year: [styles.segment, styles.year],
  month: [styles.segment],
  day: [styles.segment],
  hour: [styles.segment],
  minute: [styles.segment],
  second: [styles.segment],
  dayPeriod: [styles.segment],
  literal: [styles.literal],
};

/** A typed date on the UI SDK date input: one segment per unit in the locale's order, stepped with the arrow keys. */
export function DateInput({
  label,
  value,
  minimum,
  maximum,
  locale,
  onValueChange,
}: {
  readonly label: string;
  readonly value: CalendarDate | undefined;
  readonly minimum?: CalendarDate | undefined;
  readonly maximum?: CalendarDate | undefined;
  readonly locale: string;
  readonly onValueChange: (value: CalendarDate | undefined) => void;
}): ReactNode {
  return (
    <Field.Root>
      <Field.Label>{label}</Field.Label>
      <SdkDateInput
        value={value === undefined ? null : serializeCalendarDate(value)}
        {...(minimum !== undefined && { min: serializeCalendarDate(minimum) })}
        {...(maximum !== undefined && { max: serializeCalendarDate(maximum) })}
        locale={locale}
        onValueChange={(next) => onValueChange(next === null ? undefined : parseCalendarDate(next))}
        {...stylex.props(controlStyles.base, controlStyles.field, controlStyles.singleLineField, styles.segments)}
      >
        {({ segments }) =>
          segments.map((segment) => (
            <DateInputSegment key={segment.key} segment={segment} {...stylex.props(segmentStyles[segment.type])} />
          ))
        }
      </SdkDateInput>
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
