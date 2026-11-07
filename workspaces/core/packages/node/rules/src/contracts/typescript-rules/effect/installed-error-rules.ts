import {
  AST_GREP_DEFAULTS,
  FileRole,
  OXLINT_DEFAULTS,
  RolloutPhase,
  RuleFix,
  RuleStatus,
  Severity,
} from '@mechane/rule-shapes';
import { Option } from 'effect';

/** Error settings retain direct promise callbacks at the Effect boundary. */
const OXLINT_ERROR_RULE = {
  ...OXLINT_DEFAULTS,
  standard: 'ER-04',
  status: RuleStatus.Enforced,
  phase: RolloutPhase.EffectDialect,
} as const;

/** A rule of the ast-grep folder `code-typescript-effect-errors` ships, enforced in the Effect dialect's phase. */
const AST_GREP_ASSET = {
  ...AST_GREP_DEFAULTS,
  standard: 'ER-04',
  status: RuleStatus.Enforced,
  phase: RolloutPhase.EffectDialect,
} as const;

/** The error rules retain the Effect dialect's promise settings and load the shipped syntax checks in place. */
export const INSTALLED_ERROR_RULES = [
  {
    ...OXLINT_ERROR_RULE,
    name: 'no-throw-literal',
    value: Severity.Error,
    violation: ["throw 'the file is missing';"],
    allowed: ['throw new FileUnreadable({ path });'],
  },
  {
    ...OXLINT_ERROR_RULE,
    name: 'preserve-caught-error',
    value: Severity.Error,
    fix: RuleFix.Oxlint,
    violation: ["try { read(); } catch (cause) { throw new Error('the read failed'); }"],
    allowed: ['try { read(); } catch (cause) { throw new ReadFailed({ reason: String(cause) }); }'],
  },
  { ...OXLINT_ERROR_RULE, name: 'unicorn/throw-new-error', value: Severity.Off, fix: RuleFix.Oxlint },
  {
    ...AST_GREP_ASSET,
    name: 'untagged-errors-typescript',
    exemptRoles: [FileRole.Browser, FileRole.NativeRuntime, FileRole.NativePresentation],
    derivedFrom: Option.some({
      asset: 'assets/ast-grep/rules/untagged-errors-typescript.yml',
      hash: 'blake3:69108b9344d9e5fad0783c0a9e32d842121b458e13a661a2800ad5396ee9f068',
    }),
    violation: ["const failure = new Error('x');", "Effect.dieMessage('the row is missing');"],
    allowed: ['const failure = new FileUnreadable({ path });'],
  },
  {
    ...AST_GREP_ASSET,
    name: 'catch-handlers-typescript',
    exemptRoles: [FileRole.Browser, FileRole.NativeRuntime, FileRole.NativePresentation],
    derivedFrom: Option.some({
      asset: 'assets/ast-grep/rules/catch-handlers-typescript.yml',
      hash: 'blake3:70f68641b20c4206e559382910fbed80b94979c816b2b31b7e4f2441e61eca24',
    }),
    violation: ['promise.catch(() => {});', 'try { read(); } catch { stop(); }'],
    allowed: [
      'Effect.tryPromise({ try: () => open(path), catch: (cause) => new Unreadable({ path, reason: String(cause) }) });',
    ],
  },
  {
    ...AST_GREP_ASSET,
    name: 'promise-chains-typescript',
    derivedFrom: Option.some({
      asset: 'assets/ast-grep/rules/promise-chains-typescript.yml',
      hash: 'blake3:4ba4789a552288ff904193f522fd3b40a91fb15b40a4eee6052a6347a9d9a6fb',
    }),
    exemptRoles: [FileRole.Browser, FileRole.NativeRuntime, FileRole.NativePresentation],
    status: RuleStatus.Ratchet,
    violation: ['promise.then(read);', 'promise.finally(close);'],
    allowed: ['const result = await promise;'],
  },
] as const;
