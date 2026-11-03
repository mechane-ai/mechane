import { BoundedTurn } from '@mechane/protocol';
import { Redacted, Result, Schema } from 'effect';

type RedactBoundedEvidenceInput = { readonly boundedTurn: BoundedTurn; readonly modelApiKey: Redacted.Redacted };

const BoundedTurnJson = Schema.fromJsonString(BoundedTurn);
const REDACTED_KEY = '[redacted model key]';
const REDACTION_NOTICE = 'The installation model credential was removed from recorded evidence.';

/** Scrubs the exact installation credential even when a provider or tool echoes it in a body or an error. */
export function redactBoundedEvidence({ boundedTurn, modelApiKey }: RedactBoundedEvidenceInput): BoundedTurn {
  const secret = Redacted.value(modelApiKey);

  if (secret.length === 0) {
    return boundedTurn;
  }

  const encodedKey = JSON.stringify(secret);
  const escapedKey = encodedKey.slice(1, -1);
  const encoded = Schema.encodeResult(BoundedTurnJson)(boundedTurn);
  const original = Result.getOrThrow(encoded);
  const sanitized = original.replaceAll(escapedKey, REDACTED_KEY);

  if (sanitized === original) {
    return boundedTurn;
  }

  const decoded = Schema.decodeUnknownResult(BoundedTurnJson)(sanitized);
  const result = Result.getOrThrow(decoded);

  return { ...result, isEvidenceComplete: false, unknowns: [...result.unknowns, REDACTION_NOTICE] };
}
