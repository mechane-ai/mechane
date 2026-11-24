import * as stylex from '@stylexjs/stylex';
import type { ChangeDetails } from '@ui-sdk/core';
import { SelectTrigger, SelectValue } from '@ui-sdk/react/select';
import type { SelectValueChangeReason } from '@ui-sdk/react/select';
import { Check, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { Select } from '../../../forms/src/index.ts';
import { conditions } from '../../../foundations/src/constants.stylex.ts';
import { colors, controls, radii, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import type { ChoiceParam } from './define-lesson.ts';

const CHEVRON_SIZE = 14;

const styles = stylex.create({
  trigger: {
    'display': 'inline-flex',
    'alignItems': 'baseline',
    'gap': spacing.xxs,
    'padding': 0,
    'margin': 0,
    'borderWidth': 0,
    'borderRadius': radii.sm,
    'backgroundColor': 'transparent',
    'color': colors.ink,
    'fontFamily': 'inherit',
    'fontSize': 'inherit',
    'lineHeight': 'inherit',
    'fontWeight': typography.mediumWeight,
    'whiteSpace': 'nowrap',
    'cursor': 'pointer',
    'textDecorationLine': 'underline',
    'textDecorationStyle': 'dotted',
    'textDecorationThickness': 2,
    'textDecorationColor': colors.focus,
    'textUnderlineOffset': '0.25em',
    ':hover': { backgroundColor: { [conditions.hoverPointer]: colors.canvas } },
    ':is([data-disabled])': { cursor: 'default', textDecorationLine: 'none' },
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: 2,
    },
  },
  chevron: { alignSelf: 'center', color: colors.muted },
});

export type InlineChoiceProps = {
  readonly param: ChoiceParam;
  readonly value: string;
  readonly isDisabled: boolean;
  readonly onChange: (value: string, details: ChangeDetails<SelectValueChangeReason>) => void;
};

/** One option of a choice param, picked from a short list that opens from the word in the sentence. */
export function InlineChoice({ param, value, isDisabled, onChange }: InlineChoiceProps): ReactNode {
  const items = param.options.map((option) => ({ value: option.id, label: option.label }));

  return (
    <Select.Root<string>
      value={value}
      items={items}
      disabled={isDisabled}
      onValueChange={(next, details) => {
        if (next !== null) {
          onChange(next, details);
        }
      }}
    >
      <SelectTrigger aria-label={param.label} disabled={isDisabled} {...stylex.props(styles.trigger)}>
        <SelectValue />
        {!isDisabled && <ChevronDown size={CHEVRON_SIZE} aria-hidden {...stylex.props(styles.chevron)} />}
      </SelectTrigger>
      <Select.Popup align="start">
        <Select.List>
          {items.map((item) => (
            <Select.Item key={item.value} value={item.value}>
              <Select.ItemText>{item.label}</Select.ItemText>
              <Select.ItemIndicator>
                <Check size={16} aria-hidden />
              </Select.ItemIndicator>
            </Select.Item>
          ))}
        </Select.List>
      </Select.Popup>
    </Select.Root>
  );
}
