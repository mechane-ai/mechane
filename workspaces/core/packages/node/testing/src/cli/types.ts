import type { LocalStack } from '@mechane/stack';
import type { Schema } from 'effect';

export type CliAccount = { readonly configurationRoot: string };

export type CliInput = {
  readonly stack: Pick<LocalStack, 'origin' | 'cli'>;
  readonly account: CliAccount;
  readonly args: ReadonlyArray<string>;
  readonly environment?: Readonly<Record<string, string>>;
};

export type CliResult = {
  readonly status: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
};

export type CliNotice = { readonly url: URL; readonly userCode: string };

export type RunningCli = {
  readonly finished: Promise<CliResult>;
  readonly waitForApproval: () => Promise<CliNotice>;
  readonly stop: () => Promise<void>;
};

export type RunCliInput<Output extends Schema.Codec<unknown, unknown>> = CliInput & { readonly schema: Output };
