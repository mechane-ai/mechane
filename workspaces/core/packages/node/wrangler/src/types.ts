import type { StepFailureClass } from '@mechane/program';

/** The step of the program that reads the Worker's Wrangler configuration, and the failure the read fails as. */
export type ProgramFailureInput<S, E> = { readonly step: S; readonly failure: StepFailureClass<S, E> };
