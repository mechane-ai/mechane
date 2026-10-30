import { WorkspacePolicy } from '@mechane/protocol';
import { WorkspacePolicyMutation } from '@mechane/rpc';
import type { WorkspaceVariables } from '@mechane/rpc';
import type { WorkspaceStore } from '@mechane/workspace-store';
import { Option, Schema } from 'effect';
import { isPolicyWithinLimits } from './is-policy-within-limits.ts';

type SavePolicyInput = {
  readonly store: WorkspaceStore;
  readonly settings: WorkspaceVariables;
  readonly policy: WorkspacePolicy;
  readonly isCreateOnly: boolean;
};

/** Create-only retries compare the stored policy atomically, before installation ceilings can mask a difference. */
export function savePolicy({ store, settings, policy, isCreateOnly }: SavePolicyInput): WorkspacePolicyMutation {
  const save: () => WorkspacePolicyMutation = () => {
    const stored = store.readPolicy();

    if (isCreateOnly && Option.isSome(stored)) {
      const isSamePolicy = Schema.toEquivalence(WorkspacePolicy);

      if (isSamePolicy(stored.value, policy)) {
        return WorkspacePolicyMutation.cases.Saved.make({ policy: stored.value });
      }

      return WorkspacePolicyMutation.cases.AlreadyExists.make({});
    }

    if (!isPolicyWithinLimits({ settings, policy })) {
      return WorkspacePolicyMutation.cases.LimitsExceeded.make({});
    }

    store.savePolicy({ policy });

    return WorkspacePolicyMutation.cases.Saved.make({ policy });
  };

  return store.atomic({ run: save });
}
