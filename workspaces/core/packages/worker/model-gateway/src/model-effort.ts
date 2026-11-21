import { Schema } from 'effect';

export const ManagedEffort = Schema.Literals(['low', 'medium', 'high', 'xhigh', 'max']);
export type ManagedEffort = typeof ManagedEffort.Type;

export type ManagedModelOptions = {
  readonly speed?: 'fast' | 'standard' | undefined;
  readonly effort?: ManagedEffort | undefined;
};
