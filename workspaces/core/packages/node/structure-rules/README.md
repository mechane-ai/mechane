# @mechane/structure-rules

The registry's entries of the boundary and structure contracts: packages, modules, entry points, exports, file roles,
folders, functions and branches.

Layer 2 · node lane · data dialect · consumers: `@mechane/rules`

## Layout

- `src/boundaries/`: the contracts of packages, modules, entry points and exports, gathered as `BOUNDARY_CONTRACTS`.
- `src/structure/`: the contracts of file roles, folders, functions and branches, gathered as `STRUCTURE_CONTRACTS`, and
  the rules several of them share, such as `placement-rules.ts`.

## Use

Change a value or a rule in the module of the contract it serves, named for the contract's folder, such as
`code-function-size.ts`, then run `mise run fix`, which writes every configuration and the contract's block.

## Never

- Never import another rule-group member. `@mechane/rules` gathers the groups, and a shape they share belongs in
  `@mechane/rule-shapes`.
- Never edit a generated file to change a rule; change its entry here.
