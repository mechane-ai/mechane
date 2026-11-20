import { Schema } from 'effect';
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { gunzipSync } from 'node:zlib';
import { projectManagedSchemas } from './project-openapi.mts';

/**
 * Verifies every implemented Managed Agents operation is dispatched in the Worker managed handlers.
 *
 * @param {ReadonlyArray<string>} operations Implemented operation names projected from the OpenAPI fixture.
 */
async function verifyHandlerCoverage(operations) {
  const folder = new URL('../../../worker/server/src/managed/', import.meta.url);
  const entries = await readdir(folder);
  const files = entries.filter((name) => name.endsWith('.ts'));
  const sources = await Promise.all(files.map((name) => readFile(new URL(name, folder), 'utf8')));
  const combined = sources.join('\n');

  const unhandled = operations.filter((operation) => !combined.includes(operation));

  if (unhandled.length > 0) {
    throw new Error(`Unhandled Managed Agents operations in worker/server/src/managed: ${unhandled.join(', ')}`);
  }
}

async function main() {
  const { values } = parseArgs({ options: { check: { type: 'boolean', default: false } } });
  const filename = 'anthropic-v2.10.0.openapi.json.gz';
  const source = new URL(filename, import.meta.url);
  const [bytes, checksum] = await Promise.all([
    readFile(source),
    readFile(new URL('upstream.sha256', import.meta.url), 'utf8'),
  ]);
  const digest = createHash('sha256').update(bytes).digest('hex');

  if (checksum.trim() !== `${digest}  ${filename}`) {
    throw new Error('Managed Agents OpenAPI fixture checksum mismatch');
  }

  const projected = projectManagedSchemas(gunzipSync(bytes).toString('utf8'));
  const implemented = projected.matrix
    .filter((entry) => entry.status === 'implemented')
    .map((entry) => entry.operation);

  await verifyHandlerCoverage(implemented);

  const outputs = [
    { path: '../src/requests.generated.json', value: projected.requests },
    { path: '../../../worker/runtime/src/managed/tools/worker-inputs.generated.json', value: projected.inputs },
    { path: './compatibility-matrix.json', value: { spec: filename, sha256: digest, operations: projected.matrix } },
  ];

  for (const { path, value } of outputs) {
    const target = new URL(path, import.meta.url);

    if (values.check) {
      const text = await readFile(target, 'utf8');
      const current = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Json))(text);

      if (JSON.stringify(current) !== JSON.stringify(value)) {
        throw new Error(`Outdated Managed Agents schema projection: ${target.pathname}`);
      }
    } else {
      await writeFile(target, `${JSON.stringify(value, null, 2)}\n`);
    }
  }
}

await main();
