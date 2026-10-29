import { BASELINE_FOLDER } from '../constants.ts';
import { BASELINE_EXTENSION } from './constants.ts';
import type { RuleInput } from './types.ts';

/** The path of a ratchet's baseline relative to the workspace, such as `lint/baseline/nullable-type.json`. */
export function baselinePath({ rule }: RuleInput): string {
  return `${BASELINE_FOLDER}/${rule}${BASELINE_EXTENSION}`;
}
