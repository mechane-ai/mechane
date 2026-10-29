import { HttpMethod } from '@mechane/records';
import { Schema } from 'effect';
import { ObjectUnavailable, RateLimited } from '../../errors/errors.ts';
import { Access } from '../../operation/constants.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { KeyPurpose } from './constants.ts';
import { DeviceApproval, KeyName } from './schemas.ts';

const DeviceApprovalRequest = Schema.Struct({ purpose: Schema.Enum(KeyPurpose), name: KeyName });

type DeviceApprovalRequest = typeof DeviceApprovalRequest.Type;

/**
 * Starts a device approval for a login or a named key. It needs no credential, a browser session approves it, and each
 * client address may start only so many in a window.
 */
export const startDeviceApproval = {
  method: HttpMethod.Post,
  path: '/v1/device_approvals',
  access: Access.Public,
  params: NoFields,
  query: NoFields,
  body: DeviceApprovalRequest,
  output: DeviceApproval,
  errors: [ObjectUnavailable, RateLimited],
} as const satisfies Operation;
