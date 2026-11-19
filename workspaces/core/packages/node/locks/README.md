# @mechane/locks

The current API catalog, applied migration checksums, and stored record forms.

Layer 5 · node lane · effect dialect · consumers: checks

## Layout

- `src/` reads declared operations, CLI names, migration hashes, and table names.
- `src/fields/` reads the field names and record forms of Mechane-owned schemas.

## Use

`mise -C workspaces/core run locks` refreshes `lint/wire.json` with the managed and operator operations the release
declares. It appends new migration checksums to `lint/migrations.json`. The checks compare both files with their sources
and validate stored record forms. The upstream schema fixture and SDK scenarios qualify Managed Agents wire behavior.
Release descriptors use the current catalog.

Preserve applied migration checksums and stored data across an API cutover. See the
[stored and shipped formats contract](../../../.contracts/047-data-stored-and-shipped-formats/CONTRACT.md).
