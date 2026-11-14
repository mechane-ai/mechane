import { Effect, Result } from 'effect';
import type { EvalRunFailure } from './types.ts';

type CaptureEvalResultInput<A, R> = { readonly program: Effect.Effect<A, EvalRunFailure, R> };
type CaptureFailure<A> = (failure: EvalRunFailure) => Effect.Effect<Result.Result<A, EvalRunFailure>>;

/** Expected failures stay visible to the stage that persists their outcome. */
export const captureEvalResult = Effect.fn('captureEvalResult')(function* <A, R>({
  program,
}: CaptureEvalResultInput<A, R>): Effect.fn.Return<Result.Result<A, EvalRunFailure>, never, R> {
  const onFailure: CaptureFailure<A> = (failure) => {
    const result = Result.fail(failure);

    return Effect.succeed(result);
  };

  const captureSuccess = Effect.fn('captureSuccess')(function* (): Effect.fn.Return<
    Result.Result<A, EvalRunFailure>,
    EvalRunFailure,
    R
  > {
    const value = yield* program;

    return Result.succeed(value);
  });

  const captured = captureSuccess();

  return yield* captured.pipe(
    Effect.catchTags({
      AllowanceExhausted: onFailure,
      EvalAdapterFailed: onFailure,
      EvalFileFailed: onFailure,
      EvalInterrupted: onFailure,
      EvalManifestMissing: onFailure,
      EvalResponseInvalid: onFailure,
      EvalTransportFailed: onFailure,
      OperationFailed: onFailure,
      OriginUnreachable: onFailure,
      OutFolderBusy: onFailure,
      PlanChanged: onFailure,
      RequestTimedOut: onFailure,
      ResponseUnreadable: onFailure,
      SuiteInvalid: onFailure,
    }),
  );
});
