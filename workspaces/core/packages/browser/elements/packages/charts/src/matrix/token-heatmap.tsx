import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { conditions } from '../../../foundations/src/constants.stylex.ts';
import { colors, controls, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { ChartData } from '../chart-data.tsx';
import { ChartFrame, ChartReadout } from '../chart-frame.tsx';
import type { ChartReport, ChartSelection } from '../chart-frame.tsx';
import { ChartInputError, hasUniqueIds } from '../chart-input.tsx';
import { useChartNavigation } from '../chart-navigation.tsx';
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
  readonly report?: ChartReport | undefined;
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
  report,
  description,
  tokens,
  domain,
  palette,
  valueLabel,
  formatValue,
  selection,
  emptyLabel,
}: TokenHeatmapProps): ReactNode {
  const items = tokens.map((token) => ({
    id: token.id,
    label: `Token ${token.index}, ${JSON.stringify(token.text)}, ${valueLabel}: ${tokenScoreText(token, domain, formatValue)}`,
  }));

  const navigation = useChartNavigation({ title, items, selection });
  const problem = tokenProblem({ tokens, domain, palette });

  if (problem !== null) {
    return <ChartInputError title={title} report={report} description={description} message={problem} />;
  }

  return (
    <ChartFrame
      title={title}
      report={report}
      description={description}
      footer={
        <div {...stylex.props(styles.footer)}>
          <ColorLegend label={valueLabel} domain={domain} palette={palette} formatValue={formatValue} />
          <ChartReadout id={navigation.id}>{navigation.label ?? '\u00A0'}</ChartReadout>
        </div>
      }
    >
      {tokens.length === 0 ? (
        <p {...stylex.props(styles.empty)}>{emptyLabel}</p>
      ) : (
        <p {...navigation.props} {...stylex.props(styles.text)}>
          {tokens.map((token) => {
            const isInspected = navigation.label !== undefined && navigation.activeId === token.id;

            const isOutsideDomain = token.score !== null && !isHeatmapValueInDomain(token.score, domain);

            const label = `Token ${token.index}, ${JSON.stringify(token.text)}, ${valueLabel}: ${tokenScoreText(token, domain, formatValue)}`;

            const appearance = stylex.props(
              styles.token,
              token.score === null || isOutsideDomain
                ? styles.missing
                : styles.color(heatmapColor(token.score, { domain, palette })),
              selection !== undefined && styles.interactive,
              (selection?.selectedId === token.id || isInspected) && styles.selected,
            );

            return selection === undefined ? (
              <span key={token.id} title={label} onPointerEnter={() => navigation.inspect(token.id)} {...appearance}>
                {token.text}
              </span>
            ) : (
              <button
                key={token.id}
                type="button"
                tabIndex={-1}
                onPointerEnter={() => navigation.inspect(token.id)}
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
      <ChartData
        label={`${title} token values`}
        columns={[
          { id: 'index', label: 'Index' },
          { id: 'text', label: 'Exact text' },
          { id: 'value', label: valueLabel },
        ]}
        rows={tokens.map((token) => ({
          id: token.id,
          values: [String(token.index), JSON.stringify(token.text), tokenScoreText(token, domain, formatValue)],
        }))}
      />
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
