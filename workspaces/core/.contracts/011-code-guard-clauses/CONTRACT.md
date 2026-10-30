---
name: code-guard-clauses
message: Leave a block early with a guard instead of nesting its remaining work, and never write an `else` after a branch that leaves.
paths: ["**/*.ts"]
---

## Rules

When a condition means that the rest of a function or loop body does not apply, test it as soon as its value is known and leave with `return`, `throw`, `continue`, or `break`.
A guard may follow other statements once the value it tests is known, such as after an awaited read.
In a language whose blocks take braces, write every `if`, `else`, and loop body in braces, even one statement, except an `else` followed by `if`, as in `else if`.
Declare a maximum number of statements for an `if` statement that has no `else` and ends a function.
Never end a function with an `if` statement that has no `else` and holds more statements than that maximum, counting every statement nested inside the `if` at any depth; invert its condition into a guard.

Never write an `else` after a branch that always ends with `return`, `throw`, `break`, or `continue`, whether the `else` holds a block or another `if`, and wherever that branch sits in an `else if` chain.
Never write an `if` statement as the only statement of an `else` block; write `else if`, or a `switch` or `match` where `code-exhaustive-branches` requires one.
Never negate the whole condition of an `if` statement whose `else` holds a block, such as with `!` or a not-equal comparison; swap the branches instead.
Never end a loop body with a `continue` statement, and never write an `else` that holds only `continue`.
In a language with a statement that binds a pattern or leaves, such as `let Some(order) = found else { return Ok(None); };`, use it instead of a `match` or `if let` whose other branch only leaves, when the set is declared outside the repository; `code-exhaustive-branches` governs the sets the repository declares.
An `if` and `else` whose branches both continue the function, such as two different writes, are allowed and are not guards.

Configure the lint to reject an `else` after a branch that leaves, an `if` alone in an `else`, a negated condition with an `else`, a needless `continue`, a `match` that a pattern-binding statement replaces, and a trailing `if` over the declared maximum, wherever the lint supports each rule.
Configure the lint as well to reject an `if`, `else`, or loop body without braces, wherever the lint supports that rule.

Violation: `if (order.isPaid) { return ship({ order }); } else { return hold({ order }); }` writes an `else` after a branch that returns.
Allowed: `if (order.lines.length === 0) { return; }`, a blank line, and the remaining work without nesting.

## Checks

Run the repository's lint from the repository root and confirm that it rejects an `else` after a `throw` and an `else if` after a `return`, wherever the lint supports each rule.
For each guard a change adds after other statements, does it test a value that those statements produced?
For each `if` a change adds that holds the rest of a loop body or function, would leaving early when its condition fails remove a level of nesting?

## Local adaptations

Maximum statements in an `if` without `else` that ends a function: `trailingIfStatements`, enforced by ast-grep `trailing-if` through the generated utility `trailing-if-overflow`, which counts the statements directly inside the `if`.
oxlint `no-else-return` with `allowElseIf: false`, `no-lonely-if`, `no-negated-condition` and `no-continue` enforce the other forms.
A generator leaves by returning: ast-grep `generator-guard` rejects a yielded `Effect.fail`, which `return yield*` of the failure itself replaces, and `succeed-in-generator` and `sync-in-generator` ratchet `Effect.succeed`, `fail`, `void` and `sync` outside a callback that must return an Effect, a yielded `Effect.succeed` or `void` included: a `Match` arm, a `catchTags` handler, an `orElse`, the entry boundary's `Effect.catch`, the functions of `acquireRelease`, the argument of `resume` or `Deferred.doneUnsafe`, a schema default, and a typed callback const, whose type fixes the Effect it answers, that a table or `Effect.catch` takes by name: a value of an object a typed const holds, an argument of `Effect.catch`, or an exported module-level const another file's table takes, such as a route's `health`; any other typed const, and one its own file calls, is an `Effect.fn` instead.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

Values: `trailingIfStatements` 2.
- oxlint `no-else-return` (EF-21): enforced, `["error",{"allowElseIf":false}]`
- oxlint `no-lonely-if` (EF-21): enforced, `"error"`
- oxlint `no-negated-condition` (EF-21): enforced, `"error"`
- ast-grep `generator-guard` (EF-04): enforced in phase F3
- ast-grep `succeed-in-generator` (EF-04): enforced in phase F3
- ast-grep `sync-in-generator` (EF-04): enforced in phase F3
- ast-grep `trailing-if` (ST-26): enforced

<!-- End of the generated block. -->
