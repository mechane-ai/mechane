import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { chartToneColors, formatValue } from '../../../../charts/src/index.ts';
import type { ChartTone, ValueFormat } from '../../../../charts/src/index.ts';
import { ChartMark } from '../../../../charts/src/plot/index.ts';
import type { MarkEmphasis } from '../../../../charts/src/plot/index.ts';
import { quoteToken, TokenText } from '../../../../charts/src/text/index.ts';
import { colors, radii, typography } from '../../../../foundations/src/tokens.stylex.ts';
import { useSceneContext, useSceneObject } from '../scene-context.ts';
import type { SceneOffset, ScenePosition } from '../scene-geometry.ts';
import { SceneOutside } from '../scene-layer.tsx';
import { sceneOutlines } from '../scene-style.ts';
import { fillLabel } from '../scene-validate.ts';
import { tokenBox } from './token-layout.ts';

/** The words a token speaks. `{token}` is the quoted text, `{probability}` and `{id}` the numbers under it. */
export type SceneTokenLabels = {
  readonly plain: string;
  readonly withProbability: string;
  readonly withId: string;
  readonly withBoth: string;
};

/** The plain English words of a token. */
export const sceneTokenLabels = {
  plain: '{token}',
  withProbability: '{token}, probability {probability}',
  withId: '{token}, token id {id}',
  withBoth: '{token}, token id {id}, probability {probability}',
} as const satisfies SceneTokenLabels;

export type SceneTokenProps = {
  /** Stable across states: the token with this id moves to its new props. */
  readonly id: string;
  /** The token's center in data units. */
  readonly at: ScenePosition;
  /** A shift from `at` in pixels. `SceneTokens` uses it to lay a sequence out. */
  readonly offset?: SceneOffset | undefined;
  /** The token's exact text. Spaces, tabs and newlines show faint marks, as in the text charts. */
  readonly text: string;
  /** The vocabulary id, written under the text. */
  readonly tokenId?: number | string | undefined;
  /** A probability from 0 to 1, written under the text with a bar along the bottom. It eases when it changes. */
  readonly probability?: number | undefined;
  /** How the probability is written. Defaults to a percent with one decimal. */
  readonly format?: ValueFormat | undefined;
  /** The hue of the outline and the bar. Left out, a plain outline and a series bar. */
  readonly tone?: ChartTone | undefined;
  /** The readout sentence. Left out, the quoted text with its id and probability. */
  readonly label?: string | undefined;
  /** `context` draws the token plain; the others yield to inspection. */
  readonly emphasis?: MarkEmphasis | undefined;
  /** False fades the token out and takes it out of the keyboard order. */
  readonly isShown?: boolean | undefined;
  /** True keeps the token at full strength while the rest recede. */
  readonly isActive?: boolean | undefined;
  /**
   * True draws the token without making room for it in the scene's layout. `SceneTokens` sets it, because the sequence
   * makes room for all its tokens at once.
   */
  readonly isFloating?: boolean | undefined;
  readonly labels?: Partial<SceneTokenLabels> | undefined;
};

/** How a token writes its probability unless told otherwise. */
export const tokenPercent: ValueFormat = { style: 'percent', maximumFractionDigits: 1 };

/** The caption under a token's text keeps to the caption size on a line tight enough for two lines in the box. */
const CAPTION_LINE = '16px';

const styles = stylex.create({
  token: {
    position: 'absolute',
    left: 0,
    top: 0,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: radii.sm,
    backgroundColor: colors.canvas,
    color: colors.ink,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    pointerEvents: 'auto',
    outlineStyle: 'none',
  },
  place: (transform: string, opacity: number) => ({ transform, opacity }),
  box: (width: number, height: number) => ({ width, height }),
  outline: (color: string) => ({ borderColor: color }),
  gone: { visibility: 'hidden', pointerEvents: 'none' },
  text: { maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  caption: {
    color: colors.muted,
    fontFamily: typography.monoFamily,
    fontSize: typography.captionSize,
    lineHeight: CAPTION_LINE,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  bar: (color: string, share: number) => ({
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: 3,
    width: `${share * 100}%`,
    backgroundColor: color,
  }),
});

/** The text under a token, from its id and the probability as written. */
export function tokenCaption({
  tokenId,
  probability,
}: {
  readonly tokenId: number | string | undefined;
  readonly probability: string | undefined;
}): string | undefined {
  const parts = [tokenId === undefined ? undefined : String(tokenId), probability].filter((part) => part !== undefined);

  return parts.length === 0 ? undefined : parts.join(' · ');
}

/**
 * One token of text in the monospace face, with its vocabulary id or a probability under it, in the style of the text
 * charts. Give it a position and it eases there; give it a new probability and its bar and number count to it. Its box
 * is sized from its character count, never measured.
 */
export function SceneToken({
  id,
  at,
  offset,
  text,
  tokenId,
  probability,
  format = tokenPercent,
  tone,
  label,
  emphasis,
  isShown = true,
  isActive = false,
  isFloating,
  labels: labelInput,
}: SceneTokenProps): ReactNode {
  const labels = { ...sceneTokenLabels, ...labelInput };
  const { locale } = useSceneContext();

  function written(value: number): string {
    return formatValue({ value, locale, format });
  }

  const box = tokenBox({
    text,
    caption: tokenCaption({ tokenId, probability: probability === undefined ? undefined : written(probability) }),
  });

  const hasId = tokenId !== undefined;
  const hasProbability = probability !== undefined;

  const template =
    [labels.plain, labels.withId, labels.withProbability, labels.withBoth][
      Number(hasId) + 2 * Number(hasProbability)
    ] ?? labels.plain;

  const spoken =
    label ??
    fillLabel(template, {
      token: quoteToken(text),
      id: String(tokenId ?? ''),
      probability: probability === undefined ? '' : written(probability),
    });

  const object = useSceneObject({
    id,
    kind: 'token',
    frame: { x: at[0], y: at[1], offset, width: box.width, height: box.height },
    isFloating,
    values: { probability: probability ?? 0 },
    label: spoken,
    isShown,
    isActive,
    emphasis,
  });

  if (!object.scene.isInScene) {
    return <SceneOutside part="SceneToken" />;
  }

  const { rect = { left: 0, top: 0, right: 0, bottom: 0 }, values } = object;
  const eased = probability === undefined ? undefined : written(values.probability);
  const caption = tokenCaption({ tokenId, probability: eased });
  const color = tone === undefined ? colors.line : chartToneColors[tone];

  return (
    <ChartMark
      value={id}
      render={<div role="img" aria-label={spoken} data-scene-token={id} inert={!isShown} />}
      {...stylex.props(
        styles.token,
        styles.place(
          `translate(${rect.left}px, ${rect.top}px)`,
          Math.max(0, Math.min(1, values.opacity)) * object.strength,
        ),
        styles.box(values.width, values.height),
        styles.outline(color),
        !object.isVisible && styles.gone,
        ...sceneOutlines(object),
      )}
    >
      <span aria-hidden {...stylex.props(styles.text)}>
        <TokenText text={text} shouldWrap={false} />
      </span>
      {caption !== undefined && (
        <span aria-hidden {...stylex.props(styles.caption)}>
          {caption}
        </span>
      )}
      {hasProbability && (
        <span
          aria-hidden
          {...stylex.props(
            styles.bar(chartToneColors[tone ?? 'series1'], Math.max(0, Math.min(1, values.probability))),
          )}
        />
      )}
    </ChartMark>
  );
}
