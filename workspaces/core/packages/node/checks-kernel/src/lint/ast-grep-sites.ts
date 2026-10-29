import { exitStatusText } from '@mechane/program';
import { Effect, Option, Schema } from 'effect';
import { join } from 'node:path';
import { AST_GREP, AST_GREP_CONFIGURATION, FINISHED_STATUSES, LINT_TIMEOUT, WORKSPACE_FOLDER } from '../constants.ts';
import { InputUnreadable } from '../errors.ts';
import type { Site } from '../types.ts';
import { toolOutput } from '../workspace/tool-output.ts';
import type { ToolSitesInput } from './types.ts';
import { workspacePath } from './workspace-path.ts';

/** The id of an ast-grep rule, which its file declares and each of its matches names. */
const AstGrepRuleId = Schema.String.pipe(Schema.brand('AstGrepRuleId'));

/** One line of `ast-grep scan --json=stream`: the rule, the file, the match's range from line 0, and the message. */
const AstGrepMatch = Schema.Struct({
  ruleId: AstGrepRuleId,
  file: Schema.String,
  message: Schema.String,
  range: Schema.Struct({ start: Schema.Struct({ line: Schema.Int }) }),
});

/**
 * Scans `targets` with every ast-grep rule once and returns each match as a site, an unused suppression among them. A
 * rule that does not parse ends the scan with another status, which fails rather than finding nothing.
 */
export const astGrepSites = Effect.fn('astGrepSites')(function* ({
  targets,
  inherited,
}: ToolSitesInput): Effect.fn.Return<ReadonlyArray<Site>, InputUnreadable> {
  const configuration = join(WORKSPACE_FOLDER, AST_GREP_CONFIGURATION);
  const args = ['scan', '-c', configuration, '--json=stream', '--error=unused-suppression', ...targets];
  const { status, stdout, stderr } = yield* toolOutput({ command: AST_GREP, args, inherited, timeout: LINT_TIMEOUT });

  if (!Option.exists(status, (code) => FINISHED_STATUSES.has(code))) {
    return yield* new InputUnreadable({
      path: AST_GREP,
      reason: `it exited ${exitStatusText({ status })}: ${stderr.trim()}`,
    });
  }

  const lines = stdout.split('\n').filter((line) => line !== '');

  const matches = yield* Schema.decodeUnknownEffect(Schema.Array(Schema.fromJsonString(AstGrepMatch)))(lines).pipe(
    Effect.mapError((error) => new InputUnreadable({ path: AST_GREP, reason: error.message })),
  );

  /** A match as a site, at its line from 1. */
  const matchSite: (match: typeof AstGrepMatch.Type) => Site = (match) => ({
    rule: match.ruleId,
    file: workspacePath({ file: match.file }),
    line: match.range.start.line + 1,
    message: match.message,
  });

  return matches.map(matchSite);
});
