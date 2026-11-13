import type { ReactNode } from 'react';
import type { ControlDensity } from '../../../foundations/src/control-density.ts';
import { formatMonth, isMonth, monthOrder, monthValidation } from './civil.ts';
import type { MonthRange } from './civil.ts';
import { MonthInput, RangeInputs } from './date-inputs.tsx';
import { MonthCalendar } from './month-calendar.tsx';
import type { MonthDraft, MonthEnvironment } from './month-calendar.tsx';
import { PickerPopover } from './picker-popover.tsx';
import type { PickerPreset } from './picker-popover.tsx';

export type MonthRangePreset = PickerPreset<MonthRange>;

export type MonthRangePickerProps = MonthEnvironment & {
  readonly label: string;
  readonly value: MonthRange | undefined;
  readonly onValueChange: (value: MonthRange | undefined) => void;
  readonly formatValue?: (value: MonthRange) => string;
  readonly presets?: ReadonlyArray<MonthRangePreset>;
  readonly validateRange?: (value: MonthRange) => string | undefined;
  readonly density?: ControlDensity;
  readonly disabled?: boolean;
  readonly isClearable?: boolean;
};

export function MonthRangePicker({
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
}: MonthRangePickerProps): ReactNode {
  function validate(draft: MonthDraft): string | undefined {
    if (draft.to === undefined) {
      return 'Select a start and end month.';
    }

    const invalid =
      monthValidation(draft.from, environment.minimum, environment.maximum) ??
      monthValidation(draft.to, environment.minimum, environment.maximum);

    if (invalid !== undefined) {
      return invalid;
    }

    if (monthOrder(draft.from) > monthOrder(draft.to)) {
      return 'End month must be on or after start month.';
    }

    return validateRange?.({ from: draft.from, to: draft.to });
  }

  function describe(draft: MonthDraft): string {
    if (draft.to === undefined) {
      return formatMonth(draft.from, environment.locale);
    }

    const complete = { from: draft.from, to: draft.to };

    return (
      formatValue?.(complete) ??
      `${formatMonth(complete.from, environment.locale)} – ${formatMonth(complete.to, environment.locale)}`
    );
  }

  return (
    <PickerPopover<MonthDraft>
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
            <MonthInput
              label="Start month"
              value={draft?.from}
              minimum={environment.minimum}
              maximum={environment.maximum}
              onValueChange={(from) => setDraft(from === undefined ? undefined : { from, to: draft?.to })}
            />
            <MonthInput
              label="End month"
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
          <MonthCalendar
            {...environment}
            label={label}
            selection={draft}
            initialMonth={draft !== undefined && isMonth(draft.from) ? draft.from : environment.initialMonth}
            onSelect={(month) => {
              if (draft === undefined || draft.to !== undefined) {
                setDraft({ from: month });
              } else if (monthOrder(month) < monthOrder(draft.from)) {
                setDraft({ from: month, to: draft.from });
              } else {
                setDraft({ from: draft.from, to: month });
              }
            }}
          />
        </>
      )}
    </PickerPopover>
  );
}
