import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors, pageGeometry, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

export type SectionHeadingProps = {
  readonly title: ReactNode;
  readonly id?: string | undefined;
  readonly meta?: ReactNode;
  readonly actions?: ReactNode;
};

const styles = stylex.create({
  root: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: pageGeometry.toolbarHeight,
    minWidth: 0,
    boxSizing: 'border-box',
    paddingBlock: spacing.sm,
    paddingInline: pageGeometry.inset,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
    backgroundColor: colors.canvas,
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
  },
  title: {
    flex: '1 1 auto',
    minWidth: 0,
    margin: 0,
    overflowWrap: 'anywhere',
    fontSize: typography.inputSize,
    fontWeight: typography.mediumWeight,
    lineHeight: typography.bodyLineHeight,
  },
  trailing: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    marginInlineStart: 'auto',
    minWidth: 0,
    maxWidth: '100%',
  },
  meta: {
    minWidth: 0,
    marginInlineStart: 'auto',
    overflowWrap: 'anywhere',
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
  },
  actions: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, maxWidth: '100%' },
});

export function SectionHeading({ title, id, meta, actions }: SectionHeadingProps): ReactNode {
  const hasTrailing = meta !== undefined || actions !== undefined;
  const metadata = meta !== undefined && <div {...stylex.props(styles.meta)}>{meta}</div>;
  const controlActions = actions !== undefined && <div {...stylex.props(styles.actions)}>{actions}</div>;

  return (
    <div {...stylex.props(styles.root)}>
      <h2 id={id} {...stylex.props(styles.title)}>
        {title}
      </h2>
      {hasTrailing && (
        <div {...stylex.props(styles.trailing)}>
          {metadata}
          {controlActions}
        </div>
      )}
    </div>
  );
}
