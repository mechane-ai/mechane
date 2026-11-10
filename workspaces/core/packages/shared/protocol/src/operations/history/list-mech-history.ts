import { Schema } from 'effect';
import type { Operation } from '../../operation/types.ts';
import { MEMBER_MECH_READ } from '../mech-read.ts';
import { MechHistoryCursor, MechHistoryPage } from './schemas.ts';

const HistoryAfter = Schema.OptionFromOptionalKey(MechHistoryCursor);

/** Pages imported evidence and native conversation entries for an admitted mech. */
export const listMechHistory = {
  ...MEMBER_MECH_READ,
  path: '/api/v1/workspaces/:workspace_id/mechs/:mech_id/history',
  query: Schema.Struct({ after: HistoryAfter }),
  output: MechHistoryPage,
} as const satisfies Operation;
