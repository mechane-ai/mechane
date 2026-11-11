import {
  Lock,
  lostEntries,
  MIGRATION_LOCK,
  PROGRAM_ARGUMENTS_START,
  ReleaseDescriptor,
  WIRE_LOCK,
} from '@mechane/program';
import { Option, Record, Schema } from 'effect';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CORE_FOLDER } from '../src/constants.ts';

const ManifestFormats = Schema.Struct({ formats: ReleaseDescriptor.fields.formats });

async function main(): Promise<void> {
  const [argument, ...extra] = process.argv.slice(PROGRAM_ARGUMENTS_START);
  const path = Option.fromUndefinedOr(argument);
  const hasPath = Option.isSome(path);

  assert.ok(hasPath && extra.length === 0, 'Pass the staged installation manifest');

  const wirePath = join(CORE_FOLDER, WIRE_LOCK);
  const migrationPath = join(CORE_FOLDER, MIGRATION_LOCK);

  const reads = [readFile(path.value, 'utf8'), readFile(wirePath, 'utf8'), readFile(migrationPath, 'utf8')] as const;

  const [manifestText, wireText, migrationText] = await Promise.all(reads);
  const manifestJson = Schema.fromJsonString(ManifestFormats);
  const lockJson = Schema.fromJsonString(Lock);
  const decodeManifest = Schema.decodeUnknownPromise(manifestJson);
  const decodeLock = Schema.decodeUnknownPromise(lockJson);
  const manifest = await decodeManifest(manifestText);
  const wire = await decodeLock(wireText);
  const migrations = await decodeLock(migrationText);

  assertPreserved({ name: 'wire', locked: wire, current: manifest.formats.wire });
  assertPreserved({ name: 'migrations', locked: migrations, current: manifest.formats.migrations });
}

type AssertPreservedInput = { readonly name: string; readonly locked: Lock; readonly current: Lock };

function assertPreserved({ name, locked, current }: AssertPreservedInput): void {
  const categories = Record.keys(locked);

  for (const category of categories) {
    const hasCategory = Record.has(current, category);

    assert.ok(hasCategory, `The built installation loses the shipped ${name} category ${category}`);
  }

  const lost = lostEntries({ locked, current });
  const first = lost.at(0);
  const details = JSON.stringify(first);

  assert.equal(lost.length, 0, `The built installation loses shipped ${name} entries: ${details}`);
}

await main();
