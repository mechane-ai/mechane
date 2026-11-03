import { InboxText } from '@mechane/protocol';
import { BoundedRequestId, MechId, renamedWireStruct, Tokens } from '@mechane/records';
import { Schema } from 'effect';
import { CommandShape, FlagKind } from '../constants.ts';
import type { CommandDeclaration } from '../types.ts';
import { MECH_ARGUMENT } from './constants.ts';

const REQUEST_ARGUMENT = {
  name: 'request-id',
  summary: 'the caller UUID reused for every retry of this request',
} as const;

const integerDispatches = Schema.isInt();
const DispatchesFromString = Schema.NumberFromString.check(integerDispatches);
const decodeTokens = Schema.decodeTo(Tokens);
const TokensFromString = Schema.NumberFromString.pipe(decodeTokens);

const BoundedIdentity = renamedWireStruct({
  fields: { mechId: MechId, requestId: BoundedRequestId },
  renames: { mechId: 'mech-id', requestId: 'request-id' },
});

/** Caller-owned request IDs let command retries retrieve the same bounded work. */
export const BOUNDED_TURN_COMMANDS = {
  'bounded-turn submit': {
    summary: 'submit one isolated turn with durable dispatch, output, and deadline limits; retries reattach',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'submitBoundedTurn'],
    flags: {
      'max-model-dispatches': { kind: FlagKind.Text, summary: 'maximum model attempts, including retries' },
      'max-output-tokens': { kind: FlagKind.Text, summary: 'maximum output tokens for each model attempt' },
      'deadline-at': { kind: FlagKind.Text, summary: 'absolute execution deadline as an ISO timestamp' },
    },
    arguments: [MECH_ARGUMENT, REQUEST_ARGUMENT, { name: 'text', summary: 'the bounded task to perform' }],
    input: renamedWireStruct({
      fields: {
        mechId: MechId,
        requestId: BoundedRequestId,
        text: InboxText,
        maxModelDispatches: DispatchesFromString,
        maxOutputTokens: TokensFromString,
        deadlineAt: Schema.DateTimeUtcFromString,
      },
      renames: {
        mechId: 'mech-id',
        requestId: 'request-id',
        maxModelDispatches: 'max-model-dispatches',
        maxOutputTokens: 'max-output-tokens',
        deadlineAt: 'deadline-at',
      },
    }),
  },
  'bounded-turn show': {
    summary: 'retrieve the bounded turn result with recorded model and tool evidence',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'showBoundedTurn'],
    flags: {},
    arguments: [MECH_ARGUMENT, REQUEST_ARGUMENT],
    input: BoundedIdentity,
  },
  'bounded-turn cancel': {
    summary: 'cancel a queued or running bounded turn; completed results stay retrievable',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'cancelBoundedTurn'],
    flags: {},
    arguments: [MECH_ARGUMENT, REQUEST_ARGUMENT],
    input: BoundedIdentity,
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
