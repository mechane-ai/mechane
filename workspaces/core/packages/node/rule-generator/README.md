# @mechane/rule-generator

The registry's program: it writes or checks every file the registry generates, runs the registry's own checks, and
prints a rule's or a path's rules.

Layer 6 · node lane · effect dialect · no consumers

## Layout

- `src/files/`: reading the contracts, word lists, members and command reference, and writing, formatting and comparing
  the generated files.
- `src/rule-files/`: reading each ast-grep rule file and its findings against its entry.
- `src/assets/`: reading `.tenet.lock` and the installed files a rule loads in place or copies, and their findings
  against the entries.
- `src/validate/`: the registry's own checks: messages, path patterns, suppression budgets, word lists and repeated
  names.
- `src/explain/`: the answers of `explain` and `for`.

## Use

`mise run fix` runs `write`, and `rules:check` runs `check`, which ends with status 1 on a stale file or a finding.
`rules:explain -- <rule>` and `rules:for -- <path>` print what the registry holds for a rule or a path.

## Never

- Never read the command line outside `load-generate-settings.ts`.
- Never write a file the registry does not render, and delete only a stray lint file that carries the generated mark.
