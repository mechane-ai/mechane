import type { Option } from 'effect';
import type { FileRole, FixBehavior, Normalizer, RolloutPhase, RuleFix, RuleStatus, RuleTool } from './constants.ts';
import type { ContractName } from './contract-names.ts';
import type { ManifestFamily } from './manifest.constants.ts';

/**
 * An oxlint built-in and its configured value. A proposed one is only measured, so a rule may hold a running entry and
 * a stricter proposed one. It names the rule of the standard it serves, such as `EF-02`, or its contract, as `020`.
 */
export type OxlintRule = {
  readonly tool: typeof RuleTool.Oxlint;
  /** The rule's name in the configuration, such as `max-depth` or `typescript/array-type`. */
  readonly name: string;
  /**
   * The configuration's value: a severity, or a severity and the rule's options. An asset entry's value is the one its
   * file sets, which `rules:check` compares.
   */
  readonly value: unknown;
  /**
   * The installed file that configures the rule, which `.oxlintrc.json` extends in place of writing `value`; absent for
   * a rule the registry configures itself.
   */
  readonly asset: Option.Option<RuleAsset>;
  /**
   * Code the rule flags and code it passes, which the checks run it over with type information (TS-05). A nursery rule
   * carries them, since its findings may change with any oxlint release (TD-08).
   */
  readonly violation: ReadonlyArray<string>;
  readonly allowed: ReadonlyArray<string>;
  /** The comment the configuration writes above the rule; absent when the value needs no reason. */
  readonly note: Option.Option<string>;
  /** The groups of files the rule is off in. */
  readonly exemptRoles: ReadonlyArray<FileRole>;
  readonly maxSuppressions: number;
  readonly fix: typeof RuleFix.Oxlint | typeof RuleFix.Manual;
  readonly behavior: FixBehavior;
  readonly standard: string;
  readonly status: RuleStatus;
  readonly phase: RolloutPhase;
};

/**
 * The members of an object and the imports that one rule of the standard bans, through oxlint's
 * `no-restricted-properties` and `no-restricted-imports`. Each entry's message is the fix and its example, followed by
 * the standard rule, which its findings count under, so two entries may serve one rule.
 */
export type RestrictedRule = {
  readonly tool: typeof RuleTool.Restricted;
  /** The fix every entry's message teaches, with an example, such as "Bind each value with `yield*`, such as …". */
  readonly message: string;
  /** The banned properties of each object, such as `{ Effect: ['gen'] }`. */
  readonly properties: Readonly<Record<string, ReadonlyArray<string>>>;
  /** The banned imports: each module, with the names it may not give, or every name when the list is empty. */
  readonly imports: ReadonlyArray<ImportBan>;
  /** The groups of files the members stay allowed in. */
  readonly exemptRoles: ReadonlyArray<FileRole>;
  readonly fix: typeof RuleFix.Manual;
  readonly behavior: FixBehavior;
  readonly standard: string;
  readonly status: RuleStatus;
  readonly phase: RolloutPhase;
};

/** A module that an import may not name, or the names it may not import from it; an empty list bans the module. */
export type ImportBan = { readonly module: string; readonly names: ReadonlyArray<string> };

/** A compiler option that the base configuration sets, by its name, and the value it gives it. */
export type CompilerRule = {
  readonly tool: typeof RuleTool.Compiler;
  readonly name: string;
  readonly value: boolean | string;
  readonly fix: typeof RuleFix.Manual;
  readonly behavior: FixBehavior;
  readonly standard: string;
  readonly status: RuleStatus;
  readonly phase: RolloutPhase;
};

/** A dependency-cruiser rule: its name, the reason its comment states, and the edges it forbids. */
export type CruiserRule = {
  readonly tool: typeof RuleTool.Cruiser;
  readonly name: string;
  readonly comment: string;
  readonly from: Readonly<Record<string, unknown>>;
  readonly to: Readonly<Record<string, unknown>>;
  readonly fix: typeof RuleFix.Manual;
  readonly behavior: FixBehavior;
  readonly standard: string;
  readonly status: RuleStatus;
  readonly phase: RolloutPhase;
};

/**
 * A family of dependency-cruiser rules that the generator writes from `dependencies.json`, by the family's name: one
 * rule for each member, each lane's runtime modules or each confined package. Each is named `<family>:<subject>`, such
 * as `layer:@mechane/client`, and its comment is the family's.
 */
