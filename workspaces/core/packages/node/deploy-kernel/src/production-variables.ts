import { writeDiagnostic } from '@mechane/program';
import { Effect, Schema } from 'effect';
import { DeployStep, PROGRAM } from './constants.ts';
import { DeployFailed } from './errors.ts';
import { ProductionVariables } from './schemas.ts';
import type { RenderedInput } from './types.ts';

/** Refuses credentials and local-only access before writing or reporting cloud variables. */
export function productionVariables({ rendered }: RenderedInput): Effect.Effect<ProductionVariables, DeployFailed> {
  return Schema.decodeUnknownEffect(ProductionVariables, { errors: 'all' })(rendered.variables).pipe(
    Effect.mapError(
      () =>
        new DeployFailed({
          step: DeployStep.DecodeRenderedVariables,
          reason:
            'invalid cloud variables; origins must use HTTPS and secrets and local launcher variables must be absent',
        }),
    ),
    Effect.tap(() =>
      Effect.sync(() =>
        writeDiagnostic({
          program: PROGRAM,
          line: 'rendered: cloud variables are valid and contain no secret or local bootstrap settings',
        }),
      ),
    ),
  );
}
