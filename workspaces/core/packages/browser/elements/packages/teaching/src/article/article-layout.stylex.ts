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
  withoutContents: '@container article (max-width: 1119px)',
});

/**
 * How far from the top a sticky part of the article stops, and how much room a link target keeps above it. The essay
 * view raises it to the height of its compact contents bar where that bar shows.
 */
export const articleSticky = stylex.defineVars({ top: '0px' });

/** Marks a framed figure, so its strips and visual can follow a report frame inside it. */
export const framedFigure = stylex.defineMarker();
