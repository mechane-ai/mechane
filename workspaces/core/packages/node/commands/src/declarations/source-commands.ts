import { SourceAction, SourceGrant, SourcePublishPaths } from '@mechane/protocol';
import { GitCommit, MechId, RecordName, RecordText, renamedWireStruct, SourceId } from '@mechane/records';
import { Effect, Option, Schema } from 'effect';
import { CommandShape, FlagKind } from '../constants.ts';
import type { CommandDeclaration } from '../types.ts';
import { MECH_ARGUMENT } from './constants.ts';

const SOURCE_FLAGS = {
  'source-id': {
    kind: FlagKind.Text,
    summary: 'a stable UUID for this source checkout and its single publication intent',
  },
} as const;

const SOURCE_RENAMES = { mechId: 'mech-id', sourceId: 'source-id' } as const;
const SOURCE_FIELDS = { mechId: MechId, sourceId: SourceId } as const;

/** Omitting the internal action field selects configuration for grant and revoke commands. */
const ConfigureAction = Schema.Literal(SourceAction.Configure).pipe(
  Schema.withDecodingDefaultKey(Effect.succeed(SourceAction.Configure)),
);

/** Omitting the internal action field selects immutable checkout. */
const CheckoutAction = Schema.Literal(SourceAction.Checkout).pipe(
  Schema.withDecodingDefaultKey(Effect.succeed(SourceAction.Checkout)),
);

/** Omitting the internal action field selects draft publication. */
const PublishAction = Schema.Literal(SourceAction.Publish).pipe(
  Schema.withDecodingDefaultKey(Effect.succeed(SourceAction.Publish)),
);

/** Omitting the internal action field selects inspection without advancing source work. */
const ShowAction = Schema.Literal(SourceAction.Show).pipe(
  Schema.withDecodingDefaultKey(Effect.succeed(SourceAction.Show)),
);

/** Null selects no repository grant; a JSON value supplies the owner's complete configuration. */
const SourceGrantInput = Schema.OptionFromNullOr(Schema.fromJsonString(SourceGrant));
const SourcePathsInput = Schema.fromJsonString(SourcePublishPaths);

/** Omission supplies encoded null so revocation reaches the server without a grant value. */
const SourceRevokeInput = Schema.OptionFromNullOr(SourceGrant).pipe(
  Schema.withDecodingDefaultKey(Effect.succeed(Option.getOrNull(Option.none()))),
);

/** Owners select immutable source and publication intent while credentials remain in trusted server configuration. */
export const SOURCE_COMMANDS = {
  'source grant': {
    summary: 'grant a mech one whole GitHub repository for reading and explicit write paths for owner-approved drafts',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'manageSource'],
    arguments: [MECH_ARGUMENT],
    flags: {
      configuration: {
        kind: FlagKind.Text,
        summary: 'repository grant JSON; credentials remain in the server secret map',
      },
    },
    input: renamedWireStruct({
      fields: { mechId: MechId, grant: SourceGrantInput, action: ConfigureAction },
      renames: { mechId: 'mech-id', grant: 'configuration' },
    }),
  },
  'source revoke': {
    summary: 'revoke future private-source checkouts and draft publication for a mech',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'manageSource'],
    arguments: [MECH_ARGUMENT],
    flags: {},
    input: renamedWireStruct({
      fields: { mechId: MechId, grant: SourceRevokeInput, action: ConfigureAction },
      renames: { mechId: 'mech-id' },
    }),
  },
  'source checkout': {
    summary: 'checkout an immutable upstream commit through a credential-fenced full shallow Git fetch',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'manageSource'],
    arguments: [MECH_ARGUMENT],
    flags: { ...SOURCE_FLAGS, commit: { kind: FlagKind.Text, summary: 'the full immutable upstream commit SHA' } },
    input: renamedWireStruct({
      fields: { ...SOURCE_FIELDS, commit: GitCommit, action: CheckoutAction },
      renames: SOURCE_RENAMES,
    }),
  },
  'source publish': {
    summary: 'freeze selected changed files and publish one draft pull request under the current repository grant',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'manageSource'],
    arguments: [MECH_ARGUMENT],
    flags: {
      ...SOURCE_FLAGS,
      title: { kind: FlagKind.Text, summary: 'the draft title' },
      body: { kind: FlagKind.Text, summary: 'the draft description' },
      paths: { kind: FlagKind.Text, summary: 'a JSON array of reviewed changed paths, including deletions' },
    },
    input: renamedWireStruct({
      fields: { ...SOURCE_FIELDS, title: RecordName, body: RecordText, paths: SourcePathsInput, action: PublishAction },
      renames: SOURCE_RENAMES,
    }),
  },
  'source show': {
    summary: 'show a source checkout and its immutable draft publication status',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'manageSource'],
    arguments: [MECH_ARGUMENT],
    flags: SOURCE_FLAGS,
    input: renamedWireStruct({ fields: { ...SOURCE_FIELDS, action: ShowAction }, renames: SOURCE_RENAMES }),
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
