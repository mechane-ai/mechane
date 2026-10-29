---
name: code-typescript-const-bindings
message: Declare TypeScript variables with `const`, initialize each `let` and reassign it only in a loop or callback, step with `+= 1`, and bind functions as declarations or typed constants.
requires-tenet: 0.11.0
paths: ["**/*.ts"]
---

## Rules

Declare every TypeScript variable that is never reassigned with `const`, and never declare one with `var`.
Give every `let` its first real value in its declaration, never no initializer, `null`, or `undefined` to fill in later.
Reassign a `let` only inside a loop that carries its value from one pass to the next, such as a running total, or inside a callback.
A callback is a function declared inside the function that declares the `let` and handed to other code to call, never one that function calls itself.
A `let` at a module's top level has no declaring function, so only a loop among the module's top-level statements may reassign it.
A `let` declared in a loop's body or in a `for...of` or `for...in` head starts fresh on each pass, so that loop does not carry it.
Hold a value that a loop or callback changes in its own `let`, never in a field of an object literal, which `code-typescript-effect-absent-values` forbids assigning after the literal.
A function may update an entry of a closed-set record that it declares, such as `counts[check.state] += 1` in its loop, because `code-typescript-runtime-keyed-maps` treats it as a lookup, not a field.
Add or subtract one with `+= 1` or `-= 1`, never `++` or `--`, even on a property or in a `for` loop's update clause.
Bind a function to a variable only as a function declaration or as a constant annotated with a function type, such as `const writeEvent: EventSink = ...`.
An annotation such as `any` or `unknown`, or a `satisfies` or `as` clause on the value, is not an annotation with a function type.
A constant whose value a call returns, such as `const isInvoice = Schema.is(Invoice)`, takes that call's declared type and needs no annotation.

Never choose a value by assigning a variable in each branch of an `if`, `switch`, or `try` statement; return it from a function instead, as `code-conditional-expressions` allows.
A function that only chooses and returns a value is an independent operation even when it has one caller.
Never take a value from a call that can throw by assigning a variable inside a `try` block; when the function making that call handles the call's failure, take the value through a call that returns the value or a typed failure, such as a schema decode.

Suppress the `let` and increment rules only as `code-lint-suppressions` requires.
Configure the lint to reject `var`, a `let` that is never reassigned, and a `let` with no initializer or with a `null` or `undefined` initializer.
Configure it also to reject a `let` reassigned outside both a loop and a callback, every `++` and `--`, and a function constant without a function type annotation.
Where the repository's lint can load the configuration in this contract's `assets/` folder, load it from the repository's own lint configuration.

Violation: `let label = draftLabel; if (order.isPaid) { label = paidLabel; }` reassigns a `let` in a branch outside any loop or callback.
Allowed: `const label = chooseOrderLabel({ order })`, where `chooseOrderLabel` returns a label from each branch, and `let total = 0` that a loop over line items advances.
Violation: `const state = { size: 0 }` and `stream.on('data', (chunk) => { state.size += chunk.length; })` hold a callback's running total in a holder object.
Allowed: `let size = 0` and `stream.on('data', (chunk) => { size += chunk.length; })`, both in one function.
Violation: `const writeEvent = ({ event }: WriteEventInput) => log({ event })` binds a function to a constant without a function type.
Allowed: `function writeEvent({ event }: WriteEventInput) { ... }`, or `const writeEvent: EventSink = ({ event }) => log({ event })`.
Violation: `for (let index = orders.length - 1; index >= 0; index--)` and `failures++` in a loop that counts failures step by one with `--` and `++`.
Allowed: `for (let index = orders.length - 1; index >= 0; index -= 1)` and `failures += 1` in a loop that counts failures.

## Checks

Run the repository's lint from the repository root and confirm it rejects a `let` with no initializer and a `let` reassigned in a plain `if` branch.
Confirm that the same run rejects an unannotated function constant and `index++` in a `for` loop's update clause.
For each function a change adds to choose a value, does it only choose and return that value?
For each `let` a change reassigns inside a loop or nested function, does the loop carry it, or does other code call the function?
For each `let` or increment suppression a change adds, does it meet `code-lint-suppressions`?
For each function a change binds to a variable, including an arrow that uses `this`, is it a function declaration or a constant annotated with a function type?

## Local adaptations

oxlint `no-var`, `prefer-const` and `init-declarations` set to `always`, and ast-grep `let-empty-initializer`, enforce these rules.
oxlint `one-var` with `never` gives each binding its own declaration, and `prefer-destructuring`, with `array` off, reads a property into a binding of its name by destructuring.

Deviation (SC-01, the accepted code standard in contract 111): a value chosen once is a typed const's IIFE, which 012's adaptations describe.
This replaces "A function that only chooses and returns a value is an independent operation even when it has one caller" for such a value.

The registry now loads this contract's oxlint file for func-style and no-plusplus; v11 moved func-style here from contract 064.
The existing EF-22 initializer and loop-only let rules remain stricter than v11's callback allowance.
The shipped let-reassignments asset stays unloaded while the reassignment review retains that baseline.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- asset `assets/oxlint/oxlintrc.json` `func-style` (SC-03): enforced, `["error","declaration",{"allowTypeAnnotation":true}]`
- asset `assets/oxlint/oxlintrc.json` `no-plusplus` (015): enforced, `["error",{"allowForLoopAfterthoughts":false}]`
- oxlint `no-var` (EF-22): enforced, `"error"`
- oxlint `prefer-const` (EF-22): enforced, `"error"`
- oxlint `init-declarations` (EF-22): enforced, `["error","always"]`
- oxlint `one-var` (015): enforced in phase D, `["error","never"]`
- oxlint `prefer-destructuring` (015): enforced in phase D, `["error",{"array":false}]`
- ast-grep `let-empty-initializer` (EF-22): enforced

<!-- End of the generated block. -->
