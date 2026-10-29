# @mechane/protocol

The `/v1` operation catalog, every resource's schemas and errors, and the other wires the Worker shares with its clients
and objects.

Layer 1 · shared lane · data dialect · any consumer

## Layout

- `catalog.ts`: every operation by name, which the router, the client and the CLI derive from.
- `operations/`: one folder per resource, each operation in a file named for it, beside the resource's schemas.
- `operation/`: what an operation declares, its access, and how a request part decodes.
- `errors/`: the tagged errors, their families and the error body.
- `pages/`, `github/`, `releases/` and `logs/`: the pages' URLs and the device page's forms, GitHub's OAuth wire and its
  authorize URL, the release keys, their URLs and the manifest, and the Worker's log lines.
- `durable-objects/`: the rows an object's RPC answers that name a protocol set.

## Use

Declare an operation once, in `operations/<resource>/<operation>.ts`, and add it to the catalog. Build every wire struct
with `wireStruct`.

## Never

Import `node:` or `cloudflare:` modules, or narrow a shipped field.

## Split seam

The catalog with its operations and errors stays. The Durable Objects' rows, the log lines and GitHub's OAuth wire leave
first, each to the lowest package its users share.
