import type { LocalStack } from '@mechane/stack';

export type ScenarioInput = { readonly stack: LocalStack; readonly guarantee: string };

export type Scenario = {
  readonly family: string;
  readonly canUseRetainedStack?: boolean;
  readonly timeoutMs?: number;
  readonly guarantee: string;
  readonly regression: string;
  readonly run: (input: ScenarioInput) => Promise<void>;
};
