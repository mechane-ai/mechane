import * as stylex from '@stylexjs/stylex';
import { CalendarDays } from 'lucide-react';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, TextButton } from '../../../core/src/index.ts';
import type { ControlDensity } from '../../../foundations/src/control-density.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { Popover } from '../../../overlays/src/index.ts';

export type PickerPreset<Value> = { readonly id: string; readonly label: string; readonly value: Value };

type PickerPopoverProps<Value> = {
  readonly label: string;
  readonly value: Value | undefined;
  readonly onValueChange: (value: Value | undefined) => void;
  readonly formatValue: (value: Value) => string;
  readonly validateValue: (value: Value) => string | undefined;
  readonly presets?: ReadonlyArray<PickerPreset<Value>> | undefined;
  readonly density?: ControlDensity | undefined;
  readonly disabled?: boolean | undefined;
  readonly isClearable?: boolean | undefined;
  readonly timeZone: string;
  readonly children: (value: Value | undefined, onValueChange: (value: Value | undefined) => void) => ReactNode;
};

const styles = stylex.create({
  calendarPopup: {
    maxWidth: { '@media (pointer: coarse) and (max-width: 375px)': 'calc(100vw - 2px)' },
    padding: { '@media (pointer: coarse) and (max-width: 375px)': spacing.xs },
  },
  content: { display: 'flex', flexDirection: 'column', gap: spacing.md, minWidth: 0 },
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.line,
  },
  actions: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  zone: { color: colors.muted, fontSize: typography.captionSize, lineHeight: typography.captionLineHeight },
  error: { color: colors.danger, fontSize: typography.captionSize, lineHeight: typography.captionLineHeight },
});

export function PickerPopover<Value>({
  label,
  value,
  onValueChange,
  formatValue,
  validateValue,
  presets = [],
  density = 'standard',
  disabled,
  isClearable = true,
  timeZone,
  children,
}: PickerPopoverProps<Value>): ReactNode {
  const [isOpen, setOpen] = useState(false);
  const [draft, setDraft] = useState<Value | undefined>(value);
  const errorId = useId();
  const error = draft === undefined ? undefined : validateValue(draft);

  function commit(next: Value | undefined): void {
    onValueChange(next);
    setOpen(false);
  }

  return (
    <Popover.Root
      open={isOpen}
      onOpenChange={(next) => {
        if (next) {
          setDraft(value);
        }

        setOpen(next);
      }}
    >
      <Popover.Trigger
        disabled={disabled}
        render={<Button density={density} variant="outline" />}
        aria-label={value === undefined ? label : `${label}: ${formatValue(value)}`}
      >
        <CalendarDays size={16} aria-hidden="true" />
        {value === undefined ? label : formatValue(value)}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="end" collisionPadding={1}>
          <Popover.Popup aria-label={label} {...stylex.props(styles.calendarPopup)}>
            <div {...stylex.props(styles.content)}>
              <Popover.Title>{label}</Popover.Title>
              {presets.length > 0 && (
                <div role="group" aria-label="Date presets" {...stylex.props(styles.presets)}>
                  {presets.map((preset) => (
                    <Button
                      key={preset.id}
                      variant="ghost"
                      disabled={validateValue(preset.value) !== undefined}
                      onClick={() => commit(preset.value)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              )}
              {isOpen && children(draft, setDraft)}
              <div id={errorId} aria-live="polite" {...stylex.props(styles.error)}>
                {error}
              </div>
              <div {...stylex.props(styles.footer)}>
                <span {...stylex.props(styles.zone)}>{timeZone}</span>
                <div {...stylex.props(styles.actions)}>
                  {isClearable && (
                    <TextButton disabled={value === undefined} onClick={() => commit(undefined)}>
                      Clear
                    </TextButton>
                  )}
                  <Button variant="ghost" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="solid"
                    disabled={draft === undefined || error !== undefined}
                    aria-describedby={error === undefined ? undefined : errorId}
                    onClick={() => {
                      if (draft !== undefined && validateValue(draft) === undefined) {
                        commit(draft);
                      }
                    }}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
