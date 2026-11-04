import { Button as BaseButton } from '@base-ui/react/button';
import { mergeProps } from '@base-ui/react/merge-props';
import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { mergeStyles } from '../../foundations/src/style-composition.ts';
import type { ControlStyle, PlacementStyle } from '../../foundations/src/style-composition.ts';
import { colors, conditions, controls, radii, typography } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  button: {
    'display': 'inline-flex',
    'boxSizing': 'border-box',
    'alignItems': 'center',
    'justifyContent': 'center',
    'gap': controls.gap,
    'paddingBlock': 0,
    'paddingInline': controls.paddingInline,
    'borderRadius': radii.sm,
    'borderWidth': 1,
    'borderStyle': 'solid',
    'fontFamily': typography.fontFamily,
    'WebkitFontSmoothing': 'antialiased',
    'fontWeight': 500,
    'fontSize': typography.bodySize,
    'lineHeight': typography.bodyLineHeight,
    'cursor': 'pointer',
    'whiteSpace': 'nowrap',
    ':is([data-disabled]):not([aria-busy="true"])': { opacity: controls.disabledOpacity, cursor: 'default' },
    ':is([aria-busy="true"])': { cursor: 'progress' },
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: 2,
    },
  },
  sm: { minHeight: { default: controls.smHeight, [conditions.coarsePointer]: controls.coarseTarget } },
  md: { minHeight: { default: controls.mdHeight, [conditions.coarsePointer]: controls.coarseTarget } },
  solidNeutral: {
    'backgroundColor': colors.ink,
    'borderColor': colors.ink,
    'color': colors.inverse,
    ':hover:not([data-disabled])': { backgroundColor: { [conditions.hoverPointer]: colors.inkHover } },
  },
  outlineNeutral: {
    'backgroundColor': colors.canvas,
    'borderColor': colors.line,
    'color': colors.ink,
    ':hover:not([data-disabled])': { backgroundColor: { [conditions.hoverPointer]: colors.line } },
  },
  ghostNeutral: {
    'backgroundColor': 'transparent',
    'borderColor': 'transparent',
    'borderWidth': 0,
    'color': colors.ink,
    'fontWeight': 400,
    ':hover:not([data-disabled])': { backgroundColor: { [conditions.hoverPointer]: colors.canvas } },
  },
  solidDanger: {
    'backgroundColor': colors.danger,
    'borderColor': colors.danger,
    'color': colors.inverse,
    ':hover:not([data-disabled])': { backgroundColor: { [conditions.hoverPointer]: colors.dangerHover } },
  },
  outlineDanger: {
    'backgroundColor': colors.surface,
    'borderColor': colors.danger,
    'color': colors.danger,
    ':hover:not([data-disabled])': { backgroundColor: { [conditions.hoverPointer]: colors.dangerSoft } },
  },
  ghostDanger: {
    'backgroundColor': 'transparent',
    'borderColor': 'transparent',
    'borderWidth': 0,
    'color': colors.danger,
    'fontWeight': 400,
    ':hover:not([data-disabled])': { backgroundColor: { [conditions.hoverPointer]: colors.dangerSoft } },
  },
  labels: { display: 'inline-grid' },
  label: { gridArea: '1 / 1' },
  hidden: { visibility: 'hidden' },
  icon: { width: controls.iconSize, height: controls.iconSize, flexShrink: 0, display: 'inline-flex' },
  iconSm: {
    minWidth: { default: controls.smHeight, [conditions.coarsePointer]: controls.coarseTarget },
    paddingInline: 0,
  },
  iconMd: {
    minWidth: { default: controls.mdHeight, [conditions.coarsePointer]: controls.coarseTarget },
    paddingInline: 0,
  },
  text: {
    'display': 'inline-block',
    'boxSizing': 'border-box',
    'minHeight': { default: typography.bodyLineHeight, [conditions.coarsePointer]: controls.coarseTarget },
    'minWidth': 0,
    'paddingBlock': 0,
    'paddingInline': 0,
    'borderWidth': 0,
    'borderRadius': 0,
    'backgroundColor': 'transparent',
    'fontFamily': typography.fontFamily,
    'WebkitFontSmoothing': 'antialiased',
    'fontSize': typography.bodySize,
    'lineHeight': typography.bodyLineHeight,
    'fontWeight': 400,
    'maxWidth': '100%',
    'overflow': 'hidden',
    'textOverflow': 'ellipsis',
    'verticalAlign': 'middle',
    'cursor': 'pointer',
    ':hover:not([data-disabled])': { textDecorationLine: { [conditions.hoverPointer]: 'underline' } },
    ':is([data-disabled]):not([aria-busy="true"])': { opacity: controls.disabledOpacity, cursor: 'default' },
    ':is([aria-busy="true"])': { cursor: 'progress' },
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: 2,
    },
  },
  neutralText: { color: colors.ink },
  dangerText: { color: colors.danger },
  link: {
    'fontFamily': typography.fontFamily,
    'WebkitFontSmoothing': 'antialiased',
    'color': colors.ink,
    'textDecorationLine': 'none',
    ':hover': { textDecorationLine: { [conditions.hoverPointer]: 'underline' } },
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: 2,
    },
  },
});

