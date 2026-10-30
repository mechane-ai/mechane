---
name: code-environment-settings
message: Read a program's environment only in its settings module, decode it once there, and pass decoded settings to the code that needs them.
paths: ["**/*.ts"]
---

## Rules

A program's environment is the configuration its runtime or operator hands it rather than the data it processes: environment variables, process arguments, configuration files such as an installation file, and a server runtime's configuration and resource bindings.
Declare one settings module for each program, such as a server, a command-line tool, an eval runner, or a set of scripts that read one installation file, and read the program's environment only in that module.
A settings module may be a `settings` folder whose files each hold one role under `code-module-file-roles`.
A command model that declares a program's arguments and their environment fallbacks is part of the settings module, and it stays limited to declarations as `cli-command-reference-generation` requires.
Decode each environment value once, in the settings module, and return the decoded settings as one named type.
Declare each setting's default value once, in the settings module or its command model, never where the setting is used.
Pass the decoded settings, or the part a function needs, to that function as an input, and never pass the raw environment or a raw binding object beside them.
Never read a raw environment value outside the settings module, whether as a field of a binding object, such as `env.API_URL`, `this.env.API_URL`, or `context.env.API_URL`, by destructuring that object, or as a JSON string that another module parses.
The entry point that the runtime calls with the raw environment, such as an exported request handler or a long-lived object's constructor, may receive it and hand it to the settings module.
Read secret settings, such as a provider's API key, in the settings module too, even when the command model must not accept them as arguments.
List in the settings module every parent variable that a child process inherits; the code that starts the child may add values it computes for that child, such as a credential issued for one command, and a child that receives a setting decoded from a parent variable inherits that variable.
Enforce these rules with the repository's lint, which reports every environment read and every use of the raw environment type outside the settings module's declared paths.
Suppress a finding only as `code-lint-suppressions` allows, such as at the entry point that hands the raw environment to the settings module.

Violation: `const port = Number(process.env.PORT ?? '8080')` inside a request handler reads a setting and declares its default where the setting is used.
Allowed: the settings module decodes `PORT` with its default of 8080 into `settings.port`, and the handler receives `settings` as an input.

## Checks

Run the repository's lint from the repository root and confirm that it reports environment reads and raw environment types outside the settings module's declared paths.
For each function a change adds or edits, does it receive the raw environment or a binding object beside decoded settings?
Does the change declare a setting's default, or parse a setting's raw text, outside the settings module?
For each child process a change starts, does it inherit any parent variable that the settings module does not list, including by passing no environment at all?

## Local adaptations

The node settings modules are registered in `packages/node/rules/src/file-roles.ts`. Each program reads its arguments and inherited variables through its registered settings module. The CLI's command model in `packages/node/commands/src` declares flags and environment fallbacks. The stack shares its pure decoders in `packages/node/stack/src/settings` across persistent local, fixture and smoke modes.

The CLI reads `MECHANE_API_KEY` and `XDG_CONFIG_HOME` in `load-invocation.ts`, beside its flags' variables, and the command model declares both for `--help`.
`load-invocation.ts` also reads the release stamp, which a release compiles in as `import.meta.mechaneStamp`, and `process.execPath`, the binary `mechane update` replaces.

The release builder reads its mode in `load-release-settings.ts`; its children inherit only `PATH` and `HOME`, as `MODE_VARIABLES` declares. The distribution builder reads its mode, destination and build environment in `load-distribution-settings.ts`. It builds or verifies public artifacts without cloud credentials. Publication and installation are separate operations.

The checks program reads its command, paths, base branch and inherited environment in `load-checks-settings.ts`. Rename, package moves and rule generation use their registered settings modules too.

The Worker module hands its environment through `serve` to `packages/worker/bindings/src/settings/decode-settings.ts`. `packages/worker/rpc/src/object-settings.ts` decodes the mech's settings as its object opens. Each other object's constructor decodes its own declared settings. The registered settings boundaries alone interpret raw bindings.

Settings turn a Secrets Store binding or a redacted local value into a secret reader. Trusted operations resolve OAuth, model and credential-keyring values only when needed. Runtime workspace credentials and Slack installations are records, not environment settings.

