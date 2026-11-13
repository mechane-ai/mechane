import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { spacing } from '../../foundations/src/tokens.stylex.ts';
import { frame, frameConditions } from './frame.stylex.ts';

const styles = stylex.create({
  detail: {
    boxSizing: 'border-box',
    width: { default: frame.detailWidth, [frameConditions.detailMobile]: '100%' },
    maxWidth: frame.detailMaxWidth,
    minWidth: 0,
    marginInline: 'auto',
    paddingInline: { default: 0, [frameConditions.detailMobile]: spacing.xl },
    paddingTop: { default: frame.detailTop, [frameConditions.detailMobile]: frame.detailMobileTop },
    paddingBottom: { default: frame.detailBottom, [frameConditions.detailMobile]: frame.detailMobileBottom },
  },
  wide: { width: '100%', maxWidth: 'none', paddingInline: 0, paddingTop: 0, paddingBottom: 0 },
});

type DetailPageProps = { readonly children: ReactNode; readonly isWide?: boolean };

export function DetailPage({ children, isWide = false }: DetailPageProps): ReactNode {
  return <div {...stylex.props(styles.detail, isWide && styles.wide)}>{children}</div>;
}
