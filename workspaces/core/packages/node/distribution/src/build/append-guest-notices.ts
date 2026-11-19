import { Record, Schema } from 'effect';
import { appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CORE_FOLDER } from '../constants.ts';
import { guestNoticesDirectory } from '../load-distribution-settings.ts';
import { writeDependencyNotices } from './dependency-notices.ts';

const Metadata = Schema.fromJsonString(Schema.Struct({ inputs: Schema.Record(Schema.String, Schema.Unknown) }));
const directory = guestNoticesDirectory();
const workingDirectory = join(CORE_FOLDER, 'packages/node/guest');

for (const bundle of ['guest', 'mechane']) {
  const metadata = await readFile(join(directory, `${bundle}.json`), 'utf8');
  const { inputs } = Schema.decodeUnknownSync(Metadata)(metadata);
  const outputPath = join(directory, `${bundle}-notices.txt`);

  await writeDependencyNotices({ workingDirectory, inputs: Record.keys(inputs), outputPath });

  const notices = await readFile(outputPath, 'utf8');
  const comments = notices.split('\n').map((line) => `// ${line}`);

  await appendFile(join(workingDirectory, 'image', `${bundle}.mjs`), `\n${comments.join('\n')}\n`);
}
