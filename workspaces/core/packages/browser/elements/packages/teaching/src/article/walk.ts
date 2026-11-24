import { isValidElement } from 'react';
import type { ReactElement } from 'react';

/** An element found in an article's markup, with its props as plain values to read. */
export type MarkupElement = ReactElement<Readonly<Record<string, unknown>>>;

/** Where an element sits: the beat and the figure around it, when there are any. */
export type MarkupPlace = { readonly beat: string | null; readonly figure: string | null };

/** One element of the markup and its place. */
export type MarkupEntry = { readonly element: MarkupElement; readonly place: MarkupPlace };

/** Decides the place of an element's props from the element and the place around it. */
export type PlaceOf = (input: {
  readonly element: MarkupElement;
  readonly place: MarkupPlace;
  readonly prop: string;
}) => MarkupPlace;

/** What `walkMarkup` walks: the markup, the place it starts in, and how an element's props find their place. */
export type MarkupWalk = { readonly node: unknown; readonly place: MarkupPlace; readonly placeOf: PlaceOf };

/**
 * Walks markup the author wrote, in reading order, through children and every prop that holds elements, such as a
 * caption or a scrolly's figure. Components the author defined are not rendered, so their own output is not seen.
 *
 * @yields Each element with the beat and the figure around it.
 */
export function* walkMarkup({ node, place, placeOf }: MarkupWalk): Generator<MarkupEntry> {
  if (Array.isArray(node)) {
    for (const item of node) {
      yield* walkMarkup({ node: item, place, placeOf });
    }

    return;
  }

  if (typeof node !== 'object' || !isValidElement<Readonly<Record<string, unknown>>>(node)) {
    return;
  }

  yield { element: node, place };

  for (const [prop, value] of Object.entries(node.props)) {
    yield* walkMarkup({ node: value, place: placeOf({ element: node, place, prop }), placeOf });
  }
}

/** The text a prop holds, or undefined when it holds something else. */
export function textProp(element: MarkupElement, prop: string): string | undefined {
  const value = element.props[prop];

  return typeof value === 'string' ? value : undefined;
}
