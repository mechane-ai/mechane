import { RuleTool } from '@mechane/rule-shapes';
import type { AstGrepRule } from '@mechane/rule-shapes';
import { REGISTERED_RULES } from '@mechane/rules';
import { Effect, Option } from 'effect';
import { isSeq, parseDocument, Scalar, YAMLSeq } from 'yaml';
import type { GenerateFailed } from '../errors.ts';
import { readInput } from '../files/read-input.ts';
import { writeFiles } from '../files/write-files.ts';
import type { RuleFile } from '../types.ts';
import { exemptGlobs } from './ignore-findings.ts';
import { readRuleFiles } from './read-rule-files.ts';

/** Role declarations own SDK boundaries; matcher authors keep their existing scopes and additional exclusions. */
export const syncRoleIgnores = Effect.fn('syncRoleIgnores')(function* (): Effect.fn.Return<void, GenerateFailed> {
  const rules = REGISTERED_RULES.map(({ rule }) => rule);
  const astGrep = rules.filter((rule) => rule.tool === RuleTool.AstGrep);
  const files = yield* readRuleFiles();

  yield* Effect.forEach(files, (file) => syncRuleIgnores({ astGrep, file }), { concurrency: 1 });
});

type SyncRuleIgnoresInput = { readonly astGrep: ReadonlyArray<AstGrepRule>; readonly file: RuleFile };
type QuotedGlobInput = { readonly glob: string };

/** Appends newly declared role exclusions while retaining the matcher's existing YAML styles. */
const syncRuleIgnores = Effect.fn('syncRuleIgnores')(function* ({
  astGrep,
  file,
}: SyncRuleIgnoresInput): Effect.fn.Return<void, GenerateFailed> {
  const ignored: ReadonlyArray<string> = Option.getOrElse(file.ignores, () => []);
  const exempted = exemptGlobs({ astGrep, id: file.id });
  const missing = exempted.filter((glob) => !ignored.includes(glob));

  if (missing.length === 0) {
    return;
  }

  const text = yield* readInput({ path: file.path });
  const document = parseDocument(text);
  const existing = document.get('ignores', true);
  const sequence = new YAMLSeq(document.schema);
  const unique = [...new Set(missing)];
  const added = unique.map((glob) => quotedGlob({ glob }));

  if (isSeq(existing)) {
    existing.items = [...existing.items, ...added];
  } else {
    sequence.items = added;

    document.set('ignores', sequence);
  }

  const rendered = document.toString({ lineWidth: 0 });

  yield* writeFiles({ files: [{ path: file.path, text: rendered }], strays: [] });
});

/** Keeps glob patterns quoted when the existing matcher uses a flow-style sequence. */
function quotedGlob({ glob }: QuotedGlobInput): Scalar<string> {
  const scalar = new Scalar(glob);

  scalar.type = Scalar.QUOTE_SINGLE;

  return scalar;
}
