---
name: sandbox-vendor-boundary
message: Keep managed agent orchestration and HTTP handlers decoupled from concrete sandbox vendors behind the Managed Agents Worker Protocol.
paths: ["packages/worker/runtime/src/managed/**", "packages/worker/agent-slot/**", "packages/worker/server/src/managed/**", "packages/shared/sandbox-provider/**"]
---

## Rules

Core managed agent orchestration (`runtime/src/managed`, `session-runtime`, `agent-slot`) and Managed Agents HTTP
handlers (`server/src/managed`) must remain vendor-blind. They communicate with sandboxes exclusively through the
published Managed Agents Environment and Work endpoints (`/v1/environments/:id/work/*`), scoped Git proxies, pre-signed
artifact upload URLs, or the pluggable `@mechane/sandbox-provider` interface.

Do not import `@mechane/sandbox`, `@mechane/sandbox-store`, or third-party sandbox vendor SDKs (`modal`, `tensorlake`,
`dockerode`, or direct Cloudflare container bindings) inside managed runtime or managed HTTP handler modules. Concrete
providers (`@mechane/sandbox-docker`, `@mechane/sandbox-modal`, `@mechane/sandbox-tensorlake`,
`@mechane/sandbox-cloudflare`) live behind the provider boundary so local Docker, production cloud sandboxes, and
unmodified `ant beta:worker` clients remain interchangeable.

## Checks

Verify via dependency-cruiser that managed runtime and server modules import no concrete sandbox implementation or
vendor SDK. Qualify unmodified `ant beta:worker` and Mechane's own worker agent against the same environment work
endpoints.

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

- dependency-cruiser `managed-sandbox-vendor-boundary` (137): enforced: Route managed sandbox execution through the Environment Work protocol or `@mechane/sandbox-provider`, such as `managed_work`
- dependency-cruiser `sandbox-modal-isolation` (137): enforced: Keep `@mechane/sandbox-modal` isolated from sibling adapters by importing `@mechane/sandbox-provider`, such as `requestSandboxJson`
- dependency-cruiser `sandbox-tensorlake-isolation` (137): enforced: Keep `@mechane/sandbox-tensorlake` isolated from sibling adapters by importing `@mechane/sandbox-provider`, such as `requestSandboxJson`
- dependency-cruiser `sandbox-docker-isolation` (137): enforced: Keep `@mechane/sandbox-docker` isolated from sibling adapters by importing `@mechane/sandbox-provider`, such as `SandboxProviderAdapter`

<!-- End of the generated block. -->
