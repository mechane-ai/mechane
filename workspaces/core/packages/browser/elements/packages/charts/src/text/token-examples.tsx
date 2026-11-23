import * as stylex from '@stylexjs/stylex';
import type { SpatialRect } from '@ui-sdk/core';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { colors, controls, radii, shadows, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { ChartData } from '../chart-data.tsx';
import { ChartReadout } from '../chart-frame.tsx';
import { hasUniqueIds } from '../chart-input.ts';
import { useLinkedInspection } from '../chart-link.tsx';
import { chartStyles } from '../chart-theme.ts';
import { Chart, ChartMark, ChartPlot, inspectedLabel, plotLabel } from '../chart.tsx';
import { formatValue } from '../figure/figure-format.ts';
import type { ValueFormat } from '../figure/figure-format.ts';
import { FigureEmpty, FigureFrame, FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import { isOutsideScale, tokenScaleError, tokenShade } from './token-scale.ts';
import type { TokenScale } from './token-scale.ts';
import { quoteToken, TokenScaleLegend, TokenText } from './token-text.tsx';

/** One token of an example: its exact text and its value, or null where none was recorded. */
export type TokenExampleToken = { readonly text: string; readonly value: number | null };

/** One text example, such as a context that activates a feature, as its tokens in supplied order. */
export type TokenExample = {
  readonly id: string;
  /** A name for the example, such as its document and offset. Without one, the example is numbered. */
  readonly label?: string | undefined;
  readonly tokens: ReadonlyArray<TokenExampleToken>;
  /** The position of the token the application marks as the peak. It is outlined, and `context` centers on it. */
  readonly peakIndex?: number | undefined;
};

export type TokenExamplesProps = FigureProps &
  FigureSelectionProps &
  TokenScale & {
    /** The examples, in the order the application ranked them. Every example shares one color scale. */
    readonly examples: ReadonlyArray<TokenExample>;
    /** What a token's value measures: "Activation". */
    readonly valueLabel: string;
    readonly valueFormat: ValueFormat;
    /**
     * Shows only this many tokens on each side of each example's peak. The rest stay hidden behind an ellipsis that
     * says how many there are. Every example then needs a `peakIndex`.
     */
    readonly context?: number | undefined;
  };

/** The most examples, and tokens per example, that `TokenExamples` draws. */
export const tokenExampleLimits = { examples: 50, tokensPerExample: 256 } as const;

/** Rows lie this far apart for the arrow keys, so Left and Right stay within an example while it has tokens. */
const ROW_SPACING = 1000;

const styles = stylex.create({
  plot: { display: 'grid', minWidth: 0, outlineStyle: 'none' },
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(3.5em, max-content) minmax(0, 1fr)',
    columnGap: spacing.md,
    alignItems: 'baseline',
    paddingBlock: spacing.sm,
    paddingInline: spacing.sm,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
  },
  selectedRow: { backgroundColor: colors.canvas, boxShadow: shadows.selection },
  peak: {
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'end',
  },
  body: { display: 'grid', gap: spacing.xxs, minWidth: 0 },
  label: {
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    overflowWrap: 'anywhere',
  },
  line: {
    margin: 0,
    color: colors.ink,
    fontFamily: typography.monoFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.proseLineHeight,
  },
  token: {
    display: 'inline-block',
    maxWidth: '100%',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: radii.sm,
    cursor: 'default',
  },
  shade: (color: string) => ({ backgroundColor: color }),
  missing: { borderStyle: 'dotted', borderColor: colors.muted },
  peakToken: { borderColor: colors.ink },
  inspected: {
    outlineWidth: controls.focusWidth,
    outlineStyle: 'solid',
    outlineColor: { 'default': colors.focus, '@media (forced-colors: active)': 'Highlight' },
    outlineOffset: 1,
  },
  hidden: { color: colors.muted, fontFamily: typography.fontFamily, fontSize: typography.captionSize },
});

type ShownToken = {
  readonly id: string;
  readonly index: number;
  readonly text: string;
  readonly value: number | null;
  readonly isPeak: boolean;
};

type ShownExample = {
  readonly id: string;
  readonly name: string;
  readonly label: string | undefined;
  readonly peak: TokenExampleToken | undefined;
  readonly tokens: ReadonlyArray<ShownToken>;
  readonly hiddenBefore: number;
  readonly hiddenAfter: number;
};

function examplesInputError({
  examples,
  domain,
  palette,
  context,
}: Pick<TokenExamplesProps, 'examples' | 'domain' | 'palette' | 'context'>): string | undefined {
  const scaleError = tokenScaleError({ domain, palette });

  if (scaleError !== undefined) {
    return scaleError;
  }

  if (examples.length > tokenExampleLimits.examples) {
    return `This chart draws at most ${tokenExampleLimits.examples} examples. Supply the leading examples.`;
  }

  if (!hasUniqueIds(examples)) {
    return 'Examples must have unique identifiers.';
  }

  if (context !== undefined && (!Number.isSafeInteger(context) || context < 0)) {
    return 'The context must be a whole number of tokens, zero or more.';
  }

  for (const example of examples) {
    if (example.tokens.length > tokenExampleLimits.tokensPerExample) {
      return `Example ${example.id} has more than ${tokenExampleLimits.tokensPerExample} tokens. Supply a window around its peak.`;
    }

    const { peakIndex } = example;
    const hasPeak = peakIndex !== undefined;

    if (hasPeak) {
      const isPeakInside = Number.isSafeInteger(peakIndex) && peakIndex >= 0 && peakIndex < example.tokens.length;

      if (!isPeakInside) {
        return `Example ${example.id} names a peak index that is not one of its token positions.`;
      }
    }

    if (context !== undefined && !hasPeak) {
      return `Example ${example.id} has no peak index, so the chart cannot show context around it.`;
    }

    if (example.tokens.some((token) => token.value !== null && isOutsideScale(token.value, domain))) {
      return `Example ${example.id} has a value that is not finite or lies outside the color domain.`;
    }
  }

  return undefined;
}

function shownExample(example: TokenExample, position: number, context: number | undefined): ShownExample {
  const last = example.tokens.length - 1;
  const peakIndex = example.peakIndex;
  const isWindowed = context !== undefined && peakIndex !== undefined;
  const start = isWindowed ? Math.max(0, peakIndex - context) : 0;
  const end = isWindowed ? Math.min(last, peakIndex + context) : last;

  return {
    id: example.id,
    name: example.label ?? `Example ${position + 1}`,
    label: example.label,
    peak: peakIndex === undefined ? undefined : example.tokens[peakIndex],
    tokens: example.tokens
      .slice(start, end + 1)
      .map((token, offset) => ({
        id: `${example.id}:${start + offset}`,
        index: start + offset,
        text: token.text,
        value: token.value,
        isPeak: start + offset === peakIndex,
      })),
    hiddenBefore: start,
    hiddenAfter: last - end,
  };
}

/**
 * The text examples that most activate a feature, one per row, each token shaded by its value on one scale shared by
 * every example. Arrow keys step token by token, Up and Down move between examples, and the readout gives each token's
 * exact text, position and value. The peak token is outlined and its value starts the row, and the chart suits a
 * feature's top activations or any ranked set of contexts scored per token.
 */
export function TokenExamples(props: TokenExamplesProps): ReactNode {
  const { examples, valueLabel, valueFormat, domain, palette, context, selected, onSelectedChange, ...figure } = props;
  const { emptyLabel = 'No examples are available.', ...frame } = figure;
  const { locale, title } = frame;
  const readoutId = useId();
  const linked = useLinkedInspection();

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} />;
  }

  const inputError = examplesInputError({ examples, domain, palette, context });

  if (inputError !== undefined) {
    return <FigureInvalid {...frame} message={inputError} />;
  }

  const shown = examples.map((example, position) => shownExample(example, position, context));

  function valueText(value: number | null): string {
    return formatValue({ value, locale, format: valueFormat });
  }

  function countText(count: number): string {
    return formatValue({ value: count, locale, format: { maximumFractionDigits: 0 } });
  }

  const items = shown.flatMap((example) =>
    example.tokens.map((token) => ({
      id: token.id,
      label: `${example.name}, token ${token.index} ${quoteToken(token.text)}: ${valueLabel} ${valueText(token.value)}${token.isPeak ? ' (peak)' : ''}`,
    })),
  );

  const owners = new Map(shown.flatMap((example) => example.tokens.map((token) => [token.id, example.id] as const)));

  const places = new Map(
    shown.flatMap((example, row) =>
      example.tokens.map((token) => {
        const peakIndex = examples[row]?.peakIndex ?? 0;
        const left = token.index - peakIndex;

        return [token.id, { left, right: left + 1, top: row * ROW_SPACING, bottom: row * ROW_SPACING + 1 }] as const;
      }),
    ),
  );

  const selectedExample = shown.find((example) => example.id === selected);
  const anchor = selectedExample?.tokens.find((token) => token.isPeak) ?? selectedExample?.tokens[0];
  const hasMissing = shown.some((example) => example.tokens.some((token) => token.value === null));

  return (
    <Chart
      {...linked}
      items={items}
      place={(id): SpatialRect | undefined => places.get(id)}
      selected={anchor?.id ?? null}
      onSelect={
        onSelectedChange === undefined
          ? undefined
          : (id, details) => {
              const owner = owners.get(id);

              if (owner !== undefined) {
                onSelectedChange(owner, details);
              }
            }
      }
      render={(figureProps, { inspected, cursor }) => (
        <FigureFrame
          {...frame}
          figure={figureProps}
          scaleLegend={
            examples.length === 0 ? undefined : (
              <TokenScaleLegend
                label={valueLabel}
                domain={domain}
                palette={palette}
                locale={locale}
                format={valueFormat}
                hasMissing={hasMissing}
              />
            )
          }
          footer={
            examples.length === 0 ? undefined : (
              <ChartReadout id={readoutId}>{inspectedLabel(items, inspected)}</ChartReadout>
            )
          }
        >
          {examples.length === 0 ? (
            <FigureEmpty>{emptyLabel}</FigureEmpty>
          ) : (
            <>
              <ChartPlot
                role="group"
                aria-label={plotLabel({ title, marks: 'tokens', isSelectable: onSelectedChange !== undefined })}
                aria-describedby={readoutId}
                {...stylex.props(styles.plot, stylex.defaultMarker())}
              >
                {shown.map((example) => (
                  <div key={example.id} {...stylex.props(styles.row, example.id === selected && styles.selectedRow)}>
                    <span {...stylex.props(styles.peak)}>
                      {example.peak === undefined ? '' : valueText(example.peak.value)}
                    </span>
                    <div {...stylex.props(styles.body)}>
                      {example.label !== undefined && <span {...stylex.props(styles.label)}>{example.label}</span>}
                      <p {...stylex.props(styles.line)}>
                        {example.hiddenBefore > 0 && (
                          <span
                            {...stylex.props(styles.hidden)}
                          >{`… ${countText(example.hiddenBefore)} earlier tokens hidden … `}</span>
                        )}
                        {example.tokens.map((token) => (
                          <ChartMark
                            key={token.id}
                            value={token.id}
                            {...stylex.props(
                              styles.token,
                              token.value === null
                                ? styles.missing
                                : styles.shade(tokenShade(token.value, { domain, palette })),
                              token.isPeak && styles.peakToken,
                              inspected === token.id && styles.inspected,
                              cursor === token.id && chartStyles.cursor,
                            )}
                          >
                            <TokenText text={token.text} shouldWrap={false} />
                          </ChartMark>
                        ))}
                        {example.hiddenAfter > 0 && (
                          <span
                            {...stylex.props(styles.hidden)}
                          >{` … ${countText(example.hiddenAfter)} later tokens hidden …`}</span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </ChartPlot>
              <ChartData
                label={`${title} token values`}
                columns={[
                  { id: 'example', label: 'Example' },
                  { id: 'index', label: 'Index' },
                  { id: 'text', label: 'Exact text' },
                  { id: 'value', label: valueLabel },
                ]}
                rows={shown.flatMap((example) =>
                  example.tokens.map((token) => ({
                    id: token.id,
                    values: [example.name, String(token.index), quoteToken(token.text), valueText(token.value)],
                  })),
                )}
              />
            </>
          )}
        </FigureFrame>
      )}
    />
  );
}
