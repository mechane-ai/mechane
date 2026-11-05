import { mergeProps } from '@base-ui/react/merge-props';
import * as stylex from '@stylexjs/stylex';
import type { ComponentProps, ReactNode } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { colors, controls } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  group: { minWidth: 0, minHeight: 0, width: '100%', height: '100%' },
  panel: { minWidth: 0, minHeight: 0, overflow: 'auto' },
  handle: {
    'backgroundColor': colors.line,
    'width': 1,
    'minWidth': 1,
    ':is([aria-orientation="horizontal"])': { height: 1, minHeight: 1, width: '100%' },
    ':is([data-separator="active"])': { backgroundColor: colors.focus },
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: 1,
    },
  },
});

export type ResizableRootProps = {
  readonly orientation?: 'horizontal' | 'vertical';
  readonly initialSizes?: Readonly<Record<string, number>>;
  readonly onSizesChange?: (sizes: Readonly<Record<string, number>>) => void;
  readonly disabled?: boolean;
} & Omit<ComponentProps<'div'>, 'onChange' | 'defaultValue'>;

export type ResizablePaneProps = {
  readonly id: string;
  readonly initialSizePercent?: number;
  readonly minimumSizePercent?: number;
  readonly maximumSizePercent?: number;
  readonly canCollapse?: boolean;
} & Omit<ComponentProps<'div'>, 'id' | 'onResize'>;

export type ResizableHandleProps = { readonly 'aria-label': string; readonly 'disabled'?: boolean } & Omit<
  ComponentProps<'div'>,
  'children'
>;

function ResizableRoot({
  orientation = 'horizontal',
  initialSizes,
  onSizesChange,
  disabled,
  ref,
  ...props
}: ResizableRootProps): ReactNode {
  return (
    <Group
      orientation={orientation}
      defaultLayout={initialSizes}
      onLayoutChanged={(sizes, metadata) => {
        if (metadata.isUserInteraction) {
          onSizesChange?.(sizes);
        }
      }}
      disabled={disabled}
      elementRef={ref}
      resizeTargetMinimumSize={{ coarse: 44, fine: 12 }}
      {...mergeProps(stylex.props(styles.group), props)}
    />
  );
}

function ResizablePane({
  id,
  initialSizePercent,
  minimumSizePercent = 10,
  maximumSizePercent = 100,
  canCollapse = false,
  ref,
  ...props
}: ResizablePaneProps): ReactNode {
  return (
    <Panel
      id={id}
      defaultSize={initialSizePercent === undefined ? undefined : `${initialSizePercent}%`}
      minSize={`${minimumSizePercent}%`}
      maxSize={`${maximumSizePercent}%`}
      collapsible={canCollapse}
      elementRef={ref}
      {...mergeProps(stylex.props(styles.panel), props)}
    />
  );
}

function ResizableHandle({ ref, ...props }: ResizableHandleProps): ReactNode {
  return <Separator elementRef={ref} {...mergeProps(stylex.props(styles.handle), props)} />;
}

export const Resizable = { Root: ResizableRoot, Pane: ResizablePane, Handle: ResizableHandle };
