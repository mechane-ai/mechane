import type { SourceRequest } from '@mechane/protocol';
import type { PrincipalId } from '@mechane/records';
import type { SourceContext } from '../types.ts';

/** The authenticated owner identity accompanies every grant or publication mutation. */
export type SourceManagement = SourceContext & { readonly request: SourceRequest; readonly principalId: PrincipalId };
