import { Array, Effect, Option, Schema } from 'effect';
import { join } from 'node:path';
import { LINT_TIMEOUT, OXLINT, WORKSPACE_FOLDER } from '../constants.ts';
import { InputUnreadable } from '../errors.ts';
import { OxlintReport } from '../schemas.ts';
import type { OxlintDiagnostic } from '../schemas.ts';
import type { Site } from '../types.ts';
import { toolOutput } from '../workspace/tool-output.ts';
import { ruleKey } from './rule-key.ts';
import type { ToolSitesInput } from './types.ts';
import { workspacePath } from './workspace-path.ts';

/** The product's oxlint configuration, relative to the workspace. */
const LINT_CONFIGURATION = '.oxlintrc.json';

/**
 * Lints `targets` with oxlint once, with type information, and returns each diagnostic as a site; a diagnostic without
 * a label, which names no line, sits at line 1.
 */
export const oxlintSites = Effect.fn('oxlintSites')(function* ({
  targets,
  inherited,
}: ToolSitesInput): Effect.fn.Return<ReadonlyArray<Site>, InputUnreadable> {
  const configuration = join(WORKSPACE_FOLDER, LINT_CONFIGURATION);
  const args = ['-c', configuration, '--threads=2', '-f', 'json', '--no-error-on-unmatched-pattern', ...targets];
  const { stdout, stderr } = yield* toolOutput({ command: OXLINT, args, inherited, timeout: LINT_TIMEOUT });

  /** A report that does not decode, with what oxlint wrote to standard error, which says why it wrote none. */
  const unreadableReport: (error: Schema.SchemaError) => InputUnreadable = (error) =>
    new InputUnreadable({ path: OXLINT, reason: `${error.message}\n${stderr}` });

  const { diagnostics } = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(OxlintReport))(stdout).pipe(
    Effect.mapError(unreadableReport),
  );

  /** A diagnostic as a site, at its first label's line. */
  const diagnosticSite: (diagnostic: OxlintDiagnostic) => Site = (diagnostic) => ({
    rule: ruleKey({ diagnostic }),
    file: workspacePath({ file: diagnostic.filename }),
    line: Option.match(Array.head(diagnostic.labels), { onNone: () => 1, onSome: ({ span }) => span.line }),
    message: [diagnostic.message, ...Option.toArray(diagnostic.help)].join(' '),
  });

  return diagnostics.map(diagnosticSite);
});
