---
name: developer-environments
message: Keep developer tools reproducible, files durable, and execution recovery independent of application-specific workflows.
paths: ["packages/node/guest/image/{Dockerfile,*.sh}", "packages/node/guest/src/{executions,archives}/**", "packages/worker/sandbox/src/{executions,providers,egress}/**", "packages/worker/sandbox/src/sandbox-object.ts", "infrastructure/modules/cloudflare/**", "docs/agent-environments.md"]
---

## Rules

Keep the generic developer image in `node/guest/image`. Pin downloaded tools and verify architecture-specific checksums
before installing them. Use repository-owned setup for revision-specific dependencies. Company endpoints and agent
instructions belong to installation configuration, never the generic image or runtime.

Keep useful source, Git metadata, and reports in the committed home. Keep reproducible caches and build output outside
that home through explicit environment setup. Preserve existing files. Do not infer disposability from `.gitignore` or
silently exclude unknown files. Retain archive size limits and report failures instead of claiming files were committed.

Supply additional HTTPS hosts through validated installation settings. Preserve authority validation, the private-network
boundary, and TLS verification. The gateway injects no credential and follows no redirect. Each redirect destination
must pass its own admission.

Observe an existing execution without resubmitting its command or requiring a serialized credential. Preserve execution
identity across transport retries. A missing receipt after a lost machine remains uncertain; never automatically rerun
an arbitrary command to reconstruct its output.

Qualify a real checkout on the selected hosted environment before describing that environment as able to build and ship
it. Required checks remain required. A missing Docker capability is an explicit qualification failure, not a passed
suite. Generic execution cannot establish exactly-once external writes or prove production from an assistant reply.

## Checks

Build the image and inspect pinned tool versions. Run the existing command-recovery and file-restoration smoke cases.
For a new workload, record source revision, commands, checkpoint size, restart results, and required-check outcomes in
the deployment work record. Inspect network configuration for company-specific values and review observation requests
for command bodies. Live release proof names the checked PR head, merge, workflow run, and observed deployed revision.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

No rule of the registry decides this contract; review does.

<!-- End of the generated block. -->
