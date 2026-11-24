import * as stylex from '@stylexjs/stylex';

/**
 * The geometry every article view shares. Essay text keeps a measure of about 68 characters. From `withMargin` the text
 * gains a margin column for asides and wide figures, and from `withContents` the contents list sits beside it.
 */
export const articleLayout = stylex.defineConsts({
  measure: '68ch',
  marginWidth: '216px',
  marginGap: '32px',
  marginSpan: '248px',
  contentsWidth: '184px',
  withMargin: '@container article (min-width: 880px)',
  withContents: '@container article (min-width: 1120px)',
  narrow: '@container article (max-width: 879px)',
});
