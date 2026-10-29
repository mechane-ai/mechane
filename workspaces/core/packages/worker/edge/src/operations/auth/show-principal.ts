import type { catalog, PrincipalAnswer } from '@mechane/protocol';
import { Effect } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

/** Answers with the principal that admission resolved the caller's key to, and that key. */
export const showPrincipal: (input: WorkInput<typeof catalog.showPrincipal>) => Effect.Effect<PrincipalAnswer> = ({
  caller,
}) => Effect.succeed({ principal: caller.principal, key: caller.key });
