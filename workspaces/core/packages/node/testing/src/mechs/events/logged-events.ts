import { SUCCESS_STATUS } from '@mechane/program';
import type { ProcessFailed } from '@mechane/program';
import type { Event } from '@mechane/protocol';
import { Effect, Option } from 'effect';
import type { Scope } from 'effect';
import { followCli } from '../../cli/follow-cli.ts';
import { CliStep } from '../../constants.ts';
import { CliFailed } from '../../errors.ts';
import type { CliUndecoded } from '../../errors.ts';
import type { FollowEventsInput } from '../types.ts';
import { followedEvents } from './followed-events.ts';

/** The events of a mech's log after a sequence, as one listing without `--follow` writes them to the log's end. */
export const loggedEvents = Effect.fn('loggedEvents')(function* ({
  stack,
  account,
  mechId,
  after,
}: FollowEventsInput): Effect.fn.Return<ReadonlyArray<Event>, CliFailed | CliUndecoded | ProcessFailed, Scope.Scope> {
  const args = ['event', 'list', mechId, '--after', String(after)];
  const command = args.join(' ');
  const running = yield* followCli({ stack, args, environment: account.environment });
  const { status, stderr } = yield* running.exited;

  if (!Option.contains(status, SUCCESS_STATUS)) {
    return yield* new CliFailed({ command, step: CliStep.Exit, status, stderr });
  }

  return yield* followedEvents({ running, command });
}, Effect.scoped);
