import { Array, Order } from 'effect';
import type { TextEdit } from '../types.ts';

/** An edit and its place in the list it came in. */
type OrderedEdit = { readonly edit: TextEdit; readonly order: number };

type EditedTextInput = { readonly text: string; readonly edits: ReadonlyArray<TextEdit> };

/** A text, and one edit of it. */
type SplicedInput = { readonly text: string; readonly edit: TextEdit };

/**
 * The last edit first. Of edits that start at one offset, a replacement goes before the insertions, and an insertion
 * listed later goes before one listed earlier. The insertions so land in the order listed, ahead of the replacement.
 */
const LAST_FIRST = Order.combine(
  Order.combine(
    Order.mapInput(Order.flip(Order.Number), ({ edit }: OrderedEdit) => edit.start),
    Order.mapInput(Order.flip(Order.Number), ({ edit }: OrderedEdit) => edit.end - edit.start),
  ),
  Order.mapInput(Order.flip(Order.Number), ({ order }: OrderedEdit) => order),
);

/**
 * The text with each edit's range replaced by its text. Edits never overlap, and insertions at one offset land in the
 * order they are listed, ahead of a replacement that starts there.
 */
export function editedText({ text, edits }: EditedTextInput): string {
  const ordered = Array.sort(
    edits.map((edit, order) => ({ edit, order })),
    LAST_FIRST,
  );

  let edited = text;

  for (const { edit } of ordered) {
    edited = spliced({ text: edited, edit });
  }

  return edited;
}

/** The text with the edit's range replaced by the edit's text. */
function spliced({ text, edit }: SplicedInput): string {
  return `${text.slice(0, edit.start)}${edit.text}${text.slice(edit.end)}`;
}
