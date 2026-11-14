import type { ReactNode } from 'react';
import type { ControlDensity } from '../../../foundations/src/control-density.ts';
import { Calendar } from './calendar.tsx';
import type { CalendarEnvironment, CalendarRange } from './calendar.tsx';
import { dateValidation, formatDate, isDate, serializeCalendarDate } from './civil.ts';
import type { DateRange } from './civil.ts';
import { DateInput, RangeInputs } from './date-inputs.tsx';
import { PickerPopover } from './picker-popover.tsx';
import type { PickerPreset } from './picker-popover.tsx';

export type DateRangePreset = PickerPreset<DateRange>;

export type DateRangePickerProps = CalendarEnvironment & {
  readonly label: string;
  readonly value: DateRange | undefined;
  readonly onValueChange: (value: DateRange | undefined) => void;
  readonly formatValue?: (value: DateRange) => string;
  readonly presets?: ReadonlyArray<DateRangePreset>;
  readonly validateRange?: (value: DateRange) => string | undefined;
  readonly density?: ControlDensity;
  readonly disabled?: boolean;
  readonly isClearable?: boolean;
};

export function DateRangePicker({
  label,
  value,
  onValueChange,
  formatValue,
  presets,
  validateRange,
  density,
  disabled,
  isClearable,
  ...environment
}: DateRangePickerProps): ReactNode {
  function validate(draft: CalendarRange): string | undefined {
    if (draft.to === undefined) {
      return 'Select a start and end date.';
    }

    const invalid =
      dateValidation(draft.from, environment.minimum, environment.maximum) ??
      dateValidation(draft.to, environment.minimum, environment.maximum);

    if (invalid !== undefined) {
      return invalid;
    }

    if (serializeCalendarDate(draft.from) > serializeCalendarDate(draft.to)) {
      return 'End date must be on or after start date.';
    }

    return validateRange?.({ from: draft.from, to: draft.to });
  }

  function describe(draft: CalendarRange): string {
    if (draft.to === undefined) {
      return formatDate(draft.from, environment.locale);
    }

    const complete = { from: draft.from, to: draft.to };

    return (
      formatValue?.(complete) ??
      `${formatDate(complete.from, environment.locale)} – ${formatDate(complete.to, environment.locale)}`
    );
  }

  return (
    <PickerPopover<CalendarRange>
      label={label}
      value={value}
      formatValue={describe}
      validateValue={validate}
      presets={presets}
      density={density}
      disabled={disabled}
      isClearable={isClearable}
      timeZone={environment.timeZone}
      onValueChange={(next) => {
        if (next === undefined) {
          onValueChange(undefined);
        } else if (next.to !== undefined) {
          onValueChange({ from: next.from, to: next.to });
        }
      }}
    >
      {(draft, setDraft) => (
        <>
          <RangeInputs>
            <DateInput
              label="Start date"
              value={draft?.from}
              minimum={environment.minimum}
              maximum={environment.maximum}
              onValueChange={(from) => setDraft(from === undefined ? undefined : { from, to: draft?.to })}
            />
            <DateInput
              label="End date"
              value={draft?.to}
              minimum={environment.minimum}
              maximum={environment.maximum}
              onValueChange={(to) => {
                if (draft !== undefined) {
                  setDraft({ from: draft.from, to });
                } else if (to !== undefined) {
                  setDraft({ from: to, to });
                }
              }}
            />
          </RangeInputs>
          <Calendar
            {...environment}
            label={label}
            mode="range"
            autoFocus
            value={draft}
            initialMonth={draft !== undefined && isDate(draft.from) ? draft.from : environment.initialMonth}
            onValueChange={setDraft}
          />
        </>
      )}
    </PickerPopover>
  );
}
