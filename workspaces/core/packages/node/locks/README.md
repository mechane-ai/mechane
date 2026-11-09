# @mechane/locks

The active API catalog, cumulative shipped wire history, migration checksums, and record forms.

Layer 5 · node lane · effect dialect · consumers: checks

## Layout

- `src/`: active wire names, shipped history, migration hashes, table names, and lock checks and updates.
- `src/fields/`: each wire field's name and each record's form, read from the shared lane's schemas.

## Rules

The [product contracts](../../../.contracts/index.md) apply;
[047 stored and shipped formats](../../../.contracts/047-data-stored-and-shipped-formats/CONTRACT.md) distinguishes
authorized active API retirement from the shipped history that remains append-only.

## Use

`mise -C workspaces/core run locks` updates the active `lint/wire.json` catalog and appends current names to
`lint/shipped-wire.json`. Migration hashes remain in `lint/migrations.json`. Checks keep the active catalog tied to
source, require its entries in shipped history, and preserve recorded shipped entries and migration checksums. Release
descriptors read shipped history, so a retired API remains recorded without restoring its routes. This is the checks
member that imports product packages to read their declared wire names.

## Never

- Never remove or rewrite a shipped-history entry or migration checksum to make a release pass.
- Never emit the active API catalog as cumulative release history.
