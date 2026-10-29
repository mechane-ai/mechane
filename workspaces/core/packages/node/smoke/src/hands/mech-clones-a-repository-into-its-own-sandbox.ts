import { EXECUTION_VARIABLES } from '@mechane/sandbox-wire';
import { check, signedInAccount, talkingMech } from '@mechane/testing';
import type { ScenarioFailure, ScenarioInput } from '@mechane/testing';
import { Effect, Option, Record } from 'effect';
import type { Scope } from 'effect';
import { posix, sep } from 'node:path';
import { commandReply } from './command-reply.ts';
import { HOME_VARIABLE, RepositoryPart } from './constants.ts';
import { neighborSandbox } from './neighbor-sandbox.ts';
import { readmeRepository } from './readme-repository.ts';

/** The folder a mech clones the scenario's repository into, in its sandbox's home. */
const CLONE_FOLDER = 'hello';

/**
 * The names of every variable an execution may see, sorted: those with fixed values, the guest's `PATH` and the
 * machine's home, and those bash sets for itself.
 */
const SANDBOX_VARIABLE_NAMES: ReadonlyArray<string> = [
  ...Record.keys(EXECUTION_VARIABLES),
  'PATH',
  HOME_VARIABLE,
  'PWD',
  'SHLVL',
  '_',
].toSorted();

/**
 * A mech clones the scenario's repository with bash and prints its README, and its next turn prints it again from the
 * clone. A second mech of the same workspace lists a home without the clone, and its environment holds only the
 * variables an execution may see. Its home is in the stack's sandboxes folder, which the token scan reads, so a home
 * outside it would leave every machine's files unscanned.
 */
export const mechClonesARepositoryIntoItsOwnSandbox = Effect.fn('mechClonesARepositoryIntoItsOwnSandbox')(function* ({
  stack,
  guarantee,
}: ScenarioInput): Effect.fn.Return<void, ScenarioFailure, Scope.Scope> {
  const { url, line } = yield* readmeRepository({ stack });
  const account = yield* signedInAccount({ stack });
  const model = stack.modelUpstream.offers.echo.id;
  const readme = posix.join(CLONE_FOLDER, RepositoryPart.Readme);
  const cloning = yield* talkingMech({ stack, account, model });
  const clone = `git clone ${url} ${CLONE_FOLDER} && cat ${readme}`;
  const cloned = yield* commandReply({ mech: cloning, command: clone });
  const reread = yield* commandReply({ mech: cloning, command: `cat ${readme}` });
  const { listed, names, home } = yield* neighborSandbox({ stack, account, model });
  const isSandboxed: (path: string) => boolean = (path) => path.startsWith(`${stack.sandboxesFolder}${sep}`);

  yield* check({
    name: guarantee,
    conditions: [
      cloned.includes(line),
      reread.includes(line),
      !listed.includes(CLONE_FOLDER),
      JSON.stringify(names) === JSON.stringify(SANDBOX_VARIABLE_NAMES),
      Option.exists(home, isSandboxed),
    ],
    detail: `the clone answered ${JSON.stringify(cloned)} and the next turn ${JSON.stringify(reread)}; the second mech listed ${JSON.stringify(listed)} and saw the variables ${names.join(', ')}, with the home ${Option.getOrElse(home, () => 'unset')}`,
  });
}, Effect.scoped);
