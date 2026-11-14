import { isAbsolute } from 'node:path';
import { parseArgs } from 'node:util';
import { CATALOG } from './catalog.ts';
import type { ScenarioFamily } from './catalog.ts';

type ArtifactSettings = { readonly directory: string; readonly guestImage: string; readonly cliExecutable: string };

type SmokeSettings = {
  readonly match: string | undefined;
  readonly family: ScenarioFamily | undefined;
  readonly nodeExecutable: string;
  readonly artifacts: ArtifactSettings | undefined;
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
      'artifact-directory': { type: 'string' },
      'guest-image': { type: 'string' },
      'cli-executable': { type: 'string' },
    },
    allowPositionals: true,
  });

  if (positionals.length > 1) {
    throw new Error('The smoke accepts at most one scenario-name filter');
  }

  const family = scenarioFamily(values.family);

  const artifacts = artifactSettings({
    directory: values['artifact-directory'],
    guestImage: values['guest-image'],
    cliExecutable: values['cli-executable'],
  });

  return {
    match: positionals[0],
    family,
    nodeExecutable: process.env['MECHANE_NODE_EXECUTABLE'] ?? process.execPath,
    artifacts,
  };
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