`@mechane/deployment` declares the deployment's variable names once: `ORIGIN_VARIABLE`, which every client reads, and `WORKER_VARIABLES`, which the Worker decodes and the stack writes.
When neither `--origin` nor `MECHANE_ORIGIN` names a deployment, the CLI calls production's, `DEFAULT_ORIGIN` in its command model, which repeats the origin `packages/worker/app/wrangler.jsonc` gives the Worker; dev prints the stack's origin to export, and the smoke gives every CLI child it.

`packages/worker/app/wrangler.jsonc` supplies the build and local runtime configuration. Cloud installations consume an immutable release module whose `infrastructure/modules/cloudflare/variables.tf` declares resource identities, global settings and secret references. OpenTofu receives no secret values. Installation ownership defines the resource and runtime-data boundary.

Fixture `.dev.vars` supplies the local GitHub client and scripted model upstream's URL, key and offers. The smoke shortens a named key's lifetime there.
`loadStackSettings` reads every variable declared in `WORKER_VARIABLES` for persistent local mode; fixture and smoke startup ignore those operator values and use their declared fixtures.
It reads `MECHANE_LOCAL_STATE_DIR` for persistent state, defaulting to `mechane` below `XDG_STATE_HOME` or `~/.local/state`, and `MECHANE_LOCAL_ORIGIN`, defaulting to `http://127.0.0.1:8787`; fixtures use the operating system's temporary directory as their state root.

`loadStackSettings` reads `MECHANE_SANDBOX_PROVIDER` for persistent local mode and defaults to `container`, with no fallback to `host`. Local process fixtures use `host`; the stack refuses that provider beside a person's model upstream.
The sandbox's object decodes `MECHANE_SANDBOX_PROVIDER` itself, with `MECHANE_HOST_LAUNCHER_ORIGIN` and `MECHANE_HOST_LAUNCHER_KEY` only under `host`, since only the local stack serves a launcher.

The guest reads `MECHANE_GUEST_MACHINE_ID`, `MECHANE_GUEST_HOST` and `MECHANE_GUEST_PORT`, which `GUEST_VARIABLES` names. Execution children receive only `PATH`, `HOME`, `EXECUTION_VARIABLES` and fixed public gateway certificate paths, never the guest's own credentials or ambient trust overrides.
A child of the stack inherits only `PATH`, `HOME` and `DOCKER_HOST`, which `INHERITED_VARIABLES` in `packages/node/stack/src/load-stack-settings.ts` lists, and a host machine only `PATH` beside its start's variables; celld also receives `CELLD_MAX_RSS_MB=0`, and the CLI child the stack's origin under `ORIGIN_VARIABLE` with the scenario's `XDG_CONFIG_HOME` and, where it presents a key, `MECHANE_API_KEY`.

oxlint `node/no-process-env` and `no-restricted-properties` on `process.argv` and `process.execPath`, with overrides for the settings modules, and ast-grep `raw-environment-type`, `raw-worker-environment` and `raw-binding-read` enforce these rules.

Installation variables define request rate limits, initial workspace defaults and global ceilings. `MECHANE_WORKSPACE_MACHINES` and `MECHANE_WORKSPACE_DAILY_ALLOWANCE_LIMIT_MICROS` bound effective workspace policy. `MECHANE_SANDBOXES_ENABLED` is the global sandbox switch; `MECHANE_WORKSPACE_SANDBOXES_DEFAULT` governs workspaces without a saved policy.

Workspace suspension, sandbox admission, machine limits and daily allowance live in workspace policy records. Installation administrators change them through `workspace policy` operations without redeploying. Effective policy applies installation ceilings without replacing saved policy. Credentials and Slack installation metadata enter through their authenticated runtime APIs.

`MECHANE_SANDBOX_EGRESS` decodes only under `container` and defaults to `gateway`. The cloud module supplies `gateway`. The local stack stages `fence` for containers, since celld refuses interception; Worker settings accept that mode only for a loopback origin.

`Stack.restart` stages installation variables over the stack's existing values before restarting celld. Runtime policy checks change workspace records through the API while agents remain running.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- oxlint `node/no-process-env` (ST-31): enforced, `"error"`
- oxlint's restricted members (ST-31): enforced: `process.argv`, `process.execPath`
- oxlint's restricted members (ST-31): enforced: `node:process`, `process`
- ast-grep `raw-binding-read` (ST-31): enforced
- ast-grep `raw-environment-type` (ST-31): enforced
- ast-grep `raw-worker-environment` (ST-31): enforced

<!-- End of the generated block. -->
