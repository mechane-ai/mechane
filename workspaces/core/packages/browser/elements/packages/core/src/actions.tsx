import { Button as BaseButton } from '@base-ui/react/button';
import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { conditions } from '../../foundations/src/constants.stylex.ts';
import { controlStyles } from '../../foundations/src/control-styles.ts';
import { mergeStyles } from '../../foundations/src/style-composition.ts';
import type { PlacementStyle } from '../../foundations/src/style-composition.ts';
import { colors, controls, typography } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  button: {
    'textDecorationLine': 'none',
    'cursor': 'pointer',
    ':is([data-disabled]):not([aria-busy="true"])': { opacity: controls.disabledOpacity, cursor: 'default' },
    ':is([aria-busy="true"])': { cursor: 'progress' },
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: 2,
    },
  },
  solidNeutral: {
    'backgroundColor': colors.ink,
    'borderColor': colors.ink,
    'color': colors.inverse,
    ':hover:not([data-disabled])': { backgroundColor: { [conditions.hoverPointer]: colors.inkHover } },
    ':active:not([data-disabled])': { backgroundColor: colors.inkHover },
  },
  outlineNeutral: {
    'backgroundColor': colors.canvas,
    'borderColor': colors.line,
    'color': colors.ink,
    ':hover:not([data-disabled])': { backgroundColor: { [conditions.hoverPointer]: colors.line } },
    ':active:not([data-disabled])': { backgroundColor: colors.line },
  },
  ghostNeutral: {
    'backgroundColor': 'transparent',
    'borderColor': 'transparent',
    'color': colors.ink,
    ':hover:not(:active, [data-disabled])': { backgroundColor: { [conditions.hoverPointer]: colors.canvas } },
    ':active:not([data-disabled])': { backgroundColor: colors.line },
  },
  solidDanger: {
    'backgroundColor': colors.danger,
    'borderColor': colors.danger,
    'color': colors.inverse,
    ':hover:not([data-disabled])': { backgroundColor: { [conditions.hoverPointer]: colors.dangerHover } },
    ':active:not([data-disabled])': { backgroundColor: colors.dangerHover },
  },
  outlineDanger: {
    'backgroundColor': colors.surface,
    'borderColor': colors.danger,
    'color': colors.danger,
    ':hover:not([data-disabled])': { backgroundColor: { [conditions.hoverPointer]: colors.dangerSoft } },
    ':active:not([data-disabled])': { backgroundColor: colors.dangerSoft },
  },
  ghostDanger: {
    'backgroundColor': 'transparent',
    'borderColor': 'transparent',
    'color': colors.danger,
    ':hover:not([data-disabled])': { backgroundColor: { [conditions.hoverPointer]: colors.dangerSoft } },
    ':active:not([data-disabled])': { backgroundColor: colors.dangerSoft },
  },
  labels: { display: 'inline-grid', minWidth: 0, maxWidth: '100%' },
  label: { gridArea: '1 / 1', minWidth: 0 },
  hidden: { visibility: 'hidden' },
  icon: { width: controls.iconSize, height: controls.iconSize, flexShrink: 0, display: 'inline-flex' },
  text: {
    'display': 'inline-block',
    'boxSizing': 'border-box',
    'minHeight': { default: controls.height, [conditions.coarsePointer]: controls.coarseTarget },
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
    'fontWeight': typography.regularWeight,
    'maxWidth': '100%',
    'overflow': 'hidden',
    'textOverflow': 'ellipsis',
    'verticalAlign': 'middle',
    'cursor': 'pointer',
    ':hover:not([data-disabled])': { textDecorationLine: { [conditions.hoverPointer]: 'underline' } },
    ':active:not([data-disabled])': { textDecorationLine: 'underline' },
    ':is([data-disabled]):not([aria-busy="true"])': { opacity: controls.disabledOpacity, cursor: 'default' },
    ':is([aria-busy="true"])': { cursor: 'progress' },
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: 2,
    },
  },
  neutralText: { 'color': colors.ink, ':active:not([data-disabled])': { color: colors.inkHover } },
  dangerText: { 'color': colors.danger, ':active:not([data-disabled])': { color: colors.dangerHover } },
  link: {
    'fontFamily': typography.fontFamily,
    'WebkitFontSmoothing': 'antialiased',
    'color': colors.ink,
    'textDecorationLine': 'none',
    ':hover': { textDecorationLine: { [conditions.hoverPointer]: 'underline' } },
    ':active': { color: colors.inkHover, textDecorationLine: 'underline' },
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
type PendingProps = { readonly isPending?: boolean; readonly pendingLabel?: string | undefined };

type ButtonProps = ComponentProps<typeof BaseButton> &
  PendingProps & { readonly variant?: ButtonVariant; readonly tone?: ButtonTone; readonly xstyle?: PlacementStyle };

type ActionButtonProps = ButtonProps & { readonly isIconOnly?: boolean };

type IconButtonProps = Omit<ButtonProps, 'aria-label' | 'pendingLabel'> & { readonly 'aria-label': string };

type IconLinkProps = Omit<useRender.ComponentProps<'a'>, 'aria-label'> & {
  readonly 'aria-label': string;
  readonly 'xstyle'?: PlacementStyle;
};

type TextButtonProps = ComponentProps<typeof BaseButton> &
  PendingProps & { readonly tone?: ButtonTone; readonly xstyle?: PlacementStyle };

type TextLinkProps = ComponentProps<'a'> & { readonly xstyle?: PlacementStyle };
type ButtonLabelsProps = PendingProps & { readonly id: string; readonly children?: ReactNode };

const variants = {
  neutral: { solid: styles.solidNeutral, outline: styles.outlineNeutral, ghost: styles.ghostNeutral },
  danger: { solid: styles.solidDanger, outline: styles.outlineDanger, ghost: styles.ghostDanger },
} satisfies Record<ButtonTone, Record<ButtonVariant, stylex.StyleXStyles>>;

const textTones = { neutral: styles.neutralText, danger: styles.dangerText } satisfies Record<
  ButtonTone,
  stylex.StyleXStyles
>;

function ButtonLabels({ id, children, isPending = false, pendingLabel }: ButtonLabelsProps): ReactNode {
  if (pendingLabel === undefined) {
    return children;
  }

  return (
    <span id={id} {...stylex.props(styles.labels)}>
      <span aria-hidden={isPending} {...stylex.props(styles.label, isPending && styles.hidden)}>
        {children}
      </span>
      <span aria-hidden={!isPending} {...stylex.props(styles.label, !isPending && styles.hidden)}>
        {pendingLabel}
      </span>
    </span>
  );
}

function ActionButton({
  variant = 'outline',
  tone = 'neutral',
  isIconOnly = false,
  isPending = false,
  pendingLabel,
  children,
  className,
  style,
  xstyle,
  disabled = false,
  ...props
}: ActionButtonProps): ReactNode {
  const labelId = useId();

  const appearance = stylex.props(
    controlStyles.base,
    controlStyles.button,
    styles.button,
    variants[tone][variant],
    isIconOnly && controlStyles.iconButton,
    xstyle,
  );

  return (
    <BaseButton
      {...props}
      {...mergeStyles<BaseButton.State>({ className, style, styles: appearance })}
      disabled={disabled || isPending}
      focusableWhenDisabled={isPending || props.focusableWhenDisabled}
      aria-labelledby={
        props['aria-labelledby'] ??
        (props['aria-label'] === undefined && pendingLabel !== undefined ? labelId : undefined)
      }
      aria-busy={isPending || props['aria-busy']}
    >
      <ButtonLabels id={labelId} isPending={isPending} pendingLabel={pendingLabel}>
        {children}
      </ButtonLabels>
    </BaseButton>
  );
}

export function Button(props: ButtonProps): ReactNode {
  return <ActionButton {...props} />;
}

export function IconButton({ children, ...props }: IconButtonProps): ReactNode {
  return (
    <ActionButton {...props} isIconOnly>
      <span aria-hidden {...stylex.props(styles.icon)}>
        {children}
      </span>
    </ActionButton>
  );
}

export function TextButton({
  tone = 'neutral',
  isPending = false,
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
      disabled={disabled || isPending}
      focusableWhenDisabled={isPending || props.focusableWhenDisabled}
      aria-labelledby={
        props['aria-labelledby'] ??
        (props['aria-label'] === undefined && pendingLabel !== undefined ? labelId : undefined)
      }
      aria-busy={isPending || props['aria-busy']}
    >
      <ButtonLabels id={labelId} isPending={isPending} pendingLabel={pendingLabel}>
        {children}
      </ButtonLabels>
    </BaseButton>
  );
}

export function TextLink({ xstyle, ...props }: TextLinkProps): ReactNode {
  return <a {...mergeProps(stylex.props(styles.link, xstyle), props)} />;
}

export function IconLink({ children, xstyle, render, ref, ...props }: IconLinkProps): ReactNode {
  return useRender({
    defaultTagName: 'a',
    render,
    ref,
    props: mergeProps(
      stylex.props(
        controlStyles.base,
        controlStyles.button,
        styles.button,
        styles.ghostNeutral,
        controlStyles.iconButton,
        xstyle,
      ),
      props,
      { children: <span {...stylex.props(styles.icon)}>{children}</span> },
    ),
  });
}
