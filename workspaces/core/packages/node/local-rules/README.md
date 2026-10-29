# @mechane/local-rules

The registry's entries of Mechane's own contracts, the package layers, the rule registry and the code style, and of the
factory's repository contracts.

Layer 2 · node lane · data dialect · consumers: `@mechane/rules`

## Layout

- `src/mechane/`: the package layers, the rule registry with its `unexercised` globs and baseline hold, and the code
  style's rules, gathered as `MECHANE_CONTRACTS`.
- `src/factory/`: the factory's contracts, from CI's trust to prose style, gathered as `FACTORY_CONTRACTS`.

## Use

Change a value or a rule in the module of the contract it serves, named for the contract's folder, such as
`rule-registry.ts`, then run `mise run fix`. A path no check runs joins `unexercised` in `rule-registry.ts`.

## Never

- Never import another rule-group member. `@mechane/rules` gathers the groups, and a shape they share belongs in
  `@mechane/rule-shapes`.
- Never edit a generated file to change a rule; change its entry here.
