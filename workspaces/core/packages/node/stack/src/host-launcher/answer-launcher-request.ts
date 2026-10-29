import { bearerAuthorization } from '@mechane/protocol';
import { HttpMethod, HttpStatusCode, RecordId } from '@mechane/records';
import { GuestSegment } from '@mechane/sandbox-wire';
import { Option, Result, Schema } from 'effect';
import type { ServedAnswer, ServedRequest } from '../types.ts';
import { reportMachine } from './report-machine.ts';
import { stopMachine } from './stop-machine.ts';
import type { HostMachines } from './types.ts';

type AnswerLauncherRequestInput = {
  readonly request: ServedRequest;
  readonly machines: HostMachines;
  readonly launcherKey: string;
};

type PathMachineIdInput = { readonly pathname: string };

/** The answer to a bearer other than the stack's own Worker. */
const UNAUTHORIZED: Readonly<ServedAnswer> = { status: HttpStatusCode.Unauthorized, headers: {}, body: '' };

/** The answer to a path or a method the launcher does not serve. */
const NOT_FOUND: Readonly<ServedAnswer> = { status: HttpStatusCode.NotFound, headers: {}, body: '' };

/**
 * Answers one request of the Worker's host provider. `PUT /machines/:machine_id` starts the machine once, with exactly
 * a container's variables, and reports it on every request after; `DELETE` stops it. Only the stack's own Worker holds
 * the launcher key, and every other bearer gets 401.
 */
export function answerLauncherRequest({ request, machines, launcherKey }: AnswerLauncherRequestInput): ServedAnswer {
  const machineId = pathMachineId({ pathname: request.url.pathname });
  const authorization = bearerAuthorization({ token: launcherKey });

  if (request.headers.authorization !== authorization) {
    return UNAUTHORIZED;
  }

  if (Option.isNone(machineId)) {
    return NOT_FOUND;
  }

  switch (request.method) {
    case HttpMethod.Put:
      return reportMachine({ request, machines, machineId: machineId.value });
    case HttpMethod.Delete:
      return stopMachine({ machines, machineId: machineId.value });
    default:
      return NOT_FOUND;
  }
}

/** The machine a `/machines/:machine_id` path names, and none for any other path. */
function pathMachineId({ pathname }: PathMachineIdInput): Option.Option<RecordId> {
  const encodedSegments = pathname.split('/');
  // The builder percent-encodes each segment, so one that does not decode names no machine.
  const segments = Result.try(() => encodedSegments.map(decodeURIComponent));

  if (Result.isFailure(segments)) {
    return Option.none();
  }

  const [root, segment, machineId, ...rest] = segments.success;

  if (root !== '' || segment !== GuestSegment.Machines || rest.length > 0) {
    return Option.none();
  }

  return Result.getSuccess(Schema.decodeUnknownResult(RecordId)(machineId));
}
