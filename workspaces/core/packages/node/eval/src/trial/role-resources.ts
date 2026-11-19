import { CreationRequestId, HttpStatusCode } from '@mechane/records';
import { Effect, Option, Schema } from 'effect';
import { join } from 'node:path';
import type { RoleIntent } from '../application-schemas.ts';
import type { RoleContext } from '../application-types.ts';
import { EvalAdapterFailed, EvalAdapterOperation } from '../errors.ts';
import { managedRequest } from '../managed-request.ts';
import { onceFile } from '../store/once-file.ts';
import type { EvalRunFailure, OnceFile } from '../types.ts';

export type EvalSession = Awaited<ReturnType<RoleContext['target']['managed']['beta']['sessions']['retrieve']>>;
export type OwnedResource = Pick<EvalSession, 'id' | 'metadata'>;
type ResourceKind = 'agent' | 'environment' | 'session';

type Lookup<R extends OwnedResource> = {
  readonly context: RoleContext;
  readonly intent: RoleIntent;
  readonly kind: ResourceKind;
  readonly list: (signal: AbortSignal) => AsyncIterable<R>;
};

type Attempt = Omit<Lookup<OwnedResource>, 'list'>;
const AttemptRecord = Schema.Struct({ creationRequestId: CreationRequestId });
const RefusalRecord = Schema.Struct({ creationRequestId: CreationRequestId, status: Schema.Int });
const HTTP_UNPROCESSABLE_ENTITY = 422;
const HTTP_UNSUPPORTED_MEDIA_TYPE = 415;

const DEFINITIVE_REFUSALS: ReadonlySet<number> = new Set([
  HttpStatusCode.BadRequest,
  HttpStatusCode.Unauthorized,
  HttpStatusCode.Forbidden,
  HttpStatusCode.NotFound,
  HttpStatusCode.MethodNotAllowed,
  HttpStatusCode.PayloadTooLarge,
  HTTP_UNSUPPORTED_MEDIA_TYPE,
  HTTP_UNPROCESSABLE_ENTITY,
  HttpStatusCode.TooManyRequests,
]);

type ProvisioningFailure = { readonly reason: string };
type Ownership = { readonly resource: OwnedResource; readonly intent: RoleIntent };

export function provisioningIssue({ reason }: ProvisioningFailure): EvalAdapterFailed {
  return new EvalAdapterFailed({ operation: EvalAdapterOperation.VerifyRoleSettings, reason });
}

export function isOwned({ resource, intent }: Ownership): boolean {
  return resource.metadata['eval_creation_id'] === intent.creationRequestId;
}

function attemptFile({ context, intent, kind }: Attempt): OnceFile<typeof AttemptRecord.Type> {
  const path = join(context.files.folder, `${intent.role}-${kind}-attempt.json`);

  return onceFile({ path, schema: AttemptRecord });
}

function refusalFile({ context, intent, kind }: Attempt): OnceFile<typeof RefusalRecord.Type> {
  const path = join(context.files.folder, `${intent.role}-${kind}-refusal.json`);

  return onceFile({ path, schema: RefusalRecord });
}

/** A lost create receipt is recovered by role identity because the API gives create no idempotency guarantee. */
export const recoverRoleResource = Effect.fn('recoverRoleResource')(function* <R extends OwnedResource>(
  input: Lookup<R>,
): Effect.fn.Return<Option.Option<R>, EvalRunFailure> {
  const attempted = yield* attemptFile(input).read();

  if (Option.isNone(attempted)) {
    return Option.none<R>();
  }

  if (attempted.value.creationRequestId !== input.intent.creationRequestId) {
    return yield* provisioningIssue({ reason: `The ${input.kind} attempt belongs to another role` });
  }

  const refused = yield* refusalFile(input).read();

  if (Option.isSome(refused)) {
    if (refused.value.creationRequestId !== input.intent.creationRequestId) {
      return yield* provisioningIssue({ reason: `The ${input.kind} refusal belongs to another role` });
    }

    return Option.none<R>();
  }

  const found = yield* managedRequest({
    action: `Recover eval ${input.kind}`,
    operation: async (signal) => {
      let match = Option.none<R>();

      for await (const resource of input.list(signal)) {
        if (isOwned({ resource, intent: input.intent })) {
          if (Option.isSome(match)) {
            return { match, ambiguous: true };
          }

          match = Option.some(resource);
        }
      }

      return { match, ambiguous: false };
    },
  });

  if (found.ambiguous) {
    return yield* provisioningIssue({
      reason: 'Multiple resources share this creation request. Inspect the recorded attempt',
    });
  }

  if (Option.isNone(found.match)) {
    return yield* provisioningIssue({
      reason: 'The creation request has no visible receipt yet. Its outcome is uncertain',
    });
  }

  return found.match;
});

type Creation<R extends OwnedResource> = Lookup<R> & { readonly create: (signal: AbortSignal) => Promise<R> };
type Rejection = { readonly input: Attempt; readonly failure: EvalAdapterFailed };

const recordRefusal = Effect.fn('recordRefusal')(function* ({
  input,
  failure,
}: Rejection): Effect.fn.Return<never, EvalRunFailure> {
  const status = Option.fromUndefinedOr(failure.httpStatus);

  if (Option.isSome(status) && DEFINITIVE_REFUSALS.has(status.value)) {
    yield* refusalFile(input).create({
      record: { creationRequestId: input.intent.creationRequestId, status: status.value },
    });
  }

  return yield* failure;
});

export const openRoleResource = Effect.fn('openRoleResource')(function* <R extends OwnedResource>(
  input: Creation<R>,
): Effect.fn.Return<R, EvalRunFailure> {
  const prior = yield* recoverRoleResource(input);

  if (Option.isSome(prior)) {
    return prior.value;
  }

  const refusal = refusalFile(input);
  const refused = yield* refusal.read();

  if (Option.isSome(refused)) {
    return yield* provisioningIssue({
      reason: `Creation of the ${input.kind} was rejected with HTTP ${refused.value.status}`,
    });
  }

  yield* attemptFile(input).create({ record: { creationRequestId: input.intent.creationRequestId } });

  const attempt = managedRequest({ action: `Create eval ${input.kind}`, operation: input.create });

  const created = yield* attempt.pipe(
    Effect.catchTags({ EvalAdapterFailed: (failure) => recordRefusal({ input, failure }) }),
  );

  if (!isOwned({ resource: created, intent: input.intent })) {
    return yield* provisioningIssue({ reason: 'The returned resource belongs to a different creation request' });
  }

  return created;
});
