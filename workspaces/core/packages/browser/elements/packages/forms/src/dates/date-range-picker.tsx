import * as stylex from '@stylexjs/stylex';
import { CalendarDays } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, TextButton } from '../../../core/src/index.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { Popover } from '../../../overlays/src/index.ts';
import { Calendar } from './calendar.tsx';
import type { CalendarEnvironment, CalendarRange } from './calendar.tsx';

const styles = stylex.create({
  popup: { display: 'flex', flexDirection: 'column', gap: spacing.sm },
  presets: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
  },
  footer: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.line,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    overflowWrap: 'anywhere',
    color: colors.muted,
  },
});

export type DateRangePreset = { readonly id: string; readonly label: string; readonly value: CalendarRange };

export type DateRangePickerProps = {
  readonly label: string;
  readonly value: CalendarRange | undefined;
  readonly onValueChange: (value: CalendarRange | undefined) => void;
  readonly formatValue: (value: CalendarRange) => string;
  readonly presets?: ReadonlyArray<DateRangePreset>;
  readonly disabled?: boolean;
} & CalendarEnvironment;

export function DateRangePicker({
  label,
  value,
  onValueChange,
  formatValue,
  presets = [],
  disabled,
  ...environment
}: DateRangePickerProps): ReactNode {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger disabled={disabled} render={<Button variant="outline" />} aria-label={label}>
        <CalendarDays size={16} aria-hidden="true" />
        {value === undefined ? label : formatValue(value)}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="start">
          <Popover.Popup aria-label={label}>
            <div {...stylex.props(styles.popup)}>
              {presets.length > 0 && (
                <div role="group" aria-label="Date presets" {...stylex.props(styles.presets)}>
                  {presets.map((preset) => (
                    <Button
                      key={preset.id}
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        onValueChange(preset.value);
                        setOpen(false);
                      }}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              )}
              <Calendar
                {...environment}
                label={label}
                mode="range"
                autoFocus
                value={value}
                onValueChange={(next) => {
                  onValueChange(next);

                  if (next?.to !== undefined) {
                    setOpen(false);
                  }
                }}
              />
              <div {...stylex.props(styles.footer)}>
                <span>{environment.timeZone}</span>
                <TextButton disabled={value === undefined} onClick={() => onValueChange(undefined)}>
                  Clear
                </TextButton>
              </div>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
