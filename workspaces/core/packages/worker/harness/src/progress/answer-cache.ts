import type { EntryId, EntryRecord } from '@earendil-works/pi-durable';
import { assistantMessages } from './assistant-messages.ts';
import { PiChangeType } from './constants.ts';
import type { PublicationInput } from './types.ts';

/** The answer entries of the mech's conversation that a commit's settlements may name. */
type AnswerCache = { readonly answers: (input: PublicationInput) => ReadonlyMap<EntryId, EntryRecord> };

/**
 * The answer entries each commit may settle an input with: those it appended, and the assistant entries of each
 * conversation's latest earlier commit that appended any. A drone's commit between a mech's two thus keeps the mech's.
 * A restart between a tool's handoff and its answer empties the cache, so the listener fails and the next open catches
 * up.
 */
export function answerCache(): AnswerCache {
  const earlier = new Map<EntryId, EntryRecord>();

  const answers: AnswerCache['answers'] = ({ publication }) => {
    const appended = publication.changes
      .filter((change) => change.type === PiChangeType.Entry)
      .map((change) => change.value);

    const byId = new Map([...earlier, ...appended.map((entry) => [entry.id, entry] as const)]);
    const holdsAnswer: (entry: EntryRecord) => boolean = (entry) => assistantMessages({ entry }).length > 0;
    const assistant = appended.filter(holdsAnswer);
    const answered = new Set(assistant.map((entry) => entry.conversationId));

    for (const [id, entry] of earlier) {
      if (answered.has(entry.conversationId)) {
        earlier.delete(id);
      }
    }

    for (const entry of assistant) {
      earlier.set(entry.id, entry);
    }

    return byId;
  };

  return { answers };
}
