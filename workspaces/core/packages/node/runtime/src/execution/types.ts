import type { ModelMessage } from 'ai';
import type { Run } from '../domain.ts';

export type RunIdentity = {
  readonly workspaceId: string;
  readonly mechId: string;
  readonly sessionId: string;
  readonly runId: string;
};

export type RunContext = {
  readonly run: Run;
  readonly identity: RunIdentity;
  readonly messages: ReadonlyArray<ModelMessage>;
  readonly presentedSequence: number;
  readonly checkpointSequence: number;
  readonly isEnvironmentCheckpointRequired: boolean;
  readonly instructions: string;
  readonly model: string;
  readonly maxOutputTokens: number;
};

export type RunOutcome = { readonly runId: string } & (
  | { readonly status: 'completed'; readonly error: null }
  | { readonly status: 'failed' | 'cancelled'; readonly error: string }
);

export type AdmissionInput = { readonly runId: string; readonly workflowDefinitionId: string };

export type AdmissionResult = { readonly workflowId: string };
export type RunSelection = { readonly workspaceId: string; readonly runId: string };
export type MechSelection = { readonly workspaceId: string; readonly mechId: string };
