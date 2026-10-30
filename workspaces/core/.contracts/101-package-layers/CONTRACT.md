---
name: package-layers
message: Keep each package to its layer and lane, declare it once in dependencies.json, and import another only through its entry point.
paths: ["**/*.ts", "**/package.json", "dependencies.json", ".dependency-cruiser.cjs", "tsconfig.*.json"]
---

## Rules

The runtime and build programs form one pnpm workspace of private packages under the `@mechane` scope. The native OpenTofu provider is an independent Go module under `infrastructure/provider`; HCL installation modules live under `infrastructure/modules`. These infrastructure components do not import runtime implementation packages.
`dependencies.json` declares each member once: what it owns; its `layer`, from 0 for vocabulary through configuration, wire, platform, adapters, domain and surfaces to 7 for entries; its `lane`, `shared` for code that runs in the Worker, in Bun and in Node, `worker` for the Workers runtime and `node` for Node and Bun programs; its `dialect`, `data`, `plain` or `effect`; its `kind`, the template its package follows; and its `criterion`, the boundary that admits it: `state`, `closure`, `reuse` or `program`.
`consumers`, when present, names the only members that may import it, and `confines` names the third-party packages that only it and the other members naming them may import.
A member imports another only when that member sits in a strictly lower layer of a lane its own lane imports, `shared` from every lane, `worker` from the worker lane and `node` from the node lane, and its `consumers` allow it, and then only through that member's `src/index.ts`, so no two members of one layer import each other and no package cycle can form.
Each package declares the members it imports in its own `package.json`, by `workspace:*`, and nowhere else.
The shared lane imports no Node module, and only the worker lane imports the modules the Workers runtime provides.
pi-durable, pi-ai and chord enter only through `@mechane/harness` and `@mechane/harness-tools`, whose `confines` name them, and so does TypeBox, the schema language of pi's tools; no other member imports them, and pi's vocabulary ends at the harness's types, which the mech's object calls.
The MCP client SDK and jose enter only through `@mechane/integrations`, which keeps remote transport and GitHub signing credentials behind its trusted client boundary.
Production code never imports `packages/node/smoke/src` or `packages/node/testing/src`.
Each member is a row of the strict standard's package map, at `packages/<lane>/<name>`; the root, `@mechane/core`, holds only tool pins and product tasks, no source.
A folder becomes a package only for its criterion, and a maintainer approves each new member and its fields in `dependencies.json`.

Declare each HTTP operation once in `@mechane/protocol`; the Worker's router and the client derive from the catalog, and each CLI command names the operations it calls.
The browser pages `/device` and `/auth/github/callback` are not operations: `@mechane/pages` serves them as HTML, and `@mechane/protocol` names their paths, the approval page's query and form, and GitHub's OAuth wire, which the stack's local GitHub and the smoke's browser use too.
The install script `/install.sh` and release files below `/cli/` are read-only HTTP surfaces owned by `@mechane/edge`. Settings compose their source from the installation’s immutable public release origin, or the local `RELEASES` bucket. `@mechane/protocol` owns paths, target names, manifests and release stamps. Release files are not JSON operations, but their failures use the same public error response boundary.
Add a package only with its first real code, and add its edge to its `package.json` in the same change as the first import that needs it.

Violation: `@mechane/client` imports `node:fs` to read a credential file, which the Worker cannot load.
Allowed: `@mechane/cli` reads the credential file in its settings module and passes the decoded key to `@mechane/client`.

## Checks

From `workspaces/core`, run `mise run checks`; its boundaries check cruises once with dependency-cruiser, whose rules the registry generates from `dependencies.json`, one `layer:` rule for each member, one `lane:` rule for each lane's runtime modules and one `confine:` rule for each confined package, and it holds each import between members to the importer's `package.json`.
For each new edge, does the depending package need the dependency's own concept, or does the code belong in the lower package?

## Local adaptations

<!-- Generated from @mechane/rules by `mise run fix`; change the registry, never this block. -->

Values: `laneImports` `shared` [`shared`], `worker` [`shared`, `worker`], `node` [`shared`, `node`]; `sourceFolders` `src`, `scripts`.
- dependency-cruiser family `layer` (ST-02): enforced in phase E: Import another member only through the entry point of a member in a lower layer that its lane and consumers allow, such as `@mechane/protocol` in `@mechane/client`
- dependency-cruiser family `lane` (ST-02): enforced in phase E: Import Node's modules only outside the shared lane and the Workers runtime's only in the worker lane, such as `node:path` in `@mechane/cli` and `cloudflare:workers` in `@mechane/mech`
- dependency-cruiser family `confine` (ST-04): enforced in phase E: Import a confined package only in a member whose `confines` names it, such as `cookie` in `@mechane/pages`

<!-- End of the generated block. -->
