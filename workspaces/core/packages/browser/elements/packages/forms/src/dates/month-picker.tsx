import type { ReactNode } from 'react';
import type { ControlDensity } from '../../../foundations/src/control-density.ts';
import { formatMonth, isMonth, monthValidation } from './civil.ts';
import type { CalendarMonth } from './civil.ts';
import { MonthInput } from './date-inputs.tsx';
import { MonthCalendar } from './month-calendar.tsx';
import type { MonthEnvironment } from './month-calendar.tsx';
import { PickerPopover } from './picker-popover.tsx';

export type MonthPickerProps = MonthEnvironment & {
  readonly label: string;
  readonly value: CalendarMonth | undefined;
  readonly onValueChange: (value: CalendarMonth | undefined) => void;
  readonly formatValue?: (value: CalendarMonth) => string;
  readonly density?: ControlDensity;
  readonly disabled?: boolean;
  readonly isClearable?: boolean;
};

export function MonthPicker({
  label,
  value,
  onValueChange,
  formatValue,
  density,
  disabled,
  isClearable,
  ...environment
}: MonthPickerProps): ReactNode {
  return (
    <PickerPopover
      label={label}
      value={value}
      onValueChange={onValueChange}
      formatValue={formatValue ?? ((month) => formatMonth(month, environment.locale))}
      validateValue={(month) => monthValidation(month, environment.minimum, environment.maximum)}
      density={density}
      disabled={disabled}
      isClearable={isClearable}
      timeZone={environment.timeZone}
    >
      {(draft, setDraft) => (
        <>
          <MonthInput
            label="Month"
            value={draft}
            minimum={environment.minimum}
            maximum={environment.maximum}
            onValueChange={setDraft}
          />
          <MonthCalendar
            {...environment}
            label={label}
            selection={draft === undefined ? undefined : { from: draft }}
            initialMonth={draft !== undefined && isMonth(draft) ? draft : environment.initialMonth}
            onSelect={setDraft}
          />
        </>
      )}
    </PickerPopover>
  );
}
