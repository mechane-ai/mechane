# @mechane/typescript-rules

The registry's entries of the TypeScript contracts: bindings, inputs, assertions, types, arguments, classes, module
state, the compiler, file names, Effect errors and schemas, and the Effect dialect.

Layer 2 · node lane · data dialect · consumers: `@mechane/rules`

## Layout

- `src/typescript/`: the TypeScript contracts, the compiler's options among them, gathered as `TYPESCRIPT_CONTRACTS`.
- `src/effect/`: the Effect contracts, gathered as `EFFECT_CONTRACTS`, and the dialect's rules they share in
  `effect-dialect-rules.ts`.

## Use

Change a value or a rule in the module of the contract it serves, named for the contract's folder, such as
`code-typescript-named-types.ts`, then run `mise run fix`. A compiler option reaches every lane's `tsconfig` from
`code-typescript-compiler-strictness.ts`.

## Never

- Never import another rule-group member. `@mechane/rules` gathers the groups, and a shape they share belongs in
  `@mechane/rule-shapes`.
- Never edit a generated `tsconfig` or configuration; change its entry here.
