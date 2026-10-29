# @mechane/rules

The rule registry: every contract's entry by its name, the file roles, oxlint's settings, and the text of every file the
registry generates.

Layer 3 · node lane · data dialect · consumers: `@mechane/checks` and `@mechane/rule-generator`

## Layout

- `src/assets/`: the rules that load an installed contract's file in place, with the file's path.
- `src/ast-grep/`: the ast-grep configuration, the utilities the word lists spell, and each rule's tests.
- `src/configurations/`: oxlint's, the compilers', knip's, jscpd's and the formatters' configurations, and each lane's
  strict globals.
- `src/cruiser/`: dependency-cruiser's configuration, with the layer, lane and confine rules the manifest gives.
- `src/contract-blocks/`: each contract's generated block and the module of contract names.
- `src/oxlint/`: oxlint's settings by role, with the restricted imports and properties.
- `src/vocabulary/`: the word lists, one sorted text file each.

## Use

- `CONTRACTS` holds every contract's entry, and `REGISTERED_RULES` each rule with its contract.
- `generatedFiles` renders every generated file from what the generator reads: the contracts, the word lists, the CLI's
  exit statuses and the members.
- `checks` reads `FILE_ROLES`, `oxlintSettings`, `gatedGlobs`, `findingKey` and `loadedAsset`, and `rule-generator`
  checks `assetEntries` against the installed files.

## Never

- Never hold a contract's entry here; it belongs in its rule-group member, which `contracts.ts` gathers.
- Never read or write a file: `@mechane/rule-generator` reads the inputs and writes what this package renders.
