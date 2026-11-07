import { HttpMethod } from '@mechane/records';
import { MechNotFound, RequestInvalid, ServiceUnavailable } from '../../errors/errors.ts';
import { EvidenceNotFound, EvidenceUnavailable } from '../../errors/evidence.errors.ts';
import { Access } from '../../operation/constants.ts';
import { MediaResponse, ResponseKind } from '../../operation/media-response.ts';
import { NoFields } from '../../operation/schemas.ts';
import type { Operation } from '../../operation/types.ts';
import { MechPath } from '../schemas.ts';
import { EvidenceArtifact, EvidenceMediaType, EvidencePage, EvidencePath, EvidenceQuery } from './schemas.ts';

const listEvidence = {
  method: HttpMethod.Get,
  path: '/api/v1/workspaces/:workspace_id/mechs/:mech_id/evidence',
  access: Access.Member,
  params: MechPath,
  query: EvidenceQuery,
  body: NoFields,
  output: EvidencePage,
  errors: [MechNotFound, ServiceUnavailable, RequestInvalid],
} as const satisfies Operation;

const showEvidence = {
  method: HttpMethod.Get,
  path: '/api/v1/workspaces/:workspace_id/mechs/:mech_id/evidence/:artifact_id',
  access: Access.Member,
  params: EvidencePath,
  query: NoFields,
  body: NoFields,
  output: EvidenceArtifact,
  errors: [MechNotFound, EvidenceNotFound, ServiceUnavailable],
} as const satisfies Operation;

const readEvidenceContent = {
  method: HttpMethod.Get,
  path: '/api/v1/workspaces/:workspace_id/mechs/:mech_id/evidence/:artifact_id/content',
  access: Access.Member,
  params: EvidencePath,
  query: NoFields,
  body: NoFields,
  output: MediaResponse,
  response: { kind: ResponseKind.Media, mediaType: EvidenceMediaType },
  errors: [MechNotFound, EvidenceNotFound, EvidenceUnavailable, ServiceUnavailable],
} as const satisfies Operation;

/** Metadata and content share the workspace member authorization boundary. */
export const EVIDENCE_OPERATIONS = { listEvidence, showEvidence, readEvidenceContent } as const;
