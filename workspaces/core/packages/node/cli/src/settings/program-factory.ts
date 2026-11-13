import type { ProgramSettings } from '@mechane/cli-kernel';

type ProgramFactoryInput = { readonly executablePath: string };

export type ProgramFactory = (input: ProgramFactoryInput) => ProgramSettings;
