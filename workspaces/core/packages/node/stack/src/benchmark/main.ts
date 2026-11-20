import { createDockerSandboxProvider } from '@mechane/sandbox-docker';
import { createModalSandboxProvider } from '@mechane/sandbox-modal';
import type { SandboxProviderAdapter } from '@mechane/sandbox-provider';
import { createTensorlakeSandboxProvider } from '@mechane/sandbox-tensorlake';
import { performance } from 'node:perf_hooks';
import type { BenchmarkSettings } from './settings.ts';
import { loadBenchmarkSettings } from './settings.ts';

const SESSION_SUFFIX_LENGTH = 12;
const JSON_INDENT_SPACES = 2;

type IterationMetrics = {
  readonly iteration: number;
  readonly coldBootMs: number;
  readonly snapshotMs: number;
  readonly stopMs: number;
  readonly warmResumeMs: number;
  readonly destroyMs: number;
};

function createAdapter(settings: BenchmarkSettings): SandboxProviderAdapter {
  if (settings.provider === 'docker') {
    return createDockerSandboxProvider({ entrypointCommand: ['sleep', '300'] });
  }

  if (settings.provider === 'tensorlake') {
    if (settings.tensorlakeApiKey === undefined || settings.tensorlakeApiKey.length === 0) {
      throw new Error('Set MECHANE_TENSORLAKE_API_KEY to benchmark Tensorlake');
    }

    return createTensorlakeSandboxProvider({ apiKey: settings.tensorlakeApiKey, baseUrl: settings.tensorlakeApiUrl });
  }

  const hasModalUrl = settings.modalBridgeUrl !== undefined && settings.modalBridgeUrl.length > 0;
  const hasModalToken = settings.modalBridgeToken !== undefined && settings.modalBridgeToken.length > 0;

  if (!hasModalUrl || !hasModalToken) {
    throw new Error('Set MECHANE_MODAL_BRIDGE_URL and MECHANE_MODAL_BRIDGE_TOKEN to benchmark Modal');
  }

  return createModalSandboxProvider({
    baseUrl: settings.modalBridgeUrl,
    bearerToken: settings.modalBridgeToken,
    appName: settings.modalAppName,
  });
}

async function measureMs<T>(operation: () => Promise<T>): Promise<{ readonly value: T; readonly durationMs: number }> {
  const startedAt = performance.now();
  const value = await operation();

  return { value, durationMs: Math.round(performance.now() - startedAt) };
}

async function runIteration(
  adapter: SandboxProviderAdapter,
  image: string,
  iteration: number,
): Promise<IterationMetrics> {
  const sessionId = `sesn_bench_${crypto.randomUUID().slice(0, SESSION_SUFFIX_LENGTH)}`;

  const baseSpecification = {
    workspaceId: '00000000-0000-4000-8000-000000000001',
    environmentId: 'env_benchmark',
    sessionId,
    generation: 1,
    workId: `work_bench_${iteration}`,
    workSecret: 'benchmark-placeholder',
    apiOrigin: 'https://mechane.invalid',
    image,
    existingSandboxId: null,
    snapshotId: null,
  };

  const cold = await measureMs(() => adapter.startOrResume(baseSpecification));

  try {
    const snapped = await measureMs(() => adapter.snapshot({ sandboxId: cold.value.sandboxId }));
    const stopped = await measureMs(() => adapter.stop({ sandboxId: cold.value.sandboxId, shouldSnapshot: false }));

    const resumed = await measureMs(() =>
      adapter.startOrResume({
        ...baseSpecification,
        generation: 2,
        existingSandboxId: cold.value.sandboxId,
        snapshotId: snapped.value.snapshotId,
      }),
    );

    const destroyed = await measureMs(() => adapter.destroy({ sandboxId: resumed.value.sandboxId }));

    return {
      iteration,
      coldBootMs: cold.durationMs,
      snapshotMs: snapped.durationMs,
      stopMs: stopped.durationMs,
      warmResumeMs: resumed.durationMs,
      destroyMs: destroyed.durationMs,
    };
  } catch (failure) {
    await adapter.destroy({ sandboxId: cold.value.sandboxId }).catch(() => undefined);

    throw failure;
  }
}

async function main(): Promise<void> {
  const settings = loadBenchmarkSettings();
  const adapter = createAdapter(settings);
  const results: Array<IterationMetrics> = [];

  for (let iteration = 1; iteration <= settings.iterations; iteration += 1) {
    results.push(await runIteration(adapter, settings.image, iteration));
  }

  const output = JSON.stringify(
    { provider: settings.provider, image: settings.image, results },
    null,
    JSON_INDENT_SPACES,
  );

  process.stdout.write(`${output}\n`);
}

await main();
