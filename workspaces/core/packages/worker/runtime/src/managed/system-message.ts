import type { SystemMessage } from '@earendil-works/pi-ai';
import { defineDoc, defineEntry, GenerationTask, hook } from '@earendil-works/pi-durable';
import type { ConversationId, EntryId, Tx } from '@earendil-works/pi-durable';
import { HttpStatusCode } from '@mechane/records';
import { supportsManagedSystemMessages } from '../models/managed-system-message.ts';
import type { ManagedInputEvent } from './event-log/inputs.ts';
import { sessionEvents } from './event-log/payload-storage.ts';
import { processManagedEvent } from './event-log/write.ts';
import { failManagedRequest } from './failure.ts';
import { nativeSystemContent } from './large-native-content.ts';
import type { ManagedEvent } from './protocol.ts';
import { inputKey, sessionState, ThreadInputs } from './scheduler.ts';

const SystemMessageEntry = defineEntry<{ readonly previous: EntryId | null }>('managed.system-message');

const SystemMessageIndex = defineDoc<{
  readonly latest: EntryId | null;
  readonly firstTimestamp: number | null;
  readonly timestamp: number;
}>({
  kind: 'managed.system-message-index',
  version: 1,
  scope: 'conversation',
  history: 'rewindable',
  fork: 'asOf',
  initial: () => ({ latest: null, firstTimestamp: null, timestamp: 0 }),
  checkpointWhen: () => true,
});

const SYSTEM_CONTENT_MAX_ENTRIES = 1000;
const systemCompanions: ReadonlySet<string> = new Set(['user.message', 'user.tool_result', 'user.custom_tool_result']);

function toolResultId(event: ManagedInputEvent | undefined): string | null {
  if (event?.type === 'user.custom_tool_result') {
    return event.custom_tool_use_id;
  }

  if (event?.type === 'user.tool_result') {
    return event.tool_use_id;
  }

  return null;
}

export function validateManagedSystemMessages(
  events: ReadonlyArray<ManagedInputEvent>,
  session: { readonly model: string; readonly pendingToolIds: ReadonlySet<string>; readonly isPrimary: boolean },
): void {
  const updates = events.filter((event) => event.type === 'system.message');

  if (updates.length === 0) {
    return;
  }

  const lastIndex = events.length - 1;
  const event = events[lastIndex];

  if (updates.length !== 1 || event?.type !== 'system.message') {
    failManagedRequest(HttpStatusCode.BadRequest, 'Only one system.message is allowed, as the last event in a request');
  }

  if (event.content.length === 0 || event.content.length > SYSTEM_CONTENT_MAX_ENTRIES) {
    failManagedRequest(HttpStatusCode.BadRequest, 'system.message accepts 1–1,000 text blocks');
  }

  if (!session.isPrimary) {
    failManagedRequest(HttpStatusCode.BadRequest, 'system.message can only be sent to the primary thread');
  }

  if (!supportsManagedSystemMessages(session.model)) {
    failManagedRequest(HttpStatusCode.BadRequest, 'model_does_not_support_mid_conversation_system');
  }

  const preceding = events[lastIndex - 1];

  if (preceding !== undefined && !systemCompanions.has(preceding.type)) {
    failManagedRequest(HttpStatusCode.BadRequest, 'system.message must immediately follow a message or a tool result');
  }

  const companion = toolResultId(preceding);

  if (session.pendingToolIds.size > 0 && (companion === null || !session.pendingToolIds.has(companion))) {
    failManagedRequest(
      HttpStatusCode.BadRequest,
      'A pending tool result must precede system.message in the same request',
    );
  }
}

export async function applyManagedSystemMessage(
  transaction: Tx,
  conversationId: ConversationId,
  stored: { readonly event: ManagedEvent; readonly isLarge?: boolean },
): Promise<void> {
  const content = nativeSystemContent(stored.event, stored.isLarge);
  const index = await transaction.doc(SystemMessageIndex, conversationId);
  const timestamp = Math.max(Date.now(), index.timestamp + 1);

  const entry = await transaction.appendEntry(SystemMessageEntry, conversationId, {
    data: { previous: index.latest },
    model: [{ role: 'system', content: [...content], timestamp }],
  });

  index.firstTimestamp ??= timestamp;
  index.timestamp = timestamp;
  index.latest = entry.id;
}

export async function applyQueuedSystemMessages(transaction: Tx, sessionId: string): Promise<void> {
  const state = await sessionState(transaction, sessionId);

  if (state.conversation === null) {
    throw new Error('Missing native conversation');
  }

  while (state.pendingHead < state.pendingTail) {
    const queuedInput = await transaction.doc(ThreadInputs, inputKey(sessionId, state.pendingHead), null);
    const stored = await sessionEvents(sessionId).describe(transaction, queuedInput.eventId);

    if (stored === undefined) {
      throw new Error('Missing queued session input');
    }

    if (stored.event.type !== 'system.message') {
      break;
    }

    await applyManagedSystemMessage(transaction, state.conversation, { event: stored.event, isLarge: stored.large });
    await processManagedEvent(transaction, sessionId, stored.event.id);

    state.pendingHead += 1;
  }
}

// Compaction can remove an instruction from Pi's active transcript. Restore its original
// system role from the immutable entry while leaving newer instructions in position.
export const preserveManagedSystemMessages = hook(GenerationTask, {
  beforeRequest: async ({ messages }, api, context) => {
    const index = await api.snapshot(SystemMessageIndex, api.conversationId, context);

    if (index?.firstTimestamp === undefined || index.firstTimestamp === null) {
      return;
    }

    const retained = new Set(
      messages
        .filter((message) => message.role === 'system' && Array.isArray(message.content))
        .map((message) => message.timestamp),
    );

    const newestFirst: Array<SystemMessage> = [];

    if (!retained.has(index.firstTimestamp)) {
      let id = index.latest;

      while (id !== null) {
        const entry = await api.entry(SystemMessageEntry, id, context);
        const message = entry?.model?.[0];

        if (entry === undefined || message?.role !== 'system') {
          throw new Error('Missing durable system message');
        }

        if (!retained.has(message.timestamp)) {
          newestFirst.push(message);
        }

        id = entry.data.previous;
      }
    }

    const missing = newestFirst.toReversed();

    // Pi prepares its baseline on the first generation. A system event can arrive before
    // the first user input, so the baseline can appear after that event in the native view.
    const baseline = messages.findIndex(
      (message) =>
        message.role === 'system' && message.content === '' && typeof message.sections?.['instructions'] === 'string',
    );

    if (baseline > 0 && messages.slice(0, baseline).some((message) => message.role === 'system')) {
      return {
        messages: [
          ...messages.slice(baseline, baseline + 1),
          ...missing,
          ...messages.slice(0, baseline),
          ...messages.slice(baseline + 1),
        ],
      };
    }

    if (missing.length === 0) {
      return;
    }

    if (baseline === 0) {
      return { messages: [...messages.slice(0, 1), ...missing, ...messages.slice(1)] };
    }

    return { messages: [...missing, ...messages] };
  },
});
