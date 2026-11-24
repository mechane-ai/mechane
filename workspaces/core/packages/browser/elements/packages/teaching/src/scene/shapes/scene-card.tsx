import * as stylex from '@stylexjs/stylex';
import { useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { chartToneColors, useScopedTone } from '../../../../charts/src/index.ts';
import type { ChartTone } from '../../../../charts/src/index.ts';
import type { MarkEmphasis } from '../../../../charts/src/plot/index.ts';
import { colors, radii, typography } from '../../../../foundations/src/tokens.stylex.ts';
import type { Pace } from '../../time/tween.ts';
import { useSceneContext } from '../scene-context.ts';
import type { SceneOffset, ScenePosition } from '../scene-geometry.ts';
import { SceneNode } from '../scene-node.tsx';
import type { SceneDelay } from '../scene-stagger.ts';
import { fillLabel } from '../scene-validate.ts';
import { stackBookOf } from './stack-book.ts';
import { sceneCardSizes, stackPlace } from './stack-layout.ts';
import type { SceneCardSizeName } from './stack-layout.ts';

/** The ranks of a playing card, lowest first with the ace first. */
export const cardRanks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

/** A playing card's rank. */
export type CardRank = (typeof cardRanks)[number];

/** The four suits of a playing card. */
export const cardSuits = ['heart', 'diamond', 'spade', 'club'] as const;

/** A playing card's suit. */
export type CardSuit = (typeof cardSuits)[number];

/** The words a card speaks that are not the author's content. `{rank}`, `{suit}` and `{name}` are filled in. */
export type SceneCardLabels = {
  readonly ranks: Readonly<Record<CardRank, string>>;
  readonly suits: Readonly<Record<CardSuit, string>>;
  /** The card's name for the readout, such as "Queen of Hearts". */
  readonly name: string;
  /** The readout of a face-down card. `{name}` is its name; the default leaves it out to keep the card secret. */
  readonly faceDown: string;
  /** `{id}` is the card that has no place. */
  readonly noPlace: string;
};

/** The plain English words of a card. */
export const sceneCardLabels = {
  ranks: {
    'A': 'Ace',
    '2': '2',
    '3': '3',
    '4': '4',
    '5': '5',
    '6': '6',
    '7': '7',
    '8': '8',
    '9': '9',
    '10': '10',
    'J': 'Jack',
    'Q': 'Queen',
    'K': 'King',
  },
  suits: { heart: 'Hearts', diamond: 'Diamonds', spade: 'Spades', club: 'Clubs' },
  name: '{rank} of {suit}',
  faceDown: 'A card, face down',
  noPlace: 'The card "{id}" has no place. Give it `at`, or list it in a SceneStack declared before it.',
} as const satisfies SceneCardLabels;

/** The tone a suit takes when neither the card nor the tone scope names one. */
export const suitTones: Readonly<Record<CardSuit, ChartTone>> = {
  heart: 'negative',
  diamond: 'negative',
  spade: 'series1',
  club: 'series1',
};

const suitGlyphs: Readonly<Record<CardSuit, string>> = { heart: '♥', diamond: '♦', spade: '♠', club: '♣' };

export type SceneCardProps = {
  /** Stable across states: the card with this id moves, turns and lifts to its new props. */
  readonly id: string;
  /** The card's center in data units. Left out, a `SceneStack` that lists the card places it. */
  readonly at?: ScenePosition | undefined;
  /** A shift from `at` in pixels, for hand placement. Ignored while a stack places the card. */
  readonly offset?: SceneOffset | undefined;
  /** Degrees of turn in the page, for hand placement. Ignored while a stack places the card. */
  readonly rotate?: number | undefined;
  /** With `suit`, a playing card: the corners and the center show them. */
  readonly rank?: CardRank | undefined;
  readonly suit?: CardSuit | undefined;
  /** What a generic card shows in its center: a word, a symbol or a number. */
  readonly text?: string | undefined;
  /** The readout sentence. Left out, a playing card says its name, such as "Queen of Hearts". */
  readonly label?: string | undefined;
  /** False turns the card over, easing through a mid-turn. Defaults to true. */
  readonly isFaceUp?: boolean | undefined;
  /** 0 rests on the table, 1 is raised toward the reader. */
  readonly lift?: number | undefined;
  /** Degrees of lean around the horizontal axis. */
  readonly tilt?: number | undefined;
  /** The fixed pixel box in card proportions. A stack's size wins while it places the card. Defaults to `medium`. */
  readonly size?: SceneCardSizeName | undefined;
  /**
   * The hue that names the card. Left out: the tone scope's tone for the card's id, then for its suit, then the suit's
   * own.
   */
  readonly tone?: ChartTone | undefined;
  /** `context` draws the card gray; the others yield to inspection, so a card recedes like any node. */
  readonly emphasis?: MarkEmphasis | undefined;
  /** False fades the card out and takes it out of the keyboard order. */
  readonly isShown?: boolean | undefined;
  /** True keeps the card at full strength while the rest recede. */
  readonly isActive?: boolean | undefined;
  /** The other face. Left out, a lattice in the card's tone; a playing card's is neutral so it hides the suit. */
  readonly back?: ReactNode;
  /**
   * More on the face: for a playing card it replaces the big suit in the center, for a generic card it sits under the
   * text.
   */
  readonly children?: ReactNode;
  /**
   * The stacking order. Left out, a stacked card draws above the cards under it, and a spread card above every pile, so
   * a dealt card travels over the deck.
   */
  readonly order?: number | undefined;
  /** How long every change waits before the card moves. Prefer the stack's `stagger` to deal cards in turn. */
  readonly delay?: SceneDelay | undefined;
  /** Overrides the scene's pace for this card. */
  readonly pace?: Pace | undefined;
  readonly labels?: Partial<SceneCardLabels> | undefined;
};

const SPREAD_ORDER = 100;

const styles = stylex.create({
  face: { position: 'relative', width: '100%', height: '100%' },
  corner: {
    position: 'absolute',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    lineHeight: 1,
    fontFamily: typography.fontFamily,
    fontWeight: typography.boldWeight,
    fontVariantNumeric: 'tabular-nums',
  },
  topLeft: { top: 0, left: 0 },
  bottomRight: { right: 0, bottom: 0, transform: 'rotate(180deg)' },
  center: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  inkColor: (color: string) => ({ color }),
  pip: { lineHeight: 1 },
  lattice: (color: string) => ({
    alignSelf: 'stretch',
    flexGrow: 1,
    borderRadius: radii.sm,
    backgroundImage: [
      `repeating-linear-gradient(45deg, color-mix(in srgb, ${color} 45%, transparent) 0 1.5px, transparent 1.5px 7px)`,
      `repeating-linear-gradient(-45deg, color-mix(in srgb, ${color} 45%, transparent) 0 1.5px, transparent 1.5px 7px)`,
    ].join(', '),
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: `color-mix(in srgb, ${color} 55%, transparent)`,
  }),
  error: { color: colors.danger, fontFamily: typography.fontFamily, fontSize: typography.captionSize },
});

const faceMetrics = {
  cornerSmall: 12,
  cornerMedium: 16,
  cornerLarge: 24,
  glyphSmall: 11,
  glyphMedium: 15,
  glyphLarge: 22,
  pipSmall: 26,
  pipMedium: 44,
  pipLarge: 76,
} as const;

const cornerSizes = stylex.create({
  small: { fontSize: faceMetrics.cornerSmall },
  medium: { fontSize: faceMetrics.cornerMedium },
  large: { fontSize: faceMetrics.cornerLarge },
});

const glyphSizes = stylex.create({
  small: { fontSize: faceMetrics.glyphSmall },
  medium: { fontSize: faceMetrics.glyphMedium },
  large: { fontSize: faceMetrics.glyphLarge },
});

const pipSizes = stylex.create({
  small: { fontSize: faceMetrics.pipSmall },
  medium: { fontSize: faceMetrics.pipMedium },
  large: { fontSize: faceMetrics.pipLarge },
});

function cardName({
  rank,
  suit,
  labels,
}: {
  readonly rank: CardRank;
  readonly suit: CardSuit;
  readonly labels: SceneCardLabels;
}): string {
  return fillLabel(labels.name, { rank: labels.ranks[rank], suit: labels.suits[suit] });
}

function Corner({
  rank,
  suit,
  size,
  placement,
}: {
  readonly rank: CardRank;
  readonly suit: CardSuit;
  readonly size: SceneCardSizeName;
  readonly placement: stylex.StyleXStyles;
}): ReactNode {
  return (
    <span aria-hidden {...stylex.props(styles.corner, cornerSizes[size], placement)}>
      <span>{rank}</span>
      <span {...stylex.props(glyphSizes[size])}>{suitGlyphs[suit]}</span>
    </span>
  );
}

type FaceProps = {
  readonly rank: CardRank;
  readonly suit: CardSuit;
  readonly size: SceneCardSizeName;
  readonly color: string;
  readonly name: string;
  readonly children: ReactNode;
};

function CardFace({ rank, suit, size, color, name, children }: FaceProps): ReactNode {
  const hasContent = children !== undefined && children !== null;

  return (
    <div role="img" aria-label={name} {...stylex.props(styles.face, styles.inkColor(color))}>
      <Corner rank={rank} suit={suit} size={size} placement={styles.topLeft} />
      <div aria-hidden {...stylex.props(styles.center)}>
        {hasContent ? children : <span {...stylex.props(styles.pip, pipSizes[size])}>{suitGlyphs[suit]}</span>}
      </div>
      <Corner rank={rank} suit={suit} size={size} placement={styles.bottomRight} />
    </div>
  );
}

/**
 * A playing card, or a generic card with a word on it, that eases to its new place, face, lift and tilt. Name a rank
 * and suit and it draws the corners and the suit, spoken as "Queen of Hearts". Place it with `at`, or list its id in a
 * `SceneStack` declared before it, so a card dealt from one stack to another travels there.
 */
export function SceneCard({
  id,
  at,
  offset,
  rotate,
  rank,
  suit,
  text,
  label,
  isFaceUp = true,
  lift = 0,
  tilt = 0,
  size = 'medium',
  tone,
  emphasis,
  isShown = true,
  isActive = false,
  back,
  children,
  order,
  delay,
  pace,
  labels: labelInput,
}: SceneCardProps): ReactNode {
  const { registry } = useSceneContext();
  const book = stackBookOf(registry);
  const labels = { ...sceneCardLabels, ...labelInput };
  const scopedById = useScopedTone(id);
  const scopedBySuit = useScopedTone(suit ?? '');

  useSyncExternalStore(book.subscribe, book.version, book.version);

  const slot = book.slotOf(id);
  const cardSize = slot?.spec.size ?? size;

  const stacked =
    slot === undefined ? undefined : stackPlace({ ...slot.spec, count: slot.spec.cards.length, index: slot.index });

  if (slot === undefined && at === undefined) {
    return <span {...stylex.props(styles.error)}>{fillLabel(labels.noPlace, { id })}</span>;
  }

  const suitTone = suit === undefined ? 'neutral' : suitTones[suit];
  const scoped = scopedById ?? scopedBySuit;
  const resolved = tone ?? scoped ?? suitTone;
  const isPlaying = rank !== undefined && suit !== undefined;
  const name = isPlaying ? cardName({ rank, suit, labels }) : text;
  const spoken = label ?? (isFaceUp || name === undefined ? name : fillLabel(labels.faceDown, { name }));
  const backTone = isPlaying ? 'neutral' : resolved;
  const isSpread = slot !== undefined && slot.spec.layout !== 'pile';
  const stackOrder = (slot?.index ?? 0) + (isSpread ? SPREAD_ORDER : 0);

  return (
    <SceneNode
      id={id}
      at={slot?.spec.at ?? at ?? [0, 0]}
      offset={stacked?.offset ?? offset}
      rotate={stacked?.rotate ?? rotate}
      size={sceneCardSizes[cardSize]}
      text={isPlaying ? undefined : text}
      label={spoken}
      tone={resolved}
      emphasis={emphasis}
      isShown={isShown}
      isActive={isActive}
      isFloating={slot !== undefined}
      turn={isFaceUp ? 0 : 1}
      lift={lift}
      tilt={tilt}
      order={order ?? stackOrder}
      delay={delay}
      stagger={
        slot?.spec.stagger === undefined
          ? undefined
          : { group: slot.stackId, index: slot.index, step: slot.spec.stagger }
      }
      pace={pace}
      backTone={backTone}
      back={back ?? <div {...stylex.props(styles.lattice(chartToneColors[backTone]))} />}
    >
      {isPlaying ? (
        <CardFace rank={rank} suit={suit} size={cardSize} color={chartToneColors[resolved]} name={name ?? ''}>
          {children}
        </CardFace>
      ) : (
        children
      )}
    </SceneNode>
  );
}
