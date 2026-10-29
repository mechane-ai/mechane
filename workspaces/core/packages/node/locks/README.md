# @mechane/locks

The wire and migration locks: each shipped name and schema step the source declares, held append-only, and the record
forms.

Layer 5 · node lane · effect dialect · consumers: checks

## Layout

- `src/`: the wire lock's names, the migration lock's step hashes, the tables' names and the append of new entries.
- `src/fields/`: each wire field's name and each record's form, read from the shared lane's schemas.

## Rules

The [product contracts](../../../.contracts/index.md) apply;
[047 stored and shipped formats](../../../.contracts/047-data-stored-and-shipped-formats/CONTRACT.md) says why a lock
only grows.

## Use

`mise -C workspaces/core run locks` appends each name and step the source declares that a lock lacks, and the checks
fail on an entry a lock holds that the source lost. This is the one member of the checks that imports the product's own
packages, to read the names they ship.

## Never

- Never remove or edit a lock's entry by hand; a shipped name or migration step stays.
