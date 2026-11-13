import type { ReactNode } from 'react';
import type { ControlDensity } from '../../../foundations/src/control-density.ts';
import { Calendar } from './calendar.tsx';
import type { CalendarDate, CalendarEnvironment } from './calendar.tsx';
import { dateValidation, formatDate, isDate } from './civil.ts';
import { DateInput } from './date-inputs.tsx';
import { PickerPopover } from './picker-popover.tsx';

export type DatePickerProps = CalendarEnvironment & {
  readonly label: string;
  readonly value: CalendarDate | undefined;
  readonly onValueChange: (value: CalendarDate | undefined) => void;
  readonly formatValue?: (value: CalendarDate) => string;
  readonly density?: ControlDensity;
  readonly disabled?: boolean;
  readonly isClearable?: boolean;
};

export function DatePicker({
  label,
  value,
  onValueChange,
  formatValue,
  density,
  disabled,
  isClearable,
  ...environment
}: DatePickerProps): ReactNode {
  return (
    <PickerPopover
      label={label}
      value={value}
      onValueChange={onValueChange}
      formatValue={formatValue ?? ((date) => formatDate(date, environment.locale))}
      validateValue={(date) => dateValidation(date, environment.minimum, environment.maximum)}
      density={density}
      disabled={disabled}
      isClearable={isClearable}
      timeZone={environment.timeZone}
    >
      {(draft, setDraft) => (
        <>
          <DateInput
            label="Date"
            value={draft}
            minimum={environment.minimum}
            maximum={environment.maximum}
            onValueChange={setDraft}
          />
          <Calendar
            {...environment}
            label={label}
            mode="single"
            autoFocus
            value={draft}
            initialMonth={draft !== undefined && isDate(draft) ? draft : environment.initialMonth}
            onValueChange={setDraft}
          />
        </>
      )}
    </PickerPopover>
  );
}
