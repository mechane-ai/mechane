import { isValidElement } from 'react';
import type { ReactNode } from 'react';
import { ParamChoice, ParamSlider, ParamToggle } from '../lesson/param-controls.tsx';
import { Param, Value } from '../lesson/param.tsx';
import { Playback } from '../lesson/playback.tsx';
import { Transport } from '../lesson/transport.tsx';
import { Beat } from './beat.tsx';
import { Challenge } from './challenge.tsx';
import { Figure } from './figure.tsx';
import type { FigureProps } from './figure.tsx';
import { Footnote, References } from './notes.tsx';
import type { FootnoteProps, ReferencesProps } from './notes.tsx';
import type { ArticleOutline, OutlineFigure } from './outline-types.ts';
import { Predict } from './predict.tsx';
import { Scrolly, ScrollyStep } from './scrolly.tsx';
import type { ScrollyProps, ScrollyStepProps } from './scrolly.tsx';
import { textProp, walkMarkup } from './walk.ts';
import type { MarkupElement, MarkupEntry, MarkupPlace } from './walk.ts';

/** The figure id given to a scrolly's figure when it holds no `Figure` of its own. */
const SCROLLY_FIGURE = '(scrolly figure)';

const namedParts: ReadonlyMap<unknown, string> = new Map<unknown, string>([
  [Param, 'name'],
  [Value, 'name'],
  [ParamSlider, 'name'],
  [ParamChoice, 'name'],
  [ParamToggle, 'name'],
  [Playback, 'name'],
  [Transport, 'for'],
]);

function placeOf({
  element,
  place,
  prop,
}: {
  readonly element: MarkupElement;
  readonly place: MarkupPlace;
  readonly prop: string;
}): MarkupPlace {
  if (element.type === Beat) {
    return { beat: textProp(element, 'id') ?? null, figure: null };
  }

  if (element.type === Figure) {
    return { ...place, figure: textProp(element, 'id') ?? null };
  }

  return element.type === Scrolly && prop === 'figure' ? { ...place, figure: SCROLLY_FIGURE } : place;
}

/** The lesson name a lesson part takes, such as `Param`'s `name` or `Transport`'s `for`. */
function partName(element: MarkupElement): string | undefined {
  const prop = namedParts.get(element.type);

  return prop === undefined ? undefined : textProp(element, prop);
}

function figuresOf(entries: ReadonlyArray<MarkupEntry>): ReadonlyArray<OutlineFigure> {
  return entries.flatMap(({ element, place }): ReadonlyArray<OutlineFigure> => {
    if (element.type === Figure && isValidElement<FigureProps>(element)) {
      return [
        {
          id: element.props.id,
          beat: place.beat,
          hasDescription: element.props.description !== undefined,
          size: place.figure === SCROLLY_FIGURE ? 'text' : (element.props.size ?? 'wide'),
          node: element,
        },
      ];
    }

    if (element.type !== Scrolly || !isValidElement<ScrollyProps>(element)) {
      return [];
    }

    const inner = [...walkMarkup({ node: element.props.figure, place, placeOf })];
    const hasFigure = inner.some((entry) => entry.element.type === Figure);

    return hasFigure
      ? []
      : [{ id: SCROLLY_FIGURE, beat: place.beat, hasDescription: false, size: 'text', node: element.props.figure }];
  });
}

function figureReads(entries: ReadonlyArray<MarkupEntry>, beat: string): ReadonlyArray<string> {
  return entries.flatMap(({ element, place }) => {
    if (place.beat !== beat) {
      return [];
    }

    const reads = element.type === Figure && isValidElement<FigureProps>(element) ? (element.props.reads ?? []) : [];
    const name = place.figure === null ? undefined : partName(element);

    return name === undefined ? reads : [...reads, name];
  });
}

/** Reads an article's markup: its beats, figures, notes, references, players and the names each part takes. */
export function articleOutline(children: ReactNode): ArticleOutline {
  const entries = [...walkMarkup({ node: children, place: { beat: null, figure: null }, placeOf })];
  const figures = figuresOf(entries);
  const beatIds = entries.flatMap(({ element }) => (element.type === Beat ? (textProp(element, 'id') ?? []) : []));

  const references = entries.flatMap(({ element }) =>
    element.type === References && isValidElement<ReferencesProps>(element) ? element.props.items : [],
  );

  return {
    beats: beatIds.map((id) => ({
      id,
      figures: figures.filter((figure) => figure.beat === id),
      figureNames: [...new Set(figureReads(entries, id))],
      proseParams: [
        ...new Set(
          entries.flatMap(({ element, place }) =>
            place.beat === id && place.figure === null && element.type === Param
              ? (textProp(element, 'name') ?? [])
              : [],
          ),
        ),
      ],
      scrollySteps: entries.flatMap(({ element, place }) =>
        place.beat === id && element.type === ScrollyStep && isValidElement<ScrollyStepProps>(element)
          ? [{ id: element.props.id, values: element.props.values, state: element.props.state }]
          : [],
      ),
    })),
    figures: figures.filter((figure) => figure.id !== SCROLLY_FIGURE).map((figure) => figure.id),
    footnotes: entries.flatMap(({ element, place }) =>
      element.type === Footnote && isValidElement<FootnoteProps>(element)
        ? [{ id: element.props.id, beat: place.beat, content: element.props.children }]
        : [],
    ),
    references,
    playbacks: entries.flatMap(({ element, place }) =>
      element.type === Playback ? [{ name: textProp(element, 'name') ?? '', beat: place.beat }] : [],
    ),
    transports: entries.flatMap(({ element }) => (element.type === Transport ? (textProp(element, 'for') ?? []) : [])),
    predictions: entries.flatMap(({ element, place }) => {
      const id = element.type === Predict ? textProp(element, 'id') : undefined;
      const answerFrom = textProp(element, 'answerFrom');

      return id === undefined ? [] : [{ id, beat: place.beat, ...(answerFrom !== undefined && { answerFrom }) }];
    }),
    challenges: entries.flatMap(({ element, place }) => {
      const id = element.type === Challenge ? textProp(element, 'id') : undefined;

      return id === undefined ? [] : [{ id, beat: place.beat }];
    }),
  };
}

/**
 * The lesson value each prediction's answer comes from, by the `Predict` id. Tutor tools take it as their `answers`
 * option, so a value a pending prediction asks about stays out of their results until the reader commits.
 */
export function answerSources(outline: ArticleOutline): Readonly<Record<string, string>> {
  return Object.fromEntries(
    outline.predictions.flatMap((prediction) =>
      prediction.answerFrom === undefined ? [] : [[prediction.id, prediction.answerFrom] as const],
    ),
  );
}
