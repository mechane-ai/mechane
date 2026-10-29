---
name: contract-maintenance
message: Keep adopted contracts scoped, reviewable, and consistent with their implementation.
paths: [".contracts/*/CONTRACT.md", ".contracts/index.md", "workspaces/core/.contracts/*/CONTRACT.md", "workspaces/core/.contracts/*/assets/**", "workspaces/core/.contracts/index.md", ".tenet.lock"]
---

## Rules

Give each contract one reviewable concern, a clear scope, and an identifiable violation.
Give each rule one allowed form for each case it covers, never a choice between equivalent forms, and state the observable condition that tells its cases apart.
State adopted requirements and useful exceptions in the contract's own ordinary Markdown; a link may support a rule but must not replace it.
Keep short examples inline, and write each violation example so it breaks only the rule it illustrates and each allowed example so it breaks no contract the repository adopts.
Contracts describe the agreed implementation baseline rather than an aspirational future architecture.

Define shared obligations once; nested contracts inherit their parents and add local ownership, concrete boundaries, or explicit exceptions.
Keep shared requirements usable without private tooling.
Keep numbered folders and indexes consistent; do not renumber unrelated rules.

Put local exceptions and additions to an adopted shared contract under a final `## Local adaptations` heading.
Edit an adopted upstream sentence only when a local requirement must replace it, and propose general improvements to the shared source.
Never overwrite local edits when updating an adopted contract; an upstream revision alone does not authorize changing local rules.

When a task authorizes a convention change, update the contract, affected implementation, callers, examples, and check references together.
Choose each rule's form because it is clean, readable, consistent with other adopted rules, easily enforced by a lint or an agent reading code, and needs the fewest exceptions.
Never choose a form because most scoped code already follows it; count the code a form would change only to plan its rollout.
Do not weaken a requirement merely to make a finding disappear.
Remove obsolete rules or merge redundant ones when their obligations are preserved elsewhere.
When an implementation change invalidates guidance, reconcile the affected contracts, context, skills, and references in the same change.
An unchanged document needs no edit; resolve conflicts against the intended requirement rather than automatically making it describe the current code.

Give each rule a verification path, and make it a tool's command with its working directory wherever a tool can check the rule.
Otherwise give it a focused behavior check or a concrete review question that reviewers answer the same way every time.
Formatting and document validation establish syntax, not compliance.
Do not require new checker scripts or tests for subjective style.

Skills describe how to work; contracts describe adopted requirements.
Keep tool-usage skills self-contained and separate from private development workflows.
When repeated review findings justify a curation change, investigate the cause, update authorized requirements and code together, then rerun focused checks.

## Checks

Read each changed contract without following its links, and confirm that its scope, obligations, and exceptions are stated in it.
Read changed contracts alongside their scoped code.
Identify what would violate each rule and how a reviewer would notice.
For each added or tightened rule, does it allow one form per case, chosen without prevalence as a reason, and does a tool check it wherever one can?
Check inherited requirements, exceptions, indexes, and commands for conflicts or duplication.
Validate documents with the repository's contract checks, confirm that each named command exists and runs from its stated working directory, then review actual behavior and run the affected project checks.
Inspect any obligation left to judgment rather than assuming that passing the mechanical portion closes the contract.

## Local adaptations

Validate the documents with `mise run contracts:check` from the factory root, which runs `tenet validate --root .`.
Library contracts come from tenet-contracts v11.0.0 through `tenet contracts add`, and `.tenet.lock` records each copy and its asset files.
A library contract installed later takes the next free number below 101 with `--number`, and local contracts take numbers from 101 in their scope.
Each value a tool enforces is held once in the rule registry, in the module of the contract it serves.
`@mechane/rules` in `workspaces/core/packages/node/rules` gathers those modules from its rule-group members, such as `name-rules`.
The registry generates every tool's configuration and a block at the end of each contract's local adaptations that states the contract's values and rules; the prose names a value by its key, so no copy can drift.
`mise run fix` writes the generated files, and `rules:check` in `mise run check` fails on one that differs.
Model review with `tenet check` needs an OpenRouter key, so it runs when a person asks and never inside `mise run check`.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
