import { AST_GREP_DEFAULTS, FileRole, RolloutPhase, RuleStatus } from '@mechane/rule-shapes';

/**
 * The rules of how `code-style` writes a function. A value is chosen in an IIFE, a callback is typed and passed by
 * name, a called const takes one object, and a behavior file holds two top-level functions.
 */
export const STYLE_FUNCTION_RULES = [
  {
    ...AST_GREP_DEFAULTS,
    name: 'iife-form',
    standard: 'SC-01',
    status: RuleStatus.Enforced,
    phase: RolloutPhase.EffectDialect,
    violation: [
      'const value = (() => { return 1; })();',
      'const delay: number = (async () => { return await wait(); })();',
      'const total: number = (() => { let sum = 0; for (const item of items) { sum += item; } return sum; })();',
      'const doubled: number = ((count) => { return count * 2; })(items);',
    ],
    allowed: [
      'const wait: Duration.Duration = (() => { if (isFollowing) { return WAIT_MAX; } return LISTING_WAIT; })();',
      'const references: ReadonlyArray<ObjectReference> = (() => { if (isTip) { return [object]; } const manifests = archiveManifests({ archive }); return manifests.flatMap(manifestReferences); })();',
    ],
  },
  {
    ...AST_GREP_DEFAULTS,
    name: 'inline-function-argument',
    standard: 'SC-02',
    status: RuleStatus.Ratchet,
    phase: RolloutPhase.EffectDialect,
    violation: [
      'const ids = items.map((item) => { return item.id; });',
      'run({ onEvent: (event) => process.stderr.write(eventLine(JSON.stringify(event))) });',
      'const lines = cases.flatMap(({ id, description }) => [headingLine({ id }), description]);',
      'const answered = route.pipe(Effect.catch((failure) => Effect.succeed(pages.map((page) => page.path))));',
      'const count = Effect.catch(readCount(), (failure) => Effect.succeed(fallbackCount({ failure })));',
    ],
    allowed: [
      'const ids = items.map((item) => item.id);',
      'const texts = parts.map((part) => readText({ part }));',
      'const writeEvent: (event: StreamEvent) => void = (event) => process.stderr.write(eventLine({ event })); run({ onEvent: writeEvent });',
      'const fetched = Effect.tryPromise({ try: () => fetch(url), catch: (cause) => new RequestFailed({ url, reason: String(cause) }) });',
      "const serve = Effect.fn('serve')(function* () { return yield* route(); }, Effect.catch((failure) => Effect.succeed(respondFailure({ failure, message: failureMessage({ failure }) }))));",
      "const runCommand = Effect.fn('runCommand')(function* ({ invocation }: RunCommandInput) { return yield* run({ invocation }); }, (run, { invocation }) => Effect.catch(run, (failure) => Effect.succeed(reportFailure({ invocation, failure }))));",
    ],
  },
  {
    ...AST_GREP_DEFAULTS,
    name: 'called-positional-const',
    standard: 'SC-03',
    status: RuleStatus.Enforced,
    phase: RolloutPhase.EffectDialect,
    violation: [
      'const clip: (text: string, max: number) => string = (text, max) => text.slice(0, max); clip(line, 4);',
    ],
    allowed: [
      'const isLate: (turn: Turn) => boolean = (turn) => turn.endsAtMs < nowMs; turns.filter(isLate);',
      'const clip: (input: ClipInput) => string = ({ text, max }) => text.slice(0, max); clip({ text: line, max: 4 });',
    ],
  },
  {
    ...AST_GREP_DEFAULTS,
    name: 'nested-function-declaration',
    standard: 'SC-03',
    status: RuleStatus.Enforced,
    phase: RolloutPhase.EffectDialect,
    violation: [
      'function dispatchMeter({ store }: DispatchMeterInput) { function allowance() { return store.allowance(); } return { allowance }; }',
    ],
    allowed: [
      'function dispatchMeter({ store }: DispatchMeterInput) { const allowance: () => number = () => store.allowance(); return { allowance }; }',
      'function allowance({ store }: AllowanceInput) { return store.allowance(); }',
    ],
  },
  {
    ...AST_GREP_DEFAULTS,
    name: 'third-function',
    exemptRoles: [FileRole.EntryPoint, FileRole.Constants, FileRole.Migrations],
    standard: 'SC-04',
    status: RuleStatus.Ratchet,
    phase: RolloutPhase.EffectDialect,
    violation: [
      'export function askGuest() { return putExecution(); } function putExecution() { return 1; } function guestAnswer() { return 2; }',
    ],
    allowed: [
      'export function askGuest() { return putExecution(); } function putExecution() { return 1; }',
      "export class GuestLost extends Schema.TaggedError<GuestLost>()('GuestLost', {}) {} export function askGuest() { return putExecution(); } function putExecution() { return 1; }",
    ],
  },
] as const;
