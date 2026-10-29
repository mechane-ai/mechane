# @mechane/rule-shapes

The shapes the rule registry is built from: each kind of rule with its status, phase, fix and file roles, the contract
names, and the member manifest.

Layer 1 · node lane · data dialect · consumers: the five rule-group members, `@mechane/rules`, `@mechane/rule-generator`
and `@mechane/checks`

## Use

- Declare a contract's entry as a `ContractEnforcement`. Each rule spreads its tool's defaults, such as
  `AST_GREP_DEFAULTS`, and names its standard rule, its `RuleStatus` and the `RolloutPhase` that sweeps it.
- Load a file an installed contract ships by its `asset`, such as `asset: InstalledAsset.Oxlint`, never a copy of it.
- Pin an authored rule that copies a shipped one with `derivedFrom`, the copied file's path and its locked hash.
- Decode the part of `.tenet.lock` the registry reads with `ContractLock`.
- Decode a member of `dependencies.json` with `MemberManifest`; `Lane`, `PackageKind` and `ManifestFamily` name its
  values.
- Name a contract by `ContractName`, the union of every contract folder's name.

## Never

- Never hold a contract's values or rules here; they belong in its module in a rule-group member.
- Never edit `contract-names.ts`, which `mise run fix` writes from the contract folders.
