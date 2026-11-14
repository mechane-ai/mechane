import { Effect } from 'effect';
import type { EvalTarget } from './application-types.ts';
import { EvalTargetKind } from './constants.ts';
import { EvalAdapterFailed, EvalAdapterOperation } from './errors.ts';

type ValidateTargetOriginInput = Pick<EvalTarget, 'origin' | 'kind'>;

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);
const ROOT_PATH = '/';
const HTTPS_PROTOCOL = 'https:';
const HTTP_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);

export const validateTargetOrigin = Effect.fn('validateTargetOrigin')(function* ({
  origin,
  kind,
}: ValidateTargetOriginInput): Effect.fn.Return<void, EvalAdapterFailed> {
  const hasCredentials = origin.username !== '' || origin.password !== '';
  const hasSuffix = origin.search !== '' || origin.hash !== '';
  const hasOriginShape = origin.pathname === ROOT_PATH && !hasCredentials && !hasSuffix;

  if (!HTTP_PROTOCOLS.has(origin.protocol) || !hasOriginShape) {
    return yield* new EvalAdapterFailed({
      operation: EvalAdapterOperation.ValidateTarget,
      reason: 'The eval runtime URL must be an HTTP(S) origin without credentials, path, query or fragment',
    });
  }

  if (kind === EvalTargetKind.Local && !LOOPBACK_HOSTS.has(origin.hostname)) {
    return yield* new EvalAdapterFailed({
      operation: EvalAdapterOperation.ValidateTarget,
      reason: 'The local eval runtime must use a loopback origin',
    });
  }

  if (kind === EvalTargetKind.Hosted && origin.protocol !== HTTPS_PROTOCOL) {
    return yield* new EvalAdapterFailed({
      operation: EvalAdapterOperation.ValidateTarget,
      reason: 'The hosted eval runtime must use HTTPS',
    });
  }
});
