import { ModelId } from '@mechane/deployment';
import { EventCursor, InboxText, Instructions, MechName, NoFields } from '@mechane/protocol';
import { CreationRequestId, InboxItemRequestId, MechId, Micros, renamedWireStruct, SessionId } from '@mechane/records';
import { Effect, Schema } from 'effect';
import { CommandShape, FlagKind } from '../constants.ts';
import type { CommandDeclaration } from '../types.ts';
import { MECH_ARGUMENT } from './constants.ts';

const OptionalCreationRequestId = Schema.optionalKey(CreationRequestId);

/** The commands that create the mechs of your workspace, talk to them, and follow their work. */
export const MECH_COMMANDS = {
  'mech create': {
    summary: 'create a mech in your workspace, which answers each inbox item through its model',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'createMech'],
    flags: {
      'request-id': {
        kind: FlagKind.Text,
        summary: 'reuse the printed creation request id to retry without creating another mech',
      },
      'name': { kind: FlagKind.Text, summary: 'the name that tells the mech apart, such as scout' },
      'instructions': { kind: FlagKind.Text, summary: 'the instructions the mech follows in every turn' },
      'model': {
        kind: FlagKind.Text,
        summary: 'the model the mech answers through, one the deployment offers; its first offer when absent',
      },
      'daily-cap-micros': {
        kind: FlagKind.Text,
        summary:
          "what the mech's model requests may cost each UTC day, in micro-dollars; the deployment's default when absent",
      },
    },
    arguments: [],
    input: renamedWireStruct({
      fields: {
        name: MechName,
        requestId: OptionalCreationRequestId,
        /** Absent for a mech without instructions of its own. */
        instructions: Schema.optionalKey(Instructions),
        /** Absent for the deployment's first offer. */
        model: Schema.optionalKey(ModelId),
        /** Absent for the deployment's default cap. */
        dailyCapMicros: Schema.optionalKey(Schema.NumberFromString.pipe(Schema.decodeTo(Micros))),
      },
      renames: { dailyCapMicros: 'daily-cap-micros', requestId: 'request-id' },
    }),
  },
  'mech list': {
    summary: 'list the mechs of your workspace, oldest first, each with the mech it was forked from',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'listMechs'],
    flags: {},
    arguments: [],
    input: NoFields,
  },
  'mech fork': {
    summary:
      "fork an idle mech into a new mech of your workspace, which keeps the mech's conversation, memory and records so far but not its sandbox's files",
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'forkMech'],
    flags: {
      'name': { kind: FlagKind.Text, summary: 'the name that tells the new mech apart' },
      'request-id': { kind: FlagKind.Text, summary: 'reuse the printed request id to retry the same fork' },
    },
    arguments: [MECH_ARGUMENT],
    input: renamedWireStruct({
      fields: { mechId: MechId, name: MechName, requestId: OptionalCreationRequestId },
      renames: { mechId: 'mech-id', requestId: 'request-id' },
    }),
  },
  'inbox send': {
    summary:
      'send text to the inbox of a mech under an id it prints first, which a resend with --inbox-item-id delivers only once',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'sendInboxItem'],
    flags: {
      'inbox-item-id': {
        kind: FlagKind.Text,
        summary: 'the inbox item id of a send to repeat, as an earlier send printed it; a fresh one when absent',
      },
      'session-id': {
        kind: FlagKind.Text,
        summary: 'the conversation session to receive the message; the mech default when absent',
      },
    },
    arguments: [MECH_ARGUMENT, { name: 'text', summary: 'what to tell the mech' }],
    input: renamedWireStruct({
      fields: {
        mechId: MechId,
        text: InboxText,
        /** Absent for a first send, which takes a fresh id. */
        inboxItemId: Schema.optionalKey(InboxItemRequestId),
        sessionId: Schema.optionalKey(SessionId),
      },
      renames: { mechId: 'mech-id', inboxItemId: 'inbox-item-id', sessionId: 'session-id' },
    }),
  },
  'event list': {
    summary:
      'write the events of a mech, one record each: to the end of its log, or with --follow as they happen; a turn ends only with turn.answered or turn.unanswered',
    shape: CommandShape.Stream,
    operations: ['listWorkspaces', 'listEvents'],
    flags: {
      after: {
        kind: FlagKind.Text,
        summary: 'the sequence of the last event you have, to resume after it; 0 when absent',
      },
      follow: { kind: FlagKind.Switch, summary: 'keep waiting for new events until Ctrl-C' },
    },
    arguments: [MECH_ARGUMENT],
    input: renamedWireStruct({
      fields: {
        mechId: MechId,
        /** Absent for the log's start. */
        after: EventCursor.pipe(Schema.withDecodingDefaultKey(Effect.succeed('0'))),
        /** Absent for a listing that ends at the end of the log. */
        isFollowing: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
      },
      renames: { mechId: 'mech-id', isFollowing: 'follow' },
    }),
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
