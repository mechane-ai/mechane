import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { useArticle } from './article-context.ts';

const styles = stylex.create({
  inline: { whiteSpace: 'nowrap' },
  display: {
    display: 'block',
    marginBlock: spacing.lg,
    overflowX: 'auto',
    overflowY: 'hidden',
    textAlign: 'center',
    whiteSpace: 'normal',
  },
  source: { color: colors.ink, fontFamily: typography.monoFamily, fontSize: 'inherit' },
});

export type TeXProps = {
  /** The TeX source, such as `p_i = e^{z_i / T} / \sum_j e^{z_j / T}`. */
  readonly children: string;
  /** A block of its own, centred between paragraphs. Inline in the sentence by default. */
  readonly isDisplay?: boolean | undefined;
};

/**
 * Mathematics in TeX. The article's `math` function typesets it; without one the TeX source shows in the monospace
 * face. Assistive technology always reads the source, so the formula means the same with or without a typesetter.
 */
export function TeX({ children, isDisplay = false }: TeXProps): ReactNode {
  const typeset = useArticle()?.math;

  return (
    <span role="math" aria-label={children} {...stylex.props(isDisplay ? styles.display : styles.inline)}>
      <span aria-hidden>
        {typeset === undefined ? (
          <code {...stylex.props(styles.source)}>{children}</code>
        ) : (
          typeset(children, { isDisplay })
        )}
      </span>
    </span>
  );
}
