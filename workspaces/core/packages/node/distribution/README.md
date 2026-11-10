# Mechane distribution

Builds immutable Worker, Console, guest, database-tool, and CLI artifacts from one clean public source revision.
Operators install the compiled bytes without rebuilding source. This is a Node program at layer 7.

Run `mise -C workspaces/core run distribution:build` from the reviewed public checkout before creating its release tag.
The builder needs Docker Buildx with an OCI exporter, tar, ZIP, and the pinned tools. Output goes to
`dist/distribution/vVERSION`; an existing directory is never overwritten.

The release contains:

- `mechane-cloudflare-vVERSION.zip`: the installation module, compiled application Worker, Console assets, controlled
  Postgres commands, compiler provenance, notices, and `installation.json`. `runtime.json` inventories the shipped
  runtime files. The archive has no links or undeclared entries.
- `release.json`: the archive and installation-manifest digests, source revision, pinned Node version for database
  commands, and their explicit arguments and environment names.
- The Linux amd64 guest OCI archive, CLI binaries and manifest, and the versioned provider setup helper.

`mise -C workspaces/core run distribution:verify -- OUTPUT` checks the complete receipt, archive inventory, raw binary
bytes, and compiler provenance. The installation manifest distinguishes the guest archive checksum from its OCI image
digest. An application update with the same image digest does not require replacing guests.

Qualify the candidate's compiled bytes through the artifact mode of the local supervisor. Keep complete repository
checks, consequential artifact scenarios, and shipped-format preservation evidence with the candidate. The
[qualification schema](src/qualification.ts) requires exact toolchain, fixture, policy, and configuration inputs and
evidence files. Each referenced file is a flat candidate-root filename with its own digest. Each check report also binds
the source, artifact inventory, installation manifest, and complete input digest. Changed bytes or inputs require new
evidence.

Run `distribution:qualify -- OUTPUT REQUEST.json` to verify the existing artifacts and evidence and write
`qualification.json`. Run `distribution:verify-qualified -- OUTPUT QUALIFICATION_SHA256` to verify that explicitly
selected receipt. These operations do not compile. Publication includes the qualification and every file it references,
then promotes the same candidate bytes under the public tag. Installation requires the selected qualification digest.

Run `node import.mjs --dry-run --all` with the migration database URL to inventory preserved history. Applying requires
the reviewed dry-run digest, an exact retirement receipt, and explicit `--apply` options. The deployment descriptor
lists the required options and separate origin and service credential bindings. Migration and grant commands use only
their declared database bindings.

Building and qualification never publish. Registry credentials and publication identities remain outside this package.
