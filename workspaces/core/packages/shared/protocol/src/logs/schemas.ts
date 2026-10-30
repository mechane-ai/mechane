import { LimitPolicy } from '@mechane/deployment';
import { IdentityProvider, Micros, wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { KeyPurpose } from '../operations/auth/constants.ts';
import { MembershipRole } from '../operations/workspaces/constants.ts';
import { LOG_CODE_PATTERN, LogEvent } from './constants.ts';

/** The id of a record a line names, a UUID, never a token, an address or a machine's id. */
const LogId = Schema.String.check(Schema.isUUID());

/** A code a line carries, such as a refusal's reason, which no free text or token matches. */
export const LogCode = Schema.String.check(Schema.isPattern(LOG_CODE_PATTERN));

export type LogCode = typeof LogCode.Type;

/**
 * One line of the Worker's log: an event with only ids, codes and integers, so no line holds a token, a request's or
 * model's text, a command or an address. The Worker and its objects write each as one line of JSON with snake-case
 * fields, which an operator's tools and the smoke decode. A policy and a key's purpose are protocol sets; a report, an
 * error and a refusal's reason are codes the reporting Worker module owns.
 */
export const LogLine = Schema.Union([
  Schema.Struct({ event: Schema.Literal(LogEvent.RequestFailed), code: LogCode, status: Schema.Int }),
  wireStruct({
    fields: {
      event: Schema.Literal(LogEvent.RequestLimited),
      policy: Schema.Enum(LimitPolicy),
      retryAfterSeconds: Schema.Int,
    },
  }),
  wireStruct({
    fields: {
      event: Schema.Literal(LogEvent.HarnessReport),
      /** Absent for an object whose mech does not exist yet. */
      mechId: Schema.OptionFromNullOr(LogId),
      report: LogCode,
      error: LogCode,
    },
  }),
  wireStruct({
    fields: {
      event: Schema.Literal(LogEvent.ObjectReset),
      /** Absent for an object whose mech does not exist yet. */
      mechId: Schema.OptionFromNullOr(LogId),
      error: LogCode,
    },
  }),
  wireStruct({
    fields: {
      event: Schema.Literal(LogEvent.AlarmHandedOff),
      /** Absent for an object whose mech does not exist yet. */
      mechId: Schema.OptionFromNullOr(LogId),
      openDispatches: Schema.Int,
    },
  }),
  wireStruct({
    fields: {
      event: Schema.Literal(LogEvent.DispatchRefused),
      workspaceId: LogId,
      mechId: LogId,
      dispatchId: LogId,
      requestedMicros: Micros,
    },
  }),
  wireStruct({
    fields: { event: Schema.Literal(LogEvent.SandboxRefused), workspaceId: LogId, mechId: LogId, reason: LogCode },
  }),
  Schema.Struct({ event: Schema.Literal(LogEvent.EgressRefused), reason: LogCode }),
  wireStruct({
    fields: {
      event: Schema.Literal(LogEvent.SignedUp),
      principalId: LogId,
      workspaceId: LogId,
      githubUserId: Schema.Int,
    },
  }),
  wireStruct({
    fields: {
      event: Schema.Literal(LogEvent.IdentitySignedUp),
      principalId: LogId,
      workspaceId: LogId,
      provider: Schema.Enum(IdentityProvider),
    },
  }),
  wireStruct({
    fields: {
      event: Schema.Literal(LogEvent.KeyIssued),
      keyId: LogId,
      principalId: LogId,
      purpose: Schema.Enum(KeyPurpose),
    },
  }),
  wireStruct({ fields: { event: Schema.Literal(LogEvent.KeyRevoked), keyId: LogId, principalId: LogId } }),
  wireStruct({
    fields: { event: Schema.Literal(LogEvent.WorkspaceCreated), workspaceId: LogId, principalId: LogId, keyId: LogId },
  }),
  wireStruct({
    fields: {
      event: Schema.Literal(LogEvent.WorkspacePolicyChanged),
      workspaceId: LogId,
      principalId: LogId,
      keyId: LogId,
    },
  }),
  wireStruct({
    fields: {
      event: Schema.Literal(LogEvent.WorkspaceMemberSet),
      workspaceId: LogId,
      principalId: LogId,
      keyId: LogId,
      memberPrincipalId: LogId,
      role: Schema.Enum(MembershipRole),
    },
  }),
  wireStruct({
    fields: {
      event: Schema.Literal(LogEvent.WorkspaceMemberRemoved),
      workspaceId: LogId,
      principalId: LogId,
      keyId: LogId,
      memberPrincipalId: LogId,
    },
  }),
]);

export type LogLine = typeof LogLine.Type;
