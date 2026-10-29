import { call } from '@mechane/client';
import { StepSubject } from '@mechane/program';
import { failureCode } from '@mechane/protocol';
import type { Readiness } from '@mechane/protocol';
import { Duration, Effect, Match, Option } from 'effect';
import { DEPLOY_USER_AGENT, DeployStep, REQUEST_TIMEOUT } from '../constants.ts';
import { DeployFailed } from '../errors.ts';
import type { OriginInput } from '../types.ts';
import type { DescribeFailureInput } from './types.ts';

/** What production's readiness reports: its release, its worker revision, and each class's schema revision. */
export function readReadiness({ origin }: OriginInput): Effect.Effect<Readiness, DeployFailed> {
  const subjects = [StepSubject.cases.Url.make({ url: origin })];

  return call({
    origin,
    name: 'readiness',
    input: {},
    credential: Option.none(),
    timeout: REQUEST_TIMEOUT,
    userAgent: DEPLOY_USER_AGENT,
  }).pipe(
    Effect.mapError(
      (failure) => new DeployFailed({ step: DeployStep.ReadReadiness, subjects, reason: describeFailure({ failure }) }),
    ),
  );
}

/** A client's failure in words, for a diagnostic. */
export function describeFailure({ failure }: DescribeFailureInput): string {
  return Match.valueTags(failure, {
    OperationFailed: (failed) => `${failureCode({ failure: failed.failure })}: ${failed.message}`,
    OriginUnreachable: ({ reason }) => `no server answered: ${reason}`,
    RequestTimedOut: ({ timeout }) => `no answer within ${Duration.format(timeout)}`,
    ResponseUnreadable: ({ status, reason }) => `an answer of status ${status} that does not decode: ${reason}`,
  });
}
