import { MechId, PAGE_RENAMES, RecordText, renamedWireStruct, SessionId, TurnId, wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { WireTime } from '../../schemas.ts';

/** Each conversation retains the surface that admitted its first message. */
const SessionSource = { Console: 'console', Slack: 'slack', Api: 'api' } as const;

type SessionSource = (typeof SessionSource)[keyof typeof SessionSource];

/** Conversation identity is separate from the work items an agent maintains. */
export const ConversationSession = wireStruct({
  fields: {
    id: SessionId,
    mechId: MechId,
    title: RecordText,
    source: Schema.Enum(SessionSource),
    createdAt: WireTime,
    updatedAt: WireTime,
    /** None means this session has no run currently executing or waiting on an external decision. */
    activeRunId: Schema.OptionFromNullOr(TurnId),
  },
});

export type ConversationSession = typeof ConversationSession.Type;

/** Sessions are ordered by their latest activity, newest first. */
export const SessionPage = renamedWireStruct({
  fields: { sessions: Schema.Array(ConversationSession), hasMore: Schema.Boolean },
  renames: PAGE_RENAMES,
});

export type SessionPage = typeof SessionPage.Type;
