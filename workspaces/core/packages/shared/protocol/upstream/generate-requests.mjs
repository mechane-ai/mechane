import { Schema } from 'effect';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { gunzipSync } from 'node:zlib';
import { projectManagedSchemas } from './project-openapi.mts';

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
  const outputs = [
    { path: '../src/managed/requests.generated.json', value: projected.requests },
    { path: '../../../worker/runtime/src/managed/tools/worker-inputs.generated.json', value: projected.inputs },
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
