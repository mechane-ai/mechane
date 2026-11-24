import * as stylex from '@stylexjs/stylex';
import {
  TokenInput as SdkTokenInput,
  TokenInputEditor as SdkTokenInputEditor,
  TokenInputToken as SdkTokenInputToken,
  TokenInputTokenRemove as SdkTokenInputTokenRemove,
} from '@ui-sdk/react/token-input';
import type {
  TokenInputEditorProps as SdkEditorProps,
  TokenInputProps as SdkTokenInputProps,
  TokenInputEditorState,
  TokenInputTokenState,
} from '@ui-sdk/react/token-input';
import { X } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { conditions } from '../../foundations/src/constants.stylex.ts';
import type { ControlDensity } from '../../foundations/src/control-density.ts';
import { controlDensityStyles, controlStyles } from '../../foundations/src/control-styles.ts';
import { mergeStyles } from '../../foundations/src/style-composition.ts';
import type { PlacementStyle } from '../../foundations/src/style-composition.ts';
import { colors, controls, radii, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  editor: {
    'display': 'flex',
    'flexWrap': 'wrap',
    'alignItems': 'center',
    'gap': spacing.xs,
    'minHeight': controls.height,
    'paddingBlock': spacing.xs,
    'paddingInline': spacing.sm,
    'height': 'auto',
    'whiteSpace': 'pre-wrap',
    'wordBreak': 'break-word',
    'cursor': 'text',
    '::before': {
      content: { 'default': 'none', ':is([data-empty])': 'attr(data-placeholder)' },
      color: colors.faint,
      pointerEvents: 'none',
    },
  },
  token: {
    'display': 'inline-flex',
    'alignItems': 'center',
    'gap': spacing.xxs,
    'paddingBlock': spacing.xxs,
    'paddingInline': spacing.xs,
    'borderWidth': 1,
    'borderStyle': 'solid',
    'borderColor': colors.line,
    'borderRadius': radii.sm,
    'backgroundColor': colors.canvas,
    'color': colors.ink,
    'fontFamily': typography.monoFamily,
    'fontSize': typography.captionSize,
    'lineHeight': typography.captionLineHeight,
    'userSelect': 'none',
    ':is([data-selected])': { borderColor: colors.focus, backgroundColor: colors.accentSoft },
  },
  remove: {
    'display': 'inline-flex',
    'alignItems': 'center',
    'justifyContent': 'center',
    'padding': 0,
    'borderWidth': 0,
    'backgroundColor': 'transparent',
    'color': colors.muted,
    'cursor': 'pointer',
    ':hover': { color: { default: null, [conditions.hoverPointer]: colors.ink } },
  },
});

export type TokenInputRootProps = SdkTokenInputProps;

export type TokenInputEditorProps = Omit<ComponentProps<typeof SdkTokenInputEditor>, 'children'> &
  SdkEditorProps & { readonly density?: ControlDensity; readonly xstyle?: PlacementStyle };

export type TokenInputTokenProps = ComponentProps<typeof SdkTokenInputToken>;

export type TokenInputTokenRemoveProps = ComponentProps<typeof SdkTokenInputTokenRemove>;

function TokenInputRoot(props: TokenInputRootProps): ReactNode {
  return <SdkTokenInput {...props} />;
}

function TokenInputEditor({
  className,
  style,
  density = 'standard',
  xstyle,
  placeholder,
  ...props
}: TokenInputEditorProps): ReactNode {
  return (
    <SdkTokenInputEditor
      {...(placeholder !== undefined && { placeholder, 'data-placeholder': placeholder })}
      {...props}
      {...mergeStyles<TokenInputEditorState>({
        className,
        style,
        styles: stylex.props(controlStyles.field, controlDensityStyles[density], styles.editor, xstyle),
      })}
    />
  );
}

function TokenInputToken({ className, style, ...props }: TokenInputTokenProps): ReactNode {
  return (
    <SdkTokenInputToken
      {...props}
      {...mergeStyles<TokenInputTokenState>({ className, style, styles: stylex.props(styles.token) })}
    />
  );
}

function TokenInputTokenRemove({ className, style, children, ...props }: TokenInputTokenRemoveProps): ReactNode {
  return (
    <SdkTokenInputTokenRemove {...props} {...mergeStyles({ className, style, styles: stylex.props(styles.remove) })}>
      {children ?? <X size={12} aria-hidden="true" />}
    </SdkTokenInputTokenRemove>
  );
}

export const TokenInput = {
  Root: TokenInputRoot,
  Editor: TokenInputEditor,
  Token: TokenInputToken,
  TokenRemove: TokenInputTokenRemove,
};

export { defaultCodec, fromText, toLabel, toText } from '@ui-sdk/react/token-input';
export type { Token, TokenInputValue, TokenInputValueChangeDetails } from '@ui-sdk/react/token-input';
