import type { WorkspacePolicy } from '@mechane/protocol';
import type { RecordsInput } from '@mechane/store';
import type { Option } from 'effect';
import { readPolicy } from './read-policy.ts';
import { writePolicy } from './write-policy.ts';

type SavePolicyInput = { readonly policy: WorkspacePolicy };

/** Explicit workspace policy is stored independently of installation defaults and ceilings. */
export function policyRecords({ sql }: RecordsInput) {
  return {
    readPolicy: (): Option.Option<WorkspacePolicy> => readPolicy({ sql }),
    savePolicy: ({ policy }: SavePolicyInput): void => writePolicy({ sql, policy }),
  };
}
