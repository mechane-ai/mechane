import { reportRecoveryFailure } from '../http/failure.ts';

type Recovery = { readonly step: string; readonly work: Promise<unknown> };

/** Wait for sibling scans to finish before their shared database connection can close. */
export async function finishRecovery(scans: ReadonlyArray<Recovery>): Promise<void> {
  const failed: Array<string> = [];

  await Promise.all(
    scans.map(async ({ step, work }) => {
      try {
        await work;
      } catch (failure) {
        reportRecoveryFailure(step, failure);
        failed.push(step);
      }
    }),
  );

  if (failed.length > 0) {
    throw new Error(`Recovery failed in ${failed.join(', ')}`);
  }
}
