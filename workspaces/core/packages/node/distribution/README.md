# Mechane distribution

Builds immutable Worker, Console, guest, database-tool, and CLI artifacts for one clean public source revision.
Operators install the compiled bytes without rebuilding source. This is a Node program at layer 7.

Run `mise -C workspaces/core run distribution:candidate -- OUTPUT` from the reviewed public checkout before its release
tag. The builder needs Docker Buildx with an OCI exporter, tar, ZIP, and the pinned tools. Output goes to
`dist/distribution/vVERSION`; an existing directory is never overwritten.

To reuse a guest from a prior qualified candidate, pass `--reuse-guest PRIOR_FOLDER QUALIFICATION_SHA256` after
`OUTPUT`. The builder verifies that qualification and its evidence, checks the generated build context and platform
against the prior record, and copies the exact qualified archive. A mismatch fails the build. Reuse does not refresh or
check upstream packages fetched by the Dockerfile; build a fresh guest when those should be updated. The candidate still
runs its full artifact acceptance against the image.

The release contains:

- `mechane-cloudflare-vVERSION.zip`: the installation module, compiled application Worker, Console assets, controlled
  Postgres commands, compiler provenance, notices, and `installation.json`. `runtime.json` inventories the shipped
  runtime files. The archive has no links or undeclared entries.
- `release.json`: the archive and installation-manifest digests, source revision, pinned Node version for database
  commands, and their explicit arguments and environment names.
- The Linux amd64 guest OCI archive, CLI binaries and manifest, and the versioned provider setup helper.
- `guest-inputs.json`: the generated guest inputs and the guest archive and image digests, with the prior qualification
  identity when the archive was reused.

`mise -C workspaces/core run distribution:verify -- OUTPUT` checks the complete receipt, archive inventory, raw binary
bytes, and compiler provenance. The installation manifest distinguishes the guest archive checksum from its OCI image
digest. An application update with the same image digest does not require replacing guests.

The candidate command builds once, runs static checks, exercises the complete retained catalog through the local
supervisor's artifact mode, verifies current formats and applied migration integrity, then seals its reports. The
[qualification schema](src/qualification.ts) requires exact toolchain, fixture, policy, and configuration inputs and
evidence files. Each referenced file is a flat candidate-root filename with its own digest. Each check report also binds
the source, artifact inventory, installation manifest, and complete input digest. Changed bytes or inputs require new
evidence.

Use `mise -C workspaces/core run distribution:accept -- OUTPUT ARTIFACTS_SHA256` to accept already-built bytes without
rebuilding. Select the digest of their `artifacts.json`. The command generates `qualification.json` from actual results;
it does not accept a handwritten qualification request. Run
`mise -C workspaces/core run distribution:verify-qualified -- OUTPUT QUALIFICATION_SHA256` to verify the selected
receipt. Publication includes that qualification and every referenced file, then promotes the same candidate bytes under
the public tag. Installation requires the selected qualification digest.

Cached development results do not replace final acceptance. Hosted-only behavior retains separate provider evidence;
local celld does not qualify Cloudflare routing or containment. Controlled database commands use only their declared
bindings and remain separate from the runtime role. Run an import only when actual retained data requires it.

Building and qualification never publish. Registry credentials and publication identities remain outside this package.
