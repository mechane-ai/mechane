import { Array, Order } from 'effect';
import type { TextEdit } from '../schemas.ts';

/** The edits of a line, the last first, so an edit never moves the range of one still to apply. */
const LAST_FIRST = Order.flip(Order.mapInput(Order.Number, ({ range }: TextEdit) => range.start.character));

/** A file's text, and its edits. */
type EditTextInput = { readonly text: string; readonly edits: ReadonlyArray<TextEdit> };

/** One line of a file, and its edits. */
type EditLineInput = { readonly line: string; readonly edits: ReadonlyArray<TextEdit> };

/** The text with each edit applied; a rename's edit replaces one identifier, so it never spans two lines. */
export function editText({ text, edits }: EditTextInput): string {
  /** The line at the index with its edits applied. */
  const editedLine: (line: string, index: number) => string = (line, index) =>
    editLine({ line, edits: edits.filter(({ range }) => range.start.line === index) });

  return text.split('\n').map(editedLine).join('\n');
}

/** The line with each of its edits applied, the last first, so an edit never moves the range of one still to apply. */
function editLine({ line, edits }: EditLineInput): string {
  const lastFirst = Array.sort(edits, LAST_FIRST);
  let edited = line;

  for (const { range, newText } of lastFirst) {
    edited = `${edited.slice(0, range.start.character)}${newText}${edited.slice(range.end.character)}`;
  }

  return edited;
}
