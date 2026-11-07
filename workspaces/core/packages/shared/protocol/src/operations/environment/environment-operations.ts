import { HttpMethod, MachineId, wireStruct } from '@mechane/records';
import { ProcessId, ProcessObservation, ProcessSummaries } from '@mechane/sandbox-wire';
import { MechNotFound, ServiceUnavailable } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { MechPath } from '../schemas.ts';

const EnvironmentProcessPath = wireStruct({
  fields: { ...MechPath.to.fields, machineId: MachineId, processId: ProcessId },
});

const listEnvironmentProcesses = {
  method: HttpMethod.Get,
  path: '/api/v1/workspaces/:workspace_id/mechs/:mech_id/environment/processes',
  access: Access.Member,
  params: MechPath,
  query: NoFields,
  body: NoFields,
  output: ProcessSummaries,
  errors: [MechNotFound, ServiceUnavailable],
} as const satisfies Operation;

const showEnvironmentProcess = {
  method: HttpMethod.Get,
  path: '/api/v1/workspaces/:workspace_id/mechs/:mech_id/environment/machines/:machine_id/processes/:process_id',
  access: Access.Member,
  params: EnvironmentProcessPath,
  query: NoFields,
  body: NoFields,
  output: ProcessObservation,
  errors: [MechNotFound, ServiceUnavailable],
} as const satisfies Operation;

const stopEnvironmentProcess = {
  method: HttpMethod.Post,
  path: '/api/v1/workspaces/:workspace_id/mechs/:mech_id/environment/machines/:machine_id/processes/:process_id/stop',
  access: Access.Member,
  params: EnvironmentProcessPath,
  query: NoFields,
  body: NoFields,
  output: ProcessObservation,
  errors: [MechNotFound, ServiceUnavailable],
} as const satisfies Operation;

/** Member-only inspection and exact-machine stopping for an existing mech environment. */
export const ENVIRONMENT_OPERATIONS = {
  listEnvironmentProcesses,
  showEnvironmentProcess,
  stopEnvironmentProcess,
} as const;
