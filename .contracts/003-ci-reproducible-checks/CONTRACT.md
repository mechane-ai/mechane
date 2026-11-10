---
name: ci-reproducible-checks
message: Run the same declared checks locally and in CI with pinned tools and complete inputs.
paths: ["mise.toml", "workspaces/core/mise.toml", ".config/**", ".github/workflows/**", "workspaces/core/**/package.json", "workspaces/core/pnpm-workspace.yaml", "!**/pnpm-lock.yaml"]
---

## Rules

Pin every tool and runtime version that checks use in tracked configuration.
Keep any duplicated version declaration consistent with its single pinned source.
Pin dependencies with committed lockfiles, and use frozen or locked installs both locally and in CI.
Pin images and downloaded tools to fixed versions, and verify them against recorded digests or hashes.

Expose one root command that runs the complete check graph, and run that same command locally and in CI.
Register every check the repository runs, such as type checking, tests, linting, formatting, documentation validation, workflow validation, and production builds, in that graph.
Give equivalent check commands the same name in every package.
Check repository-owned automation scripts with the same type checking and linting as product code; running a script does not establish its correctness.

Declare each build and test action's actual source, tool, and runtime inputs.
Give each action only the inputs it consumes, and keep production build inputs separate from test-only inputs.
Keep the declared file inventory complete, so that added and moved files invalidate the checks that read them.
Run effectful steps, such as dependency installs, database migrations, registry reconciliation, image builds, runtime qualification, and publication, as explicit uncached steps, never inside cached actions.

Keep credentials, local settings files, and build outputs out of version control, and keep personal cache paths and machine-specific paths out of tracked configuration.
Keep the root check graph runnable from a clean checkout without private setup, live services, or their credentials.

## Checks

From a clean checkout, run the frozen install and the root check command.
Compare the CI workflow's check command with the documented local command.
Review version files and lockfiles for drift from their pinned source.
When moving or changing build inputs, inspect representative forward and reverse dependency edges; passing checks alone do not prove isolation.
A cache hit does not prove the input closure, so confirm that a changed input invalidates the actions that read it.

## Local adaptations

The root command is `mise run check` from the factory root, and CI runs the same command after `.config/bootstrap.sh`.
The root `mise.toml` pins Node, pnpm, Bun, Go, OpenTofu, celld, Tenet, ev-grep and ShellCheck; `workspaces/core/pnpm-lock.yaml` pins every package, the lint tools included, and `mise run setup` installs it with `--frozen-lockfile`.
The lint tools are npm packages, so the lockfile is their one pin and `mise.toml` does not repeat them.
`.config/bootstrap.sh` verifies the mise binary against the SHA-256 digests it records, and `mise.lock` records every other tool's URL and checksum per platform; `locked = true` in `mise.toml` refuses a tool the lock does not record.
Repository-local `activate_aggressive = true` keeps those pinned executables ahead of inherited system tools in task shells and subprocesses. The public exporter preserves and requires that setting; resolving a pinned binary for a direct `mise exec` call alone does not qualify nested commands.
The pins check of `mise -C workspaces/core run checks` fails when the bootstrap's `mise_version`, the workspace manifest's `packageManager`, the sandbox image's Node release, or the local supervisor's expected celld version differs from `mise.toml`.
`mise run check` runs contract validation, formatting, ShellCheck, type checks, `rules:check` with the registry's files and ast-grep examples, oxlint, ast-grep, Knip in both modes, jscpd, and the owned checks with their dependency-cruiser graph and rule examples.
The same graph builds the production Worker, Console and Elements assets, the compiled CLI, and the sandbox guest. It checks the command reference, runs Go provider checks and OpenTofu validation, then drives that Worker through the retained smoke suite against celld, verified-TLS local Postgres, real containers, and deterministic external-service fixtures. The application and environment hosts load the same Worker artifact with their declared bindings.
Its existing `fingerprint` task checks every role's bundle after the builds and before smoke starts, using the Worker
compiler's platform modules and resolution conditions for Worker roles. The final `record` step recomputes the
fingerprint and records qualification only after the complete graph passes.
`mise run check:fast` is the inner loop and never the publication gate. It runs changed static checks, then selects
affected smoke and infrastructure targets from the last successful complete check. Reuse requires the same target
and guarantee declaration, complete source/import/package inventory, fixture/toolchain/configuration inputs, and actual
artifact bytes. Missing artifacts or unknown dependency edges invalidate reuse conservatively. An unrelated handler
edit does not require infrastructure checks. Full `check` still runs every declared target.
`mise -C workspaces/core run fingerprint` retains the minified bundle comparison for a deliberate behavior-preserving
sweep. Fast selection does not bundle every program merely to decide whether anything changed. Type-only changes can
conservatively invalidate their owning target. Added, renamed and deleted inputs participate in identities.
The check needs a local container engine and package, tool and fixture-image downloads. It needs no cloud account, deployment credential or paid model. Publication, installation and cloud qualification remain explicit operator tasks outside the check graph.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- owned check `pins` (F003): enforced
- owned check `orphans` (F003): enforced in phase A

<!-- End of the generated block. -->
