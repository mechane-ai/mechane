import type { Thread } from '@mechane/protocol';
import { DateTime, Option } from 'effect';
import { indentedText } from '../observe/indented-text.ts';

type ThreadLinesInput = { readonly thread: Thread };

/** One thread as a person reads it: its id, state, times and title, then its note, indented, if it has one. */
export function threadLines({ thread }: ThreadLinesInput): ReadonlyArray<string> {
  const times = `opened ${DateTime.formatIso(thread.openedAt)}, updated ${DateTime.formatIso(thread.updatedAt)}`;

  return [
    `${thread.id} ${thread.state}, ${times}: ${thread.title}`,
    ...Option.toArray(thread.note).flatMap((note) => indentedText({ text: note })),
  ];
}
