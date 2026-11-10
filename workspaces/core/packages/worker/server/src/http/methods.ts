import { HttpMethod } from '@mechane/records';

export const READ_METHODS: ReadonlySet<string> = new Set([HttpMethod.Get, HttpMethod.Head]);
