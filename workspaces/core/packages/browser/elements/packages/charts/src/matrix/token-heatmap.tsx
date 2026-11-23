import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { conditions } from '../../../foundations/src/constants.stylex.ts';
import { colors, controls, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { ChartData } from '../chart-data.tsx';
import { ChartReadout } from '../chart-frame.tsx';
import { hasUniqueIds } from '../chart-input.ts';
import { useLinkedInspection } from '../chart-link.tsx';
import { chartStyles } from '../chart-theme.ts';
import { Chart, ChartMark, ChartTextPlot, inspectedLabel, plotLabel } from '../chart.tsx';
import { formatValue } from '../figure/figure-format.ts';
import type { ValueFormat } from '../figure/figure-format.ts';
import { FigureEmpty, FigureFrame, FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import { ColorLegend } from './color-legend.tsx';
import { heatmapColor, heatmapScaleProblem, isHeatmapValueInDomain } from './heatmap-scale.ts';
import type { HeatmapScale } from './heatmap-scale.ts';

/** One token of a supplied text window, with its index in the full sequence and its score. */
export type HeatmapToken = {
  readonly id: string;
  readonly index: number;
  readonly text: string;
  /** The score, or null where none was computed. Null draws a dotted underline, never zero. */
  readonly score: number | null;
};

export type TokenHeatmapProps = FigureProps &
  FigureSelectionProps &
  HeatmapScale & {
    readonly tokens: ReadonlyArray<HeatmapToken>;
    /** What the score measures, with its unit. */
    readonly valueLabel: string;
    readonly valueFormat: ValueFormat;
  };

const styles = stylex.create({
  text: {
    margin: 0,
    color: colors.ink,
    fontFamily: typography.monoFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  },
  token: {
    display: 'inline',
    padding: 0,
    borderWidth: 0,
    borderBottomWidth: 3,
    borderBottomStyle: 'solid',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    fontWeight: 'inherit',
    lineHeight: 'inherit',
    color: colors.ink,
    backgroundColor: colors.surface,
    whiteSpace: 'inherit',
    boxDecorationBreak: 'clone',
  },
  color: (color: string) => ({ borderBottomColor: color }),
  missing: { borderBottomStyle: 'dotted', borderBottomColor: colors.muted },
  interactive: {
    'cursor': 'pointer',
    'outlineStyle': 'none',
    'lineHeight': { default: typography.bodyLineHeight, [conditions.coarsePointer]: controls.coarseTarget },
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineColor: colors.focus,
      outlineStyle: 'solid',
      outlineOffset: 1,
    },
    ':hover': { backgroundColor: { [conditions.hoverPointer]: colors.canvas } },
    ':active': { backgroundColor: colors.line },
  },
  selected: { outlineWidth: controls.focusWidth, outlineColor: colors.focus, outlineStyle: 'solid', outlineOffset: 1 },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'start',
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
  },
  cell: {
    paddingBlock: spacing.xs,
    paddingInline: spacing.sm,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
    textAlign: 'start',
    fontWeight: typography.regularWeight,
  },
  literal: { fontFamily: typography.monoFamily, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' },
  index: { minWidth: controls.coarseTarget },
});

/** The render limit. A longer window shows an explicit error; the application supplies a labelled window. */
export const tokenHeatmapLimits = { tokens: 2048 } as const;

/**
 * A text window with each token's score as a colored underline: attributions, surprisal, probe outputs. The text stays
 * exact, whitespace included, and each token keeps its supplied index. Scores come from the application.
 */
export function TokenHeatmap(props: TokenHeatmapProps): ReactNode {
  const { tokens, domain, palette, valueLabel, valueFormat, selected, onSelectedChange, ...figure } = props;
  const { emptyLabel = 'No tokens were supplied.', ...frame } = figure;
  const { locale, title } = frame;

  function scoreText(token: HeatmapToken): string {
    return tokenScoreText({ token, domain, locale, format: valueFormat });
  }

  const items = tokens.map((token) => ({
    id: token.id,
    label: `Token ${token.index}, ${JSON.stringify(token.text)}, ${valueLabel}: ${scoreText(token)}`,
  }));

  const readoutId = useId();
  const link = useLinkedInspection();

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height="compact" />;
  }

  const problem = tokenProblem({ tokens, domain, palette });

  if (problem !== null) {
    return <FigureInvalid {...frame} message={problem} />;
  }

  return (
    <Chart
      {...link}
      items={items}
      arrows="both"
      selected={selected ?? null}
      onSelect={onSelectedChange}
      render={(figureProps, { inspected, cursor }) => (
        <FigureFrame
          {...frame}
          figure={figureProps}
          scaleLegend={
            <ColorLegend
              label={valueLabel}
              domain={domain}
              palette={palette}
              valueFormat={valueFormat}
              locale={locale}
            />
          }
          footer={<ChartReadout id={readoutId}>{inspectedLabel(items, inspected)}</ChartReadout>}
        >
          {tokens.length === 0 ? (
            <FigureEmpty>{emptyLabel}</FigureEmpty>
          ) : (
            <ChartTextPlot
              role="group"
              aria-label={plotLabel({ title, isSelectable: onSelectedChange !== undefined })}
              aria-describedby={readoutId}
              {...stylex.props(styles.text, stylex.defaultMarker())}
            >
              {tokens.map((token, index) => {
                const isSelected = selected === token.id;
                const isMarked = isSelected || inspected === token.id;
                const isOutsideDomain = token.score !== null && !isHeatmapValueInDomain(token.score, domain);
                const label = items[index]?.label;

                return (
                  <ChartMark
                    key={token.id}
                    value={token.id}
                    render={
                      onSelectedChange === undefined ? (
                        <span />
                      ) : (
                        <button type="button" tabIndex={-1} aria-label={label} aria-pressed={isSelected} />
                      )
                    }
                    title={onSelectedChange === undefined ? label : undefined}
                    {...stylex.props(
                      styles.token,
                      token.score === null || isOutsideDomain
                        ? styles.missing
                        : styles.color(heatmapColor(token.score, { domain, palette })),
                      onSelectedChange !== undefined && styles.interactive,
                      isMarked && styles.selected,
                      !isMarked && cursor === token.id && chartStyles.cursor,
                    )}
                  >
                    {token.text}
                  </ChartMark>
                );
              })}
            </ChartTextPlot>
          )}
          <ChartData
            label={`${title} token values`}
            columns={[
              { id: 'index', label: 'Index' },
              { id: 'text', label: 'Exact text' },
              { id: 'value', label: valueLabel },
            ]}
            rows={tokens.map((token) => ({
              id: token.id,
              values: [String(token.index), JSON.stringify(token.text), scoreText(token)],
            }))}
          />
        </FigureFrame>
      )}
    />
  );
}

