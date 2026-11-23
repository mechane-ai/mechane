import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { colors, radii, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { ChartData } from '../chart-data.tsx';
import { ChartReadout } from '../chart-frame.tsx';
import { hasUniqueIds } from '../chart-input.ts';
import { useLinkedInspection } from '../chart-link.tsx';
import { chartStyles } from '../chart-theme.ts';
import { Chart, inspectedLabel, plotLabel } from '../chart.tsx';
import { formatValue } from '../figure/figure-format.ts';
import type { ValueFormat } from '../figure/figure-format.ts';
import { FigureEmpty, FigureFrame, FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import { locateNearest } from '../plot/locate.ts';
import { linePath } from '../plot/path.ts';
import { plotBox } from '../plot/plot-layout.ts';
import { LinkMark } from '../plot/plot-marks.tsx';
import { PlotSurface, usePlotSize } from '../plot/plot-surface.tsx';
import { isFiniteDomain, outsideDomain } from '../plot/scale.ts';
import type { NumericDomain } from '../plot/scale.ts';
import { quoteToken, TokenScrollFrame, TokenText } from './token-text.tsx';

/** One token of the sequence, drawn in both rows. */
export type TokenLinkToken = { readonly id: string; readonly text: string };

/**
 * A supplied weight between two tokens, such as how much one token attends to another. The words match AttentionMatrix:
 * information moves from the source to the destination.
 */
export type TokenLink = {
  /** The token attended to: the one information is read from. Drawn in the top row. */
  readonly sourceId: string;
  /** The token that attends: the one that reads from the source. Drawn in the bottom row. */
  readonly destinationId: string;
  readonly weight: number;
};

export type TokenLinksProps = FigureProps &
  FigureSelectionProps & {
    /** The sequence in order. A token's position is its place in this list. */
    readonly tokens: ReadonlyArray<TokenLinkToken>;
    /** The links to draw. Only supplied links are drawn; nearness never implies one. */
    readonly links: ReadonlyArray<TokenLink>;
    /** What a link's weight measures: "Attention weight". */
    readonly weightLabel: string;
    readonly valueFormat: ValueFormat;
    /** The weights the line widths span. It starts at zero or above. */
    readonly domain: NumericDomain;
    /**
     * How to read a link: from its source, the token attended to, in the top row, down to its destination, the token
     * that attends, in the bottom row.
     */
    readonly direction: 'source-to-destination';
  };

/** The most tokens and links `TokenLinks` draws. */
export const tokenLinkLimits = { tokens: 128, links: 4096 } as const;

const ROW_HEIGHT = 28;
const LINK_HEIGHT = 120;
const SLOT_MIN = 32;
const SLOT_MAX = 96;
const CHARACTER_WIDTH = 7.5;
const SLOT_PADDING = 14;
const WIDTH_MIN = 0.5;
const WIDTH_RANGE = 3.5;
const OPACITY_MIN = 0.25;
const LISTED_MAX = 5;
const LEGEND_WIDTH = 36;
const LEGEND_HEIGHT = 12;
const LEGEND_STEPS = [0, 0.5, 1] as const;

const directionText: Readonly<Record<TokenLinksProps['direction'], string>> = {
  'source-to-destination':
    'Each line runs from a source token in the top row, the token attended to, down to the token that attends to it.',
};

const styles = stylex.create({
  measure: { minWidth: 0, contain: 'inline-size' },
  canvas: (width: number) => ({ width }),
  chip: (left: number, top: number, width: number) => ({ left, top, width }),
  slot: {
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    height: ROW_HEIGHT,
    paddingInline: spacing.xxs,
  },
  token: {
    maxWidth: '100%',
    overflow: 'hidden',
    paddingInline: spacing.xs,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    borderRadius: radii.sm,
    color: colors.ink,
    backgroundColor: colors.canvas,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
  },
  active: { borderColor: colors.ink, backgroundColor: colors.surface },
  strength: (opacity: number) => ({ opacity }),
  key: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.md,
    rowGap: spacing.xs,
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
  },
  sample: { display: 'inline-flex', alignItems: 'center', gap: spacing.xs, fontVariantNumeric: 'tabular-nums' },
  scale: {
    display: 'grid',
    gap: spacing.xs,
    minWidth: 0,
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
  },
});

function linksInputError({
  tokens,
  links,
  domain,
}: Pick<TokenLinksProps, 'tokens' | 'links' | 'domain'>): string | undefined {
  if (!isFiniteDomain(domain) || domain[0] < 0) {
    return 'The weight domain must hold two finite, increasing values, starting at zero or above.';
  }

  if (tokens.length > tokenLinkLimits.tokens || links.length > tokenLinkLimits.links) {
    return `This chart draws at most ${tokenLinkLimits.tokens} tokens and ${tokenLinkLimits.links} links. Supply a shorter window or the strongest links.`;
  }

  if (!hasUniqueIds(tokens)) {
    return 'Tokens must have unique identifiers.';
  }

  const ids = new Set(tokens.map((token) => token.id));
  const pairs = new Set(links.map((link) => JSON.stringify([link.sourceId, link.destinationId])));

  if (links.some((link) => !ids.has(link.sourceId) || !ids.has(link.destinationId))) {
    return 'A link names a token the chart does not list.';
  }

  if (pairs.size !== links.length) {
    return 'Each source and destination pair takes at most one link.';
  }

  if (links.some((link) => outsideDomain(link.weight, domain))) {
    return 'A link weight is not finite or lies outside the weight domain.';
  }

  return undefined;
}

/**
 * Which tokens attend to which: the sequence drawn twice, sources (attended to) above and destinations (attending)
 * below, joined by straight lines whose width and opacity follow the supplied weight. With nothing inspected every link
 * is drawn faintly; inspecting or selecting a token draws only its links, and the readout lists its strongest links
 * with exact weights. Long sequences scroll sideways inside the frame, because the two rows must stay aligned for the
 * lines to read.
 */
export function TokenLinks(props: TokenLinksProps): ReactNode {
  const { tokens, links, weightLabel, valueFormat, domain, direction, selected, onSelectedChange, ...figure } = props;
  const { emptyLabel = 'No tokens are available.', ...frame } = figure;
  const { locale, title } = frame;
  const size = usePlotSize();
  const readoutId = useId();
  const linked = useLinkedInspection();

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} />;
  }

  const inputError = linksInputError({ tokens, links, domain });

  if (inputError !== undefined) {
    return <FigureInvalid {...frame} message={inputError} />;
  }

  function weightText(weight: number): string {
    return formatValue({ value: weight, locale, format: valueFormat });
  }

  function strength(weight: number): number {
    return (weight - domain[0]) / (domain[1] - domain[0]);
  }

  const longest = Math.max(0, ...tokens.map((token) => Array.from(token.text).length));
  const natural = Math.min(SLOT_MAX, Math.max(SLOT_MIN, longest * CHARACTER_WIDTH + SLOT_PADDING));
  const slot = tokens.length > 0 ? Math.max(natural, size.width / tokens.length) : natural;
  const width = Math.max(1, slot * tokens.length);
  const height = ROW_HEIGHT * 2 + LINK_HEIGHT;
  const box = plotBox({ width, height, margins: { top: ROW_HEIGHT, right: 0, bottom: ROW_HEIGHT, left: 0 } });

  const placed = tokens.map((token, position) => ({
    ...token,
    position,
    left: position * slot,
    x: (position + 0.5) * slot,
  }));

  const byId = new Map(placed.map((token) => [token.id, token]));

  function listed(entries: ReadonlyArray<TokenLink>, end: 'sourceId' | 'destinationId'): string {
    if (entries.length === 0) {
      return 'none';
    }

    const strongest = entries
      .toSorted((first, second) => second.weight - first.weight)
      .slice(0, LISTED_MAX)
      .map((link) => {
        const other = byId.get(link[end]);

        return `${quoteToken(other?.text ?? '')} at ${other?.position ?? 0}, ${weightText(link.weight)}`;
      });

    const rest = entries.length - strongest.length;

    return `${strongest.join('; ')}${rest > 0 ? `; and ${rest} more` : ''}`;
  }

  const items = placed.map((token) => {
    const outgoing = links.filter((link) => link.sourceId === token.id);
    const incoming = links.filter((link) => link.destinationId === token.id);

    return {
      id: token.id,
      label: `${quoteToken(token.text)} at position ${token.position}. Attends to, by ${weightLabel}: ${listed(incoming, 'sourceId')}. Attended to by: ${listed(outgoing, 'destinationId')}.`,
    };
  });

  const marks = placed.map((token) => ({ id: token.id, x: token.x, y: 0 }));

  return (
    <Chart
      {...linked}
      items={items}
      locate={locateNearest({ marks, width: box.width, height: box.height, axis: 'x' })}
      selected={selected}
      onSelect={onSelectedChange}
      render={(figureProps, view) => {
        const active = view.inspected ?? view.selected;

        return (
          <FigureFrame
            {...frame}
            figure={figureProps}
            scaleLegend={
              tokens.length === 0 ? undefined : (
                <div {...stylex.props(styles.scale)}>
                  <span>{`${directionText[direction]} Width and opacity follow ${weightLabel}:`}</span>
                  <div {...stylex.props(styles.key)}>
                    {LEGEND_STEPS.map((step) => {
                      const weight = domain[0] + step * (domain[1] - domain[0]);

                      return (
                        <span key={step} {...stylex.props(styles.sample)}>
                          <svg aria-hidden width={LEGEND_WIDTH} height={LEGEND_HEIGHT}>
                            <g {...stylex.props(styles.strength(OPACITY_MIN + (1 - OPACITY_MIN) * step))}>
                              <LinkMark
                                d={linePath([
                                  { x: 0, y: LEGEND_HEIGHT / 2 },
                                  { x: LEGEND_WIDTH, y: LEGEND_HEIGHT / 2 },
                                ])}
                                tone="series1"
                                width={WIDTH_MIN + WIDTH_RANGE * step}
                              />
                            </g>
                          </svg>
                          {weightText(weight)}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )
            }
            footer={
              tokens.length === 0 ? undefined : (
                <ChartReadout id={readoutId}>{inspectedLabel(items, active)}</ChartReadout>
              )
            }
          >
            {tokens.length === 0 ? (
              <FigureEmpty>{emptyLabel}</FigureEmpty>
            ) : (
              <>
                <div ref={size.ref} {...stylex.props(styles.measure)}>
                  <TokenScrollFrame cursor={view.cursor}>
                    <div {...stylex.props(styles.canvas(width))}>
                      <PlotSurface
                        plotRef={null}
                        box={box}
                        label={plotLabel({ title, marks: 'tokens', isSelectable: onSelectedChange !== undefined })}
                        readoutId={readoutId}
                        overlay={placed.flatMap((token) =>
                          [0, box.bottom].map((top) => (
                            <span
                              key={`${token.id}-${top}`}
                              data-token-cursor={top === 0 && view.cursor === token.id ? '' : undefined}
                              {...stylex.props(
                                styles.slot,
                                styles.chip(token.left, top, slot),
                                top === 0 && view.cursor === token.id && chartStyles.cursor,
                              )}
                            >
                              <span {...stylex.props(styles.token, active === token.id && styles.active)}>
                                <TokenText text={token.text} shouldWrap={false} />
                              </span>
                            </span>
                          )),
                        )}
                      >
                        {links
                          .filter(
                            (link) => active === null || link.sourceId === active || link.destinationId === active,
                          )
                          .map((link) => {
                            const source = byId.get(link.sourceId);
                            const destination = byId.get(link.destinationId);
                            const share = strength(link.weight);

                            return source === undefined || destination === undefined ? null : (
                              <g
                                key={`${link.sourceId}\u0000${link.destinationId}`}
                                {...stylex.props(styles.strength(OPACITY_MIN + (1 - OPACITY_MIN) * share))}
                              >
                                <LinkMark
                                  d={linePath([
                                    { x: source.x, y: box.top },
                                    { x: destination.x, y: box.bottom },
                                  ])}
                                  tone="series1"
                                  width={WIDTH_MIN + WIDTH_RANGE * share}
                                  emphasis={active === null ? 'receded' : 'normal'}
                                />
                              </g>
                            );
                          })}
                      </PlotSurface>
                    </div>
                  </TokenScrollFrame>
                </div>
                <ChartData
                  label={`${title} links`}
                  columns={[
                    { id: 'source', label: 'Source' },
                    { id: 'destination', label: 'Destination' },
                    { id: 'weight', label: weightLabel },
                  ]}
                  rows={links.map((link) => {
                    const source = byId.get(link.sourceId);
                    const destination = byId.get(link.destinationId);

                    return {
                      id: `${link.sourceId}\u0000${link.destinationId}`,
                      values: [
                        `${quoteToken(source?.text ?? '')} at ${source?.position ?? 0}`,
                        `${quoteToken(destination?.text ?? '')} at ${destination?.position ?? 0}`,
                        weightText(link.weight),
                      ],
                    };
                  })}
                />
              </>
            )}
          </FigureFrame>
        );
      }}
    />
  );
}
