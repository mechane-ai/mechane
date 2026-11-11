import type { CelldBinary, Environment, LocalProviders, LocalStack, StackOptions } from '../types.ts';

export type DevelopmentSettingsInput = {
  readonly args?: ReadonlyArray<string>;
  readonly environment?: Environment;
  readonly worktreeDirectory?: string;
};

type DevelopmentReadyInput = { readonly stack: LocalStack; readonly signal: AbortSignal };

type DevelopmentPrepareInput = {
  readonly origin: URL;
  readonly providers: LocalProviders;
  readonly environment: Environment;
};

export type DevelopmentPreparation = {
  readonly options?: Partial<StackOptions>;
  readonly ready?: (input: DevelopmentReadyInput) => Promise<void>;
  readonly close?: () => Promise<void>;
};

type DevelopmentText = { readonly channel: 'stdout' | 'stderr'; readonly text: string };

export type DevelopmentScenarioInput = {
  readonly stack: LocalStack;
  readonly name: string;
  readonly environment: Environment;
  readonly nodeExecutable: string;
  readonly celldBinary: CelldBinary | undefined;
  readonly write: (input: DevelopmentText) => Promise<void>;
};

export type DevelopmentScenario = (input: DevelopmentScenarioInput) => Promise<void>;

export type DevelopmentInput = DevelopmentSettingsInput & {
  readonly prepare?: (input: DevelopmentPrepareInput) => Promise<DevelopmentPreparation>;
  readonly runScenario?: DevelopmentScenario;
};
