import { Effect } from 'effect';
import { GenerateCommand, GenerateStatus } from './constants.ts';
import type { GenerateFailed } from './errors.ts';
import { loadGenerateSettings } from './load-generate-settings.ts';
import { pathRules } from './path-rules.ts';
import { runGenerator } from './run-generator.ts';
import { subjectRules } from './subject-rules.ts';
import type { GeneratorRun, Outcome } from './types.ts';

/**
 * Runs the command the command line names. A run of the generator fails on a stale file or a registry finding. A
 * question about the registry fails only when it names no rule or no file of the workspace.
 */
export const runRules = Effect.fn('runRules')(function* (): Effect.fn.Return<Outcome, GenerateFailed> {
  const settings = yield* loadGenerateSettings();

  switch (settings.command) {
    case GenerateCommand.Write:
    case GenerateCommand.Check:
      return yield* generatorOutcome({ command: settings.command });
    case GenerateCommand.Explain:
      return yield* subjectRules({ subject: settings.subject });
    case GenerateCommand.For:
      return yield* pathRules({ path: settings.subject });
  }
});

/** A run of the generator, which finds nothing when every file is current and the registry sound. */
const generatorOutcome = Effect.fn('generatorOutcome')(function* ({
  command,
}: GeneratorRun): Effect.fn.Return<Outcome, GenerateFailed> {
  const results = yield* runGenerator({ command });

  if (results.length === 0) {
    return { status: GenerateStatus.Current, results };
  }

  return { status: GenerateStatus.Findings, results };
});
