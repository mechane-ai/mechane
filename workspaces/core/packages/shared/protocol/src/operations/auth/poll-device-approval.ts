import { HttpMethod, wireStruct } from '@mechane/records';
import { DeviceApprovalNotFound, ObjectUnavailable } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { DeviceApprovalPoll, PollToken } from './schemas.ts';

/** A poll of a device approval, by the token the CLI that started it holds. */
const PollRequest = wireStruct({ fields: { pollToken: PollToken } });

type PollRequest = typeof PollRequest.Type;

/** Answers pending until the approval is approved, then mints its key and delivers the token, once. */
export const pollDeviceApproval = {
  method: HttpMethod.Post,
  path: '/v1/device_approvals/poll',
  access: Access.Public,
  params: NoFields,
  query: NoFields,
  body: PollRequest,
  output: DeviceApprovalPoll,
  errors: [DeviceApprovalNotFound, ObjectUnavailable],
} as const satisfies Operation;
