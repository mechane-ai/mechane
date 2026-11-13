import * as stylex from '@stylexjs/stylex';
import { Children } from 'react';
import type { ReactNode } from 'react';
import { headerStyles } from '../../foundations/src/header-styles.ts';
import { colors, spacing, typography } from '../../foundations/src/tokens.stylex.ts';

export type SectionHeadingProps = {
  readonly title: ReactNode;
  readonly id?: string | undefined;
  readonly meta?: ReactNode;
  readonly actions?: ReactNode;
};

const styles = stylex.create({
  root: {
    gap: spacing.md,
    backgroundColor: colors.canvas,
    color: colors.ink,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
  },
});

export function SectionHeading({ title, id, meta, actions }: SectionHeadingProps): ReactNode {
  const hasMetadata = Children.toArray(meta).length > 0;
  const hasActions = Children.toArray(actions).length > 0;
  const hasTrailing = hasMetadata || hasActions;
  const metadata = hasMetadata && <div {...stylex.props(headerStyles.meta)}>{meta}</div>;
  const controlActions = hasActions && <div {...stylex.props(headerStyles.actions)}>{actions}</div>;

  return (
    <div {...stylex.props(headerStyles.row, headerStyles.blockEnd, styles.root)}>
      <h2 id={id} {...stylex.props(headerStyles.title)}>
        {title}
      </h2>
      {hasTrailing && (
        <div {...stylex.props(headerStyles.trailing)}>
          {metadata}
          {controlActions}
        </div>
      )}
    </div>
  );
}
