export type BenchmarkProviderName = 'docker' | 'modal' | 'tensorlake';

export type BenchmarkSettings = {
  readonly provider: BenchmarkProviderName;
  readonly image: string;
  readonly iterations: number;
  readonly modalBridgeUrl: string | undefined;
  readonly modalBridgeToken: string | undefined;
  readonly modalAppName: string | undefined;
  readonly tensorlakeApiKey: string | undefined;
  readonly tensorlakeApiUrl: string | undefined;
};

const DEFAULT_IMAGE = 'debian:bookworm-slim';
const DEFAULT_ITERATIONS = 1;
const CLI_ARGUMENTS_OFFSET = 2;

function parseProvider(raw: string | undefined): BenchmarkProviderName {
  switch (raw) {
    case undefined:
    case 'docker':
      return 'docker';
    case 'modal':
    case 'tensorlake':
      return raw;
    default:
      throw new Error(`Unsupported benchmark provider: ${raw}`);
  }
}

function parseIterations(raw: string | undefined): number {
  if (raw === undefined) {
    return DEFAULT_ITERATIONS;
  }

  const parsed = Number(raw);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid benchmark iteration count: ${raw}`);
  }

  return parsed;
}

function readFlag(argumentsList: ReadonlyArray<string>, flag: string): string | undefined {
  const index = argumentsList.indexOf(flag);

  if (index === -1) {
    return undefined;
  }

  return argumentsList[index + 1];
}

export function loadBenchmarkSettings(
  argumentsList: ReadonlyArray<string> = process.argv.slice(CLI_ARGUMENTS_OFFSET),
  environment: Readonly<Record<string, string | undefined>> = process.env,
): BenchmarkSettings {
  const provider = parseProvider(readFlag(argumentsList, '--provider') ?? environment['MECHANE_BENCHMARK_PROVIDER']);
  const image = readFlag(argumentsList, '--image') ?? environment['MECHANE_SANDBOX_IMAGE'] ?? DEFAULT_IMAGE;
  const iterations = parseIterations(readFlag(argumentsList, '--iterations'));

  return {
    provider,
    image,
    iterations,
    modalBridgeUrl: environment['MECHANE_MODAL_BRIDGE_URL'],
    modalBridgeToken: environment['MECHANE_MODAL_BRIDGE_TOKEN'],
    modalAppName: environment['MECHANE_MODAL_APP_NAME'],
    tensorlakeApiKey: environment['MECHANE_TENSORLAKE_API_KEY'],
    tensorlakeApiUrl: environment['MECHANE_TENSORLAKE_API_URL'],
  };
}
