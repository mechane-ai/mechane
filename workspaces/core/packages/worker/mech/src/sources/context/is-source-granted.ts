import { SourceGrant } from '@mechane/protocol';
import { Option, Schema } from 'effect';
import type { SourceTaskInput } from '../types.ts';

/** Editing or revoking a grant invalidates further authority under its recorded snapshot. */
export async function isSourceGranted({ mech, source }: SourceTaskInput): Promise<boolean> {
  const current = await mech.store.atomic({ run: (store) => store.sourceGrant() });

  if (Option.isNone(current)) {
    return false;
  }

  const encode = Schema.encodeSync(Schema.fromJsonString(SourceGrant));

  return encode(current.value) === encode(source.grant);
}
