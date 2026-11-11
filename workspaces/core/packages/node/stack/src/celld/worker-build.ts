import { workerBuildOptions } from '@mechane/wrangler';
import { context, formatMessages } from 'esbuild';
import type { BuildContext, Plugin } from 'esbuild';
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;

type WorkerBuildOptions = {
  readonly entry: string;
  readonly output: string;
  readonly isWatched: boolean;
  readonly logFile: string;
  readonly onBuild: (input: WorkerBuildResult) => Promise<void>;
};

type WorkerBuildResult = { readonly durationMs: number };

export async function startWorkerBuild(input: WorkerBuildOptions): Promise<BuildContext> {
  const entry = resolve(input.entry);
  const output = resolve(input.output);
  const temporaryOutput = join(dirname(output), 'next-worker.mjs');
  const measured = { startedAtMs: performance.now() };

  await mkdir(dirname(temporaryOutput), { recursive: true, mode: PRIVATE_DIRECTORY_MODE });

  const publish: Plugin = {
    name: 'publish-successful-worker',
    setup(build) {
      build.onStart(() => {
        measured.startedAtMs = performance.now();
      });
      build.onEnd(async (result) => {
        const errors = await formatMessages(result.errors, { kind: 'error', color: false });
        const warnings = await formatMessages(result.warnings, { kind: 'warning', color: false });
        const messages = [...errors, ...warnings];

        if (messages.length > 0) {
          await appendFile(input.logFile, messages.join('\n'), { mode: PRIVATE_FILE_MODE });
        }

        if (result.errors.length > 0) {
          return;
        }

        const bundle = result.outputFiles?.find((file) => file.path === output);

        if (bundle === undefined) {
          throw new Error(`Worker build did not emit ${output}`);
        }

        const previous = await readFile(output).catch((error: unknown) => {
          if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            return null;
          }

          throw error;
        });

        if (previous !== null && previous.equals(bundle.contents)) {
          return;
        }

        await writeFile(temporaryOutput, bundle.contents, { mode: PRIVATE_FILE_MODE });
        await rename(temporaryOutput, output);

        const durationMs = performance.now() - measured.startedAtMs;

        await input.onBuild({ durationMs });
      });
    },
  };

  const options = workerBuildOptions();

  const build = await context({
    ...options,
    absWorkingDir: dirname(entry),
    entryPoints: [entry],
    outfile: output,
    plugins: [publish],
    write: false,
    logLevel: 'warning',
  });

  try {
    await build.rebuild();

    if (input.isWatched) {
      await build.watch();
    }

    return build;
  } catch (error) {
    await build.dispose();

    throw error;
  }
}
