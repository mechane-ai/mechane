import { importBinding, originKey } from '@mechane/modules';
import type { FileFacts, PlacementIndex } from '@mechane/modules';
import { Option } from 'effect';

/** One round's index, a destination's facts, and a name. */
type BindingOfInput = {
  readonly index: PlacementIndex;
  /** Absent for a role file the round creates. */
  readonly to: Option.Option<FileFacts>;
  readonly name: string;
};

/** What a destination binds a name to now: its own declaration, or what its import of the name takes. */
export function bindingOf({ index, to, name }: BindingOfInput): Option.Option<string> {
  if (Option.isNone(to)) {
    return Option.none();
  }

  const facts = to.value;

  if (facts.names.has(name)) {
    return Option.some(originKey({ path: facts.source.path, name }));
  }

  return Option.map(importBinding({ index, facts, name }), ({ key }) => key);
}
