import { CONCEPT_ROLE_STEM, ROLE_FILE_STEMS } from './constants.ts';

/** The stems of the files a template fixes and of the role files, none of which is a behavior file. */
const NON_BEHAVIOR_STEMS: ReadonlySet<string> = new Set([
  ...ROLE_FILE_STEMS,
  'index',
  'main',
  'catalog',
  'migrations',
  'worker',
]);

/** The stems of the files a template fixes that name their object, store or program. */
const FIXED_STEM: Readonly<RegExp> = /-object$|^open-.+-store$|^load-.+-settings$/;

type StemInput = { readonly stem: string };

/** Whether a TypeScript file's stem names a behavior file: neither a role file nor a file a template fixes. */
export function isBehaviorStem({ stem }: StemInput): boolean {
  return !NON_BEHAVIOR_STEMS.has(stem) && !FIXED_STEM.test(stem) && !CONCEPT_ROLE_STEM.test(stem);
}
