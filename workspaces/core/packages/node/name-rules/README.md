# @mechane/name-rules

The registry's entries of the names and comments contracts: blank lines, booleans, measured values, spelled-out names,
the vocabulary, comments and suppressions, with oxlint's opt-out list.

Layer 2 · node lane · data dialect · consumers: `@mechane/rules`

## Use

- Change a value or a rule in the module of the contract it serves, named for the contract's folder, such as
  `code-boolean-names.ts`, then run `mise run fix`. The modules are gathered as `NAME_CONTRACTS`.
- Give each oxlint rule the contracts leave off a reason in `oxlint-opt-outs.json`. The suppressions contract's entry
  reads it, and `rules:measure` compares it with oxlint's rules.
- Add a word to its list in `@mechane/rules`' vocabulary, never to a module here.

## Never

- Never import another rule-group member. `@mechane/rules` gathers the groups, and a shape they share belongs in
  `@mechane/rule-shapes`.
- Never edit a generated file to change a rule; change its entry here.
