import { listKeys } from './list-keys.ts';
import { pollDeviceApproval } from './poll-device-approval.ts';
import { revokeKey } from './revoke-key.ts';
import { showPrincipal } from './show-principal.ts';
import { startDeviceApproval } from './start-device-approval.ts';

/** Device sign-in, principal identity and API key operations. */
export const AUTH_OPERATIONS = { startDeviceApproval, pollDeviceApproval, showPrincipal, listKeys, revokeKey } as const;
