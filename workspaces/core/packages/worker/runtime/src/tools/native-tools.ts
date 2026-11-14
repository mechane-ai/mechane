import type { ControlStore } from '@mechane/control-store';
import { NativeToolName } from '@mechane/protocol';
import { Schema } from 'effect';

type NativeToolPolicy = {
  readonly name: string;
  readonly nativeTools: ReadonlyArray<NativeToolName> | null | undefined;
};

export function permitsNativeTool({ name, nativeTools }: NativeToolPolicy): boolean {
  if (name.startsWith('mcp_')) {
    return true;
  }

  if (!Schema.is(NativeToolName)(name)) {
    return false;
  }

  return nativeTools === null || nativeTools === undefined || nativeTools.includes(name);
}

type CurrentNativeToolInput = {
  readonly store: ControlStore;
  readonly workspaceId: string;
  readonly mechId: string;
  readonly name: string;
};

export async function isNativeToolCurrent({ store, ...input }: CurrentNativeToolInput): Promise<boolean> {
  if (input.name.startsWith('mcp_')) {
    return true;
  }

  if (!Schema.is(NativeToolName)(input.name)) {
    return false;
  }

  const mech = await store.getMech(input);

  return permitsNativeTool({ name: input.name, nativeTools: mech.nativeTools });
}