function tokenScoreText({
  token,
  domain,
  locale,
  format,
}: Pick<HeatmapScale, 'domain'> & {
  readonly token: HeatmapToken;
  readonly locale: string;
  readonly format: ValueFormat;
}): string {
  const text = formatValue({ value: token.score, locale, format });

  return token.score === null || isHeatmapValueInDomain(token.score, domain) ? text : `${text} (outside domain)`;
}

function tokenProblem({
  tokens,
  domain,
  palette,
}: Pick<TokenHeatmapProps, 'tokens' | 'domain' | 'palette'>): string | null {
  const scaleProblem = heatmapScaleProblem({ domain, palette });

  if (scaleProblem !== null) {
    return scaleProblem;
  }

  if (tokens.length > tokenHeatmapLimits.tokens) {
    return `This token view exceeds the ${tokenHeatmapLimits.tokens}-token render limit. Supply a smaller, labelled window.`;
  }

  if (!hasUniqueIds(tokens) || new Set(tokens.map((token) => token.index)).size !== tokens.length) {
    return 'Tokens must have unique identifiers and supplied indices.';
  }

  if (
    tokens.some((token) => {
      const hasInvalidIndex = !Number.isSafeInteger(token.index) || token.index < 0;
      const hasInvalidScore = token.score !== null && !Number.isFinite(token.score);

      return hasInvalidIndex || hasInvalidScore;
    })
  ) {
    return 'Token indices must be nonnegative integers and measured scores must be finite. Use null for unavailable scores.';
  }

  return null;
}
