import { listQuery, PAGE_RENAMES, renamedWireStruct } from '@mechane/records';
import { ExecutionId } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import { SourceCompletion } from '../../import/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { OPERATOR_MECH_READ } from '../mech-read.ts';

const Completions = Schema.Array(SourceCompletion);
const NextCursor = Schema.OptionFromNullOr(ExecutionId);

export const listArchivedCompletions = {
  ...OPERATOR_MECH_READ,
  path: '/api/operator/workspaces/:workspace_id/mechs/:mech_id/archived-completions',
  query: listQuery({ cursor: ExecutionId }),
  output: renamedWireStruct({
    fields: { completions: Completions, hasMore: Schema.Boolean, nextCursor: NextCursor },
    renames: PAGE_RENAMES,
  }),
} as const satisfies Operation;
