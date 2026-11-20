import type { PluggableSandboxProvider } from './schemas.ts';

type SandboxErrorInput = {
  readonly provider: PluggableSandboxProvider;
  readonly status: number;
  readonly isRetryable: boolean;
  readonly reason: string;
};

export class SandboxProviderError extends Error {
  override readonly name = 'SandboxProviderError';
  readonly provider: PluggableSandboxProvider;
  readonly status: number;
  readonly isRetryable: boolean;

  constructor({ provider, status, isRetryable, reason }: SandboxErrorInput) {
    super(reason);

    this.provider = provider;
    this.status = status;
    this.isRetryable = isRetryable;
  }
}
