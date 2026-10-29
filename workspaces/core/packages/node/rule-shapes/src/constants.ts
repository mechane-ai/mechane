import { Option } from 'effect';

/**
 * The tool that decides a rule: an oxlint built-in, a member that oxlint's restricted rules ban, an ast-grep rule, an
 * owned check, a compiler option or a dependency-cruiser rule. A family of dependency-cruiser rules comes from the
 * member manifest, and a normalizer rewrites the tree to its rule instead.
 */
export const RuleTool = {
  Oxlint: 'oxlint',
  Restricted: 'restricted',
  AstGrep: 'ast-grep',
  Owned: 'owned',
  Compiler: 'compiler',
  Cruiser: 'dependency-cruiser',
  Manifest: 'manifest',
  Normalizer: 'normalizer',
} as const;

export type RuleTool = (typeof RuleTool)[keyof typeof RuleTool];

/**
 * Where a rule stands: proposed while it has findings and nothing holds it, a ratchet that its baseline holds, or
 * enforced, failing on any finding.
 */
export const RuleStatus = { Proposed: 'proposed', Ratchet: 'ratchet', Enforced: 'enforced' } as const;

export type RuleStatus = (typeof RuleStatus)[keyof typeof RuleStatus];

/**
 * The phases of the strict standard's rollout, by what each does, with the standard's name for it, and `adopted` for a
 * rule enforced before the rollout began. Each rule names the phase that lands it or sweeps its findings.
 */
export const RolloutPhase = {
  Adopted: 'adopted',
  Proof: 'A',
  NameFreeze: 'B',
  Baselines: 'C1',
  Registry: 'C2',
  Fixers: 'D',
  Packages: 'E',
  Names: 'F1',
  DataShapes: 'F2',
  EffectDialect: 'F3',
  ObjectDialect: 'F4',
  Time: 'F5',
  Docs: 'F6',
  Close: 'G',
} as const;

export type RolloutPhase = (typeof RolloutPhase)[keyof typeof RolloutPhase];

/**
 * The files an installed contract ships that an entry loads in place, as its `asset` field names them. They are the
 * oxlint file and the ast-grep rule folder, by their paths from the contract's folder, which the registry never
 * copies.
 */
export const InstalledAsset = {
  Oxlint: Option.some({ path: 'assets/oxlint/oxlintrc.json' }),
  AstGrepRules: Option.some({ path: 'assets/ast-grep/rules' }),
} as const;

/** The rollout of a rule enforced before the standard's rollout began; each such rule still names its standard rule. */
export const ADOPTED = { status: RuleStatus.Enforced, phase: RolloutPhase.Adopted } as const;

/**
 * How a rule's findings are fixed: by oxlint's safe fix, by an ast-grep rule's `fix`, by an owned codemod such as a
 * normalizer, or by hand. Fix applies an enforced rule's autofix, and a sweep applies a ratchet's.
 */
export const RuleFix = { Oxlint: 'oxlint', AstGrep: 'ast-grep', Codemod: 'codemod', Manual: 'manual' } as const;

export type RuleFix = (typeof RuleFix)[keyof typeof RuleFix];

/**
 * What fixing a rule's finding changes, which sets the proof its commit needs (TS-07). A type-only or binding-name fix
 * leaves every minified bundle equal, and a field-name fix or a restructure changes one. Such a fix needs the smoke,
 * and a sweep of it leaves the code the smoke cannot reach as it is.
 */
export const FixBehavior = {
  TypeOnly: 'type-only',
  BindingNames: 'binding-names',
  FieldNames: 'field-names',
  Restructure: 'restructure',
} as const;

export type FixBehavior = (typeof FixBehavior)[keyof typeof FixBehavior];

/**
 * What an oxlint rule holds unless its entry says otherwise: a value the registry writes, no comment and no examples.
 * It exempts no file, allows no suppression, and is fixed by hand with a restructure.
 */
export const OXLINT_DEFAULTS = {
  tool: RuleTool.Oxlint,
  asset: Option.none(),
  note: Option.none<string>(),
  violation: [],
  allowed: [],
  exemptRoles: [],
  maxSuppressions: 0,
  fix: RuleFix.Manual,
  behavior: FixBehavior.Restructure,
} as const;

/**
 * What an ast-grep rule holds unless its entry says otherwise: an authored rule file, no exempt role, no suppression,
 * and a fix by hand that restructures.
 */
