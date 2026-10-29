import { ADOPTED, AST_GREP_DEFAULTS, InstalledAsset, RolloutPhase, RuleStatus } from '@mechane/rule-shapes';
import type { ContractEnforcement } from '@mechane/rule-shapes';
import { Option } from 'effect';

/** A rule of the ast-grep folder `code-closed-value-sets` ships, which names HTTP words by their sets (SC-12). */
const AST_GREP_ASSET = {
  ...AST_GREP_DEFAULTS,
  asset: InstalledAsset.AstGrepRules,
  standard: 'SC-12',
  phase: RolloutPhase.DataShapes,
} as const;

/**
 * A copy of a rule of that folder for the test support package, whose folder the shipped rules' test patterns skip,
 * since SC-12 exempts no test code.
 */
const TESTING_COPY = {
  ...AST_GREP_DEFAULTS,
  standard: 'SC-12',
  status: RuleStatus.Enforced,
  phase: RolloutPhase.DataShapes,
} as const;

/**
 * What enforces `code-closed-value-sets`: HTTP methods and status codes by their sets, in the test support package too,
 * members compared by name, and tagged unions built by their schema.
 */
export const codeClosedValueSets = {
  values: {},
  rules: [
    {
      ...AST_GREP_ASSET,
      name: 'http-method-literals-typescript',
      status: RuleStatus.Ratchet,
      violation: ["const init = { method: 'POST' };", "const methods = ['GET', 'HEAD'];"],
      allowed: ['const init = { method: HttpMethod.Post };'],
    },
    {
      ...AST_GREP_ASSET,
      name: 'http-status-literals-typescript',
      status: RuleStatus.Enforced,
      violation: ['const answer = { status: 404 };'],
      allowed: ['const answer = { status: HttpStatusCode.NotFound };'],
    },
    {
      ...AST_GREP_ASSET,
      name: 'member-chains-typescript',
      standard: '014',
      status: RuleStatus.Ratchet,
      violation: ['const isEnded = state === State.Stopped || state === State.Failed;'],
      allowed: ['const isEnded = ENDED_STATES.has(state);'],
    },
    {
      ...AST_GREP_ASSET,
      name: 'membership-lists-typescript',
      standard: '014',
      status: RuleStatus.Enforced,
      violation: ['const isEnded = [State.Stopped, State.Failed].includes(state);'],
      allowed: ['const isEnded = ENDED_STATES.has(state);'],
    },
    {
      ...TESTING_COPY,
      name: 'testing-http-method-literals',
      derivedFrom: Option.some({
        asset: 'assets/ast-grep/rules/http-method-literals-typescript.yml',
        hash: 'blake3:3c7e614f3e9435da9b37525e0427a13aa981c98088800c2dfca7daf9ed30521d',
      }),
      violation: [
        "const answer = await fetch(url, { method: 'POST' });",
        "export const verb = 'POST';",
        "type ReadMethod = 'GET' | 'HEAD';",
        "if (request.method === 'head') { stop(); }",
      ],
      allowed: ['const answer = await fetch(url, { method: HttpMethod.Post });', "const ref = 'HEAD';"],
    },
    {
      ...TESTING_COPY,
      name: 'testing-http-status-literals',
      derivedFrom: Option.some({
        asset: 'assets/ast-grep/rules/http-status-literals-typescript.yml',
        hash: 'blake3:ed4e21fb25e6f843678bd53bc5fe489cfc2608a4befa2d3adbd1e60231147427',
      }),
      violation: ['expect({ status: 404 });', 'type ErrorStatus = 404 | 410;', 'response.status = 500;'],
      allowed: ['expect({ status: HttpStatusCode.NotFound });', 'const limit = { attempts: 404 };'],
    },
    {
      ...AST_GREP_DEFAULTS,
      name: 'hand-written-tag',
      standard: 'TD-20',
      status: RuleStatus.Ratchet,
      phase: RolloutPhase.DataShapes,
      violation: ["type Answer = { readonly _tag: 'Settled' };", "const answer = { _tag: 'Settled', receipt };"],
      allowed: ['const answer = Answer.cases.Settled.make({ receipt });'],
    },
    {
      ...AST_GREP_DEFAULTS,
      ...ADOPTED,
      name: 'literal-comparison',
      standard: 'TD-19',
      violation: ["if (status === 'proposed') { stop(); }", "switch (status) { case 'proposed': stop(); }"],
      allowed: [
        'if (status === RuleStatus.Proposed) { stop(); }',
        "if (typeof value === 'string') { stop(); }",
        "if (text === '') { stop(); }",
      ],
    },
    {
      ...AST_GREP_DEFAULTS,
      name: 'raw-literal-schema',
      standard: 'TD-19',
      status: RuleStatus.Enforced,
      phase: RolloutPhase.DataShapes,
      violation: ["const Step = Schema.Literal('approve');", "const Status = Schema.Literals(['starting', 'ready']);"],
      allowed: [
        'const Step = Schema.Literal(DeviceStep.Approve);',
        'const Status = Schema.Literals([MachineStatus.Starting, MachineStatus.Ready]);',
      ],
    },
  ],
} as const satisfies ContractEnforcement;
