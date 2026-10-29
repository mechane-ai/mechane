import type { CommandInvocation } from '@mechane/cli-kernel';

type OperationLabelInput = { readonly invocation: CommandInvocation };

/** The command and the origin it called, which begin each diagnostic of a failed run. */
export function operationLabel({ invocation }: OperationLabelInput): string {
  return `${invocation.command} ${invocation.origin.origin}`;
}
