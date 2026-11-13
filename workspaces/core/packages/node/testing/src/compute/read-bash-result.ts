import { readModelToolText } from '../model-result.ts';
import type { ModelToolResultInput } from '../model-result.ts';

export async function readBashResult(input: ModelToolResultInput) {
  return { output: await readModelToolText(input) };
}
