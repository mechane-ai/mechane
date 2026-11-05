import type { TurnFields } from '@mechane/rpc';
import { Option } from 'effect';
import type { TablesInput } from '../types.ts';

const INPUT_EXCERPT_CHARS = 240;

type TurnInputExcerptInput = TablesInput & Pick<TurnFields, 'inboxItemIds'>;

/** Reads a bounded prefix of the first input retained by the mech. */
export function readTurnInputExcerpt({ store, inboxItemIds }: TurnInputExcerptInput): string {
  const first = Option.fromNullishOr(inboxItemIds[0]);
  const received = Option.flatMap(first, (inboxItemId) => store.inboxItem({ inboxItemId }));

  return Option.match(received, {
    onNone: () => '',
    onSome: (inbox) => inbox.text.slice(0, INPUT_EXCERPT_CHARS).toWellFormed(),
  });
}
