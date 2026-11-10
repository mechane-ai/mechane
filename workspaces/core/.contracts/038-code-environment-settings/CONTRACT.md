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

Register each program's settings boundary in `packages/node/rules/src/file-roles.ts`. The runtime's `src/config.ts`
loads database, model, credential-keyring, and sandbox settings. Server settings own the public origin, GitHub OAuth,
identity admission, and generic notification-producer authentication. The sandbox service decodes its Cloudflare bindings once.
Raw environment access stays in those boundaries; tools and handlers receive validated configuration.

The deployment supplies installation defaults, secret references, and notification-producer recipient allowlists.
Mechs, workspace credentials, notifications, and execution grants are runtime records. External integrations own their
platform subscriptions. Settings never overwrite runtime records during deployment.

Resolve credentials only at the trusted operation that needs them. Store references in durable arguments and records;
never pass resolved credentials into Pi's durable arguments, results, model context, or logs.

The CLI's command model owns flags and environment fallbacks, including `MECHANE_ORIGIN`, `MECHANE_API_KEY`, and
`XDG_CONFIG_HOME`. Release and check programs use their registered settings modules. Their children inherit an
explicit environment allowlist. Guest command environments contain public execution settings and only credentials
that the current execution grant authorizes.

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- oxlint `node/no-process-env` (ST-31): enforced, `"error"`
- oxlint's restricted members (ST-31): enforced: `process.argv`, `process.execPath`
- oxlint's restricted members (ST-31): enforced: `node:process`, `process`
- ast-grep `raw-binding-read` (ST-31): enforced
- ast-grep `raw-environment-type` (ST-31): enforced
- ast-grep `raw-worker-environment` (ST-31): enforced

<!-- End of the generated block. -->
