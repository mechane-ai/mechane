import type { SourceRequest } from '@mechane/protocol';
import type { PrincipalId, SourceId } from '@mechane/records';
import type { SourceCapture, SourceCheckout, SourceClone } from '@mechane/sandbox-wire';

export type SourceManageInput = { readonly request: typeof SourceRequest.Encoded; readonly principalId: PrincipalId };
export type SourcePrepareInput = { readonly checkout: typeof SourceCheckout.Encoded };
export type SourceCloneInput = { readonly clone: typeof SourceClone.Encoded };
export type SourceIdentityInput = { readonly sourceId: SourceId; readonly generation: SourceId };
export type SourceCaptureInput = { readonly capture: typeof SourceCapture.Encoded };
