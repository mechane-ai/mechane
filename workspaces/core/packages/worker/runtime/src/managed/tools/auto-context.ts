import type { Harness } from '@earendil-works/pi-durable';
import { Schema } from 'effect';
import { indexedEvents } from '../event-log/collections.ts';
import { sessionEvents } from '../event-log/payload-storage.ts';
import type { ManagedToolCall } from '../pi-tools.ts';
import type { ManagedEvent } from '../protocol.ts';
import { ManagedWireObject } from '../protocol.ts';

type PriorCall = {
  readonly type: string;
  readonly name: string;
  readonly server?: string;
  readonly arguments: ManagedWireObject;
};

export type AutoAssessmentInput = {
  readonly tool: {
    readonly kind: ManagedToolCall['kind'];
    readonly name: string;
    readonly server?: string;
    readonly arguments: ManagedWireObject;
  };
  readonly userIntent: ReadonlyArray<string>;
  readonly priorCalls: ReadonlyArray<PriorCall>;
};

const invocations: ReadonlySet<string> = new Set(['agent.tool_use', 'agent.mcp_tool_use', 'agent.custom_tool_use']);
const HISTORY_MAX_EVENTS = 32;
const ASSESSMENT_MAX_BYTES = 16_000;
const isToolInput = Schema.is(ManagedWireObject);
const decodeContent = Schema.decodeUnknownSync(Schema.Array(ManagedWireObject));

function serverName(source: unknown) {
  if (typeof source === 'string') {
    return { server: source };
  }

  return {};
}

function intentText(content: unknown): ReadonlyArray<string> {
  const blocks = decodeContent(content);

  return blocks.flatMap((block) => {
    if (block['type'] === 'text' && typeof block['text'] === 'string') {
      return [block['text']];
    }

    return [];
  });
}

async function recentEvidence(
  harness: Harness,
  sessionId: string,
  isPrimary: boolean,
): Promise<ReadonlyArray<ManagedEvent> | null> {
  const index = indexedEvents(sessionId, null, 'processed');
  const recent = await index.page(harness, { isReversed: true, maxRows: HISTORY_MAX_EVENTS });
  const rows = sessionEvents(sessionId);
  const events: Array<ManagedEvent> = [];

  for (const id of recent.items.toReversed()) {
    const source = await rows.inspect(harness, id);

    if (source === undefined) {
      throw new Error('The permission history index refers to a missing event.');
    }

    const eligible = invocations.has(source.event.type) || (isPrimary && source.event.type === 'user.message');

    if (eligible) {
      if (source.wireBytes > ASSESSMENT_MAX_BYTES) {
        return null;
      }

      const row = await source.load();

      if (row.threadId === null) {
        events.push(row.event);
      }
    }
  }

  return events;
}

export async function autoAssessmentContext(
  harness: Harness,
  call: ManagedToolCall,
  isPrimary: boolean,
): Promise<AutoAssessmentInput | null> {
  const recent = await recentEvidence(harness, call.sessionId, isPrimary);

  if (recent === null) {
    return null;
  }

  const userIntent: Array<string> = [];
  const priorCalls: Array<PriorCall> = [];

  for (const event of recent) {
    if (invocations.has(event.type)) {
      const name = event['name'];
      const args = event['input'];

      if (typeof name === 'string' && isToolInput(args)) {
        priorCalls.push({ type: event.type, name, arguments: args, ...serverName(event['mcp_server_name']) });
      }
    }

    // Delegated instructions arrive as native user inputs. Only primary user messages express the caller's intent.
    if (event.type === 'user.message') {
      userIntent.push(...intentText(event['content']));
    }
  }

  const assessment = {
    tool: { kind: call.kind, name: call.name, ...serverName(call.mcpServerName), arguments: call.input },
    priorCalls,
    userIntent,
  };

  if (new TextEncoder().encode(JSON.stringify(assessment)).byteLength > ASSESSMENT_MAX_BYTES) {
    return null;
  }

  return assessment;
}
