import type { LocalStack } from '@mechane/stack';
import type { Account } from './auth/types.ts';

export type AccountContext = { readonly stack: LocalStack; readonly account: Account };
export type MechContext = AccountContext & { readonly mechId: string };

export type ScenarioInput = { readonly stack: LocalStack; readonly guarantee: string };

export type Scenario = {
  readonly family: string;
  readonly canUseRetainedStack?: boolean;
  readonly isStackInspection?: boolean;
  readonly timeoutMs?: number;
  readonly guarantee: string;
  readonly regression: string;
  readonly run: (input: ScenarioInput) => Promise<void>;
};
