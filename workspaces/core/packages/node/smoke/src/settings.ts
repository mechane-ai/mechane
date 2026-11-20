import { Record } from 'effect';
import { isAbsolute } from 'node:path';
import { parseArgs } from 'node:util';
import { CATALOG } from './catalog.ts';
import type { ScenarioFamily } from './catalog.ts';
import { parseSmokeShard } from './shards.ts';
import type { SmokeShard } from './shards.ts';

type ArtifactSettings = { readonly directory: string; readonly guestImage: string; readonly cliExecutable: string };

type SmokeSettings = {
  readonly match: string | undefined;
  readonly family: ScenarioFamily | undefined;
  readonly shard: SmokeShard | undefined;
  readonly isCatalogSummaryOnly: boolean;
  readonly nodeExecutable: string;
  readonly inherited: Readonly<Record<string, string>>;
  readonly artifacts: ArtifactSettings | undefined;
  readonly reuseGuest: string | undefined;
};

type ArtifactArguments = {
  readonly directory: string | undefined;
  readonly guestImage: string | undefined;
  readonly cliExecutable: string | undefined;
};

const ARTIFACT_ARGUMENT_COUNT = 3;

export function smokeSettings(): SmokeSettings {
  const { values, positionals } = parseArgs({
    options: {
      'family': { type: 'string' },
      'shard': { type: 'string' },
      'catalog-summary': { type: 'boolean', default: false },
      'artifact-directory': { type: 'string' },
      'guest-image': { type: 'string' },
      'cli-executable': { type: 'string' },
      'reuse-guest': { type: 'string' },
    },
    allowPositionals: true,
  });

  if (positionals.length > 1) {
    throw new Error('The smoke accepts at most one scenario-name filter');
  }

  const family = scenarioFamily(values.family);
  const shard = smokeShard(values.shard);

  if (shard !== undefined && (family !== undefined || positionals[0] !== undefined)) {
    throw new Error('The smoke shard cannot be combined with --family or a scenario filter');
  }

  const artifacts = artifactSettings({
    directory: values['artifact-directory'],
    guestImage: values['guest-image'],
    cliExecutable: values['cli-executable'],
  });

  const reuseGuest = values['reuse-guest'];

  if (reuseGuest !== undefined && (artifacts !== undefined || !isAbsolute(reuseGuest))) {
    throw new Error('--reuse-guest selects an absolute guest-inputs.json path for a source replay');
  }

  const inherited = Record.filter(process.env, (value) => typeof value === 'string');

  return {
    match: positionals[0],
    family,
    shard,
    isCatalogSummaryOnly: values['catalog-summary'],
    nodeExecutable: process.env['MECHANE_NODE_EXECUTABLE'] ?? process.execPath,
    inherited,
    artifacts,
    reuseGuest,
  };
}

function smokeShard(value: string | undefined): SmokeShard | undefined {
  if (value === undefined) {
    return undefined;
  }

  return parseSmokeShard(value);
}

function scenarioFamily(value: string | undefined): ScenarioFamily | undefined {
  if (value === undefined) {
    return undefined;
  }

  const scenario = CATALOG.find(({ family }) => family === value);

  if (scenario === undefined) {
    throw new Error(`The smoke does not declare family ${value}`);
  }

  return scenario.family;
}

function artifactSettings({ directory, guestImage, cliExecutable }: ArtifactArguments): ArtifactSettings | undefined {
  const provided = [directory, guestImage, cliExecutable].filter((value) => value !== undefined);

  if (provided.length === 0) {
    return undefined;
  }

  if (provided.length !== ARTIFACT_ARGUMENT_COUNT || directory === undefined || guestImage === undefined) {
    throw new Error('The smoke requires artifact-directory, guest-image, and cli-executable together');
  }

  if (cliExecutable === undefined || !isAbsolute(directory) || !isAbsolute(cliExecutable)) {
    throw new Error('The smoke artifact directory and CLI executable must be absolute paths');
  }

  if (!/^sha256:[a-f0-9]{64}$/u.test(guestImage)) {
    throw new Error('The smoke guest image must be an immutable sha256 digest');
  }

  return { directory, guestImage, cliExecutable };
}
