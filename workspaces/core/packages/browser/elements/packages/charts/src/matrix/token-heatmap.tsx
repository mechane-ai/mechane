import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { colors, conditions, controls, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { ChartDataDisclosure, ChartDatumButton, ChartFrame, ChartReadout } from '../chart-frame.tsx';
import type { ChartSelection } from '../chart-frame.tsx';
import { ChartInputError, hasUniqueIds } from '../chart-input.tsx';
import { ColorLegend } from './color-legend.tsx';
import { heatmapColor, heatmapScaleProblem, isHeatmapValueInDomain } from './heatmap-scale.ts';
import type { HeatmapScale } from './heatmap-scale.ts';

export type HeatmapToken = {
  readonly id: string;
  readonly index: number;
  readonly text: string;
  readonly score: number | null;
};

export type TokenHeatmapProps = HeatmapScale & {
  readonly title: string;
  readonly description: string;
  readonly tokens: ReadonlyArray<HeatmapToken>;
  readonly valueLabel: string;
  readonly formatValue: (value: number) => string;
  readonly selection?: ChartSelection;
  readonly emptyLabel: string;
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
  footer: { display: 'grid', gap: spacing.md },
  empty: { margin: 0, color: colors.muted, fontSize: typography.bodySize, lineHeight: typography.bodyLineHeight },
});

export const MAX_HEATMAP_TOKENS = 2048;

export function TokenHeatmap({
  title,
  description,
  tokens,
  domain,
  palette,
  valueLabel,
  formatValue,
  selection,
  emptyLabel,
}: TokenHeatmapProps): ReactNode {
  const problem = tokenProblem({ tokens, domain, palette });

  if (problem !== null) {
    return <ChartInputError title={title} description={description} message={problem} />;
  }

  const selected = tokens.find((token) => token.id === selection?.selectedId);

  return (
    <ChartFrame
      title={title}
      description={description}
      footer={
        <div {...stylex.props(styles.footer)}>
          <ColorLegend label={valueLabel} domain={domain} palette={palette} formatValue={formatValue} />
          {selection !== undefined && tokens.length > 0 && (
            <ChartReadout>
              {selected === undefined
                ? 'Select a token to inspect its exact text and score.'
                : `Token ${selected.index}, ${JSON.stringify(selected.text)}, ${valueLabel}: ${tokenScoreText(selected, domain, formatValue)}`}
            </ChartReadout>
          )}
        </div>
      }
    >
      {tokens.length === 0 ? (
        <p {...stylex.props(styles.empty)}>{emptyLabel}</p>
      ) : (
        <p aria-label={`${title} token text`} {...stylex.props(styles.text)}>
          {tokens.map((token) => {
            const isOutsideDomain = token.score !== null && !isHeatmapValueInDomain(token.score, domain);

            const label = `Token ${token.index}, ${JSON.stringify(token.text)}, ${valueLabel}: ${tokenScoreText(token, domain, formatValue)}`;

            const appearance = stylex.props(
              styles.token,
              token.score === null || isOutsideDomain
                ? styles.missing
                : styles.color(heatmapColor(token.score, { domain, palette })),
              selection !== undefined && styles.interactive,
              selection?.selectedId === token.id && styles.selected,
            );

            return selection === undefined ? (
              <span key={token.id} title={label} {...appearance}>
                {token.text}
              </span>
            ) : (
              <button
                key={token.id}
                type="button"
                aria-label={label}
                aria-pressed={selection.selectedId === token.id}
                onClick={() => selection.onSelect(token.id)}
                {...appearance}
              >
                {token.text}
              </button>
            );
          })}
        </p>
      )}
      {tokens.length > 0 && (
        <ChartDataDisclosure label="Token values">
          <table {...stylex.props(styles.table)}>
            <thead>
              <tr>
                <th scope="col" {...stylex.props(styles.cell)}>
                  Index
                </th>
                <th scope="col" {...stylex.props(styles.cell)}>
                  Exact text
                </th>
                <th scope="col" {...stylex.props(styles.cell)}>
                  {valueLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => (
                <tr key={token.id}>
                  <td {...stylex.props(styles.cell, styles.index)}>
                    <ChartDatumButton
                      label={`Select token ${token.index}: ${JSON.stringify(token.text)}`}
                      selected={selection?.selectedId === token.id}
                      onSelect={selection === undefined ? undefined : () => selection.onSelect(token.id)}
                    >
                      {token.index}
                    </ChartDatumButton>
                  </td>
                  <td {...stylex.props(styles.cell, styles.literal)}>{JSON.stringify(token.text)}</td>
                  <td {...stylex.props(styles.cell)}>{tokenScoreText(token, domain, formatValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartDataDisclosure>
      )}
    </ChartFrame>
  );
}

function tokenScoreText(
  token: HeatmapToken,
  domain: HeatmapScale['domain'],
  formatValue: (value: number) => string,
): string {
  if (token.score === null) {
    return 'Unavailable';
  }

  return `${formatValue(token.score)}${isHeatmapValueInDomain(token.score, domain) ? '' : ' (outside domain)'}`;
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

  if (tokens.length > MAX_HEATMAP_TOKENS) {
    return `This token view exceeds the ${MAX_HEATMAP_TOKENS}-token render limit. Supply a smaller, labelled window.`;
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
