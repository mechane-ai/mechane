import { SandboxProvider } from '@mechane/deployment';
import type { SandboxStore } from '@mechane/sandbox-store';
import { Option } from 'effect';

type NativeWorkspacePendingInput = { readonly store: SandboxStore; readonly providerName: string };

/** Changing a deployment default must never make native files look like an empty portable workspace. */
export function nativeWorkspacePending({ store, providerName }: NativeWorkspacePendingInput): boolean {
  const binding = store.workspace().provider;

  return providerName !== SandboxProvider.Tensorlake && Option.contains(binding, SandboxProvider.Tensorlake);
}
