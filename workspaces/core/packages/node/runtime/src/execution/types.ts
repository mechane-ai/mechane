import type { PresentationOutput } from '@mechane/protocol/presentation';
import type { ModelMessage, UIMessage } from 'ai';
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
  readonly inputMessage: UIMessage;
  readonly messages: ReadonlyArray<ModelMessage>;
  readonly inputMessages: ReadonlyArray<ModelMessage>;
  readonly instructions: string;
  readonly model: string;
  readonly maxOutputTokens: number;
};

export type RunOutcome = { readonly runId: string } & (
  | {
      readonly status: 'completed';
      readonly reply: string;
      readonly error: null;
      readonly presentation: PresentationOutput | null;
    }
  | {
      readonly status: 'failed' | 'cancelled';
      readonly reply: null;
      readonly error: string;
      readonly presentation: null;
    }
);

export type AdmissionInput = { readonly runId: string; readonly workflowDefinitionId: string };

export type AdmissionResult = { readonly workflowId: string };
export type RunSelection = { readonly workspaceId: string; readonly runId: string };
export type MechSelection = { readonly workspaceId: string; readonly mechId: string };