export const AST_GREP_DEFAULTS = {
  tool: RuleTool.AstGrep,
  asset: Option.none(),
  derivedFrom: Option.none(),
  fixed: [],
  exemptRoles: [],
  maxSuppressions: 0,
  fix: RuleFix.Manual,
  behavior: FixBehavior.Restructure,
} as const;

/** What a restricted rule holds unless its entry says otherwise: no ban, no exempt file, and a manual restructure. */
export const RESTRICTED_DEFAULTS = {
  tool: RuleTool.Restricted,
  properties: {},
  imports: [],
  exemptRoles: [],
  fix: RuleFix.Manual,
  behavior: FixBehavior.Restructure,
} as const;

/**
 * What an owned rule holds unless its entry says otherwise: no example, and a fix by hand that restructures. Only a
 * rule that no small tree shows may keep no example.
 */
export const OWNED_DEFAULTS = {
  tool: RuleTool.Owned,
  violation: [],
  allowed: [],
  fix: RuleFix.Manual,
  behavior: FixBehavior.Restructure,
} as const;

/** What a dependency-cruiser rule holds: a fix by hand that restructures. */
export const CRUISER_DEFAULTS = {
  tool: RuleTool.Cruiser,
  fix: RuleFix.Manual,
  behavior: FixBehavior.Restructure,
} as const;

/**
 * What a normalizer holds: its codemod is its fix. A dropped export or a rewritten import moves Bun's minified names,
 * so its commit is proved by the smoke.
 */
export const NORMALIZER_DEFAULTS = {
  tool: RuleTool.Normalizer,
  fix: RuleFix.Codemod,
  behavior: FixBehavior.Restructure,
} as const;

/**
 * The owned normalizers, by the name a sweep and the registry give them, in the order a fix runs them: placement, then
 * barrels, then blank lines. Blank lines go last, since they space the statements the other two leave. The registry's
 * entry of each holds its rule's status.
 */
export const Normalizer = { Placement: 'placement', Barrels: 'barrels', BlankLines: 'blank-lines' } as const;

export type Normalizer = (typeof Normalizer)[keyof typeof Normalizer];

/**
 * How the checks hold a ratchet's baseline to the merge base's: each file to its own count, or the rule's total. The
 * total lets a split or a moved function take its sites to another file, while a new site still raises it.
 */
export const BaselineHold = { PerFile: 'per-file', Total: 'total' } as const;

export type BaselineHold = (typeof BaselineHold)[keyof typeof BaselineHold];

/** The severities a configuration sets a rule to: every rule is an error or off, never a warning. */
export const Severity = { Error: 'error', Off: 'off' } as const;

export type Severity = (typeof Severity)[keyof typeof Severity];

/**
 * The groups of files a rule treats apart, such as settings and output modules, the Worker module and the stack's celld
 * restart. Entry points, the scenario catalog and object classes have a length a closed set bounds, and migrations hold
 * schema steps the migration lock hashes whole. The cruiser's configuration loads as CommonJS, a utility alone builds a
 * promise, and a constants file names every number.
 */
export const FileRole = {
  Settings: 'settings',
  Output: 'output',
  WorkerModule: 'worker-module',
  CelldRestart: 'celld-restart',
  EntryPoint: 'entry-point',
  Catalog: 'catalog',
  ObjectClass: 'object-class',
  Migrations: 'migrations',
  CruiserConfiguration: 'cruiser-configuration',
  Utilities: 'utilities',
  Constants: 'constants',
} as const;

export type FileRole = (typeof FileRole)[keyof typeof FileRole];

/**
 * The word lists of `src/vocabulary`: the units and counted nouns that end a measured name, and the acronyms a name may
 * hold. Each is a sorted text file with one word per line, which any change may extend.
 */
export const WordList = { Units: 'units', CountedNouns: 'counted-nouns', Acronyms: 'acronyms' } as const;

export type WordList = (typeof WordList)[keyof typeof WordList];

/**
 * A whole JavaScript identifier: a key a generated configuration writes without quotes, and a binding's name that a
 * rename takes.
 */
export const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/**
 * A message that teaches its fix as AS-01 says: an imperative fix, an example in code, and the rule of the standard. An
 * example is "Name it, such as `isReady` (NM-07)", which holds no period, as ER-11 says.
 */
export const MESSAGE_FORM =
  /^(?![\s\S]*\. )[A-Z][\s\S]*, such as `[^`]+`(?:[\s\S]*[^.])? \((?:[A-Z]{2}-\d{2}|F?\d{3})\)$/;
