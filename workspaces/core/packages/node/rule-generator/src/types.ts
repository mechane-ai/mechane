import type { GenerateCommand, GenerateStatus } from './constants.ts';
import type { RuleFileFields } from './schemas.ts';

/** One way the registry or a file it governs breaks a rule of the standard, at the file to change. */
export type RegistryFinding = { readonly path: string; readonly message: string };

/** An ast-grep rule file as the registry reads it: its path, id, severity, message, file patterns and fix. */
export type RuleFile = {
  readonly path: string;
  readonly id: RuleFileFields['id'];
  readonly severity: string;
  readonly message: string;
  readonly files: ReadonlyArray<string>;
  /** The files it skips; absent when it skips none of the files it scans. */
  readonly ignores: RuleFileFields['ignores'];
  /** The rewrite of each match; absent when the fix needs a person. */
  readonly fix: RuleFileFields['fix'];
};

/** A run of the generator, which writes or checks every generated file. */
export type GeneratorRun = { readonly command: typeof GenerateCommand.Write | typeof GenerateCommand.Check };

/** How a run ended: its status, and the lines of its result. */
export type Outcome = { readonly status: GenerateStatus; readonly results: ReadonlyArray<string> };
