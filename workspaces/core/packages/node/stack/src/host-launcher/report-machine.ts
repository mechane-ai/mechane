import { HttpHeader, HttpStatusCode, MediaType } from '@mechane/records';
import type { RecordId } from '@mechane/records';
import { HostMachine, HostMachineStart } from '@mechane/sandbox-wire';
import { Option, Result, Schema } from 'effect';
import type { ServedAnswer, ServedRequest } from '../types.ts';
import type { HostMachines } from './types.ts';

type ReportMachineInput = {
  readonly request: ServedRequest;
  readonly machines: HostMachines;
  readonly machineId: RecordId;
};

/** Starts or reports the machine; a start that names other variables, or another machine, is refused. */
export function reportMachine({ request, machines, machineId }: ReportMachineInput): ServedAnswer {
  const decoded = Schema.decodeUnknownResult(Schema.fromJsonString(HostMachineStart), { onExcessProperty: 'error' })(
    request.body,
  );

  const start = Option.filter(Result.getSuccess(decoded), (started) => started.environment.machineId === machineId);

  if (Option.isNone(start)) {
    return { status: HttpStatusCode.BadRequest, headers: {}, body: '' };
  }

  const machine = machines.report({ machineId, environment: start.value.environment });

  return {
    status: HttpStatusCode.Ok,
    headers: { [HttpHeader.ContentType]: MediaType.Json },
    // The launcher built the report to its schema's type, so encoding it cannot fail.
    body: Schema.encodeSync(Schema.fromJsonString(HostMachine))(machine),
  };
}
