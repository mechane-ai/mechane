import * as stylex from '@stylexjs/stylex';
import { mergeProps } from '@ui-sdk/react/primitive';
import { ResizablePanel, ResizableHandle as SdkHandle, Resizable as SdkResizable } from '@ui-sdk/react/resizable';
import type { ComponentProps, ReactNode } from 'react';
import { conditions } from '../../foundations/src/constants.stylex.ts';
import { colors, controls } from '../../foundations/src/tokens.stylex.ts';

const fineHandleSize = 12;
const fineHandleInset = (fineHandleSize - 1) / 2;
const fineHandleMargin = -fineHandleInset;

const styles = stylex.create({
  group: { minWidth: 0, minHeight: 0, width: '100%', height: '100%' },
  panel: { minWidth: 0, minHeight: 0, overflow: 'auto' },
  handle: {
    'position': 'relative',
    'zIndex': 1,
    'boxSizing': 'border-box',
    'backgroundColor': colors.line,
    'backgroundClip': 'content-box',
    'width': { default: fineHandleSize, [conditions.coarsePointer]: controls.coarseTarget },
    'paddingInline': {
      default: fineHandleInset,
      [conditions.coarsePointer]: `calc((${controls.coarseTarget} - 1px) / 2)`,
    },
    'marginInline': {
      default: fineHandleMargin,
      [conditions.coarsePointer]: `calc((1px - ${controls.coarseTarget}) / 2)`,
    },
    ':is([aria-orientation="horizontal"])': {
      width: '100%',
      paddingInline: 0,
      marginInline: 0,
      height: { default: fineHandleSize, [conditions.coarsePointer]: controls.coarseTarget },
      paddingBlock: {
        default: fineHandleInset,
        [conditions.coarsePointer]: `calc((${controls.coarseTarget} - 1px) / 2)`,
      },
      marginBlock: {
        default: fineHandleMargin,
        [conditions.coarsePointer]: `calc((1px - ${controls.coarseTarget}) / 2)`,
      },
    },
    ':is([data-dragging])': { backgroundColor: colors.focus },
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
  readonly initialSizes?: Array<number>;
  readonly onSizesChange?: (sizes: Array<number>) => void;
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
  disabled = false,
  ref,
  ...props
}: ResizableRootProps): ReactNode {
  return (
    <SdkResizable
      orientation={orientation}
      {...(initialSizes !== undefined && { defaultLayout: initialSizes })}
      onLayoutCommit={(sizes, { event }) => {
        if (event !== undefined) {
          onSizesChange?.(sizes);
        }
      }}
      disabled={disabled}
      ref={ref}
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
    <ResizablePanel
      id={id}
      {...(initialSizePercent !== undefined && { defaultSize: initialSizePercent })}
      minSize={minimumSizePercent}
      maxSize={maximumSizePercent}
      collapsible={canCollapse}
      ref={ref}
      {...mergeProps(stylex.props(styles.panel), props)}
    />
  );
}

function ResizableHandle({ ref, ...props }: ResizableHandleProps): ReactNode {
  return <SdkHandle ref={ref} {...mergeProps(stylex.props(styles.handle), props)} />;
}

export const Resizable = { Root: ResizableRoot, Pane: ResizablePane, Handle: ResizableHandle };
