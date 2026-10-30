import { Effect } from 'effect';
import { join } from 'node:path';
import type { DistributionFailed } from '../errors.ts';
import { runCommand } from '../files/run-command.ts';
import type { DistributionSettings } from '../types.ts';
import type { CelldRelease } from './schemas.ts';

const CELLD_NOTICES = ['LICENSE', 'NOTICE'] as const;

type DownloadCelldNoticesInput = {
  readonly folder: string;
  readonly release: CelldRelease;
  readonly settings: DistributionSettings;
};

/** Keeps upstream notices at the same version as the bundled celld binary. */
export const downloadCelldNotices = Effect.fn('downloadCelldNotices')(function* ({
  folder,
  release,
  settings,
}: DownloadCelldNoticesInput): Effect.fn.Return<void, DistributionFailed> {
  for (const name of CELLD_NOTICES) {
    const path = join(folder, `CELLD-${name}`);
    const url = celldNoticeUrl({ version: release.version, name });

    yield* runCommand({
      command: 'curl',
      args: ['--fail', '--silent', '--show-error', '--location', '--output', path, url],
      settings,
    });
  }
});

type CelldNoticeUrlInput = { readonly version: string; readonly name: (typeof CELLD_NOTICES)[number] };

function celldNoticeUrl({ version, name }: CelldNoticeUrlInput): string {
  return `https://raw.githubusercontent.com/denoland/celld/v${version}/${name}`;
}
