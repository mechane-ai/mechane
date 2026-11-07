import { join } from 'node:path';

/** A numeric directory entry already selected from the proc filesystem. */
export const ContainerProcessFile = { Status: 'status', Stat: 'stat' } as const;

type ContainerProcessPathInput = {
  readonly directory: string;
  readonly file: (typeof ContainerProcessFile)[keyof typeof ContainerProcessFile];
};

/** Builds the Linux proc status path for one numeric process identifier. */
export function containerProcessPath({ directory, file }: ContainerProcessPathInput): string {
  return join('/proc', directory, file);
}
