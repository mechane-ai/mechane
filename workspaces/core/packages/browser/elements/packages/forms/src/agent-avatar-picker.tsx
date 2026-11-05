import { Radio as BaseRadio } from '@base-ui/react/radio';
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group';
import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { AgentAvatar, agentAvatarColors, agentAvatarShapes } from '../../core/src/index.ts';
import type { AgentAppearance, AgentAvatarColor, AgentAvatarShape } from '../../core/src/index.ts';
import { colors, conditions, controls, radii, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.lg,
    fontFamily: typography.fontFamily,
    fontWeight: typography.regularWeight,
    minWidth: 0,
    maxWidth: '100%',
    width: 352,
  },
  preview: { display: 'flex', alignItems: 'center', gap: spacing.md, minWidth: 0 },
  identity: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  name: {
    color: colors.ink,
    fontSize: typography.bodySize,
    fontWeight: typography.mediumWeight,
    lineHeight: typography.bodyLineHeight,
    textTransform: 'capitalize',
  },
  color: {
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    textTransform: 'capitalize',
  },
  section: { display: 'flex', flexDirection: 'column', gap: spacing.sm, minWidth: 0 },
  label: {
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    fontWeight: typography.mediumWeight,
  },
  choices: {
    display: 'grid',
    gridTemplateColumns: {
      default: `repeat(auto-fill, minmax(${controls.mdHeight}, 1fr))`,
      [conditions.coarsePointer]: `repeat(auto-fill, minmax(${controls.coarseTarget}, 1fr))`,
    },
    gap: spacing.xs,
  },
  choice: {
    'display': 'inline-flex',
    'alignItems': 'center',
    'justifyContent': 'center',
    'boxSizing': 'border-box',
    'minWidth': { default: controls.mdHeight, [conditions.coarsePointer]: controls.coarseTarget },
    'minHeight': { default: controls.mdHeight, [conditions.coarsePointer]: controls.coarseTarget },
    'padding': spacing.xs,
    'borderWidth': 1,
    'borderStyle': 'solid',
    'borderColor': 'transparent',
    'borderRadius': radii.md,
    'backgroundColor': 'transparent',
    'cursor': 'pointer',
    ':is([data-checked])': { borderColor: colors.ink, backgroundColor: colors.canvas },
    ':hover:not(:active, [data-disabled])': { backgroundColor: { [conditions.hoverPointer]: colors.canvas } },
    ':active:not([data-disabled])': { backgroundColor: colors.line },
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: 2,
    },
    ':is([data-disabled])': { cursor: 'default', opacity: controls.disabledOpacity },
  },
});

export type AgentAvatarPickerProps = {
  readonly value: AgentAppearance;
  readonly onValueChange: (value: AgentAppearance) => void;
  readonly disabled?: boolean;
};

export function AgentAvatarPicker({ value, onValueChange, disabled = false }: AgentAvatarPickerProps): ReactNode {
  const shapeLabel = useId();
  const colorLabel = useId();

  return (
    <div {...stylex.props(styles.root)}>
      <div {...stylex.props(styles.preview)}>
        <AgentAvatar seed="preview" appearance={value} size="lg" />
        <div {...stylex.props(styles.identity)}>
          <span {...stylex.props(styles.name)}>{value.shape}</span>
          <span {...stylex.props(styles.color)}>{value.color}</span>
        </div>
      </div>
      <div {...stylex.props(styles.section)}>
        <span id={shapeLabel} {...stylex.props(styles.label)}>
          Shape
        </span>
        <BaseRadioGroup<AgentAvatarShape>
          aria-labelledby={shapeLabel}
          value={value.shape}
          onValueChange={(shape) => onValueChange({ ...value, shape })}
          disabled={disabled}
          {...stylex.props(styles.choices)}
        >
          {agentAvatarShapes.map((shape) => (
            <BaseRadio.Root key={shape} value={shape} aria-label={shape} title={shape} {...stylex.props(styles.choice)}>
              <AgentAvatar seed={shape} appearance={{ ...value, shape }} size="md" />
            </BaseRadio.Root>
          ))}
        </BaseRadioGroup>
      </div>
      <div {...stylex.props(styles.section)}>
        <span id={colorLabel} {...stylex.props(styles.label)}>
          Color
        </span>
        <BaseRadioGroup<AgentAvatarColor>
          aria-labelledby={colorLabel}
          value={value.color}
          onValueChange={(color) => onValueChange({ ...value, color })}
          disabled={disabled}
          {...stylex.props(styles.choices)}
        >
          {agentAvatarColors.map((color) => (
            <BaseRadio.Root key={color} value={color} aria-label={color} title={color} {...stylex.props(styles.choice)}>
              <AgentAvatar seed={color} appearance={{ ...value, color }} size="md" />
            </BaseRadio.Root>
          ))}
        </BaseRadioGroup>
      </div>
    </div>
  );
}
