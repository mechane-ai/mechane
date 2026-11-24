import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors, controls, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import { useScrollTabIndex } from '../../foundations/src/use-scroll-tab-index.ts';
import { frameConditions } from './frame.stylex.ts';
import { Resizable } from './resizable.tsx';

const styles = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh',
    maxHeight: '100%',
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    containerType: 'inline-size',
    containerName: 'workbench',
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    fontWeight: typography.regularWeight,
    WebkitFontSmoothing: 'antialiased',
  },
  header: {
    minWidth: 0,
    flexShrink: 0,
    paddingBlock: spacing.lg,
    paddingInline: spacing.xl,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
  },
  body: { display: 'flex', flex: 1, minWidth: 0, minHeight: 0, overflow: 'clip' },
  main: { position: 'relative', display: 'flex', flex: 1, flexDirection: 'column', minWidth: 0, minHeight: 0 },
  scroll: {
    'overflowY': 'auto',
    'overscrollBehaviorY': 'contain',
    'flex': 1,
    'minWidth': 0,
    'minHeight': 0,
    'padding': spacing.xl,
    'outlineStyle': 'none',
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: -2,
    },
  },
  flush: { padding: 0 },
  footer: {
    flexShrink: 0,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
  },
  aside: {
    boxSizing: 'border-box',
    width: { default: '440px', [frameConditions.workbenchCompact]: '100%' },
    minWidth: 0,
    flexShrink: 0,
    overflowY: 'auto',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderLeftWidth: { default: 1, [frameConditions.workbenchCompact]: 0 },
    borderLeftStyle: 'solid',
    borderLeftColor: colors.line,
  },
  asideResizable: {
    boxSizing: 'border-box',
    width: '100%',
    height: '100%',
    minWidth: 0,
    overflowY: 'auto',
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  desktopSplit: {
    display: { default: 'flex', [frameConditions.workbenchCompact]: 'none' },
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  compactSplit: {
    display: { default: 'none', [frameConditions.workbenchCompact]: 'flex' },
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  obscured: { display: { default: 'flex', [frameConditions.workbenchCompact]: 'none' } },
});

export function Workbench({
  header,
  children,
  inspector,
  isResizable = false,
  inspectorInitialPercent = 36,
}: {
  readonly header?: ReactNode;
  readonly children: ReactNode;
  readonly inspector?: { readonly label: string; readonly content: ReactNode } | undefined;
  /** Lets desktop readers drag the divider between the main column and the inspector pane. */
  readonly isResizable?: boolean;
  readonly inspectorInitialPercent?: number;
}): ReactNode {
  const showResizable = isResizable && inspector !== undefined;
  const mainPercent = Math.max(30, Math.min(80, 100 - inspectorInitialPercent));

  return (
    <div {...stylex.props(styles.root)}>
      {header !== undefined && header !== null && <div {...stylex.props(styles.header)}>{header}</div>}
      <div {...stylex.props(styles.body)}>
        {showResizable ? (
          <>
            <div {...stylex.props(styles.desktopSplit)}>
              <Resizable.Root orientation="horizontal" initialSizes={[mainPercent, 100 - mainPercent]}>
                <Resizable.Pane id="workbench-main" initialSizePercent={mainPercent} minimumSizePercent={30}>
                  <div {...stylex.props(styles.main)}>{children}</div>
                </Resizable.Pane>
                <Resizable.Handle aria-label={`Resize ${inspector.label}`} />
                <Resizable.Pane
                  id="workbench-inspector"
                  initialSizePercent={100 - mainPercent}
                  minimumSizePercent={20}
                  maximumSizePercent={70}
                >
                  <aside aria-label={inspector.label} {...stylex.props(styles.asideResizable)}>
                    {inspector.content}
                  </aside>
                </Resizable.Pane>
              </Resizable.Root>
            </div>
            <div {...stylex.props(styles.compactSplit)}>
              <aside aria-label={inspector.label} {...stylex.props(styles.aside)}>
                {inspector.content}
              </aside>
            </div>
          </>
        ) : (
          <>
            <div {...stylex.props(styles.main, inspector !== undefined && styles.obscured)}>{children}</div>
            {inspector !== undefined && (
              <aside aria-label={inspector.label} {...stylex.props(styles.aside)}>
                {inspector.content}
              </aside>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function WorkbenchScroll({
  label,
  children,
  isFlush = false,
  scrollRestorationId,
}: {
  readonly label: string;
  readonly children: ReactNode;
  readonly isFlush?: boolean;
  readonly scrollRestorationId?: string;
}): ReactNode {
  const scroll = useScrollTabIndex<HTMLDivElement>();

  return (
    <div
      ref={scroll.ref}
      role="region"
      aria-label={label}
      tabIndex={scroll.tabIndex}
      data-scroll-restoration-id={scrollRestorationId}
      {...stylex.props(styles.scroll, isFlush && styles.flush)}
    >
      {children}
    </div>
  );
}

export function WorkbenchFooter({ children }: { readonly children: ReactNode }): ReactNode {
  return <div {...stylex.props(styles.footer)}>{children}</div>;
}
