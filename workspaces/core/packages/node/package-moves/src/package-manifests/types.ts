import type { Member } from '@mechane/checks-kernel';
import type { ManifestDependencies } from './schemas.ts';

/** A member's manifest before the step whole and its dependencies, by the member as it stands then. */
export type ReadManifest = {
  readonly member: Member;
  readonly manifest: Readonly<Record<string, unknown>>;
  readonly declared: ManifestDependencies;
};
