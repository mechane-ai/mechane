import { spacing } from '@mechane/ui-tokens/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
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
});

type DetailPageProps = { readonly children: ReactNode };

export function DetailPage({ children }: DetailPageProps): ReactNode {
  return <div {...stylex.props(styles.detail)}>{children}</div>;
}
