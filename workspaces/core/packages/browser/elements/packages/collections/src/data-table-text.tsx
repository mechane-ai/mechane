import * as stylex from '@stylexjs/stylex';
import { Children } from 'react';
import type { ReactNode } from 'react';
import { SkeletonText } from '../../feedback/src/index.ts';
import { tableStyles as styles } from './data-table-styles.ts';

export type DataTableTextProps = {
  readonly children: string;
  readonly secondary?: string | undefined;
  readonly leading?: ReactNode;
  readonly trailing?: ReactNode;
};

export type DataTableTextPlaceholderProps = { readonly leading?: ReactNode; readonly isSecondary?: boolean };

function TextCellLayout({
  children,
  leading,
  isDecorative = false,
}: {
  readonly children: ReactNode;
  readonly leading?: ReactNode;
  readonly isDecorative?: boolean;
}): ReactNode {
  const hasLeading = Children.toArray(leading).length > 0;

  return (
    <span aria-hidden={isDecorative || undefined} inert={isDecorative || undefined} {...stylex.props(styles.textRow)}>
      {hasLeading && (
        <span aria-hidden {...stylex.props(styles.adornment)}>
          {leading}
        </span>
      )}
      <span {...stylex.props(styles.textColumn)}>{children}</span>
    </span>
  );
}

export function DataTableText({ children, secondary, leading, trailing }: DataTableTextProps): ReactNode {
  const hasTrailing = Children.toArray(trailing).length > 0;

  return (
    <TextCellLayout leading={leading}>
      <span {...stylex.props(styles.primaryRow)}>
        <span data-record-text title={children} {...stylex.props(styles.text, styles.primaryText, styles.truncated)}>
          {children}
        </span>
        {hasTrailing && <span {...stylex.props(styles.adornment)}>{trailing}</span>}
      </span>
      {secondary !== undefined && (
        <span title={secondary} {...stylex.props(styles.text, styles.truncated, styles.secondaryText)}>
          {secondary}
        </span>
      )}
    </TextCellLayout>
  );
}

export function DataTableTextPlaceholder({ leading, isSecondary = false }: DataTableTextPlaceholderProps): ReactNode {
  return (
    <TextCellLayout leading={leading} isDecorative>
      <span {...stylex.props(styles.text)}>
        <SkeletonText width="70%" />
      </span>
      {isSecondary && (
        <span {...stylex.props(styles.text, styles.secondaryText)}>
          <SkeletonText width="45%" />
        </span>
      )}
    </TextCellLayout>
  );
}
