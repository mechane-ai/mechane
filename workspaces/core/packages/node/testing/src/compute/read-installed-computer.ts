import { Schema } from 'effect';
import type { ManagedContext } from '../managed-context.ts';
import { requestInstalledComputer } from './request-installed-computer.ts';

export async function readInstalledComputer<S extends Schema.Codec<unknown, unknown>>(
  context: ManagedContext,
  schema: S,
  request: Parameters<typeof requestInstalledComputer>[1],
): Promise<S['Type']> {
  const response = await requestInstalledComputer(context, request);

  if (!response.ok) {
    await response.body?.cancel();

    throw new Error(`Installed computer ${request.path} returned HTTP ${response.status}`);
  }

  return Schema.decodeUnknownSync(schema)(await response.json());
}
