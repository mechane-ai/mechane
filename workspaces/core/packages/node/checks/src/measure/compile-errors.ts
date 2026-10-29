import { CHILD_TIMEOUT, toolOutput, WORKSPACE_FOLDER } from '@mechane/checks-kernel';
import type { InputUnreadable, Member } from '@mechane/checks-kernel';
import type { ProcessRun } from '@mechane/program';
import { RuleStatus, RuleTool } from '@mechane/rule-shapes';
import type { RegisteredRule, Rule } from '@mechane/rule-shapes';
import { Effect } from 'effect';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The TypeScript compiler the workspace installs, by the `bin` its package declares. */
const TSC = fileURLToPath(new URL('../../../../../node_modules/typescript/bin/tsc', import.meta.url));

/** What the compiler prints in each line that reports an error, such as `src/main.ts(3,7): error TS2322: …`. */
const COMPILER_ERROR = 'error TS';

/** A compiler option of the registry. */
type CompilerRule = Extract<Rule, Readonly<Record<'tool', typeof RuleTool.Compiler>>>;

type CompileErrorsInput = {
  readonly members: ReadonlyArray<Member>;
  readonly rules: ReadonlyArray<RegisteredRule>;
  readonly inherited: Readonly<Record<string, string>>;
};

/**
 * The compiler's errors over every member's program with each proposed compiler option set to the standard's value. The
 * options measure together, so only zero lets them run; with none proposed, nothing compiles.
 */
export const compileErrors = Effect.fn('compileErrors')(function* ({
  members,
  rules,
  inherited,
}: CompileErrorsInput): Effect.fn.Return<number, InputUnreadable> {
  /** A proposed option's flag and the standard's value for it. */
  const optionFlags: (rule: CompilerRule) => ReadonlyArray<string> = ({ name, value }) => [`--${name}`, String(value)];

  const flags = rules
    .map(({ rule }) => rule)
    .filter((rule) => rule.tool === RuleTool.Compiler)
    .filter(({ status }) => status === RuleStatus.Proposed)
    .flatMap(optionFlags);

  if (flags.length === 0) {
    return 0;
  }

  /** Compiles one member's program with the proposed options. */
  const compileMember: (member: Member) => Effect.Effect<ProcessRun, InputUnreadable> = ({ folder }) => {
    const project = join(WORKSPACE_FOLDER, folder);

    return toolOutput({
      command: TSC,
      args: ['-p', project, '--checkers', '2', ...flags],
      inherited,
      timeout: CHILD_TIMEOUT,
    });
  };

  const runs = yield* Effect.forEach(members, compileMember, { concurrency: 1 });

  return runs.flatMap(({ stdout }) => stdout.split('\n')).filter((line) => line.includes(COMPILER_ERROR)).length;
});