type ButtonVariant = 'solid' | 'outline' | 'ghost';
type ButtonTone = 'neutral' | 'danger';
type ControlSize = 'sm' | 'md';
type PendingProps = { readonly pending?: boolean; readonly pendingLabel?: string | undefined };

type ButtonProps = ComponentProps<typeof BaseButton> &
  PendingProps & {
    readonly variant?: ButtonVariant;
    readonly tone?: ButtonTone;
    readonly size?: ControlSize;
    readonly xstyle?: ControlStyle;
  };

type IconButtonProps = Omit<ButtonProps, 'aria-label' | 'pendingLabel'> & { readonly 'aria-label': string };

type TextButtonProps = ComponentProps<typeof BaseButton> &
  PendingProps & { readonly tone?: ButtonTone; readonly xstyle?: PlacementStyle };

type TextLinkProps = ComponentProps<'a'> & { readonly xstyle?: PlacementStyle };
type ButtonLabelsProps = PendingProps & { readonly id: string; readonly children?: ReactNode };

const variants = {
  neutral: { solid: styles.solidNeutral, outline: styles.outlineNeutral, ghost: styles.ghostNeutral },
  danger: { solid: styles.solidDanger, outline: styles.outlineDanger, ghost: styles.ghostDanger },
} satisfies Record<ButtonTone, Record<ButtonVariant, stylex.StyleXStyles>>;

const sizes = { sm: styles.sm, md: styles.md } satisfies Record<ControlSize, stylex.StyleXStyles>;
const iconSizes = { sm: styles.iconSm, md: styles.iconMd } satisfies Record<ControlSize, stylex.StyleXStyles>;

const textTones = { neutral: styles.neutralText, danger: styles.dangerText } satisfies Record<
  ButtonTone,
  stylex.StyleXStyles
>;

function ButtonLabels({ id, children, pending = false, pendingLabel }: ButtonLabelsProps): ReactNode {
  if (pendingLabel === undefined) {
    return children;
  }

  return (
    <span id={id} {...stylex.props(styles.labels)}>
      <span aria-hidden={pending} {...stylex.props(styles.label, pending && styles.hidden)}>
        {children}
      </span>
      <span aria-hidden={!pending} {...stylex.props(styles.label, !pending && styles.hidden)}>
        {pendingLabel}
      </span>
    </span>
  );
}

export function Button({
  variant = 'outline',
  tone = 'neutral',
  size = 'sm',
  pending = false,
  pendingLabel,
  children,
  className,
  style,
  xstyle,
  disabled = false,
  ...props
}: ButtonProps): ReactNode {
  const labelId = useId();
  const appearance = stylex.props(styles.button, sizes[size], variants[tone][variant], xstyle);

  return (
    <BaseButton
      {...props}
      {...mergeStyles<BaseButton.State>({ className, style, styles: appearance })}
      disabled={disabled || pending}
      focusableWhenDisabled={pending || props.focusableWhenDisabled}
      aria-labelledby={
        props['aria-labelledby'] ??
        (props['aria-label'] === undefined && pendingLabel !== undefined ? labelId : undefined)
      }
      aria-busy={pending || props['aria-busy']}
    >
      <ButtonLabels id={labelId} pending={pending} pendingLabel={pendingLabel}>
        {children}
      </ButtonLabels>
    </BaseButton>
  );
}

export function IconButton({ size = 'sm', children, xstyle, ...props }: IconButtonProps): ReactNode {
  return (
    <Button {...props} size={size} xstyle={[iconSizes[size], xstyle]}>
      <span aria-hidden {...stylex.props(styles.icon)}>
        {children}
      </span>
    </Button>
  );
}

export function TextButton({
  tone = 'neutral',
  pending = false,
  pendingLabel,
  children,
  className,
  style,
  xstyle,
  disabled = false,
  ...props
}: TextButtonProps): ReactNode {
  const labelId = useId();
  const appearance = stylex.props(styles.text, textTones[tone], xstyle);

  return (
    <BaseButton
      {...props}
      {...mergeStyles<BaseButton.State>({ className, style, styles: appearance })}
      disabled={disabled || pending}
      focusableWhenDisabled={pending || props.focusableWhenDisabled}
      aria-labelledby={
        props['aria-labelledby'] ??
        (props['aria-label'] === undefined && pendingLabel !== undefined ? labelId : undefined)
      }
      aria-busy={pending || props['aria-busy']}
    >
      <ButtonLabels id={labelId} pending={pending} pendingLabel={pendingLabel}>
        {children}
      </ButtonLabels>
    </BaseButton>
  );
}

export function TextLink({ xstyle, ...props }: TextLinkProps): ReactNode {
  return <a {...mergeProps(stylex.props(styles.link, xstyle), props)} />;
}
