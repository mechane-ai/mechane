import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import type { PlacementStyle } from '../../foundations/src/style-composition.ts';
import { colors, pageGeometry, spacing } from '../../foundations/src/tokens.stylex.ts';

const styles = stylex.create({
  root: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, minWidth: 0 },
  separated: {
    paddingBlockStart: pageGeometry.inset,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: colors.line,
  },
});

type FormActionsAlignment = 'start' | 'end';

const alignments = stylex.create<Record<FormActionsAlignment, stylex.CSSProperties>>({
  start: { justifyContent: 'flex-start' },
  end: { justifyContent: 'flex-end' },
});

export type FormActionsProps = {
  readonly children: ReactNode;
  readonly align?: FormActionsAlignment;
  readonly separated?: boolean;
  readonly xstyle?: PlacementStyle;
};

export function FormActions({ children, align = 'end', separated = false, xstyle }: FormActionsProps): ReactNode {
  return <div {...stylex.props(styles.root, alignments[align], separated && styles.separated, xstyle)}>{children}</div>;
}
