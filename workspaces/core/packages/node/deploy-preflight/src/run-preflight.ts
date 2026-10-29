import { CREDENTIAL_VARIABLES, productionVariables, PROGRAM, RELEASE_TAG } from '@mechane/deploy-kernel';
import type { DeployFailed, OperatorModeInput } from '@mechane/deploy-kernel';
import { writeDiagnostic } from '@mechane/program';
import { Array, Effect, Option, Record } from 'effect';
import { checkAccounts } from './check-accounts.ts';
import { checkAppendOnly } from './check-append-only.ts';
import { checkCheckout } from './check-checkout.ts';
import { checkTools } from './check-tools.ts';
import { deployedState } from './deployed-state.ts';
import type { Preflight, SummaryInput } from './types.ts';

/**
 * Runs every check a deploy needs, in order, one line each, and stops at the first failure, which names the check and
 * its input. Then it prints what the deploy would change, changing nothing in production or in this checkout. The
 * settings decoded the credentials already, so their check only reports.
 */
export function runPreflight({ settings, rendered }: OperatorModeInput): Effect.Effect<Preflight, DeployFailed> {
  const { credentials } = settings;

  return Effect.gen(function* () {
    yield* checkCheckout({ settings });
    writeDiagnostic({
      program: PROGRAM,
      line: `credentials: ${Record.values(CREDENTIAL_VARIABLES).join(', ')} and configured secret references are set`,
    });

    const { origin, modelUpstream } = yield* productionVariables({ rendered });
    const key = yield* checkAccounts({ credentials, modelUpstream });
    const deployed = yield* deployedState({ settings, rendered, origin });
    const migrationTags = yield* checkAppendOnly({ settings, deployed, rendered });

    yield* checkTools({ settings, rendered });
    writeSummary({ rendered, deployed, migrationTags, credit: key });

    return { origin, deployed };
  });
}

/** Prints the tag, the revision, what production runs, each variable the deploy sets, its migrations and the limit. */
function writeSummary({ rendered, deployed, migrationTags, credit }: SummaryInput): void {
  const replaced = Option.match(deployed, { onNone: () => 'a first deploy', onSome: ({ tag }) => `replacing ${tag}` });
  const migrations = Array.match(migrationTags, { onEmpty: () => 'none', onNonEmpty: (tags) => tags.join(', ') });

  const lines = [
    `worker ${rendered.name}: tag ${RELEASE_TAG} at revision ${rendered.revision}, ${replaced}`,
    `buckets: releases ${rendered.releasesBucket}, workspace files ${rendered.workspaceBucket}`,
    ...Record.toEntries(rendered.variables).map(([name, value]) => `${name}=${value}`),
    `new migrations: ${migrations}`,
  ];

  if (Option.isSome(credit)) {
    lines.push(`the OpenRouter key's credit limit: $${credit.value.limitDollars}`);
  }

  for (const line of lines) {
    writeDiagnostic({ program: PROGRAM, line: `summary: ${line}` });
  }
}