export type ManifestRule = {
  readonly tool: typeof RuleTool.Manifest;
  readonly name: ManifestFamily;
  readonly comment: string;
  readonly fix: typeof RuleFix.Manual;
  readonly behavior: FixBehavior;
  readonly standard: string;
  readonly status: RuleStatus;
  readonly phase: RolloutPhase;
};

/**
 * A rule an owned check of `@mechane/checks` or of the registry decides, by the name its findings count under. Its
 * examples run through its check in memory (TS-05).
 */
export type OwnedRule = {
  readonly tool: typeof RuleTool.Owned;
  readonly name: string;
  readonly violation: ReadonlyArray<OwnedExample>;
  readonly allowed: ReadonlyArray<OwnedExample>;
  readonly fix: typeof RuleFix.Manual;
  readonly behavior: FixBehavior;
  readonly standard: string;
  readonly status: RuleStatus;
  readonly phase: RolloutPhase;
};

/**
 * A small tree of files that shows an owned rule or a normalizer: each file's text, by its path below the workspace or
 * factory.
 */
export type OwnedExample = Readonly<Record<string, string>>;

/** A tree a normalizer rewrites, and the tree it leaves there once a run of it changes nothing more. */
export type NormalizerRewrite = { readonly before: OwnedExample; readonly after: OwnedExample };

/**
 * A rule an owned normalizer of `@mechane/checks` applies by rewriting every file, by the name a sweep gives it. Once
 * it is enforced, `mise run fix` runs it, and until then only a sweep that names it does. Its rewrites run through it
 * in memory (TS-05).
 */
export type NormalizerRule = {
  readonly tool: typeof RuleTool.Normalizer;
  readonly name: Normalizer;
  readonly rewrites: ReadonlyArray<NormalizerRewrite>;
  readonly fix: typeof RuleFix.Codemod;
  readonly behavior: FixBehavior;
  readonly standard: string;
  readonly status: RuleStatus;
  readonly phase: RolloutPhase;
};

/**
 * An ast-grep rule, by its id: an authored one of `lint/ast-grep/rules`, or one an installed contract ships. Its
 * examples become the test `ast-grep test` runs, and the checks run its fix over its violations (TS-05). An authored
 * rule file's `ignores` hold the globs of each role it exempts.
 */
export type AstGrepRule = {
  readonly tool: typeof RuleTool.AstGrep;
  readonly name: string;
  readonly violation: ReadonlyArray<string>;
  readonly allowed: ReadonlyArray<string>;
  /** What the rule's fix leaves of each violation example, in their order; none for a rule without a fix. */
  readonly fixed: ReadonlyArray<string>;
  /** The installed rule folder that holds the rule, which `sgconfig.yml` loads in place; absent for an authored one. */
  readonly asset: Option.Option<RuleAsset>;
  /** The installed rule an authored one copies, which `rules:check` holds to its locked hash; absent for no copy. */
  readonly derivedFrom: Option.Option<RuleOrigin>;
  readonly exemptRoles: ReadonlyArray<FileRole>;
  readonly maxSuppressions: number;
  readonly fix: typeof RuleFix.AstGrep | typeof RuleFix.Manual;
  readonly behavior: FixBehavior;
  readonly standard: string;
  readonly status: RuleStatus;
  readonly phase: RolloutPhase;
};

/**
 * A tool file an installed contract ships under its `assets/` folder, which the registry loads in place, never as a
 * copy. It is the oxlint file or the ast-grep rule folder, by the path from the contract's folder `.tenet.lock` lists.
 */
export type RuleAsset = { readonly path: string };

/**
 * An installed rule file an authored rule copies, by its path from the contract's folder, and the hash `.tenet.lock`
 * gave it when the copy was last reviewed.
 */
export type RuleOrigin = { readonly asset: string; readonly hash: string };

/** Every kind of rule the registry declares. */
export type Rule =
  | OxlintRule
  | RestrictedRule
  | CompilerRule
  | CruiserRule
  | ManifestRule
  | OwnedRule
  | AstGrepRule
  | NormalizerRule;

/**
 * What enforces one contract: the values its local adaptations declare and the rules that decide it. The registry's
 * entry for every contract has this shape, so a contract without an entry fails to compile.
 */
export type ContractEnforcement = {
  readonly values: Readonly<Record<string, unknown>>;
  readonly rules: ReadonlyArray<Rule>;
};

/** A rule and the contract whose entry declares it. */
export type RegisteredRule = { readonly contract: ContractName; readonly rule: Rule };
