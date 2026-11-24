import type { ReactNode } from 'react';
import type { ChartTone, ValueFormat } from '../../../../charts/src/index.ts';
import { formatValue } from '../../../../charts/src/index.ts';
import type { MarkEmphasis } from '../../../../charts/src/plot/index.ts';
import { useSceneContext, useSceneObject } from '../scene-context.ts';
import type { ScenePosition } from '../scene-geometry.ts';
import { SceneOutside } from '../scene-layer.tsx';
import { SceneToken, tokenCaption, tokenPercent } from './scene-token.tsx';
import { tokenBox, tokenFlow } from './token-layout.ts';
import type { TokenGapName } from './token-layout.ts';

/** One token of a sequence. Its scene id is `${sequence id}.${index}`. */
export type SceneTokenItem = {
  readonly text: string;
  readonly tokenId?: number | string | undefined;
  readonly probability?: number | undefined;
  readonly tone?: ChartTone | undefined;
  /** The readout sentence. Left out, the quoted text with its id and probability. */
  readonly label?: string | undefined;
};

export type SceneTokensProps = {
  /** Stable across states. Name one token as `${id}.${index}`; the sequence is the box around its rows. */
  readonly id: string;
  /** The center of the whole block in data units. */
  readonly at: ScenePosition;
  /** The sequence in reading order. */
  readonly tokens: ReadonlyArray<SceneTokenItem>;
  /** The width in pixels at which the row wraps to a new line. Defaults to 480. */
  readonly wrapWidth?: number | undefined;
  /** The room between tokens. Defaults to `medium`. */
  readonly gap?: TokenGapName | undefined;
  /** How probabilities are written. Defaults to a percent with one decimal. */
  readonly format?: ValueFormat | undefined;
  /** The readout sentence for the whole sequence. With one, the arrow keys reach it. */
  readonly label?: string | undefined;
  /** `context` draws every token plain; the others yield to inspection. */
  readonly emphasis?: MarkEmphasis | undefined;
  /** False fades the sequence out and takes its tokens out of the keyboard order. */
  readonly isShown?: boolean | undefined;
};

const WRAP_WIDTH = 480;

/**
 * A sequence of tokens laid out in a row that wraps, each with a stable id `${id}.${index}`. Add, remove or change
 * tokens and the rest ease along. Use it for a prompt, a completion or a context window; the text charts draw the same
 * tokens when the figure is data rather than a part of a diagram.
 */
export function SceneTokens({
  id,
  at,
  tokens,
  wrapWidth = WRAP_WIDTH,
  gap = 'medium',
  format,
  label,
  emphasis,
  isShown = true,
}: SceneTokensProps): ReactNode {
  const { locale } = useSceneContext();

  const boxes = tokens.map((token) =>
    tokenBox({
      text: token.text,
      caption: tokenCaption({
        tokenId: token.tokenId,
        probability:
          token.probability === undefined
            ? undefined
            : formatValue({ value: token.probability, locale, format: format ?? tokenPercent }),
      }),
    }),
  );

  const flow = tokenFlow({ boxes, wrapWidth, gap });

  const object = useSceneObject({
    id,
    kind: 'tokens',
    frame: { x: at[0], y: at[1], width: flow.width, height: flow.height },
    values: {},
    label,
    isShown,
    emphasis,
  });

  if (!object.scene.isInScene) {
    return <SceneOutside part="SceneTokens" />;
  }

  const entries = tokens.map((token, index) => ({ key: `${id}.${index}`, token, offset: flow.offsets[index] }));

  return entries.map(({ key, token, offset }) => (
    <SceneToken
      key={key}
      id={key}
      at={at}
      offset={offset}
      isFloating
      text={token.text}
      tokenId={token.tokenId}
      probability={token.probability}
      format={format}
      tone={token.tone}
      label={token.label}
      emphasis={emphasis}
      isShown={isShown}
    />
  ));
}
